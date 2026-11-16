/**
 * Report for the funder: programme KPIs for a period, each number with the records it comes from.
 * JSON for the admin tab, CSV (UTF-8 with BOM, opens in Excel with Croatian letters), a minimal XLSX
 * written without dependencies, and a print-ready A4 page the browser saves as PDF.
 * Funder labels (national call, ERDF, EBN) are approximate mappings, never official field numbers.
 */
import {fail,json,readJson} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,requireAdmin} from './permissions.mjs';
import {isoWeek} from './tasks.mjs';
import {csvCell} from './cohort.mjs';
import {isDemoUser} from './demo-visit.mjs';

const L=(en,hr,ru)=>({en,hr,ru});
const LANGS=['en','hr','ru'];
const DAY=86400000;
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
const addDays=(iso,n)=>new Date(Date.parse(iso+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const RECORD_LIMIT=200;

// Organiser verification of outcomes lives beside project_outcomes, so the shared migration list stays untouched.
// The table is additive and created on first use; dropping it loses only the verify marks.
const ready=new WeakSet();
function ensureChecks(db){
 if(ready.has(db))return;
 db.exec('CREATE TABLE IF NOT EXISTS outcome_checks(outcome_id TEXT PRIMARY KEY REFERENCES project_outcomes(id) ON DELETE CASCADE,verified_by TEXT NOT NULL,verified_at TEXT NOT NULL)');
 ready.add(db);
}

/** The programme period when weeks are planned, otherwise the last four months up to today. */
export function defaultPeriod(db){
 const w=db.query('SELECT min(starts) a,max(ends) b FROM program_weeks').get();
 if(w?.a&&isDate(w.a.slice(0,10))&&isDate(w.b?.slice(0,10)))return {from:w.a.slice(0,10),to:w.b.slice(0,10),basis:'programme'};
 const t=today(),d=new Date(Date.parse(t+'T00:00:00Z'));d.setUTCMonth(d.getUTCMonth()-4);
 return {from:d.toISOString().slice(0,10),to:t,basis:'last4months'};
}
function period(ctx){
 const q=ctx.url.searchParams,def=defaultPeriod(ctx.db);
 const from=q.get('from')||def.from,to=q.get('to')||def.to;
 if(!isDate(from))fail(400,'INVALID_FIELDS',{field:'from'});
 if(!isDate(to))fail(400,'INVALID_FIELDS',{field:'to'});
 if(from>to)fail(400,'INVALID_FIELDS',{field:'to'});
 if(Date.parse(to)-Date.parse(from)>3*366*DAY)fail(400,'INVALID_FIELDS',{field:'from'});
 return {from,to,basis:q.get('from')||q.get('to')?'custom':def.basis};
}
function weeksIn(from,to){
 const out=[];let d=from;
 while(d<=to){const w=isoWeek(new Date(d+'T12:00:00Z'));if(!out.includes(w))out.push(w);d=addDays(d,1);}
 return out;
}
const inRange=(col)=>`substr(${col},1,10) BETWEEN ? AND ?`;
const marks=a=>a.map(()=>'?').join(',');
const nameOf=p=>{try{return JSON.parse(p.draft).name||p.id;}catch{return p.id;}};

/** Workspace name for the report header: the configured workspace, then the programme, then BIRD. */
function workspaceName(ctx){
 if(ctx.config.workspace?.name)return ctx.config.workspace.name;
 const p=ctx.db.query('SELECT name FROM programs ORDER BY created LIMIT 1').get();
 if(p){try{const n=JSON.parse(p.name);return n.en||Object.values(n)[0]||'BIRD';}catch{return p.name;}}
 return 'BIRD';
}

/** Collects every number of the report for one period. Pure read; no writes except the verify table. */
export function buildReport(db,{from,to,basis='custom'},{workspace='BIRD',canVerify=true}={}){
 ensureChecks(db);
 const now=today(),until=to<now?to:now;
 const projects=db.query("SELECT * FROM projects WHERE status<>'archived' OR substr(coalesce(archived_at,''),1,10)>=? ORDER BY json_extract(draft,'$.name')").all(from);
 const teams=projects.map(p=>{
  const members=db.query("SELECT u.id,u.person_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.project_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member')").all(p.id);
  const roster=p.team_id?db.query('SELECT person_id FROM team_people WHERE team_id=?').all(p.team_id).map(r=>r.person_id):[];
  const people=new Set([...roster.map(id=>'p:'+id),...members.map(m=>m.person_id?'p:'+m.person_id:'u:'+m.id)]);
  return {id:p.id,name:nameOf(p),status:p.status,userIds:members.map(m=>m.id),people};
 });
 const projectIds=teams.map(t=>t.id),byId=new Map(teams.map(t=>[t.id,t]));
 const allUsers=[...new Set(teams.flatMap(t=>t.userIds))];
 const peopleKeys=new Set(teams.flatMap(t=>[...t.people]));
 const teamOfUser=new Map();for(const t of teams)for(const u of t.userIds)if(!teamOfUser.has(u))teamOfUser.set(u,t.id);

 // Outcomes in the period, with who entered them and whether an organiser verified them.
 const outcomes=projectIds.length?db.query(`SELECT o.*,u.role author_role,u.display_name author_name,c.verified_at,c.verified_by FROM project_outcomes o LEFT JOIN users u ON u.id=o.author LEFT JOIN outcome_checks c ON c.outcome_id=o.id WHERE o.project_id IN (${marks(projectIds)}) AND o.happened_on BETWEEN ? AND ? ORDER BY o.happened_on,o.id`).all(...projectIds,from,to):[];
 const proof=o=>o.verified_at?'verified':['program_admin','platform_owner'].includes(o.author_role)?'organiser':'self';
 const outRec=o=>({id:o.id,teamId:o.project_id,team:byId.get(o.project_id)?.name||o.project_id,date:o.happened_on,kind:o.kind,fundingType:o.funding_type||'',amount:o.amount,note:o.note,author:o.author_name||'',proof:proof(o)});
 const proofCount=list=>({verified:list.filter(o=>proof(o)==='verified').length,organiser:list.filter(o=>proof(o)==='organiser').length,self:list.filter(o=>proof(o)==='self').length});
 const count=o=>o.amount===null||o.amount===undefined?1:Number(o.amount)||0;
 const of=(kind,type)=>outcomes.filter(o=>o.kind===kind&&(!type||o.funding_type===type));
 const sum=list=>list.reduce((n,o)=>n+(Number(o.amount)||0),0);

 // Lectures held in the period (not in the future), and attendance of the cohort's accounts.
 const lectures=db.query(`SELECT id,date,title FROM lectures WHERE status='published' AND date BETWEEN ? AND ? ORDER BY date`).all(from,until);
 const lectureIds=lectures.map(l=>l.id);
 const att=lectureIds.length&&allUsers.length?db.query(`SELECT user_id,lecture_id,kind FROM attendance WHERE lecture_id IN (${marks(lectureIds)}) AND user_id IN (${marks(allUsers)})`).all(...lectureIds,...allUsers):[];
 const expected=lectures.length*allUsers.length;

 // Mentor sessions: booked office hours that took place in the period. Duration is stored per slot.
 const sessions=projectIds.length?db.query(`SELECT h.id,h.mentor_name,h.topic,h.starts_at,h.duration_min,b.project_id FROM office_hour_bookings b JOIN office_hours h ON h.id=b.slot_id WHERE h.cancelled_at IS NULL AND b.project_id IN (${marks(projectIds)}) AND ${inRange('h.starts_at')} AND h.starts_at<=? ORDER BY h.starts_at`).all(...projectIds,from,to,nowIso()):[];
 const minutes=sessions.reduce((n,s)=>n+(Number(s.duration_min)||0),0);

 // Weekly check-ins: share of teams that reported in each week of the period.
 const weeks=from<=until?weeksIn(from,until):[];
 const checkins=projectIds.length&&weeks.length?db.query(`SELECT id,project_id,week,metric_name,metric_value FROM checkins WHERE project_id IN (${marks(projectIds)}) AND week IN (${marks(weeks)})`).all(...projectIds,...weeks):[];
 const perWeek=weeks.map(w=>({week:w,done:checkins.filter(c=>c.week===w).length,teams:teams.length,rate:teams.length?Math.round(checkins.filter(c=>c.week===w).length/teams.length*100):null}));

 // Tasks accepted in the period, for a team or one of its members.
 const accepted=projectIds.length?db.query(`SELECT s.id,s.updated,a.project_id,a.user_id,t.translations FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN task_templates t ON t.id=a.task_id WHERE s.status='accepted' AND ${inRange('s.updated')} AND (a.project_id IN (${marks(projectIds)})${allUsers.length?` OR a.user_id IN (${marks(allUsers)})`:''})`).all(from,to,...projectIds,...allUsers):[];
 const taskTeam=s=>s.project_id&&byId.has(s.project_id)?s.project_id:teamOfUser.get(s.user_id)||'';
 const taskTitle=s=>{try{const t=JSON.parse(s.translations);return t.en?.title||Object.values(t)[0]?.title||'';}catch{return '';}};

 // A team counts as active when anything happened in the period: check-in, accepted task, lecture, mentor session or outcome.
 const active=new Set([...checkins.map(c=>c.project_id),...accepted.map(taskTeam),...att.map(a=>teamOfUser.get(a.user_id)),...sessions.map(s=>s.project_id),...outcomes.map(o=>o.project_id)].filter(Boolean));

 const funding={grant:sum(of('funding','grant')),equity:sum(of('funding','equity')),loan:sum(of('funding','loan')),prize:sum(of('funding','prize')),other:sum(of('funding','other'))};
 funding.total=funding.grant+funding.equity+funding.loan+funding.prize+funding.other;
 const companies=of('company'),hires=of('hire'),customers=of('customer'),revenue=of('revenue'),fundingRows=of('funding');
 const attendees=new Set(att.map(a=>a.user_id)).size;

 const src=(table,rule,records,extra={})=>({table,rule,records:records.slice(0,RECORD_LIMIT),total:records.length,...extra});
 const teamRec=t=>({id:t.id,team:t.name,label:t.status});
 const metrics={
  teams:{value:teams.length,unit:'',label:L('Teams supported','Podržani timovi','Поддержано команд'),source:src('projects',L('Teams in the programme that were not archived before the period started.','Timovi u programu koji nisu arhivirani prije početka razdoblja.','Команды программы, которые не были перенесены в архив до начала периода.'),teams.map(teamRec))},
  people:{value:peopleKeys.size,unit:'',label:L('Participants','Sudionici','Участники'),source:src('team_people, memberships',L('Distinct people on team rosters plus team members with an account.','Osobe s popisa članova timova i članovi timova s korisničkim računom, svaka brojena jednom.','Люди из составов команд и участники команд с аккаунтом, каждый посчитан один раз.'),teams.map(t=>({id:t.id,team:t.name,amount:t.people.size})),{accounts:allUsers.length})},
  startups:{value:new Set(companies.map(o=>o.project_id)).size,unit:'',label:L('Companies founded','Osnovane tvrtke','Основано компаний'),source:src('project_outcomes',L('Teams with a “company registered” outcome dated in the period.','Timovi s rezultatom „registrirana tvrtka” u razdoblju.','Команды с результатом «компания зарегистрирована» в периоде.'),companies.map(outRec),proofCount(companies))},
  jobs:{value:hires.reduce((n,o)=>n+count(o),0),unit:'',label:L('Jobs created','Nova radna mjesta','Создано рабочих мест'),source:src('project_outcomes',L('“Hire” outcomes in the period; the number field counts people, empty counts as one.','Rezultati „zapošljavanje” u razdoblju; broj označava osobe, a prazno polje računa se kao jedna osoba.','Результаты «найм» в периоде; число означает количество людей, пустое поле считается за одного человека.'),hires.map(outRec),proofCount(hires))},
  funding:{value:funding.total,unit:'EUR',label:L('Funding raised','Prikupljena sredstva','Привлечено средств'),source:src('project_outcomes',L('Sum of “funding” outcomes in the period, all types.','Zbroj rezultata „prikupljeni novac” u razdoblju, sve vrste.','Сумма результатов «привлечены деньги» в периоде, все типы.'),fundingRows.map(outRec),proofCount(fundingRows))},
  revenue:{value:sum(revenue),unit:'EUR',label:L('Revenue','Prihod','Выручка'),source:src('project_outcomes',L('Sum of “revenue” outcomes in the period.','Zbroj rezultata „prihod” u razdoblju.','Сумма результатов «выручка» в периоде.'),revenue.map(outRec),proofCount(revenue))},
  customers:{value:customers.reduce((n,o)=>n+count(o),0),unit:'',label:L('First customers','Prvi kupci','Первые клиенты'),source:src('project_outcomes',L('“Customer” outcomes in the period; the number field counts customers, empty counts as one.','Rezultati „kupci koji plaćaju” u razdoblju; broj označava kupce, a prazno polje računa se kao jedan kupac.','Результаты «платящие клиенты» в периоде; число означает количество клиентов, пустое поле считается за одного.'),customers.map(outRec),proofCount(customers))},
  lectures:{value:lectures.length,unit:'',label:L('Lectures held','Održana predavanja','Проведено лекций'),source:src('lectures',L('Published lectures dated in the period, up to today.','Objavljena predavanja u razdoblju, do danas.','Опубликованные лекции в периоде, по сегодняшний день.'),lectures.map(l=>{let t='';try{const x=JSON.parse(l.title);t=x.en||Object.values(x)[0];}catch{t=l.title;}return {id:l.id,date:l.date,label:t,amount:att.filter(a=>a.lecture_id===l.id).length};}))},
  attendance:{value:expected?Math.round(att.length/expected*100):null,unit:'%',label:L('Attendance rate','Posjećenost predavanja','Посещаемость'),source:src('attendance',L('Attendance marks of team members with an account, divided by lectures held × those members.','Oznake dolaska članova timova s računom podijeljene s (broj predavanja × broj tih članova).','Отметки посещения участников команд с аккаунтом, делённые на (число лекций × число этих участников).'),[],{attended:att.length,expected,verified:att.filter(a=>a.kind==='verified_by_admin').length,self:att.filter(a=>a.kind==='self_reported').length,attendees})},
  mentorSessions:{value:sessions.length,unit:'',label:L('Mentor sessions','Sastanci s mentorima','Встречи с менторами'),source:src('office_hours, office_hour_bookings',L('Booked mentor office hours that took place in the period (cancelled slots excluded).','Rezervirani termini mentora održani u razdoblju (otkazani nisu uključeni).','Забронированные слоты менторов, прошедшие в периоде (отменённые не учитываются).'),sessions.map(s=>({id:s.id,teamId:s.project_id,team:byId.get(s.project_id)?.name||'',date:s.starts_at.slice(0,10),label:s.mentor_name+(s.topic?' · '+s.topic:''),amount:s.duration_min})))},
  mentorHours:{value:Math.round(minutes/6)/10,unit:'h',label:L('Mentoring hours','Sati mentorstva','Часы менторства'),source:src('office_hours.duration_min',L('Sum of the planned slot length of those sessions (the platform stores the booked length, not the actual one).','Zbroj planiranog trajanja tih termina (platforma bilježi rezervirano trajanje, ne stvarno).','Сумма запланированной длительности этих встреч (платформа хранит забронированную, а не фактическую длительность).'),[])},
  checkinRate:{value:perWeek.length&&teams.length?Math.round(checkins.length/(perWeek.length*teams.length)*100):null,unit:'%',label:L('Weekly check-in rate','Udio tjednih javljanja','Доля еженедельных отчётов'),source:src('checkins',L('Check-ins sent ÷ (weeks in the period × teams).','Poslana tjedna javljanja ÷ (broj tjedana u razdoblju × broj timova).','Отправленные отчёты ÷ (число недель периода × число команд).'),checkins.map(c=>({id:c.id,teamId:c.project_id,team:byId.get(c.project_id)?.name||'',date:c.week,label:[c.metric_name,c.metric_value].filter(Boolean).join(': ')})),{weeks:perWeek})},
  tasks:{value:accepted.length,unit:'',label:L('Tasks completed','Završeni zadaci','Выполнено заданий'),source:src('submissions',L('Submissions accepted in the period (team and personal tasks).','Radovi prihvaćeni u razdoblju (timski i osobni zadaci).','Работы, принятые в периоде (командные и личные задания).'),accepted.map(s=>({id:s.id,teamId:taskTeam(s),team:byId.get(taskTeam(s))?.name||'',date:s.updated.slice(0,10),label:taskTitle(s)})))},
  activeShare:{value:teams.length?Math.round(active.size/teams.length*100):null,unit:'%',label:L('Teams active','Aktivni timovi','Активные команды'),source:src('checkins, submissions, attendance, office_hour_bookings, project_outcomes',L('Teams with at least one check-in, accepted task, lecture, mentor session or outcome in the period.','Timovi s barem jednim tjednim javljanjem, prihvaćenim zadatkom, predavanjem, sastankom s mentorom ili rezultatom u razdoblju.','Команды, у которых в периоде был хотя бы один еженедельный отчёт, принятое задание, лекция, встреча с ментором или результат.'),teams.filter(t=>active.has(t.id)).map(teamRec),{active:active.size})},
 };

 const perTeam=teams.map(t=>{
  const mine=outcomes.filter(o=>o.project_id===t.id),f=type=>sum(mine.filter(o=>o.kind==='funding'&&o.funding_type===type));
  const myAtt=att.filter(a=>t.userIds.includes(a.user_id)).length,myExp=lectures.length*t.userIds.length;
  return {id:t.id,name:t.name,people:t.people.size,accounts:t.userIds.length,company:mine.some(o=>o.kind==='company'),jobs:mine.filter(o=>o.kind==='hire').reduce((n,o)=>n+count(o),0),
   funding:{grant:f('grant'),equity:f('equity'),loan:f('loan'),prize:f('prize'),other:f('other'),total:sum(mine.filter(o=>o.kind==='funding'))},
   revenue:sum(mine.filter(o=>o.kind==='revenue')),customers:mine.filter(o=>o.kind==='customer').reduce((n,o)=>n+count(o),0),
   attendance:myExp?Math.round(myAtt/myExp*100):null,mentorSessions:sessions.filter(s=>s.project_id===t.id).length,
   checkins:checkins.filter(c=>c.project_id===t.id).length,weeks:weeks.length,tasks:accepted.filter(s=>taskTeam(s)===t.id).length,active:active.has(t.id),
   outcomes:mine.length,unverified:mine.filter(o=>proof(o)==='self').length};
 });

 const v=k=>metrics[k].value;
 // Approximate mappings: same numbers under labels funders use. No official field numbers are claimed.
 const mappings=[
  {id:'national',title:L('National call report (Ministry of Economy PPI call, HAMAG-BICRO): “Obrazac 6”-style fields','Izvješće prema nacionalnom pozivu (Ministarstvo gospodarstva, PPI; HAMAG-BICRO): polja poput „Obrasca 6”','Отчёт по национальному конкурсу (Министерство экономики, PPI; HAMAG-BICRO): поля по образцу «Obrazac 6»'),
   rows:[
    {label:L('Number of entrepreneurs / teams using incubation services','Broj poduzetnika / timova korisnika usluga inkubacije','Число предпринимателей / команд, получивших услуги инкубации'),metric:'teams',value:v('teams')},
    {label:L('Number of newly founded companies','Broj novoosnovanih poduzeća','Число новых компаний'),metric:'startups',value:v('startups')},
    {label:L('Number of newly employed persons','Broj novozaposlenih osoba','Число новых сотрудников'),metric:'jobs',value:v('jobs')},
    {label:L('Number of trainings / workshops held','Broj održanih edukacija / radionica','Число проведённых обучений / семинаров'),metric:'lectures',value:v('lectures')},
    {label:L('Number of training participants','Broj sudionika edukacija','Число участников обучений'),metric:'attendance',value:attendees,note:L('people with at least one attendance mark','osobe s barem jednom oznakom dolaska','люди хотя бы с одной отметкой посещения')},
    {label:L('Mentoring / advisory hours','Sati mentorstva / savjetovanja','Часы менторства / консультаций'),metric:'mentorHours',value:v('mentorHours'),unit:'h'},
    {label:L('Funds raised by supported companies (EUR)','Iznos sredstava koja su prikupili korisnici (EUR)','Средства, привлечённые поддержанными компаниями (EUR)'),metric:'funding',value:v('funding'),unit:'EUR'},
   ]},
  {id:'erdf',title:L('ERDF 2021–2027 common indicators','EFRR 2021.–2027. zajednički pokazatelji','Общие индикаторы ЕФРР 2021–2027'),
   rows:[
    {code:'RCO01',label:L('Enterprises supported','Poduzeća kojima je pružena potpora','Поддержанные предприятия'),metric:'teams',value:v('teams'),note:L('counts every team, also those not yet registered; your call may count only registered enterprises','broji sve timove, i one koji još nisu registrirani; poziv može priznavati samo registrirana poduzeća','считает все команды, включая незарегистрированные; конкурс может требовать только зарегистрированные')},
    {code:'RCO04',label:L('Enterprises with non-financial support','Poduzeća koja primaju nefinancijsku potporu','Предприятия с нефинансовой поддержкой'),metric:'teams',value:v('teams')},
    {code:'RCO05',label:L('New enterprises supported','Nova poduzeća kojima je pružena potpora','Поддержанные новые предприятия'),metric:'startups',value:v('startups'),note:L('companies registered in the period','poduzeća registrirana u razdoblju','компании, зарегистрированные в периоде')},
    {code:'RCR01',label:L('Jobs created in supported entities','Radna mjesta otvorena u subjektima kojima je pružena potpora','Рабочие места, созданные в поддержанных организациях'),metric:'jobs',value:v('jobs')},
    {code:'RCR02',label:L('Private investments matching public support','Privatna ulaganja koja prate javnu potporu','Частные инвестиции, сопутствующие государственной поддержке'),metric:'funding',value:funding.equity+funding.loan,unit:'EUR',note:L('equity + loans only; grants and prizes left out; check whether your loans are private','samo vlasnička ulaganja + zajmovi; bespovratna sredstva i nagrade nisu uključeni; provjerite jesu li zajmovi privatni','только инвестиции в долю + займы; гранты и призы не учтены; проверьте, частные ли займы')},
   ]},
  {id:'ebn',title:L('EBN EU|BIC network metrics','Pokazatelji mreže EBN EU|BIC','Показатели сети EBN EU|BIC'),
   rows:[
    {label:L('Start-ups supported','Startupi kojima je pružena potpora','Поддержанные стартапы'),metric:'teams',value:v('teams')},
    {label:L('Jobs created','Otvorena radna mjesta','Созданные рабочие места'),metric:'jobs',value:v('jobs')},
    {label:L('Funding raised (EUR)','Prikupljena sredstva (EUR)','Привлечённое финансирование (EUR)'),metric:'funding',value:v('funding'),unit:'EUR'},
    {label:L('Survival rate','Stopa preživljavanja','Выживаемость'),metric:null,value:null,note:L('not tracked: needs company status a few years after the programme','ne prati se: potreban je status poduzeća nekoliko godina nakon programa','не отслеживается: нужен статус компании через несколько лет после программы')},
   ]},
 ];

 const allProof=proofCount(outcomes);
 return {workspace,period:{from,to,basis,until},generated:nowIso(),currency:'EUR',canVerify,
  funding,metrics,mappings,teams:perTeam,
  outcomes:{total:outcomes.length,...allProof,records:outcomes.map(outRec).slice(0,RECORD_LIMIT)},
  checkinWeeks:perWeek,approximate:true};
}

const loadReport=ctx=>{const user=requireAdmin(ctx);return buildReport(ctx.db,period(ctx),{workspace:workspaceName(ctx),canVerify:!isDemoUser(user)});};

export function report(ctx){return json(loadReport(ctx));}

/** Organiser marks one outcome as checked (seen the contract, invoice, register entry) or clears the mark. */
export async function verifyOutcome(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);ensureChecks(ctx.db);
 if(!ctx.db.query('SELECT 1 FROM project_outcomes WHERE id=?').get(id))fail(404,'NOT_FOUND');
 if(body.verified===false)ctx.db.query('DELETE FROM outcome_checks WHERE outcome_id=?').run(id);
 else ctx.db.query('INSERT INTO outcome_checks(outcome_id,verified_by,verified_at) VALUES(?,?,?) ON CONFLICT(outcome_id) DO UPDATE SET verified_by=excluded.verified_by,verified_at=excluded.verified_at').run(id,admin.id,nowIso());
 audit(ctx.db,admin.id,body.verified===false?'outcome.unverify':'outcome.verify','outcome',id,{});
 return json({ok:true,verified:body.verified!==false});
}

// Export text ------------------------------------------------------------------------------
const W={
 title:L('Report for the funder','Izvješće za financijera','Отчёт для фонда'),
 period:L('Period','Razdoblje','Период'),generated:L('Generated','Izrađeno','Сформирован'),
 indicator:L('Indicator','Pokazatelj','Показатель'),value:L('Value','Vrijednost','Значение'),unit:L('Unit','Jedinica','Ед.'),
 source:L('Source records','Izvorni zapisi','Исходные записи'),rule:L('How it is counted','Kako se broji','Как считается'),
 proof:L('Verification','Provjera','Проверка'),
 verified:L('verified by organiser','provjerio organizator','проверено организатором'),organiser:L('entered by organiser','unio organizator','внесено организатором'),self:L('self-reported','prijavio tim','со слов команды'),
 mapping:L('Funder indicators (approximate mapping, check against your call’s template)','Pokazatelji financijera (približna usporedba, provjerite prema predlošku svog poziva)','Показатели фонда (приблизительное соответствие, сверьте с шаблоном вашего конкурса)'),
 approx:L('approximate','približno','приблизительно'),code:L('Code','Oznaka','Код'),note:L('Note','Napomena','Примечание'),
 teams:L('Per team','Po timovima','По командам'),team:L('Team','Tim','Команда'),people:L('People','Osobe','Люди'),company:L('Company','Poduzeće','Компания'),
 jobs:L('Jobs','Radna mjesta','Рабочие места'),grant:L('Grant','Bespovratna sredstva','Грант'),equity:L('Equity','Vlasničko ulaganje','Инвестиции в долю'),loan:L('Loan','Zajam','Заём'),prize:L('Prize','Nagrada','Приз'),other:L('Other','Ostalo','Другое'),total:L('Total','Ukupno','Итого'),
 revenue:L('Revenue','Prihod','Выручка'),customers:L('Customers','Kupci','Клиенты'),attendance:L('Attendance','Posjećenost','Посещаемость'),mentor:L('Mentor sessions','Sastanci s mentorima','Встречи с менторами'),
 checkins:L('Check-ins','Javljanja','Отчёты'),tasks:L('Tasks done','Završeni zadaci','Выполненные задания'),active:L('Active','Aktivan','Активна'),yes:L('yes','da','да'),no:L('no','ne','нет'),
 funding:L('Funding by type','Sredstva po vrsti','Финансирование по типам'),
 sign:L('Prepared by (name, role)','Pripremio/la (ime i prezime, funkcija)','Подготовил(а) (имя, роль)'),signature:L('Signature','Potpis','Подпись'),date:L('Date','Datum','Дата'),stamp:L('Stamp','Pečat','Печать'),
 print:L('Print / save as PDF','Ispis / spremi kao PDF','Печать / сохранить в PDF'),
 provenance:L('Every number comes from records in the platform. Outcomes are reported by teams; “verified” means an organiser checked the evidence. Funder labels are an approximate mapping, not official form fields.','Svaki broj dolazi iz zapisa u platformi. Rezultate prijavljuju timovi; „provjereno” znači da je organizator provjerio dokaz. Nazivi pokazatelja financijera približna su usporedba, a ne službena polja obrasca.','Каждое число взято из записей платформы. Результаты сообщают команды; «проверено» значит, что организатор проверил подтверждение. Названия показателей фонда — приблизительное соответствие, а не официальные поля формы.'),
 outcomesProof:L('Outcomes in the period','Rezultati u razdoblju','Результаты за период'),
 notTracked:L('not tracked','ne prati se','не отслеживается'),
};
const langOf=ctx=>LANGS.includes(ctx.url.searchParams.get('lang'))?ctx.url.searchParams.get('lang'):'en';
const fmtNum=(n,lang)=>n===null||n===undefined?'—':new Intl.NumberFormat({en:'en-GB',hr:'hr-HR',ru:'ru-RU'}[lang],{maximumFractionDigits:1}).format(n);
const proofText=(s,lang)=>[s.verified?`${s.verified} ${W.verified[lang]}`:'',s.organiser?`${s.organiser} ${W.organiser[lang]}`:'',s.self?`${s.self} ${W.self[lang]}`:''].filter(Boolean).join(', ');
const ORDER=['teams','people','startups','jobs','funding','revenue','customers','lectures','attendance','mentorSessions','mentorHours','checkinRate','tasks','activeShare'];

/** Rows shared by CSV and XLSX: sections separated by an empty row. */
function tableRows(r,lang){
 const rows=[[W.title[lang],r.workspace],[W.period[lang],`${r.period.from} – ${r.period.to}`],[W.generated[lang],r.generated.slice(0,16).replace('T',' ')+' UTC'],[],
  [W.indicator[lang],W.value[lang],W.unit[lang],W.source[lang],W.rule[lang],W.proof[lang]]];
 for(const k of ORDER){const m=r.metrics[k],s=m.source;rows.push([m.label[lang],m.value??'',m.unit,s.table,s.rule[lang],s.verified!==undefined?proofText(s,lang):'']);}
 rows.push([],[W.funding[lang]],...['grant','equity','loan','prize','other','total'].map(k=>[W[k][lang],r.funding[k],'EUR']));
 rows.push([],[W.mapping[lang]],[W.code[lang],W.indicator[lang],W.value[lang],W.unit[lang],W.note[lang]]);
 for(const g of r.mappings){rows.push([g.title[lang]]);for(const x of g.rows)rows.push([x.code||'',x.label[lang],x.value??W.notTracked[lang],x.unit||'',[W.approx[lang],x.note?.[lang]].filter(Boolean).join('; ')]);}
 rows.push([],[W.teams[lang]],[W.team[lang],W.people[lang],W.company[lang],W.jobs[lang],W.grant[lang],W.equity[lang],W.loan[lang],W.prize[lang],W.other[lang],W.total[lang]+' EUR',W.revenue[lang]+' EUR',W.customers[lang],W.attendance[lang]+' %',W.mentor[lang],W.checkins[lang],W.tasks[lang],W.active[lang]]);
 for(const t of r.teams)rows.push([t.name,t.people,t.company?W.yes[lang]:W.no[lang],t.jobs,t.funding.grant,t.funding.equity,t.funding.loan,t.funding.prize,t.funding.other,t.funding.total,t.revenue,t.customers,t.attendance??'',t.mentorSessions,`${t.checkins}/${t.weeks}`,t.tasks,t.active?W.yes[lang]:W.no[lang]]);
 rows.push([],[W.outcomesProof[lang],r.outcomes.total,proofText(r.outcomes,lang)],[W.provenance[lang]]);
 return rows;
}
const fileName=(r,ext)=>`funder-report-${r.period.from}_${r.period.to}.${ext}`;
const download=(body,type,name)=>new Response(body,{headers:{'Content-Type':type,'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export function reportCsv(ctx){
 const r=loadReport(ctx),lang=langOf(ctx);
 // Semicolon on request: Excel in Croatian and Russian locales splits on “;”.
 const sep=ctx.url.searchParams.get('sep')==='semicolon'?';':',';
 const body='﻿'+tableRows(r,lang).map(row=>row.map(csvCell).join(sep)).join('\r\n')+'\r\n';
 audit(ctx.db,ctx.user.id,'report.export','report','csv',{from:r.period.from,to:r.period.to});
 return download(body,'text/csv; charset=utf-8',fileName(r,'csv'));
}

// Minimal XLSX: one sheet, inline strings, stored (uncompressed) ZIP with CRC32 from Bun.
const xmlEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
const colName=i=>{let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;};
function sheetXml(rows){
 const body=rows.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>{const ref=colName(c)+(r+1);return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}"><v>${v}</v></c>`:v===''||v===null||v===undefined?'':`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;}).join('')}</row>`).join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="48" customWidth="1"/><col min="2" max="17" width="16" customWidth="1"/></cols><sheetData>${body}</sheetData></worksheet>`;
}
export function zipStore(files){
 const enc=new TextEncoder(),local=[],central=[];let offset=0;
 const crc=data=>typeof Bun!=='undefined'&&Bun.hash?.crc32?Bun.hash.crc32(data)>>>0:crc32(data);
 for(const [name,text] of files){
  const n=enc.encode(name),data=enc.encode(text),c=crc(data);
  const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,c,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,n.length,true);
  local.push(new Uint8Array(h.buffer),n,data);
  const d=new DataView(new ArrayBuffer(46));d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);d.setUint32(16,c,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,n.length,true);d.setUint32(42,offset,true);
  central.push(new Uint8Array(d.buffer),n);offset+=30+n.length+data.length;
 }
 const size=central.reduce((s,a)=>s+a.length,0),e=new DataView(new ArrayBuffer(22));
 e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
 const parts=[...local,...central,new Uint8Array(e.buffer)],out=new Uint8Array(parts.reduce((s,a)=>s+a.length,0));let p=0;for(const a of parts){out.set(a,p);p+=a.length;}
 return out;
}
function crc32(data){let c,crc=0xFFFFFFFF;for(let i=0;i<data.length;i++){c=(crc^data[i])&0xFF;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xEDB88320:c>>>1;crc=(crc>>>8)^c;}return (crc^0xFFFFFFFF)>>>0;}

export function reportXlsx(ctx){
 const r=loadReport(ctx),lang=langOf(ctx);
 const files=[
  ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
  ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(W.title[lang].slice(0,31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
  ['xl/worksheets/sheet1.xml',sheetXml(tableRows(r,lang))],
 ];
 audit(ctx.db,ctx.user.id,'report.export','report','xlsx',{from:r.period.from,to:r.period.to});
 return download(zipStore(files),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',fileName(r,'xlsx'));
}

// Print view: one A4 document, the browser saves it as PDF. No scripts except the print button.
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reportPrint(ctx){
 const r=loadReport(ctx),lang=langOf(ctx),n=v=>fmtNum(v,lang);
 const fmtDate=iso=>new Intl.DateTimeFormat({en:'en-GB',hr:'hr-HR',ru:'ru-RU'}[lang],{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Zagreb'}).format(new Date(iso.length===10?iso+'T12:00:00Z':iso));
 const unit=u=>u==='EUR'?' €':u==='%'?' %':u==='h'?' h':'';
 const mark=r.workspace.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'B';
 const kpi=k=>{const m=r.metrics[k],s=m.source;return `<div class="k"><span>${h(m.label[lang])}</span><b>${n(m.value)}${unit(m.unit)}</b><small>${h(s.table)}${s.verified!==undefined&&s.total?` · ${h(proofText(s,lang))}`:''}</small></div>`;};
 const fund=['grant','equity','loan','prize','other'],max=Math.max(1,...fund.map(k=>r.funding[k]));
 const body=`<header class="top"><div class="logo"><span class="mark">${h(mark)}</span><span>${h(r.workspace)}</span></div><div class="meta"><b>${h(W.title[lang])}</b><span>${h(W.period[lang])}: ${h(fmtDate(r.period.from))} – ${h(fmtDate(r.period.to))}</span><span>${h(W.generated[lang])}: ${h(fmtDate(r.generated))}</span></div></header>
<h1>${h(W.title[lang])}</h1>
<section class="kpis">${ORDER.map(kpi).join('')}</section>
<section><h2>${h(W.funding[lang])}</h2><table class="fund">${fund.map(k=>`<tr><th>${h(W[k][lang])}</th><td><i style="width:${(r.funding[k]/max*100).toFixed(1)}%"></i></td><td class="n">${n(r.funding[k])} €</td></tr>`).join('')}<tr class="sum"><th>${h(W.total[lang])}</th><td></td><td class="n">${n(r.funding.total)} €</td></tr></table></section>
<section><h2>${h(W.mapping[lang])}</h2>${r.mappings.map(g=>`<h3>${h(g.title[lang])}</h3><table><thead><tr><th>${h(W.code[lang])}</th><th>${h(W.indicator[lang])}</th><th class="n">${h(W.value[lang])}</th><th>${h(W.note[lang])}</th></tr></thead><tbody>${g.rows.map(x=>`<tr><td>${h(x.code||'')}</td><td>${h(x.label[lang])}</td><td class="n">${x.value===null?h(W.notTracked[lang]):n(x.value)+unit(x.unit)}</td><td><em>${h(W.approx[lang])}</em>${x.note?'; '+h(x.note[lang]):''}</td></tr>`).join('')}</tbody></table>`).join('')}</section>
<section class="teams"><h2>${h(W.teams[lang])}</h2><table><thead><tr><th>${h(W.team[lang])}</th><th class="n">${h(W.people[lang])}</th><th>${h(W.company[lang])}</th><th class="n">${h(W.jobs[lang])}</th><th class="n">${h(W.total[lang])} €</th><th class="n">${h(W.revenue[lang])} €</th><th class="n">${h(W.customers[lang])}</th><th class="n">${h(W.attendance[lang])}</th><th class="n">${h(W.mentor[lang])}</th><th class="n">${h(W.checkins[lang])}</th><th class="n">${h(W.tasks[lang])}</th></tr></thead><tbody>${r.teams.map(t=>`<tr><td>${h(t.name)}</td><td class="n">${t.people}</td><td>${h(t.company?W.yes[lang]:W.no[lang])}</td><td class="n">${t.jobs}</td><td class="n">${n(t.funding.total)}</td><td class="n">${n(t.revenue)}</td><td class="n">${t.customers}</td><td class="n">${t.attendance===null?'—':t.attendance+' %'}</td><td class="n">${t.mentorSessions}</td><td class="n">${t.checkins}/${t.weeks}</td><td class="n">${t.tasks}</td></tr>`).join('')}</tbody></table></section>
<p class="note">${h(W.provenance[lang])} ${h(W.outcomesProof[lang])}: ${r.outcomes.total}${r.outcomes.total?' ('+h(proofText(r.outcomes,lang))+')':''}.</p>
<footer class="sign"><div><span>${h(W.sign[lang])}</span></div><div><span>${h(W.signature[lang])}</span></div><div><span>${h(W.date[lang])}</span></div><div class="stamp"><span>${h(W.stamp[lang])}</span></div></footer>`;
 const css=`@page{size:A4;margin:16mm 14mm}*{box-sizing:border-box}body{margin:0;font:12px/1.45 Inter,-apple-system,"Segoe UI",Arial,sans-serif;color:#242a26;background:#f7f5f0}
main{max-width:210mm;margin:24px auto;background:#fff;padding:16mm 14mm;border:1px solid #dcded4}
.bar{max-width:210mm;margin:16px auto 0;display:flex;justify-content:flex-end}.bar button{font:inherit;font-weight:600;padding:10px 16px;border:1px solid #242a26;background:#242a26;color:#fff;cursor:pointer}
.top{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #242a26;padding-bottom:10px}.logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;letter-spacing:.3px}.mark{display:grid;place-items:center;width:34px;height:34px;background:#a63c15;color:#fff;font-size:14px;letter-spacing:1px}
.meta{display:flex;flex-direction:column;align-items:flex-end;font-size:11px;color:#62685f}.meta b{color:#242a26;font-size:12px}
h1{font:400 30px/1.1 Georgia,serif;margin:18px 0 14px;letter-spacing:-.5px}h2{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#a63c15;margin:18px 0 8px}h3{font-size:12px;margin:12px 0 4px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #dcded4;border-left:1px solid #dcded4}.k{border-right:1px solid #dcded4;border-bottom:1px solid #dcded4;padding:8px 9px;break-inside:avoid}.k span{display:block;font-size:9.5px;letter-spacing:.8px;text-transform:uppercase;color:#62685f;font-weight:700}.k b{display:block;font-size:20px;margin:3px 0 2px;font-variant-numeric:tabular-nums}.k small{font-size:9px;color:#62685f}
table{width:100%;border-collapse:collapse;font-size:10.5px}th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #dcded4;vertical-align:top}thead th{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#62685f}.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}tr{break-inside:avoid}
.fund th{width:22%}.fund td:nth-child(2){width:58%}thead th.n{white-space:normal}.teams table{font-size:9.5px;table-layout:fixed}.teams td,.teams th{padding:4px 3px;overflow-wrap:anywhere}.teams th:first-child{width:16%}.teams thead th{overflow-wrap:normal;hyphens:auto;letter-spacing:.2px;font-size:8px}.fund td i{display:block;height:9px;background:#a63c15;-webkit-print-color-adjust:exact;print-color-adjust:exact}.fund .sum th,.fund .sum td{font-weight:700;border-top:2px solid #242a26}
em{font-style:normal;color:#9a6200;font-weight:600}.note{font-size:10px;color:#62685f;margin-top:14px;border-left:3px solid #a63c15;padding-left:8px}
.sign{display:grid;grid-template-columns:2fr 1.4fr 1fr 1fr;gap:18px;margin-top:34px;break-inside:avoid}.sign div{border-top:1px solid #242a26;padding-top:4px;min-height:44px;font-size:10px;color:#62685f}.stamp{border:1px dashed #9a9e94!important;min-height:64px!important;padding:4px}
@media print{body{background:#fff}main{margin:0;padding:0;border:0;max-width:none}.bar{display:none}.mark{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media(max-width:700px){main{margin:0;padding:18px 16px;border:0}.kpis{grid-template-columns:repeat(2,1fr)}.teams{overflow-x:auto}.sign{grid-template-columns:1fr 1fr}.top{flex-direction:column}.meta{align-items:flex-start}}`;
 const html=`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(W.title[lang])} · ${h(r.workspace)} · ${h(r.period.from)} – ${h(r.period.to)}</title><style>${css}</style></head><body><div class="bar"><button type="button" onclick="window.print()">${h(W.print[lang])}</button></div><main>${body}</main>${ctx.url.searchParams.get('autoprint')==='1'?'<script>addEventListener("load",()=>setTimeout(()=>print(),300))</script>':''}</body></html>`;
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}
