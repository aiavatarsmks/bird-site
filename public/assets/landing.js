'use strict';
/* Landing page of the demo workspace: language switch, the hero video, the "gap" timeline and
   the dot-matrix maps. Croatian lives in landing.html; English and Russian here. The product name comes from the page
   (server/landing.mjs). Nothing animates on its own (owner, 20 Nov): no reveals, count-ups, ripples or flowing lines. */

// Contact for pilots. Fill in what we have; only filled fields are shown. All empty = "contact soon" note.
const CONTACT={email:'',telegram:'',phone:''};

(()=>{
const PRODUCT=document.querySelector('meta[name=product-name]')?.content||'';
const LANGS=['hr','en','ru'],KEY='workspace-language';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js','js-ok');

/* Hero video: our demo office, framed beside the headline. The poster (its first frame) is always there and is the
   only thing a visitor gets with reduced motion, Save-Data, a 2G-class connection, or a narrow phone (where the still
   frame is enough and keeps the first load light). Otherwise the sources are added once the page has loaded, so the video never competes
   with the page itself; it pauses while the hero is off screen. */
(function heroVideo(){
 const v=document.querySelector('[data-hero-video]');if(!v)return;
 const c=navigator.connection||{};
 if(reduced||c.saveData||/(^|-)2g$/.test(c.effectiveType||'')||matchMedia('(max-width: 599px)').matches)return;
 const start=()=>{
  if(v.dataset.on)return;v.dataset.on='1';
  for(const [k,type] of [['webm','video/webm'],['mp4','video/mp4']]){const s=document.createElement('source');s.src=v.dataset[k];s.type=type;v.append(s);}
  v.addEventListener('playing',()=>v.classList.add('is-playing'),{once:true});
  v.load();v.play()?.catch(()=>{}); // autoplay refused: the poster stays
  if('IntersectionObserver' in window)new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)v.play()?.catch(()=>{});else v.pause();})).observe(v);
 };
 if(document.readyState==='complete')setTimeout(start,200);else addEventListener('load',()=>setTimeout(start,200),{once:true});
})();

const T={
 skip:{en:'Skip to content',ru:'К содержанию'},
 navLabel:{en:'Main navigation',ru:'Основная навигация'},langLabel:{en:'Language',ru:'Язык'},
 navHow:{en:'How it works',ru:'Как это работает'},navMap:{en:'Map',ru:'Карта'},navFaq:{en:'Questions',ru:'Вопросы'},
 ctaDemo:{en:'Open the demo',ru:'Открыть демо'},ctaPilot:{en:'Arrange a pilot',ru:'Договориться о пилоте'},
 heroEyebrow:{en:'For incubators and accelerators',ru:'Для инкубаторов и акселераторов'},
 heroTitle:{en:'Know what all your teams are doing. <em>Even after the last lecture.</em>',ru:'Вы знаете, чем заняты все ваши команды. <em>И после последней лекции.</em>'},
 heroLead:{en:'Teams earn points for real progress, and you see on one dashboard who is moving, who is stuck and who needs help.',ru:'Команды получают баллы за реальный прогресс, а вы на одной панели видите, кто движется, кто застрял и кому нужна помощь.'},
 heroFine:{en:'No sign-up. An invented incubator with six teams. Nothing is saved.',ru:'Без регистрации. Выдуманный инкубатор с шестью командами. Ничего не сохраняется.'},
 capOffice:{en:'Virtual office: every team has a desk, every person a character',ru:'Виртуальный офис: у каждой команды стол, у каждого человека персонаж'},
 fact1:{en:'dashboard for every team and every signal',ru:'панель для всех команд и всех сигналов'},
 fact2:{en:'languages: Croatian, English and Russian',ru:'языка: хорватский, английский и русский'},
 fact3:{en:'separate database for each incubator',ru:'отдельная база данных у каждого инкубатора'},
 fact4:{en:'incubators and accelerators in Croatia on our map',ru:'инкубаторов и акселераторов Хорватии на нашей карте'},
 painsEyebrow:{en:'What programme managers tell us',ru:'Что мы слышим от руководителей программ'},
 painsTitle:{en:'The programme ends. The questions don’t.',ru:'Программа заканчивается. Вопросы остаются.'},
 p1Kicker:{en:'Management',ru:'Управление'},
 p1Title:{en:'Every team’s status on one screen.',ru:'Статус каждой команды на одном экране.'},
 p1Pain:{en:'Today the manager walks round the teams, phones them and collects spreadsheets. When a team is stuck, they find out too late.',ru:'Сегодня руководитель обходит команды, звонит им и собирает таблицы. О том, что команда застряла, он узнаёт слишком поздно.'},
 p1a:{en:'Each team’s progress against the cohort average',ru:'Прогресс каждой команды рядом со средним по потоку'},
 p1b:{en:'Risk signals: overdue tasks, missed lectures, who has gone quiet',ru:'Сигналы риска: просроченные задания, пропущенные лекции, кто давно не появлялся'},
 p1c:{en:'Who asked for help and what waits for your review',ru:'Кто просит помощи и что ждёт вашей проверки'},
 p1Cta:{en:'See the manager’s dashboard',ru:'Посмотреть панель руководителя'},
 altDash2:{en:'Dashboard: progress per team from 10 to 61 percent, teams by stage, cohort tasks and lecture attendance.',ru:'Панель: прогресс команд от 10 до 61 процента, команды по этапам, задания потока и посещаемость лекций.'},
 tagRisk:{en:'3 tasks overdue',ru:'3 задания просрочены'},
 p2Kicker:{en:'What nobody sees',ru:'То, чего не видно'},
 p2Title:{en:'Two months of lectures. Then a year in which nobody knows what happens.',ru:'Два месяца лекций. Потом год, когда никто не знает, что происходит.'},
 p2Pain:{en:'After the programme the teams develop on their own. That is exactly when the results you must show the city, the ministry or a donor happen. And there is no data.',ru:'После программы команды развиваются сами. Именно тогда появляются результаты, которые нужно показать городу, министерству или фонду. А данных нет.'},
 gapBefore:{en:'Today',ru:'Сегодня'},gapAfter:{en:'With {p}',ru:'С {p}'},
 gapFog:{en:'Silence. Who gave up? Who grew?',ru:'Тишина. Кто бросил? Кто вырос?'},
 gapPulse:{en:'a signal every week',ru:'сигнал каждую неделю'},
 gapW1:{en:'week 1',ru:'1-я неделя'},gapLast:{en:'last lecture',ru:'последняя лекция'},gapW52:{en:'week 52',ru:'52-я неделя'},
 gapCap:{en:'The weekly check-in, tasks and points keep a signal coming after the lectures stop.',ru:'Еженедельный отчёт, задания и баллы дают сигнал и после окончания лекций.'},
 gapNote:{en:'An illustration, not a measurement: how many teams really keep checking in is what a pilot measures.',ru:'Иллюстрация, а не измерение: сколько команд действительно отчитываются каждую неделю, покажет пилот.'},
 p3Kicker:{en:'For the teams',ru:'Для команд'},
 p3Title:{en:'For teams it is a game, not paperwork.',ru:'Для команд это игра, а не бумажная работа.'},
 p3Pain:{en:'Nobody likes writing reports. So the teams don’t write reports: they complete tasks and collect points.',ru:'Длинные отчёты никто писать не любит. Поэтому вместо них команды выполняют задания и собирают баллы.'},
 p3Chips:{en:'Game',ru:'Игра'},
 chipPoints:{en:'Points',ru:'Баллы'},chipPointsT:{en:'for tasks, attendance and the weekly check-in',ru:'за задания, посещения и еженедельный отчёт'},
 chipLevels:{en:'Levels',ru:'Уровни'},chipLevelsT:{en:'and achievements',ru:'и достижения'},
 chipStreak:{en:'Streak',ru:'Серия'},chipStreakT:{en:'of weeks in a row',ru:'недель подряд'},
 chipMentor:{en:'30 points',ru:'30 баллов'},chipMentorT:{en:'= a meeting with a mentor',ru:'= встреча с ментором'},
 p3Answer:{en:'Teams spend their points on meetings with mentors. They check in because it pays, not because they must.',ru:'Баллы команда тратит на встречи с менторами. Она отчитывается, потому что ей это выгодно, а не потому что обязана.'},
 p3Cta:{en:'Enter the demo as a team',ru:'Войти в демо как команда'},
 altTasks:{en:'Participant progress: personal points, team points, team ranking with streaks and achievements.',ru:'Прогресс участника: личные баллы, баллы команды, рейтинг команд с сериями и достижения.'},
 altPoints:{en:'What points are for: team AgroBit has 90 points, a mentor meeting costs 30 points.',ru:'Зачем нужны баллы: у команды AgroBit 90 баллов, встреча с ментором стоит 30 баллов.'},
 p4Kicker:{en:'Network',ru:'Сеть'},
 p4Title:{en:'Global, not local.',ru:'Глобально, а не локально.'},
 p4Pain:{en:'Every incubator has its own mentors and contacts. A team that needs someone from another country is left without a connection.',ru:'У каждого инкубатора свои менторы и свои контакты. Команда, которой нужен человек из другой страны, остаётся без связи.'},
 p4Answer:{en:'We connect incubators: a team from Split will be able to reach a mentor in Belgrade or an incubator in Ljubljana, with both sides’ consent. We start with Croatia.',ru:'Мы связываем инкубаторы: команда из Сплита сможет выйти на ментора в Белграде или инкубатор в Любляне, с согласия обеих сторон. Начинаем с Хорватии.'},
 p4Honest:{en:'The network is being built. The map shows only what we have actually mapped.',ru:'Сеть строится. На карте только те организации, которые мы действительно проверили.'},
 p4Cta:{en:'See the map',ru:'Посмотреть карту'},
 altNet:{en:'Network sketch: Zagreb, Split and Rijeka connected to Ljubljana, Sarajevo and Belgrade by dashed lines',ru:'Схема сети: Загреб, Сплит и Риека связаны пунктиром с Любляной, Сараево и Белградом'},
 howEyebrow:{en:'How it works',ru:'Как это работает'},howTitle:{en:'Three steps to the full picture.',ru:'Три шага к полной картине.'},
 s1Title:{en:'We set up your space',ru:'Мы настраиваем ваше пространство'},s1Text:{en:'Your name, your teams, your lecture schedule. A separate database just for your incubator.',ru:'Ваше название, ваши команды, ваше расписание лекций. Отдельная база только для вашего инкубатора.'},
 s2Title:{en:'Teams work and collect points',ru:'Команды работают и собирают баллы'},s2Text:{en:'Tasks with deadlines, a weekly check-in, meetings with mentors. Every step earns points.',ru:'Задания со сроками, еженедельный отчёт, встречи с менторами. Каждый шаг приносит баллы.'},
 s3Title:{en:'You see everything on one dashboard',ru:'Вы видите всё на одной панели'},s3Text:{en:'Who is moving, who is stuck, who asked for help. Export the data to CSV for your report.',ru:'Кто движется, кто застрял, кто просит помощи. Данные выгружаются в CSV для отчёта.'},
 mapEyebrow:{en:'Incubator network',ru:'Сеть инкубаторов'},mapTitle:{en:'One map. More and more countries.',ru:'Одна карта. Всё больше стран.'},
 mapLead:{en:'Countries where we have mapped incubators. Hover or tap a marker.',ru:'Страны, где мы составили список инкубаторов. Наведите курсор или нажмите на метку.'},
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
 q3:{en:'Do teams have to use it?',ru:'Обязаны ли команды этим пользоваться?'},a3:{en:'They don’t, and that is exactly what the pilot measures. Before it starts we write down the success criteria together, for example the share of teams checking in every week and how much time you spend collecting status updates.',ru:'Нет, и именно это измеряет пилот. До старта мы вместе записываем критерии успеха, например долю команд, которые отчитываются каждую неделю, и сколько времени вы тратите на сбор статуса.'},
 q4:{en:'Our applications are already in Google Forms.',ru:'Заявки у нас уже в Google Forms.'},a4:{en:'We can import Google Forms answers, so teams don’t type everything again.',ru:'Ответы из Google Forms можно импортировать, и командам не придётся вводить всё заново.'},
 q5:{en:'What in the demo is real?',ru:'Что в демо настоящее?'},a5:{en:'The platform is real. The teams, people and numbers in the demo are invented, and nothing you do there is saved.',ru:'Платформа настоящая. Команды, люди и цифры в демо выдуманы, и ничего из того, что вы там делаете, не сохраняется.'},
 actEyebrow:{en:'Next step',ru:'Следующий шаг'},actTitle:{en:'See for yourself. It takes two minutes.',ru:'Посмотрите сами. Это займёт две минуты.'},
 pilotTitle:{en:'Arrange a pilot',ru:'Договориться о пилоте'},
 pilotText:{en:'A pilot runs for one programme cycle. We set up your space with your teams and write down the success criteria before it starts.',ru:'Пилот длится один цикл программы. Мы настраиваем пространство с вашими командами и записываем критерии успеха до старта.'},
 contactSoon:{hr:'Javite nam se, kontakt stiže uskoro. Do tada demo je otvoren svima.',en:'Get in touch: contact details are coming soon. Until then the demo is open to everyone.',ru:'Свяжитесь с нами: контакты появятся скоро. А пока демо открыто для всех.'},
 email:{hr:'E-pošta',en:'Email',ru:'Почта'},telegram:{hr:'Telegram',en:'Telegram',ru:'Telegram'},phone:{hr:'Telefon',en:'Phone',ru:'Телефон'},

 // Map tooltips.
 HR:{hr:'Hrvatska',en:'Croatia',ru:'Хорватия'},RS:{hr:'Srbija',en:'Serbia',ru:'Сербия'},SI:{hr:'Slovenija',en:'Slovenia',ru:'Словения'},BA:{hr:'Bosna i Hercegovina',en:'Bosnia and Herzegovina',ru:'Босния и Герцеговина'},AT:{hr:'Austrija',en:'Austria',ru:'Австрия'},HU:{hr:'Mađarska',en:'Hungary',ru:'Венгрия'},
 orgs:{hr:'organizacija na karti',en:'organisations on the map',ru:'организаций на карте'},
 soonText:{hr:'Istražili smo programe i inkubatore. Uskoro na karti, npr.:',en:'We have researched the programmes and incubators. Soon on the map, e.g.:',ru:'Программы и инкубаторы изучены. Скоро на карте, например:'},
 planText:{hr:'Sljedeći korak mreže. Brojke objavimo kad ih popišemo.',en:'The next step for the network. We publish numbers once we have mapped them.',ru:'Следующий шаг сети. Цифры опубликуем, когда соберём.'},
 hrText:{hr:'Inkubatori, akceleratori i tehnološki parkovi, npr.:',en:'Incubators, accelerators and technology parks, e.g.:',ru:'Инкубаторы, акселераторы и технопарки, например:'},
 incType:{hr:{incubator:'inkubator',accelerator:'akcelerator','technology-park':'tehnološki park',university:'sveučilišni program','coworking-programme':'program i coworking'},en:{incubator:'incubator',accelerator:'accelerator','technology-park':'technology park',university:'university programme','coworking-programme':'programme and coworking'},ru:{incubator:'инкубатор',accelerator:'акселератор','technology-park':'технопарк',university:'университетская программа','coworking-programme':'программа и коворкинг'}},
};

// Pilot request form (#contact). All three languages here; Croatian is also in landing.html for the first paint.
Object.assign(T,{
 pfRequired:{hr:'obavezno polje',en:'required field',ru:'обязательное поле'},
 pfName:{hr:'Ime i prezime',en:'Full name',ru:'Имя и фамилия'},
 pfOrg:{hr:'Inkubator ili akcelerator',en:'Incubator or accelerator',ru:'Инкубатор или акселератор'},
 pfEmail:{hr:'E-pošta',en:'Email',ru:'Почта'},
 pfPhone:{hr:'Telefon',en:'Phone',ru:'Телефон'},
 pfOptional:{hr:'(neobavezno)',en:'(optional)',ru:'(необязательно)'},
 pfTeams:{hr:'Timova u jednom ciklusu',en:'Teams per cohort',ru:'Команд в одном потоке'},
 pfTeamsPick:{hr:'Odaberite',en:'Choose',ru:'Выберите'},
 pfTeams50:{hr:'više od 50',en:'more than 50',ru:'больше 50'},
 pfMessage:{hr:'Poruka',en:'Message',ru:'Сообщение'},
 pfConsent:{hr:'Slažem se da me kontaktirate u vezi s pilotom.',en:'I agree to be contacted about the pilot.',ru:'Я согласен(на), чтобы со мной связались по поводу пилота.'},
 pfPrivacy:{hr:'Podatke koristimo samo za dogovor o pilotu. Ne dijelimo ih i brišemo ih na vaš zahtjev. <a href="/privacy">Obavijest o privatnosti</a>',en:'We use these details only to arrange the pilot. We do not share them and delete them on request. <a href="/privacy">Privacy notice</a>',ru:'Данные используем только чтобы договориться о пилоте. Не передаём третьим лицам и удаляем по запросу. <a href="/privacy">Политика конфиденциальности</a>'},
 pfSend:{hr:'Pošalji upit',en:'Send request',ru:'Отправить заявку'},
 pfSending:{hr:'Šaljem…',en:'Sending…',ru:'Отправляем…'},
 pfErrName:{hr:'Upišite ime i prezime.',en:'Enter your name.',ru:'Укажите имя и фамилию.'},
 pfErrOrg:{hr:'Upišite naziv inkubatora ili akceleratora.',en:'Enter the name of your incubator or accelerator.',ru:'Укажите название инкубатора или акселератора.'},
 pfErrEmail:{hr:'Upišite e-poštu, npr. ime@inkubator.hr.',en:'Enter an email address, e.g. name@incubator.com.',ru:'Укажите почту, например name@incubator.com.'},
 pfErrPhone:{hr:'Telefon smije imati brojeve, razmake i +.',en:'A phone number may contain digits, spaces and +.',ru:'В номере допустимы цифры, пробелы и +.'},
 pfErrConsent:{hr:'Bez suglasnosti ne možemo vam odgovoriti.',en:'We need your consent to reply.',ru:'Без согласия мы не сможем ответить.'},
 pfErrRate:{hr:'Previše upita s ove adrese. Pokušajte ponovno za sat vremena.',en:'Too many requests from this address. Please try again in an hour.',ru:'Слишком много заявок с этого адреса. Попробуйте через час.'},
 pfErrNet:{hr:'Slanje nije uspjelo. Provjerite vezu i pokušajte ponovno.',en:'Sending failed. Check your connection and try again.',ru:'Не удалось отправить. Проверьте соединение и попробуйте снова.'},
 pfDoneTitle:{hr:'Hvala, upit je stigao.',en:'Thank you, your request has arrived.',ru:'Спасибо, заявка получена.'},
 pfDoneText:{hr:'Javit ćemo vam se e-poštom da dogovorimo kratak razgovor:',en:'We will email you to arrange a short call:',ru:'Мы напишем вам, чтобы договориться о коротком звонке:'},
});

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
 // Without direct contacts the pilot form above is the way in.
 box.innerHTML=items.length?`<ul class="contact-list">${items.map(i=>`<li><a href="${esc(i.href)}"${i.k==='telegram'?' target="_blank" rel="noopener"':''}>${esc(i.label)} <span>${esc(t(i.k))}</span></a></li>`).join('')}</ul>`:'';
}

// Pilot request form. Errors show after the person leaves a field (or on submit), next to the field, and clear as soon
// as it is fixed; an error element carries its text key in data-t, so switching language translates it too.
(()=>{
 const form=document.querySelector('[data-pilot]');if(!form)return;
 const done=document.querySelector('[data-pilot-done]'),failBox=form.querySelector('[data-pilot-fail]'),send=form.querySelector('[type=submit]');
 const PHONE=/^\+?[\d\s()./-]{6,30}$/,EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
 const live=document.createElement('div');live.className='pf-live';live.setAttribute('aria-live','polite');document.body.append(live);
 const problem=el=>{
  const v=el.type==='checkbox'?el.checked:el.value.trim();
  if(el.name==='name')return v.length<2?'pfErrName':'';
  if(el.name==='organisation')return v.length<2?'pfErrOrg':'';
  if(el.name==='email')return EMAIL.test(v)?'':'pfErrEmail';
  if(el.name==='phone')return !v||PHONE.test(v)?'':'pfErrPhone';
  if(el.name==='consent')return v?'':'pfErrConsent';
  return '';
 };
 const show=(el,key,announce=false)=>{
  const err=document.getElementById(el.dataset.error);if(!err)return;
  const ids=(el.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==err.id);
  if(key){err.dataset.t=key;err.innerHTML=esc(t(key));err.hidden=false;ids.push(err.id);}
  else{delete err.dataset.t;err.textContent='';err.hidden=true;}
  el.setAttribute('aria-invalid',key?'true':'false');
  if(ids.length)el.setAttribute('aria-describedby',ids.join(' '));else el.removeAttribute('aria-describedby');
  if(key&&announce){live.textContent='';setTimeout(()=>{live.textContent=(el.labels?.[0]?.querySelector('[data-t]')?.textContent||'')+': '+t(key);},400);}
 };
 const fields=[...form.querySelectorAll('[data-error]')],touched=new WeakSet();
 fields.forEach(el=>el.setAttribute('aria-invalid','false'));
 form.addEventListener('input',e=>{const el=e.target;if(!el.dataset?.error)return;touched.add(el);if(el.getAttribute('aria-invalid')==='true'&&!problem(el))show(el,'');});
 form.addEventListener('change',e=>{const el=e.target;if(el.type==='checkbox')show(el,problem(el),true);});
 form.addEventListener('focusout',e=>{const el=e.target;if(el.dataset?.error&&touched.has(el))show(el,problem(el),true);});
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  failBox.hidden=true;
  const bad=fields.filter(el=>{const k=problem(el);show(el,k);return k;});
  if(bad.length){bad[0].focus();return;}
  const f=new FormData(form),body={name:f.get('name'),organisation:f.get('organisation'),email:f.get('email'),phone:f.get('phone')||'',teams:f.get('teams')||'',message:f.get('message')||'',consent:f.get('consent')==='on',website:f.get('website')||'',language:lang};
  send.disabled=true;form.setAttribute('aria-busy','true');const label=send.querySelector('[data-t]');label.dataset.t='pfSending';label.textContent=t('pfSending');
  const stop=()=>{send.disabled=false;form.removeAttribute('aria-busy');label.dataset.t='pfSend';label.textContent=t('pfSend');};
  let r;
  try{r=await fetch('/api/pilot-request',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
  catch{stop();failBox.dataset.t='pfErrNet';failBox.textContent=t('pfErrNet');failBox.hidden=false;return;}
  stop();
  if(r.ok){
   done.querySelector('[data-pilot-email]').textContent=body.email.trim();
   form.hidden=true;done.hidden=false;done.focus();return;
  }
  const data=await r.json().catch(()=>({})),field=data?.error?.detail?.field,el=field&&form.elements[field];
  if(el?.dataset?.error){show(el,problem(el)||{name:'pfErrName',organisation:'pfErrOrg',email:'pfErrEmail',phone:'pfErrPhone',consent:'pfErrConsent'}[field]);el.focus();return;}
  const key=r.status===429?'pfErrRate':'pfErrNet';failBox.dataset.t=key;failBox.textContent=t(key);failBox.hidden=false;
 });
})();

// "Enter as a team": sign in as the invented team member, then open their tasks.
document.querySelectorAll('[data-enter]').forEach(b=>b.addEventListener('click',async()=>{
 b.disabled=true;
 try{
  const me=await (await fetch('/api/auth/me',{credentials:'same-origin'})).json().catch(()=>({}));
  const r=await fetch('/api/demo/enter',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',...(me.csrf?{'x-csrf-token':me.csrf}:{})},body:JSON.stringify({as:b.dataset.enter})});
  location.href=r.ok?'/demo#/account/progress':'/demo';
 }catch{location.href='/demo';}
}));

// The gap: 52 weeks. Programme weeks are dense; afterwards activity fades into silence, or keeps a weekly signal.
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
 const [hx,hy]=w.centres.H;
 svg('rect',{x:0,y:-10,width:w.w,height:w.h+20},clip);
 svg('path',{d,class:'w-land','stroke-width':(w.step*.5).toFixed(2),'clip-path':'url(#w-clip)'},root);
 const [lx,ly,lw,lh]=w.lens;
 svg('rect',{x:lx-4,y:ly-3,width:lw+8,height:lh+6,class:'lens'},root);
 const g=svg('g',{class:'w-here'},root);
 svg('circle',{cx:hx,cy:hy,r:3.2,class:'w-pulse'},g);
}

function drawRegion(){
 const root=document.querySelector('[data-region]');if(!root||!R)return;
 root.setAttribute('viewBox',`0 0 ${R.w} ${R.h}`);
 const g=regionDots(false),sw=(R.step*.55).toFixed(2);
 for(const [k,d] of Object.entries(g))if(d)svg('path',{d,class:'r-dots r-'+k,'stroke-width':sw},root);
 // Country markers with a still ring.
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
 // The network: a faint arc from Zagreb to every other city with an incubator, under the markers.
 const hub=byCity.Zagreb?.[0];
 if(hub){
  const [zx,zy]=proj(hub.lat,hub.lng),links=svg('g',{class:'r-links','aria-hidden':'true'});root.insertBefore(links,root.querySelector('.mk-label,.mk'));
  for(const [city,list] of Object.entries(byCity)){if(city==='Zagreb')continue;const [x,y]=proj(list[0].lat,list[0].lng),bend=Math.hypot(x-zx,y-zy)*.18;
   svg('path',{d:`M${zx.toFixed(1)} ${zy.toFixed(1)}Q${((zx+x)/2+bend*.4).toFixed(1)} ${((zy+y)/2-bend).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`,class:'r-link'},links);}
 }
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

// The network sketch: Croatian cities linked to neighbours' capitals; planned links are dashed (still).
(function netviz(){
 const root=document.querySelector('[data-netviz]');if(!root||!R)return;
 root.setAttribute('viewBox',`0 0 ${R.w} ${R.h}`);
 const g=regionDots(false);
 for(const [k,d] of Object.entries(g))if(d)svg('path',{d,class:'r-dots r-'+k,'stroke-width':(R.step*.42).toFixed(2),opacity:k==='net'?.55:1},root);
 const C={zg:[45.81,15.98,'Zagreb'],st:[43.51,16.44,'Split'],ri:[45.33,14.44,'Rijeka'],lj:[46.05,14.51,'Ljubljana'],bg:[44.79,20.45,'Beograd'],sa:[43.86,18.41,'Sarajevo']};
 const P=k=>proj(C[k][0],C[k][1]);
 const links=[['zg','st',1],['zg','ri',1],['zg','lj',0],['st','bg',0],['zg','bg',0],['st','sa',0]];
 const style=document.createElementNS(NS,'style');
 style.textContent=`.nl{fill:none;stroke-width:2.2}.nl.on{stroke:#5fd39b}.nl.off{stroke:#ffc24a;stroke-dasharray:6 7}.nc{fill:#1d2140;stroke-width:3}.nt{font:600 14px Onest,system-ui,sans-serif;letter-spacing:.02em;fill:#fff;paint-order:stroke;stroke:#1d2140;stroke-width:5px}`;
 root.append(style);
 links.forEach(([a,b,on])=>{
  const [x1,y1]=P(a),[x2,y2]=P(b),mx=(x1+x2)/2,my=(y1+y2)/2-Math.hypot(x2-x1,y2-y1)*.22;
  svg('path',{d:`M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`,class:'nl '+(on?'on':'off')},root);
 });
 for(const k of Object.keys(C)){const [x,y]=P(k),hr=['zg','st','ri'].includes(k);svg('circle',{cx:x,cy:y,r:k==='zg'?9:7,class:'nc',stroke:hr?'#5fd39b':'#ffc24a'},root);const tx=svg('text',{x:x+(k==='ri'||k==='lj'?-12:12),y:y+(k==='st'?22:-12),class:'nt','text-anchor':k==='ri'||k==='lj'?'end':'start'},root);tx.textContent=C[k][2];}
})();

applyLang();labelCountries();
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',labelCountries));
})();
