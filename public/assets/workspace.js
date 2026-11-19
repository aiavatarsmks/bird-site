'use strict';
/* Page shell of a workspace other than BIRD: the account, tasks, messages and admin.
   A demo workspace also has a start page with one-click entry, the office and the incubator map. */
(()=>{
const LANGS=['en','hr','ru'],KEY='workspace-language';
const NAME=document.querySelector('meta[name=workspace-name]')?.content||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lang='en';try{lang=localStorage.getItem(KEY)||'en';}catch{}
if(!LANGS.includes(lang))lang='en';
// The shared texts name BIRD in two places.
const T=window.BIRD_ACCOUNT_TEXT;
T.e_DEMO_READ_ONLY={en:'This is a demo: you can look at everything, but changes are not saved.',hr:'Ovo je demo: sve možete pogledati, ali promjene se ne spremaju.',ru:'Это демо: смотреть можно всё, но изменения не сохраняются.'};
const W={
 home:{en:'Start',hr:'Početna',ru:'Главная'},office:{en:'Office',hr:'Ured',ru:'Офис'},map:{en:'Incubator map',hr:'Karta inkubatora',ru:'Карта инкубаторов'},
 badge:{en:'Demo · nothing you do is saved',hr:'Demo · ništa se ne sprema',ru:'Демо · ничего не сохраняется'},
 leave:{en:'Leave',hr:'Izađi',ru:'Выйти'},viewAs:{en:'View as',hr:'Pogledaj kao',ru:'Смотреть как'},roleManager:{en:'Programme manager',hr:'Voditelj programa',ru:'Руководитель программы'},roleTeam:{en:'Team',hr:'Tim',ru:'Команда'},close:{en:'Close',hr:'Zatvori',ru:'Закрыть'},
 title:{en:'An incubator from the inside',hr:'Inkubator iznutra',ru:'Инкубатор изнутри'},
 lead:{en:'An invented incubator with six teams. Look around as the programme manager or as a team. No sign-up.',hr:'Izmišljeni inkubator sa šest timova. Pogledajte ga očima voditelja programa ili tima. Bez registracije.',ru:'Выдуманный инкубатор с шестью командами. Посмотрите глазами руководителя программы или команды. Без регистрации.'},
 asManager:{en:'Enter as programme manager',hr:'Uđi kao voditelj programa',ru:'Войти как руководитель программы'},
 asManagerText:{en:'All teams on one dashboard: progress, points, next steps, who is stuck and who asked for help.',hr:'Svi timovi na jednoj ploči: napredak, bodovi, sljedeći koraci, tko je zapeo i tko traži pomoć.',ru:'Все команды на одной панели: прогресс, баллы, следующие шаги, кто застрял и кто просит помощи.'},
 asTeam:{en:'Enter as a team',hr:'Uđi kao tim',ru:'Войти как команда'},
 asTeamText:{en:'Tasks with deadlines and points, mentors to book, a request for help in one click.',hr:'Zadaci s rokovima i bodovima, termini mentora, pomoć jednim klikom.',ru:'Задания со сроками и баллами, запись к менторам, просьба о помощи в один клик.'},
 seeOffice:{en:'Walk through the office',hr:'Prošeći uredom',ru:'Пройтись по офису'},
 seeOfficeText:{en:'A virtual office where every team has a desk and every person a character.',hr:'Virtualni ured u kojem svaki tim ima stol, a svaka osoba svoj lik.',ru:'Виртуальный офис: у каждой команды свой стол, у каждого человека свой персонаж.'},
 seeMap:{en:'Open the map',hr:'Otvori kartu',ru:'Открыть карту'},
 seeMapText:{en:'Incubators and accelerators in Croatia, with their next programmes.',hr:'Inkubatori i akceleratori u Hrvatskoj i njihovi sljedeći programi.',ru:'Инкубаторы и акселераторы Хорватии и их ближайшие программы.'},
 invented:{en:'Teams, people and numbers in this demo are invented.',hr:'Timovi, osobe i brojke u ovom demu su izmišljeni.',ru:'Команды, люди и цифры в этом демо выдуманы.'},
 toDash:{en:'Dashboard',hr:'Nadzorna ploča',ru:'Панель'},todayNav:{en:'Today',hr:'Danas',ru:'Сегодня'},myDash:{en:'My dashboard',hr:'Moja ploča',ru:'Моя панель'},tasksNav:{en:'Tasks',hr:'Zadaci',ru:'Задания'},toToday:{en:'Today: morning briefing',hr:'Danas: jutarnji pregled',ru:'Сегодня: утренняя сводка'},teamsOnly:{en:'Teams only',hr:'Samo timovi',ru:'Только команды'},withOffice:{en:'Dashboard with the office',hr:'Nadzorna ploča s uredom',ru:'Панель с офисом'},
 join:{en:'Join as yourself',hr:'Uđi kao ti',ru:'Войти как вы'},roleSelf:{en:'Yourself',hr:'Ti',ru:'Вы'},
 joinText:{en:'Make your own character, name it, and join a team or start one. Under a minute.',hr:'Složi svoj lik, daj mu ime i pridruži se timu ili osnuj novi. Manje od minute.',ru:'Соберите своего персонажа, назовите его и присоединитесь к команде или создайте новую. Меньше минуты.'},
 loading:{en:'Loading…',hr:'Učitavanje…',ru:'Загрузка…'},failed:{en:'Could not load. Reload the page.',hr:'Nije učitano. Osvježite stranicu.',ru:'Не загрузилось. Обновите страницу.'},
};
const w=key=>W[key][lang]||W[key].en;
const route=()=>location.hash.replace(/^#\/?/,'').split('/')[0];
let demo=null,me=null,csrf='';
const ENTRY_USER={manager:'demo-user-manager',team:'demo-user-agrobit-1'};

async function getJson(url){const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw Error(String(r.status));return r.json();}
async function refreshMe(){try{const a=await getJson('/api/auth/me');me=a.user||null;csrf=a.csrf||'';}catch{me=null;csrf='';}}
const visitor=()=>Boolean(me?.id?.startsWith('demo-user-'));
// A visitor who joined as themselves (demo-join.js): their own character and team, for this visit.
const selfMade=()=>Boolean(me?.id?.startsWith('demo-user-v-'));
const isAdmin=()=>['platform_owner','program_admin'].includes(me?.role);
async function post(url,body){const r=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},body:JSON.stringify(body||{})});if(!r.ok)throw Error(String(r.status));return r.json().catch(()=>({}));}

function header(current){
 // In the demo the menu follows whose eyes the visitor borrowed: the manager's office, dashboard and morning briefing,
 // or the team's office, own dashboard and tasks. Outside the demo only the account link is shown.
 const nav=!demo?[]
  :isAdmin()?[['#/admin',w('office')],['#/admin/dashboard',w('toDash')],['#/admin/today',w('todayNav')],['#/map',w('map')]]
  :me?[['#/office',w('office')],['#/account',w('myDash')],['#/account/tasks',w('tasksNav')],['#/map',w('map')]]
  :[['#/',w('office')],['#/map',w('map')]];
 const h=location.hash.replace(/\/$/,'')||'#/',on=nav.find(([href])=>href===h)?.[0]||(h.startsWith('#/account')&&nav.some(([href])=>href==='#/account')?'#/account':'');
 return `<header class="site-header"><div class="wrap header-inner"><a class="brand" href="${!demo?'#/account':isAdmin()?'#/admin':me?'#/account':'#/'}"><b>${esc(NAME)}</b></a><nav class="top-nav">${nav.map(([href,label])=>`<a href="${href}" ${href===on?'aria-current="page"':''}>${esc(label)}</a>`).join('')}</nav><div class="langs" role="group">${LANGS.map((l,i)=>`<button data-lang="${l}" lang="${l}" aria-label="${['English','Hrvatski','Русский'][i]}" aria-pressed="${l===lang}">${l.toUpperCase()}</button>`).join('')}</div><div data-account-menu></div></div></header>${visitor()?`<div class="demo-bar" role="status"><span>${esc(w('badge'))}</span><span class="demo-switch" role="group" aria-label="${esc(w('viewAs'))}">${esc(w('viewAs'))}:${demo.entries.map(k=>`<button data-demo-enter="${k}" aria-pressed="${ENTRY_USER[k]===me.id}">${esc(w(k==='manager'?'roleManager':'roleTeam'))}</button>`).join('')}<button data-demo-join aria-pressed="${selfMade()}">${esc(w('roleSelf'))}</button></span></div>`:''}`;
}

// The demo opens on the office; this panel over it says what the page is and offers the two ways in.
function welcome(){
 const can=k=>demo.entries.includes(k);
 if(visitor())return '';
 return `<aside class="demo-welcome" aria-labelledby="demo-welcome-title"><button class="demo-welcome-close" data-demo-close aria-label="${esc(w('close'))}">×</button><span class="eyebrow">Demo</span><h1 id="demo-welcome-title">${esc(w('title'))}</h1><p>${esc(w('lead'))}</p>
 <div class="demo-welcome-actions">${can('manager')?`<button class="acc-primary" data-demo-enter="manager">${esc(w('asManager'))} →</button><small>${esc(w('asManagerText'))}</small>`:''}
 ${can('team')?`<button class="acc-secondary" data-demo-enter="team">${esc(w('asTeam'))} →</button><small>${esc(w('asTeamText'))}</small>`:''}
 <button class="acc-secondary" data-demo-join>${esc(w('join'))} →</button><small>${esc(w('joinText'))}</small></div>
 <a class="demo-welcome-map" href="#/map">${esc(w('seeMap'))} →</a><p class="demo-note">${esc(w('invented'))}</p></aside>`;
}

// The office scripts load on first visit; the roster has to be there before office.js reads it.
let officeReady=null;
function loadScript(src){return new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=bad;document.head.append(s);});}
function loadStyle(href){if(document.querySelector(`link[href="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.append(l);}
function officeAssets(){
 return officeReady??=(async()=>{
  loadStyle('assets/office.css');
  const roster=(await getJson('/api/demo/roster')).items,colors=['#6b886c','#b17957','#708ba5','#967e9c'];
  const sprite={width:1152,height:352,frames:[[0,0,384,352],[384,0,384,352],[768,0,384,352]]};
  window.BirdProjects=Object.freeze({
   data:{projects:[],people:[]},project:id=>roster.find(p=>p.id===id),person:()=>null,
   officeProjects:()=>roster.map((p,i)=>({id:p.id,teamId:p.teamId,name:p.name,description:p.short,stage:p.stage,real:true,color:colors[i%4],
    members:p.members.map(m=>({id:m.id,personId:m.id,teamId:p.teamId,projectId:p.id,name:m.name,role:'',avatar:'neutral',portraitAsset:'assets/'+m.id+'.webp',avatarAppearance:'demo',sprite}))})),
  });
  await loadScript('assets/office-demo-data.js');
  window.BIRD_OFFICE_CONFIG.brand=NAME;
  for(const n of ['office-model','office-art-data','office-iso-assets','office-scene','office-life','office-pixelfx','office'])await loadScript(`assets/${n}.js`);
 })();
}
async function officeView(main){
 main.innerHTML=`<p class="acc-muted">${esc(w('loading'))}</p>`;
 try{await officeAssets();}catch{main.innerHTML=`<p class="acc-flash is-error">${esc(w('failed'))}</p>`;return;}
 if(!['','office'].includes(route()))return;
 main.innerHTML='<div id="bird-office"></div>';
 window.IncubatorOffice.mount(document.getElementById('bird-office'),{language:lang,embedded:true});
 let closed=false;try{closed=sessionStorage.getItem('demo-welcome')==='closed';}catch{}
 if(!closed){main.querySelector('.office-viewport-wrap')?.insertAdjacentHTML('beforeend',welcome());bindEntries();
  main.querySelector('[data-demo-close]')?.addEventListener('click',e=>{e.currentTarget.closest('.demo-welcome').remove();try{sessionStorage.setItem('demo-welcome','closed');}catch{}});}
}
async function mapView(main){
 main.innerHTML=`<p class="acc-muted">${esc(w('loading'))}</p>`;
 try{if(!window.BirdIncubatorMap){await loadScript('assets/incubators-hr.js');await loadScript('assets/incubator-map.js');}}
 catch{main.innerHTML=`<p class="acc-flash is-error">${esc(w('failed'))}</p>`;return;}
 if(route()==='map')window.BirdIncubatorMap.mount(main,lang);
}

// Join as yourself: the builder page (#/join) loads its kit and styles on first use.
let joinReady=null;
const joinAssets=()=>joinReady??=(async()=>{loadStyle('assets/demo-join.css');if(!window.BirdCharacterKit)await loadScript('assets/character-kit.js');if(!window.BirdDemoJoin)await loadScript('assets/demo-join.js');})();
async function joinView(main){
 main.innerHTML=`<p class="acc-muted">${esc(w('loading'))}</p>`;
 let mine=null;
 try{await joinAssets();if(selfMade())mine=await getJson('/api/demo/me');}catch{main.innerHTML=`<p class="acc-flash is-error">${esc(w('failed'))}</p>`;return;}
 if(route()!=='join')return;
 window.BirdDemoJoin.mount(main,{lang,mine,csrf,onDone:()=>{location.hash='#/office';location.reload();}});
}
function bindEntries(){
 document.querySelectorAll('[data-demo-join]:not([data-bound])').forEach(b=>{b.dataset.bound='1';b.addEventListener('click',()=>{location.hash='#/join';});});
 document.querySelectorAll('[data-demo-enter]:not([data-bound])').forEach(b=>{b.dataset.bound='1';b.addEventListener('click',async()=>{
  b.disabled=true;
  try{await post('/api/demo/enter',{as:b.dataset.demoEnter});location.hash=b.dataset.demoEnter==='manager'?'#/admin':'#/account';location.reload();}
  catch{b.disabled=false;b.insertAdjacentHTML('afterend',`<p class="acc-flash is-error">${esc(w('failed'))}</p>`);}
 });});
}
// A visitor never sees a sign-in form here: any page except the map signs in as the invented manager.
let entering=false;
async function enterAsVisitor(){
 if(!demo||me||['map','join'].includes(route())||entering||location.hash.startsWith('#/account/login'))return false;
 entering=true;
 try{await post('/api/demo/enter',{as:'manager'});if(!window.BirdAccount.isRoute())location.hash='#/admin';location.reload();return true;}
 catch{entering=false;return false;}
}
function render(){
 if(demo&&!me&&!['map','join'].includes(route())&&!entering&&!location.hash.startsWith('#/account/login')){enterAsVisitor();return;}
 const r=route(),account=window.BirdAccount.isRoute();
 if(!demo&&!account){location.replace('#/account');return;}
 if(demo&&!account&&!['','office','map','join'].includes(r)){location.replace('#/');return;}
 // A manager's office is the admin office (#/admin); the plain office is what a team sees.
 if(demo&&isAdmin()&&(r===''||r==='office')){location.replace('#/admin');return;}
 window.IncubatorOffice?.unmount?.();window.BirdIncubatorMap?.unmount?.();
 document.documentElement.lang=lang;
 const office=demo&&!account&&(r===''||r==='office');
 document.body.classList.toggle('office-page',office);
 document.title=`${account?window.BirdAccount.title():w(r==='map'?'map':r==='join'?'join':'office')} · ${NAME}`;
 document.getElementById('app').innerHTML=`${header(r)}<main class="wrap ${r==='map'?'demo-map-page':office?'office-wrap':''}" id="content" tabindex="-1">${account?'<div id="bird-account"></div>':''}</main>`;
 const main=document.getElementById('content');
 if(account)window.BirdAccount.mount(document.getElementById('bird-account'),lang);
 // In the demo the manager's first screen is the living office above the dashboard.
 // #/admin opens on the office as big as the screen with the dashboard below; #/admin/dashboard is the dashboard alone.
 if(account&&demo&&isAdmin()&&/^#\/admin\/?$/.test(location.hash)){
  main.insertAdjacentHTML('beforebegin',`<section class="demo-office-hero office-wrap" aria-label="${esc(w('office'))}"><div id="bird-office"></div></section><span id="demo-dashboard"></span>`);
  // The ways out of the office sit in the demo strip above it, never on top of the office itself.
  document.querySelector('.demo-bar')?.insertAdjacentHTML('beforeend',`<nav class="demo-hero-links" aria-label="${esc(w('office'))}"><a href="#/admin/today" class="demo-hero-today">${esc(w('toToday'))} →</a><a href="#demo-dashboard" data-demo-down>↓ ${esc(w('toDash'))}</a><a href="#/admin/dashboard">${esc(w('teamsOnly'))}</a></nav>`);
  document.querySelectorAll('[data-demo-down]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();main.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}));
  const top=()=>{const h=document.querySelector('.demo-office-hero');if(h)document.documentElement.style.setProperty('--demo-top',Math.round(h.getBoundingClientRect().top+scrollY)+'px');};
  top();addEventListener('resize',top,{passive:true});
  officeAssets().then(()=>{const el=document.getElementById('bird-office');if(el&&!el.childElementCount)window.IncubatorOffice.mount(el,{language:lang,embedded:true});
  }).catch(()=>{});
 }
 else if(account&&demo&&isAdmin()&&/^#\/admin\/dashboard\/?$/.test(location.hash))main.insertAdjacentHTML('afterbegin',`<p class="demo-view-switch"><a href="#/admin">← ${esc(w('withOffice'))}</a></p>`);
 else if(office)officeView(main);
 else if(r==='map')mapView(main);
 else if(demo&&r==='join')joinView(main);
 document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.lang;try{localStorage.setItem(KEY,lang);}catch{}render();}));
 bindEntries();window.BirdWhoami?.mountAll(lang);
 document.querySelector('[data-demo-leave]')?.addEventListener('click',async()=>{try{await post('/api/auth/logout');}catch{}location.hash='#/';location.reload();});
}
// Signing in or out on the account page: the menu and the role-based header follow at once.
addEventListener('bird:auth',e=>{me=e.detail?.user||null;csrf=e.detail?.csrf||'';});
// Route changes in the demo cross-fade through a view transition (header and demo strip stay put; demo-skin.css).
const quiet=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return true;}};
window.addEventListener('hashchange',()=>{
 if(!demo||!document.startViewTransition||quiet()||/^#demo-/.test(location.hash)){render();return;}
 document.startViewTransition(()=>render());
});
// The demo wears its own skin (assets/demo-skin.css, scoped to body.is-demo) and fonts; BIRD and other workspaces do not.
function skin(){
 document.body.classList.add('is-demo');
 if(document.querySelector('link[data-demo-fonts]'))return;
 const l=document.createElement('link');l.rel='stylesheet';l.dataset.demoFonts='';
 l.href='https://fonts.googleapis.com/css2?family=Martian+Mono:wght@400..600&family=Onest:wght@400..800&display=swap';
 document.head.append(l);
}
(async()=>{
 try{const d=await getJson('/api/demo');demo=d.demo?d:null;}catch{demo=null;}
 if(demo)skin();
 if(demo)await refreshMe();
 // Profile and team pages animate the same characters as the office.
 if(demo)await loadScript('assets/office-demo-data.js').catch(()=>{});
 // The account's character page links back to the builder for a visitor who made their own.
 if(selfMade())await joinAssets().catch(()=>{});
 if(await enterAsVisitor())return;
 render();
})();
})();
