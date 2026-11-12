/** Runtime configuration. Every path and limit comes from the environment. */
import {existsSync,mkdirSync,statfsSync} from 'node:fs';
import {join} from 'node:path';

const num=(value,fallback)=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:fallback;};
const MB=1024*1024;

export function loadConfig(env=process.env,overrides={}){
 const production=(env.NODE_ENV||'')==='production';
 const dataDir=overrides.dataDir||env.RAILWAY_VOLUME_MOUNT_PATH||env.BIRD_DATA_DIR;
 if(!dataDir)throw Error('BIRD_DATA_DIR (or RAILWAY_VOLUME_MOUNT_PATH) is required: refusing to create a database in an unknown place');
 const origins=(env.BIRD_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const cityOrigins=(env.BIRD_CITY_ORIGINS||(production?'https://zagreb-pomalo-production.up.railway.app':'http://127.0.0.1:5173,http://localhost:5173')).split(',').map(s=>s.trim()).filter(Boolean);
 const config={
  production,
  dataDir,
  dbPath:overrides.dbPath||env.BIRD_DB_PATH||join(dataDir,'profiles.sqlite'),
  uploadDir:overrides.uploadDir||env.BIRD_UPLOAD_DIR||join(dataDir,'uploads'),
  tmpDir:overrides.tmpDir||env.BIRD_TMP_DIR||join(dataDir,'tmp'),
  backupDir:overrides.backupDir||env.BIRD_BACKUP_DIR||join(dataDir,'backups'),
  privateDir:overrides.privateDir||env.BIRD_PRIVATE_DIR||join(dataDir,'private'),
  publicOrigin:env.BIRD_PUBLIC_ORIGIN||'',
  // Extra exact origins accepted for mutating requests (dev only unless set explicitly).
  origins,
  cityOrigins,
  trustProxy:env.BIRD_TRUST_PROXY==='1'||(production&&env.BIRD_TRUST_PROXY!=='0'),
  secureCookies:production||env.BIRD_SECURE_COOKIES==='1',
  sessionDays:num(env.BIRD_SESSION_DAYS,30),
  limits:{
   documentBytes:num(env.BIRD_MAX_DOCUMENT_MB,25)*MB,
   imageBytes:num(env.BIRD_MAX_IMAGE_MB,10)*MB,
   projectBytes:num(env.BIRD_MAX_PROJECT_MB,250)*MB,
   volumeBytes:num(env.BIRD_MAX_UPLOADS_MB,4096)*MB,
   minFreeBytes:num(env.BIRD_MIN_FREE_MB,200)*MB,
   zipEntries:num(env.BIRD_MAX_ZIP_ENTRIES,3000),
   zipUnpackedBytes:num(env.BIRD_MAX_ZIP_UNPACKED_MB,300)*MB,
   jsonBytes:64*1024,
   pageSize:50,
  },
  mailer:env.BIRD_MAIL_TRANSPORT||'disabled',
  // single: every address opens the default workspace (the BIRD service). multi: the address chooses the workspace.
  platformMode:env.PLATFORM_MODE==='multi'?'multi':'single',
  platformDbPath:join(dataDir,'platform.sqlite'),
  platformBackupDir:join(dataDir,'platform-backups'),
  // Daily database copies also go to this bucket when it is set (S3-compatible).
  offsite:env.BACKUP_S3_BUCKET?{bucket:env.BACKUP_S3_BUCKET,endpoint:env.BACKUP_S3_ENDPOINT||'',accessKeyId:env.BACKUP_S3_ACCESS_KEY_ID||'',secretAccessKey:env.BACKUP_S3_SECRET_ACCESS_KEY||'',region:env.BACKUP_S3_REGION||'auto'}:null,
  testTransport:overrides.testTransport||null,
  ...overrides.extra,
 };
 return config;
}

/**
 * Configuration of one workspace. An empty data_path is the layout that existed before
 * workspaces (database and uploads in the volume root); every other workspace has its own directory.
 */
export function workspaceConfig(base,ws){
 const own={workspace:{id:ws.id,slug:ws.slug,name:ws.name},seedProfile:ws.seed_profile};
 if(!ws.data_path)return {...base,...own};
 const dir=join(base.dataDir,ws.data_path);
 // The address chooses the workspace, so the exact origin comes from the request.
 return {...base,...own,dbPath:join(dir,'db.sqlite'),uploadDir:join(dir,'uploads'),tmpDir:join(dir,'tmp'),backupDir:join(dir,'backups'),privateDir:join(dir,'private'),publicOrigin:base.platformMode==='multi'?'':base.publicOrigin};
}

/** Checks the persistent directories before the server starts. */
export function prepareDirectories(config){
 if(!existsSync(config.dataDir)){
  if(config.production)throw Error('Persistent data directory '+config.dataDir+' is missing; is the volume mounted?');
  mkdirSync(config.dataDir,{recursive:true});
 }
 for(const dir of [config.uploadDir,config.tmpDir,config.backupDir])mkdirSync(dir,{recursive:true});
 mkdirSync(config.privateDir,{recursive:true,mode:0o700});
}

export function freeBytes(dir){try{const s=statfsSync(dir);return Number(s.bavail)*Number(s.bsize);}catch{return Infinity;}}
