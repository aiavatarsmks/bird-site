/**
 * Private messages between two people and in group chats. Organisers never read conversations:
 * they see a message only when someone in it reports it. Anyone can block anyone.
 * A message may carry one file (PDF, PPTX or image) that only the people in the conversation can open.
 * A participant without an account can be written to: the message waits and reaches their inbox when they join.
 * Everyone with an account is in one shared chat.
 */
import {fail,json,readJson,text,newId,rateLimit} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin,requireAdmin} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {notify} from './notifications.mjs';
import {onTeam} from './wallet.mjs';

const PAGE=50;
const person=(db,id)=>db.query("SELECT u.id,u.display_name name,u.role,u.status,(SELECT json_extract(p.draft,'$.name') FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=u.id AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member') ORDER BY m.created LIMIT 1) team FROM users u WHERE u.id=?").get(id);
const view=p=>({id:p.id,name:p.name,team:p.team||'',organiser:isAdmin(p)});
// A participant on the roster who has not joined yet; their id is the person id.
const waitingPerson=(db,id)=>db.query("SELECT p.id,p.display_name name,(SELECT t.name FROM team_people tp JOIN teams t ON t.id=tp.team_id WHERE tp.person_id=p.id LIMIT 1) team FROM people p WHERE p.id=? AND p.kind='participant' AND p.status='active' AND NOT EXISTS(SELECT 1 FROM users u WHERE u.person_id=p.id)").get(id);
const waitingView=p=>({id:p.id,name:p.name,team:p.team||'',organiser:false,waiting:true});
const accountOf=(db,personId)=>db.query("SELECT id FROM users WHERE person_id=? AND status='active'").get(personId)?.id;
const talked=(db,a,b)=>!!db.query('SELECT 1 FROM direct_messages WHERE (sender_id=?1 AND recipient_id=?2) OR (sender_id=?2 AND recipient_id=?1) LIMIT 1').get(a,b);
const blocked=(db,a,b)=>!!db.query('SELECT 1 FROM message_blocks WHERE user_id=? AND blocked_id=?').get(a,b);
const GROUP_MAX=50;
const UNREAD_GROUP=`SELECT count(*) n FROM chat_messages c JOIN chat_members m ON m.group_id=c.group_id AND m.user_id=?1 AND m.left_at IS NULL WHERE c.sender_id<>?1 AND c.seq>m.last_read AND NOT EXISTS(SELECT 1 FROM message_blocks b WHERE b.user_id=?1 AND b.blocked_id=c.sender_id)`;
export const unreadMessages=(db,userId)=>everyone(db,userId)??db.query('SELECT count(*) n FROM direct_messages d WHERE d.recipient_id=? AND d.read_at IS NULL AND NOT EXISTS(SELECT 1 FROM message_blocks b WHERE b.user_id=d.recipient_id AND b.blocked_id=d.sender_id)').get(userId).n
 +db.query(UNREAD_GROUP).get(userId).n;

// Files: uploaded with purpose=message, then attached to one message by the person who uploaded them.
const fileView=f=>f&&{id:f.id,filename:f.filename,mime:f.mime,size:f.size};
const fileOf=(db,id)=>id?fileView(db.query("SELECT * FROM files WHERE id=? AND status='active'").get(id)):null;
function ownFile(db,user,fileId){
 if(!fileId)return null;
 const f=db.query("SELECT * FROM files WHERE id=? AND owner_user_id=? AND status='active' AND project_id IS NULL AND purpose IN ('document','image')").get(String(fileId),user.id);
 if(!f)fail(400,'INVALID_FIELDS',{field:'fileId'});
 return f;
}
const preview=(body,file)=>body?body.slice(0,140):file?'📎 '+file.filename:'';
async function readMessage(ctx,user){
 const b=await readJson(ctx.request);
 const body=text(b.body??'',{max:2000,multiline:true},'body'),file=ownFile(ctx.db,user,b.fileId);
 if(!body&&!file)fail(400,'INVALID_FIELDS',{field:'body'});
 rateLimit(ctx.db,'dm:'+user.id,30,60);rateLimit(ctx.db,'dm-day:'+user.id,500,86400);
 return {body,file};
}
const link=(db,file,type,id,created)=>{if(file)db.query('INSERT OR IGNORE INTO file_links(file_id,target_type,target_id,created) VALUES(?,?,?,?)').run(file.id,type,id,created);};

/** Conversations and group chats, newest first, with the unread count in each. */
export function conversations(ctx){
 const user=requireUser(ctx);
 syncMyTeams(ctx.db,user.id);everyone(ctx.db,user.id);
 const rows=ctx.db.query(`SELECT other,max(created) last FROM (SELECT recipient_id other,created FROM direct_messages WHERE sender_id=?1 UNION ALL SELECT sender_id other,created FROM direct_messages WHERE recipient_id=?1) GROUP BY other ORDER BY last DESC LIMIT 200`).all(user.id);
 const direct=rows.map(r=>{const p=person(ctx.db,r.other);if(!p)return null;
  const last=ctx.db.query('SELECT sender_id,body,file_id,created FROM direct_messages WHERE (sender_id=?1 AND recipient_id=?2) OR (sender_id=?2 AND recipient_id=?1) ORDER BY created DESC,rowid DESC LIMIT 1').get(user.id,r.other);
  const unread=ctx.db.query('SELECT count(*) n FROM direct_messages WHERE sender_id=? AND recipient_id=? AND read_at IS NULL').get(r.other,user.id).n;
  const off=blocked(ctx.db,user.id,r.other);
  return {kind:'dm',person:view(p),last:{mine:last.sender_id===user.id,body:preview(last.body,fileOf(ctx.db,last.file_id)),created:last.created},unread:off?0:unread,blocked:off};}).filter(Boolean);
 const waiting=ctx.db.query('SELECT person_id,max(created) last FROM waiting_messages WHERE sender_id=? GROUP BY person_id').all(user.id).map(r=>{const p=waitingPerson(ctx.db,r.person_id);if(!p)return null;
  const last=ctx.db.query('SELECT body,file_id,created FROM waiting_messages WHERE sender_id=? AND person_id=? ORDER BY created DESC,rowid DESC LIMIT 1').get(user.id,r.person_id);
  return {kind:'dm',person:waitingView(p),last:{mine:true,body:preview(last.body,fileOf(ctx.db,last.file_id)),created:last.created},unread:0,blocked:false};}).filter(Boolean);
 const groups=ctx.db.query('SELECT g.*,m.last_read,m.joined FROM chat_groups g JOIN chat_members m ON m.group_id=g.id WHERE m.user_id=? AND m.left_at IS NULL').all(user.id).map(g=>{
  const last=ctx.db.query('SELECT c.sender_id,c.body,c.file_id,c.created,u.display_name name FROM chat_messages c JOIN users u ON u.id=c.sender_id WHERE c.group_id=? AND NOT EXISTS(SELECT 1 FROM message_blocks b WHERE b.user_id=? AND b.blocked_id=c.sender_id) ORDER BY c.seq DESC LIMIT 1').get(g.id,user.id);
  const unread=ctx.db.query(UNREAD_GROUP+' AND c.group_id=?2').get(user.id,g.id).n;
  return {kind:'group',group:groupView(ctx.db,g),last:last?{mine:last.sender_id===user.id,who:last.name,body:preview(last.body,fileOf(ctx.db,last.file_id)),created:last.created}:{mine:false,who:'',body:'',created:g.created},unread};});
 const teams=ctx.db.query(`SELECT p.id,json_extract(p.draft,'$.name') name FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member') AND p.status<>'archived' AND NOT EXISTS(SELECT 1 FROM chat_groups g WHERE g.project_id=p.id) ORDER BY m.created`).all(user.id);
 return json({items:[...direct,...waiting,...groups].sort((a,b)=>b.last.created.localeCompare(a.last.created)),teamsWithoutChat:teams,unread:unreadMessages(ctx.db,user.id)});
}
/** People one can write to: everyone active, and participants who have not joined yet, found by name or team. */
export function directory(ctx){
 const user=requireUser(ctx),q=(ctx.url.searchParams.get('q')||'').trim().toLowerCase().slice(0,60);
 const like='%'+q.replace(/[\\%_]/g,m=>'\\'+m)+'%';
 const rows=ctx.db.query(`SELECT u.id FROM users u WHERE u.status='active' AND u.id<>?1 AND (?2='%%' OR lower(u.display_name) LIKE ?2 ESCAPE '\\' OR EXISTS(SELECT 1 FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=u.id AND m.revoked_at IS NULL AND lower(coalesce(json_extract(p.draft,'$.name'),'')) LIKE ?2 ESCAPE '\\')) ORDER BY u.display_name COLLATE NOCASE LIMIT 100`).all(user.id,like);
 const roster=ctx.db.query(`SELECT p.id FROM people p WHERE p.kind='participant' AND p.status='active' AND NOT EXISTS(SELECT 1 FROM users u WHERE u.person_id=p.id) AND (?1='%%' OR lower(p.display_name) LIKE ?1 ESCAPE '\\' OR EXISTS(SELECT 1 FROM team_people tp JOIN teams t ON t.id=tp.team_id WHERE tp.person_id=p.id AND lower(t.name) LIKE ?1 ESCAPE '\\')) ORDER BY p.display_name COLLATE NOCASE LIMIT 100`).all(like);
 return json({items:[...rows.map(r=>view(person(ctx.db,r.id))),...roster.map(r=>waitingView(waitingPerson(ctx.db,r.id)))].sort((a,b)=>a.name.localeCompare(b.name)).slice(0,100)});
}
/** The account of a person on the office map, if they have one. */
export function forPerson(ctx,personId){
 requireUser(ctx);
 const id=accountOf(ctx.db,personId);if(id)return json({person:view(person(ctx.db,id))});
 const p=waitingPerson(ctx.db,personId);if(!p)fail(404,'NOT_FOUND');
 return json({person:waitingView(p)});
}
/** One conversation; opening it marks incoming messages as read. */
export function thread(ctx,otherId){
 const user=requireUser(ctx);
 const joined=accountOf(ctx.db,otherId);if(joined)otherId=joined;
 else{const p=waitingPerson(ctx.db,otherId);if(p)return waitingThread(ctx,user,p);}
 const other=person(ctx.db,otherId);if(!other||other.id===user.id)fail(404,'NOT_FOUND');
 if(other.status!=='active'&&!talked(ctx.db,user.id,otherId))fail(404,'NOT_FOUND');
 const before=ctx.url.searchParams.get('before')||'9999';
 const rows=ctx.db.query('SELECT * FROM (SELECT rowid r,* FROM direct_messages WHERE ((sender_id=?1 AND recipient_id=?2) OR (sender_id=?2 AND recipient_id=?1)) AND created<?3 ORDER BY created DESC,rowid DESC LIMIT ?4) ORDER BY created,r').all(user.id,otherId,before,PAGE+1);
 const more=rows.length>PAGE;if(more)rows.shift();
 const reported=new Set(ctx.db.query('SELECT message_id FROM message_reports WHERE reporter_id=?').all(user.id).map(r=>r.message_id));
 ctx.db.query('UPDATE direct_messages SET read_at=? WHERE sender_id=? AND recipient_id=? AND read_at IS NULL').run(nowIso(),otherId,user.id);
 // canSend does not say which side blocked, so a block cannot be traced to the person who set it.
 return json({person:view(other),blocked:blocked(ctx.db,user.id,otherId),canSend:other.status==='active'&&!blocked(ctx.db,user.id,otherId)&&!blocked(ctx.db,otherId,user.id),hasMore:more,
  items:rows.map(m=>({id:m.id,mine:m.sender_id===user.id,body:m.body,file:fileOf(ctx.db,m.file_id),created:m.created,read:!!m.read_at,reported:reported.has(m.id)}))});
}
export async function send(ctx,otherId){
 const user=requireUser(ctx);
 const joined=accountOf(ctx.db,otherId);if(joined)otherId=joined;
 else{const p=waitingPerson(ctx.db,otherId);if(p)return waitingSend(ctx,user,p);}
 const other=person(ctx.db,otherId);if(!other||other.id===user.id||other.status!=='active')fail(404,'NOT_FOUND');
 // Either side's block stops the message; the sender is not told who blocked whom.
 if(blocked(ctx.db,user.id,otherId)||blocked(ctx.db,otherId,user.id))fail(403,'FORBIDDEN');
 const {body,file}=await readMessage(ctx,user);
 const id=newId('dm'),created=nowIso();
 ctx.db.transaction(()=>{
  ctx.db.query('INSERT INTO direct_messages(id,sender_id,recipient_id,body,file_id,created) VALUES(?,?,?,?,?,?)').run(id,user.id,otherId,body,file?.id||null,created);
  link(ctx.db,file,'dm',id,created);
 })();
 return json({id,created},201);
}
// Only the sender sees a waiting conversation; there is nobody yet to block, report or read it.
function waitingThread(ctx,user,p){
 const rows=ctx.db.query('SELECT * FROM (SELECT rowid r,* FROM waiting_messages WHERE sender_id=? AND person_id=? ORDER BY created DESC,rowid DESC LIMIT ?) ORDER BY created,r').all(user.id,p.id,PAGE+1);
 const more=rows.length>PAGE;if(more)rows.shift();
 return json({person:waitingView(p),blocked:false,canSend:true,waiting:true,hasMore:more,items:rows.map(m=>({id:m.id,mine:true,body:m.body,file:fileOf(ctx.db,m.file_id),created:m.created,read:false,reported:false}))});
}
async function waitingSend(ctx,user,p){
 const {body,file}=await readMessage(ctx,user);
 rateLimit(ctx.db,'dm-wait:'+user.id+':'+p.id,20,86400);
 const id=newId('dm'),created=nowIso();
 ctx.db.transaction(()=>{
  ctx.db.query('INSERT INTO waiting_messages(id,sender_id,person_id,body,file_id,created) VALUES(?,?,?,?,?,?)').run(id,user.id,p.id,body,file?.id||null,created);
  link(ctx.db,file,'dm',id,created);
 })();
 return json({id,created,waiting:true},201);
}
/** Called when an account is linked to a participant: their waiting messages become ordinary unread messages. */
export function deliverWaiting(db,personId,userId){
 const rows=db.query('SELECT * FROM waiting_messages WHERE person_id=? ORDER BY created,rowid').all(personId);
 for(const m of rows){
  if(m.sender_id!==userId)db.query('INSERT OR IGNORE INTO direct_messages(id,sender_id,recipient_id,body,file_id,created) VALUES(?,?,?,?,?,?)').run(m.id,m.sender_id,userId,m.body,m.file_id,m.created);
  db.query('DELETE FROM waiting_messages WHERE id=?').run(m.id);
 }
 return rows.length;
}
export function block(ctx,otherId,on){
 const user=requireUser(ctx),other=person(ctx.db,otherId);if(!other||otherId===user.id||(other.status!=='active'&&!talked(ctx.db,user.id,otherId)))fail(404,'NOT_FOUND');
 if(on)ctx.db.query('INSERT OR IGNORE INTO message_blocks(user_id,blocked_id,created) VALUES(?,?,?)').run(user.id,otherId,nowIso());
 else ctx.db.query('DELETE FROM message_blocks WHERE user_id=? AND blocked_id=?').run(user.id,otherId);
 return json({blocked:on});
}
/** The recipient sends one message to the organisers. Nothing else from the conversation goes with it. */
export function report(ctx,messageId){
 const user=requireUser(ctx);
 const m=ctx.db.query('SELECT * FROM direct_messages WHERE id=? AND recipient_id=?').get(messageId,user.id);if(!m)fail(404,'NOT_FOUND');
 const r=ctx.db.query('INSERT OR IGNORE INTO message_reports(id,message_id,reporter_id,created) VALUES(?,?,?,?)').run(newId('rep'),messageId,user.id,nowIso());
 if(r.changes){for(const a of ctx.db.query("SELECT id,role FROM users WHERE status='active'").all().filter(isAdmin))if(a.id!==m.sender_id)notify(ctx.db,a.id,'message.reported',{});
  audit(ctx.db,user.id,'message.report','message',messageId,{});}
 return json({ok:true});
}
export function adminReports(ctx){
 requireAdmin(ctx);
 const rows=ctx.db.query(`SELECT * FROM (SELECT r.id,r.created,r.resolved_at,m.body,m.file_id,m.created sent,m.sender_id,m.recipient_id,NULL group_title FROM message_reports r JOIN direct_messages m ON m.id=r.message_id
  UNION ALL SELECT r.id,r.created,r.resolved_at,m.body,m.file_id,m.created,m.sender_id,NULL,g.title FROM chat_reports r JOIN chat_messages m ON m.id=r.message_id JOIN chat_groups g ON g.id=m.group_id)
  ORDER BY resolved_at IS NOT NULL,created DESC LIMIT 100`).all();
 const name=id=>person(ctx.db,id);
 return json({items:rows.map(r=>({id:r.id,created:r.created,resolved:!!r.resolved_at,body:r.body,file:fileOf(ctx.db,r.file_id),sent:r.sent,from:view(name(r.sender_id)),to:r.recipient_id?view(name(r.recipient_id)):null,group:r.group_title}))});
}
export function resolveReport(ctx,id){
 const admin=requireAdmin(ctx),now=nowIso();
 const changed=ctx.db.query('UPDATE message_reports SET resolved_at=?,resolved_by=? WHERE id=? AND resolved_at IS NULL').run(now,admin.id,id).changes
  ||ctx.db.query('UPDATE chat_reports SET resolved_at=?,resolved_by=? WHERE id=? AND resolved_at IS NULL').run(now,admin.id,id).changes;
 if(!changed)fail(404,'NOT_FOUND');
 audit(ctx.db,admin.id,'message.resolve','message_report',id,{});
 return json({ok:true});
}

// Group chats. A team chat has no owner: its members are the team's members, kept in step on every visit.
// The everyone chat has no owner either: every active account is in it and nobody leaves it.
export const EVERYONE='chat-everyone';
const fixed=g=>!!g.project_id||g.id===EVERYONE;
const groupView=(db,g)=>({id:g.id,title:g.title,team:!!g.project_id,everyone:g.id===EVERYONE,members:db.query('SELECT count(*) n FROM chat_members WHERE group_id=? AND left_at IS NULL').get(g.id).n});
const activeMember=(db,groupId,userId)=>db.query('SELECT * FROM chat_members WHERE group_id=? AND user_id=? AND left_at IS NULL').get(groupId,userId);
// Read marks are message numbers, not times, so two messages in the same millisecond are both counted.
const lastSeq=(db,groupId)=>db.query('SELECT coalesce(max(seq),0) n FROM chat_messages WHERE group_id=?').get(groupId).n;
function addMember(db,groupId,userId,role='member'){
 const now=nowIso(),old=db.query('SELECT left_at FROM chat_members WHERE group_id=? AND user_id=?').get(groupId,userId);
 if(!old)db.query('INSERT INTO chat_members(group_id,user_id,role,joined,last_read) VALUES(?,?,?,?,?)').run(groupId,userId,role,now,lastSeq(db,groupId));
 else if(old.left_at)db.query('UPDATE chat_members SET left_at=NULL,role=?,joined=?,last_read=? WHERE group_id=? AND user_id=?').run(role,now,lastSeq(db,groupId),groupId,userId);
}
function syncTeam(db,g){
 if(!g?.project_id)return;
 const team=new Set(db.query("SELECT m.user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.project_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member') AND u.status='active'").all(g.project_id).map(r=>r.user_id));
 const now=new Set(db.query('SELECT user_id FROM chat_members WHERE group_id=? AND left_at IS NULL').all(g.id).map(r=>r.user_id));
 for(const id of team)if(!now.has(id))addMember(db,g.id,id);
 for(const id of now)if(!team.has(id))db.query('UPDATE chat_members SET left_at=? WHERE group_id=? AND user_id=?').run(nowIso(),g.id,id);
}
// Someone who joins later starts with the whole history unread, so they see what was said before them.
function everyone(db,userId){
 db.query('INSERT OR IGNORE INTO chat_groups(id,title,created_by,created) VALUES(?,?,?,?)').run(EVERYONE,'Everyone',userId,nowIso());
 db.query("INSERT OR IGNORE INTO chat_members(group_id,user_id,role,joined,last_read) SELECT ?1,u.id,'member',?2,0 FROM users u WHERE u.status='active'").run(EVERYONE,nowIso());
 db.query("UPDATE chat_members SET left_at=NULL WHERE group_id=? AND left_at IS NOT NULL AND user_id IN (SELECT id FROM users WHERE status='active')").run(EVERYONE);
 db.query("UPDATE chat_members SET left_at=? WHERE group_id=? AND left_at IS NULL AND user_id IN (SELECT id FROM users WHERE status<>'active')").run(nowIso(),EVERYONE);
}
function syncMyTeams(db,userId){
 for(const g of db.query("SELECT DISTINCT g.* FROM chat_groups g WHERE g.project_id IS NOT NULL AND (g.id IN (SELECT group_id FROM chat_members WHERE user_id=?1 AND left_at IS NULL) OR g.project_id IN (SELECT project_id FROM memberships WHERE user_id=?1 AND revoked_at IS NULL))").all(userId))syncTeam(db,g);
}
function memberGroup(db,user,groupId){
 if(groupId===EVERYONE)everyone(db,user.id);
 const g=db.query('SELECT * FROM chat_groups WHERE id=?').get(groupId);syncTeam(db,g);
 const m=g&&activeMember(db,g.id,user.id);if(!m)fail(404,'NOT_FOUND');
 return {g,m};
}
function people(db,user,ids){
 if(!Array.isArray(ids))fail(400,'INVALID_FIELDS',{field:'userIds'});
 const list=[...new Set(ids.map(String))].filter(id=>id!==user.id);
 for(const id of list)if(!db.query("SELECT 1 FROM users WHERE id=? AND status='active'").get(id))fail(400,'INVALID_FIELDS',{field:'userIds'});
 return list;
}
export async function createGroup(ctx){
 const user=requireUser(ctx),b=await readJson(ctx.request);
 const title=text(b.title,{min:1,max:80},'title'),ids=people(ctx.db,user,b.userIds);
 if(!ids.length||ids.length>=GROUP_MAX)fail(400,'INVALID_FIELDS',{field:'userIds'});
 rateLimit(ctx.db,'chat-new:'+user.id,20,86400);
 const id=newId('chat');
 ctx.db.transaction(()=>{
  ctx.db.query('INSERT INTO chat_groups(id,title,created_by,created) VALUES(?,?,?,?)').run(id,title,user.id,nowIso());
  addMember(ctx.db,id,user.id,'owner');for(const u of ids)addMember(ctx.db,id,u);
 })();
 return json({id},201);
}
/** Opens the team's chat, creating it on first use. */
export function teamChat(ctx,projectId){
 const user=requireUser(ctx);if(!onTeam(ctx.db,projectId,user.id))fail(403,'FORBIDDEN');
 let g=ctx.db.query('SELECT * FROM chat_groups WHERE project_id=?').get(projectId);
 if(!g){const p=ctx.db.query("SELECT json_extract(draft,'$.name') name FROM projects WHERE id=?").get(projectId);
  ctx.db.query('INSERT OR IGNORE INTO chat_groups(id,title,project_id,created_by,created) VALUES(?,?,?,?,?)').run(newId('chat'),String(p?.name||'Team').slice(0,80),projectId,user.id,nowIso());
  g=ctx.db.query('SELECT * FROM chat_groups WHERE project_id=?').get(projectId);}
 syncTeam(ctx.db,g);
 return json({id:g.id});
}
export function groupThread(ctx,groupId){
 const user=requireUser(ctx),{g,m}=memberGroup(ctx.db,user,groupId);
 const before=ctx.url.searchParams.get('before')||'9999';
 const rows=ctx.db.query('SELECT * FROM (SELECT c.*,u.display_name name FROM chat_messages c JOIN users u ON u.id=c.sender_id WHERE c.group_id=? AND c.created<? ORDER BY c.seq DESC LIMIT ?) ORDER BY seq').all(g.id,before,PAGE+1);
 const more=rows.length>PAGE;if(more)rows.shift();
 const reported=new Set(ctx.db.query('SELECT message_id FROM chat_reports WHERE reporter_id=?').all(user.id).map(r=>r.message_id));
 const hidden=new Set(ctx.db.query('SELECT blocked_id FROM message_blocks WHERE user_id=?').all(user.id).map(r=>r.blocked_id));
 ctx.db.query('UPDATE chat_members SET last_read=? WHERE group_id=? AND user_id=?').run(lastSeq(ctx.db,g.id),g.id,user.id);
 const members=ctx.db.query('SELECT user_id,role FROM chat_members WHERE group_id=? AND left_at IS NULL ORDER BY joined,rowid').all(g.id).map(r=>({...view(person(ctx.db,r.user_id)),owner:r.role==='owner'}));
 return json({group:groupView(ctx.db,g),owner:m.role==='owner'&&!fixed(g),members,hasMore:more,
  // A blocked person's messages stay out of sight in shared chats too.
  items:rows.map(r=>hidden.has(r.sender_id)?{id:r.id,mine:false,hidden:true,created:r.created}:{id:r.id,mine:r.sender_id===user.id,sender:{id:r.sender_id,name:r.name},body:r.body,file:fileOf(ctx.db,r.file_id),created:r.created,reported:reported.has(r.id)})});
}
export async function groupSend(ctx,groupId){
 const user=requireUser(ctx),{g}=memberGroup(ctx.db,user,groupId);
 const {body,file}=await readMessage(ctx,user);
 const id=newId('cm'),created=nowIso();
 ctx.db.transaction(()=>{
  const seq=ctx.db.query('INSERT INTO chat_messages(id,group_id,sender_id,body,file_id,created) VALUES(?,?,?,?,?,?)').run(id,g.id,user.id,body,file?.id||null,created).lastInsertRowid;
  ctx.db.query('UPDATE chat_members SET last_read=max(last_read,?) WHERE group_id=? AND user_id=?').run(seq,g.id,user.id);
  link(ctx.db,file,'chat',id,created);
 })();
 return json({id,created},201);
}
export async function renameGroup(ctx,groupId){
 const user=requireUser(ctx),{g,m}=memberGroup(ctx.db,user,groupId),b=await readJson(ctx.request);
 if(fixed(g)||m.role!=='owner')fail(403,'FORBIDDEN');
 ctx.db.query('UPDATE chat_groups SET title=? WHERE id=?').run(text(b.title,{min:1,max:80},'title'),g.id);
 return json({ok:true});
}
export async function addMembers(ctx,groupId){
 const user=requireUser(ctx),{g,m}=memberGroup(ctx.db,user,groupId),b=await readJson(ctx.request);
 if(fixed(g)||m.role!=='owner')fail(403,'FORBIDDEN');
 const ids=people(ctx.db,user,b.userIds);
 ctx.db.transaction(()=>{
  for(const id of ids)addMember(ctx.db,g.id,id);
  if(groupView(ctx.db,g).members>GROUP_MAX)fail(400,'INVALID_FIELDS',{field:'userIds'});
 })();
 return json({ok:true});
}
/** The owner removes someone; anyone can leave. A team chat follows the team, so nobody leaves it by hand. */
export function removeMember(ctx,groupId,userId){
 const user=requireUser(ctx),{g,m}=memberGroup(ctx.db,user,groupId);
 if(fixed(g))fail(409,'INVALID_STATE');
 if(userId!==user.id&&m.role!=='owner')fail(403,'FORBIDDEN');
 const r=ctx.db.query('UPDATE chat_members SET left_at=?,role=? WHERE group_id=? AND user_id=? AND left_at IS NULL').run(nowIso(),'member',g.id,userId);
 if(!r.changes)fail(404,'NOT_FOUND');
 if(!ctx.db.query("SELECT 1 FROM chat_members WHERE group_id=? AND left_at IS NULL AND role='owner'").get(g.id))
  ctx.db.query("UPDATE chat_members SET role='owner' WHERE group_id=? AND user_id=(SELECT user_id FROM chat_members WHERE group_id=? AND left_at IS NULL ORDER BY joined,rowid LIMIT 1)").run(g.id,g.id);
 return json({ok:true});
}
/** Anyone in the chat except the author can send one message to the organisers. */
export function groupReport(ctx,messageId){
 const user=requireUser(ctx);
 const msg=ctx.db.query('SELECT * FROM chat_messages WHERE id=?').get(messageId);
 if(!msg||msg.sender_id===user.id||!activeMember(ctx.db,msg.group_id,user.id))fail(404,'NOT_FOUND');
 const r=ctx.db.query('INSERT OR IGNORE INTO chat_reports(id,message_id,reporter_id,created) VALUES(?,?,?,?)').run(newId('rep'),messageId,user.id,nowIso());
 if(r.changes){for(const a of ctx.db.query("SELECT id,role FROM users WHERE status='active'").all().filter(isAdmin))if(a.id!==msg.sender_id)notify(ctx.db,a.id,'message.reported',{});
  audit(ctx.db,user.id,'message.report','chat_message',messageId,{});}
 return json({ok:true});
}
