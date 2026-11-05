/** Object storage behind a small interface. Local private directory now; S3-compatible later. */
import {mkdir,writeFile,rename,unlink,stat,readdir} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {randomBytes} from 'node:crypto';

export function localStorage(root){
 const base=resolve(root);
 const pathFor=key=>{
  if(!/^[a-f0-9]{40}$/.test(key))throw Error('Invalid storage key');
  const p=resolve(base,key.slice(0,2),key);
  if(!p.startsWith(base+sep))throw Error('Invalid storage path');
  return p;
 };
 return {
  kind:'local',
  newKey:()=>randomBytes(20).toString('hex'),
  async put(key,bytes){const p=pathFor(key);await mkdir(join(base,key.slice(0,2)),{recursive:true});const tmp=p+'.part';await writeFile(tmp,bytes,{mode:0o600});await rename(tmp,p);},
  file(key){return Bun.file(pathFor(key));},
  async remove(key){try{await unlink(pathFor(key));}catch(e){if(e.code!=='ENOENT')throw e;}},
  async exists(key){try{await stat(pathFor(key));return true;}catch{return false;}},
  async totalBytes(){let n=0;for(const d of await readdir(base).catch(()=>[])){for(const f of await readdir(join(base,d)).catch(()=>[]))n+=(await stat(join(base,d,f)).catch(()=>({size:0}))).size;}return n;},
 };
}

/** Malware scanning adapter. Without a configured scanner nothing is called "scanned". */
export const noScanner={name:'none',async scan(){return 'not_scanned';}};
