/**
 * "Join as yourself" in a demo workspace: a visitor draws their own character, picks or names a team and
 * becomes a participant of the invented cohort, with no organiser in the loop.
 *
 * Everything a visitor makes is demo data: every id starts with "demo-", so the nightly refill removes it, and
 * a visitor whose visit has ended (no live session) is removed before the next one joins. Visitors share the
 * demo office like every other demo row: a second visitor can see and join a team the first one named.
 * Nothing here works outside a demo workspace (BIRD has no demo, so every route answers 404 there).
 */
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {createHash,randomBytes} from 'node:crypto';
import {fail,json,readJson,text,rateLimit} from './http.mjs';
import {nowIso} from './db.mjs';
import {createSession} from './auth.mjs';
import {assignForUser} from './tasks.mjs';
import {isDemo} from './demo-visit.mjs';

const VISIT_HOURS=4;
// The office has three free team places after the invented nine; more visitors join existing teams.
export const MAX_NEW_TEAMS=3,MAX_SELF_MADE=24;
const PREFIX={user:'demo-user-v-',person:'demo-person-v-',team:'demo-team-v-',project:'demo-project-v-'};
export const isSelfMade=user=>Boolean(user?.id?.startsWith(PREFIX.user));

// The same kit the browser draws the preview with (assets/character-kit.js).
const kits=new Map();
export function loadKit(publicDir){
 if(!kits.has(publicDir)){const win={};new Function('window',readFileSync(publicDir+'/assets/character-kit.js','utf8'))(win);kits.set(publicDir,win.BirdCharacterKit);}
 return kits.get(publicDir);
}

function requireDemo(ctx){if(!isDemo(ctx.db))fail(404,'NOT_FOUND');}
const teams=db=>db.query("SELECT p.id,p.team_id,p.published FROM projects p WHERE p.status='published' AND p.id LIKE 'demo-project-%' ORDER BY p.created,p.id").all()
 .map(p=>({id:p.id,teamId:p.team_id,name:JSON.parse(p.published).name,own:p.id.startsWith(PREFIX.project),members:db.query('SELECT count(*) n FROM team_people WHERE team_id=?').get(p.team_id).n}));

/** Removes rows that name any of these ids, in every table (the same rule the refill uses, for a few ids). */
function removeIds(db,ids){
 if(!ids.length)return;
 const marks=ids.map(()=>'?').join(',');
 db.exec('PRAGMA foreign_keys=OFF');
 try{db.transaction(()=>{
  for(const {name} of db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
   const cols=db.query(`PRAGMA table_info("${name}")`).all().filter(c=>!c.type||/TEXT/i.test(c.type)).map(c=>c.name);
   if(cols.length)db.query(`DELETE FROM "${name}" WHERE ${cols.map(c=>`"${c}" IN (${marks})`).join(' OR ')}`).run(...cols.flatMap(()=>ids));
  }
 })();}finally{db.exec('PRAGMA foreign_keys=ON');}
}
/** A visit ends with its session: the visitor's person and account go, and a team they named goes once it is empty. */
export function pruneVisitors(db,now=Date.now()){
 const gone=db.query(`SELECT u.id,u.person_id FROM users u WHERE u.id LIKE '${PREFIX.user}%' AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires>?)`).all(now);
 removeIds(db,gone.flatMap(u=>[u.id,u.person_id].filter(Boolean)));
 const empty=db.query(`SELECT id FROM teams WHERE id LIKE '${PREFIX.team}%' AND NOT EXISTS(SELECT 1 FROM team_people t WHERE t.team_id=teams.id)`).all();
 removeIds(db,empty.flatMap(t=>[t.id,PREFIX.project+t.id.slice(PREFIX.team.length)]));
 return {visitors:gone.length,teams:empty.length};
}

export function listTeams(ctx){
 requireDemo(ctx);
 const items=teams(ctx.db);
 return json({items:items.map(({id,name,members})=>({id,name,members})),canCreate:items.filter(t=>t.own).length<MAX_NEW_TEAMS});
}

function readCharacter(ctx,body){
 const character=loadKit(ctx.publicDir).validate(body.character);
 if(!character)fail(400,'INVALID_FIELDS',{field:'character'});
 return character;
}
const displayName=body=>text(body.name,{min:1,max:40},'name');

export async function join(ctx){
 requireDemo(ctx);
 rateLimit(ctx.db,'demo-join:'+ctx.ip,20,3600);
 const body=await readJson(ctx.request),character=readCharacter(ctx,body),name=displayName(body),kit=loadKit(ctx.publicDir);
 const db=ctx.db;pruneVisitors(db);
 let project;
 if(body.teamId!==undefined){
  project=teams(db).find(t=>t.id===body.teamId);if(!project)fail(400,'INVALID_FIELDS',{field:'teamId'});
 }else{
  const teamName=text(body.teamName,{min:2,max:40},'teamName'),key=kit.teamKey(teamName);
  if(key.length<2)fail(400,'INVALID_FIELDS',{field:'teamName'});
  // A name that matches a team already in the office joins that team instead of making a twin.
  const same=teams(db).find(t=>kit.teamKey(t.name)===key);
  if(same)fail(409,'TEAM_EXISTS',{id:same.id,name:same.name});
  if(teams(db).filter(t=>t.own).length>=MAX_NEW_TEAMS)fail(409,'TEAMS_FULL');
  project={name:teamName};
 }
 if(db.query(`SELECT count(*) n FROM people WHERE id LIKE '${PREFIX.person}%'`).get().n>=MAX_SELF_MADE)fail(409,'DEMO_FULL');
 const id=randomBytes(6).toString('hex'),now=nowIso(),userId=PREFIX.user+id,personId=PREFIX.person+id;
 const q=(sql,...args)=>db.query(sql).run(...args);
 db.transaction(()=>{
  if(!project.id){
   const content=JSON.stringify({name:project.name,short:'',problem:'',users:'',solution:'',value:'',ask:'',nextSteps:'',details:'',stage:'idea',links:[]});
   project={id:PREFIX.project+id,teamId:PREFIX.team+id,name:project.name,created:true};
   q('INSERT INTO teams(id,name,created) VALUES(?,?,?)',project.teamId,project.name,now);
   // No created_by: the team outlives the visitor who named it while anyone else is in it.
   q("INSERT INTO projects(id,team_id,source,status,draft,draft_version,published,published_version,published_at,created,updated) VALUES(?,?,'user','published',?,1,?,1,?,?,?)",project.id,project.teamId,content,content,now,now,now);
  }
  q("INSERT INTO people(id,display_name,kind,source,appearance,created,updated) VALUES(?,?,'participant','user',?,?,?)",personId,name,JSON.stringify(character),now,now);
  q("INSERT INTO users(id,login,display_name,role,person_id,language,created,updated) VALUES(?,?,?,'member',?,'en',?,?)",userId,'demo-v-'+id,name,personId,now,now);
  q('INSERT INTO team_people(team_id,person_id) VALUES(?,?)',project.teamId,personId);
  q('INSERT INTO memberships(project_id,user_id,role,created) VALUES(?,?,?,?)',project.id,userId,project.created?'owner':'editor',now);
 })();
 assignForUser(db,db.query('SELECT * FROM users WHERE id=?').get(userId));
 if(ctx.session)db.query('UPDATE sessions SET revoked_at=? WHERE id=?').run(now,ctx.session.id);
 const session=createSession(ctx,userId);
 db.query('UPDATE sessions SET expires=? WHERE id=?').run(Date.now()+VISIT_HOURS*3600000,session.id);
 return json({ok:true,csrf:session.csrf,personId,projectId:project.id},201);
}

function self(ctx){
 requireDemo(ctx);
 if(!isSelfMade(ctx.user))fail(404,'NOT_FOUND');
 const person=ctx.db.query('SELECT * FROM people WHERE id=?').get(ctx.user.person_id);if(!person)fail(404,'NOT_FOUND');
 return person;
}
export function mine(ctx){
 const person=self(ctx),team=ctx.db.query('SELECT p.id,p.published FROM team_people t JOIN projects p ON p.team_id=t.team_id WHERE t.person_id=?').get(person.id);
 return json({personId:person.id,name:person.display_name,character:JSON.parse(person.appearance),team:team&&{id:team.id,name:JSON.parse(team.published).name}});
}
export async function updateMine(ctx){
 const person=self(ctx),body=await readJson(ctx.request),character=readCharacter(ctx,body),name=displayName(body),now=nowIso();
 ctx.db.query('UPDATE people SET appearance=?,display_name=?,updated=? WHERE id=?').run(JSON.stringify(character),name,now,person.id);
 ctx.db.query('UPDATE users SET display_name=?,updated=? WHERE id=?').run(name,now,ctx.user.id);
 return mine(ctx);
}

// Artwork ------------------------------------------------------------------------------------------
const crcTable=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
/** RGBA at 1× → PNG at `scale`×, each pixel a sharp square. */
export function png({w,h,rgba},scale=1){
 const W=w*scale,H=h*scale,row=W*4+1,raw=new Uint8Array(row*H);
 for(let y=0;y<H;y++){const sy=(y/scale)|0;for(let x=0;x<W;x++){const si=(sy*w+((x/scale)|0))*4;raw.set(rgba.subarray(si,si+4),y*row+1+x*4);}}
 const chunk=(type,data)=>{const b=new Uint8Array(12+data.length),v=new DataView(b.buffer);v.setUint32(0,data.length);b.set(new TextEncoder().encode(type),4);b.set(data,8);v.setUint32(8+data.length,crc(b.subarray(4,8+data.length)));return b;};
 const head=new Uint8Array(13),v=new DataView(head.buffer);v.setUint32(0,W);v.setUint32(4,H);head.set([8,6,0,0,0],8);
 return Buffer.concat([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',new Uint8Array())]);
}
const ART=/^\/assets\/(demo-person-v-[0-9a-f]{12})(-walk|-activity)?\.webp$/;
const artCache=new Map();
const version=appearance=>createHash('sha1').update(appearance).digest('hex').slice(0,10);
/** Sprite sheets of a self-made character, drawn from the saved parts. Served as PNG under the office's usual names. */
export function art(db,publicDir,pathname,request){
 const m=pathname.match(ART);if(!m)return null;
 const person=db.query("SELECT appearance FROM people WHERE id=? AND status='active'").get(m[1]);
 if(!person)return new Response('Not found',{status:404});
 const kind=m[2]==='-walk'?'walk':m[2]==='-activity'?'activity':'idle',etag=`"${version(person.appearance)}-${kind}"`;
 const headers={'Content-Type':'image/png','Cache-Control':'no-cache','ETag':etag,'X-Content-Type-Options':'nosniff'};
 if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});
 const key=m[1]+etag;
 if(!artCache.has(key)){const kit=loadKit(publicDir),spec=kit.validate(JSON.parse(person.appearance));if(!spec)return new Response('Not found',{status:404});
  if(artCache.size>120)artCache.delete(artCache.keys().next().value);
  artCache.set(key,png(kit.sheet(spec,kind),kit.SIZE.scale));}
 return new Response(request.method==='HEAD'?null:artCache.get(key),{headers});
}
/** Office data for self-made characters, appended to the demo's office script: walk cycle and the sit/step/coffee poses. */
export function officeScript(db,publicDir){
 const rows=db.query(`SELECT id,appearance FROM people WHERE id LIKE '${PREFIX.person}%' AND status='active'`).all();
 if(!rows.length)return '';
 const kit=loadKit(publicDir),k=kit.SIZE.scale,cell=kit.WALK.cell*k,walk={},act={};
 for(const r of rows){
  let spec;try{spec=kit.validate(JSON.parse(r.appearance));}catch{}if(!spec)continue;
  const v=version(r.appearance);
  walk[r.id]={asset:`assets/${r.id}-walk.webp?v=${v}`,width:cell*kit.WALK.columns,height:cell*2,cell,columns:kit.WALK.columns,framesPerDirection:kit.WALK.frames,fps:10,frontFacing:'se',backFacing:'nw',renderHeight:128,baseline:117,travelPerLoop:70,handPositions:kit.handPositions(spec)};
  act[r.id]={asset:`assets/${r.id}-activity.webp?v=${v}`,width:1152,height:352,frames:[[0,0,384,352],[384,0,384,352],[768,0,384,352]]};
 }
 return `\nObject.assign(window.BIRD_OFFICE_WALK,${JSON.stringify(walk)});\nObject.assign(window.BIRD_OFFICE_ACTIVITIES,${JSON.stringify(act)});\n`;
}
