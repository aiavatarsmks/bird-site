/**
 * Invented cohort for a demo workspace: teams, people, mentors, lectures and eight weeks of activity,
 * so the organiser's screens look like a programme in its second month. All names and projects are made up.
 * The demo accounts have no password and no recovery codes, so nobody can sign in as them.
 * Every invented row carries a "demo-" id somewhere; refreshing removes exactly those rows.
 */
import {createHash} from 'node:crypto';
import {nowIso} from './db.mjs';
import {newId,sha256,token} from './http.mjs';
import {award,badgeForRule} from './progress.mjs';
import {assignForUser,isoWeek,markDone} from './tasks.mjs';

// Bump when the invented cohort changes; a started demo workspace then fills itself again (see startDemo).
export const DEMO_VERSION='3';
export const DEMO_ORGANISER='demo-user-organiser';
const ORGANISER_NAME='Leon Marić',MANAGER_NAME='Mia Horvat';

const DAY=86400000;
const iso=ms=>new Date(ms).toISOString();
const at=(days,hour=12,min=0)=>{const d=new Date(Date.now()+days*DAY);d.setUTCHours(hour,min,0,0);return d.toISOString();};
const dayOf=days=>new Date(Date.now()+days*DAY).toISOString().slice(0,10);
const T=(en,hr,ru)=>JSON.stringify({en,hr,ru});
const zagrebDate=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
/** A wall-clock time in Zagreb as an ISO instant (winter +1, summer +2). */
function zagreb(date,time){
 const [h,m]=time.split(':').map(Number),guess=Date.parse(date+'T00:00:00Z')+(h*60+m-60)*60000;
 const shown=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zagreb',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(guess)).split(':').map(Number);
 return iso(guess+((h*60+m)-(shown[0]*60+shown[1]))*60000);
}
const dow=date=>new Date(date+'T12:00:00Z').getUTCDay();
/** Weekdays (Mon–Fri) around today in Zagreb: n=1 is the next one, n=-1 the previous one; today itself is never returned. */
function weekday(n,days=[1,2,3,4,5]){
 const today=zagrebDate(Date.now());let d=Date.parse(today+'T12:00:00Z'),left=Math.abs(n);
 while(left){d+=Math.sign(n)*DAY;if(days.includes(new Date(d).getUTCDay()))left--;}
 return iso(d).slice(0,10);
}
/** Friday of the programme week n weeks back (0 = this week), never later than an hour ago. */
function reportDay(n){
 const today=zagrebDate(Date.now()),d=Date.parse(today+'T12:00:00Z'),monday=d-((dow(today)+6)%7)*DAY-n*7*DAY;
 const friday=zagreb(iso(monday+4*DAY).slice(0,10),'15:30');
 return Date.parse(friday)<Date.now()-3600000?friday:iso(Date.now()-3*3600000);
}
// Deterministic "random": the same cohort every time it is filled.
function rng(seed){let h=1779033703^seed.length;for(const c of seed){h=Math.imul(h^c.charCodeAt(0),3432918353);h=h<<13|h>>>19;}return ()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return ((h^=h>>>16)>>>0)/4294967296;};}

// log: check-ins from seven weeks ago (first) to this week (last); null is a week without one.
// [metric value, goal, blocker, needs help]. att: share of lectures each member came to. seen: days since the last visit.
const TEAMS=[
 {slug:'greenloop',name:'GreenLoop',members:['Petra S.','Luka D.','Maja R.'],stage:'pilot',
  short:'Povratna ambalaža za dostavu hrane u restoranima.',problem:'Restorani bacaju tisuće jednokratnih kutija mjesečno i plaćaju sve skuplji otpad.',users:'Restorani s dostavom u Zagrebu.',solution:'Posude koje se vraćaju, peru i ponovno koriste, uz praćenje QR kodom.',
  value:'Restoran plaća manje od jednokratne ambalaže i dobiva zeleni znak na platformama za dostavu.',ask:'Tražimo još dva restorana za pilot i kontakt u gradskom uredu za otpad.',
  done:{profile:-52,'problem-users':-44,'user-interviews':-33,'pricing-hypotheses':-26,presentation:-12,'weekly-report':-2,'first-paying-customer':-9},review:['demo-day-kit'],
  metric:'Restorani u pilotu',att:.95,seen:0,
  log:[['0','Dogovoriti 10 razgovora s vlasnicima restorana.','',0],['0','Završiti razgovore i složiti listu problema.','Vlasnici odgovaraju tek navečer.',0],['1','Prvi restoran pristao je na besplatno testiranje od dva tjedna.','',0],['1','Izmjeriti koliko se posuda vrati unutar 48 sati.','Pranje posuda traje dulje nego što smo mislili.',0],['2','Drugi restoran i dogovor s praonicom.','',0],['3','Postaviti cijenu pilota: mjesečna naknada po restoranu.','',0],['4','Prvi plaćeni pilot: 200 posuda.','Treba nam kombi za dostavu posuda.',0],['5','Pripremiti paket za demo dan i zatražiti povratnu informaciju.','',0]]},
 {slug:'mednote',name:'MedNote',members:['Ivan M.','Sara P.'],stage:'prototype',
  short:'Glasovne bilješke za liječnike obiteljske medicine.',problem:'Liječnik potroši trećinu pregleda na tipkanje nalaza.',users:'Ordinacije obiteljske medicine.',solution:'Aplikacija koja razgovor pretvara u nacrt nalaza koji liječnik samo potvrdi.',
  value:'Pet minuta manje tipkanja po pacijentu.',ask:'Tražimo tri ordinacije koje će testirati prototip u studenom.',
  done:{profile:-51,'problem-users':-41,'user-interviews':-30,'pricing-hypotheses':-19,'weekly-report':-3},
  metric:'Liječnici koji testiraju',att:.8,seen:1,
  log:[['0','Razgovarati s pet liječnika o tome kako pišu nalaze.','',0],['0','Snimiti tijek jednog pregleda (uz dopuštenje).','',0],['1','Prvi liječnik testira snimanje bilješki.','Pitanje zaštite podataka pacijenata.',0],null,['2','Provjeriti GDPR s pravnikom i zapisati pravila.','Čekamo odgovor pravnika.',0],['3','Ubrzati prijepis ispod 10 sekundi.','',0],['4','Mjeriti koliko vremena liječnik uštedi.','',0],['5','Ponuditi pretplatu prvoj ordinaciji.','',0]]},
 {slug:'edunest',name:'EduNest',members:['Tena V.','Filip J.','Nina B.'],stage:'prototype',
  short:'Platforma za instrukcije između studenata.',problem:'Studenti prve godine ne mogu pronaći provjerenog instruktora za svoj kolegij.',users:'Studenti tehničkih fakulteta.',solution:'Stariji studenti nude termine, a ocjene i potvrde kolegija su javne.',
  value:'Instrukcija s potvrđenim znanjem kolegija, po cijeni nižoj od agencije.',ask:'Trebamo kontakt studentskog zbora FER-a.',
  done:{profile:-50,'problem-users':-39,'pricing-hypotheses':-21},review:['presentation'],
  metric:'Registrirani instruktori',att:.7,selfReported:true,seen:1,
  log:[null,['3','Pronaći 10 instruktora za matematiku i fiziku.','',0],['7','Testirati rezervaciju termina s 5 studenata.','',0],['12','Dodati potvrdu položenog kolegija.','Fakultet ne daje potvrde elektronički.',0],null,['18','Prva plaćena instrukcija preko platforme.','',0],['21','Smanjiti broj otkazanih termina.','Dio instruktora ne odgovara na poruke.',0],['24','Poslati prezentaciju na pregled prije demo dana.','',0]]},
 {slug:'agrobit',name:'AgroBit',members:['Ana K.','Marko B.'],stage:'idea',
  short:'Senzori i aplikacija za navodnjavanje malih gospodarstava.',problem:'Mali proizvođači zalijevaju po osjećaju i gube urod u sušnim tjednima.',users:'Obiteljska gospodarstva s 2 do 20 hektara.',solution:'Jeftini senzori vlage i preporuka kada i koliko zalijevati.',
  value:'Do 30 % manje vode i manje izgubljenog uroda u sušnim tjednima.',ask:'Kontakt u poljoprivrednoj zadruzi ili savjetodavnoj službi.',
  done:{profile:-49,'problem-users':-36},
  metric:'Razgovori s poljoprivrednicima',att:.7,seen:2,
  log:[['0','Sastaviti listu od 20 gospodarstava.','',0],['1','Obići sajam u Gudovcu.','',0],null,['2','Napraviti prvi prototip senzora.','Kasni isporuka dijelova.',0],['3','Postaviti senzor na jedno polje.','',0],null,['4','Dogovoriti test s dvjema obiteljima iz Slavonije.','Teško dolazimo do poljoprivrednika.',0],['4','Pet razgovora do kraja mjeseca.','Ne možemo doći do poljoprivrednika za razgovore. Treba nam kontakt u zadruzi ili savjetodavnoj službi.',1]]},
 {slug:'parkpilot',name:'ParkPilot',members:['Dino H.','Lea T.'],stage:'idea',
  short:'Rezervacija privatnih parkirnih mjesta u centru grada.',problem:'Vozači kruže po centru dvadeset minuta, a privatna mjesta stoje prazna.',users:'Vozači koji povremeno dolaze u centar.',solution:'Vlasnici iznajmljuju mjesto po satu, vozač rezervira unaprijed.',
  value:'',ask:'',done:{profile:-46},
  metric:'Vlasnici mjesta na listi',att:.25,seen:9,
  log:[['2','Pronaći 10 vlasnika parkirnih mjesta.','',0],['3','Napraviti landing stranicu.','',0],null,['3','Testirati oglas na Facebooku.','Obojica radimo puno radno vrijeme.',0],['4','','',0],null,null,null]},
 // A team that is on the list but has not registered yet: the organiser sees whom to invite.
 {slug:'tourloop',name:'TourLoop',members:['Karlo N.','Ivo Š.'],stage:'idea',accounts:false,
  short:'Pješačke ture koje vode lokalni stanovnici.',problem:'Turisti dobivaju iste ture, a lokalni vodiči nemaju kanal prodaje.',users:'Posjetitelji koji ostaju tri i više dana.',solution:'Katalog kratkih tura s rezervacijom i plaćanjem na jednom mjestu.'},
 {slug:'finbuddy',name:'FinBuddy',members:['Toni G.','Bruno K.'],stage:'prototype',
  short:'Aplikacija za financijsku pismenost srednjoškolaca.',problem:'Mladi dobiju prvu karticu bez ikakvog znanja o budžetu i kreditima.',users:'Srednjoškolci od 15 do 19 godina i njihovi roditelji.',solution:'Kratki izazovi tjedno i virtualni budžet koji prati stvarnu potrošnju.',
  value:'Škola dobiva gotov program financijske pismenosti, roditelj uvid u navike.',ask:'Tražimo dvije srednje škole za pilot u drugom polugodištu.',
  done:{profile:-50,'problem-users':-38,'user-interviews':-24,'pricing-hypotheses':-17},
  metric:'Korisnici na listi čekanja',att:.85,seen:0,
  log:[['40','Anketa u dvije škole.','',0],['85','Prvih 100 prijava na listu čekanja.','',0],['130','Prototip prvog izazova.','',0],['180','Testirati izazov s jednim razredom.','Škola traži suglasnost roditelja.',0],['240','Pripremiti obrazac suglasnosti.','',0],['310','Drugi razred i mjerenje zadržavanja.','',0],['380','Ponuda školi: cijena po razredu.','',0],['455','Dogovoriti sastanak s ravnateljem.','',0]]},
 {slug:'solarshare',name:'SolarShare',members:['Mateo L.','Dario V.'],stage:'pilot',
  short:'Zajednička sunčana elektrana za stambene zgrade.',problem:'Stanari zgrada ne mogu sami postaviti panele i ne znaju kako podijeliti trošak.',users:'Upravitelji i predstavnici stanara u zgradama s ravnim krovom.',solution:'Paket od projekta do raspodjele uštede po stanu, s mjesečnim izvještajem.',
  value:'Niži računi za struju bez ulaganja pojedinog stanara.',ask:'Kontakt upravitelja zgrada u Zagrebu i Rijeci.',
  done:{profile:-48,'problem-users':-37,'user-interviews':-28,'pricing-hypotheses':-14},review:['presentation'],
  metric:'Zgrade u razgovoru',att:.75,seen:3,
  log:[['1','Razgovori s trojicom upravitelja zgrada.','',0],['2','Izračun uštede za jednu zgradu.','',0],['4','Ponuda za prvu zgradu.','Stanari traže sastanak uživo.',0],['5','Održati sastanak stanara.','',0],null,['7','Potpisati pismo namjere.','Čeka se suglasnost dviju trećina stanara.',0],['8','Zatražiti kredit za prvu instalaciju.','',0],['9','Pripremiti prezentaciju za banku.','',0]]},
 {slug:'shiftly',name:'Shiftly',members:['Roko P.','Josip Ž.'],stage:'idea',
  short:'Raspored smjena za sezonske radnike u turizmu.',problem:'Hoteli i restorani na obali slažu smjene u tablicama i svaki tjedan gube radnike.',users:'Mali hoteli i restorani s 10 do 50 sezonskih radnika.',solution:'Aplikacija u kojoj radnici sami mijenjaju smjene, a voditelj samo potvrđuje.',
  value:'Manje praznih smjena i manje poziva voditelju.',ask:'',
  done:{profile:-47,'problem-users':-34,'pricing-hypotheses':-20},
  metric:'Poslodavci na listi',att:.3,seen:6,
  log:[['2','Razgovori s pet hotela u Splitu.','',0],['4','Prototip u tablici.','',0],['5','Prijaviti se na sajam turizma.','',0],['6','Zimski plan: razgovori s restoranima.','Sezona je gotova, poslodavci ne odgovaraju.',0],['6','','',0],['6','Napisati ponudu za sezonu 2027.','',0],null,null]},
];
const MENTORS=[
 ['vesna-radic','Vesna R.','f','Customer discovery','Pomaže timovima pripremiti i provesti prve razgovore s korisnicima.'],
 ['goran-peric','Goran P.','m','Pricing','Cijene i modeli naplate za B2B proizvode.'],
 ['jelena-matic','Jelena M.','f','Legal & IP','Osnivanje tvrtke, ugovori i zaštita intelektualnog vlasništva.'],
 ['boris-lovric','Boris L.','m','Fundraising','Priprema za razgovore s investitorima i poslovnim anđelima.'],
];
// Past lectures: n-th Tuesday or Thursday before today (1 = the latest). Upcoming: n-th after today.
const LECTURES=[
 [-15,'Kick-off: how the programme works','Početak programa: kako radimo','Старт программы: как всё устроено',MANAGER_NAME],
 [-14,'How to talk to your first users','Kako razgovarati s prvim korisnicima','Как говорить с первыми пользователями','Vesna R.'],
 [-12,'Value proposition in one sentence','Vrijednosna ponuda u jednoj rečenici','Ценностное предложение в одном предложении','Vesna R.'],
 [-10,'Pricing for startups','Određivanje cijena za startupe','Ценообразование для стартапов','Goran P.'],
 [-8,'Founder-led sales','Prodaja koju vodi osnivač','Продажи силами основателя','Goran P.'],
 [-6,'Founding a company and IP basics','Osnivanje tvrtke i intelektualno vlasništvo','Регистрация компании и интеллектуальная собственность','Jelena M.'],
 [-4,'Metrics that matter in the first year','Metrike koje su važne u prvoj godini','Метрики, важные в первый год','Boris L.'],
 [-2,'Grants and public funding in Croatia','Bespovratna sredstva i javno financiranje u Hrvatskoj','Гранты и государственное финансирование в Хорватии','Jelena M.'],
 [1,'Pitch deck clinic','Radionica: pitch deck','Разбор питч-деков','Boris L.'],
 [2,'Talking to investors','Razgovor s investitorima','Переговоры с инвесторами','Boris L.'],
 [4,'Demo day rehearsal','Proba demo dana','Репетиция демо-дня',MANAGER_NAME],
];
const FEEDBACK=['Konkretni primjeri, odmah primjenjivo.','Moglo je biti kraće, ali dobro.','Najbolje predavanje do sada.','Trebalo je više vremena za pitanja.','Odlični predlošci za razgovore.','Previše teorije za našu fazu.','Super, može li snimka?','Korisno za cijene u B2B prodaji.'];
// Days from today. Dates are set after the tasks are assigned: assignment skips tasks that are already past due.
const DUE={'problem-users':-3,'pricing-hypotheses':-1,'user-interviews':4,'presentation':9,'demo-day-kit':20};
// Outcomes the funder report counts. [team, kind, funding type, amount, days ago, note]
const OUTCOMES=[
 ['greenloop','funding','grant',15000,-20,'Bespovratna sredstva za dokaz koncepta'],
 ['greenloop','company','',null,-31,'Osnovan GreenLoop d.o.o.'],
 ['greenloop','hire','',2,-8,'Vozač i osoba za pranje posuda, pola radnog vremena'],
 ['greenloop','customer','',3,-9,'Tri restorana plaćaju mjesečni pilot'],
 ['greenloop','revenue','',1350,-2,'Prihod od pilota u listopadu i studenom'],
 ['mednote','funding','equity',25000,-11,'Pre-seed od poslovnog anđela'],
 ['mednote','hire','',1,-5,'Backend developer'],
 ['agrobit','customer','',1,-6,'Prvi plaćeni senzor na OPG-u kod Đakova'],
 ['agrobit','revenue','',180,-6,'Prodan prvi komplet senzora'],
 ['edunest','funding','prize',3000,-16,'Prva nagrada na studentskom startup natjecanju'],
 ['edunest','company','',null,-25,'Osnovan EduNest j.d.o.o.'],
 ['finbuddy','funding','grant',5000,-13,'Gradska potpora za mlade poduzetnike'],
 ['solarshare','customer','',1,-4,'Pismo namjere prve zgrade (24 stana)'],
 ['solarshare','funding','loan',10000,-1,'Odobren povoljni zajam za prvu instalaciju'],
];
const FILES={greenloop:['GreenLoop pitch deck v3.pdf','Pilot ugovor - predložak.pdf'],mednote:['MedNote deck.pdf'],edunest:['EduNest prezentacija.pdf'],solarshare:['SolarShare - izracun ustede.pdf','SolarShare deck.pdf'],finbuddy:['FinBuddy one-pager.pdf']};
const MILESTONES={
 greenloop:[['Prvi plaćeni restoran',-9,true],['Pet restorana u pilotu',14,false],['Kombi za dostavu posuda',30,false]],
 mednote:[['Prototip kod tri liječnika',-6,true],['Mišljenje o zaštiti podataka',7,false]],
 edunest:[['50 instruktora',-3,true],['Suradnja sa studentskim zborom',21,false]],
 agrobit:[['Prvi senzor na polju',-20,true],['Pet razgovora s poljoprivrednicima',10,false]],
 finbuddy:[['Lista čekanja 400',-2,true],['Pilot u prvoj školi',35,false]],
 solarshare:[['Pismo namjere prve zgrade',-4,true],['Instalacija na prvoj zgradi',60,false]],
};
const CHAT=[
 ['greenloop',1,-12,'Ima li netko iskustva s ugovorom o pilotu? Trebamo predložak.'],
 ['solarshare',1,-12,'Mi smo radili jedan za zgradu, šaljem ti ga u poruci.'],
 ['edunest',2,-7,'Tko ide na sajam zapošljavanja na FER-u u četvrtak?'],
 ['finbuddy',1,-7,'Mi idemo, vidimo se tamo.'],
 ['agrobit',1,-3,'Tražimo nekoga tko zna nekoga u zadruzi u Slavoniji. Svaki kontakt pomaže!'],
 ['mednote',2,-2,'Hvala na jučerašnjoj radionici o grantovima, puno nam je toga razjasnila.'],
 ['shiftly',1,-1,'Pitch deck radionica je u četvrtak u 17 h, je li tako?'],
];
const REWARDS=[
 ['demo-reward-1','Dodatni sat s mentorom po izboru','60 minuta s bilo kojim mentorom programa.',60,null],
 ['demo-reward-2','Prioritetni termin za probu pitcha','Proba pred organizatorima tjedan prije demo dana.',40,6],
 ['demo-reward-3','Fotografiranje tima','Profesionalne fotografije za web i LinkedIn.',50,4],
 ['demo-reward-4','Karta za konferenciju','Jedna ulaznica za regionalnu startup konferenciju.',120,3],
 ['demo-reward-5','Pravni pregled ugovora','Pregled jednog ugovora s odvjetnicom programa.',80,5],
];

export function fillDemo(db){
 if(db.query("SELECT 1 FROM settings WHERE key='demo_filled'").get())return {filled:false,reason:'already filled'};
 if(db.query('SELECT 1 FROM projects').get())return {filled:false,reason:'workspace already has projects'};
 const now=nowIso(),past=at(-58,8),random=rng('demo-cohort');
 const task=key=>db.query('SELECT * FROM task_templates WHERE key=?').get(key);
 const q=(sql,...args)=>db.query(sql).run(...args);
 const users={},organiser=DEMO_ORGANISER;
 db.transaction(()=>{
  // Reviews, announcements and verifications are signed by an invented organiser, never by a real account.
  q("INSERT OR IGNORE INTO users(id,login,display_name,role,language,created,updated) VALUES(?,?,?,'program_admin','hr',?,?)",organiser,'demo-organiser',ORGANISER_NAME,past,past);
  // Visitors of the public demo look through this invented manager's eyes, read-only.
  q("INSERT INTO users(id,login,display_name,role,language,created,updated) VALUES('demo-user-manager','demo-manager',?,'program_admin','hr',?,?)",MANAGER_NAME,past,past);

  // Lectures on Tuesdays and Thursdays at 17:00.
  const held=[];
  LECTURES.forEach(([n,en,hr,ru,speaker],i)=>{
   const id='demo-lecture-'+(i+1),date=weekday(n,[2,4]);if(n<0)held.push({id,date});
   q("INSERT INTO lectures(id,date,time,place,speaker,title,created,updated) VALUES(?,?,'17:00','Velika dvorana',?,?,?,?)",id,date,speaker,T(en,hr,ru),past,past);
  });
  for(const [slug,name,gender,area,bio] of MENTORS)q("INSERT INTO mentors(id,name,area,bio,gender,created_by,created,updated) VALUES(?,?,?,?,?,'demo',?,?)",'demo-mentor-'+slug,name,area,bio,gender,past,past);

  for(const team of TEAMS){
   const teamId='demo-team-'+team.slug,projectId='demo-project-'+team.slug;
   const content=JSON.stringify({name:team.name,short:team.short,problem:team.problem,users:team.users,solution:team.solution,value:team.value||'',ask:team.ask||'',nextSteps:'',details:'',stage:team.stage,links:[]});
   q('INSERT INTO teams(id,name,created) VALUES(?,?,?)',teamId,team.name,past);
   q("INSERT INTO projects(id,team_id,source,status,draft,draft_version,published,published_version,published_at,created,updated) VALUES(?,?,'curated','published',?,1,?,1,?,?,?)",projectId,teamId,content,content,past,past,past);
   q("INSERT INTO project_revisions(project_id,version,kind,content,author,created) VALUES(?,1,'published',?,NULL,?)",projectId,content,past);
   users[team.slug]=[];
   team.members.forEach((name,i)=>{
    const personId=`demo-person-${team.slug}-${i+1}`,userId=`demo-user-${team.slug}-${i+1}`,joined=at(-56+i,9+i);
    q("INSERT INTO people(id,display_name,kind,source,created,updated) VALUES(?,?,'participant','curated',?,?)",personId,name,past,past);
    q('INSERT INTO team_people(team_id,person_id) VALUES(?,?)',teamId,personId);
    if(team.accounts===false)return;
    q("INSERT INTO users(id,login,display_name,role,person_id,language,created,updated) VALUES(?,?,?,'member',?,'hr',?,?)",userId,`demo-${team.slug}-${i+1}`,name,personId,joined,joined);
    q('INSERT INTO memberships(project_id,user_id,role,created) VALUES(?,?,?,?)',projectId,userId,i?'editor':'owner',joined);
    // A closed session only records when the person was last seen.
    const seen=team.seen?at(-team.seen-(i?1:0),8+i*3,17):iso(Date.now()-(40+i*55)*60000);
    q('INSERT INTO sessions(id,user_id,token_hash,csrf,device,created,last_seen,expires,revoked_at) VALUES(?,?,?,?,?,?,?,0,?)',newId('ses'),userId,sha256(token()),token(8),'demo',joined,seen,now);
    users[team.slug].push(userId);
   });
  }

  for(const ids of Object.values(users))for(const id of ids)assignForUser(db,db.query('SELECT * FROM users WHERE id=?').get(id));
  // Work happened over eight weeks: every completed task keeps the day it was done on.
  const backdate=(t,ids,projectId,when)=>{
   const asg=t.scope==='personal'?db.query(`SELECT id FROM assignments WHERE task_id=? AND user_id IN (${ids.map(()=>'?').join(',')})`).all(t.id,...ids):db.query('SELECT id FROM assignments WHERE task_id=? AND project_id=?').all(t.id,projectId);
   asg.forEach(({id},j)=>{
    const stamp=iso(Date.parse(when)+j*5400000);
    for(const s of db.query('SELECT id FROM submissions WHERE assignment_id=?').all(id)){
     q('UPDATE submissions SET created=?,updated=? WHERE id=?',stamp,stamp,s.id);
     q('UPDATE submission_revisions SET created=? WHERE submission_id=?',stamp,s.id);
     q('UPDATE reviews SET created=? WHERE submission_id=?',iso(Date.parse(stamp)+20*3600000),s.id);
    }
    q("UPDATE notifications SET created=? WHERE json_extract(payload,'$.assignmentId')=?",stamp,id);
   });
   const beneficiaries=t.scope==='personal'?ids:[projectId];
   q(`UPDATE xp_ledger SET created=? WHERE reason=? AND beneficiary_id IN (${beneficiaries.map(()=>'?').join(',')})`,iso(Date.parse(when)+20*3600000),'task:'+t.key,...beneficiaries);
  };
  for(const team of TEAMS){
   const ids=users[team.slug],projectId='demo-project-'+team.slug;if(!ids.length)continue;
   const mark=(key,review,days)=>{const t=task(key);if(!t)return;for(const userId of t.scope==='personal'?ids:[ids[0]])markDone(db,{task:t,userId,projectId,actor:review?userId:organiser,source:'demo',review});backdate(t,ids,projectId,at(days,9+Math.floor(random()*8)));};
   for(const [key,days] of Object.entries(team.done))mark(key,false,days);
   for(const key of team.review||[])mark(key,true,-1-Math.floor(random()*3));

   // Attendance: each member came to their share of the lectures; points for every verified visit.
   ids.forEach((userId,i)=>held.forEach((lecture,n)=>{
    const self=team.selfReported&&i===0&&n===held.length-1,recent=n>=held.length-2,came=self||random()<team.att+(i?-.08:.05)||(n===0&&team.att>.3);
    if(!came)return;
    const stamp=zagreb(lecture.date,'19:10');
    q('INSERT INTO attendance(user_id,lecture_id,kind,verified_by,created,updated) VALUES(?,?,?,?,?,?)',userId,lecture.id,self?'self_reported':'verified_by_admin',self?null:organiser,stamp,stamp);
    if(!self){award(db,{type:'user',id:userId,amount:10,sourceKey:'attendance:'+lecture.id,reason:'attendance:verified',actor:organiser});q("UPDATE xp_ledger SET created=? WHERE beneficiary_id=? AND source_key=?",zagreb(lecture.date,'21:00'),userId,'attendance:'+lecture.id);}
    // Most people rate the lecture; about half are promoters, a few are not convinced.
    if(random()<(recent?.55:.7)){
     const r=random(),score=r<.55?(r<.3?10:9):r<.85?(r<.72?8:7):5+Math.floor(random()*2);
     q('INSERT INTO lecture_feedback(user_id,lecture_id,score,comment,created,updated) VALUES(?,?,?,?,?,?)',userId,lecture.id,score,random()<.3?FEEDBACK[Math.floor(random()*FEEDBACK.length)]:'',stamp,stamp);
    }
   }));

   // The lecture tasks follow the attendance: done on the day of the first and of the third verified lecture.
   for(const userId of ids){
    const days=db.query("SELECT l.date FROM attendance a JOIN lectures l ON l.id=a.lecture_id WHERE a.user_id=? AND a.kind='verified_by_admin' ORDER BY l.date").all(userId).map(r=>r.date);
    if(days.length>=3)badgeForRule(db,userId,'attendance.3');
    for(const [key,n] of [['one-lecture',1],['three-lectures',3]]){const t=task(key);if(!t||days.length<n)continue;markDone(db,{task:t,userId,projectId,actor:organiser,source:'demo'});backdate(t,[userId],projectId,zagreb(days[n-1],'20:00'));}
   }

   // Weekly check-ins, one per programme week the team reported.
   team.log.forEach((entry,k)=>{
    if(!entry)return;
    const weeksAgo=team.log.length-1-k,created=reportDay(weeksAgo),week=isoWeek(new Date(created));
    const [value,goal,blocker,help]=entry;
    q('INSERT INTO checkins(id,project_id,week,metric_name,metric_value,goal,blocker,needs_help,author,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',newId('chk'),projectId,week,team.metric,value,goal||'Nastaviti razgovore s korisnicima.',blocker,help,ids[k%ids.length],created,created);
    award(db,{type:'project',id:projectId,amount:10,sourceKey:`checkin:${projectId}:${week}`,reason:'checkin:'+week});
    q('UPDATE xp_ledger SET created=? WHERE beneficiary_id=? AND source_key=?',created,projectId,`checkin:${projectId}:${week}`);
   });
  }
  for(const [key,days] of Object.entries(DUE))q('UPDATE task_templates SET due_at=?,updated=? WHERE key=?',at(days,22),now,key);
  // Badges and reminders arrived along the way, not all in the minute the demo was filled.
  for(const b of db.query("SELECT user_id,badge_id FROM badge_awards WHERE user_id LIKE 'demo-user-%'").all()){
   const stamp=at(-Math.floor(random()*40)-3,10);
   q('UPDATE badge_awards SET created=? WHERE user_id=? AND badge_id=?',stamp,b.user_id,b.badge_id);
   q("UPDATE notifications SET created=? WHERE user_id=? AND kind='badge' AND json_extract(payload,'$.badgeId')=?",stamp,b.user_id,b.badge_id);
   q("UPDATE progress_events SET created=? WHERE user_id=? AND kind='badge' AND ref=?",stamp,b.user_id,b.badge_id);
  }
  q("UPDATE progress_events SET created=(SELECT x.created FROM xp_ledger x WHERE x.source_key=progress_events.ref AND x.beneficiary_id=coalesce(progress_events.user_id,progress_events.project_id)) WHERE coalesce(user_id,project_id) LIKE 'demo-%' AND kind='xp.awarded'");
  q("UPDATE notifications SET read_at=created WHERE user_id LIKE 'demo-user-%' AND created<?",at(-3));

  // Mentor hours on weekdays: past meetings with notes, booked and free slots ahead.
  const slot=(id,mentor,day,time,topic)=>q("INSERT INTO office_hours(id,mentor_id,mentor_name,topic,starts_at,duration_min,location,created_by,created) VALUES(?,?,?,?,?,30,'Soba za sastanke',?,?)",id,'demo-mentor-'+mentor[0],mentor[1],topic,zagreb(weekday(day),time),organiser,past);
  const book=(slotId,team,question,note,day)=>q('INSERT INTO office_hour_bookings(slot_id,project_id,booked_by,question,note,created) VALUES(?,?,?,?,?,?)',slotId,'demo-project-'+team,users[team][0],question,note,at(day,10));
  slot('demo-slot-1',MENTORS[1],-14,'10:00','Cijene');slot('demo-slot-2',MENTORS[0],-9,'14:00','Razgovori s korisnicima');slot('demo-slot-3',MENTORS[2],-4,'11:00','Osnivanje tvrtke');
  slot('demo-slot-4',MENTORS[0],1,'09:30','Razgovori s korisnicima');slot('demo-slot-5',MENTORS[3],2,'13:00','Priprema za investitore');slot('demo-slot-6',MENTORS[2],3,'10:00','Ugovori i IP');slot('demo-slot-7',MENTORS[1],5,'15:00','Cijene');
  book('demo-slot-1','greenloop','Kako naplatiti pilot restoranima?','Dogovoreno: mjesečna naknada po restoranu umjesto naplate po posudi. Tim testira cijenu s tri restorana.',-16);
  book('demo-slot-2','finbuddy','Kako pitati roditelje o navikama djece bez neugodnih pitanja?','Pripremili smo pet otvorenih pitanja; tim ih testira u dvije škole.',-11);
  book('demo-slot-3','mednote','Treba li nam d.o.o. prije prvog ugovora s ordinacijom?','Preporuka: d.o.o. prije prvog plaćenog ugovora; do tada pilot bez naknade.',-6);
  book('demo-slot-4','agrobit','Kako doći do prvih pet poljoprivrednika za razgovor?','',-1);
  book('demo-slot-5','solarshare','Kako predstaviti zgradu kao kupca investitoru?','',-1);
  q("INSERT INTO meeting_requests(id,mentor_id,project_id,requested_by,topic,times,price,created) VALUES(?,?,?,?,?,?,0,?)",'demo-meeting-1','demo-mentor-jelena-matic','demo-project-edunest',users.edunest[0],'Ugovor s instruktorima: što moramo imati prije prve naplate?','Utorak ili četvrtak poslijepodne',at(-1,11));

  // Team news, milestones, files and outcomes.
  q("INSERT INTO project_updates(id,project_id,author,body,visibility,created) VALUES(?,?,?,?,'public',?)",'demo-update-1','demo-project-greenloop',users.greenloop[0],'Prvi restoran je platio pilot za idući mjesec. Krećemo s 200 posuda.',at(-9,15));
  q("INSERT INTO project_updates(id,project_id,author,body,visibility,created) VALUES(?,?,?,?,'public',?)",'demo-update-2','demo-project-mednote',users.mednote[0],'Zatvorili smo pre-seed rundu od 25.000 €. Zapošljavamo backend developera.',at(-11,12));
  q("INSERT INTO project_updates(id,project_id,author,body,visibility,created) VALUES(?,?,?,?,'public',?)",'demo-update-3','demo-project-finbuddy',users.finbuddy[0],'Lista čekanja prešla je 450 učenika iz šest škola.',at(-2,18));
  q("INSERT INTO project_updates(id,project_id,author,body,visibility,created) VALUES(?,?,?,?,'public',?)",'demo-update-4','demo-project-solarshare',users.solarshare[0],'Prva zgrada potpisala je pismo namjere. Sljedeći korak: zajam za instalaciju.',at(-4,16));
  for(const [team,list] of Object.entries(MILESTONES))list.forEach(([title,days,done],i)=>q('INSERT INTO project_milestones(id,project_id,title,due,done_at,author,created) VALUES(?,?,?,?,?,?,?)',`demo-milestone-${team}-${i+1}`,'demo-project-'+team,title,dayOf(days),done?at(days,14):null,users[team][0],at(-40+i*5,10)));
  for(const [team,names] of Object.entries(FILES))names.forEach((filename,i)=>{
   const bytes=placeholderPdf(filename),key=createHash('sha1').update('demo-file:'+team+':'+filename).digest('hex');
   q("INSERT INTO files(id,project_id,owner_user_id,purpose,storage_key,filename,mime,size,sha256,visibility,scan_status,created) VALUES(?,?,?,'document',?,?,'application/pdf',?,?,?,'not_scanned',?)",`demo-file-${team}-${i+1}`,'demo-project-'+team,users[team][i%users[team].length],key,filename,bytes.length,createHash('sha256').update(bytes).digest('hex'),i?'team':'public',at(-12+i*4-Math.floor(random()*6),11));
  });
  OUTCOMES.forEach(([team,kind,type,amount,days,note],i)=>q('INSERT INTO project_outcomes(id,project_id,kind,funding_type,amount,currency,happened_on,note,author,created) VALUES(?,?,?,?,?,?,?,?,?,?)',`demo-outcome-${i+1}`,'demo-project-'+team,kind,type,amount,'EUR',dayOf(days),note,i%3?users[team][0]:organiser,at(days+1,10)));

  // Announcements and who has read them.
  const ann=[['demo-announcement-1','Pitch deck radionica u četvrtak','Donesite trenutnu verziju prezentacije. Tko je još nije učitao u datoteke projekta, neka to napravi do radionice.',1,-1,MANAGER_NAME],
   ['demo-announcement-2','Prijave za demo dan su otvorene','Demo dan je za četiri tjedna. Paket za demo dan pošaljite na pregled najkasnije tjedan ranije.',0,-6,MANAGER_NAME],
   ['demo-announcement-3','Novi termini mentora','Goran i Vesna dodali su termine za idući tjedan. Rezervirajte ih u kartici Mentori.',0,-13,ORGANISER_NAME]];
  for(const [id,title,body,pinned,days,by] of ann)q('INSERT INTO announcements(id,title,body,pinned,author,created) VALUES(?,?,?,?,?,?)',id,title,body,pinned,by===MANAGER_NAME?'demo-user-manager':organiser,at(days,8));
  const everyone=Object.values(users).flat();
  ann.forEach(([id,,,,days],a)=>everyone.forEach(userId=>{if(random()<[.45,.8,.9][a])q('INSERT OR IGNORE INTO announcement_reads(user_id,announcement_id,read_at) VALUES(?,?,?)',userId,id,at(days+Math.floor(random()*3),9+Math.floor(random()*10)));}));

  // The cohort chat: a few questions and answers between teams.
  q("INSERT OR IGNORE INTO chat_groups(id,title,created_by,created) VALUES('chat-everyone','Everyone',?,?)",organiser,past);
  for(const id of [organiser,'demo-user-manager',...everyone])q("INSERT OR IGNORE INTO chat_members(group_id,user_id,role,joined,last_read) VALUES('chat-everyone',?,'member',?,0)",id,past);
  CHAT.forEach(([team,n,days,body],i)=>q("INSERT INTO chat_messages(id,group_id,sender_id,body,created) VALUES(?,'chat-everyone',?,?,?)",`demo-chat-${i+1}`,users[team][(n-1)%users[team].length],body,at(days,8+i)));

  // Rewards teams can spend points on, and two orders.
  for(const [id,title,description,price,stock] of REWARDS)q('INSERT INTO rewards(id,title,description,price,stock,created_by,created) VALUES(?,?,?,?,?,?,?)',id,title,description,price,stock,organiser,past);
  q("INSERT INTO reward_orders(id,reward_id,project_id,ordered_by,price,status,decided_by,decided_at,created) VALUES('demo-order-1','demo-reward-3','demo-project-greenloop',?,50,'approved',?,?,?)",users.greenloop[0],organiser,at(-5,12),at(-6,17));
  q("INSERT INTO reward_orders(id,reward_id,project_id,ordered_by,price,status,created) VALUES('demo-order-2','demo-reward-2','demo-project-finbuddy',?,40,'pending',?)",users.finbuddy[1],at(-1,19));

  if(task('user-interviews'))q("INSERT OR IGNORE INTO cohort_quests(id,title,task_id,target,created_by,created) VALUES('demo-quest-1',?,?,6,?,?)",T('6 teams talk to five users each','6 timova razgovara s po pet korisnika','6 команд поговорили с пятью пользователями'),task('user-interviews').id,organiser,past);
  // The organiser's own trail, so the audit page reads like a working programme.
  const trail=[['announcement.create','announcement','demo-announcement-3',-13,{}],['outcome.add','project','demo-project-greenloop',-19,{kind:'funding'}],['xp.adjust','project','demo-project-edunest',-15,{amount:15,reason:'Pomogli FinBuddyju s anketom u školama'}],['nudge.send','users','demo-project-parkpilot',-6,{sent:2}],['announcement.create','announcement','demo-announcement-2',-6,{}],['nudge.send','users','demo-project-shiftly',-3,{sent:2}],['announcement.create','announcement','demo-announcement-1',-1,{}]].sort((a,b)=>a[3]-b[3]);
  for(const [action,type,target,days,detail] of trail)q('INSERT INTO audit_log(actor,action,target_type,target_id,detail,created) VALUES(?,?,?,?,?,?)',action==='announcement.create'&&target!=='demo-announcement-3'?'demo-user-manager':organiser,action,type,target,JSON.stringify(detail),at(days,9));
  // What the trail says happened: a manual correction in the ledger and reminders in the teams' inboxes.
  award(db,{type:'project',id:'demo-project-edunest',amount:15,sourceKey:'manual:demo-adj-1',reason:'manual:Pomogli FinBuddyju s anketom u školama',actor:organiser});
  q("UPDATE xp_ledger SET created=? WHERE source_key='manual:demo-adj-1'",at(-15,9));
  for(const [team,days,message] of [['parkpilot',-6,'Niste se javili već dva tjedna. Recite nam ako vam treba pomoć s planom.'],['shiftly',-3,'Podsjetnik: ovaj tjedan još se niste javili, a u četvrtak je predavanje.']])for(const userId of users[team])q("INSERT INTO notifications(id,user_id,kind,payload,read_at,created) VALUES(?,?,'nudge',?,NULL,?)",newId('ntf'),userId,JSON.stringify({message,from:ORGANISER_NAME}),at(days,9));
  q("INSERT INTO settings(key,value,updated) VALUES('demo_filled',?,?)",now,now);
  q("INSERT INTO settings(key,value,updated) VALUES('demo_version',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated",DEMO_VERSION,now);
 })();
 return {filled:true,teams:TEAMS.length,accounts:Object.values(users).flat().length,mentors:MENTORS.length,lectures:LECTURES.length};
}

/** A one-page PDF with the file's name on it, so a demo download opens instead of failing. */
function placeholderPdf(title){
 const text=title.replace(/[^\x20-\x7e]/g,'').replace(/[()\\]/g,'');
 const stream=`BT /F1 20 Tf 72 720 Td (${text}) Tj ET\nBT /F1 11 Tf 72 690 Td (Demo file: invented content.) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((o,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 const xref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return new TextEncoder().encode(out);
}
/** Writes the stored objects of the invented files that are missing (after a fill, or on a new volume). */
export async function ensureDemoFiles(db,storage){
 let written=0;
 for(const f of db.query("SELECT id,storage_key,filename FROM files WHERE id LIKE 'demo-file-%' AND status='active'").all()){
  if(await storage.exists(f.storage_key))continue;
  await storage.put(f.storage_key,placeholderPdf(f.filename));written++;
 }
 return written;
}

/**
 * Repairs authorship in a demo filled before the invented organiser existed: everything the filler signed
 * with a real organiser's account moves to the invented one. Only rows tied to invented content change
 * (a "demo-" id in the row, or a submission of an invented assignment); real accounts keep everything else.
 * Safe to run on every start.
 */
export function repairDemo(db){
 if(!db.query("SELECT 1 FROM settings WHERE key='demo_filled'").get())return {repaired:0};
 const now=nowIso();let repaired=0;
 db.transaction(()=>{
  db.query("INSERT OR IGNORE INTO users(id,login,display_name,role,language,created,updated) VALUES(?,?,?,'program_admin','hr',?,?)").run(DEMO_ORGANISER,'demo-organiser',ORGANISER_NAME,now,now);
  // The first fill called the organiser "Demo organiser" and the manager just "Mia".
  db.query("UPDATE users SET display_name=? WHERE id=? AND display_name='Demo organiser'").run(ORGANISER_NAME,DEMO_ORGANISER);
  db.query("UPDATE users SET display_name=? WHERE id='demo-user-manager' AND display_name='Mia'").run(MANAGER_NAME);
  const real=db.query("SELECT id,display_name FROM users WHERE id NOT LIKE 'demo-%'").all();
  if(!real.length)return;
  const ids=real.map(u=>u.id),marks=ids.map(()=>'?').join(',');
  const demoSubmissions="SELECT s.id FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.user_id LIKE 'demo-%' OR a.project_id LIKE 'demo-%'";
  const special={reviews:{reviewer:`submission_id IN (${demoSubmissions})`},submission_revisions:{submitted_by:`submission_id IN (${demoSubmissions})`},submissions:{submitted_by:`id IN (${demoSubmissions})`}};
  const PEOPLE=['author','reviewer','actor','verified_by','created_by','submitted_by','decided_by','resolved_by','booked_by','requested_by'];
  for(const {name} of db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('users','sessions','password_credentials','recovery_codes')").all()){
   const cols=db.query(`PRAGMA table_info("${name}")`).all();
   const text=cols.filter(c=>!c.type||/TEXT/i.test(c.type)).map(c=>c.name);
   for(const col of cols.map(c=>c.name).filter(c=>PEOPLE.includes(c))){
    const tie=special[name]?.[col]||text.filter(c=>c!==col).map(c=>`"${c}" LIKE 'demo-%'`).join(' OR ');
    if(!tie)continue;
    repaired+=db.query(`UPDATE "${name}" SET "${col}"=? WHERE "${col}" IN (${marks}) AND (${tie})`).run(DEMO_ORGANISER,...ids).changes;
   }
  }
  // Nudges carried the sender's name.
  for(const u of real)repaired+=db.query("UPDATE notifications SET payload=json_set(payload,'$.from',?) WHERE user_id LIKE 'demo-%' AND json_extract(payload,'$.from')=?").run(ORGANISER_NAME,u.display_name).changes;
 })();
 return {repaired};
}

/**
 * On start of a demo workspace: an older invented cohort is filled again (fresh dates, current content),
 * and authorship is repaired. A workspace with real projects is never refilled.
 */
export function startDemo(db,now=Date.now()){
 const filled=db.query("SELECT value FROM settings WHERE key='demo_filled'").get()?.value;
 if(!filled)return null;
 const version=db.query("SELECT value FROM settings WHERE key='demo_version'").get()?.value;
 const refilled=version===DEMO_VERSION&&!demoStale(filled,now)?null:refillDemo(db);
 return {refilled,...repairDemo(db)};
}
// The invented cohort's dates are relative to the day it was filled ("lecture tomorrow", "seen today"),
// so it is filled again once it is this many Zagreb days old. The server checks hourly: the refill lands just after midnight.
export const DEMO_FRESH_DAYS=1;
export const demoStale=(filled,now=Date.now())=>(Date.parse(zagrebDate(now))-Date.parse(zagrebDate(Date.parse(filled))))/DAY>=DEMO_FRESH_DAYS;

/**
 * Removes everything the filler made and fills again, so dates are fresh before a meeting.
 * Every invented row carries a "demo-" id somewhere; the workspace owner and real accounts stay.
 */
const KEEP={task_templates:['id','key','translations','checklist'],badge_definitions:['id','translations','rule'],settings:['key']};
// Tables the refill never touches: pilot requests from the landing are real people, whatever they typed.
const SKIP=new Set(['pilot_requests']);
export function refillDemo(db){
 if(!db.query("SELECT 1 FROM settings WHERE key='demo_filled'").get())return fillDemo(db);
 const real=db.query("SELECT count(*) n FROM projects WHERE id NOT LIKE 'demo-%'").get().n;
 if(real)return {filled:false,reason:'workspace has projects that are not part of the demo'};
 // Visitors borrowing an invented account keep their session across the refill (the accounts keep their ids).
 const visits=db.query("SELECT * FROM sessions WHERE user_id LIKE 'demo-user-%' AND revoked_at IS NULL AND expires>?").all(Date.now());
 db.exec('PRAGMA foreign_keys=OFF');
 try{
  db.transaction(()=>{
   for(const {name} of db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().filter(t=>!SKIP.has(t.name))){
    // Task and badge definitions belong to the workspace, even when a key starts like "demo-day-kit".
    const cols=db.query(`PRAGMA table_info("${name}")`).all().filter(c=>(!c.type||/TEXT/i.test(c.type))&&!(KEEP[name]||[]).includes(c.name)).map(c=>c.name);
    if(cols.length)db.query(`DELETE FROM "${name}" WHERE ${cols.map(c=>`"${c}" LIKE 'demo-%'`).join(' OR ')}`).run();
   }
   // Rows that hang only on what was just removed (a review of an invented submission signed by a real account).
   for(const sql of ['DELETE FROM submissions WHERE assignment_id NOT IN (SELECT id FROM assignments)','DELETE FROM submission_revisions WHERE submission_id NOT IN (SELECT id FROM submissions)','DELETE FROM reviews WHERE submission_id NOT IN (SELECT id FROM submissions)','DELETE FROM announcement_reads WHERE announcement_id NOT IN (SELECT id FROM announcements)','DELETE FROM reward_orders WHERE reward_id NOT IN (SELECT id FROM rewards)','DELETE FROM chat_reports WHERE message_id NOT IN (SELECT id FROM chat_messages)'])db.query(sql).run();
   db.query("DELETE FROM settings WHERE key IN ('demo_filled','demo_version')").run();
   // Assignment skips tasks that are already past due, so the old demo deadlines must go first.
   for(const key of Object.keys(DUE))db.query('UPDATE task_templates SET due_at=NULL WHERE key=?').run(key);
  })();
 }finally{db.exec('PRAGMA foreign_keys=ON');}
 const result=fillDemo(db);
 const back=db.query('INSERT OR IGNORE INTO sessions(id,user_id,token_hash,csrf,device,created,last_seen,expires,revoked_at) SELECT ?,?,?,?,?,?,?,?,NULL WHERE EXISTS(SELECT 1 FROM users WHERE id=?)');
 db.transaction(()=>{for(const v of visits)back.run(v.id,v.user_id,v.token_hash,v.csrf,v.device,v.created,v.last_seen,v.expires,v.user_id);})();
 return result;
}
