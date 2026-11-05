/** Tasks, assignments, submissions with revisions, reviews and rewards. */
import {fail,json,readJson,text,oneOf,int,httpUrl,newId,page,rateLimit} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin,membership,requireAdmin} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {notify} from './notifications.mjs';
import {award,reverse,badgeForRule} from './progress.mjs';
import {canReadFile} from './files.mjs';
import {reportAttendance} from './lectures.mjs';

export const TYPES=['checklist','counter','text','link','attachment','attendance','team_result'];
const LANGS=['en','hr','ru'];

/** ISO week in Europe/Zagreb, for example 2026-W45. */
export function isoWeek(date=new Date()){
 const local=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)+'T00:00:00Z');
 const day=(local.getUTCDay()+6)%7;local.setUTCDate(local.getUTCDate()-day+3);
 const first=new Date(Date.UTC(local.getUTCFullYear(),0,4));
 const week=1+Math.round(((local-first)/86400000-3+((first.getUTCDay()+6)%7))/7);
 return `${local.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

function cleanTranslations(input){
 const out={};
 for(const l of LANGS){
  const t=input?.[l]||{};
  const required=l==='en';
  out[l]={title:text(t.title??'',{min:required?1:0,max:160},`translations.${l}.title`),goal:text(t.goal??'',{max:600,multiline:true},`translations.${l}.goal`),instructions:text(t.instructions??'',{min:required?1:0,max:4000,multiline:true},`translations.${l}.instructions`),criteria:text(t.criteria??'',{max:1000,multiline:true},`translations.${l}.criteria`)};
 }
 return out;
}
function cleanTask(body){
 const type=oneOf(body.type,TYPES,'type'),scope=oneOf(body.scope,['personal','team'],'scope');
 const checklist=type==='checklist'?(Array.isArray(body.checklist)?body.checklist:[]).slice(0,12).map((item,i)=>Object.fromEntries(LANGS.map(l=>[l,text(item?.[l]??'',{min:l==='en'?1:0,max:200},'checklist.'+i)]))):[];
 if(type==='checklist'&&!checklist.length)fail(400,'INVALID_FIELDS',{field:'checklist'});
 const due=body.dueAt?text(body.dueAt,{max:40},'dueAt'):null;
 if(due&&Number.isNaN(Date.parse(due)))fail(400,'INVALID_FIELDS',{field:'dueAt'});
 return {
  type,scope,xp:int(body.xp??0,{min:0,max:1000},'xp'),
  counter_target:['counter','attendance'].includes(type)?int(body.counterTarget??1,{min:1,max:100},'counterTarget'):0,
  requires_review:body.requiresReview?1:0,self_report:body.selfReport===false?0:1,
  repeat_rule:oneOf(body.repeatRule||'once',['once','weekly_reward','per_week'],'repeatRule'),
  checklist:JSON.stringify(checklist),translations:JSON.stringify(cleanTranslations(body.translations)),
  audience:oneOf(body.audience||'all_participants',['all_participants','selected'],'audience'),
  due_at:due?new Date(due).toISOString():null,timezone:'Europe/Zagreb',
  reviewer_user_id:body.reviewerUserId?text(body.reviewerUserId,{max:80},'reviewerUserId'):null,
  visibility:oneOf(body.visibility||'participants',['participants','team'],'visibility'),
  week_id:body.weekId?text(body.weekId,{max:80},'weekId'):null,
 };
}
export function taskView(t){return {id:t.id,key:t.key,type:t.type,scope:t.scope,xp:t.xp,counterTarget:t.counter_target,requiresReview:!!t.requires_review,selfReport:!!t.self_report,repeatRule:t.repeat_rule,checklist:JSON.parse(t.checklist),translations:JSON.parse(t.translations),status:t.status,audience:t.audience,dueAt:t.due_at,timezone:t.timezone,reviewerUserId:t.reviewer_user_id,visibility:t.visibility,official:!!t.official,weekId:t.week_id,version:t.version,updated:t.updated};}

// Admin: templates -----------------------------------------------------------
export async function createTask(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const t=cleanTask(body),id=newId('task'),now=nowIso();
 const key=body.key?text(body.key,{max:60},'key'):null;
 if(key&&!/^[a-z0-9-]+$/.test(key))fail(400,'INVALID_FIELDS',{field:'key'});
 try{ctx.db.query(`INSERT INTO task_templates(id,key,week_id,type,scope,xp,counter_target,requires_review,self_report,repeat_rule,checklist,translations,status,audience,due_at,timezone,reviewer_user_id,visibility,created_by,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?,?,?,?,?,?)`).run(id,key,t.week_id,t.type,t.scope,t.xp,t.counter_target,t.requires_review,t.self_report,t.repeat_rule,t.checklist,t.translations,t.audience,t.due_at,t.timezone,t.reviewer_user_id,t.visibility,admin.id,now,now);}
 catch(e){if(String(e.message).includes('UNIQUE'))fail(409,'CONFLICT');throw e;}
 audit(ctx.db,admin.id,'task.create','task',id,{});
 return json({task:taskView(ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(id))},201);
}
export async function updateTask(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const current=ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(id);if(!current)fail(404,'NOT_FOUND');
 if(Number(body.version)!==current.version)fail(409,'CONFLICT',{currentVersion:current.version});
 if(current.status!=='draft'&&(body.type!==current.type||body.scope!==current.scope))fail(409,'INVALID_STATE');
 const t=cleanTask(body);
 ctx.db.query('UPDATE task_templates SET week_id=?,type=?,scope=?,xp=?,counter_target=?,requires_review=?,self_report=?,repeat_rule=?,checklist=?,translations=?,audience=?,due_at=?,reviewer_user_id=?,visibility=?,version=version+1,updated=? WHERE id=? AND version=?').run(t.week_id,t.type,t.scope,t.xp,t.counter_target,t.requires_review,t.self_report,t.repeat_rule,t.checklist,t.translations,t.audience,t.due_at,t.reviewer_user_id,t.visibility,nowIso(),id,current.version);
 audit(ctx.db,admin.id,'task.update','task',id,{});
 return json({task:taskView(ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(id))});
}
export async function setTaskStatus(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const status=oneOf(body.status,['draft','published','closed','archived'],'status');
 const current=ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(id);if(!current)fail(404,'NOT_FOUND');
 const allowed={draft:['published','archived'],published:['closed'],closed:['published','archived'],archived:['draft']};
 if(current.status!==status&&!allowed[current.status].includes(status))fail(409,'INVALID_STATE');
 ctx.db.query('UPDATE task_templates SET status=?,updated=? WHERE id=?').run(status,nowIso(),id);
 audit(ctx.db,admin.id,'task.status','task',id,{status});
 return json({task:taskView(ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(id))});
}
export function adminTasks(ctx){
 requireAdmin(ctx);const {limit,offset}=page(ctx.url,100);
 const status=ctx.url.searchParams.get('status');
 const rows=ctx.db.query(`SELECT t.*,(SELECT count(*) FROM assignments a WHERE a.task_id=t.id) assigned,(SELECT count(*) FROM assignments a JOIN submissions s ON s.assignment_id=a.id WHERE a.task_id=t.id AND s.status='submitted') waiting FROM task_templates t WHERE (?1 IS NULL OR t.status=?1) ORDER BY t.created LIMIT ?2 OFFSET ?3`).all(status,limit+1,offset);
 return json({items:rows.slice(0,limit).map(t=>({...taskView(t),assigned:t.assigned,waiting:t.waiting})),hasMore:rows.length>limit});
}

// Assignment -------------------------------------------------------------------
function targets(db,task,{userIds,projectIds}={}){
 if(task.scope==='personal'){
  if(task.audience==='selected'){const ids=(userIds||[]).slice(0,500);return ids.length?db.query(`SELECT id,display_name name FROM users WHERE status='active' AND id IN (${ids.map(()=>'?').join(',')})`).all(...ids):[];}
  return db.query("SELECT id,display_name name FROM users WHERE status='active' ORDER BY created").all();
 }
 const base="SELECT p.id,json_extract(p.draft,'$.name') name FROM projects p WHERE p.status<>'archived' AND EXISTS(SELECT 1 FROM memberships m WHERE m.project_id=p.id AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member'))";
 if(task.audience==='selected'){const ids=(projectIds||[]).slice(0,500);return ids.length?db.query(base+` AND p.id IN (${ids.map(()=>'?').join(',')})`).all(...ids):[];}
 return db.query(base+' ORDER BY p.created').all();
}
const periodFor=(task,requested)=>task.repeat_rule==='per_week'?(/^\d{4}-W\d{2}$/.test(requested||'')?requested:isoWeek()):'';
function assignAll(db,task,list,period){
 const now=nowIso();let created=0;
 db.transaction(()=>{for(const t of list){const r=db.query('INSERT OR IGNORE INTO assignments(id,task_id,user_id,project_id,period,created) VALUES(?,?,?,?,?,?)').run(newId('asg'),task.id,task.scope==='personal'?t.id:'',task.scope==='team'?t.id:'',period,now);created+=r.changes;}})();
 return created;
}
export async function previewAssign(ctx,id){
 requireAdmin(ctx);const task=ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(id);if(!task)fail(404,'NOT_FOUND');
 const period=periodFor(task,ctx.url.searchParams.get('period'));
 const list=targets(ctx.db,task,{userIds:ctx.url.searchParams.getAll('userId'),projectIds:ctx.url.searchParams.getAll('projectId')});
 const existing=new Set(ctx.db.query('SELECT user_id,project_id FROM assignments WHERE task_id=? AND period=?').all(id,period).map(a=>a.user_id||a.project_id));
 return json({period,total:list.length,new:list.filter(t=>!existing.has(t.id)).length,items:list.slice(0,200).map(t=>({id:t.id,name:t.name,alreadyAssigned:existing.has(t.id)}))});
}
export async function assignTask(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const task=ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(id);if(!task)fail(404,'NOT_FOUND');
 if(task.status!=='published')fail(409,'INVALID_STATE');
 const period=periodFor(task,body.period);
 const created=assignAll(ctx.db,task,targets(ctx.db,task,{userIds:body.userIds,projectIds:body.projectIds}),period);
 audit(ctx.db,admin.id,'task.assign','task',id,{period,created});
 return json({created,period});
}

/** Gives a new or newly linked participant the active tasks of their set. */
export function assignForUser(db,user){
 const tasks=db.query("SELECT * FROM task_templates WHERE status='published' AND audience='all_participants' AND (due_at IS NULL OR due_at>?)").all(nowIso());
 const projects=db.query("SELECT p.id FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member') AND p.status<>'archived'").all(user.id);
 for(const task of tasks){
  const period=periodFor(task);
  if(task.scope==='personal')assignAll(db,task,[{id:user.id}],period);
  else assignAll(db,task,projects,period);
 }
}

// Participant side ------------------------------------------------------------------
function myProjectIds(db,userId){return db.query("SELECT project_id FROM memberships WHERE user_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')").all(userId).map(r=>r.project_id);}
function loadAssignment(ctx,assignmentId,{forWrite=false}={}){
 const user=requireUser(ctx);
 const a=ctx.db.query('SELECT a.*,t.id tid FROM assignments a JOIN task_templates t ON t.id=a.task_id WHERE a.id=?').get(assignmentId);
 if(!a)fail(404,'NOT_FOUND');
 const task=ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(a.task_id);
 const mine=a.user_id===user.id||(a.project_id&&['owner','editor','member'].includes(membership(ctx.db,a.project_id,user.id)));
 const reviewer=canReview(ctx.db,user,task,a);
 if(!mine&&!reviewer)fail(404,'NOT_FOUND');
 if(forWrite&&!mine)fail(403,'FORBIDDEN');
 if(forWrite&&task.status!=='published')fail(409,'INVALID_STATE');
 return {user,assignment:a,task};
}
function canReview(db,user,task,a){
 if(!user)return false;if(isAdmin(user))return true;
 if(task.reviewer_user_id===user.id)return true;
 return !!(a.project_id&&membership(db,a.project_id,user.id)==='reviewer');
}

function assignmentView(db,a,task,{full=false,lang}={}){
 const s=db.query('SELECT * FROM submissions WHERE assignment_id=?').get(a.id);
 const out={id:a.id,period:a.period,projectId:a.project_id||null,projectName:a.project_id?JSON.parse(db.query('SELECT draft FROM projects WHERE id=?').get(a.project_id)?.draft||'{}').name:null,task:taskView(task),status:s?.status||'not_started',revision:s?.revision||0,updated:s?.updated||a.created};
 if(full&&s){
  out.draft=JSON.parse(s.draft);
  out.revisions=db.query('SELECT r.revision,r.content,r.created,u.display_name author FROM submission_revisions r JOIN users u ON u.id=r.submitted_by WHERE r.submission_id=? ORDER BY r.revision DESC LIMIT 20').all(s.id).map(r=>({revision:r.revision,content:JSON.parse(r.content),created:r.created,author:r.author}));
  out.reviews=db.query('SELECT r.revision,r.decision,r.comment,r.created,u.display_name reviewer FROM reviews r JOIN users u ON u.id=r.reviewer WHERE r.submission_id=? ORDER BY r.created DESC').all(s.id);
  out.submissionId=s.id;
  const help=db.query("SELECT status,recipient_project_id FROM help_confirmations WHERE id=?").get('help-'+s.id);
  if(help)out.helpConfirmation={status:help.status,recipientProjectId:help.recipient_project_id};
 }
 return out;
}
export function myTasks(ctx){
 const user=requireUser(ctx);const projects=myProjectIds(ctx.db,user.id);
 const rows=ctx.db.query(`SELECT a.* FROM assignments a JOIN task_templates t ON t.id=a.task_id WHERE t.status IN ('published','closed') AND (a.user_id=? ${projects.length?`OR a.project_id IN (${projects.map(()=>'?').join(',')})`:''}) ORDER BY t.due_at IS NULL,t.due_at,a.created LIMIT 200`).all(user.id,...projects);
 const tasks=new Map();
 return json({items:rows.map(a=>{if(!tasks.has(a.task_id))tasks.set(a.task_id,ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(a.task_id));return assignmentView(ctx.db,a,tasks.get(a.task_id));})});
}
export function getAssignment(ctx,id){
 const {assignment,task}=loadAssignment(ctx,id);
 return json({assignment:assignmentView(ctx.db,assignment,task,{full:true})});
}

/** Checks the content of one answer against the task type. `final` means submit. */
function cleanAnswer(ctx,task,a,input,final){
 const c=input&&typeof input==='object'?input:{};
 const note=text(c.note??'',{max:2000,multiline:true},'note');
 switch(task.type){
  case 'checklist':{const items=JSON.parse(task.checklist);const checked=items.map((_,i)=>!!c.checked?.[i]);if(final&&!checked.every(Boolean))fail(400,'INVALID_FIELDS',{field:'checked'});return {checked,note};}
  case 'counter':{const count=int(c.count??0,{min:0,max:task.counter_target},'count');if(final&&count<task.counter_target)fail(400,'INVALID_FIELDS',{field:'count'});if(final&&!note)fail(400,'INVALID_FIELDS',{field:'note'});return {count,note};}
  case 'text':{const body=text(c.text??'',{min:final?1:0,max:5000,multiline:true},'text');return {text:body};}
  case 'link':{const url=httpUrl(c.url,'url');if(final&&!url)fail(400,'INVALID_FIELDS',{field:'url'});return {url,note};}
  case 'attachment':{
   const fileId=c.fileId?text(c.fileId,{max:80},'fileId'):'';
   if(final&&!fileId)fail(400,'INVALID_FIELDS',{field:'fileId'});
   if(fileId){const f=ctx.db.query("SELECT * FROM files WHERE id=? AND status='active'").get(fileId);
    const owned=f&&(a.project_id?f.project_id===a.project_id:f.owner_user_id===ctx.user.id);
    if(!owned||!canReadFile(ctx.db,ctx.user,f)||f.purpose==='reference')fail(400,'INVALID_FIELDS',{field:'fileId'});}
   return {fileId,note};}
  case 'attendance':{
   const lectureIds=[...new Set((Array.isArray(c.lectureIds)?c.lectureIds:[]).slice(0,50).map(x=>String(x).slice(0,80)))];
   return {lectureIds,note};}
  case 'team_result':{const body=text(c.text??'',{min:final?1:0,max:5000,multiline:true},'text');const recipient=c.recipientProjectId?text(c.recipientProjectId,{max:80},'recipientProjectId'):'';return {text:body,recipientProjectId:recipient};}
 }
 fail(400,'INVALID_FIELDS');
}

function ensureSubmission(db,a,userId){
 let s=db.query('SELECT * FROM submissions WHERE assignment_id=?').get(a.id);
 if(!s){const now=nowIso();db.query("INSERT OR IGNORE INTO submissions(id,assignment_id,submitted_by,status,created,updated) VALUES(?,?,?,'draft',?,?)").run(newId('sub'),a.id,userId,now,now);s=db.query('SELECT * FROM submissions WHERE assignment_id=?').get(a.id);}
 return s;
}
const editable=(task,s)=>['draft','changes_requested'].includes(s.status)||(task.repeat_rule==='weekly_reward'&&s.status==='accepted');

export async function saveAnswerDraft(ctx,id){
 const {user,assignment,task}=loadAssignment(ctx,id,{forWrite:true});
 const body=await readJson(ctx.request);
 const content=cleanAnswer(ctx,task,assignment,body.content,false);
 const s=ensureSubmission(ctx.db,assignment,user.id);
 if(!editable(task,s))fail(409,'INVALID_STATE');
 ctx.db.query('UPDATE submissions SET draft=?,updated=? WHERE id=?').run(JSON.stringify(content),nowIso(),s.id);
 return json({ok:true,status:s.status});
}

/** Submit: a new immutable revision. Repeats with the same Idempotency-Key replay the result. */
export async function submitAnswer(ctx,id){
 const {user,assignment,task}=loadAssignment(ctx,id,{forWrite:true});
 rateLimit(ctx.db,'submit:'+user.id,120,3600);
 const body=await readJson(ctx.request);
 const idem=ctx.request.headers.get('idempotency-key');
 if(idem&&!/^[A-Za-z0-9_-]{8,80}$/.test(idem))fail(400,'BAD_REQUEST');
 const s0=ensureSubmission(ctx.db,assignment,user.id);
 if(idem){const prior=ctx.db.query('SELECT revision FROM submission_revisions WHERE submission_id=? AND idem_key=?').get(s0.id,idem);if(prior)return json({assignment:assignmentView(ctx.db,assignment,task,{full:true}),replayed:true});}
 const content=cleanAnswer(ctx,task,assignment,body.content,true);
 if(task.type==='attendance'){
  // Self-reports only for real lectures that already took place; the count uses stored attendance.
  if(task.self_report)for(const lectureId of content.lectureIds)reportAttendance(ctx,lectureId,content.note);
  const n=ctx.db.query('SELECT count(DISTINCT lecture_id) n FROM attendance WHERE user_id=?').get(user.id).n;
  if(n<task.counter_target)fail(400,'INVALID_FIELDS',{field:'lectureIds',have:n,need:task.counter_target});
 }
 if(task.key==='help-team'){
  const recipient=ctx.db.query("SELECT id FROM projects WHERE id=? AND status<>'archived'").get(content.recipientProjectId);
  if(!recipient||content.recipientProjectId===assignment.project_id)fail(400,'INVALID_FIELDS',{field:'recipientProjectId'});
 }
 let result;
 ctx.db.transaction(()=>{
  const s=ctx.db.query('SELECT * FROM submissions WHERE id=?').get(s0.id);
  if(!editable(task,s))fail(409,'INVALID_STATE');
  if(task.repeat_rule==='weekly_reward'&&s.status==='accepted'&&ctx.db.query('SELECT 1 FROM xp_ledger WHERE source_key=?').get(rewardKey(task,assignment)))fail(409,'ALREADY_DONE');
  const revision=s.revision+1,now=nowIso();
  ctx.db.query('INSERT INTO submission_revisions(submission_id,revision,content,submitted_by,idem_key,created) VALUES(?,?,?,?,?,?)').run(s.id,revision,JSON.stringify(content),user.id,idem||null,now);
  if(content.fileId)ctx.db.query('INSERT OR IGNORE INTO file_links(file_id,target_type,target_id,created) VALUES(?,?,?,?)').run(content.fileId,'submission',s.id+':'+revision,now);
  ctx.db.query("UPDATE submissions SET status='submitted',revision=?,submitted_by=?,draft=?,updated=? WHERE id=?").run(revision,user.id,JSON.stringify(content),now,s.id);
  if(task.key==='help-team'){
   ctx.db.query("INSERT INTO help_confirmations(id,helper_project_id,recipient_project_id,requested_by,note,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET recipient_project_id=excluded.recipient_project_id,status='pending',note=excluded.note,decided_at=NULL,confirmed_by=NULL").run('help-'+s.id,assignment.project_id,content.recipientProjectId,user.id,content.text.slice(0,500),now);
   for(const r of ctx.db.query("SELECT user_id FROM memberships WHERE project_id=? AND role IN ('owner','editor') AND revoked_at IS NULL").all(content.recipientProjectId))notify(ctx.db,r.user_id,'help.confirm',{projectId:assignment.project_id});
  }else if(!task.requires_review){accept(ctx.db,{submissionId:s.id,revision,task,assignment,reviewer:null,comment:'',submitter:user.id});}
  audit(ctx.db,user.id,'submission.submit','assignment',assignment.id,{revision});
  result=revision;
 })();
 return json({assignment:assignmentView(ctx.db,assignment,task,{full:true}),revision:result},201);
}

function rewardKey(task,a){return `task:${task.id}:${a.user_id||a.project_id}:${a.period||''}${task.repeat_rule==='weekly_reward'?':'+isoWeek():''}`;}
function accept(db,{submissionId,revision,task,assignment,reviewer,comment,submitter}){
 const now=nowIso();
 if(reviewer||task.requires_review)db.query("INSERT INTO reviews(id,submission_id,revision,reviewer,decision,comment,created) VALUES(?,?,?,?,'accepted',?,?)").run(newId('rev'),submissionId,revision,reviewer||'system',comment,now);
 db.query("UPDATE submissions SET status='accepted',updated=? WHERE id=?").run(now,submissionId);
 db.query("UPDATE assignments SET status='done' WHERE id=?").run(assignment.id);
 const beneficiary=task.scope==='personal'?{type:'user',id:assignment.user_id}:{type:'project',id:assignment.project_id};
 award(db,{...beneficiary,amount:task.xp,sourceKey:rewardKey(task,assignment),reason:'task:'+(task.key||task.id),actor:reviewer});
 badgeForRule(db,submitter,'submission.accepted');
 if(task.key==='presentation'||task.type==='attachment')badgeForRule(db,submitter,'presentation.accepted');
 if(task.key==='help-team')badgeForRule(db,submitter,'help.confirmed');
 notify(db,submitter,'submission.accepted',{assignmentId:assignment.id});
}

// Review ------------------------------------------------------------------------------
export function reviewQueue(ctx){
 const user=requireUser(ctx);const {limit,offset}=page(ctx.url);
 const status=['submitted','accepted','changes_requested','rejected'].includes(ctx.url.searchParams.get('status'))?ctx.url.searchParams.get('status'):'submitted';
 const project=ctx.url.searchParams.get('projectId')||null,period=ctx.url.searchParams.get('period')||null;
 const admin=isAdmin(user);
 const rows=ctx.db.query(`SELECT s.*,a.project_id,a.user_id,a.period,a.task_id FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN task_templates t ON t.id=a.task_id
  WHERE s.status=?1 AND (?2 IS NULL OR a.project_id=?2) AND (?3 IS NULL OR a.period=?3)
  AND (?4=1 OR t.reviewer_user_id=?5 OR EXISTS(SELECT 1 FROM memberships m WHERE m.project_id=a.project_id AND m.user_id=?5 AND m.role='reviewer' AND m.revoked_at IS NULL))
  ORDER BY s.updated LIMIT ?6 OFFSET ?7`).all(status,project,period,admin?1:0,user.id,limit+1,offset);
 if(!admin&&!rows.length&&!ctx.db.query("SELECT 1 FROM memberships WHERE user_id=? AND role='reviewer' AND revoked_at IS NULL").get(user.id)&&!ctx.db.query('SELECT 1 FROM task_templates WHERE reviewer_user_id=?').get(user.id))fail(403,'FORBIDDEN');
 return json({items:rows.slice(0,limit).map(r=>{const task=ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(r.task_id);const who=r.user_id?ctx.db.query('SELECT display_name FROM users WHERE id=?').get(r.user_id)?.display_name:null;return {...assignmentView(ctx.db,{id:r.assignment_id,period:r.period,project_id:r.project_id,user_id:r.user_id,task_id:r.task_id,created:r.created},task),submissionId:r.id,userName:who};}),hasMore:rows.length>limit});
}
export async function review(ctx,submissionId){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const decision=oneOf(body.decision,['accepted','changes_requested','rejected'],'decision');
 const comment=text(body.comment??'',{max:3000,multiline:true},'comment');
 const s=ctx.db.query('SELECT * FROM submissions WHERE id=?').get(submissionId);if(!s)fail(404,'NOT_FOUND');
 const assignment=ctx.db.query('SELECT * FROM assignments WHERE id=?').get(s.assignment_id),task=ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(assignment.task_id);
 if(!canReview(ctx.db,user,task,assignment))fail(404,'NOT_FOUND');
 if(Number(body.revision)!==s.revision)fail(409,'CONFLICT',{currentRevision:s.revision});
 if(s.status!=='submitted')fail(409,'ALREADY_DONE');
 if(task.key==='help-team')fail(409,'INVALID_STATE');
 ctx.db.transaction(()=>{
  const fresh=ctx.db.query('SELECT status FROM submissions WHERE id=?').get(s.id);if(fresh.status!=='submitted')fail(409,'ALREADY_DONE');
  if(decision==='accepted')accept(ctx.db,{submissionId:s.id,revision:s.revision,task,assignment,reviewer:user.id,comment,submitter:s.submitted_by});
  else{
   ctx.db.query('INSERT INTO reviews(id,submission_id,revision,reviewer,decision,comment,created) VALUES(?,?,?,?,?,?,?)').run(newId('rev'),s.id,s.revision,user.id,decision,comment,nowIso());
   ctx.db.query('UPDATE submissions SET status=?,updated=? WHERE id=?').run(decision,nowIso(),s.id);
   notify(ctx.db,s.submitted_by,'submission.'+decision,{assignmentId:assignment.id});
  }
  audit(ctx.db,user.id,'submission.review','submission',s.id,{decision,revision:s.revision});
 })();
 return json({ok:true,status:decision});
}
/** Cancels an accepted result with a correcting ledger entry. */
export async function revokeAcceptance(ctx,submissionId){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const comment=text(body.comment,{min:1,max:1000,multiline:true},'comment');
 const s=ctx.db.query('SELECT * FROM submissions WHERE id=?').get(submissionId);if(!s)fail(404,'NOT_FOUND');
 if(s.status!=='accepted')fail(409,'INVALID_STATE');
 const assignment=ctx.db.query('SELECT * FROM assignments WHERE id=?').get(s.assignment_id),task=ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(assignment.task_id);
 ctx.db.transaction(()=>{
  const beneficiary=task.scope==='personal'?{type:'user',id:assignment.user_id}:{type:'project',id:assignment.project_id};
  const keys=ctx.db.query("SELECT source_key FROM xp_ledger WHERE beneficiary_type=? AND beneficiary_id=? AND source_key LIKE ? AND amount>0").all(beneficiary.type,beneficiary.id,`task:${task.id}:${assignment.user_id||assignment.project_id}:${assignment.period||''}%`);
  for(const {source_key} of keys)reverse(ctx.db,{...beneficiary,sourceKey:source_key,actor:admin.id,reason:'correction:'+comment.slice(0,100)});
  ctx.db.query("UPDATE submissions SET status='rejected',updated=? WHERE id=?").run(nowIso(),s.id);
  ctx.db.query("UPDATE assignments SET status='open' WHERE id=?").run(assignment.id);
  audit(ctx.db,admin.id,'submission.revoke','submission',s.id,{comment});
  notify(ctx.db,s.submitted_by,'submission.revoked',{assignmentId:assignment.id});
 })();
 return json({ok:true});
}

// Help confirmation by the recipient team ---------------------------------------------
export function helpRequests(ctx){
 const user=requireUser(ctx);
 const rows=ctx.db.query("SELECT h.*,json_extract(p.draft,'$.name') helper_name FROM help_confirmations h JOIN projects p ON p.id=h.helper_project_id WHERE h.status='pending' AND EXISTS(SELECT 1 FROM memberships m WHERE m.project_id=h.recipient_project_id AND m.user_id=? AND m.role IN ('owner','editor') AND m.revoked_at IS NULL)").all(user.id);
 return json({items:rows.map(r=>({id:r.id,helperProjectId:r.helper_project_id,helperName:r.helper_name,recipientProjectId:r.recipient_project_id,note:r.note,created:r.created}))});
}
export async function decideHelp(ctx,id){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const decision=oneOf(body.decision,['confirmed','declined'],'decision');
 const h=ctx.db.query('SELECT * FROM help_confirmations WHERE id=?').get(id);if(!h)fail(404,'NOT_FOUND');
 if(!['owner','editor'].includes(membership(ctx.db,h.recipient_project_id,user.id)))fail(404,'NOT_FOUND');
 if(h.status!=='pending')fail(409,'ALREADY_DONE');
 const s=ctx.db.query('SELECT * FROM submissions WHERE id=?').get(id.replace(/^help-/,''));
 const assignment=ctx.db.query('SELECT * FROM assignments WHERE id=?').get(s.assignment_id),task=ctx.db.query('SELECT * FROM task_templates WHERE id=?').get(assignment.task_id);
 ctx.db.transaction(()=>{
  const r=ctx.db.query("UPDATE help_confirmations SET status=?,confirmed_by=?,decided_at=? WHERE id=? AND status='pending'").run(decision,user.id,nowIso(),id);if(!r.changes)fail(409,'ALREADY_DONE');
  if(decision==='confirmed')accept(ctx.db,{submissionId:s.id,revision:s.revision,task,assignment,reviewer:user.id,comment:'',submitter:s.submitted_by});
  else{ctx.db.query("UPDATE submissions SET status='changes_requested',updated=? WHERE id=?").run(nowIso(),s.id);notify(ctx.db,s.submitted_by,'help.declined',{assignmentId:assignment.id});}
  audit(ctx.db,user.id,'help.'+decision,'project',h.recipient_project_id,{helper:h.helper_project_id});
 })();
 return json({ok:true,status:decision});
}

/** Weekly project update reward: posting a public update completes the task once per week. */
export function onProjectUpdate(db,{userId,projectId,visibility}){
 if(visibility!=='public')return;
 const task=db.query("SELECT * FROM task_templates WHERE key='project-update' AND status='published'").get();if(!task)return;
 const a=db.query("SELECT * FROM assignments WHERE task_id=? AND project_id=? AND period=''").get(task.id,projectId);if(!a)return;
 const s=ensureSubmission(db,a,userId);
 const week=isoWeek(),key=rewardKey(task,a);
 if(db.query("SELECT 1 FROM xp_ledger WHERE beneficiary_type='project' AND beneficiary_id=? AND source_key=?").get(projectId,key))return;
 db.transaction(()=>{
  const revision=s.revision+1,now=nowIso();
  db.query('INSERT INTO submission_revisions(submission_id,revision,content,submitted_by,created) VALUES(?,?,?,?,?)').run(s.id,revision,JSON.stringify({text:'Project update '+week}),userId,now);
  db.query("UPDATE submissions SET revision=?,status='submitted',updated=? WHERE id=?").run(revision,now,s.id);
  accept(db,{submissionId:s.id,revision,task,assignment:a,reviewer:null,comment:'',submitter:userId});
 })();
}
