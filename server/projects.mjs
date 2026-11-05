/** Projects: draft/publish, version conflicts, history, team and updates. */
import {fail,json,readJson,text,oneOf,httpUrl,newId,page,rateLimit,idempotent} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin,projectAccess,requireProject} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {notify} from './notifications.mjs';

export const STAGES=['idea','research','prototype','pilot','launched'];
// Optional fields. An early project is never asked for revenue or investment.
const FIELDS={name:[1,100],short:[0,280],problem:[0,3000],users:[0,3000],solution:[0,3000],value:[0,2000],ask:[0,2000],nextSteps:[0,2000],details:[0,8000]};

export function cleanContent(input){
 if(!input||typeof input!=='object')fail(400,'INVALID_FIELDS');
 const out={};
 for(const [key,[min,max]] of Object.entries(FIELDS))out[key]=text(input[key]??'',{min,max,multiline:key!=='name'},key);
 out.stage=STAGES.includes(input.stage)?input.stage:'idea';
 const links=Array.isArray(input.links)?input.links.slice(0,10):[];
 out.links=links.map((l,i)=>({label:text(l?.label??'',{max:80},'links.'+i),url:httpUrl(l?.url,'links.'+i)})).filter(l=>l.url);
 return out;
}
export function curatedContent(p){
 const en=p.descriptions?.en||{};
 return {name:p.displayName?.en||p.id,short:en.short||'',problem:'',users:'',solution:'',value:'',ask:'',nextSteps:'',details:en.overview||'',stage:'idea',links:[]};
}

function view(db,project,access){
 const team=db.query("SELECT m.user_id,m.role,u.display_name,u.person_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.project_id=? AND m.revoked_at IS NULL ORDER BY m.created").all(project.id);
 const people=db.query('SELECT p.id,p.display_name FROM team_people t JOIN people p ON p.id=t.person_id WHERE t.team_id=?').all(project.team_id);
 const out={id:project.id,teamId:project.team_id,source:project.source,status:project.status,published:project.published?JSON.parse(project.published):null,publishedVersion:project.published_version,publishedAt:project.published_at,people:people.map(p=>({id:p.id,displayName:p.display_name})),access:{role:access.role,edit:access.edit,manage:access.manage,team:access.team}};
 if(access.team||access.edit){out.draft=JSON.parse(project.draft);out.draftVersion=project.draft_version;out.members=team.map(m=>({userId:m.user_id,role:m.role,displayName:m.display_name,personId:m.person_id}));out.updated=project.updated;}
 return out;
}

export function listProjects(ctx){
 const {limit,offset}=page(ctx.url);
 const mine=ctx.url.searchParams.get('mine')==='1';
 if(mine){
  const user=requireUser(ctx);
  const rows=ctx.db.query('SELECT p.*,m.role FROM projects p JOIN memberships m ON m.project_id=p.id WHERE m.user_id=? AND m.revoked_at IS NULL ORDER BY p.updated DESC LIMIT ? OFFSET ?').all(user.id,limit+1,offset);
  return json({items:rows.slice(0,limit).map(p=>({id:p.id,role:p.role,status:p.status,source:p.source,name:JSON.parse(p.draft).name,updated:p.updated})),hasMore:rows.length>limit});
 }
 const rows=ctx.db.query("SELECT * FROM projects WHERE status='published' ORDER BY published_at DESC LIMIT ? OFFSET ?").all(limit+1,offset);
 return json({items:rows.slice(0,limit).map(p=>{const c=JSON.parse(p.published);return {id:p.id,source:p.source,name:c.name,short:c.short,stage:c.stage,publishedAt:p.published_at};}),hasMore:rows.length>limit});
}
export function getProject(ctx,id){
 const {project,access}=requireProject(ctx.db,ctx.user,id,'read');
 return json({project:view(ctx.db,project,access)},200,{ETag:`"${project.draft_version}"`});
}

export async function createProject(ctx){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 rateLimit(ctx.db,'project-create:'+user.id,10,86400);
 const content=cleanContent({...body,name:body.name});
 return respond(await idempotent(ctx.db,user.id,'project.create',ctx.request.headers.get('idempotency-key'),()=>{
  const now=nowIso(),id=newId('project'),teamId=newId('team');
  ctx.db.transaction(()=>{
   ctx.db.query('INSERT INTO teams(id,name,created) VALUES(?,?,?)').run(teamId,content.name,now);
   ctx.db.query('INSERT INTO projects(id,team_id,source,status,created_by,draft,draft_version,created,updated) VALUES(?,?,?,?,?,?,1,?,?)').run(id,teamId,'user','draft',user.id,JSON.stringify(content),now,now);
   ctx.db.query("INSERT INTO memberships(project_id,user_id,role,created) VALUES(?,?,'owner',?)").run(id,user.id,now);
   if(user.person_id)ctx.db.query('INSERT OR IGNORE INTO team_people(team_id,person_id) VALUES(?,?)').run(teamId,user.person_id);
   ctx.db.query("INSERT INTO project_revisions(project_id,version,kind,content,author,created) VALUES(?,1,'draft',?,?,?)").run(id,JSON.stringify(content),user.id,now);
   audit(ctx.db,user.id,'project.create','project',id,{});
   ctx.hooks?.onEvent?.(ctx,{type:'project.created',userId:user.id,projectId:id});
  })();
  const project=ctx.db.query('SELECT * FROM projects WHERE id=?').get(id);
  return {status:201,body:{project:view(ctx.db,project,projectAccess(ctx.db,user,project))}};
 }));
}
const respond=r=>json(r.body,r.status||200);

/** Saves the draft. A stale version gets 409 and the sent text is kept as a conflict revision. */
export async function saveDraft(ctx,id){
 const user=requireUser(ctx);const {project}=requireProject(ctx.db,user,id,'edit');
 const body=await readJson(ctx.request);
 const content=cleanContent(body.content);
 const expected=Number(String(ctx.request.headers.get('if-match')||body.version||'').replace(/"/g,''));
 const now=nowIso();
 if(expected!==project.draft_version){
  ctx.db.query("INSERT INTO project_revisions(project_id,version,kind,content,author,created) VALUES(?,?,'conflict',?,?,?)").run(id,project.draft_version,JSON.stringify(content),user.id,now);
  fail(409,'CONFLICT',{currentVersion:project.draft_version,current:JSON.parse(project.draft),yours:content});
 }
 const r=ctx.db.query('UPDATE projects SET draft=?,draft_version=draft_version+1,updated=? WHERE id=? AND draft_version=?').run(JSON.stringify(content),now,id,expected);
 if(!r.changes)fail(409,'CONFLICT',{yours:content});
 ctx.db.query("INSERT INTO project_revisions(project_id,version,kind,content,author,created) VALUES(?,?,'draft',?,?,?)").run(id,expected+1,JSON.stringify(content),user.id,now);
 ctx.hooks?.onEvent?.(ctx,{type:'project.draft',userId:user.id,projectId:id,content});
 const fresh=ctx.db.query('SELECT * FROM projects WHERE id=?').get(id);
 return json({project:view(ctx.db,fresh,projectAccess(ctx.db,user,fresh))},200,{ETag:`"${fresh.draft_version}"`});
}

export async function publishProject(ctx,id){
 const user=requireUser(ctx);const {project}=requireProject(ctx.db,user,id,'edit');
 const body=await readJson(ctx.request);
 if(Number(body.version)!==project.draft_version)fail(409,'CONFLICT',{currentVersion:project.draft_version});
 if(project.status==='archived')fail(409,'INVALID_STATE');
 const now=nowIso();
 ctx.db.transaction(()=>{
  ctx.db.query("UPDATE projects SET published=draft,published_version=draft_version,published_at=?,status='published',updated=? WHERE id=?").run(now,now,id);
  ctx.db.query("INSERT INTO project_revisions(project_id,version,kind,content,author,created) VALUES(?,?,'published',?,?,?)").run(id,project.draft_version,project.draft,user.id,now);
  audit(ctx.db,user.id,'project.publish','project',id,{version:project.draft_version});
  ctx.hooks?.onEvent?.(ctx,{type:'project.published',userId:user.id,projectId:id});
 })();
 const fresh=ctx.db.query('SELECT * FROM projects WHERE id=?').get(id);
 return json({project:view(ctx.db,fresh,projectAccess(ctx.db,user,fresh))});
}

export function revisions(ctx,id){
 const user=requireUser(ctx);requireProject(ctx.db,user,id,'edit');
 const {limit,offset}=page(ctx.url);
 const rows=ctx.db.query('SELECT r.id,r.version,r.kind,r.content,r.created,u.display_name FROM project_revisions r LEFT JOIN users u ON u.id=r.author WHERE r.project_id=? ORDER BY r.id DESC LIMIT ? OFFSET ?').all(id,limit+1,offset);
 return json({items:rows.slice(0,limit).map(r=>({id:r.id,version:r.version,kind:r.kind,content:JSON.parse(r.content),created:r.created,author:r.display_name||''})),hasMore:rows.length>limit});
}
/** Copies an old revision into the draft (as a new version). */
export async function restoreRevision(ctx,id,revisionId){
 const user=requireUser(ctx);const {project}=requireProject(ctx.db,user,id,'edit');
 const rev=ctx.db.query('SELECT * FROM project_revisions WHERE id=? AND project_id=?').get(Number(revisionId),id);if(!rev)fail(404,'NOT_FOUND');
 const now=nowIso();
 ctx.db.transaction(()=>{
  ctx.db.query('UPDATE projects SET draft=?,draft_version=draft_version+1,updated=? WHERE id=?').run(rev.content,now,id);
  ctx.db.query("INSERT INTO project_revisions(project_id,version,kind,content,author,created) VALUES(?,?,'restored',?,?,?)").run(id,project.draft_version+1,rev.content,user.id,now);
 })();
 const fresh=ctx.db.query('SELECT * FROM projects WHERE id=?').get(id);
 return json({project:view(ctx.db,fresh,projectAccess(ctx.db,user,fresh))});
}

/** Archive first; restoring keeps reports and files linked because nothing is deleted. */
export async function setArchived(ctx,id,archived){
 const user=requireUser(ctx);const {project}=requireProject(ctx.db,user,id,'manage');
 const now=nowIso();
 const status=archived?'archived':(project.published?'published':'draft');
 ctx.db.query('UPDATE projects SET status=?,archived_at=?,updated=? WHERE id=?').run(status,archived?now:null,now,id);
 audit(ctx.db,user.id,archived?'project.archive':'project.restore','project',id,{});
 return json({ok:true,status});
}

export async function changeMember(ctx,id,userId){
 const user=requireUser(ctx);requireProject(ctx.db,user,id,'manage');
 const body=await readJson(ctx.request);
 const current=ctx.db.query('SELECT role FROM memberships WHERE project_id=? AND user_id=? AND revoked_at IS NULL').get(id,userId);
 if(!current)fail(404,'NOT_FOUND');
 const now=nowIso();
 if(body.remove){
  if(current.role==='owner'&&ctx.db.query("SELECT count(*) n FROM memberships WHERE project_id=? AND role='owner' AND revoked_at IS NULL").get(id).n<2)fail(409,'INVALID_STATE');
  ctx.db.query('UPDATE memberships SET revoked_at=? WHERE project_id=? AND user_id=?').run(now,id,userId);
  audit(ctx.db,user.id,'membership.revoke','project',id,{user:userId});
  notify(ctx.db,userId,'membership.revoked',{projectId:id});
 }else{
  const role=oneOf(body.role,['owner','editor','member'],'role');
  if(current.role==='owner'&&role!=='owner'&&ctx.db.query("SELECT count(*) n FROM memberships WHERE project_id=? AND role='owner' AND revoked_at IS NULL").get(id).n<2)fail(409,'INVALID_STATE');
  ctx.db.query('UPDATE memberships SET role=? WHERE project_id=? AND user_id=?').run(role,id,userId);
  audit(ctx.db,user.id,'membership.role','project',id,{user:userId,role});
 }
 return json({ok:true});
}

export async function addUpdate(ctx,id){
 const user=requireUser(ctx);requireProject(ctx.db,user,id,'edit');
 const body=await readJson(ctx.request);
 const content=text(body.body,{min:1,max:3000,multiline:true},'body');
 const visibility=oneOf(body.visibility||'public',['public','team'],'visibility');
 return respond(await idempotent(ctx.db,user.id,'project.update:'+id,ctx.request.headers.get('idempotency-key'),()=>{
  const updateId=newId('upd'),now=nowIso();
  ctx.db.query('INSERT INTO project_updates(id,project_id,author,body,visibility,created) VALUES(?,?,?,?,?,?)').run(updateId,id,user.id,content,visibility,now);
  ctx.hooks?.onEvent?.(ctx,{type:'project.update',userId:user.id,projectId:id,updateId,visibility});
  return {status:201,body:{id:updateId,created:now}};
 }));
}
export function listUpdates(ctx,id){
 const {access}=requireProject(ctx.db,ctx.user,id,'read');
 const {limit,offset}=page(ctx.url,20);
 const rows=ctx.db.query(`SELECT u.id,u.body,u.visibility,u.created,a.display_name FROM project_updates u JOIN users a ON a.id=u.author WHERE u.project_id=? ${access.team?'':"AND u.visibility='public'"} ORDER BY u.created DESC LIMIT ? OFFSET ?`).all(id,limit+1,offset);
 return json({items:rows.slice(0,limit).map(r=>({id:r.id,body:r.body,visibility:r.visibility,created:r.created,author:r.display_name})),hasMore:rows.length>limit});
}

// Milestones, decisions and voluntary metrics (dated, with author) ----------------
export async function addMilestone(ctx,id){
 const user=requireUser(ctx);requireProject(ctx.db,user,id,'edit');const body=await readJson(ctx.request);
 const title=text(body.title,{min:1,max:200},'title'),due=body.due?text(body.due,{max:10},'due'):null;
 if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))fail(400,'INVALID_FIELDS',{field:'due'});
 const mid=newId('mil');ctx.db.query('INSERT INTO project_milestones(id,project_id,title,due,author,created) VALUES(?,?,?,?,?,?)').run(mid,id,title,due,user.id,nowIso());
 return json({id:mid},201);
}
export async function completeMilestone(ctx,id,mid){
 const user=requireUser(ctx);requireProject(ctx.db,user,id,'edit');
 const r=ctx.db.query('UPDATE project_milestones SET done_at=? WHERE id=? AND project_id=? AND done_at IS NULL').run(nowIso(),mid,id);
 if(r.changes)ctx.hooks?.onEvent?.(ctx,{type:'milestone.done',userId:user.id,projectId:id,milestoneId:mid});
 return json({ok:true});
}
export async function addMetric(ctx,id){
 const user=requireUser(ctx);requireProject(ctx.db,user,id,'edit');const body=await readJson(ctx.request);
 const name=text(body.name,{min:1,max:80},'name'),value=text(body.value,{min:1,max:80},'value'),visibility=oneOf(body.visibility||'team',['team','public'],'visibility');
 const date=text(body.measuredOn||nowIso().slice(0,10),{max:10},'measuredOn');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(400,'INVALID_FIELDS',{field:'measuredOn'});
 const mid=newId('met');ctx.db.query('INSERT INTO project_metrics(id,project_id,name,value,measured_on,author,visibility,created) VALUES(?,?,?,?,?,?,?,?)').run(mid,id,name,value,date,user.id,visibility,nowIso());
 return json({id:mid},201);
}
export function projectJournal(ctx,id){
 const {access}=requireProject(ctx.db,ctx.user,id,'read');
 const milestones=ctx.db.query('SELECT id,title,due,done_at,created FROM project_milestones WHERE project_id=? ORDER BY created DESC LIMIT 50').all(id);
 const metrics=ctx.db.query(`SELECT m.id,m.name,m.value,m.measured_on,m.visibility,u.display_name author FROM project_metrics m JOIN users u ON u.id=m.author WHERE m.project_id=? ${access.team?'':"AND m.visibility='public'"} ORDER BY m.measured_on DESC LIMIT 50`).all(id);
 return json({milestones:milestones.map(m=>({id:m.id,title:m.title,due:m.due,doneAt:m.done_at})),metrics:metrics.map(m=>({id:m.id,name:m.name,value:m.value,measuredOn:m.measured_on,visibility:m.visibility,author:m.author}))});
}

// Help catalogue: what a team offers and asks ---------------------------------
export function listHelp(ctx){
 const rows=ctx.db.query("SELECT h.id,h.kind,h.body,h.created,h.project_id,p.published FROM help_offers h JOIN projects p ON p.id=h.project_id WHERE h.status='open' AND p.status='published' ORDER BY h.created DESC LIMIT 100").all();
 return json({items:rows.map(r=>({id:r.id,kind:r.kind,body:r.body,created:r.created,projectId:r.project_id,projectName:JSON.parse(r.published).name}))});
}
export async function addHelp(ctx,id){
 const user=requireUser(ctx);requireProject(ctx.db,user,id,'edit');const body=await readJson(ctx.request);
 const kind=oneOf(body.kind,['offer','ask'],'kind'),content=text(body.body,{min:1,max:500,multiline:true},'body');
 const hid=newId('help');ctx.db.query('INSERT INTO help_offers(id,project_id,kind,body,author,created) VALUES(?,?,?,?,?,?)').run(hid,id,kind,content,user.id,nowIso());
 return json({id:hid},201);
}
export async function closeHelp(ctx,hid){
 const user=requireUser(ctx);const row=ctx.db.query('SELECT project_id FROM help_offers WHERE id=?').get(hid);if(!row)fail(404,'NOT_FOUND');
 requireProject(ctx.db,user,row.project_id,'edit');ctx.db.query("UPDATE help_offers SET status='closed' WHERE id=?").run(hid);return json({ok:true});
}
export {isAdmin};
