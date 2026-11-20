'use strict';
/* Messenger: private messages and group chats that read like a chat app, wherever they open.
   BirdMessenger.thread(el,{kind:'dm'|'group',id,head:'full'|'slim',back,full}) -> stop()   one conversation
   BirdMessenger.inbox(el,{onOpen,active,newGroup})                           -> {stop,refresh,setActive}
   BirdMessenger.panel(el,{})                      -> inbox, a tap opens the conversation in the same panel (own office card, dock)
   BirdMessenger.app(el,{route,base,newGroup})     -> #/account/messages: two columns on desktop, one screen at a time on phones
   BirdMessenger.count / refreshUnread()           -> every [data-msgr-count] badge, the tab title "(N)" and a 'bird:messages' event.
   An open conversation asks for messages after the last one every 4 s (only while the tab is visible); the unread count
   is asked every 20 s. Sending shows the bubble at once and confirms it; a failed one keeps a Retry.
   Privacy and permissions stay on the server: organisers never read conversations, a demo visitor cannot send. */
(()=>{
const L=(en,hr,ru)=>({en,hr,ru});
const W={
 messages:L('Messages','Poruke','Сообщения'),search:L('Search or start a chat','Traži ili započni razgovor','Поиск или новый чат'),
 people:L('People','Osobe','Люди'),chats:L('Chats','Razgovori','Чаты'),pinned:L('Pinned','Prikvačeni','Закреплённые'),
 none:L('No conversations yet. Type a name above to write to someone.','Još nema razgovora. Upišite ime u polje iznad da biste nekome pisali.','Разговоров пока нет. Введите имя выше, чтобы кому-то написать.'),
 noMatch:L('Nobody found','Nitko nije pronađen','Никого не нашли'),pick:L('Choose a conversation or find someone to write to.','Odaberite razgovor ili pronađite osobu kojoj želite pisati.','Выберите разговор или найдите, кому написать.'),
 startTeam:L('Start the team chat','Pokreni timski chat','Начать чат команды'),
 placeholder:L('Message','Poruka','Сообщение'),send:L('Send','Pošalji','Отправить'),attach:L('Attach a file','Priloži datoteku','Прикрепить файл'),
 removeFile:L('Remove the file','Ukloni datoteku','Убрать файл'),back:L('Back','Natrag','Назад'),more:L('More','Više','Ещё'),
 older:L('Earlier messages','Starije poruke','Более ранние сообщения'),first:L('No messages yet. Say hello.','Još nema poruka. Pošaljite pozdrav.','Сообщений пока нет. Поздоровайтесь.'),
 today:L('Today','Danas','Сегодня'),yesterday:L('Yesterday','Jučer','Вчера'),
 sending:L('Sending','Šalje se','Отправляется'),sent:L('Sent','Poslano','Отправлено'),read:L('Read','Pročitano','Прочитано'),
 failed:L('Not sent','Nije poslano','Не отправлено'),retry:L('Retry','Pokušaj ponovno','Повторить'),
 copy:L('Copy text','Kopiraj tekst','Копировать текст'),members:L('Members and settings','Članovi i postavke','Участники и настройки'),
 openFull:L('Open in Messages','Otvori u Porukama','Открыть в Сообщениях'),newGroup:L('New group','Nova grupa','Новая группа'),
 demo:L('In the demo, messages are not sent.','U demo verziji poruke se ne šalju.','В демо сообщения не отправляются.'),
 signIn:L('Sign in to write','Prijavite se da biste pisali','Войдите, чтобы написать'),
 tooBig:L('The file is too large.','Datoteka je prevelika.','Файл слишком большой.'),loading:L('Loading…','Učitavanje…','Загрузка…'),
 notFound:L('This conversation is not available.','Ovaj razgovor nije dostupan.','Этот разговор недоступен.'),
 unread:L('unread','nepročitano','непрочитано'),
};
let lang='en';
const setLang=l=>{const v=String(l||'').slice(0,2);if(['en','hr','ru'].includes(v))lang=v;};
// Wording shared with the account pages (account-i18n.js) is taken from there, so both say the same thing.
const t=k=>W[k]?.[lang]||window.BIRD_ACCOUNT_TEXT?.[k]?.[lang]||W[k]?.en||window.BIRD_ACCOUNT_TEXT?.[k]?.en||k;
// Word after a count (1 član / 2 člana / 5 članova), from the account dictionary's key_one / key_few / key_many.
const tn=(k,n)=>window.BirdPluralText&&window.BIRD_ACCOUNT_TEXT?window.BirdPluralText(window.BIRD_ACCOUNT_TEXT,k,n,lang):t(k);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc=()=>({en:'en-GB',hr:'hr-HR',ru:'ru-RU'}[lang]);
const TZ='Europe/Zagreb';
const fmt=(iso,o)=>new Intl.DateTimeFormat(loc(),{timeZone:TZ,...o}).format(new Date(iso));
const dayOf=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date(iso));
const dayAgo=n=>dayOf(new Date(Date.now()-n*86400000).toISOString());
const hm=iso=>fmt(iso,{hour:'2-digit',minute:'2-digit'});
const dayLabel=iso=>{const d=dayOf(iso);return d===dayAgo(0)?t('today'):d===dayAgo(1)?t('yesterday'):fmt(iso,{weekday:'long',day:'numeric',month:'long',...(d.slice(0,4)!==dayAgo(0).slice(0,4)?{year:'numeric'}:{})});};
const listTime=iso=>{if(!iso)return '';const d=dayOf(iso);return d===dayAgo(0)?hm(iso):d>=dayAgo(6)?fmt(iso,{weekday:'short'}):fmt(iso,{day:'numeric',month:'numeric'});};
const size=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const initials=name=>String(name||'?').trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase()||'?';
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const coarse=()=>matchMedia('(pointer:coarse)').matches;
const phone=()=>matchMedia('(max-width:760px)').matches;
// Plain text with web links made clickable; everything else stays escaped.
const linkify=s=>esc(s).replace(/https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g,u=>`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);

// Drawn icons: 24px grid, square ends, like icons.js. Never emoji.
const svg=(d,cls='')=>`<svg class="msgr-i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
const I={
 send:svg('<path d="M4 12h9M4 4l17 8-17 8 3-8z"/>'),
 clip:svg('<path d="M17 8.5l-7 7a2 2 0 0 0 2.8 2.8l7.6-7.6a4 4 0 0 0-5.7-5.7L7 12.7a6 6 0 0 0 8.5 8.5L21 15.7"/>'),
 back:svg('<path d="M15 4l-8 8 8 8"/>'),
 more:svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>','is-fill'),
 search:svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
 plus:svg('<path d="M12 4v16M4 12h16"/>'),
 x:svg('<path d="M6 6l12 12M18 6L6 18"/>'),
 tick:svg('<path d="M3 12.5l4.5 4.5L18 6.5"/>','is-tick'),
 ticks:svg('<path d="M1.5 12.5L6 17 16.5 6.5M11 16l1 1L22.5 6.5"/>','is-tick is-read'),
 clock:svg('<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>','is-tick'),
 alert:svg('<path d="M12 6v8M12 17.5v.5"/>','is-tick'),
 team:svg('<circle cx="8.5" cy="9" r="3"/><circle cx="16" cy="9.5" r="2.5"/><path d="M3 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M14.5 14.2c2.6-.4 5 1 5.5 4.8"/>'),
 globe:svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>'),
};

// Who is signed in, the CSRF token and the unread count, shared by every piece of the messenger.
const S={user:undefined,csrf:'',count:0,latest:'',p:null,ready:false};
function auth(fresh){
 if(fresh||!S.p)S.p=fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.ok?r.json():{}).catch(()=>({})).then(d=>{S.user=d.user||null;S.csrf=d.csrf||'';if(d.user){S.ready=true;setCount(d.messages||0);}return S;});
 return S.p;
}
const demoUser=()=>String(S.user?.id||'').startsWith('demo-user-');
class Failed extends Error{constructor(code,status){super(code);this.code=code;this.status=status;}}
async function call(method,url,body,{raw,headers={}}={},again=true){
 if(method!=='GET'&&!S.csrf)await auth(true);
 const h={...headers};if(method!=='GET')h['X-CSRF-Token']=S.csrf;
 if(body!==undefined&&!raw)h['Content-Type']='application/json';
 let r;try{r=await fetch(url,{method,credentials:'same-origin',headers:h,body:raw||(body===undefined?undefined:JSON.stringify(body))});}catch{throw new Failed('NETWORK',0);}
 const d=(r.headers.get('content-type')||'').includes('json')?await r.json().catch(()=>null):null;
 // A session renewed in another tab changes the token: ask once more with the new one.
 if(r.status===403&&d?.error?.code==='CSRF'&&again){await auth(true);return call(method,url,body,{raw,headers},false);}
 if(!r.ok)throw new Failed(d?.error?.code||'FAILED',r.status);
 return d;
}

// Unread count: badges, title and an event -----------------------------------------------------------------
function setCount(n){
 n=Math.max(0,Number(n)||0);S.count=n;
 document.querySelectorAll('[data-msgr-count]').forEach(b=>{const v=n>99?'99+':String(n);if(b.textContent!==v)b.textContent=v;b.hidden=!n;});
 titleMark();
}
let titling=false;
function titleMark(){
 if(titling)return;titling=true;
 const bare=document.title.replace(/^\(\d+\+?\) /,''),want=(S.count?`(${S.count>99?'99+':S.count}) `:'')+bare;
 if(document.title!==want)document.title=want;
 titling=false;
}
async function refreshUnread(){
 if(document.hidden)return;
 if(S.user===undefined)await auth();
 if(!S.user)return;
 try{const d=await call('GET','/api/messages/unread');const changed=d.latest!==S.latest||d.unread!==S.count;S.ready=true;setCount(d.unread);S.latest=d.latest;
  if(changed)dispatchEvent(new CustomEvent('bird:messages',{detail:{unread:d.unread,latest:d.latest}}));}
 catch(e){if(e.status===401){S.user=null;setCount(0);}}
}
setInterval(refreshUnread,20000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshUnread();});
addEventListener('bird:auth',e=>{S.user=e.detail?.user||null;S.csrf=e.detail?.csrf||'';S.p=Promise.resolve(S);if(S.user)refreshUnread();else setCount(0);});
// Pages set their own titles and redraw their badges; the count is put back right after.
addEventListener('hashchange',()=>setTimeout(()=>{if(S.ready)setCount(S.count);},60));
const watchTitle=()=>{const head=document.querySelector('title');if(head&&typeof MutationObserver!=='undefined')new MutationObserver(titleMark).observe(head,{childList:true,characterData:true,subtree:true});};
if(document.readyState==='loading')addEventListener('DOMContentLoaded',watchTitle);else watchTitle();
setTimeout(refreshUnread,800);

// One small menu at a time: per conversation (the ⋯ in the header) or per message (hover ⋯, right click, long press).
let menuEl=null,menuBack=null;
function closeMenu(){if(!menuEl)return;menuEl.remove();menuEl=null;menuBack?.focus?.({preventScroll:true});menuBack=null;}
function openMenu(anchor,items){
 closeMenu();if(!items.length)return;
 menuBack=anchor;menuEl=document.createElement('div');menuEl.className='msgr-menu';menuEl.setAttribute('role','menu');
 menuEl.innerHTML=items.map((x,i)=>x.href?`<a role="menuitem" href="${esc(x.href)}" data-i="${i}">${esc(x.label)}</a>`:`<button type="button" role="menuitem" data-i="${i}" ${x.disabled?'disabled':''} class="${x.danger?'is-danger':''}">${esc(x.label)}</button>`).join('');
 document.body.append(menuEl);
 const r=anchor.getBoundingClientRect(),w=menuEl.offsetWidth,h=menuEl.offsetHeight;
 menuEl.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+'px';
 menuEl.style.top=(r.bottom+h+8>innerHeight?Math.max(8,r.top-h-4):r.bottom+4)+'px';
 menuEl.addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b)return;const x=items[Number(b.dataset.i)];if(!x.href)e.preventDefault();closeMenu();x.run?.();});
 menuEl.addEventListener('keydown',e=>{const all=[...menuEl.querySelectorAll('[role=menuitem]:not([disabled])')],i=all.indexOf(document.activeElement);
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();all[(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length]?.focus();}});
 menuEl.querySelector('[role=menuitem]:not([disabled])')?.focus({preventScroll:true});
}
document.addEventListener('pointerdown',e=>{if(menuEl&&!menuEl.contains(e.target))closeMenu();},true);
addEventListener('resize',closeMenu);addEventListener('hashchange',closeMenu);

// Avatar: initials in a roundel (a station), a group icon for chats.
const ava=(c,cls='')=>c.kind==='group'?`<span class="msgr-ava is-group ${cls}" aria-hidden="true">${c.group?.everyone?I.globe:I.team}</span>`:`<span class="msgr-ava ${cls}" aria-hidden="true" style="--h:${[...String(c.person?.id||c.id||'')].reduce((n,ch)=>n+ch.charCodeAt(0),0)%6}">${esc(initials(c.person?.name||c.name))}</span>`;
const groupName=g=>g.everyone?t('everyoneChat'):g.title;

// One conversation -----------------------------------------------------------------------------------------
const drafts=new Map();
function thread(el,o){
 const key=(o.kind==='group'?'g/':'')+o.id;
 const path=(o.kind==='group'?'/api/messages/groups/':'/api/messages/with/')+encodeURIComponent(o.id);
 const st={alive:true,items:new Map(),lastId:'',lastDay:'',readUpTo:'',meta:null,file:null,seq:0,first:''};
 const full=o.full||('#/account/messages/'+key);
 el.innerHTML=`<section class="msgr-thread ${o.head==='slim'?'is-slim':''}" aria-label="${esc(o.name||t('messages'))}">
 <header class="msgr-head">${o.back?`<button type="button" class="msgr-ib msgr-back" data-m="back" aria-label="${esc(t('back'))}">${I.back}</button>`:''}${o.head==='slim'?`<b class="msgr-slim-title">${esc(t('messages'))}</b>`:`<span class="msgr-head-ava"></span><div class="msgr-title"><b>${esc(o.name||'')}</b><small></small></div>`}<button type="button" class="msgr-ib" data-m="more" aria-haspopup="menu" aria-label="${esc(t('more'))}">${I.more}</button></header>
 <div class="msgr-scroll" tabindex="-1"><button type="button" class="msgr-older" data-m="older" hidden>${esc(t('older'))}</button><ol class="msgr-list" role="log" aria-live="polite" aria-relevant="additions"></ol><p class="msgr-empty" hidden>${esc(t('loading'))}</p></div>
 <p class="msgr-note" role="status" hidden></p>
 <form class="msgr-compose" hidden><label class="msgr-ib msgr-clip" title="${esc(t('attach'))}"><input type="file" accept=".pdf,.pptx,.png,.jpg,.jpeg,.webp" aria-label="${esc(t('attach'))}">${I.clip}</label><div class="msgr-field"><div class="msgr-chip" hidden></div><textarea rows="1" maxlength="2000" placeholder="${esc(t('placeholder'))}" aria-label="${esc(t('placeholder'))}"></textarea></div><button class="msgr-ib msgr-send" aria-label="${esc(t('send'))}" title="${esc(t('send'))}">${I.send}</button></form>
 </section>`;
 const $=s=>el.querySelector(s),box=$('.msgr-scroll'),list=$('.msgr-list'),form=$('.msgr-compose'),ta=$('textarea'),note=$('.msgr-note'),chip=$('.msgr-chip'),fileIn=$('input[type=file]');
 ta.value=drafts.get(key)||'';
 const atBottom=()=>box.scrollHeight-box.scrollTop-box.clientHeight<60;
 const toBottom=()=>{box.scrollTop=box.scrollHeight;};
 function grow(){ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,132)+'px';}
 function say(text,error){note.textContent=text||'';note.hidden=!text;note.classList.toggle('is-error',!!error);}

 function head(d){
  if(o.head==='slim')return;
  const g=d.group,p=d.person;
  $('.msgr-head-ava').innerHTML=g?ava({kind:'group',group:g}):ava({kind:'dm',person:p});
  $('.msgr-title b').textContent=g?groupName(g):p?.name||'';
  $('.msgr-title small').textContent=g?`${g.team?t('teamChat')+' · ':''}${g.members} ${tn('groupPeople',g.members)}`:[p?.organiser?t('dmOrganiser'):'',p?.waiting?t('dmNotJoined'):'',p?.team||''].filter(Boolean).join(' · ');
 }
 function access(d){
  const demo=demoUser(),can=d.canSend!==false&&!demo;
  form.hidden=!can&&!demo;form.classList.toggle('is-off',demo);
  [ta,fileIn,form.querySelector('.msgr-send')].forEach(x=>x.disabled=demo);
  say(demo?t('demo'):d.waiting?t('dmWaitingNote'):d.canSend===false?t(d.blocked?'dmYouBlocked':'dmCannot'):'');
 }
 const tick=m=>!m.mine?'':m.failed?I.alert:m.pending?I.clock:o.kind!=='group'&&(m.read||(st.readUpTo&&m.created<=st.readUpTo))?I.ticks:I.tick;
 const tickLabel=m=>m.failed?t('failed'):m.pending?t('sending'):o.kind!=='group'&&(m.read||(st.readUpTo&&m.created<=st.readUpTo))?t('read'):t('sent');
 function fileHtml(f){
  if(!f)return '';
  const src=f.local||`/api/files/${encodeURIComponent(f.id)}`;
  return String(f.mime||'').startsWith('image/')?`<a class="msgr-img" href="${esc(src)}" ${f.local?'':'download'}><img src="${esc(f.local||src+'?inline=1')}" alt="${esc(f.filename)}" loading="lazy"></a>`
   :`<a class="msgr-file" href="${esc(src)}" ${f.local?'':'download'}>${I.clip}<span>${esc(f.filename)}</span><small>${size(f.size||0)}</small></a>`;
 }
 function bubble(m){
  const li=document.createElement('li');
  li.className=`msgr-b ${m.mine?'is-mine':''} ${m.hidden?'is-hidden':''} ${m.pending?'is-pending':''} ${m.failed?'is-failed':''} ${m.file&&!m.body?'is-file':''}`;
  li.dataset.id=m.id||m.tmp;
  if(m.hidden){li.innerHTML=`<p>${esc(t('dmHidden'))}</p>`;return li;}
  const meta=`<span class="msgr-meta"><time datetime="${esc(m.created)}">${hm(m.created)}</time>${m.mine?`<span class="msgr-tick" title="${esc(tickLabel(m))}" aria-label="${esc(tickLabel(m))}">${tick(m)}</span>`:''}</span>`;
  li.innerHTML=`${o.kind==='group'&&!m.mine&&m.sender?`<b class="msgr-from">${esc(m.sender.name)}</b>`:''}${fileHtml(m.file)}${m.body?`<p>${linkify(m.body)}${meta}</p>`:meta}${m.mine?'':`<button type="button" class="msgr-mb" data-m="msg" aria-label="${esc(t('more'))}">${I.more}</button>`}${m.failed?`<button type="button" class="msgr-retry" data-m="retry">${esc(t('failed'))} · ${esc(t('retry'))}</button>`:''}`;
  return li;
 }
 function day(iso){const li=document.createElement('li');li.className='msgr-day';li.innerHTML=`<span>${esc(dayLabel(iso))}</span>`;return li;}
 function add(ms,{prepend=false}={}){
  if(prepend){
   // Older page: rebuild the day lines in front, then keep the reader's place.
   const h=box.scrollHeight,frag=document.createDocumentFragment();let d='';
   for(const m of ms){if(st.items.has(m.id))continue;st.items.set(m.id,m);const k=dayOf(m.created);if(k!==d){frag.append(day(m.created));d=k;}frag.append(bubble(m));}
   const firstDay=list.querySelector('.msgr-day');if(firstDay&&d===dayOf(st.first))firstDay.remove();
   list.prepend(frag);box.scrollTop+=box.scrollHeight-h;return;
  }
  for(const m of ms){
   const k=m.id||m.tmp;
   if(m.id&&st.items.has(m.id)){const old=list.querySelector(`[data-id="${CSS.escape(m.id)}"]`);if(old){const merged={...st.items.get(m.id),...m,pending:false,failed:false};st.items.set(m.id,merged);old.replaceWith(bubble(merged));}continue;}
   st.items.set(k,m);
   const d=dayOf(m.created);if(d!==st.lastDay){list.append(day(m.created));st.lastDay=d;}
   if(!st.first)st.first=m.created;
   list.append(bubble(m));
  }
  $('.msgr-empty').hidden=!!list.children.length;$('.msgr-empty').textContent=t('first');
 }
 function retick(){for(const li of list.querySelectorAll('.msgr-b.is-mine:not(.is-pending):not(.is-failed)')){const m=st.items.get(li.dataset.id);const s=m&&li.querySelector('.msgr-tick');if(s&&s.innerHTML!==tick(m)){s.innerHTML=tick(m);s.title=s.ariaLabel=tickLabel(m);}}}

 async function load(){
  let d;try{d=await call('GET',path);}catch(e){if(!st.alive)return;$('.msgr-empty').hidden=false;$('.msgr-empty').textContent=e.status===401?t('signIn'):t('notFound');form.hidden=true;return;}
  if(!st.alive)return;
  st.meta=d;st.readUpTo=d.readUpTo||'';head(d);access(d);
  $('.msgr-older').hidden=!d.hasMore;
  add(d.items);st.lastId=d.items.filter(m=>m.id).at(-1)?.id||'';
  toBottom();refreshUnread();
 }
 async function poll(){
  if(!st.alive||document.hidden||!el.isConnected||!st.meta)return;
  if(!st.lastId){const d=await call('GET',path).catch(()=>null);if(!d||!st.alive)return;access(d);st.readUpTo=d.readUpTo||'';if(d.items.length){const end=atBottom();add(d.items);st.lastId=d.items.at(-1).id;if(end)toBottom();refreshUnread();}return;}
  const d=await call('GET',path+'?after='+encodeURIComponent(st.lastId)).catch(()=>null);if(!d||!st.alive)return;
  if(d.canSend!==st.meta.canSend||d.blocked!==st.meta.blocked){st.meta={...st.meta,canSend:d.canSend,blocked:d.blocked};access(d);}
  if((d.readUpTo||'')!==st.readUpTo){st.readUpTo=d.readUpTo||'';retick();}
  if(d.items.length){const end=atBottom();add(d.items);st.lastId=d.items.at(-1).id;if(end)toBottom();refreshUnread();}
 }
 async function older(){
  const b=$('.msgr-older');b.disabled=true;
  const d=await call('GET',path+'?before='+encodeURIComponent(st.first)).catch(()=>null);b.disabled=false;
  if(!d||!st.alive)return;b.hidden=!d.hasMore;add(d.items,{prepend:true});if(d.items[0])st.first=d.items[0].created;
 }

 // Sending: the bubble shows at once (clock tick), turns into a sent one when the server answers, or offers Retry.
 function pickFile(f){
  if(!f){st.file=null;chip.hidden=true;chip.innerHTML='';return;}
  const image=/\.(png|jpe?g|webp)$/i.test(f.name);
  if(f.size>(image?10:25)*1048576){say(t('tooBig'),true);fileIn.value='';return;}
  st.file=f;chip.hidden=false;chip.innerHTML=`${I.clip}<span>${esc(f.name)}</span><small>${size(f.size)}</small><button type="button" class="msgr-ib" data-m="unfile" aria-label="${esc(t('removeFile'))}">${I.x}</button>`;
  ta.focus();
 }
 function submit(){
  const body=ta.value.trim(),file=st.file;if((!body&&!file)||demoUser()||st.meta?.canSend===false)return;
  const m={tmp:'tmp-'+(++st.seq),mine:true,body,created:new Date().toISOString(),pending:true,raw:file,
   file:file?{filename:file.name,mime:file.type,size:file.size,local:/^image\//.test(file.type)?URL.createObjectURL(file):''}:null};
  ta.value='';drafts.delete(key);grow();pickFile(null);fileIn.value='';say(st.meta?.waiting?t('dmWaitingNote'):'');
  add([m]);toBottom();deliver(m);ta.focus();
 }
 async function deliver(m){
  const li=()=>list.querySelector(`[data-id="${CSS.escape(m.tmp)}"]`);
  m.pending=true;m.failed=false;li()?.replaceWith(bubble(m));
  try{
   if(m.raw&&!m.fileId)m.fileId=(await call('POST','/api/files?purpose=message',undefined,{raw:m.raw,headers:{'X-Filename':encodeURIComponent(m.raw.name),'Content-Type':m.raw.type||'application/octet-stream','Idempotency-Key':crypto.randomUUID().replace(/-/g,'')}})).file.id;
   const r=await call('POST',path,{body:m.body,fileId:m.fileId});
   if(!st.alive)return;
   // The poll may have brought this message already: then the server's copy stays and the local one goes.
   const done={...m,id:r.id,created:r.created,pending:false};delete done.raw;
   if(st.items.has(r.id))li()?.remove();else{st.items.delete(m.tmp);st.items.set(r.id,done);li()?.replaceWith(bubble(done));}
   dispatchEvent(new CustomEvent('bird:msgr-sent',{detail:{key}}));
   poll();
  }catch(e){
   if(!st.alive)return;m.pending=false;m.failed=true;li()?.replaceWith(bubble(m));
   if(e.code==='DEMO_READ_ONLY')say(t('demo'),true);else if(e.code==='TOO_LARGE')say(t('tooBig'),true);else if(e.code==='FORBIDDEN'){st.meta={...st.meta,canSend:false};access(st.meta);}
  }
 }

 // Menus.
 function threadMenu(anchor){
  const d=st.meta||{},items=[];
  if(o.kind==='group'&&d.group&&!d.group.everyone)items.push({label:t('members'),href:'#/account/messages/g/'+o.id+'/info'});
  if(o.kind==='group'&&d.group?.everyone)items.push({label:t('members'),href:'#/account/messages/g/'+o.id+'/info'});
  if(o.head==='slim'||o.full)items.push({label:t('openFull'),href:full});
  if(o.kind!=='group'&&d.person&&!d.waiting)items.push(d.blocked?{label:t('dmUnblock'),run:()=>blockSet(false)}:{label:t('dmBlock'),danger:true,run:()=>{if(confirm(t('dmBlockConfirm')))blockSet(true);}});
  openMenu(anchor,items);
 }
 async function blockSet(on){
  try{await call(on?'POST':'DELETE',`/api/messages/with/${encodeURIComponent(o.id)}/block`);}catch{return;}
  st.meta={...st.meta,blocked:on,canSend:!on};access(st.meta);
  if(on)say(t('dmYouBlocked'));else poll();
 }
 function msgMenu(li){
  const m=st.items.get(li.dataset.id);if(!m||m.hidden)return;
  const items=[];
  if(m.body&&navigator.clipboard)items.push({label:t('copy'),run:()=>navigator.clipboard.writeText(m.body).catch(()=>{})});
  if(!m.mine&&m.id)items.push(m.reported?{label:t('dmReported'),disabled:true}:{label:t('dmReport'),danger:true,run:()=>report(m)});
  openMenu(li.querySelector('.msgr-mb')||li,items);
 }
 async function report(m){
  if(!confirm(t('dmReportConfirm')))return;
  try{await call('POST',(o.kind==='group'?'/api/messages/group-report/':'/api/messages/report/')+encodeURIComponent(m.id));m.reported=true;say(t('dmReportSent'));}catch{say(t('failed'),true);}
 }

 el.addEventListener('click',e=>{
  const b=e.target.closest('[data-m]');if(!b||!el.contains(b))return;
  const what=b.dataset.m;
  if(what==='back'){e.preventDefault();o.back?.();}
  else if(what==='more')threadMenu(b);
  else if(what==='msg')msgMenu(b.closest('.msgr-b'));
  else if(what==='older')older();
  else if(what==='unfile'){pickFile(null);fileIn.value='';ta.focus();}
  else if(what==='retry'){const m=st.items.get(b.closest('.msgr-b').dataset.id);if(m)deliver(m);}
 });
 el.addEventListener('contextmenu',e=>{const li=e.target.closest('.msgr-b:not(.is-mine):not(.is-hidden)');if(!li||e.target.closest('a'))return;e.preventDefault();msgMenu(li);});
 // Long press on a phone opens the same menu as the ⋯ of a message.
 let press=0;
 el.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const li=e.target.closest('.msgr-b:not(.is-mine):not(.is-hidden)');if(!li)return;clearTimeout(press);press=setTimeout(()=>{press=0;msgMenu(li);},520);});
 for(const ev of ['pointerup','pointercancel','pointermove'])el.addEventListener(ev,e=>{if(press&&(ev!=='pointermove'||Math.abs(e.movementY)>4||Math.abs(e.movementX)>4)){clearTimeout(press);press=0;}});
 form.addEventListener('submit',e=>{e.preventDefault();submit();});
 ta.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!coarse()){e.preventDefault();submit();}
  else if(e.key==='Escape'&&o.back&&!ta.value){e.stopPropagation();o.back();}
 });
 ta.addEventListener('input',()=>{grow();if(ta.value)drafts.set(key,ta.value);else drafts.delete(key);});
 fileIn.addEventListener('change',()=>pickFile(fileIn.files[0]));
 // Keep the newest message in view when the phone keyboard opens, the panel gets shorter or a picture finishes loading.
 const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(st.stick)toBottom();}):null;ro?.observe(box);ro?.observe(list);
 box.addEventListener('scroll',()=>{st.stick=atBottom();},{passive:true});st.stick=true;
 const timer=setInterval(poll,4000),wake=()=>{if(!document.hidden)poll();};
 document.addEventListener('visibilitychange',wake);
 grow();load();
 if(o.focus!==false&&!coarse())setTimeout(()=>ta.focus({preventScroll:true}),0);
 return ()=>{st.alive=false;clearInterval(timer);ro?.disconnect();document.removeEventListener('visibilitychange',wake);closeMenu();for(const m of st.items.values())if(m.file?.local)URL.revokeObjectURL(m.file.local);};
}

// Conversation list with search -----------------------------------------------------------------------------
function inbox(el,o={}){
 const st={alive:true,list:null,q:'',found:null,active:o.active||'',timer:0,latest:''};
 el.innerHTML=`<section class="msgr-inbox"><div class="msgr-search"><label class="msgr-search-box">${I.search}<input type="search" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}" autocomplete="off" maxlength="60"></label>${o.newGroup?`<a class="msgr-ib" href="${esc(o.newGroup)}" title="${esc(t('newGroup'))}" aria-label="${esc(t('newGroup'))}">${I.plus}</a>`:''}</div><div class="msgr-convs"><p class="msgr-hint">${esc(t('loading'))}</p></div></section>`;
 const input=el.querySelector('input'),box=el.querySelector('.msgr-convs');
 const keyOf=c=>c.kind==='group'?'g/'+c.group.id:c.kind==='team'?'t/'+c.id:c.person.id;
 const nameOf=c=>c.kind==='group'?groupName(c.group):c.kind==='team'?c.name:c.person.name;
 function row(c){
  const k=keyOf(c),last=c.last;
  const prev=c.kind==='team'?t('startTeam'):last?.body?`${last.mine?t('dmYou')+': ':c.kind==='group'&&last.who?esc(last.who)+': ':''}${esc(last.body)}`:c.kind==='group'?`${c.group.members} ${tn('groupPeople',c.group.members)}`:c.person?.team?esc(c.person.team):'';
  const sub=c.kind==='dm'&&c.person.waiting?` <small class="msgr-tag">${esc(t('dmNotJoined'))}</small>`:c.kind==='dm'&&c.person.organiser?` <small class="msgr-tag">${esc(t('dmOrganiser'))}</small>`:c.kind==='group'&&c.group.team?` <small class="msgr-tag">${esc(t('teamChat'))}</small>`:'';
  return `<button type="button" class="msgr-conv ${c.unread?'is-unread':''} ${k===st.active?'is-active':''}" data-key="${esc(k)}" ${k===st.active?'aria-current="true"':''}>${c.kind==='team'?`<span class="msgr-ava is-group" aria-hidden="true">${I.team}</span>`:ava(c)}<span class="msgr-conv-main"><span class="msgr-conv-top"><b>${esc(nameOf(c))}</b>${sub}<time>${esc(listTime(last?.created))}</time></span><span class="msgr-conv-bot"><span class="msgr-prev">${prev||'&nbsp;'}</span>${c.unread?`<b class="msgr-badge" aria-label="${esc(tn('msgUnread',c.unread).replace('{n}',c.unread))}">${c.unread>99?'99+':c.unread}</b>`:''}</span></span></button>`;
 }
 function paint(){
  if(!st.list){return;}
  const items=st.list.items,q=fold(st.q);
  const teams=st.list.teamsWithoutChat.map(x=>({kind:'team',id:x.id,name:x.name}));
  if(q){
   const hit=c=>fold(nameOf(c)).includes(q)||fold(c.person?.team).includes(q);
   const convs=[...items.filter(hit),...teams.filter(hit)],have=new Set(items.filter(c=>c.kind==='dm').map(c=>c.person.id));
   const people=(st.found||[]).filter(p=>!have.has(p.id)).map(p=>({kind:'dm',person:p,last:null,unread:0}));
   box.innerHTML=`${convs.length?`<h3 class="msgr-sec">${esc(t('chats'))}</h3>${convs.map(row).join('')}`:''}${people.length?`<h3 class="msgr-sec">${esc(t('people'))}</h3>${people.map(row).join('')}`:''}${!convs.length&&!people.length?`<p class="msgr-hint">${esc(st.found?t('noMatch'):t('loading'))}</p>`:''}`;
   return;
  }
  // Team chats and the everyone chat stay on top, then everything else by the newest message.
  const pin=c=>c.kind==='group'&&(c.group.team||c.group.everyone);
  const top=[...items.filter(c=>pin(c)&&c.group.team),...teams,...items.filter(c=>pin(c)&&c.group.everyone)],rest=items.filter(c=>!pin(c));
  box.innerHTML=`${top.map(row).join('')}${rest.length?`<h3 class="msgr-sec">${esc(t('chats'))}</h3>${rest.map(row).join('')}`:`<p class="msgr-hint">${esc(t('none'))}</p>`}`;
 }
 async function refresh(){
  const d=await call('GET','/api/messages').catch(()=>null);if(!st.alive||!d)return;
  st.list=d;setCount(d.unread);paint();
 }
 let seq=0;
 async function find(){
  const q=st.q.trim(),n=++seq;if(!q){st.found=null;paint();return;}
  const d=await call('GET','/api/messages/people?q='+encodeURIComponent(q)).catch(()=>({items:[]}));
  if(n!==seq||!st.alive)return;st.found=d.items;paint();
 }
 input.addEventListener('input',()=>{st.q=input.value;st.found=st.q.trim()?st.found:null;paint();clearTimeout(st.timer);st.timer=setTimeout(find,220);});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();box.querySelector('.msgr-conv')?.click();}else if(e.key==='Escape'&&input.value){e.stopPropagation();input.value='';st.q='';st.found=null;paint();}});
 box.addEventListener('click',async e=>{
  const b=e.target.closest('.msgr-conv');if(!b)return;
  const k=b.dataset.key;
  if(k.startsWith('t/')){b.disabled=true;try{const r=await call('POST','/api/messages/team/'+encodeURIComponent(k.slice(2)));await refresh();open({kind:'group',id:r.id,name:b.querySelector('b')?.textContent});}catch{b.disabled=false;}return;}
  const c=[...(st.list?.items||[]),...(st.found||[]).map(p=>({kind:'dm',person:p}))].find(x=>keyOf(x)===k);
  open(k.startsWith('g/')?{kind:'group',id:k.slice(2),name:c?nameOf(c):''}:{kind:'dm',id:k,name:c?.person?.name||''});
  // A conversation that was unread is read once it opens: its badge goes at once.
  if(c?.unread){c.unread=0;b.classList.remove('is-unread');b.querySelector('.msgr-badge')?.remove();}
 });
 const open=c=>{st.active=(c.kind==='group'?'g/':'')+c.id;box.querySelectorAll('.msgr-conv').forEach(x=>{const on=x.dataset.key===st.active;x.classList.toggle('is-active',on);on?x.setAttribute('aria-current','true'):x.removeAttribute('aria-current');});o.onOpen?.(c);};
 const onNews=()=>{if(el.isConnected)refresh();};
 addEventListener('bird:messages',onNews);addEventListener('bird:msgr-sent',onNews);
 refresh();
 return {stop(){st.alive=false;removeEventListener('bird:messages',onNews);removeEventListener('bird:msgr-sent',onNews);},refresh,setActive(k){st.active=k||'';paint();},focus(){input.focus({preventScroll:true});}};
}

// Inbox and thread in one panel (own office card, office dock) ----------------------------------------------
function panel(el,o={}){
 setLang(o.lang||lang);
 el.innerHTML='<div class="msgr-panel"><div class="msgr-pane-list"></div><div class="msgr-pane-thread" hidden></div></div>';
 const listHost=el.querySelector('.msgr-pane-list'),threadHost=el.querySelector('.msgr-pane-thread');
 let stopThread=null;
 const back=()=>{stopThread?.();stopThread=null;threadHost.hidden=true;threadHost.innerHTML='';listHost.hidden=false;box.refresh();box.setActive('');};
 const box=inbox(listHost,{onOpen:c=>{stopThread?.();listHost.hidden=true;threadHost.hidden=false;stopThread=thread(threadHost,{...c,back,full:'#/account/messages/'+(c.kind==='group'?'g/':'')+c.id});}});
 return ()=>{stopThread?.();box.stop();};
}

// The messages page: list on the left, the conversation on the right; one at a time on a phone ---------------
function app(el,o={}){
 setLang(o.lang||lang);
 const base=o.base||'#/account/messages';
 el.innerHTML=`<div class="msgr-app"><aside class="msgr-side"></aside><div class="msgr-main"><p class="msgr-pick">${esc(t('pick'))}</p></div></div>`;
 const root=el.firstElementChild,main=root.querySelector('.msgr-main');
 let stopThread=null;
 const keyOf=r=>r?.[0]==='g'&&r[1]?'g/'+r[1]:r?.[0]||'';
 function go(route,push){
  stopThread?.();stopThread=null;
  const k=keyOf(route);
  root.classList.toggle('is-thread',!!k);box.setActive(k);
  if(push){const h=base+(k?'/'+k:'');if(location.hash!==h)history.pushState(null,'',h);}
  if(!k){main.innerHTML=`<p class="msgr-pick">${esc(t('pick'))}</p>`;fit();if(!coarse())box.focus();return;}
  stopThread=thread(main,{kind:k.startsWith('g/')?'group':'dm',id:k.startsWith('g/')?k.slice(2):k,name:route.name||'',back:()=>go(null,true)});
  fit();
 }
 const box=inbox(root.querySelector('.msgr-side'),{newGroup:o.newGroup,active:keyOf(o.route),onOpen:c=>go(c.kind==='group'?Object.assign(['g',c.id],{name:c.name}):Object.assign([c.id],{name:c.name}),true)});
 // Desktop: the two columns fill the screen below the page header. Phone: the open conversation covers the screen and
 // follows the visual viewport, so the composer stays right above the keyboard.
 function fit(){
  if(!el.isConnected)return;
  const vv=window.visualViewport;
  if(phone()){root.style.removeProperty('--msgr-h');root.style.setProperty('--msgr-vh',(vv?.height||innerHeight)+'px');root.style.setProperty('--msgr-vt',(vv?.offsetTop||0)+'px');}
  else root.style.setProperty('--msgr-h',Math.max(460,innerHeight-(root.getBoundingClientRect().top+scrollY)-16)+'px');
 }
 addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);
 document.documentElement.classList.add('msgr-page');
 go(o.route?.[0]?o.route:null,false);fit();
 return ()=>{stopThread?.();box.stop();removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('scroll',fit);document.documentElement.classList.remove('msgr-page');};
}

window.BirdMessenger={thread:(el,o={})=>{setLang(o.lang||lang);return thread(el,o);},inbox:(el,o={})=>{setLang(o.lang||lang);return inbox(el,o);},panel,app,
 language:setLang,refreshUnread,get count(){return S.count;},text:t,auth};
})();
