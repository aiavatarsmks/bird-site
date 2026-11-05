'use strict';
const LANGS=['en','hr','ru'];
// Reset the previous demo language once; remember choices made after this release.
const LANGUAGE_KEY='bird-language-v2';
let lang='en',storageOK=true;
const memory={};
try{lang=localStorage.getItem(LANGUAGE_KEY)||'en';}catch{storageOK=false;}
if(!LANGS.includes(lang))lang='en';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=v=>v?.[lang]??'';
const multiline=v=>esc(v).replace(/\n/g,'<br>');
const ui=k=>t(UI[k]);
const lectureDate=l=>l.date?`<time class="lecture-date" datetime="${esc(l.date)}">${esc(new Intl.DateTimeFormat({en:'en-GB',hr:'hr-HR',ru:'ru-RU'}[lang],{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(l.date+'T12:00:00Z')))}</time>`:'';
function answerKey(id){return `bird-answer:${currentLecture().id}:${id}`;}
function read(key){if(key in memory)return memory[key];try{return localStorage.getItem(key)||'';}catch{storageOK=false;return '';}}
function write(key,value){memory[key]=value;try{localStorage.setItem(key,value);}catch{storageOK=false;}}
function route(){const parts=location.hash.replace(/^#\/?/,'').split('/');return {lecture:LECTURES.find(l=>l.id===parts[0]),section:parts[1]||'overview'};}
function currentLecture(){return route().lecture||LECTURES[0];}
function renderBlock(b){let body=t(b.body);return `${b.title?`<h3>${esc(t(b.title))}</h3>`:''}${b.kind==='list'||b.kind==='ordered'?`<${b.kind==='ordered'?'ol':'ul'}>${body.map(x=>`<li>${esc(x)}</li>`).join('')}</${b.kind==='ordered'?'ol':'ul'}>`:`<p${b.kind==='note'?' class="note"':b.kind==='quote'?' class="quotation"':''}>${multiline(body)}</p>`}`;}
function renderExercise(ex){const key=answerKey(ex.id),value=read(key);return `<details data-exercise="${ex.id}"><summary>${esc(t(ex.title))}</summary><div class="exercise-body"><ol>${t(ex.steps).map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${ex.note?`<p class="note">${esc(t(ex.note))}</p>`:''}<label class="worksheet-label" for="answer-${ex.id}">${ui('answer')}</label><textarea id="answer-${ex.id}" data-answer="${ex.id}" spellcheck="true">${esc(value)}</textarea><p class="privacy">${ui('privacy')}</p><div class="status" data-status="${ex.id}" aria-live="polite"></div></div></details>`;}
function renderSection(s,i){return `<section class="section" id="${s.id}"><span class="eyebrow">${String(i+1).padStart(2,'0')} / ${esc(t(s.nav))}</span><h2>${esc(t(s.title))}</h2><p class="lede">${esc(t(s.intro))}</p>${s.metrics?`<div class="sprint-metrics">${[20,10,5,1].map((n,j)=>`<div class="metric"><b>${n}</b><small>${esc(t(s.metrics)[j])}</small></div>`).join('')}</div>`:''}${s.blocks.map(renderBlock).join('')}${s.flow?`<div class="flow">${t(s.flow).map((x,j)=>`${j?'<i aria-hidden="true">→</i>':''}<span>${esc(x)}</span>`).join('')}</div>`:''}${s.exercises?s.exercises.map(renderExercise).join(''):''}${s.template?`<div class="template"><pre>${esc(t(s.template))}</pre><button class="copy" data-copy="${s.id}">${ui('copy')}</button><span class="status" data-copy-status="${s.id}" aria-live="polite"></span></div>`:''}</section>`;}
const isOffice=()=>location.hash.replace(/^#\/?/,'').split('/')[0]==='office';
const isAccount=()=>!!window.BirdAccount?.isRoute();
const accountLink=()=>`<a class="nav-account" href="#/account" ${isAccount()?'aria-current="page"':''}>${esc(window.BirdAccount?.navLabel(lang)||'Account')}</a>`;
const officeNav=()=>({en:'Office',hr:'Ured',ru:'Офис'}[lang]);
const isCity=()=>!!window.BirdCity?.isRoute();
let cityLeft=false;
function renderCity(){
 const c=k=>BirdCity.TEXT[k][lang];
 document.documentElement.lang=lang;document.body.classList.add('office-page','city-page');document.title=`${c('visit')} · BIRD`;
 document.getElementById('app').innerHTML=`<header class="city-bar"><b class="city-brand">BIRD</b><span class="city-title">${c('visit')}</span><div class="langs" role="group" aria-label="${ui('languages')}">${LANGS.map((l,i)=>`<button data-city-lang="${l}" lang="${l}" aria-label="${['English','Hrvatski','Русский'][i]}" aria-pressed="${l===lang}">${l.toUpperCase()}</button>`).join('')}</div><a class="city-full" href="/#/office" target="_blank" rel="noopener">${c('full')} ↗</a><button class="city-exit" data-city-exit>${c('exit')}</button></header><main id="content" class="city-main">${cityLeft?`<p class="city-left">${c('left')}</p>`:`<div id="bird-office" class="city-mode"></div><p class="city-note">${c('note')}</p>`}</main>`;
 if(!cityLeft)window.IncubatorOffice.mount(document.getElementById('bird-office'),{language:lang,embedded:true});
 document.querySelector('[data-city-exit]').addEventListener('click',()=>BirdCity.requestExit());
 document.querySelectorAll('[data-city-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.cityLang;renderCity();}));
}
// Project links inside the visit go through the parent, never to an address chosen by the page.
document.addEventListener('click',e=>{if(!isCity())return;const a=e.target.closest('a[href*="#/projects/"]');if(!a)return;e.preventDefault();BirdCity.openProject(decodeURIComponent(a.getAttribute('href').split('#/projects/')[1].split('/')[0]));},true);
function render(){
 window.IncubatorOffice?.unmount();
 if(isCity()){if(!BirdCity.state)BirdCity.start({onLanguage(l){if(LANGS.includes(l)){lang=l;renderCity();}},onExit(){cityLeft=true;window.IncubatorOffice?.unmount();renderCity();}});renderCity();return;}
 if(window.BirdCity?.state)BirdCity.stop();document.body.classList.remove('city-page');
 const r=route(),lecture=r.lecture;
 document.documentElement.lang=lang;document.body.classList.toggle('office-page',isOffice());
 document.title=isAccount()?`${window.BirdAccount.title()} · BIRD`:isProjectPage()?`${pw('title')} · BIRD`:isOffice()?`${officeNav()} · BIRD`:isDirectory()?`${dirText('nav')} · BIRD`:lecture?`${t(lecture.title)} · BIRD ${ui('title')}`:`BIRD · ${ui('title')}`;
 document.querySelector('meta[name=description]').content=ui('description');
 const projectDetailsOpen=Boolean(document.querySelector('.project-detail[open]'));
 const open=[...document.querySelectorAll('details[open]')].map(x=>x.dataset.exercise).filter(Boolean);
 document.getElementById('app').innerHTML=`<a class="skip" href="#content">${ui('skip')}</a><header class="site-header"><div class="wrap header-inner"><a class="brand" href="#/"><b>BIRD</b><span>${ui('title')}</span></a><nav class="top-nav" aria-label="${dirText('nav')}">${isOffice()?`<a class="office-back" href="#/people">← ${{en:'Back',hr:'Natrag',ru:'Назад'}[lang]}</a><a href="#/">${dirText('lectures')}</a>${accountLink()}`:`<a href="#/" ${!isDirectory()&&!isProjectPage()&&!isAccount()?'aria-current="page"':''}>${dirText('lectures')}</a><a href="#/people" ${isDirectory()||isProjectPage()?'aria-current="page"':''}>${pw('title')}</a><a href="#/office">${officeNav()}</a>${accountLink()}`}</nav><div class="langs" role="group" aria-label="${ui('languages')}">${LANGS.map((l,i)=>`<button data-lang="${l}" lang="${l}" aria-label="${['English','Hrvatski','Русский'][i]}" aria-pressed="${l===lang}">${l.toUpperCase()}</button>`).join('')}</div></div></header><main class="wrap ${isOffice()?'office-wrap':''}" id="content" tabindex="-1">${isOffice()?'<div id="bird-office"></div>':isAccount()?'<div id="bird-account"></div>':isProjectPage()?renderProjectPage():isDirectory()?renderTeamsHub():lecture?`
 <a class="back" href="#/">${ui('back')}</a><div class="lecture-hero"><span class="eyebrow">${ui('notes')}</span><h1>${esc(t(lecture.title))}</h1><p class="intro">${esc(t(lecture.subtitle))}</p>${lectureDate(lecture)}<p class="lecture-attendance"><a href="#/office">← ${officeNav()}</a><a href="#/account/tasks">${{en:'Mark attendance in my account',hr:'Označi prisustvo u računu',ru:'Отметить посещение в кабинете'}[lang]}</a></p><p class="speaker">${lecture.speaker?`<strong>${esc(lecture.speaker)}</strong><br>`:''}${esc(t(lecture.bio))}</p><div class="takeaways">${lecture.takeaways.map((x,i)=>`<div class="takeaway"><span>0${i+1}</span><h3>${esc(t(x.title))}</h3><p>${esc(t(x.body))}</p></div>`).join('')}</div></div>
 <div class="reading-layout"><nav class="contents" aria-label="${ui('contents')}"><p>${ui('contents')}</p>${lecture.sections.map(s=>`<a href="#/${lecture.id}/${s.id}"${r.section===s.id?' aria-current="location"':''}>${esc(t(s.nav))}</a>`).join('')}<button id="print">${ui('print')}</button></nav><article>${lecture.sections.map(renderSection).join('')}${lecture.sources?`<aside class="sources"><h2>${ui('sources')}</h2><ul>${lecture.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(t(s.label))}</a></li>`).join('')}</ul></aside>`:''}<div class="privacy-tools"><p class="privacy">${ui('privacy')}</p><p class="privacy storage-warning" ${storageOK?'hidden':''}>${ui('unavailable')}</p><button class="clear" id="clear">${ui('clear')}</button><p class="status" id="clear-status" aria-live="polite"></p></div></article></div>`:`
 <div class="hero"><span class="eyebrow">${ui('eyebrow')}</span><h1>${multiline(ui('hero'))}</h1><p>${ui('description')}</p></div><div class="library-label"><span>${ui('library')}</span><span>${ui('count')}</span></div><div class="lecture-grid">${LECTURES.map((l,i)=>`<a class="lecture-card" href="#/${l.id}/overview"><div class="card-art"><small>${ui('notes')}</small><span class="number">${String(i+1).padStart(2,'0')}</span></div><div class="card-copy"><span class="eyebrow">${esc(l.speaker||ui('notes'))}</span>${lectureDate(l)}<h2>${esc(t(l.title))}</h2><p>${esc(t(l.subtitle))}</p><div class="tags">${t(l.tags).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div class="card-bottom"><span style="font-size:13px;font-weight:600">${ui('open')}</span><span class="arrow" aria-hidden="true">↗</span></div></div></a>`).join('')}</div>`}</main><footer class="wrap footer">${ui('footer')}</footer>`;
 if(projectDetailsOpen&&document.querySelector('.project-detail'))document.querySelector('.project-detail').open=true;
 open.forEach(id=>{const el=document.querySelector(`[data-exercise="${id}"]`);if(el)el.open=true;});
 bind();
}
function scrollToSection(){const r=route();if(r.lecture){document.getElementById(r.section)?.scrollIntoView({behavior:'instant',block:'start'});}else window.scrollTo({top:0,behavior:'instant'});}
function bind(){
 if(isOffice())window.IncubatorOffice.mount(document.getElementById('bird-office'),{language:lang,embedded:true});
 if(isAccount())window.BirdAccount.mount(document.getElementById('bird-account'),lang);
 bindDirectory();bindProjects();
 document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{const active=route().section;const anchor=document.getElementById(active);const relative=anchor?.getBoundingClientRect().top;lang=b.dataset.lang;write(LANGUAGE_KEY,lang);render();const next=document.getElementById(active);if(next&&relative!==undefined)window.scrollBy({top:next.getBoundingClientRect().top-relative,behavior:'instant'});document.querySelector(`[data-lang="${lang}"]`).focus({preventScroll:true});}));
 document.querySelectorAll('[data-answer]').forEach(el=>el.addEventListener('input',()=>{write(answerKey(el.dataset.answer),el.value);document.querySelector(`[data-status="${el.dataset.answer}"]`).textContent=ui(storageOK?'saved':'unavailable');}));
 document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const s=currentLecture().sections.find(x=>x.id===b.dataset.copy),status=document.querySelector(`[data-copy-status="${s.id}"]`);try{await navigator.clipboard.writeText(t(s.template));status.textContent=' '+ui('copied');}catch{status.textContent=' '+ui('copyError');}}));
 document.getElementById('clear')?.addEventListener('click',()=>{if(!confirm(ui('confirmClear')))return;currentLecture().sections.flatMap(s=>s.exercises||[]).forEach(ex=>{const key=answerKey(ex.id);delete memory[key];try{localStorage.removeItem(key);}catch{}});render();document.getElementById('clear-status').textContent=ui('cleared');});
 document.getElementById('print')?.addEventListener('click',()=>window.print());
}
let printOpen=[];
window.addEventListener('beforeprint',()=>{printOpen=[...document.querySelectorAll('details')].map(el=>[el,el.open]);printOpen.forEach(([el])=>el.open=true);});
window.addEventListener('afterprint',()=>printOpen.forEach(([el,open])=>el.open=open));
window.addEventListener('hashchange',()=>{if(location.hash==='#content'){document.getElementById('content')?.focus();return;}render();scrollToSection();});
render();if(route().lecture)requestAnimationFrame(scrollToSection);
