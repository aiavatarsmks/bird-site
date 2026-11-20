'use strict';
/* The shared top menu of the public site (markup: server/site.mjs). Opens and closes on a phone, and switches the language
   of everything marked data-m (text), data-m-aria (aria-label) and data-m-ph (placeholder). Croatian is whatever the page
   says; English and Russian come from MENU below and from the page's own script:
     SiteMenu.add({key:{en,ru}})   more texts (call it once, on load; it applies them at once)
     SiteMenu.onLang(fn)           fn(lang) after every switch, for what a page draws itself
     SiteMenu.lang, SiteMenu.t(key)
   The language is the landing's and the demo's (localStorage 'workspace-language'), so a choice made on any page holds.
   On the landing, landing.js handles the same [data-lang] buttons for its own texts (data-t); the two never share a key. */
(()=>{
const LANGS=['hr','en','ru'],KEY='workspace-language';
const MENU={
 menu:{en:'Menu',ru:'Меню'},navLabel:{en:'Main navigation',ru:'Основная навигация'},langLabel:{en:'Language',ru:'Язык'},
 hubs:{en:'Hubs',ru:'Хабы'},demo:{en:'Demo',ru:'Демо'},mentors:{en:'Mentors',ru:'Менторы'},investors:{en:'Investors',ru:'Инвесторы'},
 signIn:{en:'Sign in',ru:'Войти'},
 // The shared footer.
 footLine:{en:'· a platform for incubators and accelerators · Zagreb, Croatia',ru:'· платформа для инкубаторов и акселераторов · Загреб, Хорватия'},
 footLabel:{en:'Footer',ru:'Подвал сайта'},footPrivacy:{en:'Privacy',ru:'Конфиденциальность'},footContact:{en:'Contact',ru:'Контакты'},
};
const T={},hooks=[];
let lang='hr';
try{const s=localStorage.getItem(KEY);if(LANGS.includes(s))lang=s;}catch{}
const t=k=>T[k]?.[lang]??T[k]?.hr??'';
// Croatian from the page, once per key, before anything is switched away from it.
function remember(){
 document.querySelectorAll('[data-m]').forEach(el=>{(T[el.dataset.m]??={}).hr??=el.innerHTML;});
 document.querySelectorAll('[data-m-aria]').forEach(el=>{(T[el.dataset.mAria]??={}).hr??=el.getAttribute('aria-label');});
 document.querySelectorAll('[data-m-ph]').forEach(el=>{(T[el.dataset.mPh]??={}).hr??=el.getAttribute('placeholder');});
}
function add(dict){remember();for(const [k,v] of Object.entries(dict))T[k]={hr:T[k]?.hr,...v};apply();}
function apply(){
 document.documentElement.lang=lang;
 document.querySelectorAll('[data-m]').forEach(el=>{const v=t(el.dataset.m);if(v&&el.innerHTML!==v)el.innerHTML=v;});
 document.querySelectorAll('[data-m-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.mAria)));
 document.querySelectorAll('[data-m-ph]').forEach(el=>el.setAttribute('placeholder',t(el.dataset.mPh)));
 document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
 for(const fn of hooks)fn(lang);
}
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.lang;try{localStorage.setItem(KEY,lang);}catch{}apply();}));
// Phone: the menu button opens the sheet; Escape, a click outside or following a link closes it.
const toggle=document.querySelector('[data-sm-toggle]'),panel=document.getElementById('sm-panel');
if(toggle&&panel){
 const show=on=>{panel.classList.toggle('is-open',on);toggle.setAttribute('aria-expanded',String(on));};
 toggle.addEventListener('click',()=>show(!panel.classList.contains('is-open')));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('is-open')){show(false);toggle.focus();}});
 document.addEventListener('click',e=>{if(panel.classList.contains('is-open')&&!e.target.closest('.sm'))show(false);});
 panel.addEventListener('click',e=>{if(e.target.closest('a'))show(false);});
}
add(MENU);
window.SiteMenu={add,onLang:fn=>{hooks.push(fn);fn(lang);},t,get lang(){return lang;}};
})();
