/** Chat beside the office: one conversation per person, and the map stays in view. */
(function(){
 const TEXT={
  en:{placeholder:'Message…',send:'Send',empty:'No messages yet.',waiting:'has not registered yet. Your messages will be waiting for them.',closed:'You cannot write to this person.',failed:'Could not send. Try again.',all:'All messages',close:'Close chat',signIn:'Sign in to write'},
  hr:{placeholder:'Poruka…',send:'Pošalji',empty:'Još nema poruka.',waiting:'još nema račun. Poruke će ih čekati.',closed:'Ovoj osobi ne možete pisati.',failed:'Nije poslano. Pokušajte ponovno.',all:'Sve poruke',close:'Zatvori razgovor',signIn:'Prijavite se da biste pisali'},
  ru:{placeholder:'Сообщение…',send:'Отправить',empty:'Сообщений пока нет.',waiting:'ещё не зарегистрирован(а). Сообщения будут ждать.',closed:'Этому человеку написать нельзя.',failed:'Не отправлено. Попробуйте ещё раз.',all:'Все сообщения',close:'Закрыть чат',signIn:'Войдите, чтобы написать'},
 };
 const drafts=new Map();
 let panel=null,current=null,timer=0,csrf='',shown='',lang='en',failed=false;
 const tr=key=>(TEXT[lang]||TEXT.en)[key];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const time=iso=>new Date(iso).toLocaleString(lang,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

 function build(){
  panel=el('section','office-chat');panel.setAttribute('aria-live','polite');
  const head=el('header'),title=el('h3','office-chat-name'),all=el('a','office-chat-all'),close=el('button','','×');
  close.type='button';close.addEventListener('click',shut);
  head.append(title,all,close);
  const form=el('form'),input=el('textarea'),send=el('button');
  input.rows=2;input.maxLength=2000;send.type='submit';
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}else if(e.key==='Escape'){e.stopPropagation();shut();}});
  input.addEventListener('input',()=>{if(current)drafts.set(current.id,input.value);});
  form.addEventListener('submit',e=>{e.preventDefault();post();});
  form.append(input,send);
  panel.append(head,el('p','office-chat-note'),el('div','office-chat-list'),form);
  document.body.append(panel);
 }
 function label(){
  panel.querySelector('.office-chat-name').textContent=current.name;
  const all=panel.querySelector('.office-chat-all');all.href='#/account/messages/'+encodeURIComponent(current.id);all.textContent=tr('all');
  panel.querySelector('header button').setAttribute('aria-label',tr('close'));
  const input=panel.querySelector('textarea');input.placeholder=tr('placeholder');input.setAttribute('aria-label',tr('placeholder'));
  panel.querySelector('form button').textContent=tr('send');
 }
 function note(text,error){const n=panel.querySelector('.office-chat-note');n.textContent=text||'';n.hidden=!text;n.classList.toggle('is-error',!!error);}

 async function load(){
  if(!current||document.hidden)return;
  const id=current.id,r=await fetch('/api/messages/with/'+encodeURIComponent(id),{credentials:'same-origin'}).catch(()=>null);
  if(!panel||current?.id!==id)return;
  const form=panel.querySelector('form'),list=panel.querySelector('.office-chat-list');
  if(!r?.ok){form.hidden=true;list.replaceChildren();note(r?.status===401?tr('signIn'):tr('closed'),true);return;}
  const data=await r.json();
  if(data.person?.name&&data.person.name!==current.name){current.name=data.person.name;label();}
  form.hidden=!data.canSend;
  if(!failed)note(data.waiting?current.name+' '+tr('waiting'):data.canSend?'':tr('closed'));
  // Redraw only when something changed, so a half-read conversation does not jump.
  const key=id+':'+data.items.map(m=>m.id+(m.read?'r':'')).join(',');
  if(key===shown)return;shown=key;
  list.replaceChildren(...(data.items.length?data.items.map(m=>{
   const row=el('div','office-chat-msg'+(m.mine?' is-mine':''));
   if(m.body)row.append(el('p','',m.body));
   if(m.file)row.append(el('p','office-chat-file','📎 '+(m.file.filename||m.file.name||'')));
   row.append(el('small','',time(m.created)));
   return row;
  }):[el('p','office-chat-empty',tr('empty'))]));
  list.scrollTop=list.scrollHeight;
 }
 async function post(){
  const input=panel.querySelector('textarea'),body=input.value.trim(),id=current?.id;if(!body||!id)return;
  const button=panel.querySelector('form button');button.disabled=true;
  try{
   if(!csrf)csrf=(await (await fetch('/api/auth/me',{credentials:'same-origin'})).json()).csrf||'';
   const r=await fetch('/api/messages/with/'+encodeURIComponent(id),{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({body})});
   if(!r.ok)throw Error('send');
   failed=false;if(current?.id===id){input.value='';note('');}
   drafts.delete(id);await load();
  }catch{failed=true;if(panel)note(tr('failed'),true);}
  finally{if(panel){button.disabled=false;input.focus();}}
 }
 function open({id,name,language}){
  if(!id)return;
  lang=language||lang;if(!panel)build();
  current={id,name:name||''};shown='';failed=false;label();note('');
  const input=panel.querySelector('textarea');input.value=drafts.get(id)||'';
  panel.querySelector('.office-chat-list').replaceChildren();
  clearInterval(timer);timer=setInterval(load,5000);
  load();input.focus();
 }
 function shut(){clearInterval(timer);timer=0;panel?.remove();panel=null;current=null;shown='';}
 // The chat belongs to the office: leaving the office closes it.
 addEventListener('hashchange',()=>{if(panel&&!location.hash.startsWith('#/office'))shut();});
 document.addEventListener('visibilitychange',()=>{if(panel&&!document.hidden)load();});
 window.BirdOfficeChat={open,close:shut,get openFor(){return current?.id||null;}};
})();
