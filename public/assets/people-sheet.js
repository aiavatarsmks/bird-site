'use strict';
/* People sheet: one person or one team standing full height (character-stage.js), with their card below.
   The same sheet opens in the office panel and in a side drawer on the account and admin pages.

   Privacy: everyone sees what the public office already shows (name, role, team, description, the public
   team ranking: progress, team points, streak). The programme view (points, level, tasks, signals, next step,
   last visit, links to the record) is filled only when /api/auth/me says the viewer is an organiser, and only
   from the admin endpoints, which the server refuses to anyone else.

   BirdSheet.person(vm) / BirdSheet.team(vm)   -> markup of the sheet (stage, name, card slot)
   BirdSheet.mount(el,vm,{links})              -> starts characters and fills the card; returns stop()
   BirdSheet.open(spec)                        -> side drawer (bottom sheet on phones); spec {kind:'person'|'team',id,...}
   BirdSheet.language(l)

   vm for a person: {kind:'person',id,name,role,src,note,team:{id,name,color},away}
   vm for a team:   {kind:'team',id,name,color,description,members:[{id,name,role,src}]}
   links: 'office' (inside the office: clicks select people and teams there) or 'drawer'.                */
(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=(en,hr,ru)=>({en,hr,ru});
const W={
 close:L('Close','Zatvori','Закрыть'),loading:L('Loading…','Učitavanje…','Загрузка…'),
 team:L('Team','Tim','Команда'),people:L('People','Osobe','Участники'),progress:L('Team progress','Napredak tima','Прогресс команды'),
 teamPoints:L('Team points','Bodovi tima','Баллы команды'),points:L('Points','Bodovi','Баллы'),weeks:L('weeks in a row','tjedana zaredom','недель подряд'),weeks_one:L('week in a row','tjedan zaredom','неделя подряд'),weeks_few:L('weeks in a row','tjedna zaredom','недели подряд'),
 people_one:L('person','osoba','участник'),people_few:L('people','osobe','участника'),people_many:L('people','osoba','участников'),overdue_few:L('overdue','kasne','просрочено'),
 level:L('Level','Razina','Уровень'),toNext:L('{n} to level {l}','još {n} do razine {l}','ещё {n} до уровня {l}'),
 tasks:L('Tasks','Zadaci','Задания'),lectures:L('Lectures','Predavanja','Лекции'),nextStep:L('Next step','Sljedeći korak','Следующий шаг'),
 allDone:L('Nothing open right now','Trenutno ništa otvoreno','Сейчас ничего не открыто'),lastVisit:L('Last visit','Zadnji posjet','Последний визит'),
 never:L('not yet','još nije','ещё не было'),fullRecord:L('Full record','Puni zapis','Полная запись'),teamRecord:L('Team record','Zapis tima','Запись команды'),
 giveTask:L('Give a task','Dodijeli zadatak','Дать задание'),members:L('Members','Članovi','Участники'),openTasks:L('Open tasks','Otvoreni zadaci','Открытые задания'),
 noAccount:L('No account yet','Još nema računa','Аккаунта пока нет'),noAccountNote:L('Tasks, points and messages start when this person has an account.','Zadaci, bodovi i poruke počinju kad osoba ima račun.','Задания, баллы и сообщения появятся, когда у человека будет аккаунт.'),
 invite:L('Send an invitation','Pošalji pozivnicu','Отправить приглашение'),due:L('due','rok','срок'),overdue:L('overdue','kasni','просрочено'),
 waiting:L('to review','za pregled','на проверку'),remind:L('Remind','Podsjeti','Напомнить'),reminder:L('Reminder…','Podsjetnik…','Напоминание…'),
 sent:L('Sent','Poslano','Отправлено'),notSent:L('Could not send','Nije poslano','Не удалось отправить'),
 about:L('About the project','O projektu','О проекте'),inOffice:L('Show in the office','Prikaži u uredu','Показать в офисе'),
 blocker:L('Blocker','Prepreka','Что мешает'),manage:L('Programme view','Pogled voditelja','Взгляд руководителя'),signal:L('Signal','Signal','Сигнал'),
 away:L('Out of the office right now','Trenutno izvan ureda','Сейчас не в офисе'),nobody:L('Nobody has registered yet.','Još nitko nije registriran.','Пока никто не зарегистрирован.'),
 write:L('Write a message','Napiši poruku','Написать'),signIn:L('Sign in to write','Prijavite se da biste pisali','Войдите, чтобы написать'),
 points_short:L('pts','bod.','балл.'),attendance:L('Lectures attended','Posjećena predavanja','Посещённые лекции'),pickPerson:L('Open {name}','Otvori: {name}','Открыть: {name}'),
};
let lang='en';
const A=k=>{const T=window.BIRD_ACCOUNT_TEXT;return T?.[k]?.[lang]??T?.[k]?.en??'';};
// After a number: the form for that count (k_one / k_few / k_many) when there is one.
const tp=(k,n)=>{const f=k+'_'+(window.BirdPlural?.(lang,n)||'many');return W[f]?t(f):t(k);};
const t=(k,vars={})=>Object.entries(vars).reduce((s,[a,b])=>s.replaceAll('{'+a+'}',b),W[k]?.[lang]||W[k]?.en||A(k)||k);
const pick=o=>o?.[lang]||o?.en||'';
const reduced=()=>window.BirdMotion?.reduced()??matchMedia('(prefers-reduced-motion: reduce)').matches;
const loc={en:'en-GB',hr:'hr-HR',ru:'ru-RU'};
const when=(iso,time=true)=>iso?new Intl.DateTimeFormat(loc[lang],{day:'numeric',month:'short',...(time?{hour:'2-digit',minute:'2-digit'}:{}),timeZone:'Europe/Zagreb'}).format(new Date(iso)):t('never');
const n=v=>Number.isInteger(v)&&v>0?`<span data-ps-count="${v}">${v}</span>`:esc(v??'—');
const OPEN=new Set(['not_started','draft','changes_requested']);
// The participant's own level rule (account.js level()): each level needs a little more than the last.
const lvStart=n=>n<=1?0:5*(n-1)*(n+2);
const levelOf=xp=>{let n=1;while(xp>=lvStart(n+1))n++;return {n,a:lvStart(n),b:lvStart(n+1)};};

// Data ------------------------------------------------------------------------------------------------
const cache=new Map();
function get(url,ttl=30000){
 const c=cache.get(url);if(c&&Date.now()-c.t<ttl)return c.p;
 const p=fetch(url,{credentials:'same-origin'}).then(r=>r.ok?r.json():null).catch(()=>null);
 cache.set(url,{t:Date.now(),p});return p;
}
const me=async()=>(await get('/api/auth/me',60000))||{};
const isAdmin=u=>['program_admin','platform_owner'].includes(u?.role);
async function ranking(projectId){const r=await get('/api/teams/ranking',60000);return r?.items?.find(x=>x.projectId===projectId)||null;}

// Pieces ----------------------------------------------------------------------------------------------
function ring(pct,label,inner){
 const has=pct!==null&&pct!==undefined,v=has?Math.max(0,Math.min(100,pct)):0;
 return `<div class="ui-ring ps-ring" role="img" aria-label="${esc(label+': '+(has?v+'%':'—'))}"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-t" cx="40" cy="40" r="34" pathLength="100"/><circle class="ring-v" cx="40" cy="40" r="34" pathLength="100" style="stroke-dashoffset:${100-v}"/></svg><b aria-hidden="true">${inner??(has?`${n(v)}<small>%</small>`:'—')}</b></div>`;
}
const bar=(pct,cls='is-ok')=>`<span class="ui-bar ${cls}" aria-hidden="true"><i style="--w:${Math.max(0,Math.min(100,pct||0))}%"></i></span>`;
const units=tasks=>tasks.length?`<span class="ui-units ps-units" aria-hidden="true">${tasks.slice(0,40).map((x,j)=>`<i class="${x.status==='accepted'?'is-ok':x.status==='submitted'?'is-watch':x.status==='changes_requested'?'is-risk':''}" style="--j:${j%12}"></i>`).join('')}</span>`:'';
const title=x=>pick(x.title)?.title||x.title?.en?.title||'';
const isLate=x=>OPEN.has(x.status)&&x.dueAt&&x.dueAt<new Date().toISOString();
function signal(level,signals=[]){
 if(!level)return '';
 return `<p class="ps-signal"><span class="ui-dot is-${esc(level)}">${esc(A('risk_'+level)||level)}</span>${signals.map(s=>`<span class="ps-sig">${esc(A('sig_'+s)||s)}</span>`).join('')}</p>`;
}
function next(tasks){
 const x=tasks.find(y=>OPEN.has(y.status));
 if(!x)return `<div class="ps-next is-calm"><span class="ui-label">${t('nextStep')}</span><b>${t('allDone')}</b></div>`;
 const late=isLate(x);
 return `<div class="ps-next ${late?'is-late':''}"><span class="ui-label">${t('nextStep')}</span><b>${esc(title(x))}</b><small>${x.dueAt?`${late?t('overdue'):t('due')} ${when(x.dueAt,false)} · `:''}${x.xp} ${t('points_short')}</small></div>`;
}
const taskList=tasks=>{const open=tasks.filter(x=>OPEN.has(x.status));return open.length?`<h3 class="ps-h">${t('openTasks')} <span>${open.length}</span></h3><ul class="ps-list">${open.slice(0,6).map(x=>`<li class="${isLate(x)?'is-late':''}"><span>${esc(title(x))}</span><small>${x.dueAt?when(x.dueAt,false):''}</small></li>`).join('')}</ul>`:'';};
const nudge=(field,id)=>`<form class="ps-nudge" data-ps-nudge="${field}" data-id="${esc(id)}"><textarea name="message" rows="2" maxlength="300" required placeholder="${esc(t('reminder'))}" aria-label="${esc(t('reminder'))}"></textarea><button class="acc-secondary">${t('remind')}</button></form>`;

// Attributes that make a person or team clickable: inside the office the office handles them.
const linkAttr=(mode,kind,id,staff)=>mode==='office'?`data-${staff?'staff':kind==='team'?'project':'person'}="${esc(id)}"`:`data-ps-${kind}="${esc(id)}"`;

function stage(people,{mode,pickable,staff}){
 if(!window.BirdCharacter)return '';
 // Team: every character opens that person's own sheet.
 const list=people.map(p=>({id:p.id,name:people.length>1?p.name:'',src:p.src||undefined,
  ...(pickable?{attrs:`${linkAttr(mode,'person',p.key||p.id,staff)} data-ps-pick`,label:t('pickPerson',{name:p.name})}:{})}));
 return `<div class="ps-stage" style="--n:${Math.min(4,people.length)}">${window.BirdCharacter.html(list,{size:people.length===1?'xl':'fit'})}</div>`;
}

function person(vm,{mode='drawer'}={}){
 const team=vm.team;
 return `<div class="ps ps-person" data-ps-key="person:${esc(vm.id)}" style="${team?.color?`--team:${esc(team.color)}`:''}">
 <div class="ps-top">${team?`<button type="button" class="ps-crumb" ${linkAttr(mode,'team',team.id)}><i aria-hidden="true"></i>${esc(team.name)}</button>`:'<span></span>'}<button type="button" class="ps-close" data-action="close" data-ps-close aria-label="${esc(t('close'))}">×</button></div>
 ${stage([{id:vm.id,name:vm.name,src:vm.src}],{mode})}
 <header class="ps-id"><h2>${esc(vm.name)}</h2>${vm.role?`<p class="ps-role">${esc(vm.role)}</p>`:''}${vm.away?`<p class="ps-away">${t('away')}</p>`:''}</header>
 <div class="ps-body" data-ps-body aria-live="polite"><p class="ps-wait">${t('loading')}</p></div></div>`;
}
function team(vm,{mode='drawer'}={}){
 const people=vm.members.map(m=>({id:m.id,key:m.key||m.id,name:m.name,src:m.src}));
 return `<div class="ps ps-team" data-ps-key="team:${esc(vm.id)}" style="${vm.color?`--team:${esc(vm.color)}`:''}">
 <div class="ps-top"><span class="ps-crumb is-here"><i aria-hidden="true"></i>${t('team')} · ${vm.members.length} ${tp('people',vm.members.length).toLowerCase()}</span><button type="button" class="ps-close" data-action="close" data-ps-close aria-label="${esc(t('close'))}">×</button></div>
 ${people.length?stage(people,{mode,pickable:true,staff:vm.staff}):''}
 <header class="ps-id"><h2>${esc(vm.name)}</h2>${vm.description?`<p class="ps-desc">${esc(vm.description)}</p>`:''}</header>
 <div class="ps-body" data-ps-body aria-live="polite"><p class="ps-wait">${t('loading')}</p></div></div>`;
}

// Cards -----------------------------------------------------------------------------------------------
function publicTeamCard(rank,vm){
 if(!rank)return `<p class="ps-note">${esc(vm.note||'')}</p>`;
 return `<section class="ps-card"><div class="ps-hero">${ring(rank.percent,t('progress'))}<dl class="ps-facts"><div><dt>${t('teamPoints')}</dt><dd class="ui-num">${n(rank.teamXp)}</dd></div>${rank.streak?`<div><dt>${t('weeks')}</dt><dd class="ui-num ps-flame">${window.BirdIcon?.('flame')||''}${n(rank.streak)}</dd></div>`:''}<div><dt>${t('people')}</dt><dd class="ui-num">${n(vm.members?.length??rank.members)}</dd></div></dl></div></section>`;
}
function publicPersonCard(rank,vm){
 const tm=vm.team;if(!rank&&!vm.note)return '';
 return `<section class="ps-card">${rank?`<div class="ps-hero">${ring(rank.percent,t('progress'))}<dl class="ps-facts"><div><dt>${t('team')}</dt><dd>${esc(tm?.name||'')}</dd></div><div><dt>${t('teamPoints')}</dt><dd class="ui-num">${n(rank.teamXp)}</dd></div>${rank.streak?`<div><dt>${t('weeks')}</dt><dd class="ui-num ps-flame">${window.BirdIcon?.('flame')||''}${n(rank.streak)}</dd></div>`:''}</dl></div>`:''}${vm.note?`<p class="ps-note">${esc(vm.note)}</p>`:''}</section>`;
}
function adminPersonCard(r,teamRec,vm,mode){
 if(!r)return '';
 const tm=vm.team;
 if(!r.hasAccount)return `<section class="ps-card ps-mgmt"><span class="ps-tag">${t('manage')}</span><p><span class="ui-dot is-watch">${t('noAccount')}</span></p><p class="ps-note">${t('noAccountNote')}</p>${teamRec?signal(teamRec.risk.level,teamRec.risk.signals):''}
  <div class="ps-links"><a class="acc-primary" href="#/admin/person/${esc(r.person.id)}">${t('invite')}</a>${tm?`<a class="acc-secondary" href="#/admin/team/${esc(tm.id)}">${t('teamRecord')}</a>`:''}</div></section>`;
 const u=r.user,xp=Math.max(0,u.xp||0),lv=levelOf(xp),level=lv.n,per=lv.b-lv.a,into=xp-lv.a;
 const done=r.tasks.filter(x=>x.status==='accepted').length,late=r.tasks.filter(isLate).length,went=r.attendance.filter(a=>a.kind).length;
 const idle=!u.lastSeen||Date.now()-Date.parse(u.lastSeen)>7*86400000;
 const level2=late?'risk':idle?'watch':teamRec?.risk.level||'ok';
 const sigs=[...(late?['overdue_tasks']:[]),...(teamRec?.risk.signals||[]).filter(s=>!(late&&s==='overdue_tasks'))];
 return `<section class="ps-card ps-mgmt"><span class="ps-tag">${t('manage')}</span>
 <div class="ps-hero">${ring(into/per*100,t('level'),`<small>${t('level')}</small>${n(level)}`)}<dl class="ps-facts"><div><dt>${t('points')}</dt><dd class="ui-num">${n(xp)}</dd><span class="ps-sub">${t('toNext',{n:per-into,l:level+1})}</span></div>
 <div class="ps-wide"><dt>${t('tasks')} <b>${done}/${r.tasks.length}</b>${late?` · <b class="ps-late">${late} ${tp('overdue',late)}</b>`:''}</dt><dd>${bar(r.tasks.length?done/r.tasks.length*100:0,late?'is-risk':'is-ok')}${units(r.tasks)}</dd></div>
 <div class="ps-wide"><dt>${t('attendance')} <b>${went}/${r.attendance.length}</b></dt><dd>${bar(r.attendance.length?went/r.attendance.length*100:0,'is-info')}</dd></div></dl></div>
 ${signal(level2,sigs)}${next(r.tasks)}
 <p class="ps-seen ${idle?'is-idle':''}">${t('lastVisit')}: <b>${esc(when(u.lastSeen))}</b></p>
 <div class="ps-links"><a class="acc-primary" href="#/admin/person/${esc(u.id)}">${t('fullRecord')} →</a>${tm?`<a class="acc-secondary" href="#/admin/team/${esc(tm.id)}">${t('teamRecord')}</a>`:''}<a class="acc-secondary" href="#/admin/task/new~user~${esc(u.id)}">${t('giveTask')}</a></div></section>
 <div class="ps-more">${taskList(r.tasks)}${nudge('userIds',u.id)}</div>`;
}
function adminTeamCard(r,vm,mode){
 if(!r)return '';
 const done=r.tasks.filter(x=>x.status==='accepted').length,late=r.tasks.filter(isLate).length,waiting=r.tasks.filter(x=>x.status==='submitted').length;
 const seen=r.members.map(m=>m.lastSeen).filter(Boolean).sort().at(-1)||null;
 const blocker=r.checkins?.[0]?.blocker;
 return `<section class="ps-card ps-mgmt"><span class="ps-tag">${t('manage')}</span>
 <div class="ps-hero">${ring(r.score.percent,t('progress'))}<dl class="ps-facts"><div><dt>${t('teamPoints')}</dt><dd class="ui-num">${n(r.teamXp)}</dd>${r.streak?`<span class="ps-sub ps-flame">${window.BirdIcon?.('flame')||''}${r.streak} ${tp('weeks',r.streak)}</span>`:''}</div>
 <div class="ps-wide"><dt>${t('tasks')} <b>${done}/${r.tasks.length}</b>${late?` · <b class="ps-late">${late} ${tp('overdue',late)}</b>`:''}${waiting?` · <b>${waiting}</b> ${t('waiting')}`:''}</dt><dd>${bar(r.tasks.length?done/r.tasks.length*100:0,late?'is-risk':'is-ok')}${units(r.tasks)}</dd></div></dl></div>
 ${signal(r.risk.level,r.risk.signals)}${blocker?`<p class="ps-note"><b>${t('blocker')}:</b> ${esc(blocker)}</p>`:''}${next(r.tasks)}
 <p class="ps-seen ${!seen||Date.now()-Date.parse(seen)>7*86400000?'is-idle':''}">${t('lastVisit')}: <b>${esc(when(seen))}</b></p>
 <div class="ps-links"><a class="acc-primary" href="#/admin/team/${esc(r.id)}">${t('teamRecord')} →</a><a class="acc-secondary" href="#/admin/task/new~team~${esc(r.id)}">${t('giveTask')}</a>${mode==='office'?'':`<a class="acc-secondary" href="#/office/${esc(r.id)}">${t('inOffice')}</a>`}</div></section>
 <div class="ps-more">${r.members.length?`<h3 class="ps-h">${t('members')} <span>${r.members.length}</span></h3><ul class="ps-list ps-people">${r.members.map(m=>`<li><button type="button" ${linkAttr(mode,'person',m.personId||m.id)}><span>${esc(m.name)}</span><small>${m.xp} ${t('points_short')} · ${esc(when(m.lastSeen,false))}</small></button></li>`).join('')}</ul>${nudge('projectId',r.id)}`:`<p class="ps-note">${t('nobody')}</p>`}${taskList(r.tasks)}</div>`;
}

// Mount: characters live, the card fills from the server, numbers count up on the first showing only.
let lastKey='';
async function fill(el,vm,{mode,extra=''}){
 const body=el.querySelector('[data-ps-body]');if(!body)return;
 const auth=await me(),teamId=vm.staff?null:vm.kind==='team'?vm.id:vm.team?.id;
 // Staff of the incubator have no records; their sheet is the public one.
 const admin=isAdmin(auth.user)&&!vm.staff;
 const [rank,rec,teamRec]=await Promise.all([
  teamId?ranking(teamId):null,
  admin?get('/api/admin/'+(vm.kind==='team'?'team/':'person/')+encodeURIComponent(vm.key||vm.id),10000):null,
  admin&&vm.kind==='person'&&teamId?get('/api/admin/team/'+encodeURIComponent(teamId),10000):null,
 ]);
 if(!body.isConnected)return;
 let html=vm.kind==='team'?(admin&&rec?adminTeamCard(rec,vm,mode):publicTeamCard(rank,vm)):(admin&&rec?`${adminPersonCard(rec,teamRec,vm,mode)}`:publicPersonCard(rank,vm));
 if(vm.kind==='person'&&admin&&rec&&vm.note)html+=`<p class="ps-note">${esc(vm.note)}</p>`;
 body.innerHTML=`<div class="ps-actions"></div>${html}${extra}`;
 const key=el.querySelector('[data-ps-key]')?.dataset.psKey||'';
 if(key!==lastKey&&!reduced()){el.querySelector('.ps')?.classList.add('ps-anim');window.BirdMotion?.play(body);}
 lastKey=key;
 bindNudges(body,auth.csrf);
 return {admin,viewer:auth.user};
}
function bindNudges(scope,csrf){
 scope.querySelectorAll('[data-ps-nudge]').forEach(form=>form.addEventListener('submit',async e=>{
  e.preventDefault();const message=form.elements.message.value.trim();if(!message)return;
  const field=form.dataset.psNudge,id=form.dataset.id;
  const r=await fetch('/api/admin/nudge',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':csrf||''},body:JSON.stringify({message,...(field==='userIds'?{userIds:[id]}:{projectId:id})})}).catch(()=>null);
  const note=document.createElement('p');note.className='ps-note';note.setAttribute('role','status');note.textContent=r?.ok?t('sent'):t('notSent');form.replaceWith(note);
 }));
}
function mount(el,vm,{mode='drawer',extra=''}={}){
 if(!el)return ()=>{};
 const stop=window.BirdCharacter?.start(el)||(()=>{});
 const key=el.querySelector('[data-ps-key]')?.dataset.psKey||'';
 // A person who has just been opened hops once, like a game character being picked.
 if(key!==lastKey&&!reduced()){const c=el.querySelector('.ps-person .cs-char');if(c)setTimeout(()=>{c.classList.remove('cs-hop');void c.offsetWidth;c.classList.add('cs-hop');},420);}
 el.querySelectorAll('[data-ps-pick]').forEach(c=>c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();c.click();}}));
 const ready=fill(el,vm,{mode,extra});
 const fn=()=>stop();fn.ready=ready;return fn;
}

// Drawer ----------------------------------------------------------------------------------------------
let drawer=null,stopDrawer=null,back=null;
function close(){
 stopDrawer?.();stopDrawer=null;
 if(!drawer)return;const d=drawer;drawer=null;
 d.classList.add('is-closing');setTimeout(()=>d.remove(),reduced()?0:220);
 document.documentElement.classList.remove('ps-locked');
 back?.focus?.();back=null;
}
async function resolve(spec){
 const auth=await me(),admin=isAdmin(auth.user);
 if(spec.kind==='team'){
  if(spec.members)return spec;
  const rec=admin?await get('/api/admin/team/'+encodeURIComponent(spec.id),10000):null;
  if(rec)return {kind:'team',id:spec.id,name:rec.name,color:spec.color,description:spec.description||'',members:[...rec.members.filter(m=>m.personId).map(m=>({id:m.personId,key:m.personId,name:m.name,role:A('role_'+m.role)})),...rec.noAccount.map(m=>({id:m.id,key:m.id,name:m.name}))]};
  // Public roster: the one the public office shows (BIRD's projects, or the demo's invented roster).
  const p=window.BirdProjects?.officeProjects?.(lang)?.find(x=>x.id===spec.id);
  const roster=p?null:(await get('/api/demo/roster',60000))?.items?.find(x=>x.id===spec.id);
  const rank=await ranking(spec.id);
  return {kind:'team',id:spec.id,name:spec.name||p?.name||roster?.name||rank?.name||'',color:spec.color||p?.color,description:spec.description||p?.description||roster?.short||'',
   members:(p?.members||roster?.members||[]).map(m=>({id:m.personId||m.id,key:m.personId||m.id,name:m.name||'',role:m.role||'',src:m.portraitAsset||undefined}))};
 }
 if(spec.name&&spec.team!==undefined)return spec;
 const rec=admin?await get('/api/admin/person/'+encodeURIComponent(spec.id),10000):null;
 if(rec){const tm=rec.teams?.[0];const art=rec.hasAccount?rec.person?.id:rec.person.id;
  return {kind:'person',id:art||spec.id,key:spec.id,name:rec.hasAccount?rec.user.name:rec.person.name,role:rec.hasAccount&&tm?A('role_'+tm.role):'',team:tm?{id:tm.id,name:tm.name}:null};}
 const teams=window.BirdProjects?.officeProjects?.(lang)||(await get('/api/demo/roster',60000))?.items||[];
 for(const p of teams){const m=p.members?.find(x=>(x.personId||x.id)===spec.id);if(m)return {kind:'person',id:spec.id,name:m.name,role:m.role||'',src:m.portraitAsset||undefined,team:{id:p.id,name:p.name,color:p.color}};}
 return {kind:'person',id:spec.id,name:spec.name||'',role:spec.role||'',team:spec.team||null};
}
async function open(spec){
 back=document.activeElement;
 const vm=await resolve(spec);
 stopDrawer?.();
 if(!drawer){
  drawer=document.createElement('div');drawer.className='ps-drawer';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');
  drawer.innerHTML='<div class="ps-scrim" data-ps-close></div><aside class="ps-panel" tabindex="-1"></aside>';
  document.body.append(drawer);document.documentElement.classList.add('ps-locked');
  drawer.addEventListener('click',e=>{
   if(e.target.closest('[data-ps-close]')){close();return;}
   const team=e.target.closest('[data-ps-team]'),who=e.target.closest('[data-ps-person]');
   // A picked character hops first, then its own sheet opens.
   if(who){const c=who.closest('.cs-char');setTimeout(()=>open({kind:'person',id:who.dataset.psPerson}),c&&!reduced()?380:0);return;}
   if(team){open({kind:'team',id:team.dataset.psTeam});return;}
   if(e.target.closest('a[href^="#"]'))close();
  });
  drawer.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 }
 const panel=drawer.querySelector('.ps-panel');
 drawer.setAttribute('aria-label',vm.name);
 panel.innerHTML=vm.kind==='team'?team(vm):person(vm);panel.scrollTop=0;
 stopDrawer=mount(panel,vm);panel.focus({preventScroll:true});
}
window.BirdSheet={person,team,mount,open,close,language(l){if(['en','hr','ru'].includes(l))lang=l;},text:t};
})();
