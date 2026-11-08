/** Mentor office hours: organisers publish slots, a team books one, notes stay with the team. */
import {fail,json,readJson,text,int,newId,httpUrl} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin,membership,requireAdmin} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {notify} from './notifications.mjs';
import {charge,wallet,DEFAULT_SESSION_PRICE} from './wallet.mjs';

const teamRole=(db,projectId,userId)=>['owner','editor','member'].includes(membership(db,projectId,userId));

export function listSlots(ctx){
 const user=requireUser(ctx),admin=isAdmin(user);
 const since=new Date(Date.now()-14*86400000).toISOString();
 const rows=ctx.db.query(`SELECT h.*,b.project_id,b.booked_by,b.question,b.note,json_extract(p.draft,'$.name') project_name FROM office_hours h LEFT JOIN office_hour_bookings b ON b.slot_id=h.id LEFT JOIN projects p ON p.id=b.project_id WHERE h.cancelled_at IS NULL AND h.starts_at>=? ORDER BY h.starts_at LIMIT 200`).all(since);
 return json({items:rows.map(r=>{const mine=r.project_id&&teamRole(ctx.db,r.project_id,user.id);
  return {id:r.id,mentorId:r.mentor_id||null,mentorName:r.mentor_name,topic:r.topic,startsAt:r.starts_at,durationMin:r.duration_min,location:r.location,price:r.price,booked:!!r.project_id,mine:!!mine,
   ...(mine||admin?{projectId:r.project_id,projectName:r.project_name,question:r.question,note:r.note,cost:r.cost}:{})};})});
}
export async function createSlot(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const starts=text(body.startsAt,{max:40},'startsAt');if(Number.isNaN(Date.parse(starts)))fail(400,'INVALID_FIELDS',{field:'startsAt'});
 const location=text(body.location??'',{max:200},'location');
 if(/^https?:/i.test(location))httpUrl(location,'location');
 const id=newId('slot');
 // A slot either belongs to a mentor profile or names a guest mentor.
 const mentor=body.mentorId?ctx.db.query('SELECT * FROM mentors WHERE id=? AND archived_at IS NULL').get(String(body.mentorId)):null;
 if(body.mentorId&&!mentor)fail(400,'INVALID_FIELDS',{field:'mentorId'});
 ctx.db.query('INSERT INTO office_hours(id,mentor_id,mentor_name,topic,starts_at,duration_min,location,price,created_by,created) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,mentor?.id||null,mentor?mentor.name:text(body.mentorName,{min:1,max:100},'mentorName'),text(body.topic??'',{max:200},'topic'),new Date(starts).toISOString(),int(body.durationMin??30,{min:10,max:240},'durationMin'),location,int(body.price??DEFAULT_SESSION_PRICE,{min:0,max:100000},'price'),admin.id,nowIso());
 audit(ctx.db,admin.id,'officehours.create','office_hours',id,{});
 return json({id},201);
}
export function cancelSlot(ctx,id){
 const admin=requireAdmin(ctx);
 const b=ctx.db.query('SELECT * FROM office_hour_bookings WHERE slot_id=?').get(id);
 ctx.db.query('UPDATE office_hours SET cancelled_at=? WHERE id=?').run(nowIso(),id);
 if(b)notify(ctx.db,b.booked_by,'officehours.cancelled',{slotId:id});
 audit(ctx.db,admin.id,'officehours.cancel','office_hours',id,{});
 return json({ok:true});
}
export async function book(ctx,id){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const slot=ctx.db.query('SELECT * FROM office_hours WHERE id=? AND cancelled_at IS NULL').get(id);if(!slot)fail(404,'NOT_FOUND');
 if(Date.parse(slot.starts_at)<Date.now())fail(409,'INVALID_STATE');
 const projectId=text(body.projectId,{max:80},'projectId');if(!teamRole(ctx.db,projectId,user.id))fail(403,'FORBIDDEN');
 // No limit on sessions: the team pays for each one with points it earned.
 const question=text(body.question??'',{max:500,multiline:true},'question');
 ctx.db.transaction(()=>{
  charge(ctx.db,projectId,slot.price);
  const r=ctx.db.query('INSERT OR IGNORE INTO office_hour_bookings(slot_id,project_id,booked_by,question,cost,created) VALUES(?,?,?,?,?,?)').run(id,projectId,user.id,question,slot.price,nowIso());
  if(!r.changes)fail(409,'CONFLICT');
 })();
 audit(ctx.db,user.id,'officehours.book','office_hours',id,{project:projectId,cost:slot.price});
 return json({ok:true,...wallet(ctx.db,projectId)},201);
}
export function unbook(ctx,id){
 const user=requireUser(ctx);const b=ctx.db.query('SELECT * FROM office_hour_bookings WHERE slot_id=?').get(id);
 if(!b||!(teamRole(ctx.db,b.project_id,user.id)||isAdmin(user)))fail(404,'NOT_FOUND');
 // After the start the points stay spent; only an organiser can still cancel (and so refund).
 const slot=ctx.db.query('SELECT starts_at FROM office_hours WHERE id=?').get(id);
 if(!isAdmin(user)&&Date.parse(slot.starts_at)<=Date.now())fail(409,'INVALID_STATE');
 ctx.db.query('DELETE FROM office_hour_bookings WHERE slot_id=?').run(id);audit(ctx.db,user.id,'officehours.unbook','office_hours',id,{});
 return json({ok:true});
}
export async function addNote(ctx,id){
 const user=requireUser(ctx),body=await readJson(ctx.request);const b=ctx.db.query('SELECT * FROM office_hour_bookings WHERE slot_id=?').get(id);
 if(!b||!teamRole(ctx.db,b.project_id,user.id))fail(404,'NOT_FOUND');
 ctx.db.query('UPDATE office_hour_bookings SET note=? WHERE slot_id=?').run(text(body.note,{max:2000,multiline:true},'note'),id);
 return json({ok:true});
}

// Mentor profiles: who helps with what. Public so guests in the office see them too.
export function listMentors(ctx){
 const now=nowIso();
 const rows=ctx.db.query('SELECT * FROM mentors WHERE archived_at IS NULL ORDER BY area,name').all();
 return json({items:rows.map(m=>{
  const next=ctx.db.query('SELECT h.starts_at FROM office_hours h LEFT JOIN office_hour_bookings b ON b.slot_id=h.id WHERE h.mentor_id=? AND h.cancelled_at IS NULL AND b.slot_id IS NULL AND h.starts_at>? ORDER BY h.starts_at LIMIT 1').get(m.id,now);
  const free=ctx.db.query('SELECT count(*) n FROM office_hours h LEFT JOIN office_hour_bookings b ON b.slot_id=h.id WHERE h.mentor_id=? AND h.cancelled_at IS NULL AND b.slot_id IS NULL AND h.starts_at>?').get(m.id,now).n;
  return {id:m.id,name:m.name,area:m.area,bio:m.bio,link:m.link,gender:m.gender||'',nextFree:next?.starts_at||null,freeSlots:free};
 })});
}
export async function saveMentor(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const name=text(body.name,{min:1,max:100},'name'),area=text(body.area,{min:1,max:60},'area');
 const bio=text(body.bio??'',{max:600,multiline:true},'bio'),link=body.link?httpUrl(text(body.link,{max:300},'link'),'link'):'';
 const now=nowIso();
 if(id){
  const r=ctx.db.query('UPDATE mentors SET name=?,area=?,bio=?,link=?,updated=? WHERE id=? AND archived_at IS NULL').run(name,area,bio,link,now,id);
  if(!r.changes)fail(404,'NOT_FOUND');
  ctx.db.query('UPDATE office_hours SET mentor_name=? WHERE mentor_id=?').run(name,id);
 }else{id=newId('mentor');ctx.db.query('INSERT INTO mentors(id,name,area,bio,link,created_by,created,updated) VALUES(?,?,?,?,?,?,?,?)').run(id,name,area,bio,link,admin.id,now,now);}
 audit(ctx.db,admin.id,'mentor.save','mentor',id,{});
 return json({id},201);
}
export function archiveMentor(ctx,id){const admin=requireAdmin(ctx);ctx.db.query('UPDATE mentors SET archived_at=? WHERE id=?').run(nowIso(),id);audit(ctx.db,admin.id,'mentor.archive','mentor',id,{});return json({ok:true});}

// When no free slot fits, a team asks for a meeting. The usual session price is held until an organiser
// arranges it (it becomes a booked slot) or declines it (the points come back).
const requestView=(r,admin)=>({id:r.id,mentorId:r.mentor_id||null,mentorName:r.mentor_name||'',projectId:r.project_id,projectName:r.project_name,topic:r.topic,times:r.times,price:r.price,status:r.status,slotId:r.slot_id||null,created:r.created,decidedAt:r.decided_at,...(admin?{who:r.who}:{})});
const REQUESTS=`SELECT r.*,m.name mentor_name,json_extract(p.draft,'$.name') project_name,u.display_name who FROM meeting_requests r LEFT JOIN mentors m ON m.id=r.mentor_id JOIN projects p ON p.id=r.project_id JOIN users u ON u.id=r.requested_by`;
export async function requestMeeting(ctx){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const projectId=text(body.projectId,{max:80},'projectId');if(!teamRole(ctx.db,projectId,user.id))fail(403,'FORBIDDEN');
 const mentor=body.mentorId?ctx.db.query('SELECT id FROM mentors WHERE id=? AND archived_at IS NULL').get(String(body.mentorId)):null;
 if(body.mentorId&&!mentor)fail(400,'INVALID_FIELDS',{field:'mentorId'});
 const topic=text(body.topic,{min:1,max:500,multiline:true},'topic'),times=text(body.times??'',{max:300},'times');
 const id=newId('meet');
 ctx.db.transaction(()=>{
  if(ctx.db.query("SELECT 1 FROM meeting_requests WHERE project_id=? AND coalesce(mentor_id,'')=? AND status='pending'").get(projectId,mentor?.id||''))fail(409,'ALREADY_DONE');
  charge(ctx.db,projectId,DEFAULT_SESSION_PRICE);
  ctx.db.query('INSERT INTO meeting_requests(id,mentor_id,project_id,requested_by,topic,times,price,created) VALUES(?,?,?,?,?,?,?,?)').run(id,mentor?.id||null,projectId,user.id,topic,times,DEFAULT_SESSION_PRICE,nowIso());
 })();
 for(const a of ctx.db.query("SELECT id,role FROM users WHERE status='active'").all().filter(isAdmin))notify(ctx.db,a.id,'meeting.requested',{});
 audit(ctx.db,user.id,'meeting.request','meeting_request',id,{project:projectId,mentor:mentor?.id||null});
 return json({id,...wallet(ctx.db,projectId)},201);
}
/** A team sees its own requests; organisers see everyone's with ?all=1. */
export function listRequests(ctx){
 const user=requireUser(ctx),all=isAdmin(user)&&ctx.url.searchParams.get('all')==='1';
 const rows=all?ctx.db.query(`${REQUESTS} ORDER BY r.status<>'pending',r.created DESC LIMIT 100`).all()
  :ctx.db.query(`${REQUESTS} WHERE r.project_id IN (SELECT project_id FROM memberships WHERE user_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')) AND (r.status='pending' OR r.decided_at>?) ORDER BY r.created DESC`).all(user.id,new Date(Date.now()-14*86400000).toISOString());
 return json({items:rows.map(r=>requestView(r,all))});
}
export function withdrawRequest(ctx,id){
 const user=requireUser(ctx),r=ctx.db.query("SELECT * FROM meeting_requests WHERE id=? AND status='pending'").get(id);
 if(!r||!teamRole(ctx.db,r.project_id,user.id))fail(404,'NOT_FOUND');
 ctx.db.query("UPDATE meeting_requests SET status='withdrawn',decided_by=?,decided_at=? WHERE id=?").run(user.id,nowIso(),id);
 audit(ctx.db,user.id,'meeting.withdraw','meeting_request',id,{});
 return json({ok:true});
}
/** Arranging creates the slot already booked for the team at the held price; declining returns the points. */
export async function decideRequest(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const r=ctx.db.query("SELECT * FROM meeting_requests WHERE id=? AND status='pending'").get(id);if(!r)fail(404,'NOT_FOUND');
 if(body.status==='declined'){
  ctx.db.query("UPDATE meeting_requests SET status='declined',decided_by=?,decided_at=? WHERE id=?").run(admin.id,nowIso(),id);
  notify(ctx.db,r.requested_by,'meeting.declined',{});audit(ctx.db,admin.id,'meeting.decline','meeting_request',id,{});
  return json({ok:true});
 }
 if(body.status!=='arranged')fail(400,'INVALID_FIELDS',{field:'status'});
 const starts=text(body.startsAt,{max:40},'startsAt');if(Number.isNaN(Date.parse(starts)))fail(400,'INVALID_FIELDS',{field:'startsAt'});
 const location=text(body.location??'',{max:200},'location');if(/^https?:/i.test(location))httpUrl(location,'location');
 const mentorId=body.mentorId?String(body.mentorId):r.mentor_id;
 const mentor=mentorId?ctx.db.query('SELECT * FROM mentors WHERE id=? AND archived_at IS NULL').get(mentorId):null;
 if(mentorId&&!mentor)fail(400,'INVALID_FIELDS',{field:'mentorId'});
 const mentorName=mentor?mentor.name:text(body.mentorName,{min:1,max:100},'mentorName');
 const slotId=newId('slot'),now=nowIso();
 ctx.db.transaction(()=>{
  // The points are already held by the request, so no second balance check.
  ctx.db.query('INSERT INTO office_hours(id,mentor_id,mentor_name,topic,starts_at,duration_min,location,price,created_by,created) VALUES(?,?,?,?,?,?,?,?,?,?)').run(slotId,mentor?.id||null,mentorName,'',new Date(starts).toISOString(),int(body.durationMin??30,{min:10,max:240},'durationMin'),location,r.price,admin.id,now);
  ctx.db.query('INSERT INTO office_hour_bookings(slot_id,project_id,booked_by,question,cost,created) VALUES(?,?,?,?,?,?)').run(slotId,r.project_id,r.requested_by,r.topic.slice(0,500),r.price,now);
  if(!ctx.db.query("UPDATE meeting_requests SET status='arranged',slot_id=?,decided_by=?,decided_at=? WHERE id=? AND status='pending'").run(slotId,admin.id,now,id).changes)fail(409,'CONFLICT');
 })();
 notify(ctx.db,r.requested_by,'meeting.arranged',{slotId});
 audit(ctx.db,admin.id,'meeting.arrange','meeting_request',id,{slot:slotId});
 return json({ok:true,slotId});
}
