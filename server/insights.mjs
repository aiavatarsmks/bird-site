/**
 * Organiser insight: lecture feedback (1–10 and a comment), the weekly digest and
 * an owner-only copy of the database for safekeeping outside the hosting volume.
 */
import {readFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {fail,json,readJson,text,token} from './http.mjs';
import {nowIso,backupDatabase} from './db.mjs';
import {audit,requireAdmin,requireOwner} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {isoWeek} from './tasks.mjs';
import {riskSignals,postToChat} from './cohort.mjs';

const FEEDBACK_DAYS=14;
const zagrebToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString().slice(0,10);

/** Lectures held in the last two weeks that this person has not rated yet. */
export function feedbackDue(ctx){
 const user=requireUser(ctx);
 const rows=ctx.db.query("SELECT l.id,l.date,l.title FROM lectures l WHERE l.status='published' AND l.date<=? AND l.date>=? AND NOT EXISTS(SELECT 1 FROM lecture_feedback f WHERE f.lecture_id=l.id AND f.user_id=?) ORDER BY l.date DESC LIMIT 3").all(zagrebToday(),daysAgo(FEEDBACK_DAYS),user.id);
 return json({items:rows.map(l=>({id:l.id,date:l.date,title:JSON.parse(l.title)}))});
}
export async function saveFeedback(ctx,lectureId){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const lecture=ctx.db.query("SELECT * FROM lectures WHERE id=? AND status='published'").get(lectureId);
 if(!lecture)fail(404,'NOT_FOUND');
 if(lecture.date>zagrebToday())fail(409,'INVALID_STATE');
 const score=Number(body.score);if(!Number.isInteger(score)||score<1||score>10)fail(400,'INVALID_FIELDS',{field:'score'});
 const comment=text(body.comment??'',{max:1000,optional:true,multiline:true},'comment')||'';
 const now=nowIso();
 ctx.db.query('INSERT INTO lecture_feedback(user_id,lecture_id,score,comment,created,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,lecture_id) DO UPDATE SET score=excluded.score,comment=excluded.comment,updated=excluded.updated').run(user.id,lectureId,score,comment,now,now);
 return json({ok:true},201);
}
/** Per lecture: answers, average and NPS-style score (9–10 promoters minus 1–6 detractors). Comments stay anonymous. */
export function feedbackSummary(db){
 return db.query("SELECT id,date,title FROM lectures WHERE status='published' AND date<=? ORDER BY date DESC").all(zagrebToday()).map(l=>{
  const rows=db.query('SELECT score,comment FROM lecture_feedback WHERE lecture_id=? ORDER BY updated DESC').all(l.id);
  const n=rows.length,avg=n?Math.round(rows.reduce((s,r)=>s+r.score,0)/n*10)/10:null;
  const nps=n?Math.round((rows.filter(r=>r.score>=9).length-rows.filter(r=>r.score<=6).length)/n*100):null;
  return {lectureId:l.id,date:l.date,title:JSON.parse(l.title),answers:n,average:avg,nps,comments:rows.filter(r=>r.comment).slice(0,20).map(r=>r.comment)};
 });
}
export function adminFeedback(ctx){requireAdmin(ctx);return json({items:feedbackSummary(ctx.db)});}

/** What an organiser should look at this week. */
export function buildDigest(db){
 const week=isoWeek(),since=new Date(Date.now()-7*86400000).toISOString();
 const projects=db.query("SELECT id,json_extract(draft,'$.name') name FROM projects WHERE status<>'archived' ORDER BY name").all();
 const teams=projects.map(p=>{
  const ids=db.query("SELECT user_id FROM memberships WHERE project_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')").all(p.id).map(m=>m.user_id);
  return {...p,members:ids.length,risk:riskSignals(db,p.id,ids),checkin:!!db.query('SELECT 1 FROM checkins WHERE project_id=? AND week=?').get(p.id,week)};
 }).filter(t=>t.members>0);
 const lastLecture=feedbackSummary(db)[0]||null;
 return {
  week,
  teamsWithAccounts:teams.length,
  noCheckin:teams.filter(t=>!t.checkin).map(t=>t.name),
  atRisk:teams.filter(t=>t.risk.level==='risk').map(t=>({name:t.name,signals:t.risk.signals})),
  needsHelp:teams.filter(t=>t.risk.signals.includes('needs_help')).map(t=>t.name),
  waitingReview:db.query("SELECT count(*) n FROM submissions WHERE status='submitted'").get().n,
  unverifiedAttendance:db.query("SELECT count(*) n FROM attendance WHERE kind='self_reported'").get().n,
  newAccounts:db.query('SELECT count(*) n FROM users WHERE created>=?').get(since).n,
  // Participants with no visit in 7 days (organisers are left out).
  inactive:db.query("SELECT u.display_name n FROM users u WHERE u.status='active' AND u.role='member' AND coalesce((SELECT max(last_seen) FROM sessions s WHERE s.user_id=u.id),u.created)<? ORDER BY u.display_name").all(since).map(r=>r.n),
  lastLecture:lastLecture&&{date:lastLecture.date,title:lastLecture.title,answers:lastLecture.answers,average:lastLecture.average},
 };
}
export function digest(ctx){requireAdmin(ctx);return json(buildDigest(ctx.db));}
const list=a=>a.length?a.join(', '):'—';
export function digestText(d){
 return [
  `Week ${d.week}`,
  `No check-in yet: ${list(d.noCheckin)}`,
  `At risk: ${list(d.atRisk.map(t=>t.name))}`,
  `Asked for help: ${list(d.needsHelp)}`,
  `No visit in 7 days: ${list(d.inactive.slice(0,15))}${d.inactive.length>15?` +${d.inactive.length-15}`:''}`,
  `Waiting for review: ${d.waitingReview} · Attendance to verify: ${d.unverifiedAttendance} · New accounts: ${d.newAccounts}`,
  d.lastLecture?`Last lecture ${d.lastLecture.date}: ${d.lastLecture.answers} answers${d.lastLecture.average!==null?`, average ${d.lastLecture.average}/10`:''}`:'',
 ].filter(Boolean).join('\n');
}
export async function sendDigest(ctx){
 const admin=requireAdmin(ctx);
 if(!ctx.db.query("SELECT 1 FROM settings WHERE key='chat_webhook' AND value<>''").get())fail(409,'INVALID_STATE');
 await postToChat(ctx.db,'BIRD weekly digest',digestText(buildDigest(ctx.db)),ctx.config.publicOrigin||new URL(ctx.request.url).origin);
 audit(ctx.db,admin.id,'digest.send','settings','chat_webhook',{});
 return json({ok:true});
}

/** Owner downloads a consistent copy of the whole database (contains password hashes: owner only). */
export function downloadBackup(ctx){
 const owner=requireOwner(ctx);
 const file=join(ctx.config.tmpDir,`download-${token(8)}.sqlite`);
 ctx.db.query('VACUUM INTO ?').run(file);
 let bytes;try{bytes=readFileSync(file);}finally{try{unlinkSync(file);}catch{}}
 audit(ctx.db,owner.id,'backup.download','database','profiles',{bytes:bytes.length});
 return new Response(bytes,{headers:{'Content-Type':'application/vnd.sqlite3','Content-Disposition':`attachment; filename="bird-${zagrebToday()}.sqlite"`,'Cache-Control':'no-store'}});
}

/** Daily copy on the data volume, kept with the other rotated backups. */
export function dailyBackup(db,dir,log=()=>{}){
 const label='daily-'+zagrebToday();
 try{
  const done=db.query("SELECT value FROM settings WHERE key='last_daily_backup'").get()?.value;
  if(done===label)return null;
  const file=backupDatabase(db,dir,'daily');
  db.query("INSERT INTO settings(key,value,updated) VALUES('last_daily_backup',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated").run(label,nowIso());
  log('daily backup written');return file;
 }catch(error){log('daily backup failed: '+error.message);return null;}
}
