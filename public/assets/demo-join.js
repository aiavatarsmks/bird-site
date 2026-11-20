'use strict';
/* Demo only: "Join as yourself" (#/join). The visitor draws a character from parts, types a name and picks or names
   a team; the server (server/demo-join.mjs) makes them a participant and they walk into the office.
   The same page edits the character later. Loaded by workspace.js in a demo workspace only.

   BirdDemoJoin.mount(main,{lang,mine,onDone})   mine: the visitor's saved character (edit mode) or null
   BirdDemoJoin.accountLink(me,lang)             link for the account's character page, for a self-made visitor */
(()=>{
const K=window.BirdCharacterKit;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const l=(en,hr,ru)=>({en,hr,ru});
const T={
 title:l('Join as yourself','Uđi sa svojim likom','Войти как вы'),
 editTitle:l('Your character','Vaš lik','Ваш персонаж'),
 lead:l('Make your character, name it and pick a team. It takes under a minute, and it stays only for this visit.','Složite svoj lik, dajte mu ime i odaberite tim. Treba manje od minute, a lik ostaje samo tijekom ovog posjeta.','Соберите персонажа, назовите его и выберите команду. Это меньше минуты, и всё останется только на время визита.'),
 step1:l('Character','Lik','Персонаж'),step2:l('Name and team','Ime i tim','Имя и команда'),
 body:l('Body','Tijelo','Фигура'),f:l('Female','Žensko','Женская'),m:l('Male','Muško','Мужская'),
 hair:l('Hair','Kosa','Волосы'),short:l('Short','Kratka','Короткие'),bob:l('Bob','Bob','Каре'),long:l('Long','Duga','Длинные'),bun:l('Bun','Punđa','Пучок'),
 hairColour:l('Hair colour','Boja kose','Цвет волос'),face:l('Face','Lice','Лицо'),calm:l('Calm','Mirno','Спокойное'),smile:l('Smiling','Nasmijano','Улыбка'),serious:l('Focused','Ozbiljno','Серьёзное'),bright:l('Bright','Vedro','Открытое'),
 extras:l('Extras','Dodaci','Детали'),moustache:l('Moustache','Brkovi','Усы'),beard:l('Beard','Brada','Борода'),glasses:l('Glasses','Naočale','Очки'),
 skin:l('Skin','Koža','Кожа'),top:l('Top','Gornji dio','Верх'),tee:l('T\u2011shirt','Majica','Футболка'),shirt:l('Shirt','Košulja','Рубашка'),hoodie:l('Hoodie','Dukserica','Худи'),jacket:l('Jacket','Jakna','Пиджак'),
 topColour:l('Top colour','Boja gornjeg dijela','Цвет верха'),bottomColour:l('Trousers','Hlače','Брюки'),
 shuffle:l('Surprise me','Iznenadi me','Случайно'),next:l('Next: name and team','Dalje: ime i tim','Дальше: имя и команда'),back:l('Back to the character','Natrag na lik','Назад к персонажу'),
 name:l('Your name in the office','Vaše ime u uredu','Ваше имя в офисе'),namePh:l('e.g. Ana K.','npr. Ana K.','например, Анна К.'),
 team:l('Team','Tim','Команда'),pick:l('Join a team','Pridruži se timu','Присоединиться к команде'),newTeam:l('New team…','Novi tim…','Новая команда…'),
 teamName:l('Name of the new team','Naziv novog tima','Название новой команды'),teamPh:l('e.g. Sunny Farms','npr. Sunčana farma','например, Солнечная ферма'),
 exists:l('This team is already in the office.','Ovaj je tim već u uredu.','Такая команда уже есть в офисе.'),joinIt:l('Join {team}?','Pridružiti se timu {team}?','Присоединиться к {team}?'),
 people:l('{n} in the team','{n} u timu','{n} в команде'),full:l('The office has no free team places left: join one of the teams.','U uredu nema slobodnih mjesta za nove timove: pridružite se nekom od postojećih timova.','В офисе не осталось мест для новых команд: присоединитесь к одной из них.'),
 go:l('Enter the office','Uđi u ured','Войти в офис'),save:l('Save','Spremi','Сохранить'),saved:l('Saved. Your character is updated in the office.','Spremljeno. Vaš je lik ažuriran u uredu.','Сохранено. Персонаж обновлён в офисе.'),
 yourTeam:l('Your team','Vaš tim','Ваша команда'),toOffice:l('See it in the office','Pogledaj u uredu','Посмотреть в офисе'),
 note:l('Demo: your character, name and team stay for this visit only and are removed afterwards.','Demo: lik, ime i tim ostaju samo za ovaj posjet i zatim se brišu.','Демо: персонаж, имя и команда живут только во время визита, потом удаляются.'),
 e_INVALID_FIELDS:l('Check the name and the team name.','Provjerite ime i naziv tima.','Проверьте имя и название команды.'),e_TEAMS_FULL:l('The office has no free team places left: join one of the teams.','U uredu nema slobodnih mjesta za nove timove: pridružite se nekom od postojećih timova.','В офисе не осталось мест для новых команд: присоединитесь к одной из них.'),
 e_DEMO_FULL:l('The demo office is full right now. Try again in a few hours.','Demo ured trenutno je pun. Pokušajte ponovno za nekoliko sati.','Демо-офис сейчас заполнен. Попробуйте через несколько часов.'),e_RATE_LIMITED:l('Too many attempts. Wait a little and try again.','Previše pokušaja. Pričekajte malo pa pokušajte ponovno.','Слишком много попыток. Подождите немного.'),
 e_other:l('Could not save. Reload the page and try again.','Spremanje nije uspjelo. Osvježite stranicu i pokušajte ponovno.','Не сохранилось. Обновите страницу и попробуйте снова.'),
 editLink:l('Change your character','Promijeni lik','Изменить персонажа'),
 colours:{black:l('black','crna','чёрный'),brown:l('brown','smeđa','каштановый'),auburn:l('auburn','riđa','рыжий'),blonde:l('blonde','plava','светлый'),grey:l('grey','sijeda','седой'),
  s1:l('skin tone 1','ton kože 1','тон кожи 1'),s2:l('skin tone 2','ton kože 2','тон кожи 2'),s3:l('skin tone 3','ton kože 3','тон кожи 3'),s4:l('skin tone 4','ton kože 4','тон кожи 4'),s5:l('skin tone 5','ton kože 5','тон кожи 5'),
  green:l('green','zelena','зелёный'),orange:l('orange','narančasta','оранжевый'),blue:l('blue','plava','синий'),red:l('red','crvena','красный'),mustard:l('mustard','senf','горчичный'),charcoal:l('charcoal','tamnosiva','графит'),
  denim:l('denim','traper','джинса'),khaki:l('khaki','kaki','хаки')},
};
let lang='en';
const t=(k,vars={})=>{const v=(T[k]?.[lang]??T[k]?.en??k);return v.replace(/\{(\w+)\}/g,(_,n)=>vars[n]??'');};
const colourName=(k,v)=>T.colours[v]?.[lang]||(k==='bottomColour'&&v==='grey'?T.colours.grey[lang]:v);

// Drawing: the kit gives RGBA pixels; a canvas shows them at 1× and CSS scales them up sharp.
function paint(canvas,spec,pose,crop){
 const f=K.frame(spec,pose),[x,y,w,h]=crop||[0,0,f.w,f.h];
 canvas.width=w;canvas.height=h;
 const img=new ImageData(w,h);for(let r=0;r<h;r++)img.data.set(f.rgba.subarray(((y+r)*f.w+x)*4,((y+r)*f.w+x+w)*4),r*w*4);
 canvas.getContext('2d').putImageData(img,0,0);
}
const CROP={hair:[32,0,32,34],face:[36,10,24,22],top:[30,30,36,30]};
const PICTURED=new Set(['hair','face','top']);

async function api(method,url,body,csrf){
 const r=await fetch(url,{method,credentials:'same-origin',headers:{'content-type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){const e=Error(data.error?.code||String(r.status));e.code=data.error?.code;e.detail=data.error?.detail;throw e;}
 return data;
}

function mount(main,{lang:language='en',mine=null,csrf='',onDone}={}){
 lang=language;
 let spec={...(mine?.character||K.DEFAULT)},step=1,teams=[],canCreate=true,choice='',newName='',name=mine?.name||'',busy=false,error='',match=null,stop=()=>{};
 const edit=!!mine;
 const option=(k,v)=>{
  const on=spec[k]===v;
  if(K.COLOURS[k])return `<button type="button" class="dj-swatch" data-k="${k}" data-v="${v}" aria-pressed="${on}" aria-label="${esc(colourName(k,v))}" title="${esc(colourName(k,v))}"><span style="background:${K.COLOURS[k][v]}"></span></button>`;
  return `<button type="button" class="dj-opt" data-k="${k}" data-v="${v}" aria-pressed="${on}">${PICTURED.has(k)?`<canvas class="dj-thumb" data-thumb="${k}:${v}" aria-hidden="true"></canvas>`:''}<span>${esc(t(v))}</span></button>`;
 };
 const row=(k,label)=>`<fieldset class="dj-row"><legend>${esc(t(label||k))}</legend><div class="dj-opts ${K.COLOURS[k]?'is-swatches':''}">${K.PARTS[k].map(v=>option(k,v)).join('')}</div></fieldset>`;
 function builder(){
  return `${row('body')}${row('hair')}${row('hairColour')}${row('face')}
  <fieldset class="dj-row"><legend>${esc(t('extras'))}</legend><div class="dj-opts is-three">${K.TOGGLES.map(k=>`<button type="button" class="dj-opt dj-toggle" data-toggle="${k}" aria-pressed="${spec[k]}"><span>${esc(t(k))}</span></button>`).join('')}</div></fieldset>
  ${row('skin')}${row('top')}${row('topColour')}${row('bottomColour')}`;
 }
 function teamStep(){
  const opts=teams.map(x=>`<option value="${esc(x.id)}" ${choice===x.id?'selected':''}>${esc(x.name)} · ${esc(t('people',{n:x.members}))}</option>`).join('');
  return `<label class="dj-field"><span>${esc(t('name'))}</span><input name="name" maxlength="40" autocomplete="nickname" required placeholder="${esc(t('namePh'))}" value="${esc(name)}"></label>
  ${edit?`<p class="dj-team-now"><span>${esc(t('yourTeam'))}</span> <b>${esc(mine.team?.name||'')}</b></p>`:`<label class="dj-field"><span>${esc(t('team'))}</span><select name="team"><option value="" disabled ${choice?'':'selected'}>${esc(t('pick'))}</option>${opts}${canCreate?`<option value="new" ${choice==='new'?'selected':''}>${esc(t('newTeam'))}</option>`:''}</select></label>
  ${choice==='new'?`<label class="dj-field"><span>${esc(t('teamName'))}</span><input name="teamName" maxlength="40" placeholder="${esc(t('teamPh'))}" value="${esc(newName)}"></label>`:''}
  <div class="dj-match" aria-live="polite">${matchHtml()}</div>
  ${canCreate?'':`<p class="dj-hint">${esc(t('full'))}</p>`}`}`;
 }
 function render(){
  stop();
  main.innerHTML=`<section class="acc dj" aria-labelledby="dj-title">
   <header class="dj-head"><h1 id="dj-title">${esc(t(edit?'editTitle':'title'))}</h1>${edit?'':`<p>${esc(t('lead'))}</p><ol class="dj-steps"><li ${step===1?'aria-current="step"':''}>1 · ${esc(t('step1'))}</li><li ${step===2?'aria-current="step"':''}>2 · ${esc(t('step2'))}</li></ol>`}</header>
   <div class="dj-body">
    <div class="dj-stage"><canvas class="dj-preview" width="96" height="88" role="img" aria-label="${esc(t('step1'))}"></canvas>${step===1?`<button type="button" class="dj-shuffle" data-shuffle>${esc(t('shuffle'))}</button>`:''}</div>
    <form class="dj-panel" novalidate>
     ${step===1||edit?builder():''}${step===2||edit?teamStep():''}
     ${error?`<p class="acc-flash is-error" role="alert">${esc(error)}</p>`:''}
     <div class="dj-actions">${edit?`<button class="acc-primary" ${ready()?'':'disabled'}>${esc(t('save'))}</button><a class="acc-secondary" href="#/office">${esc(t('toOffice'))} →</a>`
      :step===1?`<button type="button" class="acc-primary" data-next>${esc(t('next'))} →</button>`
      :`<button type="button" class="acc-secondary" data-back>← ${esc(t('back'))}</button><button class="acc-primary" ${ready()?'':'disabled'}>${esc(t('go'))} →</button>`}</div>
     <p class="dj-note">${esc(t('note'))}</p>
    </form>
   </div></section>`;
  for(const c of main.querySelectorAll('[data-thumb]')){const [k,v]=c.dataset.thumb.split(':');paint(c,{...spec,[k]:v,...(k==='hair'?{beard:false,moustache:false}:{})},'stand',CROP[k]);}
  stop=animate(main.querySelector('.dj-preview'));
  bind();
 }
 // The preview stands, waves now and then and looks aside, like the characters in the office.
 function animate(canvas){
  const poses=['stand','stand','wave','stand','look'],quiet=matchMedia('(prefers-reduced-motion: reduce)').matches;let i=0;
  paint(canvas,spec,'stand');if(quiet)return ()=>{};
  const timer=setInterval(()=>{i=(i+1)%poses.length;paint(canvas,spec,poses[i]);},900);
  return ()=>clearInterval(timer);
 }
 function update(){
  // Re-render keeps the focus on the control that was used.
  const active=document.activeElement,key=active?.dataset?.k?`[data-k="${active.dataset.k}"][data-v="${active.dataset.v}"]`:active?.dataset?.toggle?`[data-toggle="${active.dataset.toggle}"]`:active?.name?`[name="${active.name}"]`:null;
  const pos=active?.selectionStart;
  render();
  const el=key&&main.querySelector(key);if(el){el.focus({preventScroll:true});if(pos!=null&&el.setSelectionRange)try{el.setSelectionRange(pos,pos);}catch{}}
 }
 const ready=()=>!busy&&name.trim()&&(edit||(choice&&(choice!=='new'||K.teamKey(newName).length>=2)&&!match));
 const matchHtml=()=>match?`<p>${esc(t('exists'))}</p><button type="button" class="acc-secondary" data-join-match="${esc(match.id)}">${esc(t('joinIt',{team:match.name}))}</button>`:'';
 // Typing keeps the field as it is (a phone keeps its keyboard): only the button and the team offer change.
 function sync(){const b=main.querySelector('form button.acc-primary');if(b)b.disabled=!ready();const m=main.querySelector('.dj-match');if(m&&m.dataset.for!==(match?.id||'')){m.dataset.for=match?.id||'';m.innerHTML=matchHtml();bindMatch();}}
 function bindMatch(){main.querySelector('[data-join-match]')?.addEventListener('click',e=>{choice=e.currentTarget.dataset.joinMatch;newName='';match=null;render();main.querySelector('[name="team"]')?.focus();});}
 function checkMatch(){
  const key=K.teamKey(newName);
  match=choice==='new'&&key.length>=2?teams.find(x=>K.teamKey(x.name)===key)||null:null;
 }
 function bind(){
  main.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>{spec={...spec,[b.dataset.k]:b.dataset.v};update();}));
  main.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>{spec={...spec,[b.dataset.toggle]:!spec[b.dataset.toggle]};update();}));
  main.querySelector('[data-shuffle]')?.addEventListener('click',()=>{const pick=a=>a[Math.floor(Math.random()*a.length)];spec=Object.fromEntries([...Object.entries(K.PARTS).map(([k,a])=>[k,pick(a)]),...K.TOGGLES.map(k=>[k,Math.random()<(k==='glasses'?.3:.2)])]);render();});
  main.querySelector('[data-next]')?.addEventListener('click',()=>{step=2;render();main.querySelector('[name="name"]')?.focus();main.scrollIntoView({block:'start'});});
  main.querySelector('[data-back]')?.addEventListener('click',()=>{step=1;render();});
  const nameInput=main.querySelector('[name="name"]');nameInput?.addEventListener('input',()=>{name=nameInput.value;sync();});
  const team=main.querySelector('[name="team"]');team?.addEventListener('change',()=>{choice=team.value;checkMatch();update();if(choice==='new')main.querySelector('[name="teamName"]')?.focus();});
  const teamName=main.querySelector('[name="teamName"]');teamName?.addEventListener('input',()=>{newName=teamName.value;checkMatch();sync();});
  bindMatch();
  main.querySelector('form')?.addEventListener('submit',async e=>{
   e.preventDefault();if(busy)return;busy=true;error='';
   try{
    if(edit){await api('PUT','/api/demo/me',{character:spec,name},csrf);busy=false;error='';render();main.querySelector('.dj-actions')?.insertAdjacentHTML('beforebegin',`<p class="acc-flash" role="status">${esc(t('saved'))}</p>`);return;}
    await api('POST','/api/demo/join',{character:spec,name,...(choice==='new'?{teamName:newName}:{teamId:choice})},csrf);
    onDone?.();
   }catch(err){
    busy=false;
    if(err.code==='TEAM_EXISTS'&&err.detail){teams=teams.some(x=>x.id===err.detail.id)?teams:[...teams,{...err.detail,members:1}];match=err.detail;render();return;}
    if(err.code==='TEAMS_FULL'){canCreate=false;choice='';}
    error=t('e_'+(T['e_'+err.code]?err.code:'other'));render();
   }
  });
 }
 render();
 if(!edit)api('GET','/api/demo/teams').then(d=>{teams=d.items;canCreate=d.canCreate;if(step===2)update();}).catch(()=>{});
 return ()=>stop();
}
function accountLink(me,language){
 if(!String(me?.id||'').startsWith('demo-user-v-'))return '';
 lang=language||lang;
 return `<a class="acc-secondary dj-edit-link" href="#/join">${esc(t('editLink'))} →</a>`;
}
window.BirdDemoJoin={mount,accountLink,text:(k,language)=>{lang=language||lang;return t(k);}};
})();
