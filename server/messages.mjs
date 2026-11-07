/**
 * Private messages between any two signed-in people. Organisers never read conversations:
 * they see a message only when its recipient reports it. Anyone can block anyone.
 */
import {fail,json,readJson,text,newId,rateLimit} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin,requireAdmin} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {notify} from './notifications.mjs';

const PAGE=50;
const person=(db,id)=>db.query("SELECT u.id,u.display_name name,u.role,u.status,(SELECT json_extract(p.draft,'$.name') FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=u.id AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member') ORDER BY m.created LIMIT 1) team FROM users u WHERE u.id=?").get(id);
const view=p=>({id:p.id,name:p.name,team:p.team||'',organiser:isAdmin(p)});
const blocked=(db,a,b)=>!!db.query('SELECT 1 FROM message_blocks WHERE user_id=? AND blocked_id=?').get(a,b);
export const unreadMessages=(db,userId)=>db.query('SELECT count(*) n FROM direct_messages d WHERE d.recipient_id=? AND d.read_at IS NULL AND NOT EXISTS(SELECT 1 FROM message_blocks b WHERE b.user_id=d.recipient_id AND b.blocked_id=d.sender_id)').get(userId).n;

/** Conversations, newest first, with the unread count from each person. */
export function conversations(ctx){
 const user=requireUser(ctx);
 const rows=ctx.db.query(`SELECT other,max(created) last FROM (SELECT recipient_id other,created FROM direct_messages WHERE sender_id=?1 UNION ALL SELECT sender_id other,created FROM direct_messages WHERE recipient_id=?1) GROUP BY other ORDER BY last DESC LIMIT 200`).all(user.id);
 return json({items:rows.map(r=>{const p=person(ctx.db,r.other);if(!p)return null;
  const last=ctx.db.query('SELECT sender_id,body,created FROM direct_messages WHERE (sender_id=?1 AND recipient_id=?2) OR (sender_id=?2 AND recipient_id=?1) ORDER BY created DESC,rowid DESC LIMIT 1').get(user.id,r.other);
  const unread=ctx.db.query('SELECT count(*) n FROM direct_messages WHERE sender_id=? AND recipient_id=? AND read_at IS NULL').get(r.other,user.id).n;
  return {person:view(p),last:{mine:last.sender_id===user.id,body:last.body.slice(0,140),created:last.created},unread:blocked(ctx.db,user.id,r.other)?0:unread,blocked:blocked(ctx.db,user.id,r.other)};}).filter(Boolean),unread:unreadMessages(ctx.db,user.id)});
}
/** People one can write to: everyone active, found by name or team. */
export function directory(ctx){
 const user=requireUser(ctx),q=(ctx.url.searchParams.get('q')||'').trim().toLowerCase().slice(0,60);
 const rows=ctx.db.query("SELECT id FROM users WHERE status='active' AND id<>? ORDER BY display_name COLLATE NOCASE LIMIT 500").all(user.id).map(r=>view(person(ctx.db,r.id)));
 return json({items:(q?rows.filter(p=>(p.name+' '+p.team).toLowerCase().includes(q)):rows).slice(0,100)});
}
/** The account of a person on the office map, if they have one. */
export function forPerson(ctx,personId){
 requireUser(ctx);
 const u=ctx.db.query("SELECT id FROM users WHERE person_id=? AND status='active'").get(personId);if(!u)fail(404,'NOT_FOUND');
 return json({person:view(person(ctx.db,u.id))});
}
/** One conversation; opening it marks incoming messages as read. */
export function thread(ctx,otherId){
 const user=requireUser(ctx),other=person(ctx.db,otherId);if(!other||other.id===user.id)fail(404,'NOT_FOUND');
 const before=ctx.url.searchParams.get('before')||'9999';
 const rows=ctx.db.query('SELECT * FROM (SELECT rowid r,* FROM direct_messages WHERE ((sender_id=?1 AND recipient_id=?2) OR (sender_id=?2 AND recipient_id=?1)) AND created<?3 ORDER BY created DESC,rowid DESC LIMIT ?4) ORDER BY created,r').all(user.id,otherId,before,PAGE+1);
 const more=rows.length>PAGE;if(more)rows.shift();
 const reported=new Set(ctx.db.query('SELECT message_id FROM message_reports WHERE reporter_id=?').all(user.id).map(r=>r.message_id));
 ctx.db.query('UPDATE direct_messages SET read_at=? WHERE sender_id=? AND recipient_id=? AND read_at IS NULL').run(nowIso(),otherId,user.id);
 return json({person:{...view(other),active:other.status==='active'},blocked:blocked(ctx.db,user.id,otherId),blockedMe:blocked(ctx.db,otherId,user.id),hasMore:more,
  items:rows.map(m=>({id:m.id,mine:m.sender_id===user.id,body:m.body,created:m.created,read:!!m.read_at,reported:reported.has(m.id)}))});
}
export async function send(ctx,otherId){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const other=person(ctx.db,otherId);if(!other||other.id===user.id||other.status!=='active')fail(404,'NOT_FOUND');
 // Either side's block stops the message; the sender is not told who blocked whom.
 if(blocked(ctx.db,user.id,otherId)||blocked(ctx.db,otherId,user.id))fail(403,'FORBIDDEN');
 rateLimit(ctx.db,'dm:'+user.id,30,60);rateLimit(ctx.db,'dm-day:'+user.id,500,86400);
 const id=newId('dm'),created=nowIso();
 ctx.db.query('INSERT INTO direct_messages(id,sender_id,recipient_id,body,created) VALUES(?,?,?,?,?)').run(id,user.id,otherId,text(body.body,{min:1,max:2000,multiline:true},'body'),created);
 return json({id,created},201);
}
export function block(ctx,otherId,on){
 const user=requireUser(ctx);if(!person(ctx.db,otherId)||otherId===user.id)fail(404,'NOT_FOUND');
 if(on)ctx.db.query('INSERT OR IGNORE INTO message_blocks(user_id,blocked_id,created) VALUES(?,?,?)').run(user.id,otherId,nowIso());
 else ctx.db.query('DELETE FROM message_blocks WHERE user_id=? AND blocked_id=?').run(user.id,otherId);
 return json({blocked:on});
}
/** The recipient sends one message to the organisers. Nothing else from the conversation goes with it. */
export function report(ctx,messageId){
 const user=requireUser(ctx);
 const m=ctx.db.query('SELECT * FROM direct_messages WHERE id=? AND recipient_id=?').get(messageId,user.id);if(!m)fail(404,'NOT_FOUND');
 const r=ctx.db.query('INSERT OR IGNORE INTO message_reports(id,message_id,reporter_id,created) VALUES(?,?,?,?)').run(newId('rep'),messageId,user.id,nowIso());
 if(r.changes){for(const a of ctx.db.query("SELECT id,role FROM users WHERE status='active'").all().filter(isAdmin))if(a.id!==m.sender_id)notify(ctx.db,a.id,'message.reported',{});
  audit(ctx.db,user.id,'message.report','message',messageId,{});}
 return json({ok:true});
}
export function adminReports(ctx){
 requireAdmin(ctx);
 const rows=ctx.db.query('SELECT r.id,r.created,r.resolved_at,m.body,m.created sent,m.sender_id,m.recipient_id FROM message_reports r JOIN direct_messages m ON m.id=r.message_id ORDER BY r.resolved_at IS NOT NULL,r.created DESC LIMIT 100').all();
 const name=id=>person(ctx.db,id);
 return json({items:rows.map(r=>({id:r.id,created:r.created,resolved:!!r.resolved_at,body:r.body,sent:r.sent,from:view(name(r.sender_id)),to:view(name(r.recipient_id))}))});
}
export function resolveReport(ctx,id){
 const admin=requireAdmin(ctx);
 const r=ctx.db.query('UPDATE message_reports SET resolved_at=?,resolved_by=? WHERE id=? AND resolved_at IS NULL').run(nowIso(),admin.id,id);if(!r.changes)fail(404,'NOT_FOUND');
 audit(ctx.db,admin.id,'message.resolve','message_report',id,{});
 return json({ok:true});
}
