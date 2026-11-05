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
  teams:{en:'Teams',hr:'Timovi',ru:'Команды'},
  lectures:{en:'Lectures',hr:'Predavanja',ru:'Лекции'},
  people:{en:'people',hr:'osoba',ru:'чел.'},
  showInOffice:{en:'Show in the office',hr:'Prikaži u uredu',ru:'Показать в офисе'},
  aboutProject:{en:'About the project',hr:'O projektu',ru:'О проекте'},
  notes:{en:'Lecture notes',hr:'Bilješke',ru:'Конспект'},
  attended:{en:'Attended',hr:'Prisustvovao',ru:'Был(а)'},
  confirmed:{en:'confirmed',hr:'potvrđeno',ru:'подтверждено'},
  markAttendance:{en:'Mark attendance',hr:'Označi dolazak',ru:'Отметить посещение'},
  upcoming:{en:'Upcoming',hr:'Uskoro',ru:'Скоро'},
  badges:{en:'Achievements',hr:'Postignuća',ru:'Достижения'},
  lecturesAttended:{en:'Lectures',hr:'Predavanja',ru:'Лекции'},
  tasksDone:{en:'Tasks done',hr:'Gotovi zadaci',ru:'Заданий сделано'},
  myProject:{en:'My project',hr:'Moj projekt',ru:'Мой проект'},
  links:{en:'My links',hr:'Moje poveznice',ru:'Мои ссылки'},
  linkedin:{en:'LinkedIn',hr:'LinkedIn',ru:'LinkedIn'},
  website:{en:'Website or social profile',hr:'Web ili društvena mreža',ru:'Сайт или соцсеть'},
  save:{en:'Save',hr:'Spremi',ru:'Сохранить'},
  saved:{en:'Saved',hr:'Spremljeno',ru:'Сохранено'},
  noCharacter:{en:'Link your office character in My account → Character.',hr:'Povežite svoj lik u Moj račun → Lik.',ru:'Свяжите своего персонажа в кабинете → «Персонаж».'},
  linkedIn:{en:'LinkedIn',hr:'LinkedIn',ru:'LinkedIn'},
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
 let lang='en',open=null,area='',data=null,loading=null,host=null,error='',loadedAt=0,photoVersion=0,linksNote='',context={};
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
   const [tasks,profile,mentors,notes,lectures]=await Promise.all([
    me?get('/api/tasks').catch(()=>({items:[]})):{items:[]},
    me?get('/api/me/profile').catch(()=>null):null,
    get('/api/mentors').catch(()=>({items:[]})),
    me?get('/api/notifications?limit=10').catch(()=>({items:[]})):{items:[]},
    get('/api/lectures').catch(()=>({items:[],today:''})),
   ]);
   data={me,csrf:auth.csrf||'',profile,lectures,messages:notes.items.filter(n=>n.kind==='nudge'&&!n.read),tasks:tasks.items.filter(x=>OPEN.has(x.status)&&x.task?.status==='published'),xp:profile?.xp??null,mentors:mentors.items};
   loadedAt=Date.now();loading=null;return data;
  })();
  return loading;
 }
 const initials=name=>String(name||'?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
 const face=(me,size)=>me?.hasAvatar?`<img src="/api/avatars/me?v=${photoVersion}" alt="" width="${size}" height="${size}">`:`<span>${me?esc(initials(me.displayName)):'👤'}</span>`;
 /** First frame of an office character sheet (three frames side by side). */
 const sprite=(src,cls='')=>src?`<span class="hud-sprite ${cls}" style="background-image:url('${esc(src)}')" aria-hidden="true"></span>`:'';
 const day=iso=>new Intl.DateTimeFormat({en:'en-GB',hr:'hr-HR',ru:'ru-RU'}[lang],{day:'numeric',month:'short',timeZone:'Europe/Zagreb'}).format(new Date(iso+'T12:00:00Z'));

 const BUTTONS=[['tasks','✓'],['teams','◆'],['lectures','▤'],['mentors','✦']];
 function dock(){
  const me=data?.me,count=data?.tasks.length||0;
  return `<div class="hud-dock" role="toolbar" aria-label="BIRD">
   ${me?`<button class="hud-btn hud-face" data-hud="profile" aria-pressed="${open==='profile'}" aria-label="${t('profile')}">${face(me,44)}</button>${data.messages.length?`<b class="hud-badge hud-badge-face" aria-label="${t('messages')}">${data.messages.length}</b>`:''}`:`<button class="hud-btn hud-guest" data-hud="profile" aria-pressed="${open==='profile'}"><span aria-hidden="true">👤</span><small>${t('signIn')}</small></button>`}
   ${BUTTONS.map(([k,icon])=>`<button class="hud-btn" data-hud="${k}" aria-pressed="${open===k}"><span aria-hidden="true">${icon}</span><small>${t(k)}</small>${k==='tasks'&&me&&count?`<b class="hud-badge">${count}</b>`:''}</button>`).join('')}
  </div>`;
 }
 function guest(){return `<p>${t('guestNote')}</p><div class="hud-actions"><a class="hud-primary" href="#/account/register">${t('register')}</a><a class="hud-secondary" href="#/account">${t('signIn')}</a></div>`;}
 function profilePanel(){
  const me=data.me,p=data.profile;if(!me)return guest();
  const character=p?.character&&context.member?.(p.character.personId);
  const earned=p?p.badges.filter(b=>b.earned):[];
  return `<div class="hud-profile">${character?sprite(character.img,'hud-sprite-lg'):''}<div class="hud-profile-main"><label class="hud-photo">${face(me,56)}<input type="file" accept="image/*" data-hud-photo hidden><span>${t(me.hasAvatar?'photo':'addPhoto')}</span></label><div><strong>${esc(me.displayName)}</strong>${p?`<small>${p.xp} ${t('points')}</small>`:''}</div></div></div>
   ${data.messages.length?`<ul class="hud-list hud-messages">${data.messages.map(n=>`<li><strong>${esc(n.payload.from)}</strong><p>${esc(n.payload.message)}</p></li>`).join('')}</ul>`:''}
   ${p?`<div class="hud-stats"><div><b>${p.xp}</b><small>${t('points')}</small></div><div><b>${p.lectures.verified+p.lectures.selfReported}/${p.lectures.held}</b><small>${t('lecturesAttended')}</small></div><div><b>${p.tasks.done}</b><small>${t('tasksDone')}</small></div></div>
   <h3>${t('badges')} · ${earned.length}/${p.badges.length}</h3><ul class="hud-badges">${p.badges.map(b=>`<li class="${b.earned?'is-earned':''}" title="${esc(b.title[lang]||b.title.en)}"><span aria-hidden="true">${b.earned?'★':'☆'}</span>${esc(b.title[lang]||b.title.en)}</li>`).join('')}</ul>
   ${p.projects.length?`<h3>${t('myProject')}</h3><div class="hud-actions">${p.projects.map(x=>`<a class="hud-secondary" href="#/account/project/${esc(x.id)}">${esc(x.name)}</a>${x.published&&context.hasProject?.(x.id)?`<button class="hud-link" data-hud-team="${esc(x.id)}">${t('showInOffice')}</button>`:''}`).join('')}</div>`:''}
   <h3>${t('links')}</h3><form class="hud-links" data-hud-links><label><span>${t('linkedin')}</span><input name="linkedin" type="url" inputmode="url" placeholder="https://www.linkedin.com/in/…" value="${esc(p.links.linkedin)}" maxlength="300"></label><label><span>${t('website')}</span><input name="website" type="url" inputmode="url" placeholder="https://" value="${esc(p.links.website)}" maxlength="300"></label><button class="hud-secondary">${t('save')}</button>${linksNote?`<small role="status">${esc(linksNote)}</small>`:''}</form>`:''}
   ${error?`<p class="hud-error" role="alert">${esc(error)}</p>`:''}<p class="hud-muted">${t('photoNote')}</p>
   ${p&&!p.character?`<p class="hud-muted">${t('noCharacter')}</p>`:''}
   <div class="hud-actions"><a class="hud-primary" href="#/account">${t('cabinet')}</a>${['program_admin','platform_owner'].includes(me.role)?`<a class="hud-secondary" href="#/admin">${t('admin')}</a>`:''}</div>`;
 }
 function teamsPanel(){
  const teams=context.teams?.()||[];
  return `<ul class="hud-list hud-teams">${teams.map(team=>`<li><button class="hud-team" data-hud-team="${esc(team.id)}"><span class="hud-team-dot" style="background:${esc(team.color)}"></span><strong>${esc(team.name)}</strong><small aria-label="${team.members.length}">👥 ${team.members.length}</small></button><div class="hud-team-people">${team.members.map(m=>`<button class="hud-person" data-hud-team="${esc(team.id)}" data-hud-person="${esc(m.id)}" title="${esc(m.name)}">${m.img?sprite(m.img):`<span class="hud-mentor-face">${esc(initials(m.name))}</span>`}<small>${esc(m.name.split(' ')[0])}</small></button>`).join('')}</div></li>`).join('')}</ul>`;
 }
 function lecturesPanel(){
  const l=data.lectures,me=data.me;
  if(!l.items.length)return '<p>—</p>';
  return `<ul class="hud-list">${[...l.items].reverse().map(x=>{const past=x.date<=l.today,a=x.attendance;return `<li><div class="hud-lecture"><span class="hud-date">${esc(day(x.date))}</span><div><strong>${esc(x.title[lang]||x.title.en)}</strong>${x.speaker?`<small>${esc(x.speaker)}</small>`:''}<small>${!past?t('upcoming'):a?`✓ ${t('attended')}${a.kind==='verified_by_admin'?' · '+t('confirmed'):''}`:''}</small></div></div><div class="hud-actions"><a class="hud-secondary" href="#/${esc(x.id)}">${t('notes')}</a>${past&&me&&!a?`<a class="hud-link" href="#/account/tasks">${t('markAttendance')}</a>`:''}</div></li>`;}).join('')}</ul>`;
 }
 function mentorsPanel(){
  const me=data.me,areas=[...new Set(data.mentors.map(m=>m.area))],list=data.mentors.filter(m=>!area||m.area===area);
  if(!data.mentors.length)return `<p>${t('noMentors')}</p>`;
  return `${areas.length>1?`<div class="hud-chips">${['',...areas].map(a=>`<button data-hud-area="${esc(a)}" aria-pressed="${a===area}">${esc(a||t('all'))}</button>`).join('')}</div>`:''}<ul class="hud-list hud-mentors">${list.map(m=>`<li><div class="hud-mentor-head"><span class="hud-mentor-face ${m.gender==='f'?'is-f':''}">${esc(initials(m.name))}</span><div><strong>${esc(m.name)}</strong><small class="hud-area">${esc(m.area)}</small></div></div>${m.bio?`<p>${esc(m.bio)}</p>`:''}<small>${m.nextFree?`${t('next')}: ${esc(when(m.nextFree))}`:t('noSlots')}</small><div class="hud-actions">${m.freeSlots?`<a class="hud-secondary" href="${me?'#/account/mentors/'+esc(m.id):'#/account/register'}">${t('book')}</a>`:''}${m.link?`<a class="hud-link" href="${esc(m.link)}" target="_blank" rel="noopener noreferrer">${t('linkedIn')} ↗</a>`:''}</div></li>`).join('')}</ul>`;
 }
 function panel(){
  if(!open||!data)return '';
  const me=data.me;
  const body=open==='profile'?profilePanel():open==='tasks'?(me?(data.tasks.length?`<ul class="hud-list">${data.tasks.slice(0,8).map(x=>`<li><a href="#/account/task/${esc(x.id)}"><strong>${esc(title(x.task.translations))}</strong><small>${x.task.xp} ${t('points')} · ${t('st_'+x.status)}</small></a></li>`).join('')}</ul>`:`<p>${t('noTasks')}</p>`)+`<div class="hud-actions"><a class="hud-primary" href="#/account/tasks">${t('allTasks')}</a></div>`:guest()):open==='teams'?teamsPanel():open==='lectures'?lecturesPanel():mentorsPanel();
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
   const team=e.target.closest('[data-hud-team]');if(team){open=null;paint();context.select?.(team.dataset.hudTeam,team.dataset.hudPerson||null);return;}
   if(e.target.closest('a[href^="#"]')){open=null;}
  });
  el.addEventListener('change',async e=>{
   const input=e.target.closest('[data-hud-photo]');if(!input?.files?.[0])return;
   try{await upload(input.files[0]);error='';photoVersion=Date.now();await load(true);}catch{error=t('photoError');}
   paint();
  });
  el.addEventListener('submit',async e=>{
   const form=e.target.closest('[data-hud-links]');if(!form)return;e.preventDefault();
   const f=new FormData(form);
   const r=await fetch('/api/me/links',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':data.csrf},body:JSON.stringify({linkedin:f.get('linkedin'),website:f.get('website')})});
   linksNote=r.ok?t('saved'):'✕';await load(true);paint();
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
 function mount(wrap,language,ctx={}){
  if(!wrap)return;host=wrap;lang=language||'en';context=ctx;
  paint();
  load().then(paint);
 }
 window.BirdOfficeHud={mount,refresh:()=>load(true).then(paint),open:async name=>{open=name;paint();await load();paint();}};
})();
