'use strict';
/* One motion mechanism for the account, admin, office and landing pages.
   Counters: [data-count] (account, admin, landing), [data-tk-n] (Tasks), [data-pg-count] (Programme), [data-ps-count] (people sheet).
   Each one counts once when it scrolls into view, starts from 0 and lands on the value already written in the element,
   so a page without scripts or with reduced motion simply shows the final number.
   Everything else here is extra on top of finished markup: if a script fails, the page is already complete and still.

   BirdMotion.play(scope)     first render of a view: counters, the tab underline slide, streak flame, points gained
   BirdMotion.countUp(el,ms)  count one element, optionally after a delay
   BirdMotion.reduced()       true when the visitor asked for less motion
   BirdMotion.lib()           Promise of window.anime (Anime.js, loaded once on demand), or null if it cannot load
   BirdMotion.EASE            the shared strong ease-out curve, for WAAPI calls                                        */
(()=>{
const SELECTOR='[data-count],[data-tk-n],[data-pg-count],[data-ps-count]';
const EASE='cubic-bezier(.23,1,.32,1)';
const done=new WeakSet();
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}};
const target=el=>Number(el.dataset.count??el.dataset.tkN??el.dataset.pgCount??el.dataset.psCount);
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};

// Anime.js lives next to this file; it is fetched only when something asks for it.
const SRC=(document.currentScript?.src||'').replace(/bird-motion\.js(\?.*)?$/,'anime.js');
let libPromise=null;
function lib(){
 if(window.anime)return Promise.resolve(window.anime);
 return libPromise??=new Promise(res=>{
  if(!SRC)return res(null);
  const s=document.createElement('script');s.src=SRC;s.async=true;
  s.onload=()=>res(window.anime||null);s.onerror=()=>res(null);
  document.head.append(s);
 });
}

// Count up with a strong ease-out; small numbers are quick, large ones take a little longer, never past 1.4 s.
const easeOut=k=>k>=1?1:1-Math.pow(2,-10*k);
function countUp(el,delay=0){
 if(done.has(el))return null;done.add(el);
 const to=target(el),suffix=el.dataset.tkSuffix||'';
 if(!Number.isFinite(to)||to<=0||reduced())return null;
 const dur=Math.min(1400,700+Math.log10(to+1)*260),t0=performance.now()+delay;
 el.classList.add('is-counting');el.textContent='0'+suffix;
 return new Promise(resolve=>{
  const step=now=>{
   if(!el.isConnected)return resolve();
   const k=Math.max(0,Math.min(1,(now-t0)/dur));el.textContent=Math.round(to*easeOut(k))+suffix;
   if(k<1)return requestAnimationFrame(step);
   el.classList.remove('is-counting');el.classList.add('is-landed');resolve();
  };
  requestAnimationFrame(step);
 });
}
// The stagger index of the card a counter sits in, so numbers start with their card.
const delayOf=el=>{const host=el.closest('[style*="--i"]');return host?(Number(host.style.getPropertyValue('--i'))||0)*70+180:120;};
const landed=new WeakMap();
function counters(scope){
 const list=[...scope.querySelectorAll(SELECTOR)].filter(el=>!done.has(el));
 if(!list.length)return;
 if(reduced()){list.forEach(el=>done.add(el));return;}
 const go=el=>{const p=countUp(el,delayOf(el));if(p)landed.set(el,p);};
 if(!('IntersectionObserver' in window)){list.forEach(go);return;}
 const io=new IntersectionObserver(items=>items.forEach(x=>{if(!x.isIntersecting)return;io.unobserve(x.target);go(x.target);}),{threshold:.2});
 list.forEach(el=>io.observe(el));
}

/* Tabs: the underline slides from the tab you left to the tab you opened (the route re-renders, so this is a FLIP
   on the ::after underline of the new current tab). Remembered on click, played on the next first render. */
const stripKey=strip=>[...strip.querySelectorAll('a')].map(a=>a.getAttribute('href')).join('|');
let leaving=null;
document.addEventListener('click',e=>{
 const a=e.target.closest?.('.acc-tabs a');if(!a)return;
 const strip=a.closest('.acc-tabs'),cur=strip.querySelector('a[aria-current=page]');
 if(!cur||cur===a){leaving=null;return;}
 const r=cur.getBoundingClientRect();leaving={key:stripKey(strip),href:a.getAttribute('href'),left:r.left,width:r.width,at:performance.now()};
},true);
function slideTabs(scope){
 const from=leaving;leaving=null;
 if(!from||performance.now()-from.at>4000||reduced())return;
 for(const strip of scope.querySelectorAll('.acc-tabs')){
  if(stripKey(strip)!==from.key)continue;
  const cur=strip.querySelector('a[aria-current=page]');if(!cur||cur.getAttribute('href')!==from.href||!cur.animate)return;
  const r=cur.getBoundingClientRect();if(!r.width)return;
  const dx=from.left-r.left,sx=from.width/r.width;
  try{cur.animate([{transform:`translateX(${dx}px) scaleX(${sx})`},{transform:'none'}],{duration:320,easing:EASE,pseudoElement:'::after'});}catch{}
  return;
 }
}

/* A lit streak flickers; an empty one stays still. Only on the participant's own pages, never on admin lists. */
function streak(scope){
 scope.querySelectorAll('.m-stat.is-streak').forEach(el=>el.classList.toggle('is-lit',target(el.querySelector('[data-count]')||el)>0));
}

/* Points gained since the last visit: after the counter lands, a "+N" rises from the number and a few sparks burst.
   A new level makes the level tag pop. The first visit only remembers the numbers. */
function whoKey(scope){
 const name=scope.querySelector('.acc-head h1,.acc-title,h1')?.textContent?.trim()||'';
 return 'bird-motion-xp:'+location.host+':'+name;
}
function gained(scope){
 const xpEl=scope.querySelector('.m-num.is-xp[data-count]');if(!xpEl)return;
 const lvEl=scope.querySelector('.m-lv-tag,.m-lv-big b');
 const xp=target(xpEl),lv=Number((lvEl?.textContent||'').replace(/\D+/g,''))||0;
 const key=whoKey(scope),prev=(store.get(key)||'').split(':').map(Number);
 store.set(key,xp+':'+lv);
 if(prev.length<2||!Number.isFinite(prev[0])||xp<=prev[0])return;
 const plus=xp-prev[0],levelUp=lv>prev[1]&&prev[1]>0;
 const run=()=>celebrate(xpEl,plus,levelUp?lvEl:null);
 const wait=landed.get(xpEl);
 if(wait)wait.then(run);else setTimeout(run,reduced()?0:900);
}
async function celebrate(numEl,plus,lvEl){
 if(!numEl.isConnected)return;
 const host=numEl.parentElement;if(getComputedStyle(host).position==='static')host.style.position='relative';
 const chip=document.createElement('span');chip.className='mo-gain';chip.setAttribute('aria-hidden','true');chip.textContent='+'+plus;
 host.append(chip);
 if(reduced()||!chip.animate){
  chip.animate?.([{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.8},{opacity:0}],{duration:1800,easing:'ease'});
  setTimeout(()=>chip.remove(),1900);return;
 }
 const A=await lib();
 const sparks=Array.from({length:10},()=>{const s=document.createElement('i');s.className='mo-spark';s.setAttribute('aria-hidden','true');host.append(s);return s;});
 const cleanup=()=>{chip.remove();sparks.forEach(s=>s.remove());};
 if(!A){ // WAAPI only: the chip rises and fades; sparks are skipped.
  sparks.forEach(s=>s.remove());
  chip.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(-8px)',offset:.25},{opacity:0,transform:'translateY(-26px)'}],{duration:1400,easing:EASE}).onfinish=cleanup;
  return;
 }
 const {createTimeline,stagger}=A;
 const tl=createTimeline({onComplete:()=>{cleanup();tl.revert();}});
 tl.add(numEl,{scale:[1,1.14,1],duration:520,ease:'out(3)'},0)
  .add(chip,{opacity:[0,1,1,0],y:[6,-10,-18,-30],duration:1500,ease:'out(2)'},40)
  .add(sparks,{
   opacity:[0,1,0],scale:[.6,1,.4],
   x:stagger([-42,42],{from:'center'}),y:()=>-(16+Math.random()*34),rotate:()=>Math.random()*180-90,
   duration:820,delay:stagger(22,{from:'center'}),ease:'out(3)',
  },60);
 if(lvEl)tl.add(lvEl,{scale:[1,1.25,1],duration:700,ease:'outElastic(1,.6)'},120);
}

function play(scope){
 if(!scope)return;
 counters(scope);
 slideTabs(scope);
 streak(scope);
 gained(scope);
}
window.BirdMotion={play,countUp,reduced,lib,EASE};
})();
