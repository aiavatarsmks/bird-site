/** Lectures and attendance. Self-reports and admin verification are kept apart. */
import {fail,json,readJson,text,newId,page,httpUrl} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,requireAdmin} from './permissions.mjs';
import {requireUser} from './auth.mjs';

const zagrebToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

const lectureView=(l,mine)=>({id:l.id,date:l.date,speaker:l.speaker,title:JSON.parse(l.title),status:l.status,...(mine!==undefined?{attendance:mine?{kind:mine.kind,note:mine.note,created:mine.created}:null}:{})});

export function listLectures(ctx){
 const rows=ctx.db.query("SELECT * FROM lectures WHERE status='published' ORDER BY date").all();
 const mine=ctx.user?new Map(ctx.db.query('SELECT * FROM attendance WHERE user_id=?').all(ctx.user.id).map(a=>[a.lecture_id,a])):null;
 return json({items:rows.map(l=>lectureView(l,mine?mine.get(l.id)||null:undefined)),today:zagrebToday()});
}

/** Self-report of one real, already held lecture. Never upgrades itself to verified. */
export function reportAttendance(ctx,lectureId,note=''){
 const user=requireUser(ctx);
 const lecture=ctx.db.query("SELECT * FROM lectures WHERE id=? AND status='published'").get(lectureId);
 if(!lecture)fail(404,'NOT_FOUND');
 if(lecture.date>zagrebToday())fail(409,'INVALID_STATE');
 const now=nowIso();
 ctx.db.query("INSERT INTO attendance(user_id,lecture_id,kind,note,created,updated) VALUES(?,?,'self_reported',?,?,?) ON CONFLICT(user_id,lecture_id) DO NOTHING").run(user.id,lectureId,note,now,now);
 ctx.hooks?.onEvent?.(ctx,{type:'attendance',userId:user.id,lectureId});
 return ctx.db.query('SELECT * FROM attendance WHERE user_id=? AND lecture_id=?').get(user.id,lectureId);
}
export async function postAttendance(ctx,lectureId){
 const body=await readJson(ctx.request);
 const a=reportAttendance(ctx,lectureId,text(body.note,{max:500,optional:true,multiline:true},'note'));
 return json({attendance:{kind:a.kind,note:a.note,created:a.created}},201);
}

export function adminAttendance(ctx){
 requireAdmin(ctx);const lectureId=ctx.url.searchParams.get('lectureId');const {limit,offset}=page(ctx.url,100);
 const rows=ctx.db.query('SELECT a.*,u.display_name,u.login FROM attendance a JOIN users u ON u.id=a.user_id WHERE (?1 IS NULL OR a.lecture_id=?1) ORDER BY a.created DESC LIMIT ?2 OFFSET ?3').all(lectureId,limit+1,offset);
 return json({items:rows.slice(0,limit).map(r=>({userId:r.user_id,userName:r.display_name,login:r.login,lectureId:r.lecture_id,kind:r.kind,note:r.note,created:r.created})),hasMore:rows.length>limit});
}
export async function verifyAttendance(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const userId=text(body.userId,{max:80},'userId'),lectureId=text(body.lectureId,{max:80},'lectureId');
 if(!ctx.db.query('SELECT 1 FROM lectures WHERE id=?').get(lectureId)||!ctx.db.query('SELECT 1 FROM users WHERE id=?').get(userId))fail(404,'NOT_FOUND');
 const now=nowIso();
 ctx.db.query("INSERT INTO attendance(user_id,lecture_id,kind,verified_by,created,updated) VALUES(?,?,'verified_by_admin',?,?,?) ON CONFLICT(user_id,lecture_id) DO UPDATE SET kind='verified_by_admin',verified_by=excluded.verified_by,updated=excluded.updated").run(userId,lectureId,admin.id,now,now);
 audit(ctx.db,admin.id,'attendance.verify','lecture',lectureId,{user:userId});
 ctx.hooks?.onEvent?.(ctx,{type:'attendance',userId,lectureId});
 return json({ok:true});
}

export async function saveLecture(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const date=text(body.date,{max:10},'date');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(400,'INVALID_FIELDS',{field:'date'});
 const title={};for(const l of ['en','hr','ru'])title[l]=text(body.title?.[l],{min:l==='en'?1:0,max:200},'title.'+l);
 const speaker=text(body.speaker,{max:120,optional:true},'speaker');
 const status=['draft','published','archived'].includes(body.status)?body.status:'published';
 const now=nowIso(),lectureId=id||newId('lecture');
 ctx.db.query('INSERT INTO lectures(id,date,speaker,title,status,created,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,speaker=excluded.speaker,title=excluded.title,status=excluded.status,updated=excluded.updated').run(lectureId,date,speaker,JSON.stringify(title),status,now,now);
 if(body.material){const url=httpUrl(body.material.url,'material.url');if(url)ctx.db.query('INSERT INTO lecture_materials(id,lecture_id,label,url,created) VALUES(?,?,?,?,?)').run(newId('mat'),lectureId,text(body.material.label,{max:120},'material.label'),url,now);}
 audit(ctx.db,admin.id,id?'lecture.update':'lecture.create','lecture',lectureId,{});
 return json({lecture:lectureView(ctx.db.query('SELECT * FROM lectures WHERE id=?').get(lectureId))},id?200:201);
}
export function adminLectures(ctx){requireAdmin(ctx);return json({items:ctx.db.query('SELECT * FROM lectures ORDER BY date').all().map(l=>lectureView(l))});}

export async function bulkVerify(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const lectureId=text(body.lectureId,{max:80},'lectureId');if(!ctx.db.query('SELECT 1 FROM lectures WHERE id=?').get(lectureId))fail(404,'NOT_FOUND');
 const ids=Array.isArray(body.userIds)?body.userIds.slice(0,500):[];const now=nowIso();let changed=0;
 ctx.db.transaction(()=>{for(const userId of ids){if(!ctx.db.query('SELECT 1 FROM users WHERE id=?').get(userId))continue;
  const r=ctx.db.query("INSERT INTO attendance(user_id,lecture_id,kind,verified_by,created,updated) VALUES(?,?,'verified_by_admin',?,?,?) ON CONFLICT(user_id,lecture_id) DO UPDATE SET kind='verified_by_admin',verified_by=excluded.verified_by,updated=excluded.updated WHERE attendance.kind<>'verified_by_admin'").run(userId,lectureId,admin.id,now,now);
  if(r.changes){changed++;ctx.hooks?.onEvent?.(ctx,{type:'attendance',userId,lectureId});}}
  audit(ctx.db,admin.id,'attendance.bulk','lecture',lectureId,{changed});})();
 return json({changed});
}
