/**
 * Pilot requests from the public landing of the demo workspace. This is the sales funnel, so the requests are
 * stored for real even though the rest of the demo is read-only. Only the platform owner reads them.
 */
import {fail,json,readJson,text,newId,rateLimit} from './http.mjs';
import {nowIso} from './db.mjs';
import {requireOwner,audit} from './permissions.mjs';
import {notify} from './notifications.mjs';
import {postToChat} from './cohort.mjs';
import {isDemo,isDemoUser} from './demo-visit.mjs';

export const TEAMS=['1-5','6-10','11-20','21-50','50+'];
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/,PHONE=/^\+?[\d\s()./-]{6,30}$/;

export async function submit(ctx){
 if(!isDemo(ctx.db))fail(404,'NOT_FOUND');
 // Typos are cheap to fix and do not count much; stored requests do (see below).
 rateLimit(ctx.db,'pilot-try:'+ctx.ip,60,3600);
 const body=await readJson(ctx.request,16*1024);
 // Honeypot: people never see the "website" field; a bot that fills it is told "thank you" and nothing is kept.
 if(body.website)return json({ok:true},201);
 const name=text(body.name,{min:2,max:120},'name'),organisation=text(body.organisation,{min:2,max:160},'organisation');
 const email=text(body.email,{min:5,max:200},'email').toLowerCase();if(!EMAIL.test(email))fail(400,'INVALID_FIELDS',{field:'email'});
 const phone=text(body.phone,{optional:true,max:30},'phone');if(phone&&!PHONE.test(phone))fail(400,'INVALID_FIELDS',{field:'phone'});
 const teams=body.teams?String(body.teams):'';if(teams&&!TEAMS.includes(teams))fail(400,'INVALID_FIELDS',{field:'teams'});
 const message=text(body.message,{optional:true,max:2000,multiline:true},'message');
 if(body.consent!==true)fail(400,'INVALID_FIELDS',{field:'consent'});
 // One incubator may send a few; a script may not fill the table.
 rateLimit(ctx.db,'pilot:'+ctx.ip,5,3600);rateLimit(ctx.db,'pilot:all',200,86400);
 const language=['hr','en','ru'].includes(body.language)?body.language:'hr',id=newId('lead'),now=nowIso();
 ctx.db.query('INSERT INTO pilot_requests(id,name,organisation,email,phone,teams,message,language,consent_at,created) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,name,organisation,email,phone,teams,message,language,now,now);
 for(const o of ctx.db.query("SELECT id FROM users WHERE role='platform_owner' AND status='active' AND id NOT LIKE 'demo-%'").all())notify(ctx.db,o.id,'pilot.request',{name,organisation});
 // The chat gets who and from where; contact details stay in the workspace.
 const origin=ctx.config.publicOrigin||new URL(ctx.request.url).origin;
 postToChat(ctx.db,'Pilot request',`${name} · ${organisation}${teams?` · ${teams} teams`:''}\n${origin}/demo#/admin/system`);
 return json({ok:true},201);
}

/** The owner's list. Demo visitors borrow program_admin accounts, so requireOwner already keeps them out. */
export function list(ctx){
 const owner=requireOwner(ctx);if(isDemoUser(owner))fail(403,'FORBIDDEN');
 return json({demo:isDemo(ctx.db),items:ctx.db.query('SELECT id,name,organisation,email,phone,teams,message,language,created FROM pilot_requests ORDER BY created DESC LIMIT 200').all()});
}

/** Deleted on request (the privacy note promises it). */
export function remove(ctx,id){
 const owner=requireOwner(ctx);if(isDemoUser(owner))fail(403,'FORBIDDEN');
 if(!ctx.db.query('DELETE FROM pilot_requests WHERE id=?').run(id).changes)fail(404,'NOT_FOUND');
 audit(ctx.db,owner.id,'pilot_request.delete','pilot_request',id,{});
 return json({ok:true});
}
