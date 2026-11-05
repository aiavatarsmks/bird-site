/** In-account notifications. Nothing is sent by email or chat. */
import {json,newId,page} from './http.mjs';
import {nowIso} from './db.mjs';

export function notify(db,userId,kind,payload={}){
 db.query('INSERT INTO notifications(id,user_id,kind,payload,created) VALUES(?,?,?,?,?)').run(newId('ntf'),userId,kind,JSON.stringify(payload),nowIso());
}
export function listNotifications(ctx){
 const {limit,offset}=page(ctx.url,30);
 const rows=ctx.db.query('SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT ? OFFSET ?').all(ctx.user.id,limit+1,offset);
 const unread=ctx.db.query('SELECT count(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').get(ctx.user.id).n;
 return json({items:rows.slice(0,limit).map(r=>({id:r.id,kind:r.kind,payload:JSON.parse(r.payload),read:!!r.read_at,created:r.created})),hasMore:rows.length>limit,unread});
}
export function markRead(ctx){
 ctx.db.query('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').run(nowIso(),ctx.user.id);
 return json({ok:true});
}
