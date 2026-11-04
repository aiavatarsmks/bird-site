import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createDirectoryHandler} from './directory-api.mjs';
const path=Bun.env.RAILWAY_VOLUME_MOUNT_PATH||Bun.env.BIRD_DATA_DIR;
if(!path)throw Error('Persistent data directory is required');
mkdirSync(path,{recursive:true});
const db=new Database(path+'/profiles.sqlite',{create:true});
const api=createDirectoryHandler(db);
const publicRoot=new URL('./public/',import.meta.url);
const {release,assets}=JSON.parse(await readFile(new URL('release.json',publicRoot),'utf8'));
const files=new Map([['/','index.html'],['/index.html','index.html'],...assets.map(name=>['/assets/'+name,'assets/'+name])]);
Bun.serve({port:Number(Bun.env.PORT||8080),maxRequestBodySize:16384,async fetch(request,server){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/')){
  const ip=request.headers.get('x-real-ip')||request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||server.requestIP(request)?.address||'unknown';
  return api(request,ip);
 }
 if(url.pathname==='/health')return Response.json({status:'ok',release});
 const file=files.get(url.pathname);if(!file)return new Response('Not found',{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 const body=await readFile(new URL(file,publicRoot));
 const type=file.endsWith('.webp')?'image/webp':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
 return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':type+(type.startsWith('image/')?'':'; charset=utf-8'),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-BIRD-Release':release}});
}});
console.log('BIRD serving file release',release);
