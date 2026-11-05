/**
 * Google Forms / Sheets results: CSV import with preview, and an optional
 * Apps Script webhook with a per-form secret. Rows are matched to accounts by
 * login or email (emails are not verified, so the organiser checks the preview).
 */
import {fail,json,readJson,text,oneOf,newId,sha256,token,rateLimit} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,requireAdmin} from './permissions.mjs';
import {markDone} from './tasks.mjs';

export function parseCsv(input){
 const rows=[];let row=[],cell='',quoted=false;
 const src=input.replace(/^﻿/,'');
 for(let i=0;i<src.length;i++){
  const c=src[i];
  if(quoted){if(c==='"'){if(src[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=c;continue;}
  if(c==='"')quoted=true;
  else if(c===','||c===';'||c==='\t'){row.push(cell);cell='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&src[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
const norm=h=>h.trim().toLowerCase().replace(/[^a-z0-9а-яčćžšđ]+/g,' ').trim();
const EMAIL=['email','email address','e mail','adresa e pošte','e pošta','почта','электронная почта'];
const LOGIN=['login','username','user','korisničko ime','логин'];
const LECTURE=['lecture','predavanje','лекция','date','datum','дата'];
const NOTE=['note','comment','bilješka','komentar','комментарий','заметка'];
const PROJECT=['project','team','projekt','tim','проект','команда'];

function findUser(db,row){
 if(row.login){const u=db.query("SELECT id,display_name,login FROM users WHERE login=? AND status='active'").get(row.login.toLowerCase());if(u)return {...u,by:'login'};}
 if(row.email){const list=db.query("SELECT id,display_name,login FROM users WHERE lower(email)=? AND status='active'").all(row.email.toLowerCase());if(list.length===1)return {...list[0],by:'email'};if(list.length>1)return {ambiguous:true};}
 return null;
}
function findLecture(db,value,fixed){
 if(fixed)return db.query('SELECT id,date,title FROM lectures WHERE id=?').get(fixed);
 const v=(value||'').trim();if(!v)return null;
 const iso=/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):(()=>{const m=v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;})();
 return db.query('SELECT id,date,title FROM lectures WHERE id=? OR date=?').get(v,iso||'');
}

/** Builds preview rows. Nothing is written. */
function plan(db,{kind,csv,taskId,lectureId}){
 if(typeof csv!=='string'||csv.length>1024*1024)fail(413,'TOO_LARGE');
 const rows=parseCsv(csv);if(rows.length<2)fail(400,'INVALID_FIELDS',{field:'csv'});
 if(rows.length>2001)fail(413,'TOO_LARGE');
 const head=rows[0].map(norm),col=names=>head.findIndex(h=>names.some(n=>h===n||h.includes(n)));
 const ci={email:col(EMAIL),login:col(LOGIN),lecture:col(LECTURE),note:col(NOTE),project:col(PROJECT)};
 if(ci.email<0&&ci.login<0)fail(400,'INVALID_FIELDS',{field:'email/login column'});
 const task=kind==='task'?db.query("SELECT * FROM task_templates WHERE id=? AND status='published'").get(taskId):null;
 if(kind==='task'&&!task)fail(400,'INVALID_FIELDS',{field:'taskId'});
 const out=rows.slice(1).map((r,i)=>{
  const row={line:i+2,email:ci.email>=0?r[ci.email]?.trim():'',login:ci.login>=0?r[ci.login]?.trim():'',note:ci.note>=0?(r[ci.note]||'').trim().slice(0,500):'',lecture:ci.lecture>=0?r[ci.lecture]:''};
  const user=findUser(db,row);
  const result={line:row.line,who:row.login||row.email,user:user&&!user.ambiguous?{id:user.id,name:user.display_name,by:user.by}:null,status:user?.ambiguous?'ambiguous':user?'ok':'no_account'};
  if(kind==='attendance'){const l=findLecture(db,row.lecture,lectureId);if(!l){result.status=result.status==='ok'?'no_lecture':result.status;}else result.lecture={id:l.id,date:l.date};}
  if(kind==='task'&&task.scope==='team'&&result.user){
   const projects=db.query("SELECT project_id FROM memberships WHERE user_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')").all(result.user.id);
   if(projects.length!==1)result.status=projects.length?'several_projects':'no_project';else result.projectId=projects[0].project_id;
  }
  result.note=row.note;return result;
 });
 return {task,rows:out};
}

export async function importPreview(ctx){
 requireAdmin(ctx);const body=await readJson(ctx.request,1100*1024);
 const kind=oneOf(body.kind,['attendance','task'],'kind');
 const {rows}=plan(ctx.db,{kind,csv:body.csv,taskId:body.taskId,lectureId:body.lectureId||null});
 return json({rows:rows.slice(0,500),total:rows.length,ready:rows.filter(r=>r.status==='ok').length});
}
export async function importApply(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request,1100*1024);
 const kind=oneOf(body.kind,['attendance','task'],'kind');
 const {task,rows}=plan(ctx.db,{kind,csv:body.csv,taskId:body.taskId,lectureId:body.lectureId||null});
 let applied=0;const now=nowIso();
 ctx.db.transaction(()=>{
  for(const r of rows.filter(r=>r.status==='ok')){
   if(kind==='attendance'){
    const x=ctx.db.query("INSERT INTO attendance(user_id,lecture_id,kind,note,verified_by,created,updated) VALUES(?,?,'verified_by_admin',?,?,?,?) ON CONFLICT(user_id,lecture_id) DO UPDATE SET kind='verified_by_admin',verified_by=excluded.verified_by,updated=excluded.updated WHERE attendance.kind<>'verified_by_admin'").run(r.user.id,r.lecture.id,r.note,admin.id,now,now);
    if(x.changes){applied++;ctx.hooks?.onEvent?.(ctx,{type:'attendance',userId:r.user.id,lectureId:r.lecture.id});}
   }else if(markDone(ctx.db,{task,userId:r.user.id,projectId:r.projectId,note:r.note,actor:admin.id,source:'import'}))applied++;
  }
  ctx.db.query('INSERT INTO import_runs(id,kind,source,target,rows,applied,created_by,created) VALUES(?,?,?,?,?,?,?,?)').run(newId('imp'),kind,'csv',task?.id||body.lectureId||'',rows.length,applied,admin.id,now);
  audit(ctx.db,admin.id,'import.apply','import',kind,{rows:rows.length,applied});
 })();
 return json({applied,total:rows.length});
}

// Apps Script webhook -------------------------------------------------------------------
export async function createHook(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const kind=oneOf(body.kind,['attendance','task'],'kind');
 const label=text(body.label??'',{max:80},'label');
 let taskId=null,lectureId=null;
 if(kind==='task'){taskId=text(body.taskId,{max:80},'taskId');if(!ctx.db.query("SELECT 1 FROM task_templates WHERE id=? AND status='published'").get(taskId))fail(400,'INVALID_FIELDS',{field:'taskId'});}
 else{lectureId=body.lectureId?text(body.lectureId,{max:80},'lectureId'):null;}
 const secret='form_'+token(24),id=newId('hook');
 ctx.db.query('INSERT INTO form_hooks(id,secret_hash,kind,task_id,lecture_id,label,created_by,created) VALUES(?,?,?,?,?,?,?,?)').run(id,sha256(secret),kind,taskId,lectureId,label,admin.id,nowIso());
 audit(ctx.db,admin.id,'hook.create','form_hook',id,{kind});
 return json({id,secret,url:'/api/forms/hook'},201);
}
export function listHooks(ctx){requireAdmin(ctx);return json({items:ctx.db.query('SELECT id,kind,task_id,lecture_id,label,created,revoked_at,last_used FROM form_hooks ORDER BY created DESC').all()});}
export function revokeHook(ctx,id){const admin=requireAdmin(ctx);ctx.db.query('UPDATE form_hooks SET revoked_at=? WHERE id=?').run(nowIso(),id);audit(ctx.db,admin.id,'hook.revoke','form_hook',id,{});return json({ok:true});}

/**
 * Server-to-server call from a Google Apps Script on form submit.
 * Header X-Form-Secret identifies the hook; body: {email|login, lecture?, note?}.
 * Results land only for existing accounts, never create accounts.
 */
export async function hook(ctx){
 rateLimit(ctx.db,'form-hook:'+ctx.ip,600,3600);
 const secret=ctx.request.headers.get('x-form-secret')||'';
 const h=secret.length<100&&ctx.db.query('SELECT * FROM form_hooks WHERE secret_hash=? AND revoked_at IS NULL').get(sha256(secret));
 if(!h)fail(403,'FORBIDDEN');
 const body=await readJson(ctx.request,16*1024);
 const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
 const csv=`email,login,lecture,note\n${esc(body.email)},${esc(body.login)},${esc(body.lecture)},${esc(body.note)}`;
 const {task,rows}=plan(ctx.db,{kind:h.kind,csv,taskId:h.task_id,lectureId:h.lecture_id});
 const r=rows[0];let applied=false;
 if(r.status==='ok'){
  const now=nowIso();
  if(h.kind==='attendance'){
   // A form answer is the participant's own report, not organiser verification.
   applied=ctx.db.query("INSERT INTO attendance(user_id,lecture_id,kind,note,created,updated) VALUES(?,?,'self_reported',?,?,?) ON CONFLICT(user_id,lecture_id) DO NOTHING").run(r.user.id,r.lecture.id,r.note,now,now).changes>0;
   if(applied)ctx.hooks?.onEvent?.(ctx,{type:'attendance',userId:r.user.id,lectureId:r.lecture.id});
  }else applied=markDone(ctx.db,{task,userId:r.user.id,projectId:r.projectId,note:r.note,actor:h.created_by,source:'form'});
 }
 ctx.db.query('UPDATE form_hooks SET last_used=? WHERE id=?').run(nowIso(),h.id);
 return json({status:r.status,applied});
}
