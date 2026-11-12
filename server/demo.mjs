/**
 * Invented cohort for a demo workspace: teams, people, mentors, lectures and enough activity
 * for the organiser's Today screen to show every kind of signal. All names and projects are made up.
 * The demo accounts have no password and no recovery codes, so nobody can sign in as them.
 */
import {nowIso} from './db.mjs';
import {newId,sha256,token} from './http.mjs';
import {award} from './progress.mjs';
import {assignForUser,isoWeek,markDone} from './tasks.mjs';

const DAY=86400000;
const at=(days,hour=12)=>{const d=new Date(Date.now()+days*DAY);d.setUTCHours(hour,0,0,0);return d.toISOString();};
const dayOf=days=>new Date(Date.now()+days*DAY).toISOString().slice(0,10);
const weekAgo=n=>isoWeek(new Date(Date.now()-n*7*DAY));
const T=(en,hr,ru)=>JSON.stringify({en,hr,ru});

// done: accepted tasks; review: sent and waiting for the organiser; weeks: check-ins, 0 is this week;
// attended: how many of the three past lectures each member has; seen: days since the last visit.
const TEAMS=[
 {slug:'greenloop',name:'GreenLoop',members:['Petra S.','Luka D.','Maja R.'],stage:'pilot',
  short:'Povratna ambalaža za dostavu hrane u restoranima.',problem:'Restorani bacaju tisuće jednokratnih kutija mjesečno i plaćaju sve skuplji otpad.',users:'Restorani s dostavom u Zagrebu.',solution:'Posude koje se vraćaju, peru i ponovno koriste, uz praćenje QR kodom.',
  done:['profile','one-lecture','three-lectures','problem-users','user-interviews','pricing-hypotheses','presentation','weekly-report','first-paying-customer'],weeks:[0,1,2],attended:3,seen:0},
 {slug:'mednote',name:'MedNote',members:['Ivan M.','Sara P.'],stage:'prototype',
  short:'Glasovne bilješke za liječnike obiteljske medicine.',problem:'Liječnik potroši trećinu pregleda na tipkanje nalaza.',users:'Ordinacije obiteljske medicine.',solution:'Aplikacija koja razgovor pretvara u nacrt nalaza koji liječnik samo potvrdi.',
  done:['profile','one-lecture','problem-users','user-interviews','pricing-hypotheses','weekly-report'],weeks:[0,1],attended:2,seen:1},
 {slug:'edunest',name:'EduNest',members:['Tena V.','Filip J.','Nina B.'],stage:'prototype',
  short:'Platforma za instrukcije između studenata.',problem:'Studenti prve godine ne mogu pronaći provjerenog instruktora za svoj kolegij.',users:'Studenti tehničkih fakulteta.',solution:'Stariji studenti nude termine, a ocjene i potvrde kolegija su javne.',
  done:['profile','one-lecture','problem-users','pricing-hypotheses'],review:['presentation'],weeks:[0,1],attended:2,selfReported:true,seen:1},
 {slug:'agrobit',name:'AgroBit',members:['Ana K.','Marko B.'],stage:'idea',
  short:'Senzori i aplikacija za navodnjavanje malih gospodarstava.',problem:'Mali proizvođači zalijevaju po osjećaju i gube urod u sušnim tjednima.',users:'Obiteljska gospodarstva s 2 do 20 hektara.',solution:'Jeftini senzori vlage i preporuka kada i koliko zalijevati.',
  done:['profile','one-lecture','problem-users'],weeks:[0,1],attended:2,seen:2,
  help:'Ne možemo doći do poljoprivrednika za razgovore. Treba nam kontakt u zadruzi ili savjetodavnoj službi.'},
 {slug:'parkpilot',name:'ParkPilot',members:['Dino H.','Lea T.'],stage:'idea',
  short:'Rezervacija privatnih parkirnih mjesta u centru grada.',problem:'Vozači kruže po centru dvadeset minuta, a privatna mjesta stoje prazna.',users:'Vozači koji povremeno dolaze u centar.',solution:'Vlasnici iznajmljuju mjesto po satu, vozač rezervira unaprijed.',
  done:[],weeks:[3],attended:0,seen:9},
 // A team that is on the list but has not registered yet: the organiser sees whom to invite.
 {slug:'tourloop',name:'TourLoop',members:['Karlo N.','Iva Š.'],stage:'idea',accounts:false,
  short:'Pješačke ture koje vode lokalni stanovnici.',problem:'Turisti dobivaju iste ture, a lokalni vodiči nemaju kanal prodaje.',users:'Posjetitelji koji ostaju tri i više dana.',solution:'Katalog kratkih tura s rezervacijom i plaćanjem na jednom mjestu.'},
];
const MENTORS=[
 ['ana-kovac','Ana K.','f','Customer discovery','Pomaže timovima pripremiti i provesti prve razgovore s korisnicima.'],
 ['ivan-maric','Ivan M.','m','Pricing','Cijene i modeli naplate za B2B proizvode.'],
 ['petra-simic','Petra Š.','f','Legal & IP','Osnivanje tvrtke, ugovori i zaštita intelektualnog vlasništva.'],
 ['luka-babic','Luka B.','m','Fundraising','Priprema za razgovore s investitorima i poslovnim anđelima.'],
];
const LECTURES=[
 [-16,'How to talk to your first users','Kako razgovarati s prvim korisnicima','Как говорить с первыми пользователями','Ana K.'],
 [-9,'Pricing for startups','Određivanje cijena za startupe','Ценообразование для стартапов','Ivan M.'],
 [-2,'Founder-led sales','Prodaja koju vodi osnivač','Продажи силами основателя',''],
 [5,'Pitch deck clinic','Radionica: pitch deck','Разбор питч-деков','Luka B.'],
 [12,'Legal basics for founders','Pravne osnove za osnivače','Юридические основы для основателей','Petra Š.'],
];
// Days from today. Dates are set after the tasks are assigned: assignment skips tasks that are already past due.
const DUE={'problem-users':-3,'pricing-hypotheses':-1,'user-interviews':4,'presentation':9,'demo-day-kit':20};

export function fillDemo(db){
 if(db.query("SELECT 1 FROM settings WHERE key='demo_filled'").get())return {filled:false,reason:'already filled'};
 if(db.query('SELECT 1 FROM projects').get())return {filled:false,reason:'workspace already has projects'};
 const now=nowIso(),past=at(-21);
 const task=key=>db.query('SELECT * FROM task_templates WHERE key=?').get(key);
 const q=(sql,...args)=>db.query(sql).run(...args);
 const users={};
 db.transaction(()=>{
  // Reviews and announcements need an author. Use the real organiser when there is one.
  let organiser=db.query("SELECT id FROM users WHERE role IN ('platform_owner','program_admin') AND status='active' ORDER BY created").get()?.id;
  if(!organiser){organiser='demo-user-organiser';q("INSERT INTO users(id,login,display_name,role,language,created,updated) VALUES(?,?,?,'program_admin','hr',?,?)",organiser,'demo-organiser','Demo organiser',past,past);}

  const past3=[];
  LECTURES.forEach(([days,en,hr,ru,speaker],i)=>{
   const id='demo-lecture-'+(i+1);if(days<0)past3.push(id);
   q("INSERT INTO lectures(id,date,time,place,speaker,title,created,updated) VALUES(?,?,'17:00','Velika dvorana',?,?,?,?)",id,dayOf(days),speaker,T(en,hr,ru),past,past);
  });
  for(const [slug,name,gender,area,bio] of MENTORS)q("INSERT INTO mentors(id,name,area,bio,gender,created_by,created,updated) VALUES(?,?,?,?,?,'demo',?,?)",'demo-mentor-'+slug,name,area,bio,gender,past,past);

  for(const team of TEAMS){
   const teamId='demo-team-'+team.slug,projectId='demo-project-'+team.slug;
   const content=JSON.stringify({name:team.name,short:team.short,problem:team.problem,users:team.users,solution:team.solution,value:'',ask:'',nextSteps:'',details:'',stage:team.stage,links:[]});
   q('INSERT INTO teams(id,name,created) VALUES(?,?,?)',teamId,team.name,past);
   q("INSERT INTO projects(id,team_id,source,status,draft,draft_version,published,published_version,published_at,created,updated) VALUES(?,?,'curated','published',?,1,?,1,?,?,?)",projectId,teamId,content,content,past,past,past);
   q("INSERT INTO project_revisions(project_id,version,kind,content,author,created) VALUES(?,1,'published',?,NULL,?)",projectId,content,past);
   users[team.slug]=[];
   team.members.forEach((name,i)=>{
    const personId=`demo-person-${team.slug}-${i+1}`,userId=`demo-user-${team.slug}-${i+1}`;
    q("INSERT INTO people(id,display_name,kind,source,created,updated) VALUES(?,?,'participant','curated',?,?)",personId,name,past,past);
    q('INSERT INTO team_people(team_id,person_id) VALUES(?,?)',teamId,personId);
    if(team.accounts===false)return;
    q("INSERT INTO users(id,login,display_name,role,person_id,language,created,updated) VALUES(?,?,?,'member',?,'hr',?,?)",userId,`demo-${team.slug}-${i+1}`,name,personId,past,past);
    q('INSERT INTO memberships(project_id,user_id,role,created) VALUES(?,?,?,?)',projectId,userId,i?'editor':'owner',past);
    // A closed session only records when the person was last seen.
    q('INSERT INTO sessions(id,user_id,token_hash,csrf,device,created,last_seen,expires,revoked_at) VALUES(?,?,?,?,?,?,?,0,?)',newId('ses'),userId,sha256(token()),token(8),'demo',past,team.seen?at(-team.seen,9+i):now,now);
    users[team.slug].push(userId);
   });
  }

  for(const ids of Object.values(users))for(const id of ids)assignForUser(db,db.query('SELECT * FROM users WHERE id=?').get(id));
  for(const team of TEAMS){
   const ids=users[team.slug],projectId='demo-project-'+team.slug;if(!ids.length)continue;
   const mark=(key,review)=>{const t=task(key);if(!t)return;for(const userId of t.scope==='personal'?ids:[ids[0]])markDone(db,{task:t,userId,projectId,actor:review?userId:organiser,source:'demo',review});};
   // The team at risk has one person who at least filled in the profile.
   if(team.slug==='parkpilot')markDone(db,{task:task('profile'),userId:ids[0],projectId,actor:organiser,source:'demo'});
   for(const key of team.done)mark(key,false);
   for(const key of team.review||[])mark(key,true);
   ids.forEach((userId,i)=>past3.slice(0,team.attended).forEach((lectureId,n)=>{
    const self=team.selfReported&&i===0&&n===team.attended-1;
    q('INSERT INTO attendance(user_id,lecture_id,kind,verified_by,created,updated) VALUES(?,?,?,?,?,?)',userId,lectureId,self?'self_reported':'verified_by_admin',self?null:organiser,past,past);
   }));
   for(const n of team.weeks){
    const week=weekAgo(n),help=n===0&&team.help?1:0,created=at(-n*7-1);
    q('INSERT INTO checkins(id,project_id,week,metric_name,metric_value,goal,blocker,needs_help,author,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',newId('chk'),projectId,week,'Razgovori s korisnicima',String(Math.max(1,6-n*2)),'Provjeriti glavnu pretpostavku s još pet korisnika.',help?team.help:'',help,ids[0],created,created);
    award(db,{type:'project',id:projectId,amount:10,sourceKey:`checkin:${projectId}:${week}`,reason:'checkin:'+week});
   }
  }
  for(const [key,days] of Object.entries(DUE))q('UPDATE task_templates SET due_at=?,updated=? WHERE key=?',at(days,22),now,key);

  // Mentor hours: one past meeting with a note, one booked for tomorrow, two still free.
  const slot=(id,mentor,days,hour,topic)=>q("INSERT INTO office_hours(id,mentor_id,mentor_name,topic,starts_at,duration_min,location,created_by,created) VALUES(?,?,?,?,?,30,'Soba za sastanke',?,?)",id,'demo-mentor-'+mentor[0],mentor[1],topic,at(days,hour),organiser,past);
  slot('demo-slot-1',MENTORS[1],-5,10,'Cijene');slot('demo-slot-2',MENTORS[0],1,9,'Razgovori s korisnicima');slot('demo-slot-3',MENTORS[3],2,13,'Priprema za investitore');slot('demo-slot-4',MENTORS[2],6,10,'Osnivanje tvrtke');
  q('INSERT INTO office_hour_bookings(slot_id,project_id,booked_by,question,note,created) VALUES(?,?,?,?,?,?)','demo-slot-1','demo-project-greenloop',users.greenloop[0],'Kako naplatiti pilot restoranima?','Dogovoreno: mjesečna naknada po restoranu umjesto naplate po posudi. Tim testira cijenu s tri restorana.',at(-7));
  q('INSERT INTO office_hour_bookings(slot_id,project_id,booked_by,question,created) VALUES(?,?,?,?,?)','demo-slot-2','demo-project-agrobit',users.agrobit[0],'Kako doći do prvih pet poljoprivrednika za razgovor?',at(-1));
  q("INSERT INTO meeting_requests(id,mentor_id,project_id,requested_by,topic,times,price,created) VALUES(?,?,?,?,?,?,0,?)",'demo-meeting-1','demo-mentor-petra-simic','demo-project-edunest',users.edunest[0],'Ugovor s instruktorima: što moramo imati prije prve naplate?','Utorak ili četvrtak poslijepodne',at(-1));

  q("INSERT INTO project_updates(id,project_id,author,body,visibility,created) VALUES(?,?,?,?,'public',?)",'demo-update-1','demo-project-greenloop',users.greenloop[0],'Prvi restoran je platio pilot za idući mjesec. Krećemo s 200 posuda.',at(-2));
  q("INSERT INTO project_outcomes(id,project_id,kind,happened_on,note,author,created) VALUES(?,?,'customer',?,?,?,?)",'demo-outcome-1','demo-project-greenloop',dayOf(-2),'Prvi plaćeni pilot',organiser,at(-2));
  q('INSERT INTO announcements(id,title,body,pinned,author,created) VALUES(?,?,?,1,?,?)','demo-announcement-1','Pitch deck radionica idući tjedan','Donesite trenutnu verziju prezentacije. Tko je još nije učitao u datoteke projekta, neka to napravi do radionice.',organiser,at(-1));
  if(task('user-interviews'))q("INSERT OR IGNORE INTO cohort_quests(id,title,task_id,target,created_by,created) VALUES('demo-quest-1',?,?,4,?,?)",T('4 teams talk to five users each','4 tima razgovaraju s po pet korisnika','4 команды поговорили с пятью пользователями'),task('user-interviews').id,organiser,past);
  q("INSERT INTO settings(key,value,updated) VALUES('demo_filled',?,?)",now,now);
 })();
 return {filled:true,teams:TEAMS.length,accounts:Object.values(users).flat().length,mentors:MENTORS.length,lectures:LECTURES.length};
}
