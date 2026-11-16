'use strict';
/* Living characters for profile and team pages: each one breathes, now and then turns, works with its hands,
   walks a few steps and back. Hover or a click makes it hop; it never spins, a flat sprite turned round looks flat.
   Artwork: assets/<id>.webp (3 poses), and when published BIRD_OFFICE_ACTIVITIES / BIRD_OFFICE_WALK for that id.

   BirdCharacter.html(people,{size})  -> markup; people: [{id,name,src?,attrs?,label?}] (src defaults to assets/<id>.webp)
                                         size: sm | md | lg | xl | fit (fit: as tall as the stage width allows, people-sheet.css)
   BirdCharacter.start(root)          -> starts the behaviour of every character inside root; returns stop()   */
(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand=(a,b)=>a+Math.random()*(b-a);
const initials=name=>String(name||'?').split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase();

// People who registered themselves ("visitor-…") have no drawn character: initials straight away, no request for artwork.
const noArt=p=>!p.src&&String(p.id||'').startsWith('visitor-');
function html(people,{size='lg'}={}){
 return `<div class="cs-stage cs-${esc(size)}" data-cs-stage>${people.map((p,i)=>{
  const src=p.src||`assets/${p.id}.webp`,act=window.BIRD_OFFICE_ACTIVITIES?.[p.id];
  // p.attrs (escaped by the caller) turns the character into a control, e.g. one that opens that person.
  return `<figure class="cs-char${noArt(p)?' cs-missing':''}" data-cs-id="${esc(p.id)}" style="--i:${i}" tabindex="0" ${p.attrs?`${p.attrs} role="button"`:'role="img"'} aria-label="${esc(p.label||p.name||'')}">
   <div class="cs-mover"><div class="cs-flip">
    <span class="cs-body cs-idle" style="${noArt(p)?'':`background-image:url('${esc(src)}');`}--beat:-${(i*3.7)%11}s;--breath:-${(i*.9)%3}s"></span>
    ${act?`<span class="cs-body cs-act" style="background-image:url('${esc(act.asset)}')"></span>`:''}
    <span class="cs-body cs-walk"></span>
    <span class="cs-fallback">${esc(initials(p.name))}</span>
   </div></div>
   <span class="cs-shadow"></span>${p.name?`<figcaption>${esc(p.name)}</figcaption>`:''}
  </figure>`;}).join('')}</div>`;
}

function start(root){
 const timers=new Set(),frames=new Set();
 const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);};
 const chars=[...(root?.querySelectorAll('.cs-char')||[])];
 for(const el of chars){
  const id=el.dataset.csId,idle=el.querySelector('.cs-idle');
  // Missing artwork: show initials instead of an empty box.
  const art=idle.style.backgroundImage.slice(5,-2);
  if(art){const probe=new Image();probe.onerror=()=>el.classList.add('cs-missing');probe.src=art;}
  el.addEventListener('click',()=>{el.classList.remove('cs-hop');void el.offsetWidth;el.classList.add('cs-hop');});
  if(reduced())continue;
  const walk=window.BIRD_OFFICE_WALK?.[id],act=el.querySelector('.cs-act');
  const mode=m=>{el.dataset.mode=m;};
  // Activity sheets are sit / step / coffee. There is no chair on a card, so only the coffee pose is used here.
  function doActivity(){mode('act');act.style.backgroundPosition='100% 0';later(next,rand(2400,4200));}
  function doWalk(){
   const body=el.querySelector('.cs-walk'),cell=walk.cell,cols=walk.columns,n=walk.framesPerDirection,w=walk.width,h=walk.height;
   const scale=el.querySelector('.cs-mover').offsetHeight/walk.renderHeight||1;
   body.style.backgroundImage=`url('${walk.asset}')`;body.style.backgroundSize=`${w*scale/cell*100/ (w/cell)}% auto`;
   body.style.backgroundSize=`${(w/cell)*100}% ${(h/cell)*100}%`;
   mode('walk');const dist=rand(40,90),dur=Math.max(1200,dist*22);let t0=null,dir=Math.random()<.5?1:-1;
   el.querySelector('.cs-flip').style.transform=dir<0?'scaleX(-1)':'';
   const tick=ts=>{t0??=ts;const p=Math.min(1,(ts-t0)/dur),i=Math.floor((ts-t0)/1000*walk.fps)%n;
    body.style.backgroundPosition=`${(i%cols)/(cols-1)*100}% ${Math.floor(i/cols)/(Math.ceil(n*2/cols)-1||1)*100}%`;
    // There and back: the second half returns to the spot, turned round.
    const x=p<.5?p*2*dist:(1-p)*2*dist;el.querySelector('.cs-mover').style.transform=`translateX(${dir*x}px)`;
    if(p>=.5)el.querySelector('.cs-flip').style.transform=dir>0?'scaleX(-1)':'';
    if(p<1){const r=requestAnimationFrame(tick);frames.add(r);}else{el.querySelector('.cs-mover').style.transform='';el.querySelector('.cs-flip').style.transform='';next();}};
   frames.add(requestAnimationFrame(tick));
  }
  function next(){
   mode('idle');
   later(()=>{const r=Math.random();if(walk&&r<.3)doWalk();else if(act&&r<.75)doActivity();else next();},rand(2500,6500));
  }
  later(next,rand(200,1800));
 }
 return function stop(){for(const t of timers)clearTimeout(t);for(const f of frames)cancelAnimationFrame(f);timers.clear();frames.clear();};
}
window.BirdCharacter={html,start};
})();
