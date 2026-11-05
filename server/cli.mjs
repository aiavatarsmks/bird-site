/**
 * Operations: bun server/cli.mjs <command>
 *   migrate [--dry-run]       apply or list pending migrations (backup first)
 *   backup                    consistent database copy + uploads copy
 *   restore-check <file>      open a copy in a temporary directory and verify it
 *   bootstrap-owner [--force] write a one-time owner invitation to the private 0600 file
 *   gc-files                  remove storage objects of deleted, unlinked files (7+ days)
 *   status                    schema, counts and free space (no secrets)
 */
import {cpSync,mkdtempSync,copyFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadConfig,prepareDirectories,freeBytes} from './config.mjs';
import {openDatabase,migrate,backupDatabase,verifyBackup,schemaStatus,pendingMigrations} from './db.mjs';
import {ensureOwnerBootstrap} from './auth.mjs';
import {collectGarbage} from './files.mjs';
import {localStorage} from './storage.mjs';

const [command,...args]=process.argv.slice(2);
const config=loadConfig(process.env);
prepareDirectories(config);
const out=v=>console.log(JSON.stringify(v,null,1));

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
}else if(command==='status'){
 const db=openDatabase(config.dbPath);
 out({schema:schemaStatus(db),users:db.query('SELECT count(*) n FROM users').get().n,projects:db.query('SELECT count(*) n FROM projects').get().n,freeMB:Math.round(freeBytes(config.dataDir)/1048576)});db.close();
}else{
 console.log('Commands: migrate [--dry-run] | backup | restore-check <file> | bootstrap-owner [--force] | gc-files | status');
 process.exitCode=command?1:0;
}
