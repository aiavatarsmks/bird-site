/** Organiser workspace: today's list, one record for a team or person, office signals, corrections. */
import {fail,json,readJson,text,oneOf,int,newId} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,requireAdmin} from './permissions.mjs';
import {addRecoveryCode} from './auth.mjs';
import {award,projectXp,userXp} from './progress.mjs';
import {notify} from './notifications.mjs';
import {riskSignals,streak,teamScore,csvCell} from './cohort.mjs';
import {lastSeen,pitchOf} from './admin.mjs';
import {assignForUser} from './tasks.mjs';

const TEAM_ROLES="('owner','editor','member')";
const nameOf=project=>JSON.parse(project.draft||'{}').name||project.id;
const zagrebToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const memberRows=(db,projectId)=>db.query(`SELECT u.id,u.display_name,u.status,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.project_id=? AND m.revoked_at IS NULL AND m.role IN ${TEAM_ROLES} ORDER BY u.display_name`).all(projectId);
const memberIds=(db,projectId)=>memberRows(db,projectId).map(m=>m.id);
const taskTitle=t=>JSON.parse(t).en?.title||'';
const notesFor=(db,type,id)=>db.query('SELECT n.id,n.body,n.created,u.display_name author FROM organiser_notes n LEFT JOIN users u ON u.id=n.author WHERE n.target_type=? AND n.target_id=? ORDER BY n.created DESC LIMIT 30').all(type,id);
const lastNudge=(db,ids)=>ids.length?db.query(`SELECT max(created) t FROM notifications WHERE kind='nudge' AND user_id IN (${ids.map(()=>'?').join(',')})`).get(...ids).t:null;
const OPEN="('not_started','draft','changes_requested')";

function assignmentList(db,where,...args){
 return db.query(`SELECT a.id,a.user_id,a.project_id,a.period,t.id task_id,t.translations,t.xp,t.due_at,t.pick_mode,coalesce(s.status,'not_started') status,s.id submission_id,s.revision,u.display_name who FROM assignments a JOIN task_templates t ON t.id=a.task_id LEFT JOIN submissions s ON s.assignment_id=a.id LEFT JOIN users u ON u.id=a.user_id WHERE t.status IN ('published','closed') AND ${where} ORDER BY t.due_at IS NULL,t.due_at,a.created LIMIT 200`).all(...args).map(r=>({id:r.id,taskId:r.task_id,title:JSON.parse(r.translations),xp:r.xp,dueAt:r.due_at,status:r.status,who:r.who||'',optional:r.pick_mode==='catalog',submissionId:r.submission_id||null,revision:r.revision||0}));
}
function attendanceOf(db,userId){
 const held=db.query("SELECT id,date,title FROM lectures WHERE status='published' AND date<=? ORDER BY date").all(zagrebToday());
 const marks=new Map(db.query('SELECT lecture_id,kind FROM attendance WHERE user_id=?').all(userId).map(a=>[a.lecture_id,a.kind]));
 return held.map(l=>({id:l.id,date:l.date,title:JSON.parse(l.title),kind:marks.get(l.id)||null}));
}

/** The one place to start the day: only what needs a decision. */
export function today(ctx){
 requireAdmin(ctx);const db=ctx.db,now=nowIso();
 const waiting=db.query("SELECT count(*) n FROM submissions WHERE status='submitted'").get().n;
 const overdue=db.query(`SELECT a.user_id,a.project_id,t.id task_id,t.translations,t.due_at,u.display_name who,json_extract(p.draft,'$.name') team FROM assignments a JOIN task_templates t ON t.id=a.task_id LEFT JOIN submissions s ON s.assignment_id=a.id LEFT JOIN users u ON u.id=a.user_id LEFT JOIN projects p ON p.id=a.project_id WHERE t.status='published' AND t.pick_mode<>'catalog' AND t.due_at IS NOT NULL AND t.due_at<? AND coalesce(s.status,'not_started') IN ${OPEN} ORDER BY t.due_at LIMIT 40`).all(now).map(r=>({taskId:r.task_id,title:taskTitle(r.translations),dueAt:r.due_at,who:r.who||r.team||'',userId:r.user_id||null,projectId:r.project_id||null}));
 const help=db.query("SELECT c.project_id,c.blocker,json_extract(p.draft,'$.name') name FROM checkins c JOIN projects p ON p.id=c.project_id WHERE c.needs_help=1 ORDER BY c.created DESC LIMIT 8").all().map(r=>({projectId:r.project_id,name:r.name,blocker:r.blocker}));
 const day=zagrebToday();
 return json({
  ...signals(db),waiting,overdue,help,
  unverified:db.query("SELECT count(*) n FROM attendance WHERE kind='self_reported'").get().n,
  claims:db.query("SELECT count(*) n FROM person_claims WHERE status='pending'").get().n,
  lectures:db.query("SELECT id,date,time,place,title FROM lectures WHERE status='published' AND date>=? ORDER BY date LIMIT 3").all(day).map(l=>({id:l.id,date:l.date,time:l.time,place:l.place,title:JSON.parse(l.title)})),
  slots:db.query("SELECT h.id,h.mentor_name,h.starts_at,h.topic,json_extract(p.draft,'$.name') team FROM office_hours h LEFT JOIN office_hour_bookings b ON b.slot_id=h.id LEFT JOIN projects p ON p.id=b.project_id WHERE h.starts_at>=? ORDER BY h.starts_at LIMIT 3").all(now).map(s=>({id:s.id,mentor:s.mentor_name,startsAt:s.starts_at,topic:s.topic,team:s.team||''})),
 });
}

function signals(db){
 const now=nowIso();
 const teams=db.query("SELECT * FROM projects WHERE status<>'archived'").all().map(p=>{
  const ids=memberIds(db,p.id),risk=riskSignals(db,p.id,ids);
  const seen=ids.map(id=>lastSeen(db,id)).filter(Boolean).sort().at(-1)||null;
  const waiting=db.query(`SELECT count(*) n FROM assignments a JOIN submissions s ON s.assignment_id=a.id WHERE s.status='submitted' AND (a.project_id=? ${ids.length?`OR a.user_id IN (${ids.map(()=>'?').join(',')})`:''})`).get(p.id,...ids).n;
  return {id:p.id,name:nameOf(p),level:risk.level,signals:risk.signals,percent:teamScore(db,p.id,ids).percent,members:ids.length,waiting,lastSeen:seen,inactive:!!ids.length&&(!seen||Date.parse(now)-Date.parse(seen)>7*86400000)};
 }).sort((a,b)=>({risk:0,watch:1,ok:2}[a.level]-{risk:0,watch:1,ok:2}[b.level])||(a.percent??-1)-(b.percent??-1));
 return {teams};
}
/** Admin-only overlay for the office: never mixed into public office data. */
export function officeSignals(ctx){
 requireAdmin(ctx);
 const people=Object.fromEntries(ctx.db.query('SELECT id,person_id FROM users WHERE person_id IS NOT NULL').all().map(u=>[u.person_id,u.id]));
 return json({...signals(ctx.db),people});
}

export function teamRecord(ctx,id){
 requireAdmin(ctx);const db=ctx.db;
 const p=db.query('SELECT * FROM projects WHERE id=?').get(id);if(!p)fail(404,'NOT_FOUND');
 const members=memberRows(db,id),ids=members.map(m=>m.id),marks=ids.map(()=>'?').join(',');
 const roster=p.team_id?db.query('SELECT p.id,p.display_name,(SELECT 1 FROM users u WHERE u.person_id=p.id) linked FROM team_people t JOIN people p ON p.id=t.person_id WHERE t.team_id=?').all(p.team_id):[];
 const held=db.query("SELECT count(*) n FROM lectures WHERE status='published' AND date<=?").get(zagrebToday()).n;
 const ledger=db.query(`SELECT beneficiary_type type,amount,reason,created FROM xp_ledger WHERE (beneficiary_type='project' AND beneficiary_id=?) ${ids.length?`OR (beneficiary_type='user' AND beneficiary_id IN (${marks}))`:''} ORDER BY id DESC LIMIT 30`).all(id,...ids);
 return json({
  id,name:nameOf(p),status:p.status,score:teamScore(db,id,ids),risk:riskSignals(db,id,ids),streak:streak(db,id),teamXp:projectXp(db,id),pitch:pitchOf(db,id),lectures:held,
  members:members.map(m=>({id:m.id,name:m.display_name,role:m.role,status:m.status,lastSeen:lastSeen(db,m.id),xp:userXp(db,m.id),attended:db.query('SELECT count(*) n FROM attendance WHERE user_id=?').get(m.id).n,lastNudge:lastNudge(db,[m.id])})),
  noAccount:roster.filter(r=>!r.linked).map(r=>({id:r.id,name:r.display_name})),
  tasks:assignmentList(db,`(a.project_id=? ${ids.length?`OR a.user_id IN (${marks})`:''})`,id,...ids),
  checkins:db.query('SELECT week,metric_name,metric_value,goal,blocker,needs_help FROM checkins WHERE project_id=? ORDER BY week DESC LIMIT 6').all(id),
  files:db.query("SELECT id,filename,purpose,size,created FROM files WHERE project_id=? AND status='active' ORDER BY created DESC LIMIT 20").all(id),
  mentors:db.query('SELECT h.mentor_name,h.starts_at,h.topic,b.note FROM office_hour_bookings b JOIN office_hours h ON h.id=b.slot_id WHERE b.project_id=? ORDER BY h.starts_at DESC LIMIT 10').all(id),
  ledger,notes:notesFor(db,'team',id),lastNudge:lastNudge(db,ids),
 });
}

/** Accepts an account id or an office character id, so the office can open anyone. */
export function personRecord(ctx,id){
 requireAdmin(ctx);const db=ctx.db;
 const user=db.query('SELECT * FROM users WHERE id=?').get(id)||db.query('SELECT * FROM users WHERE person_id=?').get(id);
 if(!user){
  const person=db.query('SELECT id,display_name,kind FROM people WHERE id=?').get(id);if(!person)fail(404,'NOT_FOUND');
  const team=db.query("SELECT p.id,p.draft FROM team_people t JOIN projects p ON p.team_id=t.team_id WHERE t.person_id=?").get(id);
  return json({hasAccount:false,person:{id:person.id,name:person.display_name,kind:person.kind},teams:team?[{id:team.id,name:nameOf(team)}]:[],notes:[]});
 }
 const teams=db.query(`SELECT p.id,p.draft,m.role FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL AND m.role IN ${TEAM_ROLES}`).all(user.id);
 const pid=teams[0]?.id||'';
 return json({
  hasAccount:true,user:{id:user.id,login:user.login,name:user.display_name,email:user.email||'',role:user.role,status:user.status,created:user.created,lastSeen:lastSeen(db,user.id),xp:userXp(db,user.id),linkedin:user.linkedin||'',website:user.website||''},
  person:user.person_id?{id:user.person_id}:null,teams:teams.map(t=>({id:t.id,name:nameOf(t),role:t.role})),
  tasks:assignmentList(db,`(a.user_id=? OR a.project_id=?)`,user.id,pid),attendance:attendanceOf(db,user.id),
  ledger:db.query("SELECT amount,reason,created FROM xp_ledger WHERE beneficiary_type='user' AND beneficiary_id=? ORDER BY id DESC LIMIT 20").all(user.id),
  notes:notesFor(db,'user',user.id),lastNudge:lastNudge(db,[user.id]),
 });
}

/** Manual correction of points. Always a separate ledger row with a reason. */
export async function adjustXp(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const type=oneOf(body.type,['project','user'],'type'),id=text(body.id,{max:80},'id');
 const amount=int(body.amount,{min:-1000,max:1000},'amount');if(!amount)fail(400,'INVALID_FIELDS',{field:'amount'});
 const reason=text(body.reason,{min:3,max:200},'reason');
 if(!ctx.db.query(`SELECT 1 FROM ${type==='project'?'projects':'users'} WHERE id=?`).get(id))fail(404,'NOT_FOUND');
 award(ctx.db,{type,id,amount,sourceKey:'manual:'+newId('adj'),reason:'manual:'+reason,actor:admin.id});
 audit(ctx.db,admin.id,'xp.adjust',type==='project'?'project':'user',id,{amount,reason});
 return json({ok:true},201);
}
export async function addNote(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const type=oneOf(body.type,['team','user'],'type'),id=text(body.id,{max:80},'id'),note=text(body.body,{min:1,max:1000,multiline:true},'body');
 ctx.db.query('INSERT INTO organiser_notes(id,target_type,target_id,body,author,created) VALUES(?,?,?,?,?,?)').run(newId('note'),type,id,note,admin.id,nowIso());
 return json({ok:true},201);
}

/** Puts a person into one team in a single step and keeps the public roster in line. */
export async function setTeam(ctx,userId){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const user=ctx.db.query('SELECT * FROM users WHERE id=?').get(userId);if(!user)fail(404,'NOT_FOUND');
 const projectId=body.projectId?text(body.projectId,{max:80},'projectId'):null;
 const target=projectId?ctx.db.query("SELECT * FROM projects WHERE id=? AND status<>'archived'").get(projectId):null;
 if(projectId&&!target)fail(404,'NOT_FOUND');
 const now=nowIso();
 ctx.db.transaction(()=>{
  const old=ctx.db.query(`SELECT p.id,p.team_id FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL AND m.role IN ${TEAM_ROLES} AND m.project_id<>?`).all(userId,projectId||'');
  for(const p of old){
   ctx.db.query('UPDATE memberships SET revoked_at=? WHERE project_id=? AND user_id=?').run(now,p.id,userId);
   if(user.person_id&&p.team_id)ctx.db.query('DELETE FROM team_people WHERE team_id=? AND person_id=?').run(p.team_id,user.person_id);
  }
  if(target){
   ctx.db.query("INSERT INTO memberships(project_id,user_id,role,created) VALUES(?,?,'editor',?) ON CONFLICT(project_id,user_id) DO UPDATE SET revoked_at=NULL,role=CASE WHEN memberships.role='owner' AND memberships.revoked_at IS NULL THEN 'owner' ELSE 'editor' END").run(projectId,userId,now);
   if(user.person_id&&target.team_id)ctx.db.query('INSERT OR IGNORE INTO team_people(team_id,person_id) VALUES(?,?)').run(target.team_id,user.person_id);
  }
  audit(ctx.db,admin.id,'membership.move','user',userId,{to:projectId});
  notify(ctx.db,userId,'team.changed',{projectId});
 })();
 assignForUser(ctx.db,user);
 return json({ok:true});
}

/** One-time code for a person who lost access. Shown once; the organiser passes it on in person. */
export function resetCode(ctx,userId){
 const admin=requireAdmin(ctx);
 const user=ctx.db.query('SELECT id,login,role FROM users WHERE id=?').get(userId);if(!user)fail(404,'NOT_FOUND');
 if(user.role==='platform_owner')fail(409,'INVALID_STATE');
 const code=addRecoveryCode(ctx.db,userId);
 audit(ctx.db,admin.id,'user.reset_code','user',userId,{});
 return json({code,login:user.login},201);
}

export function exportPeople(ctx){
 requireAdmin(ctx);const db=ctx.db;
 const lines=[['name','login','email','team','points','tasks_done','lectures','last_seen'].join(',')];
 for(const u of db.query("SELECT * FROM users WHERE status='active' AND role='member' ORDER BY display_name").all()){
  const team=db.query(`SELECT json_extract(p.draft,'$.name') n FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL AND m.role IN ${TEAM_ROLES}`).get(u.id)?.n||'';
  const done=db.query("SELECT count(*) n FROM assignments a JOIN submissions s ON s.assignment_id=a.id WHERE a.user_id=? AND s.status='accepted'").get(u.id).n;
  const lectures=db.query('SELECT count(*) n FROM attendance WHERE user_id=?').get(u.id).n;
  lines.push([u.display_name,u.login,u.email||'',team,userXp(db,u.id),done,lectures,lastSeen(db,u.id)||''].map(csvCell).join(','));
 }
 return new Response('﻿'+lines.join('\r\n')+'\r\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="bird-people-${nowIso().slice(0,10)}.csv"`,'Cache-Control':'no-store'}});
}
