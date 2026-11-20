'use strict';
/* Who am I on this site.
   BirdWhoami.mountAll()            -> the account control in the top-right corner of every header ([data-account-menu]).
                                       Signed out: "Sign in". Signed in: initials and name; a menu with the role, My account, Sign out.
                                       data-account-menu="" links to #/account on the same page, ="/demo" from the landing page.
   BirdWhoami.menu(slot,{lang,fresh}) -> one control (the tests call it directly).
   BirdWhoami.card(box,{personId,lang}) -> on a participant's card: "This is you", or for an organiser "This is me" (links at once)
                                       and "Invite" (a sign-up link with the code); a participant may only ask (a claim).
   BirdWhoami.enhance(root,{lang})  -> fills #/admin/links: participant cards, their emails and the accounts linked to them.
   Not in the demo: there visitors borrow invented accounts, so the cards and the admin screen stay as they are.
   The session cookie lives for the configured number of days, so "Sign in" stays done until "Sign out" on this device. */
(()=>{
const L=(en,hr,ru)=>({en,hr,ru});
const W={
 signIn:L('Sign in','Prijava','Войти'),signOut:L('Sign out','Odjava','Выйти'),leave:L('Leave the demo','Izađi iz dema','Выйти из демо'),
 account:L('My account','Moj račun','Мой аккаунт'),messages:L('Messages','Poruke','Сообщения'),menu:L('Account menu','Izbornik računa','Меню аккаунта'),signedAs:L('Signed in as','Prijavljeni ste kao','Вы вошли как'),
 role_member:L('Participant','Sudionik','Участник'),role_program_admin:L('Programme admin','Administrator programa','Администратор программы'),role_platform_owner:L('Platform owner','Vlasnik platforme','Владелец платформы'),role_demo:L('Demo','Demo','Демо'),
 you:L('This is you','Ovo ste vi','Это вы'),
 meAdmin:L('This is me: link my account','Ovo sam ja: poveži moj račun','Это я: связать мой аккаунт'),
 meAsk:L('This is me','Ovo sam ja','Это я'),
 meConfirm:L('Link your account to {name}? Your role stays as it is.','Povezati vaš račun s likom {name}? Vaša uloga ostaje ista.','Связать ваш аккаунт с карточкой {name}? Ваша роль не изменится.'),
 linked:L('Linked. This card is now you.','Povezano. Ova kartica sada ste vi.','Связано. Теперь эта карточка — вы.'),
 delivered:L('Messages that were waiting: {n}. They are in your inbox.','Poruka koje su čekale: {n}. U vašem su sandučiću.','Сообщений ждало: {n}. Они во входящих.'),
 asked:L('Sent to the organisers. They link the card after checking.','Poslano organizatorima. Povezat će karticu nakon provjere.','Отправлено организаторам. Они свяжут карточку после проверки.'),
 pending:L('Waiting for an organiser to confirm it is you','Čeka da organizator potvrdi da ste to vi','Ждёт, пока организатор подтвердит, что это вы'),
 invite:L('Invite','Pozovi','Пригласить'),inviteNote:L('Send this sign-up link. It works once, for 7 days, and links the new account to this card.','Pošaljite ovu poveznicu za registraciju. Vrijedi jednom, 7 dana, i povezuje novi račun s ovom karticom.','Отправьте эту ссылку для регистрации. Она одноразовая, действует 7 дней и связывает новый аккаунт с этой карточкой.'),
 copy:L('Copy','Kopiraj','Копировать'),copied:L('Copied','Kopirano','Скопировано'),failed:L('Did not work. Try again.','Nije uspjelo. Pokušajte ponovno.','Не получилось. Попробуйте ещё раз.'),
 // Admin: cards and accounts
 lTitle:L('Participant cards and accounts','Kartice sudionika i računi','Карточки участников и аккаунты'),
 lNote:L('Each card on the roster is linked to the account of the person it shows. Add the email the person signs up with, then link. Messages written to the card before that reach them when it is linked.','Svaka kartica na popisu povezuje se s računom osobe koju prikazuje. Upišite e-poštu s kojom se osoba registrira, zatim povežite. Poruke poslane kartici prije toga stižu joj kad se poveže.','Каждая карточка в списке связывается с аккаунтом человека, которого она изображает. Впишите почту, с которой человек регистрируется, и свяжите. Сообщения, отправленные карточке раньше, придут ему после связывания.'),
 lBulk:L('Link all matching by email','Poveži sve s istom e-poštom','Связать всех с совпадающей почтой'),lBulkDone:L('Linked: {n}','Povezano: {n}','Связано: {n}'),
 lSearch:L('Find a name, team, email or login','Traži ime, tim, e-poštu ili korisničko ime','Поиск по имени, команде, почте или логину'),
 lOnlyFree:L('Only cards without an account','Samo kartice bez računa','Только карточки без аккаунта'),
 lEmail:L('Email on the card','E-pošta na kartici','Почта на карточке'),lSave:L('Save','Spremi','Сохранить'),
 lLinkedTo:L('Linked to','Povezano s','Связано с'),lUnlink:L('Unlink','Odspoji','Отвязать'),lUnlinkConfirm:L('Unlink {name} from this account? Their account stays; the card waits for the right person again.','Odspojiti {name} od ovog računa? Račun ostaje, a kartica ponovno čeka pravu osobu.','Отвязать {name} от этого аккаунта? Аккаунт останется, карточка снова будет ждать нужного человека.'),
 lNone:L('No account linked','Nema povezanog računa','Аккаунт не связан'),lByEmail:L('Same email','Ista e-pošta','Та же почта'),lByName:L('Same name (check before linking)','Isto ime (provjerite prije povezivanja)','То же имя (проверьте перед связыванием)'),
 saved:L('Saved','Spremljeno','Сохранено'),lLink:L('Link','Poveži','Связать'),lPick:L('Link to an account…','Poveži s računom…','Связать с аккаунтом…'),lChoose:L('Account','Račun','Аккаунт'),
 lAuto:L('Link automatically by email','Poveži automatski po e-pošti','Связывать автоматически по почте'),
 lAutoNote:L('When someone signs up with an email that is on exactly one card, their account is linked to it at once. Emails are not verified, so keep this off unless you trust the list.','Kad se netko registrira s e-poštom koja je na točno jednoj kartici, račun se odmah poveže s njom. E-pošta se ne provjerava, pa ovo uključite samo ako vjerujete popisu.','Когда кто-то регистрируется с почтой, которая есть ровно на одной карточке, аккаунт сразу связывается с ней. Почта не проверяется, поэтому включайте это, только если доверяете списку.'),
 lEmpty:L('No participant cards yet.','Još nema kartica sudionika.','Карточек участников пока нет.'),lCount:L('{a} of {b} linked','{a} od {b} povezano','Связано {a} из {b}'),
};
let lang='en';
const tr=(k,v={})=>Object.entries(v).reduce((s,[a,b])=>s.replaceAll('{'+a+'}',b),W[k]?.[lang]||W[k]?.en||k);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setLang=l=>{const v=String(l||'').slice(0,2);if(['en','hr','ru'].includes(v))lang=v;};
const initials=name=>String(name||'?').trim().split(/\s+/).map(n=>n[0]||'').slice(0,2).join('').toUpperCase()||'?';
const demoUser=u=>String(u?.id||'').startsWith('demo-user-');
const inDemo=()=>demoUser(state.user)||!!document.body?.classList?.contains('is-demo')||String(location.pathname).startsWith('/demo');

// Who is signed in: one request per page, refreshed when account.js signs someone in or out.
const state={user:undefined,csrf:'',dm:0,p:null};
function load(fresh){
 if(fresh||!state.p)state.p=fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.ok?r.json():{}).catch(()=>({})).then(d=>{state.user=d.user||null;state.csrf=d.csrf||'';state.dm=d.messages||0;return state;});
 return state.p;
}
async function call(method,url,body){
 if(!state.csrf)await load(true);
 const r=await fetch(url,{method,credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':state.csrf},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json().catch(()=>null);
 if(!r.ok)throw Object.assign(Error(data?.error?.code||'FAILED'),{status:r.status});
 return data;
}

// Header control ------------------------------------------------------------------------------
let seq=0;
const href=(slot,h)=>(slot.dataset.accountMenu||'')+h;
async function menu(slot,{lang:l,fresh}={}){
 setLang(l||slot.dataset.lang||document.documentElement?.lang);
 await load(fresh);
 const u=state.user;
 if(!u){slot.innerHTML=`<a class="wm-in" href="${esc(href(slot,'#/account/login'))}"><span class="wm-ini is-out" aria-hidden="true"></span><span>${tr('signIn')}</span></a>`;return;}
 const id='wm-pop-'+(++seq),role=demoUser(u)?tr('role_demo'):tr('role_'+u.role);
 slot.innerHTML=`<div class="wm"><button type="button" class="wm-btn" aria-expanded="false" aria-haspopup="true" aria-controls="${id}" title="${esc(tr('signedAs')+' '+u.displayName)}"><span class="wm-ini" aria-hidden="true">${esc(initials(u.displayName))}</span><b class="wm-dot" data-msgr-count aria-label="${esc(tr('messages'))}" ${state.dm?'':'hidden'}>${state.dm}</b><span class="wm-name">${esc(u.displayName)}</span><span class="wm-sr">, ${esc(tr('menu'))}</span></button>
 <div class="wm-pop" id="${id}" hidden><p class="wm-who"><small>${tr('signedAs')}</small><b>${esc(u.displayName)}</b><span>${esc(role)}${u.login&&!demoUser(u)?' · '+esc(u.login):''}</span></p><a class="wm-item" href="${esc(href(slot,'#/account/messages'))}">${tr('messages')}<b class="wm-count" data-msgr-count ${state.dm?'':'hidden'}>${state.dm}</b></a><a class="wm-item" href="${esc(href(slot,'#/account'))}">${tr('account')}</a><button type="button" class="wm-item" data-wm-out>${tr(demoUser(u)?'leave':'signOut')}</button></div></div>`;
 const btn=slot.querySelector('.wm-btn'),pop=slot.querySelector('.wm-pop');if(!btn||!pop)return;
 // On a phone the button may sit left of the corner: the menu slides back into the screen.
 const show=on=>{pop.hidden=!on;btn.setAttribute('aria-expanded',String(on));pop.style.right='';if(on){const x=pop.getBoundingClientRect().left;if(x<8)pop.style.right=(x-8)+'px';}};
 btn.addEventListener('click',()=>{show(pop.hidden);if(!pop.hidden)pop.querySelector('.wm-item')?.focus();});
 slot.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){show(false);btn.focus();}});
 slot.addEventListener('focusout',e=>{if(!slot.contains(e.relatedTarget))setTimeout(()=>{if(!slot.contains(document.activeElement))show(false);},0);});
 pop.addEventListener('click',e=>{if(e.target.closest('a'))show(false);});
 pop.querySelector('[data-wm-out]').addEventListener('click',signOut);
}
// Ends this device's session on the server (the cookie is cleared too), then starts the page clean.
async function signOut(e){
 const b=e?.currentTarget;if(b)b.disabled=true;
 try{await call('POST','/api/auth/logout',{});}catch{}
 state.user=null;state.csrf='';state.p=Promise.resolve(state);
 window.dispatchEvent(new CustomEvent('bird:auth',{detail:{user:null,csrf:''}}));
 // The demo app would sign a guest straight back in as the invented manager, so a demo goes back to its landing page.
 if(String(location.pathname).startsWith('/demo')){location.href='/';return;}
 if(/^#\/(account|admin)/.test(location.hash))location.hash='#/account/login';
 location.reload();
}
function mountAll(l){document.querySelectorAll('[data-account-menu]').forEach(slot=>menu(slot,{lang:l}));}
// messenger.js polls the unread count and fills every [data-msgr-count]; the next draw starts from it.
window.addEventListener?.('bird:messages',e=>{state.dm=e.detail?.unread||0;});
window.addEventListener?.('bird:auth',e=>{state.user=e.detail?.user||null;state.csrf=e.detail?.csrf||'';state.p=Promise.resolve(state);mountAll();});
document.addEventListener?.('click',e=>{document.querySelectorAll('.wm-pop:not([hidden])').forEach(p=>{const s=p.closest('.wm');if(s&&!s.contains(e.target)){p.hidden=true;s.querySelector('.wm-btn')?.setAttribute('aria-expanded','false');}});});
// The landing page switches language by changing <html lang>; the control follows.
if(typeof MutationObserver!=='undefined'&&document.documentElement)new MutationObserver(()=>mountAll()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

// A participant's card ---------------------------------------------------------------------------
async function card(box,{personId,lang:l}={}){
 setLang(l);if(!box||!personId||box.querySelector('.wm-card'))return null;
 await load();if(!state.user||inDemo())return null;
 const holder=document.createElement('div');holder.className='wm-card';holder.dataset.person=personId;box.append(holder);
 const r=await fetch('/api/people/'+encodeURIComponent(personId)+'/status',{credentials:'same-origin'}).catch(()=>null);
 if(!r?.ok||!holder.isConnected){holder.remove();return null;}
 const s=await r.json(),name=box.closest('[aria-label]')?.getAttribute('aria-label')||box.closest('.ps')?.querySelector('h2')?.textContent||'';
 const note=(text,err)=>{let p=holder.querySelector('.wm-note');if(!p){p=document.createElement('p');p.className='wm-note';p.setAttribute('role','status');holder.append(p);}p.textContent=text;p.classList.toggle('is-error',!!err);};
 const draw=()=>{
  holder.innerHTML=s.mine?`<span class="wm-you">${tr('you')}</span>`
   :`${!s.linked&&s.canClaim?(s.direct?`<button type="button" class="wm-act is-main" data-wm="self">${tr('meAdmin')}</button>`:s.pending?`<span class="wm-you is-wait">${tr('pending')}</span>`:`<button type="button" class="wm-act" data-wm="claim">${tr('meAsk')}</button>`):''}${!s.linked&&s.direct?`<button type="button" class="wm-act" data-wm="invite">${tr('invite')}</button>`:''}`;
 };
 draw();
 holder.addEventListener('click',async e=>{
  const b=e.target.closest('[data-wm]');if(!b)return;const what=b.dataset.wm;
  if(what==='copy'){const input=holder.querySelector('.wm-link');try{await navigator.clipboard.writeText(input.value);b.textContent=tr('copied');}catch{input.select();}return;}
  if(what==='self'&&!window.confirm(tr('meConfirm',{name:name||'?'})))return;
  b.disabled=true;
  try{
   if(what==='self'){const d=await call('POST','/api/people/'+encodeURIComponent(personId)+'/link-self');s.mine=true;s.linked=true;draw();note(tr('linked')+(d.delivered?' '+tr('delivered',{n:d.delivered}):''));
    // The write link and the person's name on the card belong to someone else now: let the page redraw them.
    box.querySelectorAll('.office-dm').forEach(a=>a.remove());window.dispatchEvent(new CustomEvent('bird:linked',{detail:{personId}}));}
   else if(what==='claim'){await call('POST','/api/people/claims',{personId});s.pending=true;draw();note(tr('asked'));}
   else if(what==='invite'){const d=await call('POST','/api/invites',{kind:'person',personId});
    const link=location.origin+location.pathname+'#/account/register?invite='+encodeURIComponent(d.code);
    b.remove();holder.insertAdjacentHTML('beforeend',`<div class="wm-invite"><p>${tr('inviteNote')}</p><span><input class="wm-link" readonly value="${esc(link)}" aria-label="${esc(tr('invite'))}"><button type="button" class="wm-act" data-wm="copy">${tr('copy')}</button></span></div>`);}
  }catch{b.disabled=false;note(tr('failed'),true);}
 });
 return s;
}

// Admin: participant cards and the accounts linked to them ---------------------------------------
const ui={q:'',free:false};
async function adminLinks(el,refresh){
 let d,auto={on:false};try{[d,auto]=await Promise.all([call('GET','/api/admin/links'),call('GET','/api/admin/links/auto').catch(()=>({on:false}))]);}catch{el.innerHTML=`<p class="acc-flash is-error">${tr('failed')}</p>`;return;}
 const rows=d.items,linked=rows.filter(r=>r.linked).length,byMail=rows.filter(r=>r.match?.by==='email').length;
 const q=ui.q.trim().toLowerCase(),shown=rows.filter(r=>(!ui.free||!r.linked)&&(!q||[r.name,r.team,r.email,r.linked?.login,r.linked?.name,r.linked?.email].join(' ').toLowerCase().includes(q)));
 const acc=a=>`<b>${esc(a.name)}</b> <small>${esc(a.login)}${a.email?' · '+esc(a.email):''}</small>`;
 const options=d.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)} (${esc(a.login)}${a.email?', '+esc(a.email):''})</option>`).join('');
 el.innerHTML=`<section class="acc-card wl"><h2>${tr('lTitle')}</h2><p class="acc-muted">${tr('lNote')}</p>
 <div class="wl-bar"><span class="wl-count">${tr('lCount',{a:linked,b:rows.length})}</span><button type="button" class="acc-primary" data-wl="bulk" ${byMail?'':'disabled'}>${tr('lBulk')} (${byMail})</button></div>
 <div class="wl-bar"><label class="wl-free wl-auto"><input type="checkbox" data-wl-auto ${auto.on?'checked':''}> ${tr('lAuto')}</label><small class="acc-muted">${tr('lAutoNote')}</small></div>
 <div class="wl-bar"><label class="acc-field wl-q"><span>${tr('lSearch')}</span><input type="search" data-wl-q value="${esc(ui.q)}" maxlength="80"></label><label class="wl-free"><input type="checkbox" data-wl-free ${ui.free?'checked':''}> ${tr('lOnlyFree')}</label></div>
 <p class="wl-flash" role="status" hidden></p>
 ${rows.length?`<ul class="wl-list">${shown.map(r=>`<li class="wl-row ${r.linked?'is-linked':''}" data-id="${esc(r.id)}">
  <div class="wl-who"><b>${esc(r.name)}</b>${r.team?`<small>${esc(r.team)}</small>`:''}</div>
  <form class="wl-email" data-wl-email><label><span>${tr('lEmail')}</span><input type="email" name="email" value="${esc(r.email)}" maxlength="200" autocomplete="off"></label><button class="acc-secondary">${tr('lSave')}</button></form>
  <div class="wl-acc">${r.linked?`<p><span class="wl-tag is-ok">${tr('lLinkedTo')}</span> ${acc(r.linked)}</p><button type="button" class="acc-secondary" data-wl="unlink">${tr('lUnlink')}</button>`
   :`${r.match?`<p><span class="wl-tag ${r.match.by==='email'?'is-ok':'is-watch'}">${tr(r.match.by==='email'?'lByEmail':'lByName')}</span> ${acc(r.match)}</p><button type="button" class="acc-primary" data-wl="link" data-user="${esc(r.match.id)}">${tr('lLink')}</button>`:`<p class="acc-muted">${tr('lNone')}</p>`}
    ${d.accounts.length?`<details class="wl-pick"><summary>${tr('lPick')}</summary><form data-wl-link><label class="acc-field"><span>${tr('lChoose')}</span><select name="userId">${options}</select></label><button class="acc-secondary">${tr('lLink')}</button></form></details>`:''}`}</div></li>`).join('')}</ul>`:`<p class="acc-muted">${tr('lEmpty')}</p>`}</section>`;
 const flash=(t,err)=>{const p=el.querySelector('.wl-flash');p.hidden=false;p.textContent=t;p.classList.toggle('is-error',!!err);};
 const again=async msg=>{await adminLinks(el,refresh);if(msg)flash(msg);};
 const act=async(fn,msg)=>{try{const r=await fn();await again(typeof msg==='function'?msg(r):msg);}catch(e){flash(tr('failed')+(e.message&&e.message!=='FAILED'?' ('+e.message+')':''),true);}};
 const rowOf=n=>n.closest('[data-id]'),nameOf=n=>rowOf(n)?.querySelector('.wl-who b')?.textContent||'';
 el.querySelector('[data-wl-q]')?.addEventListener('input',e=>{ui.q=e.target.value;clearTimeout(el._t);el._t=setTimeout(async()=>{const at=e.target.selectionStart;await adminLinks(el,refresh);const i=el.querySelector('[data-wl-q]');i?.focus();i?.setSelectionRange(at,at);},250);});
 el.querySelector('[data-wl-auto]')?.addEventListener('change',e=>{const on=e.target.checked;e.target.disabled=true;act(()=>call('PUT','/api/admin/links/auto',{on}),tr('saved'));});
 el.querySelector('[data-wl-free]')?.addEventListener('change',e=>{ui.free=e.target.checked;adminLinks(el,refresh);});
 el.querySelectorAll('[data-wl]').forEach(b=>b.addEventListener('click',()=>{
  const id=rowOf(b)?.dataset.id;b.disabled=true;
  if(b.dataset.wl==='bulk')act(()=>call('POST','/api/admin/links/by-email'),r=>tr('lBulkDone',{n:r.linked.length}));
  else if(b.dataset.wl==='link')act(()=>call('POST','/api/admin/people/'+encodeURIComponent(id)+'/link',{userId:b.dataset.user}),tr('linked'));
  else if(b.dataset.wl==='unlink'){if(!window.confirm(tr('lUnlinkConfirm',{name:nameOf(b)}))){b.disabled=false;return;}act(()=>call('POST','/api/admin/people/'+encodeURIComponent(id)+'/unlink'));}
 }));
 el.querySelectorAll('form[data-wl-email]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();act(()=>call('PUT','/api/admin/people/'+encodeURIComponent(rowOf(f).dataset.id)+'/email',{email:f.elements.email.value.trim()}),tr('saved'));}));
 el.querySelectorAll('form[data-wl-link]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();act(()=>call('POST','/api/admin/people/'+encodeURIComponent(rowOf(f).dataset.id)+'/link',{userId:f.elements.userId.value}),tr('linked'));}));
}
function enhance(root,{lang:l,csrf,refresh}={}){
 setLang(l);if(csrf)state.csrf=csrf;
 const slot=root?.querySelector('[data-admin-links]');if(slot&&!slot.childElementCount)adminLinks(slot,refresh);
}

window.BirdWhoami={menu,mountAll,card,enhance,signOut,text:tr};
// The landing page has no shell script of its own to call this (.top: its old header; .sm: the shared site menu, server/site.mjs).
if(document.querySelector?.('.top [data-account-menu],.sm [data-account-menu]'))mountAll();
})();
