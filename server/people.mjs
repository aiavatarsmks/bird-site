/** People, character claims, invitations and "my character". */
import {fail,json,readJson,text,oneOf,sha256,token,newId,rateLimit,page} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin,isOwner,requireAdmin,requireProject} from './permissions.mjs';
import {requireUser,APPEARANCES,rotateSession,publicUser} from './auth.mjs';
import {notify} from './notifications.mjs';

const publicPerson=p=>({id:p.id,displayName:p.display_name,kind:p.kind,publicRole:p.public_role,appearance:p.kind==='visitor'?p.appearance:undefined});

export function listPeople(ctx){
 const {limit,offset}=page(ctx.url,100);
 const rows=ctx.db.query("SELECT * FROM people WHERE kind IN ('participant','staff') AND status='active' ORDER BY display_name LIMIT ? OFFSET ?").all(limit+1,offset);
 return json({items:rows.slice(0,limit).map(publicPerson),hasMore:rows.length>limit});
}

/** Links a user to an existing person. Used by approved claims and person invitations. */
function linkPerson(db,user,personId,actor){
 const person=db.query('SELECT * FROM people WHERE id=?').get(personId);
 if(!person||person.kind!=='participant')fail(404,'NOT_FOUND');
 const taken=db.query('SELECT id FROM users WHERE person_id=?').get(personId);
 if(taken&&taken.id!==user.id)fail(409,'INVALID_STATE');
 const now=nowIso(),previous=user.person_id;
 db.query('UPDATE users SET person_id=?,updated=? WHERE id=?').run(personId,now,user.id);
 if(previous&&previous!==personId)db.query("UPDATE people SET status='archived',updated=? WHERE id=? AND kind='visitor'").run(now,previous);
 for(const {id} of db.query('SELECT p.id FROM projects p JOIN team_people t ON t.team_id=p.team_id WHERE t.person_id=?').all(personId))
  db.query("INSERT INTO memberships(project_id,user_id,role,created) VALUES(?,?,'member',?) ON CONFLICT(project_id,user_id) DO UPDATE SET revoked_at=NULL WHERE revoked_at IS NOT NULL").run(id,user.id,now);
 db.query("UPDATE person_claims SET status='withdrawn',decided_at=? WHERE user_id=? AND status='pending' AND person_id<>?").run(now,user.id,personId);
 audit(db,actor,'person.link','person',personId,{user:user.id});
}

export async function createClaim(ctx){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 rateLimit(ctx.db,'claim:'+user.id,10,86400);
 const personId=text(body.personId,{max:80},'personId'),message=text(body.message,{max:500,optional:true,multiline:true},'message');
 const person=ctx.db.query("SELECT * FROM people WHERE id=? AND kind='participant' AND status='active'").get(personId);
 if(!person)fail(404,'NOT_FOUND');
 const current=ctx.db.query('SELECT kind FROM people WHERE id=?').get(user.person_id);
 if(current?.kind==='participant')fail(409,'ALREADY_DONE');
 const existing=ctx.db.query("SELECT id FROM person_claims WHERE user_id=? AND person_id=? AND status='pending'").get(user.id,personId);
 if(existing)return json({id:existing.id,status:'pending'});
 const id=newId('clm');
 ctx.db.query('INSERT INTO person_claims(id,user_id,person_id,message,created) VALUES(?,?,?,?,?)').run(id,user.id,personId,message,nowIso());
 audit(ctx.db,user.id,'claim.create','person',personId,{claim:id});
 return json({id,status:'pending'},201);
}
export function myClaims(ctx){
 const user=requireUser(ctx);
 return json({items:ctx.db.query('SELECT c.id,c.person_id,c.status,c.created,c.decided_at,p.display_name FROM person_claims c JOIN people p ON p.id=c.person_id WHERE c.user_id=? ORDER BY c.created DESC LIMIT 20').all(user.id).map(r=>({id:r.id,personId:r.person_id,personName:r.display_name,status:r.status,created:r.created,decidedAt:r.decided_at}))});
}
export function adminClaims(ctx){
 requireAdmin(ctx);const {limit,offset}=page(ctx.url);
 const status=['pending','approved','rejected','withdrawn'].includes(ctx.url.searchParams.get('status'))?ctx.url.searchParams.get('status'):'pending';
 const rows=ctx.db.query('SELECT c.*,p.display_name person_name,u.login,u.display_name user_name FROM person_claims c JOIN people p ON p.id=c.person_id JOIN users u ON u.id=c.user_id WHERE c.status=? ORDER BY c.created LIMIT ? OFFSET ?').all(status,limit+1,offset);
 return json({items:rows.slice(0,limit).map(r=>({id:r.id,personId:r.person_id,personName:r.person_name,userId:r.user_id,login:r.login,userName:r.user_name,message:r.message,status:r.status,created:r.created})),hasMore:rows.length>limit});
}
export async function decideClaim(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const decision=oneOf(body.decision,['approved','rejected'],'decision');
 const claim=ctx.db.query('SELECT * FROM person_claims WHERE id=?').get(id);
 if(!claim)fail(404,'NOT_FOUND');
 if(claim.status!=='pending')fail(409,'ALREADY_DONE');
 ctx.db.transaction(()=>{
  const now=nowIso();
  if(decision==='approved'){const user=ctx.db.query('SELECT * FROM users WHERE id=?').get(claim.user_id);linkPerson(ctx.db,user,claim.person_id,admin.id);}
  ctx.db.query('UPDATE person_claims SET status=?,decided_by=?,decided_at=? WHERE id=?').run(decision,admin.id,now,id);
  audit(ctx.db,admin.id,'claim.'+decision,'person',claim.person_id,{claim:id,user:claim.user_id});
  notify(ctx.db,claim.user_id,'claim.'+decision,{personId:claim.person_id});
 })();
 return json({ok:true,status:decision});
}

// Invitations --------------------------------------------------------------
export async function createInvite(ctx){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 rateLimit(ctx.db,'invite:'+user.id,100,86400);
 const kind=oneOf(body.kind,['project','person','program_admin'],'kind');
 const days=Math.max(1,Math.min(30,Number(body.days)||7));
 let projectId=null,personId=null,role=null;
 if(kind==='project'){
  projectId=text(body.projectId,{max:80},'projectId');requireProject(ctx.db,user,projectId,'manage');
  role=oneOf(body.role,['editor','member','reviewer'],'role');
  if(role==='reviewer'&&!isAdmin(user))fail(403,'FORBIDDEN');
 }else if(kind==='person'){
  requireAdmin(ctx);personId=text(body.personId,{max:80},'personId');
  if(!ctx.db.query("SELECT 1 FROM people WHERE id=? AND kind='participant'").get(personId))fail(404,'NOT_FOUND');
 }else{if(!isOwner(user))fail(403,'FORBIDDEN');role='program_admin';}
 const code=token(18),id=newId('inv');
 ctx.db.query('INSERT INTO invites(id,code_hash,kind,project_id,person_id,role,created_by,expires,created) VALUES(?,?,?,?,?,?,?,?,?)').run(id,sha256(code),kind,projectId,personId,role,user.id,Date.now()+days*86400000,nowIso());
 audit(ctx.db,user.id,'invite.create',kind,projectId||personId||'platform',{invite:id,role});
 return json({id,code,kind,role,projectId,personId,expires:new Date(Date.now()+days*86400000).toISOString()},201);
}
export function listInvites(ctx){
 const user=requireUser(ctx),projectId=ctx.url.searchParams.get('projectId');
 if(projectId)requireProject(ctx.db,user,projectId,'manage');else requireAdmin(ctx);
 const rows=projectId?ctx.db.query('SELECT * FROM invites WHERE project_id=? ORDER BY created DESC LIMIT 50').all(projectId):ctx.db.query("SELECT * FROM invites WHERE kind<>'platform_owner' ORDER BY created DESC LIMIT 50").all();
 return json({items:rows.map(r=>({id:r.id,kind:r.kind,projectId:r.project_id,personId:r.person_id,role:r.role,created:r.created,expires:new Date(r.expires).toISOString(),used:!!r.used_at,revoked:!!r.revoked_at}))});
}
export function revokeInvite(ctx,id){
 const user=requireUser(ctx),invite=ctx.db.query('SELECT * FROM invites WHERE id=?').get(id);
 if(!invite||invite.kind==='platform_owner')fail(404,'NOT_FOUND');
 if(invite.project_id)requireProject(ctx.db,user,invite.project_id,'manage');else requireAdmin(ctx);
 ctx.db.query('UPDATE invites SET revoked_at=? WHERE id=? AND revoked_at IS NULL').run(nowIso(),id);
 audit(ctx.db,user.id,'invite.revoke','invite',id,{});
 return json({ok:true});
}
export async function acceptInvite(ctx){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 rateLimit(ctx.db,'invite-accept:'+user.id,20,3600);
 const code=typeof body.code==='string'?body.code.trim().slice(0,100):'';
 const invite=ctx.db.query('SELECT * FROM invites WHERE code_hash=?').get(sha256(code));
 if(!invite||invite.revoked_at||invite.expires<Date.now())fail(400,'INVITE_INVALID');
 if(invite.used_at)fail(invite.used_by===user.id?409:400,invite.used_by===user.id?'ALREADY_DONE':'INVITE_INVALID');
 let privilege=false;
 ctx.db.transaction(()=>{
  const now=nowIso();
  // The update is the single-use guard: a second concurrent accept changes nothing.
  const r=ctx.db.query('UPDATE invites SET used_by=?,used_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL').run(user.id,now,invite.id);
  if(!r.changes)fail(400,'INVITE_INVALID');
  if(invite.kind==='project'){
   const project=ctx.db.query("SELECT id FROM projects WHERE id=? AND status<>'archived'").get(invite.project_id);if(!project)fail(400,'INVITE_INVALID');
   ctx.db.query('INSERT INTO memberships(project_id,user_id,role,created) VALUES(?,?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,revoked_at=NULL').run(invite.project_id,user.id,invite.role,now);
   audit(ctx.db,user.id,'membership.join','project',invite.project_id,{role:invite.role,invite:invite.id});
  }else if(invite.kind==='person'){linkPerson(ctx.db,user,invite.person_id,invite.created_by);}
  else if(invite.kind==='program_admin'){if(user.role==='member'){ctx.db.query("UPDATE users SET role='program_admin',updated=? WHERE id=?").run(now,user.id);privilege=true;}audit(ctx.db,invite.created_by,'role.grant','user',user.id,{role:'program_admin'});}
  else if(invite.kind==='platform_owner'){
   ctx.db.query("UPDATE users SET role='platform_owner',updated=? WHERE id=?").run(now,user.id);
   ctx.db.query("INSERT INTO settings(key,value,updated) VALUES('bootstrap_completed',?,?) ON CONFLICT(key) DO NOTHING").run(user.id,now);
   privilege=true;audit(ctx.db,user.id,'role.bootstrap_owner','user',user.id,{});
  }
 })();
 ctx.user=ctx.db.query('SELECT * FROM users WHERE id=?').get(user.id);
 const csrf=privilege?rotateSession(ctx):undefined;
 ctx.hooks?.onUserReady?.(ctx,ctx.user);
 return json({ok:true,kind:invite.kind,projectId:invite.project_id,user:publicUser(ctx.user),...(csrf?{csrf}:{})});
}

// My character ---------------------------------------------------------------
export function myCharacter(ctx){
 const user=requireUser(ctx),person=ctx.db.query('SELECT * FROM people WHERE id=?').get(user.person_id);
 const refs=ctx.db.query("SELECT id,filename,created FROM files WHERE owner_user_id=? AND purpose='reference' AND status='active' ORDER BY created DESC LIMIT 5").all(user.id);
 return json({person:person&&{...publicPerson(person),appearance:person.appearance,confirmed:person.kind==='participant'},appearances:APPEARANCES,references:refs});
}
export async function updateCharacter(ctx){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const person=ctx.db.query('SELECT * FROM people WHERE id=?').get(user.person_id);if(!person)fail(404,'NOT_FOUND');
 const now=nowIso();
 if(person.kind==='visitor'){
  const name=body.displayName!==undefined?text(body.displayName,{min:1,max:80},'displayName'):person.display_name;
  const appearance=body.appearance!==undefined?(body.appearance?oneOf(body.appearance,APPEARANCES,'appearance'):''):person.appearance;
  ctx.db.query('UPDATE people SET display_name=?,appearance=?,updated=? WHERE id=?').run(name,appearance,now,person.id);
 }else{
  // A confirmed participant keeps the approved look in every pose; the public role can change.
  const role=text(body.publicRole,{max:80,optional:true},'publicRole');
  ctx.db.query('UPDATE people SET public_role=?,updated=? WHERE id=?').run(role,now,person.id);
  if(body.appearanceRequest){const note=text(body.appearanceRequest,{max:500,multiline:true},'appearanceRequest');audit(ctx.db,user.id,'appearance.request','person',person.id,{note});}
 }
 audit(ctx.db,user.id,'character.update','person',person.id,{});
 return myCharacter(ctx);
}
export async function updateProfile(ctx){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const name=body.displayName!==undefined?text(body.displayName,{min:1,max:80},'displayName'):user.display_name;
 const email=body.email!==undefined?text(body.email,{max:200,optional:true},'email'):user.email||'';
 if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))fail(400,'INVALID_FIELDS',{field:'email'});
 const language=['en','hr','ru'].includes(body.language)?body.language:user.language;
 const optIn=body.leaderboardOptIn!==undefined?(body.leaderboardOptIn?1:0):user.leaderboard_opt_in;
 const now=nowIso();
 ctx.db.query('UPDATE users SET display_name=?,email=?,email_verified=CASE WHEN email IS ? THEN email_verified ELSE 0 END,language=?,leaderboard_opt_in=?,updated=? WHERE id=?').run(name,email||null,email||null,language,optIn,now,user.id);
 ctx.user=ctx.db.query('SELECT * FROM users WHERE id=?').get(user.id);
 ctx.hooks?.onProfileUpdated?.(ctx,ctx.user);
 return json({user:publicUser(ctx.user)});
}
