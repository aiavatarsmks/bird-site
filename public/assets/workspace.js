'use strict';
/* Page shell of a workspace that has no content of its own in the pages yet: the account, tasks, messages and admin only. */
(()=>{
const LANGS=['en','hr','ru'],KEY='workspace-language';
const NAME=document.querySelector('meta[name=workspace-name]')?.content||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lang='en';try{lang=localStorage.getItem(KEY)||'en';}catch{}
if(!LANGS.includes(lang))lang='en';
// The shared texts name BIRD in two places.
const T=window.BIRD_ACCOUNT_TEXT;
T.voluntary={en:'Voluntary tasks.',hr:'Dobrovoljni zadaci.',ru:'Добровольные задания.'};
T.unofficial={en:'',hr:'',ru:''};
const style=document.createElement('style');
// The office is not part of this workspace yet.
style.textContent='a[href^="#/office"]{display:none!important}';
document.head.append(style);
function render(){
 if(!window.BirdAccount.isRoute()){location.replace('#/account');return;}
 const admin=location.hash.startsWith('#/admin');
 document.documentElement.lang=lang;
 document.title=`${window.BirdAccount.title()} · ${NAME}`;
 document.getElementById('app').innerHTML=`<header class="site-header"><div class="wrap header-inner"><a class="brand" href="#/account"><b>${esc(NAME)}</b></a><nav class="top-nav"><a class="nav-account" href="#/account" ${admin?'':'aria-current="page"'}>${esc(window.BirdAccount.navLabel(lang))}</a></nav><div class="langs" role="group">${LANGS.map((l,i)=>`<button data-lang="${l}" lang="${l}" aria-label="${['English','Hrvatski','Русский'][i]}" aria-pressed="${l===lang}">${l.toUpperCase()}</button>`).join('')}</div></div></header><main class="wrap" id="content" tabindex="-1"><div id="bird-account"></div></main>`;
 window.BirdAccount.mount(document.getElementById('bird-account'),lang);
 document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.lang;try{localStorage.setItem(KEY,lang);}catch{}render();}));
}
window.addEventListener('hashchange',render);
render();
})();
