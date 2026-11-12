/**
 * Workspaces: one service, one database per incubator programme.
 * Each workspace is a full application (createApp) over its own database and upload directory,
 * so a request can only reach the data of the workspace its address belongs to.
 * The platform database holds the register of workspaces and nothing from inside them.
 */
import {existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {openDatabase,migrate,schemaStatus,backupDatabase,nowIso} from './db.mjs';
import {workspaceConfig} from './config.mjs';
import {createApp} from './app.mjs';
import {PLATFORM_MIGRATIONS} from './platform-migrations.mjs';

const SLUG=/^[a-z0-9][a-z0-9-]{1,30}$/,HOST=/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/;
const PROFILES=['bird','blank'];
const bad=message=>{throw Error(message);};

export function createPlatform(config,{log=console.log,appOptions={}}={}){
 if(!existsSync(config.dataDir)){
  if(config.production)throw Error('Persistent data directory '+config.dataDir+' is missing; is the volume mounted?');
  mkdirSync(config.dataDir,{recursive:true});
 }
 const db=openDatabase(config.platformDbPath);
 migrate(db,{backupDir:config.platformBackupDir,log,migrations:PLATFORM_MIGRATIONS});
 const audit=(action,type,id,detail={})=>db.query('INSERT INTO platform_audit(actor,action,target_type,target_id,detail,created) VALUES(?,?,?,?,?,?)').run('system',action,type,id,JSON.stringify(detail),nowIso());

 // The database that existed before workspaces becomes the default workspace, in place.
 // A single-mode service with an empty volume starts the same way it always did.
 if(!db.query('SELECT 1 FROM workspaces').get()&&(config.platformMode==='single'||existsSync(config.dbPath))){
  const now=nowIso();
  db.transaction(()=>{
   db.query("INSERT INTO organisations(id,name,city,country,created) VALUES('bird','BIRD Incubator','Zagreb','HR',?)").run(now);
   db.query("INSERT INTO workspaces(id,organisation_id,slug,name,data_path,seed_profile,is_default,created) VALUES('bird','bird','bird','BIRD Incubator 2026','','bird',1,?)").run(now);
   audit('workspace.adopt','workspace','bird');
  })();
 }

 const apps=new Map();
 const row=id=>db.query('SELECT * FROM workspaces WHERE id=?').get(id);
 const list=()=>db.query('SELECT w.*,(SELECT group_concat(host) FROM workspace_hosts h WHERE h.workspace_id=w.id) hosts FROM workspaces w ORDER BY w.created,w.id').all();
 function appFor(ws){
  if(!ws||ws.status!=='active')return null;
  let app=apps.get(ws.id);
  if(!app){app=createApp(workspaceConfig(config,ws),{log:m=>log(`[${ws.slug}] ${m}`),...appOptions});apps.set(ws.id,app);}
  return app;
 }
 // Opened at start, so a failing migration stops the start instead of the first visitor's request.
 for(const ws of list())appFor(ws);

 const normalHost=value=>String(value||'').trim().toLowerCase().replace(/:\d+$/,'');
 function resolve(host){
  const ws=db.query('SELECT w.* FROM workspace_hosts h JOIN workspaces w ON w.id=h.workspace_id WHERE h.host=?').get(normalHost(host));
  if(ws)return ws;
  return config.platformMode==='single'?db.query('SELECT * FROM workspaces WHERE is_default=1').get()||null:null;
 }

 function addHost(workspaceId,host){
  const h=normalHost(host);
  if(!HOST.test(h))bad('Invalid host: '+host);
  if(!row(workspaceId))bad('Unknown workspace: '+workspaceId);
  if(db.query('SELECT 1 FROM workspace_hosts WHERE host=?').get(h))bad('Host is already in use: '+h);
  db.query('INSERT INTO workspace_hosts(host,workspace_id,created) VALUES(?,?,?)').run(h,workspaceId,nowIso());
  audit('workspace.host','workspace',workspaceId,{host:h});
  return h;
 }

 /** Creates the workspace's database from a template and returns where its owner invitation waits. */
 function createWorkspace({slug,name,host,profile='blank',organisation,city='',country=''}){
  if(!SLUG.test(slug||''))bad('Slug: 2-31 characters, a-z, 0-9 and hyphen');
  if(!name||name.length>120)bad('Name is required (up to 120 characters)');
  if(!PROFILES.includes(profile))bad('Profile: '+PROFILES.join(' or '));
  if(row(slug)||db.query('SELECT 1 FROM workspaces WHERE slug=?').get(slug))bad('Workspace already exists: '+slug);
  const h=host?normalHost(host):'';
  if(h&&!HOST.test(h))bad('Invalid host: '+host);
  if(h&&db.query('SELECT 1 FROM workspace_hosts WHERE host=?').get(h))bad('Host is already in use: '+h);
  const orgId=organisation||slug,now=nowIso(),dataPath=join('workspaces',slug);
  if(existsSync(join(config.dataDir,dataPath)))bad('Data directory already exists: '+dataPath);
  db.transaction(()=>{
   db.query('INSERT INTO organisations(id,name,city,country,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(orgId,name,city,country,now);
   db.query('INSERT INTO workspaces(id,organisation_id,slug,name,data_path,seed_profile,created) VALUES(?,?,?,?,?,?,?)').run(slug,orgId,slug,name,dataPath,profile,now);
   if(h)db.query('INSERT INTO workspace_hosts(host,workspace_id,created) VALUES(?,?,?)').run(h,slug,now);
   audit('workspace.create','workspace',slug,{profile,host:h});
  })();
  const app=appFor(row(slug));
  return {id:slug,host:h,dataPath,ownerInvitation:join(app.config.privateDir,'bootstrap-owner.txt')};
 }

 function health(){
  const items=[...apps.values()].map(a=>schemaStatus(a.db));
  const own=schemaStatus(db,PLATFORM_MIGRATIONS),ready=own.ready&&items.every(s=>s.ready);
  return Response.json({status:ready?'ok':'migrating',platformSchema:own.schema,workspaces:items.length,schemaReady:ready},{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
 }

 async function fetch(request,server){
  const url=new URL(request.url),app=appFor(resolve(url.host));
  if(app)return app.fetch(request,server);
  // The platform's own check (Railway calls it on its internal address).
  if(url.pathname==='/health')return health();
  return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }

 /** One copy of the register per day, apart from the workspaces' own copies. */
 function dailyBackup(){
  const label='daily-'+new Date().toISOString().slice(0,10);
  try{
   if(db.query("SELECT value FROM platform_settings WHERE key='last_daily_backup'").get()?.value===label)return null;
   const file=backupDatabase(db,config.platformBackupDir,'platform');
   db.query("INSERT INTO platform_settings(key,value,updated) VALUES('last_daily_backup',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated").run(label,nowIso());
   return file;
  }catch(error){log('platform backup failed: '+error.message);return null;}
 }

 return {
  fetch,db,config,resolve,addHost,createWorkspace,dailyBackup,
  workspaces:list,
  app:id=>appFor(row(id)),
  /** Runs fn(app, workspace) for every active workspace; one failing workspace does not stop the others. */
  forEach(fn){for(const ws of list()){const app=appFor(ws);if(!app)continue;try{fn(app,ws);}catch(error){log(`[${ws.slug}] ${error.message}`);}}},
  migrationsApplied:()=>[...apps.values()].reduce((n,a)=>n+a.migration.applied.length,0),
  close(){for(const a of apps.values())a.close();apps.clear();db.close();},
 };
}
