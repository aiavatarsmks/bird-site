/**
 * Hubvers network: public accounts with a profile (mentors today; investors next, same code with another `kind`),
 * a directory with filters and a map, connection requests, and deleting one's own account (GDPR).
 * Lives in the public (demo) workspace only, where hubvers.com is served.
 *
 * Who sees what:
 *  - anyone: a public card per profile (name, headline, categories, country), never contacts or the city;
 *  - signed-in accounts (a mentor, a startup, anyone): the whole profile, the map and the "Write" button;
 *  - a visitor of the public demo (an invented account, read-only) sees invented profiles only.
 * Email and phone are never part of any answer about another person.
 * Messages go through the existing messenger (server/messages.mjs), with its blocks and limits.
 */
import {readFileSync} from 'node:fs';
import {fail,json,readJson,text,int,rateLimit} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin} from './permissions.mjs';
import {requireUser,createAccount,passwordMatches,publicUser} from './auth.mjs';
import {isDemo,onlyDemoPeople} from './demo-visit.mjs';
import {COUNTRIES,CATEGORIES,LANGUAGES,OPEN_TO,INDUSTRIES,place} from './network-data.mjs';
import {STAGES,ROUNDS,STAGE_LABEL,ROUND_LABEL} from './stages.mjs';
import {validateInvestor,saveInvestor,investorOf,announceSignup} from './investors.mjs';

/**
 * What each kind of profile may hold. A new kind adds an entry here and to the CHECK of network_profiles.kind
 * (migration 29 allows 'mentor' and 'investor'); everything else is shared. `listed`: the kind appears in the public
 * cards, the directory and profile pages. Investors are not listed (yet): their fund and the owner's approval live in
 * investor_profiles (server/investors.mjs), and their headline is the fund's name.
 */
export const KINDS={
 mentor:{categories:Object.keys(CATEGORIES),maxCategories:5,openTo:OPEN_TO,hubs:true,maxAvailability:160,minLanguages:1,listed:true},
 investor:{categories:Object.keys(INDUSTRIES),maxCategories:8,openTo:[],hubs:false,maxAvailability:0,minLanguages:0,listed:false},
};
// Connection requests and first messages to strangers: per account and day.
export const DAILY_REQUESTS=20;

let hubsCache=null;
/** Hubs a mentor can name: the catalogue behind /hubs (public/hubs.json in a build, data/hubs.json in the repo). */
export function hubCatalogue(){
 if(hubsCache)return hubsCache;
 for(const p of ['../public/hubs.json','../data/hubs.json']){
  try{const d=JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));return hubsCache={regions:d.regions,hubs:d.hubs.map(h=>({id:h.id,name:h.name,country:h.country,city:h.city}))};}catch{}
 }
 return hubsCache={regions:[],hubs:[]};
}

const onlyHere=ctx=>{if(!isDemo(ctx.db))fail(404,'NOT_FOUND');};
const kindOf=k=>{if(!KINDS[k])fail(404,'NOT_FOUND');return k;};
const listedKind=k=>{if(!KINDS[k]?.listed)fail(404,'NOT_FOUND');return k;};
const list=v=>{try{const a=JSON.parse(v||'[]');return Array.isArray(a)?a:[];}catch{return [];}};
function keys(value,allowed,{min=0,max=20}={},field){
 if(value==null)value=[];
 if(!Array.isArray(value))fail(400,'INVALID_FIELDS',{field});
 const out=[...new Set(value.map(String))];
 if(out.length<min||out.length>max||out.some(v=>!allowed.includes(v)))fail(400,'INVALID_FIELDS',{field});
 return out;
}
const LINKEDIN=/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|pub|company)\/[^\s?#]{2,100}\/?$/i;

/** Checks a profile sent by the form; returns the row to store. Region follows the country. */
export function validateProfile(kind,b){
 const spec=KINDS[kindOf(kind)];
 if(!b||typeof b!=='object'||Array.isArray(b))fail(400,'INVALID_FIELDS',{field:'profile'});
 // An investor's headline is the fund's name (checked as the fund field).
 if(kind==='investor')b={...b,headline:text(b.fund,{min:2,max:120},'fund')};
 const country=String(b.country||'');if(!COUNTRIES[country])fail(400,'INVALID_FIELDS',{field:'country'});
 let linkedin=text(b.linkedin,{optional:true,max:200},'linkedin');
 if(linkedin&&!/^https?:\/\//i.test(linkedin))linkedin='https://'+linkedin;
 if(linkedin&&!LINKEDIN.test(linkedin.replace(/^http:/i,'https:')))fail(400,'INVALID_FIELDS',{field:'linkedin'});
 return {
  headline:text(b.headline,{min:2,max:120},'headline'),
  bio:text(b.bio,{optional:true,max:1500,multiline:true},'bio'),
  country,region:COUNTRIES[country][0],
  city:text(b.city,{min:1,max:80},'city'),
  categories:keys(b.categories,spec.categories,{min:1,max:spec.maxCategories},'categories'),
  hubs:spec.hubs?keys(b.hubs,hubCatalogue().hubs.map(h=>h.id),{max:10},'hubs'):[],
  languages:keys(b.languages,Object.keys(LANGUAGES),{min:spec.minLanguages,max:8},'languages'),
  openTo:keys(b.openTo,spec.openTo,{max:spec.openTo.length},'openTo'),
  linkedin:linkedin.replace(/^http:/i,'https:'),
  availability:int(b.availability??0,{min:0,max:spec.maxAvailability},'availability'),
 };
}
function saveProfile(db,userId,kind,p,now,demo=0){
 db.query(`INSERT INTO network_profiles(user_id,kind,headline,bio,country,city,region,categories,hubs,languages,open_to,linkedin,availability,demo,created,updated)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET headline=excluded.headline,bio=excluded.bio,country=excluded.country,city=excluded.city,region=excluded.region,
  categories=excluded.categories,hubs=excluded.hubs,languages=excluded.languages,open_to=excluded.open_to,linkedin=excluded.linkedin,availability=excluded.availability,updated=excluded.updated`)
  .run(userId,kind,p.headline,p.bio,p.country,p.city,p.region,JSON.stringify(p.categories),JSON.stringify(p.hubs),JSON.stringify(p.languages),JSON.stringify(p.openTo),p.linkedin,p.availability,demo,now,now);
}
export {saveProfile};

// Views ----------------------------------------------------------------------------------------------------
const ROW=`SELECT n.*,u.display_name name,EXISTS(SELECT 1 FROM user_avatars a WHERE a.user_id=n.user_id) photo FROM network_profiles n JOIN users u ON u.id=n.user_id AND u.status='active'`;
/** The card anyone may see. */
const card=r=>({id:r.user_id,kind:r.kind,name:r.name,headline:r.headline,categories:list(r.categories),country:r.country,demo:!!r.demo});
function connection(db,me,other){
 if(!me||me===other)return 'none';
 const out=db.query('SELECT status FROM network_connections WHERE from_id=? AND to_id=?').get(me,other)?.status;
 const inc=db.query('SELECT status FROM network_connections WHERE from_id=? AND to_id=?').get(other,me)?.status;
 if(out==='accepted'||inc==='accepted')return 'accepted';
 if(out==='pending')return 'outgoing';
 if(inc==='pending')return 'incoming';
 if(out==='declined')return 'declined';
 return 'none';
}
/** The whole profile, for a signed-in viewer. Still no email or phone. */
function full(db,r,viewer){
 const p=place(r.country,r.city);
 return {...card(r),city:r.city,region:r.region,bio:r.bio,hubs:list(r.hubs),languages:list(r.languages),openTo:list(r.open_to),linkedin:r.linkedin,availability:r.availability,
  photo:!!r.photo,place:p?.key||'',me:r.user_id===viewer,connection:connection(db,viewer,r.user_id)};
}
// A visitor of the public demo borrows an invented account and must not see the real people.
// Kinds that are not listed (investors) are never shown to others.
const visible=(ctx,rows)=>rows.filter(r=>KINDS[r.kind]?.listed&&(!onlyDemoPeople(ctx)||r.user_id.startsWith('demo-')));

/** Lists, names and hubs for the forms and filters; public. */
export function meta(ctx){
 onlyHere(ctx);
 const c=hubCatalogue();
 return json({kinds:Object.keys(KINDS),categories:CATEGORIES,industries:INDUSTRIES,stages:STAGES.map(k=>({id:k,name:STAGE_LABEL[k]})),rounds:ROUNDS.map(k=>({id:k,name:ROUND_LABEL[k]})),openTo:OPEN_TO,languages:LANGUAGES,regions:c.regions,hubs:c.hubs,
  countries:Object.fromEntries(Object.entries(COUNTRIES).map(([k,[region,name]])=>[k,{region,name}])),dailyRequests:DAILY_REQUESTS},200,{'Cache-Control':'no-cache'});
}

/** Public cards of one kind, newest first; no sign-in needed. */
export function cards(ctx,kind){
 onlyHere(ctx);listedKind(kind);
 const rows=visible(ctx,ctx.db.query(ROW+' WHERE n.kind=? ORDER BY n.demo,n.updated DESC LIMIT 60').all(kind));
 return json({items:rows.map(card),total:ctx.db.query("SELECT count(*) n FROM network_profiles n JOIN users u ON u.id=n.user_id AND u.status='active' WHERE n.kind=?").get(kind).n});
}

/**
 * The directory for signed-in accounts, filtered: category (comma list, any of them), region, country, hub, lang, q (name
 * or headline). Also the map: one place per city with how many profiles sit there.
 */
export function directory(ctx,kind){
 onlyHere(ctx);listedKind(kind);const user=requireUser(ctx),s=ctx.url.searchParams;
 const cats=(s.get('category')||'').split(',').filter(Boolean).slice(0,20),region=s.get('region')||'',country=s.get('country')||'',hub=s.get('hub')||'',lang=s.get('lang')||'';
 const fold=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 const q=fold((s.get('q')||'').trim().slice(0,60));
 const rows=visible(ctx,ctx.db.query(ROW+' WHERE n.kind=? ORDER BY n.demo,u.display_name COLLATE NOCASE LIMIT 2000').all(kind)).filter(r=>
  (!cats.length||list(r.categories).some(c=>cats.includes(c)))&&(!region||r.region===region)&&(!country||r.country===country)
  &&(!hub||list(r.hubs).includes(hub))&&(!lang||list(r.languages).includes(lang))&&(!q||fold(r.name+' '+r.headline).includes(q)));
 const items=rows.map(r=>full(ctx.db,r,user.id)),places=new Map();
 for(const r of rows){const p=place(r.country,r.city);if(!p)continue;const at=places.get(p.key)||{key:p.key,name:p.name,country:r.country,lat:p.lat,lon:p.lon,count:0};at.count++;places.set(p.key,at);}
 return json({items,places:[...places.values()].sort((a,b)=>b.count-a.count)});
}

/** One profile, for a signed-in viewer. */
export function profile(ctx,id){
 onlyHere(ctx);const user=requireUser(ctx);
 const r=visible(ctx,[ctx.db.query(ROW+' WHERE n.user_id=?').get(String(id))].filter(Boolean))[0];
 if(!r)fail(404,'NOT_FOUND');
 const blocked=!!ctx.db.query('SELECT 1 FROM message_blocks WHERE (user_id=?1 AND blocked_id=?2) OR (user_id=?2 AND blocked_id=?1)').get(user.id,r.user_id);
 const hubs=hubCatalogue().hubs;
 return json({profile:{...full(ctx.db,r,user.id),hubNames:list(r.hubs).map(h=>hubs.find(x=>x.id===h)).filter(Boolean)},canWrite:!blocked&&r.user_id!==user.id,canConnect:!!myProfile(ctx.db,user.id)&&r.user_id!==user.id&&!blocked});
}
/** The photo of a profile: signed-in viewers only, like the rest of the profile. */
export function photo(ctx,id){
 onlyHere(ctx);requireUser(ctx);
 if(onlyDemoPeople(ctx)&&!String(id).startsWith('demo-'))fail(404,'NOT_FOUND');
 const row=ctx.db.query('SELECT a.mime,a.bytes FROM user_avatars a JOIN network_profiles n ON n.user_id=a.user_id JOIN users u ON u.id=a.user_id AND u.status=\'active\' WHERE a.user_id=?').get(String(id));
 if(!row)fail(404,'NOT_FOUND');
 return new Response(row.bytes,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}

// Own account ------------------------------------------------------------------------------------------------
const myProfile=(db,userId)=>db.query(ROW+' WHERE n.user_id=?').get(userId);
const people=(db,sql,...args)=>db.query(`SELECT u.id,u.display_name name,n.headline,n.kind,n.country,n.categories FROM users u LEFT JOIN network_profiles n ON n.user_id=u.id WHERE u.status='active' AND u.id IN (${sql})`).all(...args)
 .map(r=>({id:r.id,name:r.name,headline:r.headline||'',kind:r.kind||'',country:r.country||'',categories:list(r.categories),profile:!!r.kind}));

/**
 * New account from the public site, signed in at once. kind: a profile kind (mentor) or 'member' for an account without
 * a profile (a startup that wants to write to mentors). The profile is checked before the account is made.
 */
export async function signup(ctx,kind){
 onlyHere(ctx);
 if(kind!=='member')kindOf(kind);
 let body=await readJson(ctx.request);
 rateLimit(ctx.db,'register-ip:'+ctx.ip,30,3600);
 if(body.consent!==true)fail(400,'INVALID_FIELDS',{field:'consent'});
 // Invented rows of the demo are found by their "demo-" names; a real login must never look like one.
 if(/^demo/i.test(String(body.login||'').trim()))fail(400,'INVALID_FIELDS',{field:'login'});
 const p=kind==='member'?null:validateProfile(kind,body.profile);
 // An investor needs a work email on the fund's domain; the owner approves the fund afterwards (server/investors.mjs).
 const inv=kind==='investor'?validateInvestor(body.profile,body.email,hubCatalogue().regions.map(r=>r.id)):null;
 if(inv)body={...body,email:String(body.email).trim().toLowerCase()};
 const r=await createAccount(ctx,body,{inside:(userId,now)=>{if(p)saveProfile(ctx.db,userId,kind,p,now);if(inv)saveInvestor(ctx.db,userId,inv,now);}});
 if(inv)announceSignup(ctx.db,ctx.user.display_name,inv.fund);
 return json({user:publicUser(ctx.user),csrf:r.csrf,recoveryCodes:r.recoveryCodes},201);
}

/** The cabinet: my account, my profile (if any), my connections and the requests waiting for me. */
export function mine(ctx){
 onlyHere(ctx);const user=requireUser(ctx),r=myProfile(ctx.db,user.id);
 const db=ctx.db;
 return json({
  user:{id:user.id,name:user.display_name,login:user.login,language:user.language,admin:isAdmin(user),demo:user.id.startsWith('demo-')},
  profile:r?full(db,r,user.id):null,
  investor:r?.kind==='investor'?investorOf(db,user.id):null,
  connections:people(db,"SELECT to_id FROM network_connections WHERE from_id=?1 AND status='accepted' UNION SELECT from_id FROM network_connections WHERE to_id=?1 AND status='accepted'",user.id),
  incoming:people(db,"SELECT from_id FROM network_connections WHERE to_id=? AND status='pending'",user.id),
  outgoing:people(db,"SELECT to_id FROM network_connections WHERE from_id=? AND status='pending'",user.id),
 });
}

/** Creates or edits my profile; the name is the account's display name. One profile per account. */
export async function saveMine(ctx,kind){
 onlyHere(ctx);kindOf(kind);const user=requireUser(ctx);
 const body=await readJson(ctx.request);
 const old=ctx.db.query('SELECT kind FROM network_profiles WHERE user_id=?').get(user.id);
 if(old&&old.kind!==kind)fail(409,'INVALID_STATE');
 const p=validateProfile(kind,body.profile);
 const inv=kind==='investor'?validateInvestor(body.profile,user.email,hubCatalogue().regions.map(r=>r.id)):null;
 const name=body.displayName==null?user.display_name:text(body.displayName,{min:1,max:80},'displayName');
 const now=nowIso();
 let status=null;
 ctx.db.transaction(()=>{
  saveProfile(ctx.db,user.id,kind,p,now);
  if(inv)status=saveInvestor(ctx.db,user.id,inv,now);
  if(name!==user.display_name){
   ctx.db.query('UPDATE users SET display_name=?,updated=? WHERE id=?').run(name,now,user.id);
   if(user.person_id)ctx.db.query('UPDATE people SET display_name=?,updated=? WHERE id=?').run(name,now,user.person_id);
  }
  audit(ctx.db,user.id,old?'network.profile_update':'network.profile_create','user',user.id,{kind});
 })();
 return json({ok:true,...(inv?{status}:{})});
}

/**
 * Deletes my account (GDPR): the profile, connections, photo, private messages I sent or received, blocks, sessions and
 * password. The account row stays (other records point to it) as a disabled, nameless shell. Organisers of the
 * workspace are refused, so the workspace never loses its last admin this way.
 */
export async function deleteMine(ctx){
 onlyHere(ctx);const user=requireUser(ctx);
 const body=await readJson(ctx.request);
 rateLimit(ctx.db,'net-delete:'+user.id,10,3600);
 if(isAdmin(user))fail(409,'INVALID_STATE');
 if(!(await passwordMatches(ctx.db,user.id,body.password)))fail(401,'INVALID_LOGIN');
 const now=nowIso(),db=ctx.db,id=user.id;
 db.transaction(()=>{
  db.query('DELETE FROM network_profiles WHERE user_id=?').run(id);
  db.query('DELETE FROM investor_profiles WHERE user_id=?').run(id);
  db.query('DELETE FROM network_connections WHERE from_id=?1 OR to_id=?1').run(id);
  db.query('DELETE FROM user_avatars WHERE user_id=?').run(id);
  db.query('DELETE FROM message_reports WHERE message_id IN (SELECT id FROM direct_messages WHERE sender_id=?1 OR recipient_id=?1)').run(id);
  db.query('DELETE FROM direct_messages WHERE sender_id=?1 OR recipient_id=?1').run(id);
  db.query('DELETE FROM waiting_messages WHERE sender_id=?').run(id);
  db.query('DELETE FROM message_blocks WHERE user_id=?1 OR blocked_id=?1').run(id);
  db.query('UPDATE chat_members SET left_at=? WHERE user_id=? AND left_at IS NULL').run(now,id);
  db.query('DELETE FROM sessions WHERE user_id=?').run(id);
  db.query('DELETE FROM password_credentials WHERE user_id=?').run(id);
  db.query('DELETE FROM recovery_codes WHERE user_id=?').run(id);
  db.query('DELETE FROM password_resets WHERE user_id=?').run(id);
  db.query("UPDATE users SET status='disabled',login=?,display_name='—',email=NULL,email_verified=0,updated=? WHERE id=?").run('deleted-'+id,now,id);
  if(user.person_id)db.query("UPDATE people SET display_name='—',status='archived',updated=? WHERE id=?").run(now,user.person_id);
  audit(db,id,'user.delete','user',id,{});
 })();
 ctx.clearCookie=true;ctx.session=null;
 return json({ok:true});
}

// Connections ------------------------------------------------------------------------------------------------
const blockedEither=(db,a,b)=>!!db.query('SELECT 1 FROM message_blocks WHERE (user_id=?1 AND blocked_id=?2) OR (user_id=?2 AND blocked_id=?1)').get(a,b);
/** Asks another profile to connect. Both sides need a profile; asking someone who already asked me accepts it. */
export function requestConnection(ctx,otherId){
 onlyHere(ctx);const user=requireUser(ctx);
 const other=visible(ctx,[ctx.db.query(ROW+' WHERE n.user_id=?').get(String(otherId))].filter(Boolean))[0];
 if(!other||other.user_id===user.id)fail(404,'NOT_FOUND');
 if(!myProfile(ctx.db,user.id))fail(403,'FORBIDDEN');
 if(blockedEither(ctx.db,user.id,other.user_id))fail(403,'FORBIDDEN');
 const state=connection(ctx.db,user.id,other.user_id),now=nowIso();
 if(state==='accepted'||state==='outgoing')return json({connection:state});
 if(state==='declined')fail(409,'INVALID_STATE');
 if(state==='incoming'){ctx.db.query("UPDATE network_connections SET status='accepted',decided=? WHERE from_id=? AND to_id=?").run(now,other.user_id,user.id);return json({connection:'accepted'});}
 rateLimit(ctx.db,'net-connect:'+user.id,DAILY_REQUESTS,86400);
 ctx.db.query("INSERT INTO network_connections(from_id,to_id,status,created) VALUES(?,?,'pending',?) ON CONFLICT(from_id,to_id) DO UPDATE SET status='pending',created=excluded.created,decided=NULL").run(user.id,other.user_id,now);
 audit(ctx.db,user.id,'network.connect','user',other.user_id,{});
 return json({connection:'outgoing'},201);
}
/** Accepts or declines a request someone sent me. */
export async function decideConnection(ctx,otherId){
 onlyHere(ctx);const user=requireUser(ctx),body=await readJson(ctx.request);
 if(typeof body.accept!=='boolean')fail(400,'INVALID_FIELDS',{field:'accept'});
 const r=ctx.db.query("UPDATE network_connections SET status=?,decided=? WHERE from_id=? AND to_id=? AND status='pending'").run(body.accept?'accepted':'declined',nowIso(),String(otherId),user.id);
 if(!r.changes)fail(404,'NOT_FOUND');
 return json({connection:body.accept?'accepted':'none'});
}
/** Withdraws my request or ends a connection, whichever side started it. A declined request stays declined. */
export function removeConnection(ctx,otherId){
 onlyHere(ctx);const user=requireUser(ctx);
 const r=ctx.db.query("DELETE FROM network_connections WHERE ((from_id=?1 AND to_id=?2 AND status IN ('pending','accepted')) OR (from_id=?2 AND to_id=?1 AND status='accepted'))").run(user.id,String(otherId));
 if(!r.changes)fail(404,'NOT_FOUND');
 return json({connection:'none'});
}
/** True when two accounts are connected; the messenger lets them write without the stranger limit. */
export const connected=(db,a,b)=>!!db.query("SELECT 1 FROM network_connections WHERE status='accepted' AND ((from_id=?1 AND to_id=?2) OR (from_id=?2 AND to_id=?1))").get(a,b);
