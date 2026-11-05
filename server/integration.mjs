/** Read-only public manifest for the light office visit (contract bird-city.v1). */
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {fail,json,rateLimit} from './http.mjs';

export const CONTRACT='bird-city.v1';
const SCENE_ASSETS=['office-iso-assets.js','office-scene.js','office-life.js','office-activity-data.js','office-seated-data.js','office.js','office.css','projects-data.js'];

export function createIntegration({config,db,data,publicDir,release}){
 const hashFile=name=>{const p=publicDir+'/assets/'+name;return existsSync(p)?createHash('sha256').update(readFileSync(p)).digest('hex').slice(0,20):null;};
 const assets=Object.fromEntries(SCENE_ASSETS.map(n=>[n,{url:'/assets/'+n,sha256:hashFile(n)}]));
 const sceneRevision=createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0,16);
 const origin=()=>config.publicOrigin||'https://bird-notes.up.railway.app';

 function build(){
  // Only active curated participants and staff. No accounts, emails, files or reports.
  const staff=db.query("SELECT id,display_name FROM people WHERE kind='staff' AND status='active' ORDER BY id").all();
  const people=data.people.map(p=>({id:p.id,displayName:p.displayName,roles:p.roles,teamIds:p.teamIds,projectIds:p.projectIds,appearance:{revision:data.revision,portrait:p.portraitAsset,sprite:p.portraitAsset}}));
  const projects=data.projects.map(p=>({id:p.id,teamId:p.teamId,displayName:p.displayName,short:{en:p.descriptions?.en?.short||'',hr:p.descriptions?.hr?.short||''},overview:{en:p.descriptions?.en?.overview||'',hr:p.descriptions?.hr?.overview||''},memberIds:p.memberIds,url:origin()+'/#/projects/'+encodeURIComponent(p.id)}));
  const body={
   contractVersion:CONTRACT,dataRevision:data.revision,sceneRevision,assetRevision:release,publishedAt:data.contentDate,
   languages:['en','hr','ru'],
   capabilities:{walk:true,inspect:true,shortCards:true,exit:true,auth:false,tasks:false,uploads:false,xp:false},
   mode:{route:'#/office/city',url:origin()+'/#/office/city'},
   people,staff:staff.map(s=>({id:s.id,displayName:s.display_name,role:'BIRD'})),
   teams:data.teams.map(t=>({id:t.id,displayName:t.displayName||t.name||t.id,projectIds:t.projectIds||[],memberIds:t.memberIds||[]})),
   projects,scene:{assets},
  };
  body.hash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return body;
 }
 let cached=null;
 const manifest=()=>cached||=build();

 function cors(request){
  const o=request.headers.get('origin');
  return o&&config.cityOrigins.includes(o)?{'Access-Control-Allow-Origin':o,'Vary':'Origin'}:{'Vary':'Origin'};
 }
 function checkVersion(url){
  const v=url.searchParams.get('contract');
  if(v&&v!==CONTRACT)fail(400,'VERSION_MISMATCH',{supported:[CONTRACT]});
 }
 return {
  manifest,
  handle(ctx,path){
   rateLimit(db,'integration:'+ctx.ip,240,60);
   checkVersion(ctx.url);
   const headers={...cors(ctx.request),'Cache-Control':'public, max-age=60'};
   if(path==='office-manifest'){
    const m=manifest(),etag=`"${m.hash.slice(0,32)}"`;
    if(ctx.request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers:{...headers,ETag:etag}});
    return json(m,200,{...headers,ETag:etag});
   }
   const match=path.match(/^projects\/([a-z0-9-]{1,80})$/);
   if(match){
    const p=manifest().projects.find(x=>x.id===match[1]);
    if(!p)fail(404,'NOT_FOUND');
    return json({contractVersion:CONTRACT,project:p},200,headers);
   }
   fail(404,'NOT_FOUND');
  },
 };
}
