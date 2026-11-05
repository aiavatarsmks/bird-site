/**
 * Profile photo: one small image per account, stored in the database. The browser
 * shrinks the photo before upload; the server checks the real format by its first bytes.
 */
import {fail,json} from './http.mjs';
import {nowIso} from './db.mjs';
import {isAdmin} from './permissions.mjs';
import {requireUser} from './auth.mjs';

const MAX_BYTES=400*1024;
function sniff(b){
 if(b.length>8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47)return 'image/png';
 if(b.length>3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'image/jpeg';
 if(b.length>12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export const hasAvatar=(db,userId)=>!!db.query('SELECT 1 FROM user_avatars WHERE user_id=?').get(userId);

export async function putAvatar(ctx){
 const user=requireUser(ctx);
 if(Number(ctx.request.headers.get('content-length')||0)>MAX_BYTES)fail(413,'TOO_LARGE');
 const bytes=new Uint8Array(await ctx.request.arrayBuffer());
 if(bytes.length>MAX_BYTES)fail(413,'TOO_LARGE');
 const mime=sniff(bytes);if(!mime)fail(415,'BAD_REQUEST');
 ctx.db.query('INSERT INTO user_avatars(user_id,mime,bytes,updated) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET mime=excluded.mime,bytes=excluded.bytes,updated=excluded.updated').run(user.id,mime,bytes,nowIso());
 return json({ok:true},201);
}
export function deleteAvatar(ctx){const user=requireUser(ctx);ctx.db.query('DELETE FROM user_avatars WHERE user_id=?').run(user.id);return json({ok:true});}

/** Visible to the person and to organisers only. */
export function getAvatar(ctx,userId){
 const user=requireUser(ctx);
 const id=userId==='me'?user.id:userId;
 if(id!==user.id&&!isAdmin(user))fail(404,'NOT_FOUND');
 const row=ctx.db.query('SELECT mime,bytes,updated FROM user_avatars WHERE user_id=?').get(id);if(!row)fail(404,'NOT_FOUND');
 return new Response(row.bytes,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}
