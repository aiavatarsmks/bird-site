/**
 * Hubvers investors: an investor is a network account (server/network.mjs, kind 'investor') with a fund beside it
 * (investor_profiles, migration 30). The account lives in the public (demo) workspace, like the mentors.
 *
 *  - Sign-up needs a work email on the fund's own domain: not a free mail provider, and the same domain as the fund's
 *    website (or a subdomain of it). The platform owner approves every investor by hand; until then the investor can edit
 *    the profile and sees no startups.
 *  - An approved investor sees projects of every workspace of the platform that are published and whose team switched
 *    "visible to investors" on (projects.investor_visible, migration 28). The investor reads other workspaces through
 *    ctx.workspaces() (server/tenancy.mjs), read-only, and only these columns: the published text, stage and funding.
 *    Team members, their accounts, emails and phones are never read.
 *  - "Express interest": inside the investor's own workspace it becomes a message to the team (the messenger); in
 *    another workspace there is no shared account, so it is stored there (investor_interest) for its organisers, who
 *    decide whether to reply. Both cases leave a row in the project's workspace, so asking twice is answered from it.
 *  - A visitor of the public demo who looks around as the invented investor sees the invented projects only.
 */
import {fail,json,readJson,text,newId,rateLimit} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,requireAdmin,requireOwner} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {notify} from './notifications.mjs';
import {isDemo,isDemoUser,onlyDemoPeople} from './demo-visit.mjs';
import {STAGES,ROUNDS,stageOf,cleanEur} from './stages.mjs';
import {COUNTRIES,isFreeMail,place} from './network-data.mjs';

// Interest from one investor: a few a day is plenty; a script may not fill every team's inbox.
export const DAILY_INTEREST=20;
const list=v=>{try{const a=JSON.parse(v||'[]');return Array.isArray(a)?a:[];}catch{return [];}};
function keys(value,allowed,{min=0,max=20}={},field){
 if(value==null)value=[];
 if(!Array.isArray(value))fail(400,'INVALID_FIELDS',{field});
 const out=[...new Set(value.map(String))];
 if(out.length<min||out.length>max||out.some(v=>!allowed.includes(v)))fail(400,'INVALID_FIELDS',{field});
 return out;
}
// Second-level public suffixes: "co.uk" is nobody's fund, so a website there would match every .co.uk address.
const SUFFIX=/^(?:co|com|org|net|ac|gov|edu|or|ne)\.[a-z]{2}$/;
const DOMAIN=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
/** The host of a fund's website without "www.", or a 400 on the website field. */
export function websiteHost(value){
 let site=text(value,{min:4,max:200},'website');
 if(!/^https?:\/\//i.test(site))site='https://'+site;
 let u;try{u=new URL(site);}catch{fail(400,'INVALID_FIELDS',{field:'website'});}
 const host=u.hostname.toLowerCase().replace(/^www\./,'');
 if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port||!DOMAIN.test(host)||SUFFIX.test(host)||isFreeMail(host))fail(400,'INVALID_FIELDS',{field:'website'});
 return {host,url:'https://'+u.hostname.toLowerCase()+(u.pathname==='/'?'':u.pathname.replace(/\/$/,''))};
}
/**
 * The work email against the website: not free mail, and the same domain (either may be a subdomain of the other:
 * name@eu.fund.com with fund.com, or name@fund.com with invest.fund.com). Returns the email's domain.
 */
export function workDomain(email,host){
 const m=/^[^@\s]+@([a-z0-9.-]+)$/.exec(String(email||'').trim().toLowerCase());
 if(!m||!DOMAIN.test(m[1]))fail(400,'INVALID_FIELDS',{field:'email'});
 const d=m[1];
 if(isFreeMail(d))fail(400,'INVALID_FIELDS',{field:'email',reason:'free_mail'});
 if(!(d===host||d.endsWith('.'+host)||host.endsWith('.'+d)))fail(400,'INVALID_FIELDS',{field:'email',reason:'domain_mismatch'});
 return d;
}
/** The fund part of an investor's form. `regions`: region ids of the hub catalogue (an area is a region or a country). */
export function validateInvestor(b,email,regions=[]){
 if(!b||typeof b!=='object'||Array.isArray(b))fail(400,'INVALID_FIELDS',{field:'profile'});
 const fund=text(b.fund,{min:2,max:120},'fund');
 const site=websiteHost(b.website);
 const domain=workDomain(email,site.host);
 const ticketMin=cleanEur(b.ticketMin,'ticketMin'),ticketMax=cleanEur(b.ticketMax,'ticketMax');
 if(ticketMin!==null&&ticketMax!==null&&ticketMin>ticketMax)fail(400,'INVALID_FIELDS',{field:'ticketMax'});
 return {fund,website:site.url,domain,ticketMin,ticketMax,
  stages:keys(b.stages,STAGES,{min:1,max:STAGES.length},'stages'),
  areas:keys(b.areas,[...regions,...Object.keys(COUNTRIES)],{max:20},'areas')};
}
/**
 * Stores the fund. A new investor waits for the owner; an approved one who changes the fund or its website waits again,
 * because that is what the owner checked.
 */
export function saveInvestor(db,userId,v,now,{status='pending'}={}){
 const old=db.query('SELECT fund,website,status FROM investor_profiles WHERE user_id=?').get(userId);
 const next=!old?status:old.status==='approved'&&(old.fund!==v.fund||old.website!==v.website)?'pending':old.status;
 db.query(`INSERT INTO investor_profiles(user_id,fund,website,email_domain,ticket_min,ticket_max,stages,areas,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(user_id) DO UPDATE SET fund=excluded.fund,website=excluded.website,email_domain=excluded.email_domain,ticket_min=excluded.ticket_min,ticket_max=excluded.ticket_max,
  stages=excluded.stages,areas=excluded.areas,status=?,updated=excluded.updated`)
  .run(userId,v.fund,v.website,v.domain,v.ticketMin,v.ticketMax,JSON.stringify(v.stages),JSON.stringify(v.areas),next,now,now,next);
 if(old&&next!==old.status)db.query('UPDATE investor_profiles SET decided_by=NULL,decided_at=NULL WHERE user_id=?').run(userId);
 return next;
}
const view=r=>r&&{fund:r.fund,website:r.website,domain:r.email_domain,ticketMin:r.ticket_min,ticketMax:r.ticket_max,stages:list(r.stages),areas:list(r.areas),status:r.status,decidedAt:r.decided_at||null};
export const investorOf=(db,userId)=>view(db.query('SELECT * FROM investor_profiles WHERE user_id=?').get(userId));

/** Tells the platform owner that an investor waits (Admin → Settings). */
export function announceSignup(db,name,fund){
 for(const o of db.query("SELECT id FROM users WHERE role='platform_owner' AND status='active' AND id NOT LIKE 'demo-%'").all())notify(db,o.id,'investor.signup',{name,fund});
}

// The dashboard ---------------------------------------------------------------------------------------------------------
const onlyHere=ctx=>{if(!isDemo(ctx.db))fail(404,'NOT_FOUND');};
function requireInvestor(ctx){
 onlyHere(ctx);const user=requireUser(ctx);
 const r=ctx.db.query('SELECT status FROM investor_profiles WHERE user_id=?').get(user.id);
 if(!r)fail(403,'NOT_INVESTOR');
 if(r.status!=='approved')fail(403,'INVESTOR_PENDING');
 return user;
}
// Only what a team agreed to show: the published text, the stage and the funding columns. Nothing about its people.
const VISIBLE="SELECT id,published,published_at,raised_eur,raising_eur,funding_round FROM projects WHERE status='published' AND investor_visible=1 AND published IS NOT NULL";
const hubOf=w=>{const country=COUNTRIES[w.country]?w.country:'';const p=country?place(country,w.city||COUNTRIES[country][1].en):null;
 return {id:w.id,name:w.name,city:w.city||'',country,region:country?COUNTRIES[country][0]:'',lat:p?.lat??null,lon:p?.lon??null};};
/** The workspaces this viewer may read: all of them, or only its own for a visitor of the public demo. */
const readable=ctx=>ctx.workspaces().filter(w=>w.self||!onlyDemoPeople(ctx));
function card(w,hub,p,{full=false}={}){
 let c={};try{c=JSON.parse(p.published)||{};}catch{}
 const out={id:p.id,hub:hub.id,hubName:hub.name,city:hub.city,country:hub.country,region:hub.region,name:String(c.name||''),short:String(c.short||''),stage:stageOf(c.stage),
  raisedEur:p.raised_eur??null,raisingEur:p.raising_eur??null,round:p.funding_round||null,publishedAt:p.published_at||'',demo:p.id.startsWith('demo-'),same:!!w.self};
 if(full){for(const k of ['problem','users','solution','value','ask','nextSteps','details'])out[k]=String(c[k]||'');out.links=(Array.isArray(c.links)?c.links:[]).filter(l=>/^https?:\/\//i.test(l?.url||'')).map(l=>({label:String(l.label||''),url:String(l.url)}));}
 return out;
}
function collect(ctx){
 const out=[],demoOnly=onlyDemoPeople(ctx);
 for(const w of readable(ctx)){
  const hub=hubOf(w);
  try{for(const p of w.db.query(VISIBLE+' ORDER BY published_at DESC LIMIT 500').all())if(!demoOnly||p.id.startsWith('demo-'))out.push(card(w,hub,p));}
  catch{/* a workspace that cannot answer is left out, not the whole list */}
 }
 return out;
}

/** Filter from the query string; bad values are ignored, like the team filter of the admin. */
export function investorFilter(s){
 const many=(k,allowed)=>[...new Set(String(s.get(k)||'').split(',').map(v=>v.trim()).filter(v=>allowed.includes(v)))];
 const num=k=>{const v=String(s.get(k)??'').trim();return /^\d{1,10}$/.test(v)?Number(v):null;};
 const one=k=>String(s.get(k)||'').slice(0,40);
 return {stages:many('stage',STAGES),rounds:many('round',ROUNDS),raisingMin:num('raisingMin'),raisingMax:num('raisingMax'),raisedMin:num('raisedMin'),raisedMax:num('raisedMax'),
  country:one('country'),region:one('region'),hub:one('hub'),sort:['newest','stage','raising'].includes(s.get('sort'))?s.get('sort'):'newest'};
}
// A range leaves out a project that did not say the amount: unknown is not zero.
const inRange=(v,min,max)=>min===null&&max===null?true:v!==null&&(min===null||v>=min)&&(max===null||v<=max);
export const matchesInvestor=(p,f)=>(!f.stages.length||f.stages.includes(p.stage))&&(!f.rounds.length||f.rounds.includes(p.round))
 &&inRange(p.raisingEur,f.raisingMin,f.raisingMax)&&inRange(p.raisedEur,f.raisedMin,f.raisedMax)
 &&(!f.country||p.country===f.country)&&(!f.region||p.region===f.region)&&(!f.hub||p.hub===f.hub);
const SORT={
 newest:(a,b)=>b.publishedAt.localeCompare(a.publishedAt),
 stage:(a,b)=>STAGES.indexOf(b.stage)-STAGES.indexOf(a.stage)||b.publishedAt.localeCompare(a.publishedAt),
 raising:(a,b)=>(b.raisingEur??-1)-(a.raisingEur??-1)||b.publishedAt.localeCompare(a.publishedAt),
};

/** GET /api/investors/projects: the list with filters, the hubs for the map (with counts by stage) and the hub list. */
export function projects(ctx){
 requireInvestor(ctx);
 const f=investorFilter(ctx.url.searchParams),all=collect(ctx);
 const items=all.filter(p=>matchesInvestor(p,f)).sort(SORT[f.sort]);
 const hubs=new Map();
 for(const p of all)if(!hubs.has(p.hub)){const w=readable(ctx).find(x=>x.id===p.hub);hubs.set(p.hub,{...hubOf(w),count:0,total:0,stages:{}});}
 for(const p of all)hubs.get(p.hub).total++;
 for(const p of items){const h=hubs.get(p.hub);h.count++;h.stages[p.stage]=(h.stages[p.stage]||0)+1;}
 return json({items,total:all.length,hubs:[...hubs.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),filter:f});
}

function find(ctx,hubId,id){
 const w=readable(ctx).find(x=>x.id===String(hubId));
 if(!w||(onlyDemoPeople(ctx)&&!String(id).startsWith('demo-')))fail(404,'NOT_FOUND');
 const p=w.db.query(VISIBLE+' AND id=?').get(String(id));
 if(!p)fail(404,'NOT_FOUND');
 return {w,p};
}
const refOf=(ctx,user)=>(ctx.workspaces().find(w=>w.self)?.id||'')+':'+user.id;

/** GET /api/investors/projects/:hub/:id: one project, read-only, as its team published it. */
export function project(ctx,hubId,id){
 const user=requireInvestor(ctx);
 const {w,p}=find(ctx,hubId,id);
 const asked=w.db.query('SELECT via,created FROM investor_interest WHERE project_id=? AND investor_ref=?').get(p.id,refOf(ctx,user));
 return json({project:card(w,hubOf(w),p,{full:true}),interest:asked?{via:asked.via,created:asked.created}:null});
}

const LETTER={
 hr:(n,f,s,p)=>`Investitor ${n} (${f}, ${s}) zanima se za ${p}. Poruka je stigla preko Hubversa; odgovorite ovdje ako želite razgovarati.`,
 en:(n,f,s,p)=>`Investor ${n} (${f}, ${s}) is interested in ${p}. This came through Hubvers; reply here if you would like to talk.`,
 ru:(n,f,s,p)=>`Инвестор ${n} (${f}, ${s}) интересуется проектом ${p}. Сообщение пришло через Hubvers; ответьте здесь, если хотите поговорить.`,
};
/**
 * POST /api/investors/projects/:hub/:id/interest {message}. In the investor's own workspace: a message to each member of
 * the team who has an account (not to anyone who blocked the investor). Elsewhere, or when nobody in the team has an
 * account: a row for the hub's organisers with the investor's name, fund, website, LinkedIn and work email, so they can
 * reply. Asking again about the same project changes nothing.
 */
export async function interest(ctx,hubId,id){
 const user=requireInvestor(ctx);
 const body=await readJson(ctx.request,8*1024);
 const message=text(body.message,{optional:true,max:1000,multiline:true},'message');
 const {w,p}=find(ctx,hubId,id),ref=refOf(ctx,user);
 const asked=w.db.query('SELECT via FROM investor_interest WHERE project_id=? AND investor_ref=?').get(p.id,ref);
 if(asked)return json({via:asked.via,already:true});
 rateLimit(ctx.db,'inv-interest:'+user.id,DAILY_INTEREST,86400);
 const inv=ctx.db.query('SELECT i.fund,i.website,n.linkedin FROM investor_profiles i LEFT JOIN network_profiles n ON n.user_id=i.user_id WHERE i.user_id=?').get(user.id);
 const name=JSON.parse(p.published||'{}').name||p.id,now=nowIso();
 let via='organisers';
 if(w.self){
  const team=ctx.db.query(`SELECT u.id,u.language FROM memberships m JOIN users u ON u.id=m.user_id AND u.status='active' WHERE m.project_id=?1 AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member')
   AND NOT EXISTS(SELECT 1 FROM message_blocks b WHERE (b.user_id=u.id AND b.blocked_id=?2) OR (b.user_id=?2 AND b.blocked_id=u.id)) ORDER BY m.created LIMIT 10`).all(p.id,user.id);
  if(team.length){
   via='message';
   ctx.db.transaction(()=>{for(const t of team){
    const intro=(LETTER[t.language]||LETTER.en)(user.display_name,inv.fund,inv.website,name);
    ctx.db.query('INSERT INTO direct_messages(id,sender_id,recipient_id,body,file_id,created) VALUES(?,?,?,?,NULL,?)').run(newId('dm'),user.id,t.id,message?intro+'\n\n'+message:intro,now);
   }})();
  }
 }
 const me=ctx.db.query('SELECT email FROM users WHERE id=?').get(user.id);
 w.db.query('INSERT INTO investor_interest(id,project_id,investor_ref,via,name,fund,website,email,linkedin,hub,message,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
  .run(newId('intr'),p.id,ref,via,user.display_name,inv.fund,inv.website,me?.email||'',inv.linkedin||'',ctx.workspaces().find(x=>x.self)?.name||'',message,now);
 if(via==='organisers')for(const o of w.db.query("SELECT id FROM users WHERE role IN ('program_admin','platform_owner') AND status='active' AND id NOT LIKE 'demo-%'").all())notify(w.db,o.id,'investor.interest',{fund:inv.fund,project:name});
 audit(ctx.db,user.id,'investor.interest','project',p.id,{hub:w.id,via});
 return json({via},201);
}

// Organisers and the owner ----------------------------------------------------------------------------------------------
/**
 * GET /api/admin/investor-interest: investors who asked about this workspace's projects. A visitor of the public demo
 * borrows an invented organiser, so it sees the invented investors' rows only.
 */
export function interestList(ctx){
 const user=requireAdmin(ctx);
 const rows=ctx.db.query('SELECT i.*,p.published FROM investor_interest i LEFT JOIN projects p ON p.id=i.project_id ORDER BY i.created DESC LIMIT 200').all()
  .filter(r=>!isDemoUser(user)||r.investor_ref.includes(':demo-user-'));
 return json({items:rows.map(r=>{let n=r.project_id;try{n=JSON.parse(r.published||'{}').name||n;}catch{}
  return {id:r.id,project:{id:r.project_id,name:n},via:r.via,name:r.name,fund:r.fund,website:r.website,email:r.email,linkedin:r.linkedin,hub:r.hub,message:r.message,created:r.created};})});
}

/** GET /api/admin/investors: investors waiting for the owner, then the decided ones. The public workspace only. */
export function pending(ctx){
 const owner=requireOwner(ctx);if(isDemoUser(owner))fail(403,'FORBIDDEN');
 if(!isDemo(ctx.db))return json({here:false,items:[]});
 const rows=ctx.db.query(`SELECT i.*,u.display_name name,u.email,u.login,n.linkedin,n.country,n.city,n.bio FROM investor_profiles i JOIN users u ON u.id=i.user_id AND u.status='active'
  LEFT JOIN network_profiles n ON n.user_id=i.user_id WHERE i.user_id NOT LIKE 'demo-%' ORDER BY i.status='pending' DESC,i.created DESC LIMIT 200`).all();
 return json({here:true,items:rows.map(r=>({id:r.user_id,name:r.name,email:r.email||'',login:r.login,linkedin:r.linkedin||'',country:r.country||'',city:r.city||'',bio:r.bio||'',...view(r),created:r.created}))});
}
/** POST /api/admin/investors/:id {approve: true|false}. */
export async function decide(ctx,id){
 const owner=requireOwner(ctx);if(isDemoUser(owner))fail(403,'FORBIDDEN');onlyHere(ctx);
 const body=await readJson(ctx.request);
 if(typeof body.approve!=='boolean')fail(400,'INVALID_FIELDS',{field:'approve'});
 const status=body.approve?'approved':'rejected';
 const r=ctx.db.query("UPDATE investor_profiles SET status=?,decided_by=?,decided_at=? WHERE user_id=? AND user_id NOT LIKE 'demo-%'").run(status,owner.id,nowIso(),String(id));
 if(!r.changes)fail(404,'NOT_FOUND');
 audit(ctx.db,owner.id,'investor.'+(body.approve?'approve':'reject'),'user',String(id),{});
 return json({status});
}
