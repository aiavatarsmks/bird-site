/** Cohort tools: weekly check-ins, outcomes, announcements, team ranking, risk signals, export, calendar. */
import {fail,json,readJson,text,oneOf,int,newId,page} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,requireAdmin,requireProject} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {award,projectXp,userXp} from './progress.mjs';
import {isoWeek} from './tasks.mjs';

const CHECKIN_XP=10;
const weekBefore=(week,n=1)=>{const [y,w]=week.split('-W').map(Number);const d=new Date(Date.UTC(y,0,4+(w-1)*7-n*7));return isoWeek(d);};

/** Consecutive weeks with a check-in; one missed week inside the run is forgiven. */
export function streak(db,projectId){
 const weeks=new Set(db.query('SELECT week FROM checkins WHERE project_id=?').all(projectId).map(r=>r.week));
 let week=isoWeek(),count=0,forgiven=false;
 if(!weeks.has(week))week=weekBefore(week);
 for(let i=0;i<60;i++){if(weeks.has(week))count++;else if(!forgiven&&count>0&&weeks.has(weekBefore(week))){forgiven=true;}else break;week=weekBefore(week);}
 return count;
}

export async function saveCheckin(ctx,projectId){
 const user=requireUser(ctx);requireProject(ctx.db,user,projectId,'team');
 const body=await readJson(ctx.request);
 const week=isoWeek(),now=nowIso();
 const c={metric_name:text(body.metricName??'',{max:80},'metricName'),metric_value:text(body.metricValue??'',{max:80},'metricValue'),goal:text(body.goal??'',{min:1,max:500,multiline:true},'goal'),blocker:text(body.blocker??'',{max:500,multiline:true},'blocker'),needs_help:body.needsHelp?1:0};
 ctx.db.transaction(()=>{
  ctx.db.query(`INSERT INTO checkins(id,project_id,week,metric_name,metric_value,goal,blocker,needs_help,author,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(project_id,week) DO UPDATE SET metric_name=excluded.metric_name,metric_value=excluded.metric_value,goal=excluded.goal,blocker=excluded.blocker,needs_help=excluded.needs_help,author=excluded.author,updated=excluded.updated`).run(newId('chk'),projectId,week,c.metric_name,c.metric_value,c.goal,c.blocker,c.needs_help,user.id,now,now);
  award(ctx.db,{type:'project',id:projectId,amount:CHECKIN_XP,sourceKey:`checkin:${projectId}:${week}`,reason:'checkin:'+week});
 })();
 return listCheckins(ctx,projectId,201);
}
export function listCheckins(ctx,projectId,status=200){
 requireProject(ctx.db,ctx.user,projectId,'team');
 const rows=ctx.db.query('SELECT c.*,u.display_name author_name FROM checkins c JOIN users u ON u.id=c.author WHERE c.project_id=? ORDER BY c.week DESC LIMIT 30').all(projectId);
 return json({week:isoWeek(),streak:streak(ctx.db,projectId),items:rows.map(r=>({week:r.week,metricName:r.metric_name,metricValue:r.metric_value,goal:r.goal,blocker:r.blocker,needsHelp:!!r.needs_help,author:r.author_name,updated:r.updated}))},status);
}
export function adminCheckins(ctx){
 requireAdmin(ctx);const week=/^\d{4}-W\d{2}$/.test(ctx.url.searchParams.get('week')||'')?ctx.url.searchParams.get('week'):isoWeek();
 const rows=ctx.db.query("SELECT p.id,json_extract(p.draft,'$.name') name,c.metric_name,c.metric_value,c.goal,c.blocker,c.needs_help,c.updated FROM projects p LEFT JOIN checkins c ON c.project_id=p.id AND c.week=? WHERE p.status<>'archived' ORDER BY c.updated IS NULL,name").all(week);
 return json({week,items:rows.map(r=>({projectId:r.id,name:r.name,done:!!r.updated,metricName:r.metric_name,metricValue:r.metric_value,goal:r.goal,blocker:r.blocker,needsHelp:!!r.needs_help,updated:r.updated,streak:streak(ctx.db,r.id)}))});
}

// Outcomes reported to funders: money raised by type, hires, company registration, customers.
export async function addOutcome(ctx,projectId){
 const user=requireUser(ctx);requireProject(ctx.db,user,projectId,'edit');const body=await readJson(ctx.request);
 const kind=oneOf(body.kind,['funding','hire','company','customer','revenue'],'kind');
 const fundingType=kind==='funding'?oneOf(body.fundingType,['grant','equity','loan','prize','other'],'fundingType'):'';
 const amount=['funding','revenue'].includes(kind)?int(body.amount,{min:0,max:1e9},'amount'):(body.amount!==undefined&&body.amount!==''?int(body.amount,{min:0,max:10000},'amount'):null);
 const date=text(body.happenedOn||nowIso().slice(0,10),{max:10},'happenedOn');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(400,'INVALID_FIELDS',{field:'happenedOn'});
 const id=newId('out');
 ctx.db.query('INSERT INTO project_outcomes(id,project_id,kind,funding_type,amount,currency,happened_on,note,author,created) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,projectId,kind,fundingType,amount,'EUR',date,text(body.note??'',{max:300},'note'),user.id,nowIso());
 audit(ctx.db,user.id,'outcome.add','project',projectId,{kind});
 return json({id},201);
}
export function listOutcomes(ctx,projectId){
 requireProject(ctx.db,ctx.user,projectId,'team');
 return json({items:ctx.db.query('SELECT o.id,o.kind,o.funding_type,o.amount,o.currency,o.happened_on,o.note,u.display_name author FROM project_outcomes o JOIN users u ON u.id=o.author WHERE o.project_id=? ORDER BY o.happened_on DESC').all(projectId).map(o=>({id:o.id,kind:o.kind,fundingType:o.funding_type,amount:o.amount,currency:o.currency,happenedOn:o.happened_on,note:o.note,author:o.author}))});
}
export function deleteOutcome(ctx,projectId,id){
 const user=requireUser(ctx);requireProject(ctx.db,user,projectId,'edit');
 ctx.db.query('DELETE FROM project_outcomes WHERE id=? AND project_id=?').run(id,projectId);audit(ctx.db,user.id,'outcome.delete','project',projectId,{id});return json({ok:true});
}

// Announcements ---------------------------------------------------------------------------
export async function createAnnouncement(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const id=newId('ann');
 ctx.db.query('INSERT INTO announcements(id,title,body,pinned,author,created) VALUES(?,?,?,?,?,?)').run(id,text(body.title,{min:1,max:160},'title'),text(body.body,{min:1,max:4000,multiline:true},'body'),body.pinned?1:0,admin.id,nowIso());
 audit(ctx.db,admin.id,'announcement.create','announcement',id,{});
 return json({id},201);
}
export function archiveAnnouncement(ctx,id){const admin=requireAdmin(ctx);ctx.db.query('UPDATE announcements SET archived_at=? WHERE id=?').run(nowIso(),id);audit(ctx.db,admin.id,'announcement.archive','announcement',id,{});return json({ok:true});}
export function listAnnouncements(ctx){
 const {limit}=page(ctx.url,20);
 const rows=ctx.db.query('SELECT a.*,u.display_name author_name FROM announcements a JOIN users u ON u.id=a.author WHERE a.archived_at IS NULL ORDER BY a.pinned DESC,a.created DESC LIMIT ?').all(limit);
 const read=ctx.user?new Set(ctx.db.query('SELECT announcement_id FROM announcement_reads WHERE user_id=?').all(ctx.user.id).map(r=>r.announcement_id)):new Set();
 const total=ctx.db.query('SELECT count(*) n FROM users WHERE status=\'active\'').get().n;
 return json({items:rows.map(a=>({id:a.id,title:a.title,body:a.body,pinned:!!a.pinned,author:a.author_name,created:a.created,read:read.has(a.id),...(ctx.user&&['program_admin','platform_owner'].includes(ctx.user.role)?{readBy:ctx.db.query('SELECT count(*) n FROM announcement_reads WHERE announcement_id=?').get(a.id).n,audience:total}:{})}))});
}
export function readAnnouncements(ctx){
 const user=requireUser(ctx),now=nowIso();
 for(const {id} of ctx.db.query('SELECT id FROM announcements WHERE archived_at IS NULL').all())ctx.db.query('INSERT OR IGNORE INTO announcement_reads(user_id,announcement_id,read_at) VALUES(?,?,?)').run(user.id,id,now);
 return json({ok:true});
}

/** Team ranking: only team totals and weekly gain; personal tasks and private metrics stay out. */
export function teamRanking(ctx){
 const week=isoWeek(),since=new Date(Date.now()-7*86400000).toISOString();
 const rows=ctx.db.query("SELECT p.id,json_extract(coalesce(p.published,p.draft),'$.name') name FROM projects p WHERE p.status='published' OR EXISTS(SELECT 1 FROM memberships m WHERE m.project_id=p.id AND m.revoked_at IS NULL)").all();
 const items=rows.filter(r=>r.id).map(p=>{
  const members=ctx.db.query("SELECT user_id FROM memberships WHERE project_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')").all(p.id).map(m=>m.user_id);
  const team=projectXp(ctx.db,p.id),weekGain=ctx.db.query("SELECT coalesce(sum(amount),0) n FROM xp_ledger WHERE beneficiary_type='project' AND beneficiary_id=? AND created>=?").get(p.id,since).n;
  return {projectId:p.id,name:p.name,teamXp:team,weekGain,streak:streak(ctx.db,p.id),members:members.length};
 }).filter(t=>t.members>0||t.teamXp>0).sort((a,b)=>b.teamXp-a.teamXp||b.weekGain-a.weekGain||a.name.localeCompare(b.name));
 return json({week,items,rules:{checkinXp:CHECKIN_XP}});
}

/** Risk signals: a team is flagged only when two or more signals coincide. */
export function riskSignals(db,projectId,memberIds){
 const week=isoWeek(),signals=[];
 // Teams without accounts cannot report anything yet: flag once, softly.
 if(!memberIds.length)return {level:'watch',signals:['no_accounts']};
 const recent=db.query('SELECT count(*) n FROM checkins WHERE project_id=? AND week IN (?,?)').get(projectId,week,weekBefore(week)).n;
 if(!recent)signals.push('no_checkin');
 const overdue=db.query(`SELECT count(*) n FROM assignments a JOIN task_templates t ON t.id=a.task_id LEFT JOIN submissions s ON s.assignment_id=a.id WHERE t.status='published' AND t.due_at IS NOT NULL AND t.due_at<? AND coalesce(s.status,'not_started') IN ('not_started','draft','changes_requested') AND (a.project_id=? ${memberIds.length?`OR a.user_id IN (${memberIds.map(()=>'?').join(',')})`:''})`).get(nowIso(),projectId,...memberIds).n;
 if(overdue)signals.push('overdue_tasks');
 const held=db.query("SELECT count(*) n FROM lectures WHERE status='published' AND date<=?").get(nowIso().slice(0,10)).n;
 if(held&&memberIds.length){const seen=db.query(`SELECT count(*) n FROM attendance WHERE user_id IN (${memberIds.map(()=>'?').join(',')})`).get(...memberIds).n;if(seen<held*memberIds.length/2)signals.push('low_attendance');}
 const help=db.query('SELECT needs_help FROM checkins WHERE project_id=? AND week=?').get(projectId,week);
 if(help?.needs_help)signals.push('needs_help');
 const level=signals.filter(s=>s!=='needs_help').length>=2?'risk':signals.length?'watch':'ok';
 return {level,signals};
}

const csvCell=v=>{const s=String(v??'');return /[",\n;]/.test(s)||/^[=+\-@]/.test(s)?`"${(/^[=+\-@]/.test(s)?"'":'')+s.replace(/"/g,'""')}"`:s;};
/** Funder report: one row per team. Opens in Google Sheets / Excel. */
export function exportCsv(ctx){
 requireAdmin(ctx);
 const head=['project','status','stage','members','team_points','personal_points','tasks_done','tasks_total','attendance_verified','attendance_self','checkins','checkin_streak','last_checkin_week','funding_grant_eur','funding_equity_eur','funding_loan_eur','funding_prize_eur','funding_other_eur','revenue_eur','hires','customers','company_registered','risk'];
 const lines=[head.join(',')];
 for(const p of ctx.db.query("SELECT * FROM projects WHERE status<>'archived' ORDER BY json_extract(draft,'$.name')").all()){
  const c=JSON.parse(p.draft),members=ctx.db.query("SELECT user_id FROM memberships WHERE project_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')").all(p.id).map(m=>m.user_id),marks=members.map(()=>'?').join(',');
  const tasks=ctx.db.query(`SELECT coalesce(s.status,'') st FROM assignments a JOIN task_templates t ON t.id=a.task_id LEFT JOIN submissions s ON s.assignment_id=a.id WHERE t.status IN ('published','closed') AND (a.project_id=? ${members.length?`OR a.user_id IN (${marks})`:''})`).all(p.id,...members);
  const att=members.length?ctx.db.query(`SELECT kind,count(*) n FROM attendance WHERE user_id IN (${marks}) GROUP BY kind`).all(...members):[];
  const sum=(kind,type)=>ctx.db.query('SELECT coalesce(sum(amount),0) n FROM project_outcomes WHERE project_id=? AND kind=? AND (?=\'\' OR funding_type=?)').get(p.id,kind,type||'',type||'').n;
  const count=kind=>ctx.db.query('SELECT coalesce(sum(coalesce(amount,1)),0) n FROM project_outcomes WHERE project_id=? AND kind=?').get(p.id,kind).n;
  const last=ctx.db.query('SELECT week FROM checkins WHERE project_id=? ORDER BY week DESC LIMIT 1').get(p.id)?.week||'';
  lines.push([c.name,p.status,c.stage,members.length,projectXp(ctx.db,p.id),members.reduce((n,u)=>n+userXp(ctx.db,u),0),tasks.filter(t=>t.st==='accepted').length,tasks.length,att.find(a=>a.kind==='verified_by_admin')?.n||0,att.find(a=>a.kind==='self_reported')?.n||0,ctx.db.query('SELECT count(*) n FROM checkins WHERE project_id=?').get(p.id).n,streak(ctx.db,p.id),last,sum('funding','grant'),sum('funding','equity'),sum('funding','loan'),sum('funding','prize'),sum('funding','other'),sum('revenue'),count('hire'),count('customer'),ctx.db.query("SELECT 1 FROM project_outcomes WHERE project_id=? AND kind='company'").get(p.id)?'yes':'no',riskSignals(ctx.db,p.id,members).level].map(csvCell).join(','));
 }
 return new Response('﻿'+lines.join('\r\n')+'\r\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="bird-report-${nowIso().slice(0,10)}.csv"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

/** Public calendar feed of lectures (subscribe in Google Calendar / Apple Calendar). */
export function calendar(ctx){
 const esc=s=>String(s).replace(/[\\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n');
 const stamp=nowIso().replace(/[-:]/g,'').slice(0,15)+'Z';
 const events=ctx.db.query("SELECT * FROM lectures WHERE status='published' ORDER BY date").all().map(l=>{const t=JSON.parse(l.title),d=l.date.replace(/-/g,'');const next=new Date(Date.parse(l.date+'T00:00:00Z')+86400000).toISOString().slice(0,10).replace(/-/g,'');
  return ['BEGIN:VEVENT',`UID:${l.id}@bird-notes`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${next}`,`SUMMARY:${esc('BIRD: '+(t.en||l.id))}`,...(l.speaker?[`DESCRIPTION:${esc(l.speaker)}`]:[]),'END:VEVENT'].join('\r\n');});
 return new Response(['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BIRD study notes//EN','X-WR-CALNAME:BIRD lectures','X-WR-TIMEZONE:Europe/Zagreb',...events,'END:VCALENDAR',''].join('\r\n'),{headers:{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'public, max-age=900'}});
}
