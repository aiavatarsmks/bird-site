/**
 * Operations: bun server/cli.mjs <command>
 *   migrate [--dry-run]       apply or list pending migrations (backup first)
 *   backup                    consistent database copy + uploads copy
 *   restore-check <file>      open a copy in a temporary directory and verify it
 *   bootstrap-owner [--force] write a one-time owner invitation to the private 0600 file
 *   gc-files                  remove storage objects of deleted, unlinked files (7+ days)
 *   status                    schema, counts and free space (no secrets)
 *   workspace list            every workspace with its addresses
 *   workspace create --slug <slug> --name <name> [--host <host>] [--profile blank] [--city <city>] [--country <code>]
 *   workspace host --slug <slug> --host <host>
 *   demo-fill --workspace <slug>   invented teams, mentors and activity for a demo; never for a real programme
 * Every command except "workspace" works on the default workspace, or on --workspace <slug>.
 * A running server finds a new workspace or address on the next request; no restart is needed.
 */
import {cpSync,mkdtempSync,copyFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadConfig,prepareDirectories,freeBytes,workspaceConfig} from './config.mjs';
import {createPlatform} from './tenancy.mjs';
import {PLATFORM_MIGRATIONS} from './platform-migrations.mjs';
import {openDatabase,migrate,backupDatabase,verifyBackup,schemaStatus,pendingMigrations} from './db.mjs';
import {ensureOwnerBootstrap} from './auth.mjs';
import {collectGarbage} from './files.mjs';
import {localStorage} from './storage.mjs';
import {fillDemo} from './demo.mjs';

const [command,...args]=process.argv.slice(2);
const base=loadConfig(process.env);
const out=v=>console.log(JSON.stringify(v,null,1));
const flag=name=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:undefined;};

if(command==='workspace'){
 const platform=createPlatform(base,{log:()=>{}});
 try{
  if(args[0]==='list')out(platform.workspaces().map(w=>({slug:w.slug,name:w.name,status:w.status,profile:w.seed_profile,default:!!w.is_default,hosts:w.hosts?w.hosts.split(','):[],data:w.data_path||'(volume root)'})));
  // Only the location of the owner invitation is printed, never the code.
  else if(args[0]==='create')out(platform.createWorkspace({slug:flag('slug'),name:flag('name'),host:flag('host'),profile:flag('profile')||'blank',city:flag('city')||'',country:flag('country')||''}));
  else if(args[0]==='host')out({slug:flag('slug'),host:platform.addHost(flag('slug'),flag('host'))});
  else{console.log('Usage: workspace list | workspace create --slug <slug> --name <name> [--host <host>] | workspace host --slug <slug> --host <host>');process.exitCode=1;}
 }finally{platform.close();}
 process.exit();
}

// The workspace a command works on. Before the platform register exists this is the volume root, as it always was.
function chosen(){
 const slug=flag('workspace');
 if(!slug&&!existsSync(base.platformDbPath))return base;
 const db=openDatabase(base.platformDbPath);
 try{
  migrate(db,{backupDir:base.platformBackupDir,migrations:PLATFORM_MIGRATIONS});
  const ws=slug?db.query('SELECT * FROM workspaces WHERE slug=?').get(slug):db.query('SELECT * FROM workspaces WHERE is_default=1').get();
  if(slug&&!ws)throw Error('Unknown workspace: '+slug);
  return ws?workspaceConfig(base,ws):base;
 }finally{db.close();}
}
const config=chosen();
prepareDirectories(config);

if(command==='migrate'){
 const db=openDatabase(config.dbPath);
 if(args.includes('--dry-run'))out({pending:pendingMigrations(db).map(m=>m.id+':'+m.name),dryRun:true});
 else out(migrate(db,{backupDir:config.backupDir,log:console.log}));
 db.close();
}else if(command==='backup'){
 const db=openDatabase(config.dbPath);
 const file=backupDatabase(db,config.backupDir,'manual');db.close();
 const uploads=file.replace(/\.sqlite$/,'-uploads');
 if(existsSync(config.uploadDir))cpSync(config.uploadDir,uploads,{recursive:true});
 out({database:file,uploads,verified:verifyBackup(file).ok});
}else if(command==='restore-check'){
 const file=args[0];if(!file)throw Error('Usage: restore-check <backup.sqlite>');
 const dir=mkdtempSync(join(tmpdir(),'bird-restore-'));
 try{
  copyFileSync(file,join(dir,'profiles.sqlite'));
  const db=openDatabase(join(dir,'profiles.sqlite'));
  const counts=Object.fromEntries(['users','projects','files','submissions','xp_ledger','legacy_profiles','profiles'].map(t=>{try{return [t,db.query(`SELECT count(*) n FROM ${t}`).get().n];}catch{return [t,null];}}));
  out({file,integrity:verifyBackup(join(dir,'profiles.sqlite')).ok,schema:schemaStatus(db),pending:pendingMigrations(db).length,counts});
  db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
}else if(command==='bootstrap-owner'){
 const db=openDatabase(config.dbPath);migrate(db,{backupDir:config.backupDir});
 const r=ensureOwnerBootstrap(db,config,{force:args.includes('--force')});db.close();
 // Only the location is printed, never the code.
 out(r);
}else if(command==='gc-files'){
 const db=openDatabase(config.dbPath);out({removed:await collectGarbage(db,localStorage(config.uploadDir))});db.close();
}else if(command==='demo-fill'){
 // Invented people must never land next to real ones: only a named workspace made from the blank profile.
 if(!flag('workspace')||config.seedProfile!=='blank')throw Error('demo-fill needs --workspace <slug> of a workspace created with the blank profile');
 const db=openDatabase(config.dbPath);out(fillDemo(db));db.close();
}else if(command==='status'){
 const db=openDatabase(config.dbPath);
 out({workspace:config.workspace?.slug||'default',schema:schemaStatus(db),users:db.query('SELECT count(*) n FROM users').get().n,projects:db.query('SELECT count(*) n FROM projects').get().n,freeMB:Math.round(freeBytes(config.dataDir)/1048576)});db.close();
}else{
 console.log('Commands: migrate [--dry-run] | backup | restore-check <file> | bootstrap-owner [--force] | gc-files | status | demo-fill | workspace list|create|host   (add --workspace <slug> to choose a workspace)');
 process.exitCode=command?1:0;
}
