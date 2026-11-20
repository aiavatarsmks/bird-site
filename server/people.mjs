/** People, character claims, invitations and "my character". */
import {fail,json,readJson,text,oneOf,sha256,token,newId,rateLimit,page} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin,requireAdmin,requireProject} from './permissions.mjs';
import {requireUser,APPEARANCES,rotateSession,publicUser} from './auth.mjs';
import {notify} from './notifications.mjs';
import {deliverWaiting} from './messages.mjs';

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
  db.query("INSERT INTO memberships(project_id,user_id,role,created) VALUES(?,?,'editor',?) ON CONFLICT(project_id,user_id) DO UPDATE SET revoked_at=NULL,role='editor' WHERE revoked_at IS NOT NULL OR role='member'").run(id,user.id,now);
 db.query("UPDATE person_claims SET status='withdrawn',decided_at=? WHERE user_id=? AND status='pending' AND person_id<>?").run(now,user.id,personId);
 deliverWaiting(db,personId,user.id);
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

// "This is me" and organiser linking -----------------------------------------------
// Names compare without case, accents, punctuation or word order: "Maksim Ilin", "ILIN, Maksím" and "Ilin Maksim" match.
export const foldName=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đ]/gi,'d').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const nameKey=s=>foldName(s).split(' ').filter(Boolean).sort().join(' ');
const isLinked=(db,user)=>db.query('SELECT kind FROM people WHERE id=?').get(user.person_id)?.kind==='participant';
const mail=v=>String(v||'').trim().toLowerCase();
/** How a person card relates to the signed-in user: theirs, someone else's, or free. */
export function personStatus(ctx,personId){
 const user=requireUser(ctx);
 const person=ctx.db.query("SELECT id FROM people WHERE id=? AND kind='participant' AND status='active'").get(personId);if(!person)fail(404,'NOT_FOUND');
 const owner=ctx.db.query('SELECT id FROM users WHERE person_id=?').get(personId);
 const pending=!!ctx.db.query("SELECT 1 FROM person_claims WHERE user_id=? AND person_id=? AND status='pending'").get(user.id,personId);
 return json({mine:owner?.id===user.id,linked:!!owner,canClaim:!owner&&!isLinked(ctx.db,user),direct:isAdmin(user),pending});
}
/** An organiser who is on the roster links their own card without a claim; the role stays as it is. */
export function linkSelf(ctx,personId){
 const user=requireAdmin(ctx);
 if(!ctx.db.query("SELECT 1 FROM people WHERE id=? AND kind='participant' AND status='active'").get(personId))fail(404,'NOT_FOUND');
 if(isLinked(ctx.db,user)&&user.person_id!==personId)fail(409,'ALREADY_DONE');
 const delivered=linkByAdmin(ctx.db,user,personId,user,'person.self_link');
 ctx.user=ctx.db.query('SELECT * FROM users WHERE id=?').get(user.id);
 ctx.hooks?.onUserReady?.(ctx,ctx.user);
 return json({ok:true,delivered,user:publicUser(ctx.user)});
}
// One transaction per link: waiting messages arrive, the user's other pending claims close, the audit names who did it.
function linkByAdmin(db,admin,personId,user,action){
 let delivered=0;
 db.transaction(()=>{
  delivered=db.query('SELECT count(*) n FROM waiting_messages WHERE person_id=? AND sender_id<>?').get(personId,user.id).n;
  linkPerson(db,user,personId,admin.id);
  db.query("UPDATE person_claims SET status='withdrawn',decided_at=? WHERE user_id=? AND status='pending'").run(nowIso(),user.id);
  audit(db,admin.id,action,'person',personId,{user:user.id,role:user.role,delivered});
 })();
 return delivered;
}
// Accounts not linked to any participant card yet: the only ones a card can be linked to.
const freeUsers=db=>db.query("SELECT u.id,u.login,u.display_name name,u.email,u.role FROM users u LEFT JOIN people p ON p.id=u.person_id WHERE u.status='active' AND u.id NOT LIKE 'demo-user-%' AND coalesce(p.kind,'')<>'participant'").all();
function matchFor(person,free){
 const e=mail(person.email),byMail=e?free.filter(u=>mail(u.email)===e):[];
 if(byMail.length===1)return {...byMail[0],by:'email'};
 const k=nameKey(person.name),byName=free.filter(u=>nameKey(u.name)===k);
 return byName.length===1?{...byName[0],by:'name'}:null;
}
const userView=u=>u&&{id:u.id,login:u.login,name:u.name,email:u.email||'',role:u.role};
/** Admin: every participant card with its email, the account linked to it, and the account that looks like theirs. */
export function adminLinks(ctx){
 requireAdmin(ctx);
 const people=ctx.db.query("SELECT p.id,p.display_name name,p.email,(SELECT t.name FROM team_people tp JOIN teams t ON t.id=tp.team_id WHERE tp.person_id=p.id LIMIT 1) team,u.id uid,u.login,u.display_name uname,u.email uemail,u.role FROM people p LEFT JOIN users u ON u.person_id=p.id WHERE p.kind='participant' AND p.status='active' AND p.id NOT LIKE 'demo-%' ORDER BY p.display_name COLLATE NOCASE").all();
 const free=freeUsers(ctx.db);
 return json({items:people.map(p=>({id:p.id,name:p.name,team:p.team||'',email:p.email||'',
  linked:p.uid?userView({id:p.uid,login:p.login,name:p.uname,email:p.uemail,role:p.role}):null,
  match:p.uid?null:(m=>m&&{...userView(m),by:m.by})(matchFor(p,free))})),
  accounts:free.map(userView)});
}
export async function setPersonEmail(ctx,personId){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const email=text(body.email,{max:200,optional:true},'email');
 if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))fail(400,'INVALID_FIELDS',{field:'email'});
 const r=ctx.db.query("UPDATE people SET email=?,updated=? WHERE id=? AND kind='participant'").run(email||null,nowIso(),personId);
 if(!r.changes)fail(404,'NOT_FOUND');
 audit(ctx.db,admin.id,'person.email','person',personId,{});
 return json({ok:true,email:email||''});
}
export async function adminLink(ctx,personId){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 if(!ctx.db.query("SELECT 1 FROM people WHERE id=? AND kind='participant' AND status='active'").get(personId))fail(404,'NOT_FOUND');
 const user=ctx.db.query("SELECT * FROM users WHERE id=? AND status='active'").get(String(body.userId||''));if(!user)fail(404,'NOT_FOUND');
 if(isLinked(ctx.db,user)&&user.person_id!==personId)fail(409,'ALREADY_DONE');
 if(ctx.db.query('SELECT id FROM users WHERE person_id=? AND id<>?').get(personId,user.id))fail(409,'INVALID_STATE');
 const delivered=linkByAdmin(ctx.db,admin,personId,user,'person.admin_link');
 notify(ctx.db,user.id,'person.linked',{personId});
 return json({ok:true,delivered});
}
/** Links every card whose email belongs to exactly one free account. Names alone never link in bulk. */
export function adminLinkByEmail(ctx){
 const admin=requireAdmin(ctx),linked=[];
 const people=ctx.db.query("SELECT p.id,p.display_name name,p.email FROM people p WHERE p.kind='participant' AND p.status='active' AND p.email IS NOT NULL AND p.email<>'' AND NOT EXISTS(SELECT 1 FROM users u WHERE u.person_id=p.id)").all();
 for(const p of people){
  const m=matchFor(p,freeUsers(ctx.db));if(m?.by!=='email')continue;
  const user=ctx.db.query('SELECT * FROM users WHERE id=?').get(m.id);
  linkByAdmin(ctx.db,admin,p.id,user,'person.admin_link');notify(ctx.db,user.id,'person.linked',{personId:p.id});
  linked.push({personId:p.id,userId:user.id});
 }
 return json({ok:true,linked});
}
// Roster built by the organiser: a team and the people on it, before anyone has an account ----------
const autoLinkOn=db=>db.query("SELECT value FROM settings WHERE key='auto_link_email'").get()?.value==='1';
/** Admin: a new team (its project starts as a draft with no members; people join by linking their card). */
export async function adminCreateTeam(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const name=text(body.name,{min:1,max:100},'name'),short=text(body.description??'',{max:280,multiline:true},'description');
 const key=foldName(name);
 if(ctx.db.query("SELECT json_extract(draft,'$.name') n FROM projects WHERE status<>'archived'").all().some(r=>foldName(r.n)===key))fail(409,'CONFLICT',{field:'name'});
 const now=nowIso(),teamId=newId('team'),projectId=newId('project');
 const content={name,short,problem:'',users:'',solution:'',value:'',ask:'',nextSteps:'',details:'',stage:'idea',links:[]};
 ctx.db.transaction(()=>{
  ctx.db.query('INSERT INTO teams(id,name,created) VALUES(?,?,?)').run(teamId,name,now);
  ctx.db.query("INSERT INTO projects(id,team_id,source,status,created_by,draft,draft_version,created,updated) VALUES(?,?,'user','draft',?,?,1,?,?)").run(projectId,teamId,admin.id,JSON.stringify(content),now,now);
  ctx.db.query("INSERT INTO project_revisions(project_id,version,kind,content,author,created) VALUES(?,1,'draft',?,?,?)").run(projectId,JSON.stringify(content),admin.id,now);
  audit(ctx.db,admin.id,'team.create','project',projectId,{name});
  // Tasks meant for every team reach the new one at once; they wait there until its people join.
  ctx.hooks?.onEvent?.(ctx,{type:'team.created',projectId});
 })();
 return json({projectId,teamId,name},201);
}
/** Admin: a participant card with the email the person will sign up with, optionally on a team. */
export async function adminCreatePerson(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const name=text(body.name,{min:1,max:80},'name'),email=mail(text(body.email??'',{max:200},'email'));
 if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))fail(400,'INVALID_FIELDS',{field:'email'});
 // One card per email, so signing up with it can only ever match one person.
 if(email&&ctx.db.query("SELECT 1 FROM people WHERE kind='participant' AND status='active' AND lower(email)=?").get(email))fail(409,'CONFLICT',{field:'email'});
 const projectId=body.projectId?text(body.projectId,{max:80},'projectId'):'';
 const project=projectId?ctx.db.query("SELECT id,team_id FROM projects WHERE id=? AND status<>'archived'").get(projectId):null;
 if(projectId&&!project)fail(404,'NOT_FOUND');
 const now=nowIso(),id=newId('person');let linked=null;
 ctx.db.transaction(()=>{
  ctx.db.query("INSERT INTO people(id,display_name,kind,source,email,created,updated) VALUES(?,?,'participant','curated',?,?,?)").run(id,name,email||null,now,now);
  if(project)ctx.db.query('INSERT OR IGNORE INTO team_people(team_id,person_id) VALUES(?,?)').run(project.team_id,id);
  audit(ctx.db,admin.id,'person.create','person',id,{project:projectId||null});
  // Someone who already signed up with this email is linked at once when the organiser asked for that.
  if(email&&autoLinkOn(ctx.db)){const free=freeUsers(ctx.db).filter(u=>mail(u.email)===email);if(free.length===1){const u=ctx.db.query('SELECT * FROM users WHERE id=?').get(free[0].id);linkPerson(ctx.db,u,id,admin.id);notify(ctx.db,u.id,'person.linked',{personId:id});linked=u.id;}}
 })();
 return json({id,name,email,projectId:projectId||null,linkedUserId:linked},201);
}
export function autoLinkStatus(ctx){requireAdmin(ctx);return json({on:autoLinkOn(ctx.db)});}
export async function setAutoLink(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request),on=!!body.on;
 ctx.db.query("INSERT INTO settings(key,value,updated) VALUES('auto_link_email',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated").run(on?'1':'0',nowIso());
 audit(ctx.db,admin.id,'settings.auto_link_email','settings','auto_link_email',{on});
 return json({on});
}
/**
 * After sign-up or an email change: when the organiser turned "Link automatically by email" on and exactly one
 * free participant card carries this email, the account becomes that card. Off by default (emails are not verified).
 */
export function autoLinkByEmail(db,user){
 if(!user?.email||!autoLinkOn(db)||isLinked(db,user)||user.id.startsWith('demo-'))return false;
 const cards=db.query("SELECT p.id FROM people p WHERE p.kind='participant' AND p.status='active' AND lower(p.email)=? AND NOT EXISTS(SELECT 1 FROM users u WHERE u.person_id=p.id)").all(mail(user.email));
 if(cards.length!==1)return false;
 db.transaction(()=>{linkPerson(db,user,cards[0].id,user.id);audit(db,user.id,'person.auto_link','person',cards[0].id,{user:user.id});notify(db,user.id,'person.linked',{personId:cards[0].id});})();
 return true;
}

/** The account goes back to a plain visitor character; the card waits for the right person again. */
export function adminUnlink(ctx,personId){
 const admin=requireAdmin(ctx);
 const user=ctx.db.query('SELECT * FROM users WHERE person_id=?').get(personId);if(!user)fail(404,'NOT_FOUND');
 ctx.db.transaction(()=>{
  const now=nowIso(),visitor=newId('visitor');
  ctx.db.query("INSERT INTO people(id,display_name,kind,source,created,updated) VALUES(?,?,'visitor','user',?,?)").run(visitor,user.display_name,now,now);
  ctx.db.query('UPDATE users SET person_id=?,updated=? WHERE id=?').run(visitor,now,user.id);
  audit(ctx.db,admin.id,'person.unlink','person',personId,{user:user.id});
 })();
 return json({ok:true});
}

// Invitations --------------------------------------------------------------
export async function createInvite(ctx){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 rateLimit(ctx.db,'invite:'+user.id,100,86400);
 const kind=oneOf(body.kind,['project','person','program_admin'],'kind');
 const days=Math.max(1,Math.min(30,Number(body.days)||7));
 let projectId=null,personId=null,role=null;
 if(kind==='project'){
  // Any editor brings teammates in (roster teams have no owner); only the owner or an organiser changes roles or removes.
  projectId=text(body.projectId,{max:80},'projectId');requireProject(ctx.db,user,projectId,'edit');
  role=oneOf(body.role,['editor','member','reviewer'],'role');
  if(role==='reviewer'&&!isAdmin(user))fail(403,'FORBIDDEN');
 }else if(kind==='person'){
  requireAdmin(ctx);personId=text(body.personId,{max:80},'personId');
  if(!ctx.db.query("SELECT 1 FROM people WHERE id=? AND kind='participant'").get(personId))fail(404,'NOT_FOUND');
 }else{requireAdmin(ctx);role='program_admin';}
 const code=token(18),id=newId('inv');
 ctx.db.query('INSERT INTO invites(id,code_hash,kind,project_id,person_id,role,created_by,expires,created) VALUES(?,?,?,?,?,?,?,?,?)').run(id,sha256(code),kind,projectId,personId,role,user.id,Date.now()+days*86400000,nowIso());
 audit(ctx.db,user.id,'invite.create',kind,projectId||personId||'platform',{invite:id,role});
 return json({id,code,kind,role,projectId,personId,expires:new Date(Date.now()+days*86400000).toISOString()},201);
}
export function listInvites(ctx){
 const user=requireUser(ctx),projectId=ctx.url.searchParams.get('projectId');
 if(projectId)requireProject(ctx.db,user,projectId,'edit');else requireAdmin(ctx);
 const rows=projectId?ctx.db.query('SELECT * FROM invites WHERE project_id=? ORDER BY created DESC LIMIT 50').all(projectId):ctx.db.query("SELECT * FROM invites WHERE kind<>'platform_owner' ORDER BY created DESC LIMIT 50").all();
 return json({items:rows.map(r=>({id:r.id,kind:r.kind,projectId:r.project_id,personId:r.person_id,role:r.role,created:r.created,expires:new Date(r.expires).toISOString(),used:!!r.used_at,revoked:!!r.revoked_at}))});
}
export function revokeInvite(ctx,id){
 const user=requireUser(ctx),invite=ctx.db.query('SELECT * FROM invites WHERE id=?').get(id);
 if(!invite||invite.kind==='platform_owner')fail(404,'NOT_FOUND');
 if(invite.project_id)requireProject(ctx.db,user,invite.project_id,'edit');else requireAdmin(ctx);
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
   // An invitation never lowers an existing role (an owner stays owner).
   ctx.db.query("INSERT INTO memberships(project_id,user_id,role,created) VALUES(?,?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=CASE WHEN memberships.revoked_at IS NOT NULL THEN excluded.role WHEN memberships.role='owner' THEN 'owner' WHEN memberships.role='editor' AND excluded.role IN ('member','reviewer') THEN 'editor' ELSE excluded.role END,revoked_at=NULL").run(invite.project_id,user.id,invite.role,now);
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
 // Email choices are kept now and used once organisers switch mail on; nothing is sent before that.
 const flag=(v,old)=>v!==undefined?(v?1:0):old;
 const mailMessages=flag(body.emailMessages,user.email_messages),mailReminders=flag(body.emailReminders,user.email_reminders);
 const now=nowIso();
 ctx.db.query('UPDATE users SET display_name=?,email=?,email_verified=CASE WHEN email IS ? THEN email_verified ELSE 0 END,language=?,leaderboard_opt_in=?,email_messages=?,email_reminders=?,updated=? WHERE id=?').run(name,email||null,email||null,language,optIn,mailMessages,mailReminders,now,user.id);
 ctx.user=ctx.db.query('SELECT * FROM users WHERE id=?').get(user.id);
 ctx.hooks?.onProfileUpdated?.(ctx,ctx.user);
 return json({user:publicUser(ctx.user)});
}
