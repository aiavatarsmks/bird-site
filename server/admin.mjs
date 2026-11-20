/** Admin: overview of projects (status, points, what is left), users and roles, audit, settings. */
import {fail,json,readJson,oneOf,page,text} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,requireAdmin,PERMISSION_MATRIX} from './permissions.mjs';
import {publicUser} from './auth.mjs';
import {projectXp,userXp,teamPoints} from './progress.mjs';
import {notify} from './notifications.mjs';
import {riskSignals,streak,teamPercent,teamSince} from './cohort.mjs';
import {onlyDemoPeople} from './demo-visit.mjs';
import {stageOf,fundingOf,stageSince,teamFilter,matchesTeam} from './stages.mjs';

/**
 * One row per project: status, stage and financing, team and personal points, attendance, open and waiting tasks.
 * ?stage=idea,mvp&raisedMin=&raisedMax= narrows the list (stages.mjs, matchesTeam); `total` counts before the filter.
 */
export function projectsOverview(ctx){
 requireAdmin(ctx);
 const rows=ctx.db.query("SELECT * FROM projects WHERE status<>'archived' OR ?=1 ORDER BY json_extract(draft,'$.name')").all(ctx.url.searchParams.get('archived')==='1'?1:0);
 const lectures=ctx.db.query("SELECT count(*) n FROM lectures WHERE status='published' AND date<=?").get(new Date().toISOString().slice(0,10)).n;
 // Filter first: the per-team numbers below are the expensive part.
 const filter=teamFilter(ctx.url.searchParams),chosen=rows.filter(p=>matchesTeam({stage:stageOf(JSON.parse(p.draft).stage),funding:fundingOf(p)},filter));
 const items=chosen.map(p=>{
  const members=ctx.db.query("SELECT u.id,u.display_name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.project_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member')").all(p.id);
  const ids=members.map(m=>m.id),marks=ids.map(()=>'?').join(',');
  const personal=members.reduce((n,m)=>n+userXp(ctx.db,m.id),0);
  const attendance=ids.length?ctx.db.query(`SELECT kind,count(*) n FROM attendance WHERE user_id IN (${marks}) GROUP BY kind`).all(...ids):[];
  const assignments=ctx.db.query(`SELECT a.id,a.status,a.task_id,t.translations,t.xp,t.due_at,coalesce(s.status,'not_started') sub FROM assignments a JOIN task_templates t ON t.id=a.task_id LEFT JOIN submissions s ON s.assignment_id=a.id WHERE t.status='published' AND (a.project_id=? ${ids.length?`OR a.user_id IN (${marks})`:''})`).all(p.id,...ids);
  // Most urgent first: overdue, then the nearest deadline, then work sent back; tasks without a date last.
  const open=assignments.filter(a=>['not_started','draft','changes_requested'].includes(a.sub)).sort(byUrgency),since=teamSince(ctx.db,p.id);
  return {
   id:p.id,name:JSON.parse(p.draft).name,status:p.status,source:p.source,stage:stageOf(JSON.parse(p.draft).stage),stageSince:stageSince(ctx.db,p.id),funding:fundingOf(p),updated:p.updated,
   members:members.map(m=>m.display_name),
   // People on the roster who have not registered yet, so the dashboard can say whom to invite.
   noAccount:p.team_id?ctx.db.query('SELECT p.display_name n FROM team_people t JOIN people p ON p.id=t.person_id WHERE t.team_id=? AND NOT EXISTS(SELECT 1 FROM users u WHERE u.person_id=p.id) ORDER BY p.display_name').all(p.team_id).map(r=>r.n):[],
   percent:teamPercent(ctx.db,p.id,ids),overdue:open.filter(a=>a.due_at&&a.due_at<nowIso()&&a.due_at>since).length,pitch:pitchOf(ctx.db,p.id),mentorSessions:ctx.db.query('SELECT count(*) n FROM office_hour_bookings WHERE project_id=?').get(p.id).n,
   // totalXp is the team's one points number (teamPoints), as on the team's own screens and in the ranking.
   ...(pts=>({teamXp:pts.own,personalXp:pts.members,totalXp:pts.total}))(teamPoints(ctx.db,p.id)),
   attendance:{selfReported:attendance.find(a=>a.kind==='self_reported')?.n||0,verified:attendance.find(a=>a.kind==='verified_by_admin')?.n||0,lecturesHeld:lectures},
   tasks:{total:assignments.length,done:assignments.filter(a=>a.sub==='accepted').length,waitingReview:assignments.filter(a=>a.sub==='submitted').length,open:open.length},
   risk:riskSignals(ctx.db,p.id,ids),streak:streak(ctx.db,p.id),lastSeen:ids.map(id=>lastSeen(ctx.db,id)).filter(Boolean).sort().at(-1)||null,
   todo:todoList(open),
  };
 });
 return json({items,total:rows.length,filter,generated:nowIso()});
}

// One line per task: a personal task open for three members is one next step with open:3.
function todoList(open){
 const seen=new Map();
 for(const a of open){const t=seen.get(a.task_id);if(t){t.open++;continue;}seen.set(a.task_id,{assignmentId:a.id,title:JSON.parse(a.translations),xp:a.xp,dueAt:a.due_at,status:a.sub,overdue:!!a.due_at&&a.due_at<nowIso(),open:1});}
 return [...seen.values()].slice(0,6);
}
const byUrgency=(a,b)=>(a.due_at?0:1)-(b.due_at?0:1)||String(a.due_at||'').localeCompare(String(b.due_at||''))||(b.sub==='changes_requested')-(a.sub==='changes_requested')||b.xp-a.xp;

/** Deck status and pitch count from the two programme tasks. */
export function pitchOf(db,projectId){
 const status=key=>db.query("SELECT s.status,s.draft FROM assignments a JOIN task_templates t ON t.id=a.task_id LEFT JOIN submissions s ON s.assignment_id=a.id WHERE t.key=? AND a.project_id=?").get(key,projectId);
 const deck=status('presentation'),pitches=status('investor-pitches');
 // A deck in the project files counts as "uploaded" even before the presentation task is handed in.
 const file=db.query("SELECT id,filename FROM files WHERE project_id=? AND status='active' AND purpose='document' AND (filename LIKE '%.pptx' OR (filename LIKE '%.pdf' AND (lower(filename) LIKE '%deck%' OR lower(filename) LIKE '%pitch%' OR lower(filename) LIKE '%prezent%' OR lower(filename) LIKE '%presentation%'))) ORDER BY created DESC LIMIT 1").get(projectId);
 const st=deck?.status||'not_started';
 return {deck:file&&['not_started','draft'].includes(st)?'uploaded':st,pitches:JSON.parse(pitches?.draft||'{}').count||0,deckFile:file?{id:file.id,filename:file.filename}:null};
}

/** Latest activity of any of the person's sessions (updated at most every 5 minutes). */
export const lastSeen=(db,userId)=>db.query('SELECT max(last_seen) t FROM sessions WHERE user_id=?').get(userId)?.t||null;

/** Organiser reminder: an in-account message to chosen people or a whole team. */
export async function nudge(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const message=text(body.message,{min:1,max:300,multiline:true},'message');
 const ids=new Set(Array.isArray(body.userIds)?body.userIds.slice(0,300).map(String):[]);
 if(body.projectId)for(const m of ctx.db.query("SELECT user_id FROM memberships WHERE project_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')").all(String(body.projectId)))ids.add(m.user_id);
 let sent=0;
 ctx.db.transaction(()=>{for(const id of ids){if(!ctx.db.query("SELECT 1 FROM users WHERE id=? AND status='active'").get(id))continue;notify(ctx.db,id,'nudge',{message,from:admin.display_name});sent++;}})();
 audit(ctx.db,admin.id,'nudge.send','users',body.projectId?String(body.projectId):'selected',{sent});
 return json({sent});
}

export function listUsers(ctx){
 requireAdmin(ctx);const {limit,offset}=page(ctx.url,100);const q=(ctx.url.searchParams.get('q')||'').slice(0,60).toLowerCase();
 const rows=ctx.db.query("SELECT * FROM users WHERE (?1='' OR lower(login) LIKE ?2 OR lower(display_name) LIKE ?2) AND (?5=0 OR id LIKE 'demo-user-%') ORDER BY created DESC LIMIT ?3 OFFSET ?4").all(q,'%'+q+'%',limit+1,offset,onlyDemoPeople(ctx)?1:0);
 return json({items:rows.slice(0,limit).map(u=>({...publicUser(u),email:undefined,status:u.status,created:u.created,programmeManager:!!u.programme_manager,lastSeen:lastSeen(ctx.db,u.id),xp:userXp(ctx.db,u.id),lectures:ctx.db.query('SELECT count(*) n FROM attendance WHERE user_id=?').get(u.id).n,tasksDone:ctx.db.query("SELECT count(*) n FROM assignments a JOIN submissions s ON s.assignment_id=a.id WHERE a.user_id=? AND s.status='accepted'").get(u.id).n,projects:ctx.db.query("SELECT json_extract(p.draft,'$.name') name FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL").all(u.id).map(r=>r.name)})),hasMore:rows.length>limit});
}
/** Marks an organiser as a programme manager: teams' "Write to the programme manager" goes to the marked ones. */
export async function setManager(ctx,userId){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const u=ctx.db.query('SELECT * FROM users WHERE id=?').get(userId);if(!u)fail(404,'NOT_FOUND');
 if(!['program_admin','platform_owner'].includes(u.role))fail(409,'INVALID_STATE');
 ctx.db.query('UPDATE users SET programme_manager=?,updated=? WHERE id=?').run(body.on?1:0,nowIso(),userId);
 audit(ctx.db,admin.id,'user.manager','user',userId,{on:!!body.on});
 return json({ok:true});
}
/** Organisers change program roles, the platform owner stays as it is. The changed user's sessions are revoked. */
export async function setRole(ctx,userId){
 const owner=requireAdmin(ctx),body=await readJson(ctx.request);
 const role=oneOf(body.role,['member','program_admin'],'role');
 const target=ctx.db.query('SELECT * FROM users WHERE id=?').get(userId);if(!target)fail(404,'NOT_FOUND');
 if(target.role==='platform_owner')fail(409,'INVALID_STATE');
 const now=nowIso();
 ctx.db.transaction(()=>{
  ctx.db.query('UPDATE users SET role=?,updated=? WHERE id=?').run(role,now,userId);
  ctx.db.query('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(now,userId);
  audit(ctx.db,owner.id,'role.set','user',userId,{from:target.role,to:role});
  notify(ctx.db,userId,'role.changed',{role});
 })();
 return json({ok:true});
}
export async function setUserStatus(ctx,userId){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const status=oneOf(body.status,['active','disabled'],'status');
 const target=ctx.db.query('SELECT * FROM users WHERE id=?').get(userId);if(!target)fail(404,'NOT_FOUND');
 if(target.role==='platform_owner')fail(409,'INVALID_STATE');
 ctx.db.query('UPDATE users SET status=?,updated=? WHERE id=?').run(status,nowIso(),userId);
 if(status==='disabled')ctx.db.query('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(nowIso(),userId);
 audit(ctx.db,admin.id,'user.status','user',userId,{status});
 return json({ok:true});
}
const TARGET_NAME={user:"SELECT display_name n FROM users WHERE id=?",project:"SELECT json_extract(draft,'$.name') n FROM projects WHERE id=?",task:"SELECT coalesce(nullif(json_extract(translations,'$.en.title'),''),nullif(json_extract(translations,'$.hr.title'),''),json_extract(translations,'$.ru.title')) n FROM task_templates WHERE id=?",lecture:"SELECT json_extract(title,'$.en') n FROM lectures WHERE id=?",person:"SELECT display_name n FROM people WHERE id=?"};
export function auditLog(ctx){
 requireAdmin(ctx);const {limit,offset}=page(ctx.url,100);const prefix=(ctx.url.searchParams.get('prefix')||'').slice(0,30);
 const rows=ctx.db.query("SELECT a.*,u.display_name actor_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor WHERE (?1='' OR a.action LIKE ?1||'.%') AND (?4=0 OR a.actor LIKE 'demo-user-%') ORDER BY a.id DESC LIMIT ?2 OFFSET ?3").all(prefix,limit+1,offset,onlyDemoPeople(ctx)?1:0);
 const name=r=>TARGET_NAME[r.target_type]?ctx.db.query(TARGET_NAME[r.target_type]).get(r.target_id)?.n:null;
 return json({items:rows.slice(0,limit).map(r=>({id:r.id,actor:r.actor_name||'',action:r.action,targetType:r.target_type,targetId:r.target_id,targetName:name(r)||'',detail:JSON.parse(r.detail),created:r.created})),hasMore:rows.length>limit});
}
export function settings(ctx){
 requireAdmin(ctx);const l=ctx.config.limits;
 return json({limits:{documentMB:l.documentBytes/1048576,imageMB:l.imageBytes/1048576,projectMB:l.projectBytes/1048576,uploadsMB:l.volumeBytes/1048576},mail:ctx.config.mailer,scanner:ctx.scanner.name,permissions:PERMISSION_MATRIX});
}
