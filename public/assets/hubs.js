'use strict';
/* /hubs: the map of Europe with a dot per hub and the list by region (Europe -> region -> country -> hub), both drawn
   from /hubs.json (data/hubs.json), so the catalogue grows without touching this file. The outline of Europe is inline
   in hubs.html (tools/hubs-europe.mjs); its projection (Lambert azimuthal equal-area, the same as the incubator map) is
   on the <svg> as data-proj, so a hub needs only its latitude and longitude. Texts: Croatian in hubs.html, the rest here. */
document.addEventListener('DOMContentLoaded',()=>{
const M=window.SiteMenu;if(!M)return;
M.add({
 skip:{en:'Skip to content',ru:'К содержанию'},
 hEyebrow:{en:'Incubators and accelerators in Europe',ru:'Инкубаторы и акселераторы Европы'},
 hTitle:{en:'Hubs',ru:'Хабы'},
 hLead:{en:'Every hub has its own space on the platform: an office, teams, mentors, tasks and reports. Find a hub on the map or in the list by region, and sign in to yours.',ru:'У каждого хаба своё пространство на платформе: офис, команды, менторы, задания и отчёты. Найдите хаб на карте или в списке по регионам и войдите в свой.'},
 hMapCap:{en:'Map of Europe: a dot is a hub connected to the platform.',ru:'Карта Европы: точка — хаб, подключённый к платформе.'},
 hListTitle:{en:'Europe',ru:'Европа'},hLoading:{en:'Loading the list…',ru:'Загружаем список…'},
 hAddTitle:{en:'Do you run an incubator or an accelerator?',ru:'Вы руководите инкубатором или акселератором?'},
 hAddLead:{en:'Add your hub to the map. You get your own space on the platform for your teams and mentors, and startups from all over Europe can find you.',ru:'Добавьте свой хаб на карту. Вы получите своё пространство на платформе для команд и менторов, а стартапы со всей Европы смогут вас найти.'},
 hAddCta:{en:'Add your hub',ru:'Добавить свой хаб'},
});
const W={
 live:{hr:'Radi na platformi',en:'Live on the platform',ru:'Работает на платформе'},
 none:{hr:'Još nema povezanih hubova.',en:'No connected hubs yet.',ru:'Подключённых хабов пока нет.'},
 hubs:{hr:n=>n===1?'1 hub':n+' huba',en:n=>n===1?'1 hub':n+' hubs',ru:n=>n+' '+(n%10===1&&n%100!==11?'хаб':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'хаба':'хабов')},
 signIn:{hr:'Prijava u {n}',en:'Sign in to {n}',ru:'Войти в {n}'},
 failed:{hr:'Popis se nije učitao. Osvježite stranicu.',en:'The list did not load. Refresh the page.',ru:'Список не загрузился. Обновите страницу.'},
 close:{hr:'Zatvori',en:'Close',ru:'Закрыть'},
};
const w=(k,...a)=>{const v=W[k][M.lang]??W[k].hr;return typeof v==='function'?v(...a):v;};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc=o=>o?.[M.lang]??o?.hr??o?.en??'';
const svg=document.querySelector('[data-hubs-map]'),dots=svg?.querySelector('[data-dots]'),list=document.querySelector('[data-hubs-list]'),card=document.querySelector('[data-hub-card]');
if(!svg||!list||!card)return;

// Lambert azimuthal equal-area with a d3-style rotation [λ, φ]; [scale, tx, ty, λ, φ] from data-proj.
const [S,TX,TY,RL,RP]=svg.dataset.proj.split(',').map(Number),R=Math.PI/180;
function project(lat,lon){
 const l=(lon+RL)*R,p=lat*R,dp=RP*R;
 const x=Math.cos(l)*Math.cos(p),y=Math.sin(l)*Math.cos(p),z=Math.sin(p),k=z*Math.cos(dp)+x*Math.sin(dp);
 const L=Math.atan2(y,x*Math.cos(dp)-z*Math.sin(dp)),P=Math.asin(k);
 const c=Math.sqrt(2/(1+Math.cos(L)*Math.cos(P)));
 return [TX+S*c*Math.cos(P)*Math.sin(L),TY-S*c*Math.sin(P)];
}

let data=null,selected=null;
function draw(){
 if(!data)return;
 const byRegion=data.regions.map(r=>{
  const countries=Object.entries(data.countries).filter(([,c])=>c.region===r.id)
   .map(([code,c])=>({code,name:loc(c.name),hubs:data.hubs.filter(h=>h.country===code).sort((a,b)=>a.name.localeCompare(b.name))}))
   .filter(c=>c.hubs.length).sort((a,b)=>a.name.localeCompare(b.name,M.lang));
  return {...r,countries,n:countries.reduce((s,c)=>s+c.hubs.length,0)};
 });
 list.innerHTML=`<ol class="hubs-regions">${byRegion.map(r=>`<li class="hubs-region${r.n?'':' is-empty'}"><h3><span>${esc(loc(r.name))}${r.short?` <abbr class="fine">${esc(r.short)}</abbr>`:''}</span><small class="fine">${r.n?esc(w('hubs',r.n)):''}</small></h3>${r.n
  ?`<ul class="hubs-countries">${r.countries.map(c=>`<li><p class="hubs-country">${esc(c.name)}</p><ul class="hubs-items">${c.hubs.map(h=>`<li><button type="button" class="hubs-item" data-hub="${esc(h.id)}" aria-pressed="${h.id===selected}" aria-controls="hub-card"><span class="hubs-dot${h.status==='live'?' is-live':''}" aria-hidden="true"></span><b>${esc(h.name)}</b><span class="fine">${esc(loc(h.city))}</span></button></li>`).join('')}</ul></li>`).join('')}</ul>`
  :`<p class="fine">${esc(w('none'))}</p>`}</li>`).join('')}</ol>`;
 dots.innerHTML=data.hubs.map(h=>{const [x,y]=project(h.lat,h.lon);return `<g class="hubs-pin${h.status==='live'?' is-live':''}${h.id===selected?' is-on':''}" data-hub="${esc(h.id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(h.name+', '+loc(h.city))}"><circle class="hubs-ring" r="16"/><circle r="7"/><text x="13" y="-11">${esc(h.name)}</text></g>`;}).join('');
 drawCard();
}
function drawCard(){
 const h=data.hubs.find(x=>x.id===selected);card.hidden=!h;if(!h)return;
 const c=data.countries[h.country];
 card.innerHTML=`<p class="status${h.status==='live'?' is-live':''}">${esc(w('live'))}</p><h3>${esc(h.name)}</h3><p class="fine">${esc(loc(h.city))} · ${esc(loc(c?.name))}</p><p>${esc(loc(h.about))}</p>${h.url?`<a class="btn" href="${esc(h.url)}"><span>${esc(w('signIn').replace('{n}',h.name))}</span> <span aria-hidden="true">→</span></a>`:''}`;
}
function select(id){selected=id;draw();}
const pick=e=>{const el=e.target.closest('[data-hub]');if(el)select(el.dataset.hub);};
list.addEventListener('click',pick);
dots.addEventListener('click',pick);
dots.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(e);document.querySelector(`.hubs-item[data-hub="${CSS.escape(selected)}"]`)?.focus();}});
M.onLang(draw);
fetch('/hubs.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(d=>{
 data=d;
 // The first live hub opens at once: today that is the only one.
 selected=d.hubs.find(h=>h.status==='live')?.id||null;draw();
}).catch(()=>{list.innerHTML=`<p class="fine">${esc(w('failed'))}</p>`;});
});
