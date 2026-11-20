/** Accounts, password login, sessions, recovery codes, password reset by email and owner bootstrap. */
import {writeFileSync,chmodSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fail,text,oneOf,sha256,token,newId,cookie,parseCookies,rateLimit,json,readJson,selfOrigin} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit} from './permissions.mjs';
import {sendMail,mailEnabled} from './mail.mjs';
import {isDemo} from './demo-visit.mjs';

export const SESSION_COOKIE='bird_session';
const LOGIN_RE=/^[a-z0-9][a-z0-9._@+-]{2,59}$/;
export const APPEARANCES=['woman','man'];
export const LANGUAGES=['en','hr','ru'];

// Argon2id hashing is expensive: never run more than four at once.
let active=0;const queue=[];
async function limited(fn){
 if(active>=4)await new Promise(r=>queue.push(r));
 active++;try{return await fn();}finally{active--;queue.shift()?.();}
}
export const hashPassword=password=>limited(()=>Bun.password.hash(password,{algorithm:'argon2id',memoryCost:19456,timeCost:2}));
const verifyPassword=(password,hash)=>limited(()=>Bun.password.verify(password,hash));
let dummyHash=null;
/** True when `password` is the account's current one (deleting an account asks for it again). */
export async function passwordMatches(db,userId,password){
 const row=db.query('SELECT hash FROM password_credentials WHERE user_id=?').get(userId);
 return !!row&&await verifyPassword(String(password||'').slice(0,200)||'x',row.hash);
}

function device(ua=''){
 const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Browser';
 const os=/iPhone|iPad/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Mac OS X/.test(ua)?'macOS':/Windows/.test(ua)?'Windows':/Linux/.test(ua)?'Linux':'';
 return os?`${browser} · ${os}`:browser;
}

export function createSession(ctx,userId){
 const raw=token(32),csrf=token(24),now=nowIso(),id=newId('ses');
 const expires=Date.now()+ctx.config.sessionDays*86400000;
 ctx.db.query('INSERT INTO sessions(id,user_id,token_hash,csrf,device,created,last_seen,expires) VALUES(?,?,?,?,?,?,?,?)').run(id,userId,sha256(raw),csrf,device(ctx.request.headers.get('user-agent')||''),now,now,expires);
 ctx.setCookie=cookie(SESSION_COOKIE,raw,{maxAge:ctx.config.sessionDays*86400,secure:ctx.config.secureCookies});
 ctx.session={id,user_id:userId,csrf};
 return {id,csrf};
}

/** Resolves the session cookie. Expired or revoked sessions are ignored. */
export function loadSession(ctx){
 const raw=parseCookies(ctx.request)[SESSION_COOKIE];
 if(!raw||raw.length>100)return;
 const row=ctx.db.query(`SELECT s.id,s.user_id,s.csrf,s.expires,s.last_seen,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL`).get(sha256(raw));
 if(!row||row.expires<Date.now()||row.status!=='active'){ctx.clearCookie=true;return;}
 ctx.session=row;ctx.user=ctx.db.query('SELECT * FROM users WHERE id=?').get(row.user_id);
 if(Date.now()-Date.parse(row.last_seen)>300000)ctx.db.query('UPDATE sessions SET last_seen=? WHERE id=?').run(nowIso(),row.id);
}

export function requireUser(ctx){if(!ctx.user)fail(401,'UNAUTHENTICATED');return ctx.user;}
export function checkCsrf(ctx){
 if(!ctx.session)return;
 const sent=ctx.request.headers.get('x-csrf-token')||'';
 if(sent.length!==ctx.session.csrf.length||sha256(sent)!==sha256(ctx.session.csrf))fail(403,'CSRF');
}

function makeRecoveryCodes(db,userId){
 db.query('DELETE FROM recovery_codes WHERE user_id=?').run(userId);
 const codes=[];
 for(let i=0;i<8;i++){const c=token(9).replace(/[-_]/g,'x').slice(0,12).toUpperCase();const code=c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8,12);codes.push(code);db.query('INSERT INTO recovery_codes(user_id,code_hash) VALUES(?,?)').run(userId,sha256(code));}
 return codes;
}

export function publicUser(u){return u&&{id:u.id,login:u.login,displayName:u.display_name,email:u.email||'',emailVerified:!!u.email_verified,role:u.role,personId:u.person_id,language:u.language,leaderboardOptIn:!!u.leaderboard_opt_in,emailMessages:!!u.email_messages,emailReminders:!!u.email_reminders};}

function validPassword(p){if(typeof p!=='string'||p.length<10||p.length>200)fail(400,'WEAK_PASSWORD');return p;}
function validLogin(l){const v=typeof l==='string'?l.trim().toLowerCase():'';if(!LOGIN_RE.test(v))fail(400,'INVALID_FIELDS',{field:'login'});return v;}

export async function register(ctx){
 const body=await readJson(ctx.request);
 rateLimit(ctx.db,'register-ip:'+ctx.ip,30,3600);
 const r=await createAccount(ctx,body);
 return json({user:publicUser(ctx.user),csrf:r.csrf,recoveryCodes:r.recoveryCodes},201);
}
/**
 * A new account with a password, signed in at once. `body` is what the sign-up form sent (login, password, displayName,
 * email, language, appearance). `inside(userId,now)` runs in the same transaction, so a profile made with the account
 * (server/network.mjs) never exists without it, nor the account without the profile.
 */
export async function createAccount(ctx,body,{inside}={}){
 const login=validLogin(body.login),password=validPassword(body.password);
 const displayName=text(body.displayName,{min:1,max:80},'displayName');
 const email=text(body.email,{max:200,optional:true},'email');
 if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))fail(400,'INVALID_FIELDS',{field:'email'});
 const language=LANGUAGES.includes(body.language)?body.language:'en';
 const appearance=body.appearance?oneOf(body.appearance,APPEARANCES,'appearance'):'';
 if(ctx.db.query('SELECT 1 FROM users WHERE login=?').get(login))fail(409,'LOGIN_TAKEN');
 const hash=await hashPassword(password);
 const now=nowIso(),userId=newId('usr'),personId=newId('visitor');
 let codes;
 try{
  ctx.db.transaction(()=>{
   ctx.db.query('INSERT INTO people(id,display_name,kind,source,appearance,created,updated) VALUES(?,?,?,?,?,?,?)').run(personId,displayName,'visitor','user',appearance,now,now);
   ctx.db.query('INSERT INTO users(id,login,display_name,email,role,person_id,language,created,updated) VALUES(?,?,?,?,?,?,?,?,?)').run(userId,login,displayName,email||null,'member',personId,language,now,now);
   ctx.db.query('INSERT INTO password_credentials(user_id,hash,updated) VALUES(?,?,?)').run(userId,hash,now);
   codes=makeRecoveryCodes(ctx.db,userId);
   audit(ctx.db,userId,'user.register','user',userId,{});
   inside?.(userId,now);
  })();
 }catch(e){if(String(e.message).includes('UNIQUE'))fail(409,'LOGIN_TAKEN');throw e;}
 const session=createSession(ctx,userId);
 ctx.user=ctx.db.query('SELECT * FROM users WHERE id=?').get(userId);
 ctx.hooks?.onUserReady?.(ctx,ctx.user);
 return {userId,csrf:session.csrf,recoveryCodes:codes};
}

export async function login(ctx){
 const body=await readJson(ctx.request);
 const loginName=typeof body.login==='string'?body.login.trim().toLowerCase().slice(0,60):'';
 const password=typeof body.password==='string'?body.password.slice(0,200):'';
 // A loose per-address limit protects the server; the per-account limit protects the account.
 rateLimit(ctx.db,'login-ip:'+ctx.ip,300,900);
 rateLimit(ctx.db,'login-account:'+loginName,10,900);
 const user=ctx.db.query('SELECT u.*,p.hash FROM users u JOIN password_credentials p ON p.user_id=u.id WHERE u.login=?').get(loginName);
 dummyHash??=await hashPassword('dummy-password-for-timing');
 const ok=await verifyPassword(password||'x',user?.hash||dummyHash);
 if(!user||!ok||user.status!=='active')fail(401,'INVALID_LOGIN');
 // Rotation: a fresh session id on every login; the previous cookie stops working.
 if(ctx.session)ctx.db.query('UPDATE sessions SET revoked_at=? WHERE id=?').run(nowIso(),ctx.session.id);
 const session=createSession(ctx,user.id);
 ctx.user=ctx.db.query('SELECT * FROM users WHERE id=?').get(user.id);
 return json({user:publicUser(ctx.user),csrf:session.csrf});
}

export function logout(ctx,all=false){
 requireUser(ctx);
 if(all)ctx.db.query('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(nowIso(),ctx.user.id);
 else ctx.db.query('UPDATE sessions SET revoked_at=? WHERE id=?').run(nowIso(),ctx.session.id);
 ctx.clearCookie=true;
 return json({ok:true});
}

export function listSessions(ctx){
 requireUser(ctx);
 const rows=ctx.db.query('SELECT id,device,created,last_seen,expires FROM sessions WHERE user_id=? AND revoked_at IS NULL AND expires>? ORDER BY last_seen DESC LIMIT 50').all(ctx.user.id,Date.now());
 return json({items:rows.map(r=>({id:r.id,device:r.device,created:r.created,lastSeen:r.last_seen,current:r.id===ctx.session.id}))});
}
export function revokeSession(ctx,id){
 requireUser(ctx);
 const r=ctx.db.query('UPDATE sessions SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL').run(nowIso(),id,ctx.user.id);
 if(!r.changes)fail(404,'NOT_FOUND');
 if(id===ctx.session.id)ctx.clearCookie=true;
 return json({ok:true});
}

export async function recover(ctx){
 const body=await readJson(ctx.request);
 const loginName=typeof body.login==='string'?body.login.trim().toLowerCase().slice(0,60):'';
 rateLimit(ctx.db,'recover-ip:'+ctx.ip,60,3600);rateLimit(ctx.db,'recover-account:'+loginName,5,3600);
 const code=typeof body.code==='string'?body.code.trim().toUpperCase().slice(0,20):'';
 const password=validPassword(body.newPassword);
 const user=ctx.db.query('SELECT * FROM users WHERE login=?').get(loginName);
 const row=user&&ctx.db.query('SELECT id FROM recovery_codes WHERE user_id=? AND code_hash=? AND used_at IS NULL').get(user.id,sha256(code));
 if(!row)fail(401,'INVALID_LOGIN');
 const hash=await hashPassword(password),now=nowIso();
 const used=ctx.db.transaction(()=>{
  const r=ctx.db.query('UPDATE recovery_codes SET used_at=? WHERE id=? AND used_at IS NULL').run(now,row.id);
  if(!r.changes)return false;
  ctx.db.query('UPDATE password_credentials SET hash=?,updated=? WHERE user_id=?').run(hash,now,user.id);
  ctx.db.query('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(now,user.id);
  audit(ctx.db,user.id,'user.recover','user',user.id,{});
  return true;
 })();
 if(!used)fail(401,'INVALID_LOGIN');
 const session=createSession(ctx,user.id);ctx.user=user;
 const left=ctx.db.query('SELECT count(*) n FROM recovery_codes WHERE user_id=? AND used_at IS NULL').get(user.id).n;
 return json({user:publicUser(user),csrf:session.csrf,recoveryCodesLeft:left});
}

// Forgot password ---------------------------------------------------------------------------
const RESET_MINUTES=30;
const RESET_LETTER={
 hr:{subject:'{brand}: nova lozinka',text:'Pozdrav, {name}!\n\nZatražena je nova lozinka za račun „{login}”. Otvorite poveznicu i postavite novu lozinku:\n{link}\n\nPoveznica vrijedi 30 minuta i može se iskoristiti samo jednom. Ako to niste bili vi, zanemarite ovu poruku: lozinka ostaje ista.'},
 en:{subject:'{brand}: reset your password',text:'Hello {name},\n\nSomeone asked for a new password for the account “{login}”. Open this link to set one:\n{link}\n\nThe link works for 30 minutes and only once. If it was not you, ignore this email: your password stays the same.'},
 ru:{subject:'{brand}: новый пароль',text:'Здравствуйте, {name}!\n\nДля аккаунта «{login}» запрошен новый пароль. Откройте ссылку и задайте его:\n{link}\n\nСсылка действует 30 минут и только один раз. Если это были не вы, просто проигнорируйте письмо: пароль останется прежним.'},
};
const escHtml=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function resetLetter(config,user,link){
 const l=RESET_LETTER[user.language]||RESET_LETTER.hr,brand=(config.workspace?.name||'BIRD').trim()||'BIRD',vars={brand,name:user.display_name,login:user.login,link};
 const fill=(t,html)=>t.replace(/\{(\w+)\}/g,(_,k)=>html?(k==='link'?`<a href="${escHtml(link)}">${escHtml(link)}</a>`:escHtml(vars[k])):vars[k]??'');
 return {to:user.email,subject:fill(l.subject),text:fill(l.text),html:l.text.split('\n\n').map(p=>'<p>'+fill(p,true).replace(/\n/g,'<br>')+'</p>').join('')};
}

/**
 * Forgot password: a single-use link by email. The answer is the same whether or not the account exists or has an
 * email, so nobody learns which logins are real. A demo workspace and its invented accounts never get a link.
 */
export async function requestReset(ctx){
 const body=await readJson(ctx.request);
 const name=typeof body.login==='string'?body.login.trim().toLowerCase().slice(0,200):'';
 rateLimit(ctx.db,'reset-ip:'+ctx.ip,20,3600);rateLimit(ctx.db,'reset-account:'+name,5,3600);
 const mail=mailEnabled(ctx.config)&&!isDemo(ctx.db);
 if(!mail||!name)return json({ok:true,mail});
 // A login first (logins may contain @); otherwise every account saved with that email gets its own link.
 const byLogin=ctx.db.query("SELECT * FROM users WHERE login=? AND status='active'").get(name);
 const users=byLogin?[byLogin]:ctx.db.query("SELECT * FROM users WHERE lower(email)=? AND status='active' LIMIT 5").all(name);
 const now=Date.now(),origin=selfOrigin(ctx.request,ctx.config);
 ctx.db.query('DELETE FROM password_resets WHERE expires<?').run(now-86400000);
 for(const u of users){
  if(!u.email||u.id.startsWith('demo-'))continue;
  // Three letters an hour per account, whichever name was typed; this limit is silent so it reveals nothing.
  if(ctx.db.query('SELECT count(*) n FROM password_resets WHERE user_id=? AND created>?').get(u.id,new Date(now-3600000).toISOString()).n>=3)continue;
  const raw=token(32);
  ctx.db.transaction(()=>{
   ctx.db.query('UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL').run(nowIso(),u.id);
   ctx.db.query('INSERT INTO password_resets(id,user_id,token_hash,email,expires,created) VALUES(?,?,?,?,?,?)').run(newId('pwr'),u.id,sha256(raw),u.email,now+RESET_MINUTES*60000,nowIso());
   audit(ctx.db,null,'user.reset_request','user',u.id,{});
  })();
  // Not awaited: the answer takes the same time whether or not a letter goes out.
  sendMail(ctx.config,resetLetter(ctx.config,u,`${origin}/#/account/reset?token=${raw}`));
 }
 return json({ok:true,mail});
}

/** The link from the letter: a new password, every other session ends, the address counts as verified, signed in. */
export async function confirmReset(ctx){
 const body=await readJson(ctx.request);
 rateLimit(ctx.db,'reset-confirm-ip:'+ctx.ip,30,3600);
 const raw=typeof body.token==='string'?body.token.trim().slice(0,100):'';
 const password=validPassword(body.newPassword);
 const row=raw&&ctx.db.query("SELECT r.id,r.user_id,r.email FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token_hash=? AND r.used_at IS NULL AND r.expires>? AND u.status='active'").get(sha256(raw),Date.now());
 if(!row)fail(400,'RESET_INVALID');
 const hash=await hashPassword(password),now=nowIso();
 const used=ctx.db.transaction(()=>{
  if(!ctx.db.query('UPDATE password_resets SET used_at=? WHERE id=? AND used_at IS NULL').run(now,row.id).changes)return false;
  ctx.db.query('UPDATE password_credentials SET hash=?,updated=? WHERE user_id=?').run(hash,now,row.user_id);
  // Every session of the account ends, and so does whoever was signed in on this browser.
  ctx.db.query('UPDATE sessions SET revoked_at=? WHERE (user_id=? OR id=?) AND revoked_at IS NULL').run(now,row.user_id,ctx.session?.id||'');
  ctx.db.query('UPDATE users SET email_verified=1,updated=? WHERE id=? AND email=?').run(now,row.user_id,row.email);
  audit(ctx.db,row.user_id,'user.password_reset','user',row.user_id,{});
  return true;
 })();
 if(!used)fail(400,'RESET_INVALID');
 const session=createSession(ctx,row.user_id);
 const user=ctx.user=ctx.db.query('SELECT * FROM users WHERE id=?').get(row.user_id);
 const left=ctx.db.query('SELECT count(*) n FROM recovery_codes WHERE user_id=? AND used_at IS NULL').get(user.id).n;
 return json({user:publicUser(user),csrf:session.csrf,recoveryCodesLeft:left});
}

export async function changePassword(ctx){
 requireUser(ctx);const body=await readJson(ctx.request);
 rateLimit(ctx.db,'password-account:'+ctx.user.id,10,900);
 const current=ctx.db.query('SELECT hash FROM password_credentials WHERE user_id=?').get(ctx.user.id);
 if(!(await verifyPassword(String(body.currentPassword||'').slice(0,200)||'x',current.hash)))fail(401,'INVALID_LOGIN');
 const hash=await hashPassword(validPassword(body.newPassword)),now=nowIso();
 ctx.db.query('UPDATE password_credentials SET hash=?,updated=? WHERE user_id=?').run(hash,now,ctx.user.id);
 ctx.db.query('UPDATE sessions SET revoked_at=? WHERE user_id=? AND id<>? AND revoked_at IS NULL').run(now,ctx.user.id,ctx.session.id);
 return json({ok:true});
}
/** One extra recovery code for an organiser to hand over in person. Existing codes keep working. */
export function addRecoveryCode(db,userId){
 const c=token(9).replace(/[-_]/g,'x').slice(0,12).toUpperCase(),code=c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8,12);
 db.query('INSERT INTO recovery_codes(user_id,code_hash) VALUES(?,?)').run(userId,sha256(code));
 return code;
}
export async function regenerateCodes(ctx){
 requireUser(ctx);const body=await readJson(ctx.request);
 const current=ctx.db.query('SELECT hash FROM password_credentials WHERE user_id=?').get(ctx.user.id);
 if(!(await verifyPassword(String(body.currentPassword||'').slice(0,200)||'x',current.hash)))fail(401,'INVALID_LOGIN');
 return json({recoveryCodes:ctx.db.transaction(()=>makeRecoveryCodes(ctx.db,ctx.user.id))()});
}

/** Rotates the current session after a privilege change. */
export function rotateSession(ctx){
 if(!ctx.session)return null;
 ctx.db.query('UPDATE sessions SET revoked_at=? WHERE id=?').run(nowIso(),ctx.session.id);
 return createSession(ctx,ctx.user.id).csrf;
}

/**
 * One-time owner invitation. Written only to a private 0600 file on the volume.
 * Never logged, never placed in a URL or in Git.
 */
export function ensureOwnerBootstrap(db,config,{force=false}={}){
 const done=db.query("SELECT value FROM settings WHERE key='bootstrap_completed'").get();
 const owner=db.query("SELECT 1 FROM users WHERE role='platform_owner'").get();
 if(done||owner)return {status:'completed'};
 const pending=db.query("SELECT id FROM invites WHERE kind='platform_owner' AND used_at IS NULL AND revoked_at IS NULL AND expires>?").get(Date.now());
 const file=join(config.privateDir,'bootstrap-owner.txt');
 if(pending&&existsSync(file)&&!force)return {status:'pending',file};
 const code='OWNER-'+token(24);const now=nowIso();
 db.transaction(()=>{
  db.query("UPDATE invites SET revoked_at=? WHERE kind='platform_owner' AND used_at IS NULL AND revoked_at IS NULL").run(now);
  db.query('INSERT INTO invites(id,code_hash,kind,role,expires,created) VALUES(?,?,?,?,?,?)').run(newId('inv'),sha256(code),'platform_owner','platform_owner',Date.now()+30*86400000,now);
 })();
 writeFileSync(file,`${config.workspace?.slug&&config.workspace.slug!=='bird'?config.workspace.name:'BIRD platform'} owner invitation (single use, valid 30 days)\n\nCode: ${code}\n\n1. Open the site, choose Sign in -> Create account (or sign in).\n2. Open My account -> Invitation and enter the code.\nThe code stops working after one use. Delete this file afterwards.\n`,{mode:0o600});
 chmodSync(file,0o600);
 return {status:'created',file};
}
