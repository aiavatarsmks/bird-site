/**
 * Automatic reminders inside the account and the office. Nothing leaves the site.
 * Each reminder has a key, so a person gets it once however often the job runs.
 */
import {notify} from './notifications.mjs';
import {audit,isAdmin,requireAdmin} from './permissions.mjs';
import {json,readJson} from './http.mjs';
import {nowIso} from './db.mjs';
import {isoWeek} from './tasks.mjs';

const H=3600000,TZ='Europe/Zagreb',OPEN="('not_started','draft','changes_requested')";
const day=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const clock=ms=>new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms));
const shortDate=ms=>{const [,m,d]=day(ms).split('-');return `${d}.${m}.`;};
/** Start of a lecture: its Zagreb date and time as an instant. */
export function zagrebInstant(date,time){
 const guess=Date.parse(`${date}T${time||'00:00'}:00Z`);
 const shown=Date.parse(new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(guess)).replace(' ','T')+':00Z');
 return guess-(shown-guess);
}
const pickTitle=(json,field)=>{const t=JSON.parse(json||'{}');const get=l=>(field?t[l]?.[field]:t[l])||(field?t.en?.[field]:t.en)||'';return {en:get('en'),hr:get('hr')||get('en'),ru:get('ru')||get('en')};};

const TEXT={
 task48:{en:(t,a)=>`2 days left for “${t}” (due ${a}).`,hr:(t,a)=>`Još 2 dana za „${t}” (rok ${a}).`,ru:(t,a)=>`До сдачи «${t}» осталось 2 дня (срок ${a}).`},
 task6:{en:(t,a)=>`Due in a few hours: “${t}” (${a}).`,hr:(t,a)=>`Rok za nekoliko sati: „${t}” (${a}).`,ru:(t,a)=>`Через несколько часов срок: «${t}» (${a}).`},
 taskLate:{en:t=>`The deadline for “${t}” has passed. You can still hand it in.`,hr:t=>`Rok za „${t}” je prošao. Još je možete predati.`,ru:t=>`Срок по «${t}» прошёл. Сдать ещё можно.`},
 lecture24:{en:(t,a)=>`Tomorrow: “${t}”${a}.`,hr:(t,a)=>`Sutra: „${t}”${a}.`,ru:(t,a)=>`Завтра: «${t}»${a}.`},
 lecture1:{en:(t,a)=>`Starts within an hour: “${t}”${a}.`,hr:(t,a)=>`Počinje za manje od sat vremena: „${t}”${a}.`,ru:(t,a)=>`Меньше чем через час: «${t}»${a}.`},
 feedback:{en:t=>`How was “${t}”? Rate it from 1 to 10, it takes a minute.`,hr:t=>`Kako vam je bilo „${t}”? Ocijenite od 1 do 10, traje minutu.`,ru:t=>`Как прошла «${t}»? Оцените от 1 до 10, это минута.`},
 session:{en:(t,a)=>`Mentor session with ${t} at ${a}.`,hr:(t,a)=>`Sastanak s mentorom ${t} u ${a}.`,ru:(t,a)=>`Встреча с ментором ${t} в ${a}.`},
 late2:{en:t=>`Two or more deadlines missed: ${t}.`,hr:t=>`Propuštena dva ili više rokova: ${t}.`,ru:t=>`Пропущено два срока или больше: ${t}.`},
};
const message=(type,title,extra)=>Object.fromEntries(['en','hr','ru'].map(l=>[l,TEXT[type][l](title[l]??title,extra)]));

function members(db,projectId){return db.query("SELECT m.user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.project_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member') AND u.status='active'").all(projectId).map(r=>r.user_id);}
function participants(db){return db.query("SELECT id FROM users WHERE status='active' AND role='member'").all().map(r=>r.id);}

/** Runs every reminder that is due at `now`. Returns how many notifications were created. */
export function runReminders(db,now=Date.now()){
 if(!enabled(db))return 0;
 const seen=db.query("SELECT 1 FROM notifications WHERE user_id=? AND kind='reminder' AND json_extract(payload,'$.key')=?");
 let sent=0;
 const send=(userIds,key,type,title,extra,link)=>{for(const uid of new Set(userIds)){if(seen.get(uid,key))continue;notify(db,uid,'reminder',{key,type,link,text:message(type,title,extra)});sent++;}};
 db.transaction(()=>{
  // Tasks: two days before, a few hours before, and once just after the deadline.
  const tasks=db.query(`SELECT a.id,a.user_id,a.project_id,t.translations,t.due_at FROM assignments a JOIN task_templates t ON t.id=a.task_id LEFT JOIN submissions s ON s.assignment_id=a.id WHERE t.status='published' AND t.pick_mode<>'catalog' AND t.due_at IS NOT NULL AND t.due_at>? AND t.due_at<=? AND coalesce(s.status,'not_started') IN ${OPEN}`).all(new Date(now-24*H).toISOString(),new Date(now+48*H).toISOString());
  for(const a of tasks){
   const due=Date.parse(a.due_at),left=due-now,who=a.user_id?[a.user_id]:members(db,a.project_id);
   const title=pickTitle(a.translations,'title'),at=`${shortDate(due)} ${clock(due)}`;
   if(left<=0)send(who,'taskLate:'+a.id,'taskLate',title,'','#/account/tasks');
   else if(left<=6*H)send(who,'task6:'+a.id,'task6',title,at,'#/account/tasks');
   else if(left>24*H)send(who,'task48:'+a.id,'task48',title,at,'#/account/tasks');
  }
  // Organisers: one weekly list of people and teams with two or more open overdue tasks.
  const late=db.query(`SELECT coalesce(nullif(a.user_id,''),a.project_id) target,max(u.display_name) who,max(json_extract(p.draft,'$.name')) team,count(*) n FROM assignments a JOIN task_templates t ON t.id=a.task_id LEFT JOIN submissions s ON s.assignment_id=a.id LEFT JOIN users u ON u.id=a.user_id LEFT JOIN projects p ON p.id=a.project_id WHERE t.status='published' AND t.pick_mode<>'catalog' AND t.due_at IS NOT NULL AND t.due_at<? AND coalesce(s.status,'not_started') IN ${OPEN} GROUP BY target HAVING n>=2`).all(new Date(now).toISOString());
  if(late.length){
   const admins=db.query("SELECT id,role FROM users WHERE status='active'").all().filter(isAdmin).map(u=>u.id);
   const week=isoWeek(new Date(now));
   const names=late.map(r=>r.who||r.team||'?').sort((x,y)=>x.localeCompare(y)),list=names.slice(0,6).join(', ')+(names.length>6?` +${names.length-6}`:'');
   send(admins,'late2:'+week,'late2',list,'','#/admin');
  }
  // Lectures and workshops: the day before, within the last hour, and a rating request afterwards.
  const lectures=db.query("SELECT id,date,time,place,title FROM lectures WHERE status='published' AND date>=? AND date<=?").all(day(now-3*24*H),day(now+2*24*H));
  const people=lectures.length?participants(db):[];
  for(const l of lectures){
   const start=zagrebInstant(l.date,l.time),title=pickTitle(l.title),left=start-now;
   const where=(l.time?`, ${l.time}`:'')+(l.place?` · ${l.place}`:'');
   if(l.date===day(now+24*H)&&left>H)send(people,'lecture24:'+l.id,'lecture24',title,where,'#/'+l.id);
   if(l.time&&left>0&&left<=H)send(people,'lecture1:'+l.id,'lecture1',title,where,'#/'+l.id);
   const ended=l.time?start+2*H:zagrebInstant(l.date,'20:00');
   if(now>=ended&&now<ended+2*24*H){
    const rated=new Set(db.query('SELECT user_id FROM lecture_feedback WHERE lecture_id=?').all(l.id).map(r=>r.user_id));
    send(people.filter(u=>!rated.has(u)),'feedback:'+l.id,'feedback',title,'','#/account');
   }
  }
  // Mentor sessions: within the last hour, to the whole booking team.
  const slots=db.query('SELECT h.id,h.mentor_name,h.starts_at,b.project_id,b.booked_by FROM office_hours h JOIN office_hour_bookings b ON b.slot_id=h.id WHERE h.cancelled_at IS NULL AND h.starts_at>? AND h.starts_at<=?').all(new Date(now).toISOString(),new Date(now+H).toISOString());
  for(const s of slots)send([s.booked_by,...members(db,s.project_id)],'session:'+s.id,'session',s.mentor_name,clock(Date.parse(s.starts_at)),'#/account');
 })();
 return sent;
}

const enabled=db=>!db.query("SELECT 1 FROM settings WHERE key='reminders' AND value='off'").get();
export function reminderStatus(ctx){requireAdmin(ctx);return json({enabled:enabled(ctx.db),sentWeek:ctx.db.query("SELECT count(*) n FROM notifications WHERE kind='reminder' AND created>?").get(new Date(Date.now()-7*24*H).toISOString()).n});}
export async function setReminders(ctx){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request),on=body.enabled!==false;
 ctx.db.query("INSERT INTO settings(key,value,updated) VALUES('reminders',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated").run(on?'on':'off',nowIso());
 audit(ctx.db,admin.id,'settings.reminders','settings','reminders',{enabled:on});
 return json({enabled:on});
}
