'use strict';
/* Landing page of the demo workspace: language switch, scroll reveals, count-ups, the "gap" timeline and the dot-matrix maps.
   Croatian lives in landing.html; English and Russian here. The product name comes from the page (server/landing.mjs). */

// Contact for pilots. Fill in what we have; only filled fields are shown. All empty = "contact soon" note.
const CONTACT={email:'',telegram:'',phone:''};

(()=>{
const PRODUCT=document.querySelector('meta[name=product-name]')?.content||'';
const LANGS=['hr','en','ru'],KEY='workspace-language';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

const T={
 skip:{en:'Skip to content',ru:'К содержанию'},
 navLabel:{en:'Main navigation',ru:'Основная навигация'},langLabel:{en:'Language',ru:'Язык'},
 navHow:{en:'How it works',ru:'Как это работает'},navMap:{en:'Map',ru:'Карта'},navFaq:{en:'Questions',ru:'Вопросы'},
 ctaDemo:{en:'Open the demo',ru:'Открыть демо'},ctaPilot:{en:'Arrange a pilot',ru:'Договориться о пилоте'},
 heroEyebrow:{en:'For incubators and accelerators',ru:'Для инкубаторов и акселераторов'},
 heroTitle:{en:'Know what all your teams are doing <em><span class="nowrap">—&nbsp;even</span> after the last lecture.</em>',ru:'Вы знаете, чем заняты все ваши команды <em><span class="nowrap">—&nbsp;и</span> после последней лекции.</em>'},
 heroLead:{en:'Teams earn points for real progress, and you see on one dashboard who is moving, who is stuck and who needs help.',ru:'Команды получают баллы за реальный прогресс, а вы на одной панели видите, кто движется, кто застрял и кому нужна помощь.'},
 heroFine:{en:'No sign-up. An invented incubator with six teams — nothing is saved.',ru:'Без регистрации. Выдуманный инкубатор с шестью командами — ничего не сохраняется.'},
 altOffice:{en:'Virtual office of the demo incubator: teams at their desks, each with a progress percentage and a streak of weeks.',ru:'Виртуальный офис демо-инкубатора: команды за своими столами, у каждой процент прогресса и серия недель.'},
 capOffice:{en:'Virtual office: every team has a desk, every person a character',ru:'Виртуальный офис: у каждой команды стол, у каждого человека персонаж'},
 altDash:{en:'Programme manager dashboard: six teams, activity in the last 7 days, average progress, overdue tasks and progress per team.',ru:'Панель руководителя программы: шесть команд, активность за 7 дней, средний прогресс, просроченные задания и прогресс по командам.'},
 capDash:{en:'Programme manager dashboard',ru:'Панель руководителя программы'},
 fact1:{en:'dashboard for every team and every signal',ru:'панель для всех команд и всех сигналов'},
 fact2:{en:'languages: Croatian, English and Russian',ru:'языка: хорватский, английский и русский'},
 fact3:{en:'separate database for each incubator',ru:'отдельная база данных у каждого инкубатора'},
 fact4:{en:'incubators and accelerators in Croatia on our map',ru:'инкубаторов и акселераторов Хорватии на нашей карте'},
 painsEyebrow:{en:'What programme managers tell us',ru:'Что мы слышим от руководителей программ'},
 painsTitle:{en:'The programme ends. The questions don’t.',ru:'Программа заканчивается. Вопросы остаются.'},
 p1Kicker:{en:'Management',ru:'Управление'},
 p1Title:{en:'Every team’s status on one screen.',ru:'Статус каждой команды на одном экране.'},
 p1Pain:{en:'Today the manager walks round the teams, phones them and collects spreadsheets. When a team is stuck, they find out too late.',ru:'Сегодня руководитель обходит команды, звонит им и собирает таблицы. О том, что команда застряла, он узнаёт слишком поздно.'},
 p1a:{en:'Each team’s progress against the cohort average',ru:'Прогресс каждой команды рядом со средним по набору'},
 p1b:{en:'Risk signals: overdue tasks, missed lectures, who has gone quiet',ru:'Сигналы риска: просроченные задания, пропущенные лекции, кто давно не появлялся'},
 p1c:{en:'Who asked for help and what waits for your review',ru:'Кто просит помощи и что ждёт вашей проверки'},
 p1Cta:{en:'See the manager’s dashboard',ru:'Посмотреть панель руководителя'},
 altDash2:{en:'Dashboard: progress per team from 10 to 61 percent, teams by stage, cohort tasks and lecture attendance.',ru:'Панель: прогресс команд от 10 до 61 процента, команды по стадиям, задания набора и посещаемость лекций.'},
 tagRisk:{en:'3 tasks overdue',ru:'3 задания просрочены'},
 p2Kicker:{en:'What nobody sees',ru:'То, чего не видно'},
 p2Title:{en:'Two months of lectures. Then a year in which nobody knows what happens.',ru:'Два месяца лекций. Потом год, когда никто не знает, что происходит.'},
 p2Pain:{en:'After the programme the teams develop on their own. That is exactly when the results you must show the city, the ministry or a donor happen — and there is no data.',ru:'После программы команды развиваются сами. Именно тогда появляются результаты, которые нужно показать городу, министерству или донору, — а данных нет.'},
 gapBefore:{en:'Today',ru:'Сегодня'},gapAfter:{en:'With {p}',ru:'С {p}'},
 gapFog:{en:'Silence. Who gave up? Who grew?',ru:'Тишина. Кто бросил? Кто вырос?'},
 gapPulse:{en:'a signal every week',ru:'сигнал каждую неделю'},
 gapW1:{en:'week 1',ru:'1-я неделя'},gapLast:{en:'last lecture',ru:'последняя лекция'},gapW52:{en:'week 52',ru:'52-я неделя'},
 gapCap:{en:'The weekly check-in, tasks and points keep a signal coming after the lectures stop.',ru:'Еженедельная отметка, задания и баллы дают сигнал и после окончания лекций.'},
 gapNote:{en:'An illustration, not a measurement: how many teams really keep checking in is what a pilot measures.',ru:'Иллюстрация, а не измерение: сколько команд действительно отмечаются, измеряет пилот.'},
 p3Kicker:{en:'For the teams',ru:'Для команд'},
 p3Title:{en:'For teams it is a game, not paperwork.',ru:'Для команд это игра, а не бумажная работа.'},
 p3Pain:{en:'Nobody likes writing reports. So the teams don’t write reports — they complete tasks and collect points.',ru:'Отчёты никто писать не любит. Поэтому команды не пишут отчёты — они выполняют задания и собирают баллы.'},
 p3Chips:{en:'Game',ru:'Игра'},
 chipPoints:{en:'Points',ru:'Баллы'},chipPointsT:{en:'for tasks, attendance and the weekly check-in',ru:'за задания, посещения и недельную отметку'},
 chipLevels:{en:'Levels',ru:'Уровни'},chipLevelsT:{en:'and achievements',ru:'и достижения'},
 chipStreak:{en:'Streak',ru:'Серия'},chipStreakT:{en:'of weeks in a row',ru:'недель подряд'},
 chipMentor:{en:'30 points',ru:'30 баллов'},chipMentorT:{en:'= a meeting with a mentor',ru:'= встреча с ментором'},
 p3Answer:{en:'Teams spend their points on meetings with mentors. They check in because it pays, not because they must.',ru:'Баллы команда тратит на встречи с менторами. Она отмечается, потому что это выгодно, а не потому что обязана.'},
 p3Cta:{en:'Enter the demo as a team',ru:'Войти в демо как команда'},
 altTasks:{en:'Participant progress: personal points, team points, team ranking with streaks and achievements.',ru:'Прогресс участника: личные баллы, баллы команды, рейтинг команд с сериями и достижения.'},
 altPoints:{en:'What points are for: team AgroBit has 90 points, a mentor meeting costs 30 points.',ru:'Зачем нужны баллы: у команды AgroBit 90 баллов, встреча с ментором стоит 30 баллов.'},
 p4Kicker:{en:'Network',ru:'Сеть'},
 p4Title:{en:'Global, not local.',ru:'Глобально, а не локально.'},
 p4Pain:{en:'Every incubator has its own mentors and contacts. A team that needs someone from another country is left without a connection.',ru:'У каждого инкубатора свои менторы и свои контакты. Команда, которой нужен человек из другой страны, остаётся без связи.'},
 p4Answer:{en:'We connect incubators: a team from Split will be able to reach a mentor in Belgrade or an incubator in Ljubljana, with both sides’ consent. We start with Croatia.',ru:'Мы связываем инкубаторы: команда из Сплита сможет выйти на ментора в Белграде или инкубатор в Любляне — с согласия обеих сторон. Начинаем с Хорватии.'},
 p4Honest:{en:'The network is being built. The map shows only what we have actually mapped.',ru:'Сеть строится. На карте только то, что мы действительно собрали.'},
 p4Cta:{en:'See the map',ru:'Посмотреть карту'},
 altNet:{en:'Network sketch: Zagreb, Split and Rijeka connected to Ljubljana, Sarajevo and Belgrade by dashed lines',ru:'Схема сети: Загреб, Сплит и Риека связаны пунктиром с Любляной, Сараево и Белградом'},
 howEyebrow:{en:'How it works',ru:'Как это работает'},howTitle:{en:'Three steps to the full picture.',ru:'Три шага к полной картине.'},
 s1Title:{en:'We set up your space',ru:'Мы настраиваем ваше пространство'},s1Text:{en:'Your name, your teams, your lecture schedule. A separate database just for your incubator.',ru:'Ваше название, ваши команды, ваше расписание лекций. Отдельная база только для вашего инкубатора.'},
 s2Title:{en:'Teams work and collect points',ru:'Команды работают и собирают баллы'},s2Text:{en:'Tasks with deadlines, a weekly check-in, meetings with mentors. Every step earns points.',ru:'Задания со сроками, недельная отметка, встречи с менторами. Каждый шаг приносит баллы.'},
 s3Title:{en:'You see everything on one dashboard',ru:'Вы видите всё на одной панели'},s3Text:{en:'Who is moving, who is stuck, who asked for help. Export the data to CSV for your report.',ru:'Кто движется, кто застрял, кто просит помощи. Данные выгружаются в CSV для отчёта.'},
 mapEyebrow:{en:'Incubator network',ru:'Сеть инкубаторов'},mapTitle:{en:'One map. More and more countries.',ru:'Одна карта. Всё больше стран.'},
 mapLead:{en:'Countries where we have mapped incubators. Hover or tap a marker.',ru:'Страны, где мы собрали инкубаторы. Наведите курсор или нажмите на метку.'},
 altWorld:{en:'Dot-matrix world map; Croatia and its neighbours are highlighted',ru:'Карта мира из точек; Хорватия и соседи выделены'},
regionTitle:{en:'Croatia and neighbouring countries',ru:'Хорватия и соседние страны'},
 stMapped:{en:'On the map',ru:'На карте'},lgMapped:{en:'Croatia · 30 organisations',ru:'Хорватия · 30 организаций'},
 stSoon:{en:'Soon',ru:'Скоро'},lgSoon:{en:'Serbia · researched',ru:'Сербия · изучена'},
 stPlan:{en:'Planned',ru:'В планах'},lgPlan:{en:'Slovenia, Bosnia and Herzegovina, Austria, Hungary',ru:'Словения, Босния и Герцеговина, Австрия, Венгрия'},
 mapCta:{en:'See all incubators in Croatia',ru:'Все инкубаторы Хорватии'},
 mapSrc:{en:'Data from the organisations’ own websites, checked in November 2026. We publish no numbers for other countries until we have mapped them.',ru:'Данные с сайтов самих организаций, проверены в ноябре 2026. Цифры по другим странам не публикуем, пока их не соберём.'},
 faqEyebrow:{en:'Questions',ru:'Вопросы'},faqTitle:{en:'What we are asked before a pilot.',ru:'О чём спрашивают перед пилотом.'},
 q1:{en:'Whose data is it?',ru:'Чьи это данные?'},a1:{en:'Yours. Every incubator has a separate database, and the server is in the EU (Amsterdam). On request we export and delete the data.',ru:'Ваши. У каждого инкубатора отдельная база данных, сервер в ЕС (Амстердам). По запросу выгружаем и удаляем данные.'},
 q2:{en:'Does it work in Croatian?',ru:'Есть ли хорватский язык?'},a2:{en:'Yes. The interface is in Croatian, English and Russian, and every user picks their own language.',ru:'Да. Интерфейс на хорватском, английском и русском, и каждый пользователь выбирает свой язык.'},
 q3:{en:'Do teams have to use it?',ru:'Обязаны ли команды этим пользоваться?'},a3:{en:'They don’t — and that is exactly what the pilot measures. Before it starts we write down the success criteria together, for example the share of teams checking in every week and how much time you spend collecting status updates.',ru:'Нет — и именно это измеряет пилот. До старта мы вместе записываем критерии успеха, например долю команд, которые отмечаются каждую неделю, и сколько времени вы тратите на сбор статуса.'},
 q4:{en:'Our applications are already in Google Forms.',ru:'Заявки у нас уже в Google Forms.'},a4:{en:'We can import Google Forms answers, so teams don’t type everything again.',ru:'Ответы из Google Forms можно импортировать, и командам не придётся вводить всё заново.'},
 q5:{en:'What in the demo is real?',ru:'Что в демо настоящее?'},a5:{en:'The platform is real. The teams, people and numbers in the demo are invented, and nothing you do there is saved.',ru:'Платформа настоящая. Команды, люди и цифры в демо выдуманы, и ничего из того, что вы там делаете, не сохраняется.'},
 actEyebrow:{en:'Next step',ru:'Следующий шаг'},actTitle:{en:'See for yourself. It takes two minutes.',ru:'Посмотрите сами. Это займёт две минуты.'},
 pilotTitle:{en:'Arrange a pilot',ru:'Договориться о пилоте'},
 pilotText:{en:'A pilot runs for one programme cycle. We set up your space with your teams and write down the success criteria before it starts.',ru:'Пилот длится один цикл программы. Мы настраиваем пространство с вашими командами и записываем критерии успеха до старта.'},
 contactSoon:{hr:'Javite nam se — kontakt uskoro. Do tada demo je otvoren svima.',en:'Get in touch — contact details coming soon. Until then the demo is open to everyone.',ru:'Свяжитесь с нами — контакты скоро. А пока демо открыто для всех.'},
 email:{hr:'E-pošta',en:'Email',ru:'Почта'},telegram:{hr:'Telegram',en:'Telegram',ru:'Telegram'},phone:{hr:'Telefon',en:'Phone',ru:'Телефон'},
 footLine:{en:'· a platform for incubators and accelerators',ru:'· платформа для инкубаторов и акселераторов'},footTop:{en:'Back to top ↑',ru:'Наверх ↑'},
 // Map tooltips.
 HR:{hr:'Hrvatska',en:'Croatia',ru:'Хорватия'},RS:{hr:'Srbija',en:'Serbia',ru:'Сербия'},SI:{hr:'Slovenija',en:'Slovenia',ru:'Словения'},BA:{hr:'Bosna i Hercegovina',en:'Bosnia and Herzegovina',ru:'Босния и Герцеговина'},AT:{hr:'Austrija',en:'Austria',ru:'Австрия'},HU:{hr:'Mađarska',en:'Hungary',ru:'Венгрия'},
 orgs:{hr:'organizacija na karti',en:'organisations on the map',ru:'организаций на карте'},
 soonText:{hr:'Istražili smo programe i inkubatore. Uskoro na karti, npr.:',en:'We have researched the programmes and incubators. Soon on the map, e.g.:',ru:'Программы и инкубаторы изучены. Скоро на карте, например:'},
 planText:{hr:'Sljedeći korak mreže. Brojke objavimo kad ih popišemo.',en:'The next step for the network. We publish numbers once we have mapped them.',ru:'Следующий шаг сети. Цифры опубликуем, когда соберём.'},
 hrText:{hr:'Inkubatori, akceleratori i tehnološki parkovi, npr.:',en:'Incubators, accelerators and technology parks, e.g.:',ru:'Инкубаторы, акселераторы и технопарки, например:'},
 incType:{hr:{incubator:'inkubator',accelerator:'akcelerator','technology-park':'tehnološki park',university:'sveučilišni program','coworking-programme':'program i coworking'},en:{incubator:'incubator',accelerator:'accelerator','technology-park':'technology park',university:'university programme','coworking-programme':'programme and coworking'},ru:{incubator:'инкубатор',accelerator:'акселератор','technology-park':'технопарк',university:'университетская программа','coworking-programme':'программа и коворкинг'}},
};

let lang='hr';
try{const s=localStorage.getItem(KEY);if(LANGS.includes(s))lang=s;}catch{}
const t=(k,l=lang)=>{const v=T[k]?.[l]??T[k]?.hr??'';return typeof v==='string'?v.replaceAll('{p}',PRODUCT):v;};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Croatian is whatever the page says; remember it before switching away.
document.querySelectorAll('[data-t]').forEach(el=>{const k=el.dataset.t;(T[k]??={}).hr??=el.innerHTML;});
document.querySelectorAll('[data-t-alt]').forEach(el=>{const k=el.dataset.tAlt;(T[k]??={}).hr??=el.alt;});
document.querySelectorAll('[data-t-aria]').forEach(el=>{const k=el.dataset.tAria;(T[k]??={}).hr??=el.getAttribute('aria-label');});

function applyLang(){
 document.documentElement.lang=lang;
 document.querySelectorAll('[data-t]').forEach(el=>{const v=t(el.dataset.t);if(v&&el.innerHTML!==v)el.innerHTML=v;});
 document.querySelectorAll('[data-t-alt]').forEach(el=>{el.alt=t(el.dataset.tAlt);});
 document.querySelectorAll('[data-t-aria]').forEach(el=>{el.setAttribute('aria-label',t(el.dataset.tAria));});
 document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
 document.querySelectorAll('.map-region title').forEach(el=>{el.textContent=t('regionTitle');});
 renderContact();hideTip();
}
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.lang;try{localStorage.setItem(KEY,lang);}catch{}applyLang();}));
// The demo opens in the language chosen here.
try{if(!localStorage.getItem(KEY))localStorage.setItem(KEY,lang);}catch{}

// Contact block: only the fields we have.
function renderContact(){
 const box=document.querySelector('[data-contact]');if(!box)return;
 const items=[
  CONTACT.email&&{k:'email',href:'mailto:'+CONTACT.email,label:CONTACT.email},
  CONTACT.telegram&&{k:'telegram',href:'https://t.me/'+CONTACT.telegram.replace(/^@/,''),label:'@'+CONTACT.telegram.replace(/^@/,'')},
  CONTACT.phone&&{k:'phone',href:'tel:'+CONTACT.phone.replace(/[^+\d]/g,''),label:CONTACT.phone},
 ].filter(Boolean);
 box.innerHTML=items.length
  ?`<ul class="contact-list">${items.map(i=>`<li><a href="${esc(i.href)}"${i.k==='telegram'?' target="_blank" rel="noopener"':''}>${esc(i.label)} <span>${esc(t(i.k))}</span></a></li>`).join('')}</ul>`
  :`<a class="btn btn-big" href="/demo">${esc(t('ctaDemo'))} <span aria-hidden="true">→</span></a><p class="contact-soon">${esc(t('contactSoon'))}</p>`;
}

// "Enter as a team": sign in as the invented team member, then open their tasks.
document.querySelectorAll('[data-enter]').forEach(b=>b.addEventListener('click',async()=>{
 b.disabled=true;
 try{
  const me=await (await fetch('/api/auth/me',{credentials:'same-origin'})).json().catch(()=>({}));
  const r=await fetch('/api/demo/enter',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',...(me.csrf?{'x-csrf-token':me.csrf}:{})},body:JSON.stringify({as:b.dataset.enter})});
  location.href=r.ok?'/demo#/account/progress':'/demo';
 }catch{location.href='/demo';}
}));

// Scroll reveals and count-ups, once each.
function countUp(el){
 const end=Number(el.dataset.count);if(reduced||!end){el.textContent=String(end);return;}
 const t0=performance.now(),dur=Math.min(1400,500+end*30);
 const step=now=>{const p=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=String(Math.round(end*e));if(p<1)requestAnimationFrame(step);};
 el.textContent='0';requestAnimationFrame(step);
}
const seen=new IntersectionObserver(entries=>entries.forEach(e=>{
 if(!e.isIntersecting)return;
 e.target.classList.add('is-in');seen.unobserve(e.target);
 e.target.querySelectorAll?.('[data-count]').forEach(countUp);
 if(e.target.matches('[data-count]'))countUp(e.target);
}),{threshold:.18,rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('[data-reveal],[data-gap],[data-map]').forEach(el=>seen.observe(el));

// The gap: 52 weeks. Programme weeks are dense; afterwards activity fades into fog, or keeps a weekly pulse.
(function gap(){
 const before=document.querySelector('[data-lane=before]'),after=document.querySelector('[data-lane=after]');if(!before)return;
 const rnd=(s=>()=>(s=(s*16807)%2147483647)/2147483647)(7);
 const prog=Array.from({length:8},()=>70+rnd()*30);
 let a='',b='';
 for(let w=0;w<52;w++){
  const d=w*24;
  if(w<8){a+=`<i class="is-prog" style="--h:${prog[w]}%;--d:${d}"></i>`;b+=`<i class="is-prog" style="--h:${prog[w]}%;--d:${d}"></i>`;continue;}
  const fade=Math.max(0,46*Math.exp(-(w-8)/2.2))+(rnd()<.12?4+rnd()*8:0);
  a+=`<i class="${fade<14?'is-gone':''}" style="--h:${Math.max(2,fade).toFixed(1)}%;--d:${d}"></i>`;
  b+=`<i class="is-week" style="--h:${(32+rnd()*22).toFixed(1)}%;--d:${d}"></i>`;
 }
 before.innerHTML=a;after.innerHTML=b;
})();

// Subtle depth in the hero while scrolling.
if(!reduced){
 const layers=[...document.querySelectorAll('[data-depth]')];let ticking=false;
 addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{const y=scrollY;if(y<1400)layers.forEach(l=>{l.style.transform=`translate3d(0,${(y*Number(l.dataset.depth)).toFixed(1)}px,0)`;});ticking=false;});},{passive:true});
}

/* ---------- Maps ---------- */
const NS='http://www.w3.org/2000/svg';
const W=window.LANDING_WORLD,INC=window.BIRD_INCUBATORS?.items||[];
const R=W?.region;
const proj=(lat,lng)=>[(lng-R.box.west)/(R.box.east-R.box.west)*R.w,(R.box.north-lat)/(R.box.north-R.box.south)*R.h];
// Region dots grouped by how the page talks about the country.
function regionDots(dim){
 const groups={net:'',soon:'',plan:'',o:''},cls={H:'net',R:'soon',S:'plan',B:'plan',A:'plan',U:'plan'};
 R.rows.forEach((line,j)=>{const y=R.step/2+j*R.step;for(let i=0;i<line.length;i++){const c=line[i];if(c==='.')continue;const x=R.step/2+(j%2)*R.step/2+i*R.step;groups[dim?'o':(cls[c]||'o')]+=`M${x.toFixed(1)} ${y.toFixed(1)}h0`;}});
 return groups;
}
const COUNTRIES={
 HR:{st:'net',at:[44.75,15.55],label:[44.05,14.35]},
 RS:{st:'soon',at:[44.05,20.85],label:[43.75,20.4],examples:['NTP Beograd','ICT Hub','NTP Niš','NTP Novi Sad']},
 SI:{st:'plan',at:[46.12,14.85],label:[46.42,14.0]},
 BA:{st:'plan',at:[44.2,17.85],label:[43.3,18.0]},
 AT:{st:'plan',at:[47.08,15.4],label:[46.98,14.1]},
 HU:{st:'plan',at:[46.85,18.6],label:[46.62,18.75]},
};
const HR_EXAMPLES=['zicer','nuqleus','step-ri','tehnoloski-park-split','tera'];
function hrExamples(){
 const pick=HR_EXAMPLES.map(id=>INC.find(i=>i.id===id||i.id.startsWith(id))).filter(Boolean);
 return (pick.length>=3?pick:INC.slice(0,4)).slice(0,4).map(i=>`${i.name.split(' – ')[0].split(' (')[0]} · ${i.city}`);
}
const stLabel={net:'stMapped',soon:'stSoon',plan:'stPlan'};

function svg(tag,attrs={},parent){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);parent?.append(el);return el;}

function drawWorld(){
 const root=document.querySelector('[data-world]');if(!root||!W)return;
 const w=W.world;root.setAttribute('viewBox',`0 0 ${w.w} ${w.h}`);
 let d='';w.rows.forEach((row,j)=>row.forEach(i=>{d+=`M${(i*w.step/2).toFixed(1)} ${(j*w.step+1).toFixed(1)}h0`;}));
 const clip=svg('clipPath',{id:'w-clip'},svg('defs',{},root));
 const wipe=svg('rect',{x:0,y:-10,width:w.w,height:w.h+20,class:'w-reveal'},clip);
 svg('path',{d,class:'w-land','stroke-width':(w.step*.5).toFixed(2),'clip-path':'url(#w-clip)'},root);
 const [lx,ly,lw,lh]=w.lens;
 svg('rect',{x:lx-4,y:ly-3,width:lw+8,height:lh+6,class:'lens'},root);
 const [hx,hy]=w.centres.H;
 const g=svg('g',{},root);
 svg('circle',{cx:hx,cy:hy,r:7,class:'w-pulse-ring'},g);svg('circle',{cx:hx,cy:hy,r:3.2,class:'w-pulse'},g);
 if(!reduced){wipe.style.transform='scaleX(0)';wipe.style.transformOrigin='left';const host=root.closest('[data-map]');const go=()=>{wipe.style.transform='scaleX(1)';};new IntersectionObserver((es,o)=>{if(es.some(e=>e.isIntersecting)){requestAnimationFrame(go);o.disconnect();}},{threshold:.2}).observe(host);}
}

function drawRegion(){
 const root=document.querySelector('[data-region]');if(!root||!R)return;
 root.setAttribute('viewBox',`0 0 ${R.w} ${R.h}`);
 const g=regionDots(false),sw=(R.step*.55).toFixed(2);
 for(const [k,d] of Object.entries(g))if(d)svg('path',{d,class:'r-dots r-'+k,'stroke-width':sw},root);
 // Country markers with ripples.
 for(const [code,c] of Object.entries(COUNTRIES)){
  const [x,y]=proj(...c.at),[tx,ty]=proj(...c.label);
  const lab=svg('text',{x:tx,y:ty,class:'mk-label'+(c.st==='plan'?' is-plan':''),'text-anchor':'middle'},root);lab.dataset.country=code;
  const m=svg('g',{class:'mk is-'+c.st,tabindex:0,role:'button'},root);m.dataset.country=code;
  svg('circle',{cx:x,cy:y,r:26,class:'halo'},m);
  svg('circle',{cx:x,cy:y,r:9,class:'ring'},m);svg('circle',{cx:x,cy:y,r:9,class:'ring'},m);
  svg('circle',{cx:x,cy:y,r:c.st==='plan'?6:8,class:'core'},m);
 }
 // Incubators: organisations in the same city sit in a small ring around it.
 const byCity={};INC.forEach(i=>(byCity[i.city]??=[]).push(i));
 for(const list of Object.values(byCity)){
  const [cx,cy]=proj(list[0].lat,list[0].lng);
  list.forEach((inc,k)=>{
   const n=list.length,rad=n>1?6+n*1.6:0,a=k/n*Math.PI*2-Math.PI/2;
   const p=svg('g',{class:'inc',tabindex:0,role:'button'},root);p.dataset.inc=inc.id;
   svg('circle',{cx:(cx+Math.cos(a)*rad).toFixed(1),cy:(cy+Math.sin(a)*rad).toFixed(1),r:4.6},p);
  });
 }
 root.querySelectorAll('.mk-label').forEach(l=>root.append(l));
 labelCountries();
}
function labelCountries(){document.querySelectorAll('.mk-label').forEach(l=>{l.textContent=t(l.dataset.country);});document.querySelectorAll('.mk').forEach(m=>m.setAttribute('aria-label',`${t(m.dataset.country)}: ${t(stLabel[COUNTRIES[m.dataset.country].st])}`));document.querySelectorAll('.inc').forEach(p=>{const i=INC.find(x=>x.id===p.dataset.inc);p.setAttribute('aria-label',`${i.name}, ${i.city}`);});}

// Tooltip card, positioned next to the hovered or focused marker.
const tip=document.querySelector('.map-tip'),host=document.querySelector('[data-map]');
let tipFor=null,shownAt=0;
function tipHtml(el){
 if(el.dataset.inc){const i=INC.find(x=>x.id===el.dataset.inc);return `<span class="st is-net">${esc(t('HR'))} · ${esc(i.city)}</span><h4>${esc(i.name)}</h4><p>${esc(T.incType[lang]?.[i.type]||T.incType.hr[i.type]||'')}</p>`;}
 const code=el.dataset.country,c=COUNTRIES[code];
 let body='';
 if(code==='HR')body=`<div class="big"><b>${INC.length}</b><span>${esc(t('orgs'))}</span></div><p>${esc(t('hrText'))}</p><ul>${hrExamples().map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`;
 else if(c.st==='soon')body=`<p>${esc(t('soonText'))}</p><ul>${c.examples.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`;
 else body=`<p>${esc(t('planText'))}</p>`;
 return `<span class="st is-${c.st}">${esc(t(stLabel[c.st]))}</span><h4>${esc(t(code))}</h4>${body}`;
}
function showTip(el){
 if(!tip||!host)return;
 document.querySelectorAll('.mk.is-on,.inc.is-on').forEach(x=>x.classList.remove('is-on'));
 el.classList.add('is-on');if(tipFor!==el||tip.hidden)shownAt=performance.now();tipFor=el;
 tip.innerHTML=tipHtml(el);tip.hidden=false;
 const hb=host.getBoundingClientRect(),mb=el.querySelector('.core,circle').getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
 let x=mb.left-hb.left+mb.width/2+18,y=mb.top-hb.top-th/2;
 if(x+tw>hb.width)x=mb.left-hb.left-tw-18;
 if(x<0){x=Math.max(4,Math.min(hb.width-tw-4,mb.left-hb.left-tw/2));y=mb.bottom-hb.top+16;}
 y=Math.max(-10,Math.min(y,hb.height-th+10));
 tip.style.left=x+'px';tip.style.top=y+'px';
 tip.style.animation='none';void tip.offsetWidth;tip.style.animation='';
}
function hideTip(){if(tip){tip.hidden=true;}tipFor?.classList.remove('is-on');tipFor=null;}

drawWorld();drawRegion();
// A wedge from the small box on the world map to the zoomed region, beside it on wide screens and below it on phones.
function drawZoom(){
 const z=document.querySelector('[data-zoom]'),lens=document.querySelector('.lens'),reg=document.querySelector('.map-region');if(!z||!lens||!reg)return;
 const hb=host.getBoundingClientRect(),a=lens.getBoundingClientRect(),b=reg.getBoundingClientRect();
 const L={l:a.left-hb.left,r:a.right-hb.left,t:a.top-hb.top,b:a.bottom-hb.top},G={l:b.left-hb.left,r:b.right-hb.left,t:b.top-hb.top,b:b.bottom-hb.top};
 const side=G.l>=L.r;
 const pts=side?[[L.r,L.t],[G.l,G.t],[G.l,G.b],[L.r,L.b]]:[[L.l,L.b],[G.l,G.t],[G.r,G.t],[L.r,L.b]];
 z.setAttribute('viewBox',`0 0 ${hb.width} ${hb.height}`);
 z.querySelector('polygon').setAttribute('points',pts.map(p=>p.join(',')).join(' '));
 const [l1,l2]=z.querySelectorAll('line');
 [[l1,pts[0],pts[1]],[l2,pts[3],pts[2]]].forEach(([l,p,q])=>{l.setAttribute('x1',p[0]);l.setAttribute('y1',p[1]);l.setAttribute('x2',q[0]);l.setAttribute('y2',q[1]);});
}
drawZoom();addEventListener('resize',drawZoom);addEventListener('load',drawZoom);
document.querySelectorAll('.mk,.inc').forEach(el=>{
 el.addEventListener('mouseenter',()=>showTip(el));el.addEventListener('focus',()=>showTip(el));
 el.addEventListener('mouseleave',()=>{if(document.activeElement!==el)hideTip();});el.addEventListener('blur',hideTip);
 // A tap fires hover, focus and click together; only a later tap on the same marker closes the card.
 el.addEventListener('click',e=>{e.stopPropagation();tipFor===el&&!tip.hidden&&performance.now()-shownAt>450?hideTip():showTip(el);});
 el.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();if(e.key==='Enter'||e.key===' '){e.preventDefault();showTip(el);}});
});
document.addEventListener('click',e=>{if(tipFor&&!e.target.closest?.('.mk,.inc'))hideTip();});
addEventListener('resize',()=>{if(tipFor)showTip(tipFor);});

// The network sketch: Croatian cities linked to neighbours' capitals by flowing dashed lines.
(function netviz(){
 const root=document.querySelector('[data-netviz]');if(!root||!R)return;
 root.setAttribute('viewBox',`0 0 ${R.w} ${R.h}`);
 const g=regionDots(false);
 for(const [k,d] of Object.entries(g))if(d)svg('path',{d,class:'r-dots r-'+k,'stroke-width':(R.step*.42).toFixed(2),opacity:k==='net'?.55:1},root);
 const C={zg:[45.81,15.98,'Zagreb'],st:[43.51,16.44,'Split'],ri:[45.33,14.44,'Rijeka'],lj:[46.05,14.51,'Ljubljana'],bg:[44.79,20.45,'Beograd'],sa:[43.86,18.41,'Sarajevo']};
 const P=k=>proj(C[k][0],C[k][1]);
 const links=[['zg','st',1],['zg','ri',1],['zg','lj',0],['st','bg',0],['zg','bg',0],['st','sa',0]];
 const style=document.createElementNS(NS,'style');
 style.textContent=`.nl{fill:none;stroke-width:2.2}.nl.on{stroke:#5cc48a}.nl.off{stroke:#e8a93c;stroke-dasharray:6 7;animation:flow 1.6s linear infinite}@keyframes flow{to{stroke-dashoffset:-26}}.nc{fill:#242a26;stroke-width:3}.nt{font:700 15px Inter,-apple-system,sans-serif;fill:#f7f5f0;paint-order:stroke;stroke:#242a26;stroke-width:5px}@media(prefers-reduced-motion:reduce){.nl.off{animation:none}}`;
 root.append(style);
 for(const [a,b,on] of links){const [x1,y1]=P(a),[x2,y2]=P(b),mx=(x1+x2)/2,my=(y1+y2)/2-Math.hypot(x2-x1,y2-y1)*.22;svg('path',{d:`M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`,class:'nl '+(on?'on':'off')},root);}
 for(const k of Object.keys(C)){const [x,y]=P(k),hr=['zg','st','ri'].includes(k);svg('circle',{cx:x,cy:y,r:k==='zg'?9:7,class:'nc',stroke:hr?'#5cc48a':'#e8a93c'},root);const tx=svg('text',{x:x+(k==='ri'||k==='lj'?-12:12),y:y+(k==='st'?22:-12),class:'nt','text-anchor':k==='ri'||k==='lj'?'end':'start'},root);tx.textContent=C[k][2];}
})();

applyLang();labelCountries();
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',labelCountries));
})();
