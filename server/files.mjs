/** Private uploads with content checks, quotas, visibility and authorised download. */
import {createHash} from 'node:crypto';
import {fail,json,readJson,oneOf,newId,rateLimit,page} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin,requireProject,projectAccess} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {freeBytes} from './config.mjs';

const TYPES={
 pdf:{mime:'application/pdf',purpose:'document'},
 pptx:{mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation',purpose:'document'},
 png:{mime:'image/png',purpose:'image'},
 jpg:{mime:'image/jpeg',purpose:'image'},
 jpeg:{mime:'image/jpeg',purpose:'image'},
 webp:{mime:'image/webp',purpose:'image'},
};
const DANGEROUS=/^(exe|dll|bat|cmd|com|sh|bash|ps1|js|mjs|cjs|jar|php|phtml|py|rb|pl|cgi|asp|aspx|jsp|html?|xhtml|svgz?|xml|hta|msi|scr|vbs|wsf|pptm|potm|ppsm|docm|xlsm|swf|apk|app|dmg|iso)$/i;

/** Returns a safe display name and the single accepted extension. */
export function checkFilename(raw){
 let name='';try{name=decodeURIComponent(String(raw||''));}catch{fail(400,'UNSUPPORTED_FILE');}
 name=name.normalize('NFC').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f"<>|:*?]/g,'').trim();
 if(!name||name.length>140||name.startsWith('.'))fail(400,'UNSUPPORTED_FILE');
 const parts=name.toLowerCase().split('.');
 if(parts.length<2)fail(400,'UNSUPPORTED_FILE');
 const ext=parts.at(-1);
 if(!TYPES[ext])fail(400,'UNSUPPORTED_FILE');
 if(parts.slice(1,-1).some(p=>DANGEROUS.test(p)))fail(400,'UNSUPPORTED_FILE');
 return {name,ext};
}

function startsWith(bytes,sig,offset=0){return sig.every((b,i)=>bytes[offset+i]===b);}
function sniff(bytes){
 if(startsWith(bytes,[0x25,0x50,0x44,0x46,0x2d]))return 'pdf';
 if(startsWith(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))return 'png';
 if(startsWith(bytes,[0xff,0xd8,0xff]))return 'jpg';
 if(startsWith(bytes,[0x52,0x49,0x46,0x46])&&startsWith(bytes,[0x57,0x45,0x42,0x50],8))return 'webp';
 if(startsWith(bytes,[0x50,0x4b,0x03,0x04]))return 'zip';
 return null;
}

/**
 * Reads only the ZIP central directory (no decompression) and checks a PPTX:
 * entry count, declared unpacked size, path safety, presentation part, no macros.
 */
export function inspectPptx(bytes,limits){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)fail(400,'UNSUPPORTED_FILE',{reason:'zip'});
 const count=view.getUint16(eocd+10,true),size=view.getUint32(eocd+12,true),offset=view.getUint32(eocd+16,true);
 if(count===0xffff||offset===0xffffffff)fail(400,'UNSUPPORTED_FILE',{reason:'zip64'});
 if(count>limits.zipEntries)fail(400,'UNSUPPORTED_FILE',{reason:'entries'});
 if(offset+size>bytes.length)fail(400,'UNSUPPORTED_FILE',{reason:'zip'});
 let p=offset,total=0,names=new Set();const decoder=new TextDecoder();
 for(let i=0;i<count;i++){
  if(p+46>bytes.length||view.getUint32(p,true)!==0x02014b50)fail(400,'UNSUPPORTED_FILE',{reason:'zip'});
  const flags=view.getUint16(p+8,true),compressed=view.getUint32(p+20,true),unpacked=view.getUint32(p+24,true);
  const nameLen=view.getUint16(p+28,true),extra=view.getUint16(p+30,true),comment=view.getUint16(p+32,true);
  const name=decoder.decode(bytes.subarray(p+46,p+46+nameLen));
  if(flags&1)fail(400,'UNSUPPORTED_FILE',{reason:'encrypted'});
  if(name.includes('..')||name.startsWith('/')||name.includes('\\'))fail(400,'UNSUPPORTED_FILE',{reason:'path'});
  if(/vbaProject\.bin$/i.test(name)||/\.(bin|exe|dll|js|vbs)$/i.test(name)&&!/^ppt\/(embeddings|printerSettings)\//.test(name))fail(400,'UNSUPPORTED_FILE',{reason:'macro'});
  if(compressed>0&&unpacked/compressed>200)fail(400,'UNSUPPORTED_FILE',{reason:'ratio'});
  total+=unpacked;if(total>limits.zipUnpackedBytes)fail(400,'UNSUPPORTED_FILE',{reason:'unpacked'});
  names.add(name);p+=46+nameLen+extra+comment;
 }
 if(!names.has('[Content_Types].xml')||!names.has('ppt/presentation.xml'))fail(400,'UNSUPPORTED_FILE',{reason:'not-pptx'});
 return {entries:count,unpacked:total};
}

function usage(db){
 const now=Date.now();
 db.query('DELETE FROM upload_reservations WHERE expires<?').run(now);
 return db.query("SELECT (SELECT coalesce(sum(size),0) FROM files WHERE status='active')+(SELECT coalesce(sum(bytes),0) FROM upload_reservations) n").get().n;
}
function projectUsage(db,projectId){
 return db.query("SELECT (SELECT coalesce(sum(size),0) FROM files WHERE status='active' AND project_id=?)+(SELECT coalesce(sum(bytes),0) FROM upload_reservations WHERE project_id=?) n").get(projectId,projectId).n;
}

function messageUsage(db,userId){
 return db.query("SELECT (SELECT coalesce(sum(size),0) FROM files WHERE status='active' AND project_id IS NULL AND purpose<>'reference' AND owner_user_id=?1)+(SELECT coalesce(sum(bytes),0) FROM upload_reservations WHERE project_id IS NULL AND user_id=?1) n").get(userId).n;
}
// Who may open a file sent in a message: the two people, the chat's current members, or an organiser once it is reported.
const IN_CONVERSATION=`SELECT 1 FROM file_links l WHERE l.file_id=?1 AND (
 (l.target_type='dm' AND EXISTS(SELECT 1 FROM direct_messages d WHERE d.id=l.target_id AND (d.sender_id=?2 OR d.recipient_id=?2 OR (?3 AND EXISTS(SELECT 1 FROM message_reports r WHERE r.message_id=d.id)))))
 OR (l.target_type='chat' AND EXISTS(SELECT 1 FROM chat_messages c WHERE c.id=l.target_id AND (EXISTS(SELECT 1 FROM chat_members m WHERE m.group_id=c.group_id AND m.user_id=?2 AND m.left_at IS NULL) OR (?3 AND EXISTS(SELECT 1 FROM chat_reports r WHERE r.message_id=c.id))))))`;

export function upload(ctx){
 const user=requireUser(ctx);
 const asked=oneOf(ctx.url.searchParams.get('purpose')||'document',['document','image','reference','message'],'purpose');
 // A message file belongs to no project; it opens only for the people in the conversation it is sent to.
 const loose=asked==='reference'||asked==='message';
 const projectId=loose?null:ctx.url.searchParams.get('projectId');
 if(!loose){if(!projectId)fail(400,'INVALID_FIELDS',{field:'projectId'});requireProject(ctx.db,user,projectId,'edit');}
 rateLimit(ctx.db,'upload:'+user.id,60,3600);
 const {name,ext}=checkFilename(ctx.request.headers.get('x-filename'));
 const type=TYPES[ext];
 const purpose=asked==='message'?type.purpose:asked;
 if(purpose==='document'&&type.purpose!=='document'&&type.purpose!=='image')fail(400,'UNSUPPORTED_FILE');
 if((purpose==='image'||purpose==='reference')&&type.purpose!=='image')fail(400,'UNSUPPORTED_FILE');
 const max=type.purpose==='image'?ctx.config.limits.imageBytes:ctx.config.limits.documentBytes;
 const declared=Number(ctx.request.headers.get('content-length')||0);
 if(!declared||declared>max)fail(413,'TOO_LARGE');
 const idem=ctx.request.headers.get('idempotency-key');
 if(idem&&!/^[A-Za-z0-9_-]{8,80}$/.test(idem))fail(400,'BAD_REQUEST');
 if(idem){const prior=ctx.db.query('SELECT * FROM files WHERE owner_user_id=? AND idem_key=?').get(user.id,idem);if(prior)return json({file:fileView(prior),replayed:true});}
 // Reserve the declared size before reading the body so parallel uploads cannot overrun quotas.
 const reservation=newId('rsv');
 ctx.db.transaction(()=>{
  if(usage(ctx.db)+declared>ctx.config.limits.volumeBytes)fail(507,'QUOTA_EXCEEDED');
  if(projectId&&projectUsage(ctx.db,projectId)+declared>ctx.config.limits.projectBytes)fail(507,'QUOTA_EXCEEDED');
  if(asked==='message'&&messageUsage(ctx.db,user.id)+declared>ctx.config.limits.projectBytes)fail(507,'QUOTA_EXCEEDED');
  if(freeBytes(ctx.config.uploadDir)<declared+ctx.config.limits.minFreeBytes)fail(507,'QUOTA_EXCEEDED');
  ctx.db.query('INSERT INTO upload_reservations(id,user_id,project_id,bytes,expires) VALUES(?,?,?,?,?)').run(reservation,user.id,projectId,declared,Date.now()+600000);
 })();
 return (async()=>{
  try{
   const bytes=new Uint8Array(await ctx.request.arrayBuffer());
   if(bytes.length>max||bytes.length!==declared)fail(413,'TOO_LARGE');
   const kind=sniff(bytes);
   const expected=ext==='jpeg'?'jpg':ext==='pptx'?'zip':ext;
   if(kind!==expected)fail(400,'UNSUPPORTED_FILE',{reason:'signature'});
   const claimed=(ctx.request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
   if(claimed&&claimed!=='application/octet-stream'&&claimed!==type.mime)fail(400,'UNSUPPORTED_FILE',{reason:'mime'});
   // Best effort: names may hide letters as #xx escapes. Compressed streams are not inflated, so the download
   // headers (attachment + sandbox CSP) remain the real protection.
   if(ext==='pdf'&&/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/.test(new TextDecoder('latin1').decode(bytes.subarray(0,Math.min(bytes.length,8*1024*1024))).replace(/#([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16)))))fail(400,'UNSUPPORTED_FILE',{reason:'active-content'});
   if(ext==='pptx')inspectPptx(bytes,ctx.config.limits);
   const key=ctx.storage.newKey(),id=newId('file'),now=nowIso(),hash=createHash('sha256').update(bytes).digest('hex');
   await ctx.storage.put(key,bytes);
   const scan=await ctx.scanner.scan(ctx.storage.file(key));
   try{
    ctx.db.query('INSERT INTO files(id,project_id,owner_user_id,purpose,storage_key,filename,mime,size,sha256,visibility,scan_status,idem_key,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,projectId,user.id,purpose,key,name,type.mime,bytes.length,hash,'private',scan,idem||null,now);
   }catch(e){await ctx.storage.remove(key);if(idem&&String(e.message).includes('UNIQUE')){const prior=ctx.db.query('SELECT * FROM files WHERE owner_user_id=? AND idem_key=?').get(user.id,idem);return json({file:fileView(prior),replayed:true});}throw e;}
   audit(ctx.db,user.id,'file.upload','file',id,{project:projectId,size:bytes.length,purpose});
   const file=ctx.db.query('SELECT * FROM files WHERE id=?').get(id);
   ctx.hooks?.onEvent?.(ctx,{type:'file.uploaded',userId:user.id,projectId,fileId:id,purpose,ext});
   return json({file:fileView(file)},201);
  }finally{ctx.db.query('DELETE FROM upload_reservations WHERE id=?').run(reservation);}
 })();
}

export function fileView(f){return {id:f.id,projectId:f.project_id,purpose:f.purpose,filename:f.filename,mime:f.mime,size:f.size,visibility:f.visibility,scanStatus:f.scan_status,created:f.created};}

/** Decides read access for one file. */
export function canReadFile(db,user,file){
 if(file.status!=='active')return false;
 if(user&&file.owner_user_id===user.id)return true;
 if(file.purpose==='reference')return isAdmin(user);
 if(!file.project_id)return !!user&&!!db.query(IN_CONVERSATION).get(file.id,user.id,isAdmin(user)?1:0);
 const project=db.query('SELECT * FROM projects WHERE id=?').get(file.project_id);if(!project)return false;
 const access=projectAccess(db,user,project);
 if(file.visibility==='public')return project.status==='published'||access.team;
 if(file.visibility==='team')return access.team;
 if(file.visibility==='reviewer')return access.team||access.review;
 return false;
}

export async function download(ctx,id){
 const file=ctx.db.query('SELECT * FROM files WHERE id=?').get(id);
 // Same answer for "missing" and "not yours": no probing other projects' ids.
 if(!file||!canReadFile(ctx.db,ctx.user,file))fail(404,'NOT_FOUND');
 const blob=ctx.storage.file(file.storage_key);
 if(!(await blob.exists()))fail(404,'NOT_FOUND');
 const inline=ctx.url.searchParams.get('inline')==='1'&&file.mime.startsWith('image/');
 const ascii=file.filename.replace(/[^\x20-\x7e]/g,'_').replace(/["\\]/g,'_');
 return new Response(blob,{headers:{
  'Content-Type':file.mime,'Content-Length':String(file.size),
  'Content-Disposition':`${inline?'inline':'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':file.visibility==='public'?'public, max-age=300':'private, no-store','Cross-Origin-Resource-Policy':'same-origin',
 }});
}

export function listProjectFiles(ctx,projectId){
 requireProject(ctx.db,ctx.user,projectId,'read');
 const {limit,offset}=page(ctx.url);
 const rows=ctx.db.query("SELECT * FROM files WHERE project_id=? AND status='active' ORDER BY created DESC LIMIT ? OFFSET ?").all(projectId,limit+1,offset);
 return json({items:rows.filter(f=>canReadFile(ctx.db,ctx.user,f)).slice(0,limit).map(fileView),hasMore:rows.length>limit,usedBytes:projectUsage(ctx.db,projectId),limitBytes:ctx.config.limits.projectBytes});
}

export async function updateFile(ctx,id){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const file=ctx.db.query("SELECT * FROM files WHERE id=? AND status='active'").get(id);if(!file||!canReadFile(ctx.db,user,file))fail(404,'NOT_FOUND');
 if(file.purpose==='reference'){if(file.owner_user_id!==user.id)fail(403,'FORBIDDEN');fail(400,'INVALID_FIELDS',{field:'visibility'});}
 requireProject(ctx.db,user,file.project_id,'edit');
 const visibility=oneOf(body.visibility,['private','team','reviewer','public'],'visibility');
 ctx.db.query('UPDATE files SET visibility=? WHERE id=?').run(visibility,id);
 audit(ctx.db,user.id,'file.visibility','file',id,{visibility});
 if(visibility==='public')ctx.hooks?.onEvent?.(ctx,{type:'file.published',userId:user.id,projectId:file.project_id,fileId:id});
 return json({file:fileView({...file,visibility})});
}

/** Soft delete. The object stays until no submission links to it (see collectGarbage). */
export function deleteFile(ctx,id){
 const user=requireUser(ctx);
 const file=ctx.db.query("SELECT * FROM files WHERE id=? AND status='active'").get(id);if(!file||!canReadFile(ctx.db,user,file))fail(404,'NOT_FOUND');
 if(file.project_id)requireProject(ctx.db,user,file.project_id,'edit');else if(file.owner_user_id!==user.id)fail(403,'FORBIDDEN');
 ctx.db.query("UPDATE files SET status='deleted',deleted_at=? WHERE id=?").run(nowIso(),id);
 audit(ctx.db,user.id,'file.delete','file',id,{});
 return json({ok:true});
}

export async function collectGarbage(db,storage,olderThanDays=7){
 const cutoff=new Date(Date.now()-olderThanDays*86400000).toISOString();
 const rows=db.query("SELECT f.id,f.storage_key FROM files f WHERE f.status='deleted' AND f.deleted_at<? AND NOT EXISTS(SELECT 1 FROM file_links l WHERE l.file_id=f.id)").all(cutoff);
 for(const r of rows){await storage.remove(r.storage_key);db.query("UPDATE files SET storage_key=storage_key||'-removed' WHERE id=?").run(r.id);}
 return rows.length;
}
