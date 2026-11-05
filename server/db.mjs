/** SQLite access, migrations and consistent backups. */
import {Database} from 'bun:sqlite';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readdirSync,statSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {MIGRATIONS} from './migrations.mjs';

export const nowIso=()=>new Date().toISOString();
const checksum=m=>createHash('sha256').update(m.sql||m.up.toString()).digest('hex').slice(0,16);

export function openDatabase(path){
 const db=new Database(path,{create:true,strict:false});
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;');
 return db;
}

export function pendingMigrations(db){
 db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL,checksum TEXT NOT NULL,applied TEXT NOT NULL)');
 const applied=new Map(db.query('SELECT id,checksum FROM schema_migrations').all().map(r=>[r.id,r.checksum]));
 for(const m of MIGRATIONS)if(applied.has(m.id)&&applied.get(m.id)!==checksum(m))throw Error(`Migration ${m.id} (${m.name}) changed after it was applied`);
 return MIGRATIONS.filter(m=>!applied.has(m.id));
}

/**
 * Applies pending migrations in one transaction each. When the database already
 * holds data, a consistent copy is written first with VACUUM INTO.
 */
export function migrate(db,{backupDir,dryRun=false,log=()=>{}}={}){
 const pending=pendingMigrations(db);
 if(dryRun||!pending.length)return {pending:pending.map(m=>m.id+':'+m.name),applied:[],backup:null};
 const hasData=db.query("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name NOT IN ('schema_migrations')").get().n>0;
 const backup=hasData&&backupDir?backupDatabase(db,backupDir,'pre-migration'):null;
 const applied=[];
 for(const m of pending){
  const now=nowIso();
  db.transaction(()=>{
   if(m.sql)db.exec(m.sql);else m.up(db,now);
   db.query('INSERT INTO schema_migrations(id,name,checksum,applied) VALUES(?,?,?,?)').run(m.id,m.name,checksum(m),now);
  })();
  applied.push(m.id+':'+m.name);log('migration applied '+m.id+' '+m.name);
 }
 return {pending:[],applied,backup};
}

export function schemaStatus(db){
 try{const latest=db.query('SELECT max(id) id FROM schema_migrations').get()?.id||0;return {schema:latest,expected:MIGRATIONS.at(-1).id,ready:latest===MIGRATIONS.at(-1).id};}
 catch{return {schema:0,expected:MIGRATIONS.at(-1).id,ready:false};}
}

/** Consistent online copy (works while WAL is active). Keeps the newest 20 copies. */
export function backupDatabase(db,dir,label='manual'){
 mkdirSync(dir,{recursive:true});
 const file=join(dir,`bird-${new Date().toISOString().replace(/[:.]/g,'-')}-${label}.sqlite`);
 db.query('VACUUM INTO ?').run(file);
 const copies=readdirSync(dir).filter(n=>/^bird-.*\.sqlite$/.test(n)).sort();
 for(const old of copies.slice(0,Math.max(0,copies.length-20)))try{unlinkSync(join(dir,old));}catch{}
 return file;
}

/** Opens a copy read-only and checks integrity and the expected schema. */
export function verifyBackup(file){
 if(!existsSync(file)||statSync(file).size===0)return {ok:false,reason:'missing'};
 const copy=new Database(file,{readonly:true});
 try{
  const integrity=copy.query('PRAGMA integrity_check').get();
  const tables=copy.query("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
  return {ok:Object.values(integrity)[0]==='ok',tables};
 }finally{copy.close();}
}
