/**
 * Office dock: Profile, Tasks and Mentors stay on top of the office picture, whatever
 * the zoom or pan. Panels open over the map; actions lead into My account.
 */
(function(){
 const T={
  profile:{en:'Profile',hr:'Profil',ru:'Профиль'},
  tasks:{en:'Tasks',hr:'Zadaci',ru:'Задания'},
  mentors:{en:'Mentors',hr:'Mentori',ru:'Менторы'},
  close:{en:'Close',hr:'Zatvori',ru:'Закрыть'},
  messages:{en:'Messages from the organisers',hr:'Poruke organizatora',ru:'Сообщения от организаторов'},
  signIn:{en:'Sign in',hr:'Prijava',ru:'Войти'},
  register:{en:'Create account',hr:'Izradi račun',ru:'Создать аккаунт'},
  guestNote:{en:'Sign in to see your tasks, points and to book mentors.',hr:'Prijavite se za zadatke, bodove i termine s mentorima.',ru:'Войдите, чтобы видеть свои задания, баллы и записываться к менторам.'},
  cabinet:{en:'My account',hr:'Moj račun',ru:'Мой кабинет'},
  admin:{en:'Admin',hr:'Administracija',ru:'Админка'},
  points:{en:'points',hr:'bodova',ru:'баллов'},
  photo:{en:'Change photo',hr:'Promijeni fotografiju',ru:'Сменить фото'},
  addPhoto:{en:'Add photo',hr:'Dodaj fotografiju',ru:'Добавить фото'},
  photoNote:{en:'Only you and the organisers see it.',hr:'Vidite je samo vi i organizatori.',ru:'Его видите только вы и организаторы.'},
  photoError:{en:'Could not save the photo. Try a JPG or PNG.',hr:'Fotografija nije spremljena. Pokušajte JPG ili PNG.',ru:'Не удалось сохранить фото. Попробуйте JPG или PNG.'},
  allTasks:{en:'All tasks',hr:'Svi zadaci',ru:'Все задания'},
  noTasks:{en:'Nothing left to do. Look at the task catalogue for extra points.',hr:'Sve je gotovo. U katalogu ima zadataka za dodatne bodove.',ru:'Всё сделано. В каталоге заданий есть задания на дополнительные баллы.'},
  catalog:{en:'Task catalogue',hr:'Katalog zadataka',ru:'Каталог заданий'},
  all:{en:'All',hr:'Svi',ru:'Все'},
  next:{en:'Next free slot',hr:'Sljedeći slobodni termin',ru:'Ближайшее окно'},
  noSlots:{en:'No free slots yet',hr:'Još nema slobodnih termina',ru:'Свободных окон пока нет'},
  book:{en:'Book',hr:'Rezerviraj',ru:'Записаться'},
  noMentors:{en:'Mentors will appear here soon.',hr:'Mentori će se uskoro pojaviti ovdje.',ru:'Скоро здесь появятся менторы.'},
  st_not_started:{en:'Not started',hr:'Nije započeto',ru:'Не начато'},
  st_draft:{en:'Draft',hr:'Nacrt',ru:'Черновик'},
  st_changes_requested:{en:'Changes requested',hr:'Potrebne izmjene',ru:'Нужны правки'},
 };
 const OPEN=new Set(['not_started','draft','changes_requested']);
 let lang='en',open=null,area='',data=null,loading=null,host=null,error='',loadedAt=0,photoVersion=0;
 const t=k=>T[k]?.[lang]||T[k]?.en||k;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const title=tr=>tr?.[lang]?.title||tr?.en?.title||'';
 const when=iso=>new Intl.DateTimeFormat({en:'en-GB',hr:'hr-HR',ru:'ru-RU'}[lang],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Zagreb'}).format(new Date(iso));
 const get=async url=>{const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw r.status;return r.json();};

 async function load(force){
  if(data&&!force&&Date.now()-loadedAt<20000)return data;
  if(loading)return loading;
  loading=(async()=>{
   const auth=await get('/api/auth/me').catch(()=>({user:null})),me=auth.user;
   const [tasks,progress,mentors,notes]=await Promise.all([
    me?get('/api/tasks').catch(()=>({items:[]})):{items:[]},
    me?get('/api/progress').catch(()=>null):null,
    get('/api/mentors').catch(()=>({items:[]})),
    me?get('/api/notifications?limit=10').catch(()=>({items:[]})):{items:[]},
   ]);
   data={me,csrf:auth.csrf||'',messages:notes.items.filter(n=>n.kind==='nudge'&&!n.read),tasks:tasks.items.filter(x=>OPEN.has(x.status)&&x.task?.status==='published'),xp:progress?.xp??null,mentors:mentors.items};
   loadedAt=Date.now();loading=null;return data;
  })();
  return loading;
 }
 const initials=name=>String(name||'?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
 const face=(me,size)=>me?.hasAvatar?`<img src="/api/avatars/me?v=${photoVersion}" alt="" width="${size}" height="${size}">`:`<span>${me?esc(initials(me.displayName)):'👤'}</span>`;

 function dock(){
  const me=data?.me,count=data?.tasks.length||0;
  return `<div class="hud-dock" role="toolbar" aria-label="BIRD">
   ${me?`<button class="hud-btn hud-face" data-hud="profile" aria-pressed="${open==='profile'}" aria-label="${t('profile')}">${face(me,44)}</button>${data.messages.length?`<b class="hud-badge hud-badge-face" aria-label="${t('messages')}">${data.messages.length}</b>`:''}`:`<button class="hud-btn hud-guest" data-hud="profile" aria-pressed="${open==='profile'}"><span aria-hidden="true">👤</span><small>${t('signIn')}</small></button>`}
   <button class="hud-btn" data-hud="tasks" aria-pressed="${open==='tasks'}"><span aria-hidden="true">✓</span><small>${t('tasks')}</small>${me&&count?`<b class="hud-badge">${count}</b>`:''}</button>
   <button class="hud-btn" data-hud="mentors" aria-pressed="${open==='mentors'}"><span aria-hidden="true">✦</span><small>${t('mentors')}</small></button>
  </div>`;
 }
 function guest(){return `<p>${t('guestNote')}</p><div class="hud-actions"><a class="hud-primary" href="#/account/register">${t('register')}</a><a class="hud-secondary" href="#/account">${t('signIn')}</a></div>`;}
 function panel(){
  if(!open||!data)return '';
  const me=data.me;let body='';
  if(open==='profile'){
   body=me?`<div class="hud-profile"><label class="hud-photo">${face(me,72)}<input type="file" accept="image/*" data-hud-photo hidden><span>${t(me.hasAvatar?'photo':'addPhoto')}</span></label><div><strong>${esc(me.displayName)}</strong>${data.xp!==null?`<small>${data.xp} ${t('points')}</small>`:''}</div></div>${data.messages.length?`<ul class="hud-list hud-messages">${data.messages.map(n=>`<li><strong>${esc(n.payload.from)}</strong><p>${esc(n.payload.message)}</p></li>`).join('')}</ul>`:''}<p class="hud-muted">${t('photoNote')}</p>${error?`<p class="hud-error" role="alert">${esc(error)}</p>`:''}<div class="hud-actions"><a class="hud-primary" href="#/account">${t('cabinet')}</a>${['program_admin','platform_owner'].includes(me.role)?`<a class="hud-secondary" href="#/admin">${t('admin')}</a>`:''}</div>`:guest();
  }else if(open==='tasks'){
   body=me?(data.tasks.length?`<ul class="hud-list">${data.tasks.slice(0,8).map(x=>`<li><a href="#/account/task/${esc(x.id)}"><strong>${esc(title(x.task.translations))}</strong><small>${x.task.xp} ${t('points')} · ${t('st_'+x.status)}</small></a></li>`).join('')}</ul>`:`<p>${t('noTasks')}</p>`)+`<div class="hud-actions"><a class="hud-primary" href="#/account/tasks">${t('allTasks')}</a></div>`:guest();
  }else if(open==='mentors'){
   const areas=[...new Set(data.mentors.map(m=>m.area))];
   const list=data.mentors.filter(m=>!area||m.area===area);
   body=data.mentors.length?`${areas.length>1?`<div class="hud-chips">${['',...areas].map(a=>`<button data-hud-area="${esc(a)}" aria-pressed="${a===area}">${esc(a||t('all'))}</button>`).join('')}</div>`:''}<ul class="hud-list hud-mentors">${list.map(m=>`<li><div class="hud-mentor-head"><span class="hud-mentor-face">${esc(initials(m.name))}</span><div><strong>${esc(m.name)}</strong><small class="hud-area">${esc(m.area)}</small></div></div>${m.bio?`<p>${esc(m.bio)}</p>`:''}<small>${m.nextFree?`${t('next')}: ${esc(when(m.nextFree))}`:t('noSlots')}</small>${m.freeSlots?`<a class="hud-secondary" href="${me?'#/account/mentors/'+esc(m.id):'#/account/register'}">${t('book')}</a>`:''}</li>`).join('')}</ul>`:`<p>${t('noMentors')}</p>`;
  }
  return `<section class="hud-panel" role="dialog" aria-label="${t(open)}"><header><h2>${t(open)}</h2><button data-hud-close aria-label="${t('close')}">×</button></header><div class="hud-body">${body}</div></section>`;
 }
 function paint(){
  if(!host||!host.isConnected)return;
  let el=host.querySelector(':scope > .office-hud');
  if(!el){el=document.createElement('div');el.className='office-hud';host.append(el);bindTo(el);}
  el.innerHTML=dock()+panel();
 }
 function bindTo(el){
  // Keep taps on the dock away from the map's pan and zoom handlers.
  for(const type of ['pointerdown','wheel','dblclick','touchstart'])el.addEventListener(type,e=>e.stopPropagation(),{passive:true});
  el.addEventListener('click',async e=>{
   const b=e.target.closest('[data-hud]');if(b){open=open===b.dataset.hud?null:b.dataset.hud;error='';paint();if(open){await load(true);paint();if(open==='profile'&&data.messages.length)fetch('/api/notifications/read',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':data.csrf},body:'{}'}).catch(()=>{});}return;}
   if(e.target.closest('[data-hud-close]')){open=null;paint();return;}
   const a=e.target.closest('[data-hud-area]');if(a){area=a.dataset.hudArea;paint();return;}
   if(e.target.closest('a[href^="#"]')){open=null;}
  });
  el.addEventListener('change',async e=>{
   const input=e.target.closest('[data-hud-photo]');if(!input?.files?.[0])return;
   try{await upload(input.files[0]);error='';photoVersion=Date.now();await load(true);}catch{error=t('photoError');}
   paint();
  });
  el.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){e.stopPropagation();open=null;paint();}});
 }
 /** Square crop, 256 px, JPEG: small enough for the server limit. */
 async function upload(file){
  const bitmap=await createImageBitmap(file);
  const side=Math.min(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);
  const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.86));
  const me=await get('/api/auth/me');
  const r=await fetch('/api/me/avatar',{method:'PUT',credentials:'same-origin',headers:{'content-type':'image/jpeg','x-csrf-token':me.csrf||''},body:blob});
  if(!r.ok)throw r.status;
 }
 function mount(wrap,language){
  if(!wrap)return;host=wrap;lang=language||'en';
  paint();
  load().then(paint);
 }
 window.BirdOfficeHud={mount,refresh:()=>load(true).then(paint)};
})();
