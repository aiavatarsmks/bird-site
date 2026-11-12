/**
 * Copies of the daily database backups outside the data volume (S3-compatible bucket).
 * Without BACKUP_S3_BUCKET nothing is sent anywhere. Uploaded files are not copied here.
 */
import {basename} from 'node:path';

/** Returns {put(key, filePath)} or null when no bucket is configured. */
export function offsiteStore(config){
 if(config.offsiteStore)return config.offsiteStore;
 const o=config.offsite;
 if(!o)return null;
 const client=new Bun.S3Client({bucket:o.bucket,endpoint:o.endpoint,accessKeyId:o.accessKeyId,secretAccessKey:o.secretAccessKey,region:o.region});
 return {put:(key,file)=>client.write(key,Bun.file(file))};
}

/** Sends one backup file; a failure is logged and never stops the server. Key: <workspace>/<file name>. */
export async function copyOffsite(store,scope,file,log=()=>{}){
 if(!store||!file)return false;
 if(!/^[a-z0-9][a-z0-9-]{0,40}$/.test(scope))throw Error('Invalid backup scope');
 try{await store.put(scope+'/'+basename(file),file);log('backup copied outside the volume');return true;}
 catch(error){log('backup copy outside the volume failed: '+(error?.name||'Error'));return false;}
}
