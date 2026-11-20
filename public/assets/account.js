/* Accounts, project cabinet, tasks and admin. Plain HTML forms; the server checks every permission. */
(()=>{'use strict';
const T=window.BIRD_ACCOUNT_TEXT;
let lang='en',root=null,me,csrf='',flash=null,cache={},renderToken=0;
const tr=k=>T[k]?.[lang]??T[k]?.en??k;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc={en:'en-GB',hr:'hr-HR',ru:'ru-RU'};
const date=(iso,time=false)=>iso?new Intl.DateTimeFormat(loc[lang],{day:'numeric',month:'short',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit'}:{}),timeZone:'Europe/Zagreb'}).format(new Date(iso.length===10?iso+'T12:00:00Z':iso)):'';
const size=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const pick=o=>o?.[lang]||o?.en||o?.hr||o?.ru||'';
// WhatsApp cannot be connected cheaply, so organisers post a ready text with a link back to the platform.
const siteLink=hash=>location.origin+location.pathname+hash;
const waLink=text=>`<a class="acc-secondary acc-wa" href="https://wa.me/?text=${encodeURIComponent(text.slice(0,1800))}" target="_blank" rel="noopener noreferrer">${tr('waShare')}</a>`;
const seen=iso=>iso?`${tr('lastSeen')}: ${date(iso,true)}`:tr('neverSeen');
const idle=iso=>!iso||Date.now()-Date.parse(iso)>7*86400000;
// Authored task text falls back to whichever language the organiser wrote (EN, then HR, then RU) with a visible marker.
const authored=(t,field)=>{const own=t?.[lang]?.[field];if(own)return esc(own);const l=['en','hr','ru'].find(x=>t?.[x]?.[field]);return l?`<span lang="${l}">${esc(t[l][field])}</span> <small class="acc-lang">${l.toUpperCase()}</small>`:'';};
const taskText=(t,field='title')=>[lang,'en','hr','ru'].map(l=>t?.[l]?.[field]).find(Boolean)||'';
const localInput=iso=>{if(!iso)return '';const d=new Date(iso);return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const percent=n=>n===null||n===undefined?'—':n+'%';
const idem=()=>crypto.randomUUID().replace(/-/g,'');
const isAdmin=()=>me&&['program_admin','platform_owner'].includes(me.role);

class ApiError extends Error{constructor(code,detail,status){super(code);this.code=code;this.detail=detail;this.status=status;}}
async function api(method,path,body,{key,headers={},raw}={}){
 const h={...headers};if(method!=='GET'&&csrf)h['X-CSRF-Token']=csrf;if(key)h['Idempotency-Key']=key;
 let payload;if(raw){payload=raw;}else if(body!==undefined){h['Content-Type']='application/json';payload=JSON.stringify(body);}
 let res;try{res=await fetch(path,{method,headers:h,body:payload,credentials:'same-origin'});}catch{throw new ApiError('NETWORK');}
 const data=(res.headers.get('content-type')||'').includes('json')?await res.json():null;
 if(data?.csrf)csrf=data.csrf;
 if(!res.ok){if(res.status===401&&me){me=null;}throw new ApiError(data?.error?.code||'SERVER_ERROR',data?.error?.detail,res.status);}
 return data;
}
// A field the server names becomes a sentence; internal field names never reach the screen.
const errText=e=>{const f=String(e?.detail?.field||'').split('.').filter(x=>!/^\d+$/.test(x)).pop();return e?.code==='INVALID_FIELDS'&&f&&T['fh_'+f]?tr('fh_'+f):tr('e_'+(e?.code||'SERVER_ERROR'));};
// What a proof upload accepts; video goes in as a link.
const PROOF_ACCEPT='.pdf,.pptx,.xlsx,.xls,.csv,.docx,.doc,.ods,.odt,.png,.jpg,.jpeg,.webp';
async function uploadInto(form){
 const input=form.querySelector('input[type=file][name=upload]'),file=input?.files?.[0];if(!file)return;
 const pid=form.dataset.project||'',image=/\.(png|jpe?g|webp)$/i.test(file.name);
 if(file.size>(image?10:25)*1048576)throw new ApiError('TOO_LARGE');
 const r=await api('POST',`/api/files?purpose=${pid?(image?'image':'document'):'message'}${pid?'&projectId='+encodeURIComponent(pid):''}`,undefined,{raw:file,key:idem(),headers:{'X-Filename':encodeURIComponent(file.name),'Content-Type':file.type||'application/octet-stream'}});
 let sel=form.querySelector('[name=fileId]');
 if(!sel){sel=document.createElement('input');sel.type='hidden';sel.name='fileId';form.append(sel);}
 if(sel.tagName==='SELECT')sel.append(new Option(r.file.filename,r.file.id));
 sel.value=r.file.id;input.value='';
}
async function loadMe(){try{const r=await api('GET','/api/auth/me');me=r.user;csrf=r.csrf||'';cache.unread=r.unread||0;cache.messages=r.messages||0;}catch{me=null;}updateNav();}
function updateNav(){document.querySelectorAll('.nav-account').forEach(a=>{a.textContent=me?tr('nav'):tr('signIn');});}

// A route may carry a query after '?', e.g. #/account/register?invite=CODE (an invitation link; never personal data).
function parts(){return location.hash.replace(/^#\/?/,'').split('?')[0].split('/').filter(Boolean);}
const hashParam=k=>new URLSearchParams(location.hash.split('?')[1]||'').get(k)||'';
const inviteLink=code=>siteLink('#/account/register?invite='+encodeURIComponent(code));
// A fresh invitation: the sign-up link to send (with a Copy button) and the bare code for someone who already has an account.
const inviteBox=code=>code?`<div class="acc-flash acc-invite" role="status"><p>${tr('inviteLinkShow')}</p><span class="acc-copy"><input class="acc-copy-input" readonly value="${esc(inviteLink(code))}" aria-label="${esc(tr('inviteLinkLabel'))}"><button type="button" class="acc-secondary" data-act="copy">${tr('copy')}</button></span><small>${tr('inviteCodeToo')} <code class="acc-code">${esc(code)}</code></small></div>`:'';
// Other parts of the page (header account menu, demo shell) learn about sign-in and sign-out at once.
// messenger.js polls the unread count; the tabs start from it on their next draw.
addEventListener('bird:messages',e=>{cache.messages=e.detail?.unread||0;});
const announce=()=>dispatchEvent(new CustomEvent('bird:auth',{detail:{user:me||null,csrf}}));
function isRoute(){return ['account','admin'].includes(parts()[0]);}
const go=h=>{if(location.hash===h)render();else location.hash=h;};

// Layout -------------------------------------------------------------------------
function shell(active,body){
 const tabs=active==='admin'?[['#/account','← '+tr('nav'),'account'],['#/admin',tr('admin'),'admin']]:[['#/account',tr('overview'),'overview'],['#/account/tasks',tr('tasks'),'tasks'],['#/account/messages',tr('dmTab'),'messages'],['#/account/mentors',tr('mentors'),'mentors'],['#/account/progress',tr('progress'),'progress'],['#/account/character',tr('character'),'character'],['#/account/settings',tr('settings'),'settings'],...(isAdmin()?[['#/admin',tr('admin'),'admin']]:[])];
 return `<div class="acc ${active==='admin'?'acc-admin':'acc-m'} ${cache.intro?'is-intro':''}"><div class="acc-head"><div><span class="eyebrow">${esc(tr('urole_'+me.role))}</span><h1>${esc(me.displayName)}</h1></div><a class="acc-office" href="#/office">${tr('office')} ↗</a></div><nav class="acc-tabs" aria-label="${tr('nav')}">${tabs.map(([h,l,k])=>`<a href="${h}" ${k===active?'aria-current="page"':''}>${esc(l)}${k==='overview'&&cache.unread?` <b class="acc-dot">${cache.unread}</b>`:''}${k==='messages'||k==='admin'?` <b class="acc-dot" data-msgr-count title="${esc(pgPlural('msgUnread',cache.messages).replace('{n}',cache.messages))}" ${cache.messages?'':'hidden'}>${cache.messages}</b>`:''}</a>`).join('')}</nav>${flashHtml()}<div class="acc-body">${body}</div></div>`;
}
function flashHtml(){if(!flash)return '';const f=flash;flash=null;return `<p class="acc-flash ${f.error?'is-error':''}" role="${f.error?'alert':'status'}">${f.html}</p>`;}
// The native date picker stays, but its empty mask follows the site language, not the phone's.
const dateBox=(type,value,input)=>['date','datetime-local'].includes(type)?`<span class="acc-date ${value?'':'is-empty'}" data-hint="${esc(tr(type==='date'?'dateHint':'dateTimeHint'))}">${input}</span>`:input;
const field=(name,label,{type='text',value='',hint='',required=false,attrs=''}={})=>`<label class="acc-field"><span>${esc(label)}</span>${type==='textarea'?`<textarea name="${name}" ${required?'required':''} ${attrs}>${esc(value)}</textarea>`:type==='password'?`<span class="acc-pass"><input name="${name}" type="password" value="${esc(value)}" ${required?'required':''} ${attrs}><button type="button" class="acc-pass-toggle" data-act="toggle-password" aria-pressed="false">${tr('showPassword')}</button></span>`:`${dateBox(type,value,`<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${attrs}>`)}`}${hint?`<small>${esc(hint)}</small>`:''}</label>`;
const select=(name,label,options,value)=>`<label class="acc-field"><span>${esc(label)}</span><select name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
const statusChip=s=>`<span class="acc-chip is-${esc(s)}">${esc(tr('st_'+s))}</span>`;
const empty=()=>`<p class="acc-muted">${tr('none')}</p>`;

// Signed-out ------------------------------------------------------------------------
function authView(mode){
 const tabs=`<div class="acc-switch">${[['login',tr('signIn')],['register',tr('createAccount')],['recover',tr('recover')]].map(([m,l])=>`<a href="#/account/${m==='login'?'login':m}${hashParam('invite')?'?invite='+encodeURIComponent(hashParam('invite')):''}" ${m===mode?'aria-current="page"':''}>${esc(l)}</a>`).join('')}</div>`;
 const form=mode==='register'?`<form data-form="register">${field('login',tr('login'),{required:true,hint:tr('loginHint'),attrs:'autocomplete="username" maxlength="60" autocapitalize="none"'})}${field('password',tr('password'),{type:'password',required:true,hint:tr('passwordHint'),attrs:'autocomplete="new-password" minlength="10" maxlength="200"'})}${field('displayName',tr('displayName'),{required:true,attrs:'maxlength="80"'})}${field('email',tr('email'),{type:'email',hint:tr('emailNote'),attrs:'autocomplete="email" maxlength="200"'})}${field('invite',tr('inviteCodeOptional'),{value:hashParam('invite'),attrs:'maxlength="100" autocomplete="off"'})}<button class="acc-primary">${tr('createAccount')}</button></form>`
 :mode==='recover'?`<form data-form="recover"><p class="acc-muted">${tr('noEmail')}</p>${field('login',tr('login'),{required:true,attrs:'autocomplete="username" autocapitalize="none"'})}${field('code',tr('recoveryCode'),{required:true,attrs:'autocomplete="off"'})}${field('newPassword',tr('newPassword'),{type:'password',required:true,hint:tr('passwordHint'),attrs:'autocomplete="new-password" minlength="10"'})}<button class="acc-primary">${tr('recover')}</button></form>`
 :`<form data-form="login">${field('login',tr('login'),{required:true,attrs:'autocomplete="username" autocapitalize="none"'})}${field('password',tr('password'),{type:'password',required:true,attrs:'autocomplete="current-password"'})}<button class="acc-primary">${tr('signIn')}</button></form><p class="acc-forgot"><a href="#/account/forgot">${tr('forgotPassword')}</a></p>`;
 return `<div class="acc acc-auth"><h1>${tr(mode==='register'?'createAccount':mode==='recover'?'recover':'signIn')}</h1>${tabs}${flashHtml()}${form}</div>`;
}
// Forgot password: the server answers the same for any name; `mail` says only whether letters can go out at all.
function forgotView(){
 const sent=cache.forgotSent;cache.forgotSent=null;
 const body=sent?`<p class="acc-flash" role="status">${sent.mail?tr('forgotSent'):`${tr('forgotNoMail')} <a href="#/account/recover">${tr('recover')}</a>.`}</p><p><a href="#/account/login">← ${tr('backToSignIn')}</a></p>`
 :`<form data-form="forgot"><p class="acc-muted">${tr('forgotNote')}</p>${field('login',tr('loginOrEmail'),{required:true,attrs:'autocomplete="username" autocapitalize="none" maxlength="200"'})}<button class="acc-primary">${tr('forgotSend')}</button></form><p class="acc-forgot"><a href="#/account/login">← ${tr('backToSignIn')}</a></p>`;
 return `<div class="acc acc-auth"><h1>${tr('forgotTitle')}</h1>${flashHtml()}${body}</div>`;
}
// The link from the letter. It works signed in or out: the account it belongs to is the one that gets signed in.
function resetView(){
 const bad=cache.resetBad||!hashParam('token');cache.resetBad=false;
 const body=bad?`<p class="acc-flash is-error" role="alert">${tr('e_RESET_INVALID')}</p><p><a class="acc-primary" href="#/account/forgot">${tr('resetAgain')}</a></p>`
 :`<form data-form="reset">${field('newPassword',tr('newPassword'),{type:'password',required:true,hint:tr('passwordHint'),attrs:'autocomplete="new-password" minlength="10" maxlength="200"'})}${field('newPassword2',tr('repeatPassword'),{type:'password',required:true,attrs:'autocomplete="new-password" minlength="10" maxlength="200"'})}<button class="acc-primary">${tr('savePassword')}</button></form>`;
 return `<div class="acc acc-auth"><h1>${tr('resetTitle')}</h1>${flashHtml()}${body}</div>`;
}
function codesView(codes,next){return `<div class="acc acc-auth"><h1>${tr('codesTitle')}</h1><p>${tr('codesText')}</p><ol class="acc-codes">${codes.map(c=>`<li><code>${esc(c)}</code></li>`).join('')}</ol><button class="acc-primary" data-act="codes-done" data-next="${esc(next)}">${tr('codesDone')}</button></div>`;}

// Account pages --------------------------------------------------------------------------
// Public ranking: the top three and the neighbours of your own team, nobody is shown as last.
function rankRows(items,mine){
 const show=new Set([0,1,2]);
 items.forEach((t,i)=>{if(mine.has(t.projectId))[i-1,i,i+1].forEach(x=>{if(x>=0&&x<items.length)show.add(x);});});
 const rows=[];let last=-1;
 [...show].sort((a,b)=>a-b).forEach(i=>{if(i>=items.length)return;if(i>last+1)rows.push({gap:true});rows.push({...items[i],place:items[i].place??null});last=i;});
 return rows;
}
// Participant side: a small game. Levels come from personal points; each level needs a little more than the last.
const lvStart=n=>n<=1?0:5*(n-1)*(n+2);
function level(xp){let n=1;while(xp>=lvStart(n+1))n++;const a=lvStart(n),b=lvStart(n+1);return {n,a,b,pct:Math.round((Math.max(0,xp)-a)/(b-a)*100)};}
const mNum=(n,cls='')=>`<b class="m-num ${cls}" data-count="${Number(n)||0}">${Number(n)||0}</b>`;
const bar=(pct,cls='',label='')=>{const p=Math.max(0,Math.min(100,Math.round(pct)||0));return `<span class="m-bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" ${label?`aria-label="${esc(label)}"`:''} style="--p:${p}%"><i></i></span>`;};
const TYPE_ICON={text:'write',team_result:'flag',checklist:'checklist',counter:'counter',link:'link',attachment:'clip',attendance:'cap'};
// Drawn icons (assets/icons.js), never emoji.
const I=(name,cls)=>window.BirdIcon?.(name,cls)||'';
const BADGE_ICON={'first-project':'rocket','first-presentation':'mic','first-report':'note','team-helper':'help','three-lectures':'cap','stage-complete':'trophy'};
const initialsOf=name=>String(name||'?').split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase();
// Time left as a chip: amber under three days, red once late.
function countdown(iso){
 if(!iso)return '';const ms=Date.parse(iso)-Date.now(),d=Math.round(Math.abs(ms)/86400000),h=Math.max(1,Math.round(Math.abs(ms)/3600000));
 const span=Math.abs(ms)<86400000?h+tr('mHour'):d+tr('mDay');
 return `<span class="m-due ${ms<0?'is-risk':ms<3*86400000?'is-watch':''}" title="${esc(tr('due')+' '+date(iso,true))}"><span aria-hidden="true">${I('timer')}</span> ${esc(tr(ms<0?'mOverdue':'mLeft').replace('{n}',span))}</span>`;
}
function badgeGrid(p,small=false){
 const got=new Map(p.badges.map(b=>[b.id,b]));
 return `<ul class="m-badges ${small?'is-small':''}">${p.available.map(b=>{const g=got.get(b.id);return `<li class="m-rise ${g?'is-got':'is-locked'}" title="${esc(pick(b.title))}${g?' · '+date(g.created):''}"><span class="m-badge-icon" aria-hidden="true">${I(BADGE_ICON[b.id]||'star')}</span>${g?'':'<span class="m-lock" aria-hidden="true">'+I('lock')+'</span>'}<span class="m-badge-name">${esc(pick(b.title))}</span><span class="m-sr">${tr(g?'mEarned':'mLocked')}</span>${!small&&g?`<small>${date(g.created)}</small>`:''}</li>`;}).join('')}</ul>`;
}
function questCard(t){
 const k=t.task,st=t.status,open=['not_started','draft','changes_requested'].includes(st),prog=open&&t.progress?.total?t.progress:null;
 const asking=!t.response&&st==='not_started';
 const cta=asking?tr('st_awaiting'):st==='changes_requested'?tr('mFix'):st==='draft'||prog?.done?tr('mContinue'):st==='not_started'?tr('mStart'):tr('open');
 return `<li class="m-quest m-rise is-${esc(st)}"><a href="#/account/task/${esc(t.id)}">
  <span class="m-quest-icon" aria-hidden="true">${I(TYPE_ICON[k.type]||'star')}</span>
  <span class="m-quest-body"><strong>${authored(k.translations,'title')}</strong>
   <span class="m-quest-meta">${asking?`<span class="m-tag is-new">${esc(tr('mNew'))}</span>`:''}<span class="m-tag">${k.scope==='team'?I('team')+' '+esc(t.projectName||tr('team')):I('person')+' '+esc(tr('personal'))}</span>${t.period?`<span class="m-tag">${tr('week')} ${esc(t.period.split('-W')[1])}</span>`:''}${open&&k.dueAt?countdown(k.dueAt):''}${open?'':statusChip(st)}</span>
   ${prog?`<span class="m-quest-prog">${bar(prog.done/prog.total*100)}<small>${prog.done}/${prog.total}</small></span>`:''}
  </span>
  <span class="m-pts" title="${k.xp} ${esc(pgPlural('xp',k.xp))}">+${k.xp}</span>
  ${open?`<span class="m-cta">${esc(cta)} →</span>`:''}
 </a></li>`;
}
function rankList(rank,mine){
 const medal=[I('gold'),I('silver'),I('bronze')];
 return `<ol class="m-rank">${rankRows(rank.items,mine).map(t=>t.gap?`<li class="m-rank-gap" aria-hidden="true">⋯</li>`:`<li class="m-rise ${mine.has(t.projectId)?'is-mine':''}" style="--p:${Math.max(2,t.percent||0)}%"><span class="m-rank-place" aria-label="${t.place??'—'}">${t.place?medal[t.place-1]||t.place:'—'}</span><span class="m-rank-name"><button type="button" class="m-rank-open" data-sheet="team" data-id="${esc(t.projectId)}">${esc(t.name)}</button>${t.streak?` <small title="${esc(tr('streak'))}">${I('flame')}${t.streak}</small>`:''}</span><span class="m-rank-bar" aria-hidden="true"><i></i></span><b>${percent(t.percent)}</b>${t.weekGain?`<small class="m-gain" title="${esc(tr('thisWeek'))}">+${t.weekGain}</small>`:'<small class="m-gain"></small>'}</li>`).join('')}</ol>`;
}
async function overviewView(){
 const [projects,tasks,notes,claims,help,news,prog,rank]=await Promise.all([api('GET','/api/projects?mine=1'),api('GET','/api/tasks'),api('GET','/api/notifications?limit=8'),api('GET','/api/people/claims'),api('GET','/api/help/confirmations'),api('GET','/api/announcements'),api('GET','/api/progress'),api('GET','/api/teams/ranking').catch(()=>({items:[]}))]);
 const quests=await api('GET','/api/quests').catch(()=>({items:[]}));
 const due=await api('GET','/api/feedback/due').catch(()=>({items:[]}));
 const [wallets,rewards]=await Promise.all([api('GET','/api/wallet').catch(()=>({items:[],sessionPrice:30})),api('GET','/api/rewards').catch(()=>({items:[]}))]);
 const teamProjects=projects.items.filter(p=>['owner','editor','member'].includes(p.role)&&p.status!=='archived');
 const checks=await Promise.all(teamProjects.map(p=>api('GET',`/api/projects/${encodeURIComponent(p.id)}/checkins`).then(r=>({p,r})).catch(()=>null)));
 const missing=checks.filter(c=>c&&!c.r.items.some(i=>i.week===c.r.week));
 const unreadNews=news.items.filter(n=>!n.read);
 const character=await api('GET','/api/me/character');
 const first=teamProjects.length?await api('GET','/api/me/first-steps').catch(()=>null):null;
 const open=tasks.items.filter(t=>['not_started','draft','changes_requested'].includes(t.status)&&t.task.status==='published');
 // "Are you a participant?" only for someone not linked to a card and not on a team yet.
 const claimBlock=character.person?.confirmed||me.personId||teamProjects.length?'':await claimForm(claims.items);
 // Team members see the team's points first (the same number as everywhere else); their own points come second.
 const myTeam=prog.teams[0],big=myTeam?myTeam.xp:prog.xp;
 const lv=level(big),mine=new Set(prog.teams.map(t=>t.projectId)),place=rank.items.findIndex(t=>mine.has(t.projectId)),team=rank.items[place];
 const streak=Math.max(0,...checks.filter(Boolean).map(c=>c.r.streak||0),team?.streak||0);
 const stage=window.BirdCharacter&&me.personId?BirdCharacter.html([{id:me.personId,name:''}],{size:'lg'}):`<span class="m-ava is-big">${esc(initialsOf(me.displayName))}</span>`;
 const hero=`<section class="m-hero m-rise">
  <a class="m-hero-stage" href="#/account/character" aria-label="${esc(tr('character'))}">${stage}<span class="m-lv-tag">${tr('mLevel')} ${lv.n}</span></a>
  <div class="m-hero-main">
   <div class="m-xp"><div class="m-xp-top"><span>${mNum(big,'is-xp')} <small>${esc(pgPlural('xp',big))}${myTeam?' · '+esc(tr('teamPointsOf').replace('{team}',myTeam.name)):''}</small></span><small>${esc(tr('mToNext').replace('{n}',lv.b-big).replace('{l}',lv.n+1))}</small></div>${bar(lv.pct,'is-xp',tr('mLevel')+' '+(lv.n+1))}${myTeam?`<small class="m-own">${esc(tr('myOwnPoints').replace('{n}',prog.xp))}</small>`:''}</div>
   <ul class="m-stats">
    <li class="m-stat is-streak"><span class="m-stat-icon" aria-hidden="true">${I('flame')}</span>${mNum(streak)}<small>${esc(pgPlural('mStreakWeeks',streak))}</small></li>
    ${team?.place?`<li class="m-stat is-rank"><span class="m-stat-icon" aria-hidden="true">${I('trophy')}</span><b class="m-num">#${team.place}</b><small>${esc(team.name)} · ${esc(pgPlural('mRankOf',rank.items.length).replace('{n}',rank.items.length))}</small></li>`:''}
    <li class="m-stat is-badges"><span class="m-stat-icon" aria-hidden="true">${I('medal')}</span>${mNum(prog.badges.length)}<small>/ ${prog.available.length} ${esc(tr('badges'))}</small></li>
   </ul>
   <a class="m-badge-link" href="#/account/progress" aria-label="${esc(tr('badges'))}">${badgeGrid(prog,true)}</a>
  </div></section>`;
 const feedback=due.items.slice(0,1).map(l=>`<section class="acc-card acc-feedback m-alert is-info m-rise"><h2><span aria-hidden="true">${I('star')}</span> ${tr('feedbackTitle')}</h2><p class="acc-muted">${esc(pick(l.title))} · ${date(l.date)}</p><form data-form="feedback" data-id="${esc(l.id)}"><fieldset class="acc-field"><legend class="m-sr">${tr('feedbackScore')}</legend><div class="acc-scale">${Array.from({length:10},(_,i)=>`<label><input type="radio" name="score" value="${i+1}" required><span>${i+1}</span></label>`).join('')}</div></fieldset><details class="m-more"><summary>${tr('mAddComment')}</summary>${field('comment',tr('feedbackComment'),{type:'textarea',attrs:'rows="2" maxlength="1000"'})}</details><div class="m-row"><button class="acc-primary">${tr('send')}</button><small class="acc-muted">${tr('feedbackAnon')}</small></div></form></section>`).join('');
 const reminders=missing.map(c=>`<a class="m-alert-link is-watch m-rise" href="#/account/project/${esc(c.p.id)}/checkin"><span aria-hidden="true">${I('bolt')}</span> <span>${tr('checkinMissing')}: <strong>${esc(c.p.name)}</strong></span> <b>+10</b> →</a>`).join('');
 const helpBlock=help.items.length?`<section class="acc-card m-alert is-ok m-rise"><h2><span aria-hidden="true">${I('help')}</span> ${tr('helpRequests')}</h2><ul class="acc-list">${help.items.map(h=>`<li><div><strong>${esc(h.helperName)}</strong><small>${esc(h.note)}</small></div><span class="acc-actions"><button data-act="help" data-id="${esc(h.id)}" data-decision="confirmed" class="acc-secondary">${tr('confirmHelp')}</button><button data-act="help" data-id="${esc(h.id)}" data-decision="declined">${tr('decline')}</button></span></li>`).join('')}</ul></section>`:'';
 const questBlock=quests.items.map(q=>`<section class="acc-card acc-quest m-rise"><div class="m-quest-head"><span class="m-quest-icon" aria-hidden="true">${I('target')}</span><div><small class="m-label">${tr('quest')}</small><h2>${esc(pick(q.title))}</h2></div><b class="m-frac">${q.done}<small>/${q.target}</small></b></div>${bar(q.done/q.target*100,'is-quest')}<small class="acc-muted">${q.complete?tr('questDone'):tr('questNote')}</small></section>`).join('');
 const nextQuests=`<section class="acc-card m-rise"><div class="acc-card-head"><h2>${tr('mNextQuests')}</h2><a href="#/account/tasks">${tr('mAllTasks')} (${open.length}) →</a></div>${open.length?`<ul class="m-quests is-compact">${open.slice(0,4).map(questCard).join('')}</ul>`:empty()}</section>`;
 const projectsBlock=`<section class="acc-card m-rise"><div class="acc-card-head"><h2>${tr('myProjects')}</h2><a class="m-add" href="#/account/new-project" aria-label="${esc(tr('newProject'))}" title="${esc(tr('newProject'))}">+</a></div>${projects.items.length?`<ul class="m-projects">${projects.items.map(p=>`<li><a href="#/account/project/${esc(p.id)}"><span class="m-ava">${esc(initialsOf(p.name))}</span><span><strong>${esc(p.name)}</strong><small>${esc(tr('role_'+p.role))}</small></span>${p.status==='archived'?statusChip(p.status):''}</a></li>`).join('')}</ul>`:empty()}</section>`;
 const newsBlock=news.items.length?`<section class="acc-card acc-news m-rise ${unreadNews.length?'is-unread':''}"><div class="acc-card-head"><h2><span aria-hidden="true">${I('megaphone')}</span> ${tr('announcements')}</h2>${unreadNews.length?`<button class="m-mini" data-act="news-read">${tr('markRead')}</button>`:''}</div><ul class="acc-list">${news.items.slice(0,3).map(n=>`<li><div><strong>${n.pinned?I('pin')+' ':''}${esc(n.title)}</strong><p class="acc-pre">${esc(n.body)}</p><small>${esc(n.author)} · ${date(n.created,true)}</small></div></li>`).join('')}</ul></section>`:'';
 const icon=k=>I({nudge:'chat',reminder:'bell',badge:'medal'}[k]||(k.startsWith('submission')||k.startsWith('review')?'check':''))||'•';
 const notesBlock=`<section class="acc-card m-rise"><div class="acc-card-head"><h2>${tr('notifications')}${notes.unread?` <b class="acc-dot">${notes.unread}</b>`:''}</h2>${notes.unread?`<button class="m-mini" data-act="read">${tr('markRead')}</button>`:''}</div>${notes.items.length?`<ul class="m-feed">${notes.items.map(n=>`<li class="${n.read?'':'is-unread'}"><span class="m-feed-icon" aria-hidden="true">${icon(n.kind)}</span><span>${n.kind==='nudge'?`<strong>${esc(n.payload.from)}:</strong> ${esc(n.payload.message)}`:n.kind==='reminder'?(n.payload.link?`<a href="${esc(n.payload.link)}">${esc(pick(n.payload.text))}</a>`:esc(pick(n.payload.text))):noteText(n)}</span><small>${date(n.created,true)}</small></li>`).join('')}</ul>`:empty()}</section>`;
 // First steps: four things a new team member does, each ticked from real data; hidden once all are done and closed.
 let hidden=false;try{hidden=localStorage.getItem('bird-first-steps:'+me.id)==='hidden';}catch{}
 const steps=first?.steps||[],doneN=steps.filter(x=>x.done).length,pid=esc(first?.projectId||'');
 const stepHref={card:`#/account/project/${pid}/edit`,deck:`#/account/project/${pid}/files`,invite:`#/account/project/${pid}/team`,task:'#/account/tasks'};
 const firstSteps=steps.length&&!(hidden&&doneN===steps.length)?`<section class="acc-card m-first m-rise"><div class="acc-card-head"><h2>${I('flag')} ${tr('fsTitle')}</h2><b class="m-frac">${esc(tr('fsCount').replace('{n}',doneN))}</b></div>${bar(doneN/steps.length*100,'is-ok')}<ol class="m-steps-list">${steps.map(x=>`<li class="${x.done?'is-done':''}"><a href="${stepHref[x.key]}"><span class="m-step-box" aria-hidden="true">${x.done?I('check'):''}</span><span>${esc(tr('fs_'+x.key))}</span><span class="m-sr">${tr(x.done?'mEarned':'mLocked')}</span></a></li>`).join('')}</ol>${doneN===steps.length?`<div class="m-row"><p class="acc-muted">${tr('fsDone')}</p><button class="m-mini" data-act="fs-hide">${tr('fsHide')}</button></div>`:''}</section>`:'';
 // Recovery codes from sign-up: a calm notice on the overview, not a wall before it.
 const codes=cache.codesNotice?`<section class="acc-card m-codes m-rise" role="status"><h2>${I('lock')} ${tr('codesTitle')}</h2><p class="acc-muted">${tr('codesCalm')}</p><ol class="acc-codes">${cache.codesNotice.map(c=>`<li><code>${esc(c)}</code></li>`).join('')}</ol><button class="acc-secondary" data-act="codes-ok">${tr('codesDone')}</button></section>`:'';
 const write=teamProjects.length?`<div class="m-write">${writeBtn()}</div>`:'';
 const invite=`<details class="m-more acc-card m-rise" ${hashParam('invite')?'open':''}><summary>${I('ticket')} ${tr('acceptInvite')}</summary><form data-form="invite" class="acc-inline">${field('code',tr('inviteCode'),{required:true,value:hashParam('invite'),attrs:'autocomplete="off" maxlength="100"'})}<button class="acc-secondary">${tr('acceptInvite')}</button></form></details>`;
 return shell('overview',`${codes}${firstSteps}${hero}${write}${reminders}<div class="m-cols"><div class="m-col">${feedback}${helpBlock}${nextQuests}${questBlock}${newsBlock}</div><div class="m-col">${pointsCard(wallets,rewards)}${projectsBlock}${notesBlock}${invite}${claimBlock}</div></div>`);
}
// Team points with the way to a mentor meeting, and a window that says what points buy.
// It opens by itself once, and again the first time a team can afford a meeting.
function pointsCard(wallets,rewards){
 if(!wallets.items.length)return '';
 const price=wallets.sessionPrice,pts=n=>`${n} ${pgPlural('xp',n)}`;
 const rows=wallets.items.map(w=>{const n=price?Math.floor(Math.max(0,w.balance)/price):0;return `<li><div class="m-coin-top"><strong>${esc(w.name)}</strong><span class="m-coin">${mNum(w.balance)}<small>${esc(pgPlural('xp',w.balance))}</small></span></div>${bar(price?w.balance/price*100:100,w.balance>=price?'is-ok':'',tr('pointsMeeting'))}<small>${w.balance>=price?`<span class="m-tickets" aria-hidden="true">${I('ticket').repeat(Math.min(n,5))}</span> ${esc(tr('mMeetings').replace('{n}',n))}`:esc(tr('pointsToMeeting').replace('{n}',price-Math.max(0,w.balance)))}</small></li>`;}).join('');
 const can=wallets.items.filter(w=>w.balance>=price).map(w=>w.projectId);
 let seen={};try{seen=JSON.parse(localStorage.getItem('bird-points:'+me.id)||'{}')||{};}catch{}
 // Never by itself over the first screen: the "?" on the wallet opens it.
 const auto=false;
 const offers=[`<li><div><strong>${I('calendar')} ${tr('pointsMeeting')}</strong><small>${tr('pointsMeetingNote')}</small></div><b>${pts(price)}</b></li>`,...rewards.items.slice(0,4).map(r=>`<li><div><strong>${I('gift')} ${esc(r.title)}</strong>${r.description?`<small>${esc(r.description)}</small>`:''}</div><b>${pts(r.price)}</b></li>`)].join('');
 return `<section class="acc-card acc-points m-wallet m-rise"><div class="acc-card-head"><h2><span aria-hidden="true">${I('coin')}</span> ${tr('walletTitle')}</h2><button class="m-mini" data-act="points-help" aria-label="${esc(tr('pointsWhat'))}" title="${esc(tr('pointsWhat'))}">?</button></div><ul class="m-coins">${rows}</ul><a class="acc-primary m-wide" href="#/account/mentors">${tr('pointsBook')} →</a></section>
 <dialog class="acc-dialog" id="acc-points" aria-labelledby="acc-points-title" ${auto?`data-auto="${esc(JSON.stringify({intro:true,can:[...new Set([...(seen.can||[]),...can])]}))}"`:''}><h2 id="acc-points-title">${tr('pointsDialogTitle')}</h2><ul class="acc-list">${wallets.items.map(w=>`<li><span>${esc(w.name)}</span><b>${pts(w.balance)}</b></li>`).join('')}</ul><h3>${tr('pointsSpendOn')}</h3><ul class="acc-list acc-offers">${offers}</ul><p class="acc-muted">${tr('pointsEarn')}</p><div class="acc-actions"><a class="acc-primary" href="#/account/mentors" data-act="points-close">${tr('pointsBook')}</a><a class="acc-secondary" href="#/account/tasks" data-act="points-close">${tr('pointsTasks')}</a><button data-act="points-close">${tr('gotIt')}</button></div></dialog>`;
}
// Fills the new-task form from a pasted email; the organiser checks it and saves.
function fillFromLetter(){
 const form=root.querySelector('form[data-form=task],form[data-form=task-compose]'),out=root.querySelector('#letter-result');
 const r=window.BirdLetter?.parse(root.querySelector('#letter-text').value);
 if(!form||!r||!r.instructions){out.textContent=tr('letterEmpty');return;}
 const set=(name,value)=>{const el=form.elements[name];if(el&&value)el.value=value;};
 set('title_'+r.language,r.title);set('instructions_'+r.language,r.instructions);
 // The one-screen form has one title and one text, in the language the letter is in.
 if(form.dataset.form==='task-compose'){set('title',r.title);set('instructions',r.instructions);form.dataset.lang=r.language;}
 if(r.dueLocal)set('dueAt',r.dueLocal);
 form.querySelectorAll('.acc-lang-block').forEach(d=>{if(d.querySelector(`[name=title_${r.language}]`))d.open=true;});
 out.textContent=`${tr('letterDone')} ${r.language.toUpperCase()} · ${r.dueAt?tr('due')+' '+date(r.dueAt.toISOString(),true):tr('letterNoDue')}`;
 (form.elements['title_'+r.language]||form.elements.title)?.focus();
}
async function claimForm(claims){
 const people=(await api('GET','/api/people?limit=100')).items.filter(p=>p.kind==='participant');
 const pending=claims.filter(c=>c.status==='pending');
 return `<section class="acc-card"><h2>${tr('claimTitle')}</h2><p class="acc-muted">${tr('claimText')}</p>${pending.length?`<ul class="acc-list">${pending.map(c=>`<li><span>${esc(c.personName)}</span>${statusChip('pending')}</li>`).join('')}</ul>`:`<form data-form="claim">${select('personId',tr('participant'),people.map(p=>[p.id,p.name+(p.team?' · '+p.team:'')]),'')}${field('message',tr('claimMessage'),{type:'textarea',attrs:'maxlength="500" rows="2"'})}<button class="acc-secondary">${tr('claimSend')}</button></form>`}</section>`;
}
const lectureFields=(x={})=>`<div class="acc-inline">${field('date',tr('lectureDate'),{type:'date',required:true,value:x.date})}${field('time',tr('lectureTime'),{type:'time',value:x.time})}${field('place',tr('location'),{value:x.place,attrs:'maxlength="160"'})}</div>${field('speaker',tr('speaker'),{value:x.speaker,attrs:'maxlength="120"'})}${['en','hr','ru'].map(l=>field('title_'+l,tr('title')+' '+l.toUpperCase(),{value:x.title?.[l],required:l==='en',attrs:'maxlength="200"'})).join('')}`;
// Quest board: what to fix, what to do, what waits for review, what is done.
async function tasksView(){
 const [tasks,cat]=await Promise.all([api('GET','/api/tasks'),api('GET','/api/catalog')]);
 const by=g=>tasks.items.filter(t=>g.includes(t.status));
 // Tasks the organiser just gave wait for an answer (accept or decline) before anything else.
 const asking=tasks.items.filter(t=>!t.response&&t.status==='not_started'),rest=g=>by(g).filter(t=>!asking.includes(t));
 const cols=[['awaiting',asking,'is-ask'],['changes_requested',by(['changes_requested']),'is-risk'],['not_started',rest(['not_started','draft']),'is-todo'],['submitted',by(['submitted']),'is-watch'],['accepted',by(['accepted','rejected']),'is-ok']];
 const total=tasks.items.length||1,loot=[...cols[0][1],...cols[1][1],...cols[2][1]].reduce((s,t)=>s+t.task.xp,0),won=by(['accepted']).reduce((s,t)=>s+t.task.xp,0);
 const head=tasks.items.length?`<section class="m-board-head m-rise"><div class="m-loot"><span>${mNum(loot)}<small>${esc(tr('mUpForGrabs'))}</small></span><span class="is-won">${mNum(won)}<small>${esc(tr('mWon'))}</small></span></div><div class="m-seg" aria-hidden="true">${cols.map(([k,items,c])=>items.length?`<i class="${c}" style="--w:${items.length/total*100}%"></i>`:'').join('')}</div><ul class="m-legend">${cols.filter(c=>c[1].length).map(([k,items,c])=>`<li class="${c}"><i aria-hidden="true"></i>${esc(tr('st_'+k))} <b>${items.length}</b></li>`).join('')}</ul></section>`:'';
 const catalog=cat.items.length?`<section class="m-pickboard m-rise"><div class="acc-card-head"><h2><span aria-hidden="true">${I('dice')}</span> ${tr('catalog')}</h2><small class="acc-muted">${tr('catalogNote')}</small></div><ul class="m-picks">${cat.items.map(t=>{const free=t.scope==='team'?t.projects.filter(p=>!t.taken.some(x=>x.projectId===p.id)):(t.taken.length?[]:[null]);return `<li class="m-pick m-rise ${t.taken.length&&!free.length?'is-taken':''}"><div class="m-pick-top"><span class="m-quest-icon" aria-hidden="true">${I(TYPE_ICON[t.type]||'star')}</span><span class="m-pts">+${t.xp}</span></div><strong>${authored(t.translations,'title')}</strong><small class="m-clamp">${authored(t.translations,'goal')}</small><span class="m-tag">${t.scope==='team'?I('team')+' '+esc(tr('team')):I('person')+' '+esc(tr('personal'))}</span><span class="m-pick-act">${t.taken.map(x=>`<a class="acc-chip is-accepted" href="#/account/task/${esc(x.assignmentId)}">✓ ${tr('taken')}</a>`).join('')}${free.map(p=>`<button class="acc-secondary" data-act="take" data-id="${esc(t.id)}" data-project="${esc(p?.id||'')}">${tr('take')}${p?' · '+esc(p.name):''}</button>`).join('')}</span></li>`;}).join('')}</ul></section>`:'';
 const lanes=cols.map(([k,items,c])=>items.length?`<section class="m-lane ${c}"><h2><i aria-hidden="true"></i>${esc(tr('st_'+k))} <span class="m-count">${items.length}</span></h2><ul class="m-quests">${items.map(questCard).join('')}</ul></section>`:'').join('');
 return shell('tasks',`${head}${lanes||empty()}${catalog}`);
}

async function taskView(id){
 const {assignment:a}=await api('GET','/api/tasks/'+encodeURIComponent(id));let uploadProject='';
 const t=a.task,content=a.draft||{},locked=!['not_started','draft','changes_requested'].includes(a.status)&&!(t.repeatRule==='weekly_reward'&&a.status==='accepted')||t.status!=='published';
 const open=['not_started','draft','changes_requested'].includes(a.status);
 let input='';
 if(t.type==='checklist'){const n=t.checklist.length,d=t.checklist.filter((c,i)=>content.checked?.[i]).length;input=`<div class="m-checklist"><div class="m-check-prog">${bar(n?d/n*100:0,'m-check-bar')}<small><b class="m-check-n">${d}</b>/${n}</small></div>${t.checklist.map((c,i)=>`<label class="acc-check m-tick"><input type="checkbox" name="checked" value="${i}" ${content.checked?.[i]?'checked':''}> <span>${esc(pick(c))}</span></label>`).join('')}</div>`+field('note',tr('note'),{type:'textarea',value:content.note,attrs:'rows="2" maxlength="2000"'});}
 else if(t.type==='counter')input=`<div class="m-counter-wrap"><div class="acc-counter m-counter"><button type="button" data-act="count" data-d="-1" aria-label="−1">−</button><output name="countOut">${content.count||0}</output><span class="m-of">/ ${t.counterTarget}</span><button type="button" data-act="count" data-d="1" aria-label="+1">+</button><input type="hidden" name="count" value="${content.count||0}"></div>${bar(t.counterTarget?(content.count||0)/t.counterTarget*100:0,'m-counter-bar')}</div>`+field('note',tr('note'),{type:'textarea',value:content.note,attrs:'rows="4" maxlength="2000"'});
 else if(t.type==='text'||t.type==='team_result'){
  if(t.key==='project-update')input=`<p><a class="acc-primary" href="#/account/project/${esc(a.projectId)}/updates">${tr('postUpdate')} →</a></p>`;
  else{input=field('text',tr('answer'),{type:'textarea',value:content.text,attrs:'rows="7" maxlength="5000"'});
   if(t.key==='help-team'){const list=(await api('GET','/api/projects?limit=50')).items.filter(p=>p.id!==a.projectId);input+=select('recipientProjectId',tr('recipient'),[['',''],...list.map(p=>[p.id,p.name])],content.recipientProjectId);}}
 }
 else if(t.type==='link')input=field('url',tr('link'),{type:'url',value:content.url,attrs:'maxlength="500"'})+`<p class="acc-small">${tr('proofVideoNote')}</p>`+field('note',tr('note'),{type:'textarea',value:content.note,attrs:'rows="2"'});
 else if(t.type==='attachment'){
  // The file goes in right here: upload, it is attached, then submit. Earlier project files can be picked instead.
  const pid=a.projectId||(await api('GET','/api/projects?mine=1').catch(()=>({items:[]}))).items.find(p=>['owner','editor','member'].includes(p.role)&&p.status!=='archived')?.id||'';
  const files=pid?(await api('GET',`/api/projects/${encodeURIComponent(pid)}/files`).catch(()=>({items:[]}))).items.filter(f=>f.purpose!=='reference'):[];
  const current=content.fileId&&!files.some(f=>f.id===content.fileId)?[[content.fileId,tr('attachedFile')]]:[];
  uploadProject=pid;
  input=`<div class="m-proof"><label class="acc-field m-upload"><span>${tr('proofUpload')}</span><input type="file" name="upload" accept="${PROOF_ACCEPT}"></label><p class="acc-small">${tr('proofTypes')}</p>${files.length||current.length?select('fileId',tr('chooseFile'),[['',tr('proofNoneYet')],...current,...files.map(f=>[f.id,f.filename])],content.fileId):''}${field('url',tr('proofVideo'),{type:'url',value:content.url,attrs:'maxlength="500" placeholder="https://"'})}</div>`+field('note',tr('note'),{type:'textarea',value:content.note,attrs:'rows="2"'});}
 if(t.proof?.length){
  const k=new Set(t.proof);let fileBox='';
  if(k.has('file')){const pid=a.projectId||(await api('GET','/api/projects?mine=1').catch(()=>({items:[]}))).items.find(p=>['owner','editor','member'].includes(p.role)&&p.status!=='archived')?.id||'';
   const files=pid?(await api('GET',`/api/projects/${encodeURIComponent(pid)}/files`).catch(()=>({items:[]}))).items.filter(f=>f.purpose!=='reference'):[];
   const current=content.fileId&&!files.some(f=>f.id===content.fileId)?[[content.fileId,tr('attachedFile')]]:[];uploadProject=pid;
   fileBox=`<label class="acc-field m-upload"><span>${tr('proofUpload')}</span><input type="file" name="upload" accept="${PROOF_ACCEPT}"></label><p class="acc-small">${tr('proofTypes')}</p>${files.length||current.length?select('fileId',tr('chooseFile'),[['',tr('proofNoneYet')],...current,...files.map(f=>[f.id,f.filename])],content.fileId):''}`;}
  const checks=t.type==='checklist'?input.split('<label class="acc-field">')[0]:'';
  input=`${checks}<div class="m-proof">${t.proof.length>1?`<p class="acc-small">${tr('proofAnyOne')}</p>`:''}${fileBox}${k.has('link')?field('url',tr('link'),{type:'url',value:content.url,attrs:'maxlength="500" placeholder="https://"'}):''}${k.has('text')?field('text',tr('answer'),{type:'textarea',value:content.text,attrs:'rows="6" maxlength="5000"'}):''}</div>${k.has('text')?'':field('note',tr('note'),{type:'textarea',value:content.note,attrs:'rows="2"'})}`;
 }
 else if(t.type==='attendance'){const lectures=(await api('GET','/api/lectures'));input=`<fieldset class="acc-field"><legend>${tr('chooseLectures')}</legend>${lectures.items.filter(l=>l.date<=lectures.today).map(l=>`<label class="acc-check m-tick"><input type="checkbox" name="lectureIds" value="${esc(l.id)}" ${l.attendance?'checked disabled':''}> <span>${esc(pick(l.title))} <small>${date(l.date)}${l.attendance?' · '+tr(l.attendance.kind==='verified_by_admin'?'verified':'selfReported'):''}</small></span></label>`).join('')}</fieldset><p class="acc-small">${tr('selfReport')}</p>`;}
 // A task the organiser gave the team asks for an answer first; the work form opens once they accept.
 const ask=a.response||t.status!=='published'?'':`<section class="m-ask" role="group" aria-label="${esc(tr('taskAccept')+' / '+tr('taskDecline'))}"><p>${tr(a.projectId?'taskAsk':'taskAskPersonal')}</p><div class="acc-actions"><button type="button" class="acc-primary" data-act="accept-task" data-id="${esc(a.id)}">${I('check')} ${tr('taskAccept')}</button><details class="m-decline"><summary class="acc-secondary">${tr('taskDecline')}</summary><form data-form="decline" data-id="${esc(a.id)}">${field('reason',tr('taskDeclineReason'),{type:'textarea',attrs:'rows="2" maxlength="300"'})}<p class="acc-small">${tr('taskDeclineNote')}</p><button class="acc-secondary">${tr('taskDeclineSend')}</button></form></details></div></section>`;
 const reviews=a.reviews?.length?`<section class="acc-card m-rise"><h2>${tr('reviewsTitle')}</h2><ol class="m-timeline">${a.reviews.map(r=>`<li class="is-${esc(r.decision)}"><div>${statusChip(r.decision)} <small>${esc(r.reviewer)} · ${date(r.created,true)}</small>${r.comment?`<p>${esc(r.comment)}</p>`:''}</div></li>`).join('')}</ol></section>`:'';
 const revs=a.revisions?.length?`<details class="acc-card m-more"><summary>${tr('revisions')} (${a.revisions.length})</summary><ul class="acc-list">${a.revisions.map(r=>`<li><div><strong>#${r.revision}</strong> <small>${esc(r.author)} · ${date(r.created,true)}</small><pre class="acc-pre">${esc(r.content.text||r.content.note||'')}</pre></div></li>`).join('')}</ul></details>`:'';
 return shell('tasks',`<a class="acc-back" href="#/account/tasks">← ${tr('tasks')}</a><article class="acc-card acc-task m-task m-rise is-${esc(a.status)}"><header class="m-task-head"><span class="m-quest-icon is-big" aria-hidden="true">${I(TYPE_ICON[t.type]||'star')}</span><div class="m-task-title"><h2>${authored(t.translations,'title')}</h2><div class="m-quest-meta"><span class="m-tag">${t.scope==='team'?I('team')+' '+esc(a.projectName||tr('team')):I('person')+' '+esc(tr('personal'))}</span>${open&&t.dueAt?countdown(t.dueAt):t.dueAt?`<span class="m-tag">${tr('due')} ${date(t.dueAt)}</span>`:''}${t.requiresReview?`<span class="m-tag">${I('eye')} ${tr('requiresReview')}</span>`:''}${statusChip(a.status)}</div></div><span class="m-pts is-big" title="${t.xp} ${esc(pgPlural('xp',t.xp))}">+${t.xp}</span></header>${taskText(t.translations,'goal')?`<p class="m-goal">${authored(t.translations,'goal')}</p>`:''}<div class="m-brief"><h3>${tr('instructions')}</h3><p class="acc-pre">${authored(t.translations,'instructions')}</p></div>${taskText(t.translations,'criteria')?`<div class="m-done-when"><h3>✓ ${tr('criteria')}</h3><p>${authored(t.translations,'criteria')}</p></div>`:''}
 ${a.helpConfirmation?`<p>${statusChip(a.helpConfirmation.status==='confirmed'?'accepted':a.helpConfirmation.status==='declined'?'changes_requested':'pending')}</p>`:''}
 ${ask}${t.completionMode==='admin_only'?`<p class="acc-note">${tr('adminOnly')}</p>`:ask||locked||t.key==='project-update'?(t.key==='project-update'?input:''):`<form data-form="answer" class="m-answer" data-id="${esc(a.id)}" data-type="${esc(t.proof?.length?'proof':t.type)}" data-project="${esc(uploadProject)}">${input}<div class="acc-actions"><button class="acc-primary" data-key="${idem()}">${tr(t.requiresReview?'submitReview':'submit')} · +${t.xp}</button><button type="button" data-act="answer-draft" class="acc-secondary">${tr('saveDraft')}</button></div></form>`}</article><p class="m-write">${writeBtn()}</p>${reviews}${revs}`);
}
// "Write to the programme manager": opens the conversation (or a chooser when there are several managers).
const writeBtn=()=>isAdmin()?'':`<button type="button" class="acc-secondary m-write-btn" data-act="write-manager">${I('chat')} ${tr('writeManager')}</button>`;
function answerContent(form,type){
 const f=new FormData(form),c={note:f.get('note')||''};
 if(type==='checklist')c.checked=[...form.querySelectorAll('[name=checked]')].map(x=>x.checked);
 if(type==='counter')c.count=Number(f.get('count')||0);
 if(type==='text'||type==='team_result'){c.text=f.get('text')||'';if(f.get('recipientProjectId'))c.recipientProjectId=f.get('recipientProjectId');}
 if(type==='link')c.url=f.get('url')||'';
 if(type==='attachment'){c.fileId=f.get('fileId')||'';if(f.get('url'))c.url=f.get('url');}
 if(type==='attendance')c.lectureIds=f.getAll('lectureIds');
 // A task that names its proof kinds: a file, a link and/or text, plus the checklist when it has one.
 if(type==='proof'){if(form.querySelector('[name=checked]'))c.checked=[...form.querySelectorAll('[name=checked]')].map(x=>x.checked);if(f.get('fileId'))c.fileId=f.get('fileId');if(f.get('url'))c.url=f.get('url');if(form.elements.text)c.text=f.get('text')||'';}
 return c;
}

// A submission notice names the task and its points and opens it; older notices keep the short text.
function noteText(n){
 const k=n.kind.replace('.','_'),p=n.payload||{};
 if(!p.task||!T['nt_'+k])return esc(tr('n_'+k));
 const text=tr('nt_'+k).replace('{task}',pick(p.task)).replace('{xp}',p.xp??0).replace('{pts}',pgPlural('xp',Number(p.xp)||0));
 return p.assignmentId?`<a href="#/account/task/${esc(p.assignmentId)}">${esc(text)}</a>`:esc(text);
}
// Private messages and group chats: organisers never read them; anyone in a conversation can report one message or block a person.
// The list and the conversations are messenger.js (BirdMessenger.app); these pages keep what a chat app puts in settings:
// starting a group chat, and a group's members, name and leaving.
const who=p=>`${esc(p.name)}${p.organiser?` <span class="acc-chip">${tr('dmOrganiser')}</span>`:''}${p.waiting?` <span class="acc-chip">${tr('dmNotJoined')}</span>`:''}${p.team?`<small>${esc(p.team)}</small>`:''}`;
const msgBack=(h,label)=>`<a class="acc-back" href="${h}">← ${esc(label)}</a>`;
async function messagesView(a,b,c){
 if(a==='new-group')return newGroupView();
 if(a==='g'&&b&&c==='info')return groupInfoView(b);
 return shell('messages',`<div class="acc-msgr" data-msgr-app data-route="${esc([a,b].filter(Boolean).join('/'))}"></div>`);
}
async function newGroupView(){
 const q=cache.dmQuery||'',picked=cache.groupPick||(cache.groupPick=new Map());
 const found=q?await api('GET','/api/messages/people?q='+encodeURIComponent(q)):null;
 return shell('messages',`${msgBack('#/account/messages',tr('dmTab'))}<section class="acc-card"><h2>${tr('groupNew')}</h2><form data-form="dm-find" class="acc-inline">${field('q',tr('dmFind'),{value:q,attrs:'maxlength="60" autocomplete="off"'})}<button class="acc-secondary">${tr('dmSearch')}</button></form>${found?(found.items.filter(p=>!p.waiting).length?`<ul class="acc-list acc-dm-people">${found.items.filter(p=>!p.waiting).map(p=>`<li><span>${who(p)}</span><button class="acc-link" data-act="group-pick" data-id="${esc(p.id)}" data-name="${esc(p.name)}" ${picked.has(p.id)?'disabled':''}>${tr(picked.has(p.id)?'groupPicked':'groupAdd')}</button></li>`).join('')}</ul>`:empty()):''}
  ${picked.size?`<form data-form="group-new" class="acc-dm-new-group"><p class="acc-actions">${[...picked].map(([id,name])=>`<button type="button" class="acc-chip" data-act="group-unpick" data-id="${esc(id)}" aria-label="${esc(tr('remove')+' '+name)}">${esc(name)} ×</button>`).join('')}</p>${field('title',tr('groupTitle'),{required:true,attrs:'maxlength="80"'})}<button class="acc-primary">${tr('groupCreate')}</button></form>`:`<p class="acc-small">${tr('groupHint')}</p>`}</section>`);
}
async function groupInfoView(id){
 const t=await api('GET','/api/messages/groups/'+encodeURIComponent(id));
 const q=cache.groupQuery||'',found=t.owner&&q?await api('GET','/api/messages/people?q='+encodeURIComponent(q)):null,inside=new Set(t.members.map(m=>m.id));
 return shell('messages',`${msgBack('#/account/messages/g/'+esc(id),t.group.everyone?tr('everyoneChat'):t.group.title)}<section class="acc-card acc-dm"><div class="acc-card-head"><h2>${I(t.group.everyone?'globe':'team')} ${esc(t.group.everyone?tr('everyoneChat'):t.group.title)}<small>${t.group.team?tr('teamChat')+' · ':''}${tr('groupPeople')}: ${t.group.members}</small></h2>${t.group.team||t.group.everyone?'':`<button class="acc-secondary" data-act="group-leave" data-id="${esc(id)}" data-user="${esc(me.id)}" data-confirm="${esc(tr('groupLeaveConfirm'))}">${tr('groupLeave')}</button>`}</div>
  ${t.owner?`<form data-form="group-rename" data-id="${esc(id)}" class="acc-inline">${field('title',tr('groupTitle'),{value:t.group.title,required:true,attrs:'maxlength="80"'})}<button class="acc-secondary">${tr('save')}</button></form><form data-form="group-find" class="acc-inline">${field('q',tr('groupAddPeople'),{value:q,attrs:'maxlength="60" autocomplete="off"'})}<button class="acc-secondary">${tr('dmSearch')}</button></form>${found?`<ul class="acc-list">${found.items.filter(p=>!p.waiting&&!inside.has(p.id)).map(p=>`<li><span>${who(p)}</span><button class="acc-secondary" data-act="group-add" data-id="${esc(id)}" data-user="${esc(p.id)}">${tr('groupAdd')}</button></li>`).join('')||`<li>${empty()}</li>`}</ul>`:''}`:t.group.team?`<p class="acc-small">${tr('teamChatNote')}</p>`:t.group.everyone?`<p class="acc-small">${tr('everyoneNote')}</p>`:''}
  <h3>${tr('groupMembers')}</h3><ul class="acc-list acc-dm-people">${t.members.map(m=>`<li><span>${who(m)}${m.owner?` <span class="acc-chip">${tr('groupOwner')}</span>`:''}</span>${m.id===me.id?'':`<span class="acc-actions"><a class="acc-link" href="#/account/messages/${esc(m.id)}">${tr('dmWrite')}</a>${t.owner?`<button class="acc-link" data-act="group-leave" data-id="${esc(id)}" data-user="${esc(m.id)}" data-confirm="${esc(tr('groupRemoveConfirm'))}">${tr('remove')}</button>`:''}</span>`}</li>`).join('')}</ul>
  <p class="acc-small">${tr('groupPrivacy')}</p></section>`);
}
async function mentorsView(only){
 const [all,projects,mentors,wallets,rewards,asks]=await Promise.all([api('GET','/api/office-hours'),api('GET','/api/projects?mine=1'),api('GET','/api/mentors'),api('GET','/api/wallet'),api('GET','/api/rewards'),api('GET','/api/meeting-requests')]);
 const slots={items:only?all.items.filter(x=>x.mentorId===only):all.items};
 const chosen=mentors.items.find(m=>m.id===only);
 const cards=mentors.items.length?`<div class="acc-mentors m-mentors">${mentors.items.map(m=>`<a class="acc-mentor m-mentor m-rise ${m.id===only?'is-selected':''}" href="#/account/mentors${m.id===only?'':'/'+esc(m.id)}" ${m.id===only?'aria-current="true"':''}>${window.BirdCharacter?`<span class="m-mentor-char">${window.BirdCharacter.html([{id:m.id,name:'',decorative:true}],{size:'xs'})}</span>`:`<span class="m-ava">${esc(initialsOf(m.name))}</span>`}<span class="m-mentor-text"><strong>${esc(m.name)}</strong><small>${esc(m.area)}</small></span><span class="m-slotdots" title="${m.freeSlots} ${esc(pgPlural('freeSlots',m.freeSlots))}">${m.freeSlots?'<i></i>'.repeat(Math.min(m.freeSlots,5)):'<i class="is-none"></i>'}<small>${m.freeSlots}</small></span></a>`).join('')}</div>`:'';
 const teams=projects.items.filter(p=>['owner','editor','member'].includes(p.role)&&p.status!=='archived');
 const byDay={};for(const x of slots.items){const d=x.startsAt.slice(0,10);(byDay[d]||=[]).push(x);}
 const future=x=>Date.parse(x.startsAt)>Date.now();
 const purse=Object.fromEntries(wallets.items.map(w=>[w.projectId,w])),rich=price=>teams.filter(p=>(purse[p.id]?.balance??0)>=price);
 const pts=n=>`${n} ${pgPlural('xp',n)}`;
 const price=wallets.sessionPrice;
 const walletCard=wallets.items.length?`<section class="acc-card acc-wallet m-wallet m-rise"><h2><span aria-hidden="true">${I('coin')}</span> ${tr('walletTitle')}</h2><ul class="m-coins">${wallets.items.map(w=>{const n=price?Math.floor(Math.max(0,w.balance)/price):0;return `<li><div class="m-coin-top"><strong>${esc(w.name)}</strong><span class="m-coin">${mNum(w.balance)}<small>${esc(pgPlural('xp',w.balance))}</small></span></div>${bar(price?w.balance/price*100:100,w.balance>=price?'is-ok':'',tr('pointsMeeting'))}<small>${n?`<span class="m-tickets" aria-hidden="true">${I('ticket').repeat(Math.min(n,5))}</span> ${esc(tr('mMeetings').replace('{n}',n))}`:esc(tr('pointsToMeeting').replace('{n}',price-Math.max(0,w.balance)))} · ↑${w.earned} ↓${w.spent}</small>${w.history.length?`<details class="acc-history m-more"><summary>${tr('walletHistory')}</summary><ul class="acc-list">${w.history.map(h=>`<li><span>${h.kind==='meeting'?`${tr('meetRequest')}${h.label?' · '+esc(h.label):''} · ${tr('meet_'+h.status)}`:`${esc(h.label)}${h.status&&h.status!=='approved'?' · '+tr('order_'+h.status):''}`}</span><small>${h.refunded?tr('walletRefunded'):'−'+h.amount} · ${date(h.created)}</small></li>`).join('')}</ul></details>`:''}</li>`;}).join('')}</ul><details class="m-more"><summary>${tr('pointsWhat')}</summary><p class="acc-small">${tr('walletNote')}</p></details></section>`:'';
 const bookForm=x=>{const ok=rich(x.price);return `<form data-form="book" data-id="${esc(x.id)}" class="m-slot-form">${ok.length>1?select('projectId',tr('project'),ok.map(p=>[p.id,p.name]),ok[0].id):`<input type="hidden" name="projectId" value="${esc(ok[0].id)}">`}${field('question',tr('question'),{attrs:'maxlength="500"'})}<button class="acc-primary">${tr('book')} · ${pts(x.price)}</button></form>`;};
 // No free slot that suits: the team asks, organisers agree a time with the mentor.
 const askForm=mentorId=>{if(!teams.length)return '';const ok=rich(price);if(!ok.length)return `<p><span class="acc-chip">${I('lock')} ${tr('needPoints')}: ${pts(price)}</span> <a href="#/account/tasks">${tr('pointsTasks')} →</a></p>`;
  return `<form data-form="meet-ask" class="acc-compact">${ok.length>1?select('projectId',tr('project'),ok.map(p=>[p.id,p.name]),ok[0].id):`<input type="hidden" name="projectId" value="${esc(ok[0].id)}">`}${mentorId?`<input type="hidden" name="mentorId" value="${esc(mentorId)}">`:select('mentorId',tr('mentors'),[['',tr('meetAnyMentor')],...mentors.items.map(m=>[m.id,m.name+' · '+m.area])],'')}${field('topic',tr('meetTopic'),{type:'textarea',required:true,attrs:'rows="2" maxlength="500"'})}${field('times',tr('meetTimes'),{attrs:'maxlength="300"'})}<button class="acc-primary">${tr('meetAsk')} · ${pts(price)}</button></form>`;};
 const askCard=`<details class="acc-card m-more m-rise" id="meet-ask" ${chosen&&!chosen.freeSlots?'open':''}><summary>${I('hand')} ${tr('meetAsk')}${chosen?' · '+esc(chosen.name):''}</summary><p class="acc-muted">${tr('meetAskNote').replace('{n}',price)}</p>${askForm(chosen?.id)}</details>`;
 const askList=asks.items.length?`<section class="acc-card m-rise"><h2>${tr('meetRequests')}</h2><ul class="acc-list">${asks.items.map(r=>`<li><div><strong>${esc(r.mentorName||tr('meetAnyMentor'))} · ${esc(r.projectName)}</strong><small>${esc(r.topic)}${r.times?' · '+esc(r.times):''}</small></div><span class="acc-actions"><span class="acc-chip is-${r.status==='arranged'?'accepted':r.status==='pending'?'pending':'rejected'}">${tr('meet_'+r.status)}</span>${r.status==='pending'?`<button class="m-mini" data-act="meet-withdraw" data-id="${esc(r.id)}" data-confirm="${esc(tr('meetWithdrawConfirm'))}">${tr('meetWithdraw')}</button>`:''}</span></li>`).join('')}</ul></section>`:'';
 const rewardList=rewards.items.length?`<section class="m-rise"><div class="acc-card-head"><h2>${I('gift')} ${tr('rewardsTitle')}</h2><small class="acc-muted">${tr('rewardsNote')}</small></div><ul class="m-shop">${rewards.items.map(r=>{const ok=rich(r.price);return `<li class="m-rise ${r.left===0?'is-out':''}"><div class="m-pick-top"><strong>${esc(r.title)}</strong><span class="m-pts">${r.price}</span></div>${r.description?`<small class="m-clamp">${esc(r.description)}</small>`:''}${r.left!==null?`<small class="acc-muted">${tr('rewardLeft')}: ${r.left}</small>`:''}${r.left===0?`<span class="acc-chip">${tr('soldOut')}</span>`:!teams.length?'':ok.length?`<details class="m-more"><summary>${tr('rewardOrder')}</summary><form data-form="reward-order" data-id="${esc(r.id)}">${ok.length>1?select('projectId',tr('project'),ok.map(p=>[p.id,p.name]),ok[0].id):`<input type="hidden" name="projectId" value="${esc(ok[0].id)}">`}${field('note',tr('rewardNote'),{attrs:'maxlength="300"'})}<button class="acc-secondary" data-confirm="${esc(tr('rewardConfirm').replace('{n}',r.price))}">${tr('rewardOrder')} · ${pts(r.price)}</button></form></details>`:`<span class="acc-chip">${I('lock')} ${tr('needPoints')}: ${pts(r.price)}</span>`}</li>`;}).join('')}</ul></section>`:'';
 const time=x=>new Intl.DateTimeFormat(loc[lang],{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Zagreb'}).format(new Date(x.startsAt));
 const day=d=>new Intl.DateTimeFormat(loc[lang],{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/Zagreb'}).format(new Date(d+'T12:00:00Z'));
 const info=x=>`<small>${esc(x.topic)}${x.topic?' · ':''}${x.durationMin} min${x.location?' · '+esc(x.location):''}</small>`;
 const chip=x=>{
  const head=`<b>${time(x)}</b><span class="m-slot-who">${esc(x.mentorName)}</span>`;
  if(x.mine)return `<details class="m-slot is-mine"><summary>${head}<span class="m-slot-tag">✓ ${tr('mYours')}</span></summary><div class="m-slot-pop">${info(x)}<small>${esc(x.projectName)}${x.question?' · '+esc(x.question):''}</small>${future(x)?`<button class="m-mini" data-act="unbook" data-id="${esc(x.id)}">${tr('cancelBooking')}</button>`:`<form data-form="meeting-note" data-id="${esc(x.id)}" class="acc-inline">${field('note',tr('meetingNote'),{value:x.note,attrs:'maxlength="2000"'})}<button class="acc-secondary">${tr('save')}</button></form>`}</div></details>`;
  if(x.booked)return `<div class="m-slot is-taken" title="${esc(tr('bookedOther'))}">${head}<span class="m-slot-tag">${tr('bookedOther')}</span></div>`;
  if(!future(x)||!teams.length)return `<div class="m-slot is-past">${head}${info(x)}</div>`;
  if(!rich(x.price).length)return `<div class="m-slot is-locked">${head}<span class="m-slot-tag">${I('lock')} ${pts(x.price)}</span></div>`;
  return `<details class="m-slot is-free"><summary>${head}<span class="m-pts">${x.price}</span></summary><div class="m-slot-pop">${info(x)}${bookForm(x)}</div></details>`;
 };
 const days=Object.keys(byDay).length?`<section class="acc-card m-rise"><h2><span aria-hidden="true">${I('calendar')}</span> ${tr('mSlots')}${chosen?' · '+esc(chosen.name):''}</h2><div class="m-days">${Object.entries(byDay).map(([d,list])=>`<div class="m-day"><span class="m-day-label">${day(d)}</span><div class="m-slots">${list.map(chip).join('')}</div></div>`).join('')}</div></section>`:`<section class="acc-card">${empty()}</section>`;
 const chosenCard=chosen?`<section class="acc-card m-chosen m-rise"><span class="m-ava is-big">${esc(initialsOf(chosen.name))}</span><div><h2>${esc(chosen.name)}</h2><span class="m-tag">${esc(chosen.area)}</span>${chosen.bio?`<p>${esc(chosen.bio)}</p>`:''}${chosen.link?`<p><a href="${esc(chosen.link)}" target="_blank" rel="noopener noreferrer">${esc(chosen.link)}</a></p>`:''}</div></section>`:'';
 return shell('mentors',`${cards}${chosenCard}<div class="m-cols"><div class="m-col">${days}${askList}${teams.length?askCard:''}</div><div class="m-col">${walletCard}</div></div>${rewardList}<p class="acc-small">${tr('officeNote')}</p>`);
}
// Points over time as steps: each earning lifts the line.
function steps(hist,total,label){
 const ev=[...hist].reverse();let v=total-ev.reduce((s,h)=>s+h.amount,0);const pts=[[0,v]];ev.forEach((h,i)=>{v+=h.amount;pts.push([i+1,v]);});
 const n=Math.max(1,pts.length-1),max=Math.max(1,...pts.map(p=>p[1])),min=Math.min(0,...pts.map(p=>p[1]));
 const X=i=>10+i/n*580,Y=y=>110-(y-min)/(max-min||1)*96;
 let d=`M${X(0)},${Y(pts[0][1])}`;for(let i=1;i<pts.length;i++)d+=` H${X(i)} V${Y(pts[i][1])}`;
 const area=`${d} H590 V110 H10 Z`;
 return `<svg class="m-steps" viewBox="0 0 600 120" role="img" aria-label="${esc(label)}: ${total}"><line x1="10" y1="110" x2="590" y2="110" class="m-axis"/><path class="m-area" d="${area}"/><path class="m-line" pathLength="1" d="${d} H590"/>${ev.map((h,i)=>`<circle class="m-pt" cx="${X(i+1)}" cy="${Y(pts[i+1][1])}" r="5"><title>${h.amount>0?'+':''}${h.amount} · ${prettyReason(h.reason)} · ${date(h.created)}</title></circle>`).join('')}</svg>`;
}
// Points history labels share ledgerLabel (already escaped), so task titles appear in the reader's language.
let reasonTasks=[];
const prettyReason=r=>ledgerLabel(r,reasonTasks);
const gains=hist=>`<ul class="m-gains">${hist.slice(0,6).map(h=>`<li class="${h.amount<0?'is-minus':''}"><b>${h.amount>0?'+':''}${h.amount}</b> ${prettyReason(h.reason)}</li>`).join('')}</ul>`;
async function progressView(){
 const [p,rank,lectures,mine_tasks]=await Promise.all([api('GET','/api/progress'),api('GET','/api/teams/ranking'),api('GET','/api/lectures').catch(()=>({items:[],today:''})),api('GET','/api/tasks').catch(()=>({items:[]}))]);
 reasonTasks=mine_tasks.items.map(a=>({taskId:a.task.id,key:a.task.key,title:a.task.translations}));
 const mine=new Set(p.teams.map(t=>t.projectId));
 const myTeam=p.teams[0],big=myTeam?myTeam.xp:p.xp;
 const lv=level(big),place=rank.items.findIndex(t=>mine.has(t.projectId));
 // Lectures before the participant joined are shown as "before you joined", never as missed.
 const before=l=>!l.attendance&&lectures.since&&l.date<lectures.since;
 const past=lectures.items.filter(l=>l.date<=lectures.today&&!before(l)),went=past.filter(l=>l.attendance).length;
 const dot=l=>{const k=l.date>lectures.today?'next':l.attendance?(l.attendance.kind==='verified_by_admin'?'verified':'self'):before(l)?'before':'missed';const word=tr({next:'mUpcoming',verified:'verified',self:'selfReported',missed:'mMissed',before:'beforeJoined'}[k]);return `<li class="m-rise is-${k}" title="${esc(pick(l.title))} · ${date(l.date)} · ${esc(word)}"><span class="m-dot" aria-hidden="true">${k==='verified'?'✓':k==='self'?'·':''}</span><small>${new Intl.DateTimeFormat(loc[lang],{day:'numeric',month:'short'}).format(new Date(l.date+'T12:00:00Z'))}</small><span class="m-sr">${esc(pick(l.title))}: ${esc(word)}</span></li>`;};
 const top=`<section class="m-hero is-slim m-rise"><div class="m-lv-big"><small>${tr('mLevel')}</small><b>${lv.n}</b></div><div class="m-hero-main"><div class="m-xp"><div class="m-xp-top"><span>${mNum(big,'is-xp')} <small>${esc(pgPlural('xp',big))}${myTeam?' · '+esc(tr('teamPointsOf').replace('{team}',myTeam.name)):''}</small></span><small>${esc(tr('mToNext').replace('{n}',lv.b-big).replace('{l}',lv.n+1))}</small></div>${bar(lv.pct,'is-xp')}${myTeam?`<small class="m-own">${esc(tr('myOwnPoints').replace('{n}',p.xp))}</small>`:''}</div><ul class="m-stats"><li class="m-stat"><span class="m-stat-icon" aria-hidden="true">${I('medal')}</span>${mNum(p.badges.length)}<small>/ ${p.available.length}</small></li><li class="m-stat"><span class="m-stat-icon" aria-hidden="true">${I('cap')}</span>${mNum(went)}<small>/ ${past.length}</small></li>${rank.items[place]?.place?`<li class="m-stat"><span class="m-stat-icon" aria-hidden="true">${I('trophy')}</span><b class="m-num">#${rank.items[place].place}</b><small>/ ${rank.items.length}</small></li>`:''}</ul></div></section>`;
 const chart=`<section class="acc-card m-rise"><h2>${tr('mPointsOverTime')}</h2><div class="m-series"><div class="m-serie is-me"><div class="m-serie-head"><span>${esc(tr('myPoints'))}</span>${mNum(p.xp)}</div>${steps(p.history,p.xp,tr('myPoints'))}${gains(p.history)}</div>${p.teams.map(t=>`<div class="m-serie is-team"><div class="m-serie-head"><span>${I('team')} ${esc(t.name)}</span>${mNum(t.xp)}</div>${steps(t.history,t.xp,t.name)}${gains(t.history)}</div>`).join('')}</div></section>`;
 const badges=`<section class="acc-card m-rise"><div class="acc-card-head"><h2>${tr('badges')}</h2><b class="m-frac">${p.badges.length}<small>/${p.available.length}</small></b></div>${badgeGrid(p)}</section>`;
 const attend=lectures.items.length?`<section class="acc-card m-rise"><div class="acc-card-head"><h2>${tr('mAttendance')}</h2><b class="m-frac">${went}<small>/${past.length}</small></b></div><ol class="m-dots">${lectures.items.map(dot).join('')}</ol><ul class="m-legend is-dots"><li class="is-verified"><i aria-hidden="true"></i>${tr('verified')}</li><li class="is-self"><i aria-hidden="true"></i>${tr('selfReported')}</li><li class="is-missed"><i aria-hidden="true"></i>${tr('mMissed')}</li><li class="is-next"><i aria-hidden="true"></i>${tr('mUpcoming')}</li></ul></section>`:'';
 const ranking=`<section class="acc-card acc-ranking m-rise"><h2>${tr('ranking')}</h2>${rankList(rank,mine)}<details class="m-more"><summary>${tr('rules')}</summary><p class="acc-muted">${tr('rankingRules')}</p></details></section>`;
 return shell('progress',`${top}<div class="m-cols"><div class="m-col">${chart}${attend}</div><div class="m-col">${badges}${ranking}</div></div>`);
}
async function characterView(){
 const c=await api('GET','/api/me/character'),p=c.person;
 const stage=window.BirdCharacter?BirdCharacter.html([{id:p.id||me.personId,name:p.displayName}],{size:'lg'}):'';
 return shell('character',`<div class="m-char m-rise"><div class="m-char-stage">${stage}${window.BirdDemoJoin?.accountLink(me,lang)||''}<p>${statusChip(p.confirmed?'approved':'pending')} <small>${tr(p.confirmed?'confirmed':'visitor')}</small></p>${p.confirmed?`<a class="acc-secondary" href="#/office/${esc(window.BirdProjects?.person(p.id)?.projectIds?.[0]||'')}/${esc(p.id)}" data-act="office-me">${I('office')} ${tr('showInOffice')} →</a>`:''}</div>
 <section class="acc-card"><form data-form="character">${p.confirmed?`<h2>${esc(p.displayName)}</h2>${field('publicRole',tr('publicRole'),{value:p.publicRole,attrs:'maxlength="80"'})}<details class="m-more"><summary>${I('palette')} ${tr('appearanceRequest')}</summary><p class="acc-small">${tr('appearanceNote')}</p>${field('appearanceRequest',tr('appearanceRequest'),{type:'textarea',attrs:'rows="2" maxlength="500"'})}</details>`:`${field('displayName',tr('displayName'),{value:p.displayName,required:true,attrs:'maxlength="80"'})}${select('appearance',tr('appearance'),['','woman','man'].map(v=>[v,tr('app_'+v)]),p.appearance||'')}`}<button class="acc-primary">${tr('save')}</button></form>
 <h3>${I('camera')} ${tr('reference')}</h3><form data-form="reference" class="m-row"><input type="file" name="file" accept="image/png,image/jpeg,image/webp"><button class="acc-secondary">${tr('upload')}</button></form>${c.references.length?`<ul class="acc-list">${c.references.map(r=>`<li><span>${esc(r.filename)}</span><small>${date(r.created)}</small></li>`).join('')}</ul>`:''}</section></div>`);
}

async function settingsView(){
 const s=await api('GET','/api/auth/sessions');
 return shell('settings',`<div class="acc-grid"><section class="acc-card m-rise"><h2>${I('person')} ${tr('settings')}</h2><form data-form="profile">${field('displayName',tr('displayName'),{value:me.displayName,required:true,attrs:'maxlength="80"'})}${field('email',tr('email'),{type:'email',value:me.email,hint:tr('emailNote')})}${select('language',tr('language'),[['en','English'],['hr','Hrvatski'],['ru','Русский']],me.language)}<label class="acc-check"><input type="checkbox" name="leaderboardOptIn" ${me.leaderboardOptIn?'checked':''}> ${tr('leaderboard')}</label><small class="acc-muted">${tr('leaderboardNote')}</small><button class="acc-primary">${tr('save')}</button></form></section>
 <section class="acc-card m-rise"><h2>${I('mail')} ${tr('emailTitle')}</h2><form data-form="email-prefs"><p class="acc-muted">${tr('emailPrefsNote')}</p><label class="acc-check"><input type="checkbox" name="emailMessages" ${me.emailMessages?'checked':''}> ${tr('emailMessages')}</label><label class="acc-check"><input type="checkbox" name="emailReminders" ${me.emailReminders?'checked':''}> ${tr('emailReminders')}</label>${me.email?'':`<p class="acc-note">${tr('emailNeeded')}</p>`}<button class="acc-secondary">${tr('save')}</button></form></section>
 <section class="acc-card m-rise"><h2>${I('laptop')} ${tr('sessions')} <span class="m-count">${s.items.length}</span></h2><ul class="acc-list">${s.items.map(x=>`<li><div><strong>${esc(x.device)}</strong>${x.current?` <small>(${tr('thisDevice')})</small>`:''}<small>${date(x.lastSeen,true)}</small></div><button class="m-mini" data-act="session" data-id="${esc(x.id)}">${tr('revoke')}</button></li>`).join('')}</ul><div class="acc-actions"><button data-act="logout">${tr('signOut')}</button><button data-act="logout-all">${tr('signOutAll')}</button></div></section>
 <section class="acc-card m-rise"><h2>${I('key')} ${tr('password')}</h2><form data-form="password">${field('currentPassword',tr('currentPassword'),{type:'password',required:true,attrs:'autocomplete="current-password"'})}${field('newPassword',tr('newPassword'),{type:'password',required:true,hint:tr('passwordHint'),attrs:'autocomplete="new-password" minlength="10"'})}<button class="acc-secondary">${tr('save')}</button></form>
 <details class="m-more m-codes"><summary>${tr('newCodes')}</summary><form data-form="codes">${field('currentPassword',tr('currentPassword'),{type:'password',required:true,attrs:'autocomplete="current-password"'})}<button class="acc-secondary">${tr('newCodes')}</button></form></details></section></div>`);
}

// Project cabinet ------------------------------------------------------------------------
const FIELDS=['name','short','problem','users','solution','value','ask','nextSteps','details'];
// One stage list for every hub (server/stages.mjs). Old keys from a draft kept in this tab map like the server does.
const STAGES=window.BIRD_STAGES||['idea','prototype','mvp','product','first_customer','revenue','scaling'],ROUNDS=window.BIRD_ROUNDS||['none','pre_seed','seed','series_a'];
const OLD_STAGE={research:'idea',discovery:'idea',pilot:'mvp',launched:'product'};
const stageKey=s=>STAGES.includes(s)?s:OLD_STAGE[s]||'idea';
const stageLabel=s=>tr('stage_'+stageKey(s));
const eur=n=>n===null||n===undefined?'—':new Intl.NumberFormat(loc[lang]).format(n)+' €';
// Required on save: a new project starts with nothing ticked, so the team picks what is true today.
const stagePicker=stage=>`<fieldset class="acc-field acc-stages"><legend>${tr('f_stage')} <span class="acc-req" aria-hidden="true">*</span></legend><p class="acc-muted">${tr('stageNote')}</p><ol class="acc-stage-list">${STAGES.map((s,i)=>`<li><label class="acc-stage"><input type="radio" name="stage" value="${s}" ${stage&&stageKey(stage)===s?'checked':''} required><span class="acc-stage-n" aria-hidden="true">${i+1}</span><span class="acc-stage-text"><strong>${tr('stage_'+s)}</strong><small>${tr('stageHint_'+s)}</small></span></label></li>`).join('')}</ol></fieldset>`;
const money=(name,label,value)=>field(name,label,{type:'number',value:value??'',attrs:'min="0" max="1000000000" step="1" inputmode="numeric" placeholder="0"'});
const fundingFields=(f={})=>`<fieldset class="acc-field acc-financing"><legend>${tr('financing')}</legend><p class="acc-muted">${tr('financingNote')}</p><div class="acc-fin-grid">${money('raisedEur',tr('f_raisedEur'),f.raisedEur)}${money('raisingEur',tr('f_raisingEur'),f.raisingEur)}${select('round',tr('f_round'),[['',tr('roundUnset')],...ROUNDS.map(r=>[r,tr('round_'+r)])],f.round||'')}</div><label class="acc-check acc-investors"><input type="checkbox" name="investorVisible" ${f.investorVisible?'checked':''}> <span><strong>${tr('investorVisible')}</strong><small>${tr('investorVisibleNote')}</small></span></label></fieldset>`;
const readFunding=form=>{const f=new FormData(form);return {raisedEur:f.get('raisedEur')||null,raisingEur:f.get('raisingEur')||null,round:f.get('round')||null,investorVisible:f.get('investorVisible')==='on'};};
const stageHistoryList=h=>h?.length?`<ol class="acc-stage-history">${h.map(x=>`<li><span><strong>${esc(stageLabel(x.stage))}</strong>${x.source==='migration'?`<small>${tr('stageMigrated')}</small>`:x.previous?`<small>← ${esc(stageLabel(x.previous))}</small>`:''}</span><small>${date(x.changedAt)}${x.by?' · '+esc(x.by):''}</small></li>`).join('')}</ol>`:'';
function projectForm(c,version,id,live=false,funding={}){
 return `<form data-form="project" data-id="${esc(id||'')}" data-version="${esc(version||'')}"><p class="acc-note">${tr('optional')}</p>${FIELDS.slice(0,2).map(k=>projectField(k,c)).join('')}${stagePicker(c?.stage)}${FIELDS.slice(2).map(k=>projectField(k,c)).join('')}${fundingFields(funding||{})}<fieldset class="acc-field"><legend>${tr('f_links')}</legend>${[0,1,2].map(i=>`<div class="acc-inline"><input name="linkLabel" placeholder="${tr('title')}" aria-label="${tr('f_links')} ${i+1}" value="${esc(c?.links?.[i]?.label||'')}" maxlength="80"><input name="linkUrl" type="url" placeholder="https://" aria-label="URL ${i+1}" value="${esc(c?.links?.[i]?.url||'')}" maxlength="500"></div>`).join('')}</fieldset><div class="acc-actions"><button class="acc-primary">${tr(id?(live?'saveChanges':'saveDraft'):'newProject')}</button>${id?`<button type="button" data-act="preview" class="acc-secondary">${tr('preview')}</button>`:''}</div></form>`;
}
function projectField(k,c){return field(k,tr('f_'+k),{type:k==='name'?'text':'textarea',value:c?.[k]||'',required:k==='name',attrs:k==='name'?'maxlength="100"':`rows="${k==='short'?2:4}" maxlength="${k==='details'?8000:3000}"`});}
function readProjectForm(form){const f=new FormData(form),c={};for(const k of FIELDS)c[k]=f.get(k)||'';c.stage=f.get('stage');const labels=f.getAll('linkLabel'),urls=f.getAll('linkUrl');c.links=urls.map((u,i)=>({label:labels[i]||'',url:u})).filter(l=>l.url);return c;}
function previewHtml(c){return `<article class="acc-preview"><span class="eyebrow">${esc(stageLabel(c.stage))}</span><h2>${esc(c.name)}</h2><p class="acc-lede">${esc(c.short)}</p>${FIELDS.slice(2).filter(k=>c[k]).map(k=>`<h3>${tr('f_'+k)}</h3><p class="acc-pre">${esc(c[k])}</p>`).join('')}${c.links?.length?`<ul>${c.links.map(l=>`<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(l.label||l.url)}</a></li>`).join('')}</ul>`:''}</article>`;}

const DRAFT_KEY=id=>'bird-project-draft:'+id;
async function projectView(id,tab='edit'){
 const {project:p}=await api('GET','/api/projects/'+encodeURIComponent(id));
 // An organiser who is not on the team reads the project; editing is a deliberate step ("Edit as admin").
 const asAdmin=isAdmin()&&!['owner','editor','member'].includes(p.access.role),adminEditing=asAdmin&&cache.adminEdit===id;
 if(asAdmin&&!adminEditing)p.access={...p.access,edit:false,manage:false};
 const adminBar=asAdmin?`<div class="acc-flash acc-admin-view" role="status"><span>${tr(adminEditing?'adminEditingNote':'adminReadNote')}</span><button type="button" class="acc-secondary" data-act="admin-edit" data-id="${esc(id)}" data-on="${adminEditing?'':'1'}">${tr(adminEditing?'adminEditStop':'adminEdit')}</button></div>`:'';
 const tabs=[['edit',tr('description')],['checkin',tr('checkin')],['files',tr('files')],['team',tr('members')],['updates',tr('updates')],['journal',tr('journal')],['history',tr('history')]];
 // The team's one points number comes with the project, for the team and for an organiser alike.
 const xp=p.points??0;
 let body='';
 if(tab==='edit'){
  let local=null;try{local=JSON.parse(sessionStorage.getItem(DRAFT_KEY(id))||'null');}catch{}
  const conflict=cache.conflict?.id===id?cache.conflict:null;cache.conflict=null;
  body=(conflict?`<div class="acc-flash is-error" role="alert">${tr('conflict')}<details open><summary>${tr('yourText')}</summary>${previewHtml(conflict.yours)}</details></div>`:'')+(p.access.edit?projectForm(local&&local.version===p.draftVersion?local.content:p.draft,p.draftVersion,id,p.status==='published',local&&local.version===p.draftVersion&&local.funding||p.funding)+`<div class="acc-card"><p class="acc-note">${tr('publishNote')}</p><button data-act="publish" data-id="${esc(id)}" data-version="${p.draftVersion}" class="acc-primary">${tr(p.status==='published'?'publishChanges':'publish')}</button>${p.access.manage?`<button data-act="${p.status==='archived'?'unarchive':'archive'}" data-id="${esc(id)}">${tr(p.status==='archived'?'unarchive':'archive')}</button>`:''}</div>`:previewHtml(p.draft||p.published))+(p.stageHistory?.length?`<section class="acc-card"><h2>${tr('stageHistory')}</h2>${stageHistoryList(p.stageHistory)}</section>`:'');
 }else if(tab==='files'){
  const f=await api('GET',`/api/projects/${encodeURIComponent(id)}/files`);
  body=`${p.access.edit?`<form data-form="upload" data-id="${esc(id)}" class="acc-card"><p class="acc-note">${tr('uploadHint')}</p><input type="file" name="file" accept="${PROOF_ACCEPT}" required><button class="acc-primary">${tr('upload')}</button></form>`:''}<div class="m-usage">${bar(f.limitBytes?f.usedBytes/f.limitBytes*100:0,f.usedBytes>f.limitBytes*.85?'is-risk':'',tr('used'))}<small>${tr('used')}: ${size(f.usedBytes)} / ${size(f.limitBytes)}</small></div>${f.items.length?`<ul class="acc-list">${f.items.map(x=>`<li><div><a href="/api/files/${esc(x.id)}" download>${esc(x.filename)}</a><small>${size(x.size)} · ${date(x.created)} · ${tr('notScanned')}</small></div>${p.access.edit?`<span class="acc-actions"><select data-act="visibility" data-id="${esc(x.id)}" aria-label="${tr('status')}">${['private','team','reviewer','public'].map(v=>`<option value="${v}" ${x.visibility===v?'selected':''}>${tr('vis_'+v)}</option>`).join('')}</select><button data-act="file-delete" data-id="${esc(x.id)}">${tr('remove')}</button></span>`:`<small>${tr('vis_'+x.visibility)}</small>`}</li>`).join('')}</ul>`:empty()}`;
 }else if(tab==='team'){
  // Any editor on the team invites teammates (roster teams have no owner); roles and removal stay with the owner.
  const invites=p.access.edit?await api('GET','/api/invites?projectId='+encodeURIComponent(id)):{items:[]};
  body=`<ul class="acc-list">${(p.members||[]).map(m=>`<li><div><strong>${esc(m.displayName)}</strong><small>${esc(tr('role_'+m.role))}</small></div>${p.access.manage&&m.userId!==me.id?`<span class="acc-actions"><select data-act="member-role" data-project="${esc(id)}" data-user="${esc(m.userId)}" aria-label="${tr('roleChange')}">${['owner','editor','member'].map(r=>`<option value="${r}" ${m.role===r?'selected':''}>${tr('role_'+r)}</option>`).join('')}</select><button data-act="member-remove" data-project="${esc(id)}" data-user="${esc(m.userId)}">${tr('remove')}</button></span>`:''}</li>`).join('')}</ul>
  ${p.access.edit?`<form data-form="project-invite" data-id="${esc(id)}" class="acc-card">${select('role',tr('roleChange'),[['editor',tr('role_editor')],['member',tr('role_member')]],'editor')}<button class="acc-secondary">${tr('invite')}</button></form>${inviteBox(cache.newInvite)}<ul class="acc-list">${invites.items.filter(i=>!i.used&&!i.revoked).map(i=>`<li><span>${tr('role_'+i.role)} · ${date(i.expires)}</span><button data-act="invite-revoke" data-id="${esc(i.id)}">${tr('revoke')}</button></li>`).join('')}</ul>`:''}`;
  cache.newInvite=null;
 }else if(tab==='updates'){
  const u=await api('GET',`/api/projects/${encodeURIComponent(id)}/updates`);const helpList=await api('GET','/api/help');
  body=`${p.access.edit?`<form data-form="update" data-id="${esc(id)}" class="acc-card">${field('body',tr('postUpdate'),{type:'textarea',required:true,attrs:'rows="3" maxlength="3000"'})}${select('visibility',tr('status'),[['public',tr('vis_public')],['team',tr('vis_team')]],'public')}<button class="acc-primary" data-key="${idem()}">${tr('postUpdate')}</button></form>`:''}${u.items.length?`<ul class="acc-list">${u.items.map(x=>`<li><div><p class="acc-pre">${esc(x.body)}</p><small>${esc(x.author)} · ${date(x.created,true)} · ${tr('vis_'+x.visibility)}</small></div></li>`).join('')}</ul>`:empty()}
  <section class="acc-card"><h2>${tr('help')}</h2>${p.access.edit?`<form data-form="help" data-id="${esc(id)}" class="acc-inline">${select('kind',tr('type'),[['offer',tr('offer')],['ask',tr('ask')]],'offer')}${field('body',tr('note'),{attrs:'maxlength="500" required'})}<button class="acc-secondary">${tr('save')}</button></form>`:''}<ul class="acc-list">${helpList.items.filter(h=>h.projectId===id).map(h=>`<li><span><strong>${tr(h.kind)}</strong> ${esc(h.body)}</span>${p.access.edit?`<button data-act="help-close" data-id="${esc(h.id)}">${tr('close')}</button>`:''}</li>`).join('')}</ul></section>`;
 }else if(tab==='journal'){
  const j=await api('GET',`/api/projects/${encodeURIComponent(id)}/journal`);
  const oc=await api('GET',`/api/projects/${encodeURIComponent(id)}/outcomes`).catch(()=>({items:[]}));
  body=`<section class="acc-card"><h2>${tr('outcomes')}</h2><p class="acc-muted">${tr('outcomesNote')}</p>${p.access.edit?`<form data-form="outcome" data-id="${esc(id)}" class="acc-inline">${select('kind',tr('type'),['funding','customer','revenue','hire','company'].map(k=>[k,tr('oc_'+k)]),'funding')}${select('fundingType',tr('fundingType'),['grant','equity','loan','prize','other'].map(k=>[k,tr('ft_'+k)]),'grant')}${field('amount',tr('amount'),{type:'number',attrs:'min="0" step="1"'})}${field('happenedOn',tr('lectureDate'),{type:'date',value:new Date().toISOString().slice(0,10)})}${field('note',tr('note'),{attrs:'maxlength="300"'})}<button class="acc-secondary">${tr('save')}</button></form>`:''}<ul class="acc-list">${oc.items.map(o=>`<li><span><strong>${tr('oc_'+o.kind)}</strong>${o.fundingType?' · '+tr('ft_'+o.fundingType):''}${o.amount!==null?' · '+esc(o.amount)+(['funding','revenue'].includes(o.kind)?' €':''):''} · ${date(o.happenedOn)}${o.note?' · '+esc(o.note):''}</span>${p.access.edit?`<button data-act="outcome-delete" data-project="${esc(id)}" data-id="${esc(o.id)}">${tr('remove')}</button>`:''}</li>`).join('')}</ul></section><section class="acc-card"><h2>${tr('milestone')}</h2>${p.access.edit?`<form data-form="milestone" data-id="${esc(id)}" class="acc-inline">${field('title',tr('title'),{required:true,attrs:'maxlength="200"'})}${field('due',tr('due'),{type:'date'})}<button class="acc-secondary">${tr('save')}</button></form>`:''}<ul class="acc-list">${j.milestones.map(m=>`<li><span>${esc(m.title)}${m.due?' · '+date(m.due):''}</span>${m.doneAt?statusChip('accepted'):p.access.edit?`<button data-act="milestone-done" data-project="${esc(id)}" data-id="${esc(m.id)}">${tr('done')}</button>`:''}</li>`).join('')}</ul></section>
  <section class="acc-card"><h2>${tr('metric')}</h2>${p.access.edit?`<form data-form="metric" data-id="${esc(id)}" class="acc-inline">${field('name',tr('metricName'),{required:true,attrs:'maxlength="80"'})}${field('value',tr('metricValue'),{required:true,attrs:'maxlength="80"'})}${field('measuredOn',tr('lectureDate'),{type:'date',value:new Date().toISOString().slice(0,10)})}${select('visibility',tr('status'),[['team',tr('vis_team')],['public',tr('vis_public')]],'team')}<button class="acc-secondary">${tr('save')}</button></form>`:''}<ul class="acc-list">${j.metrics.map(m=>`<li><span><strong>${esc(m.name)}</strong> ${esc(m.value)}</span><small>${date(m.measuredOn)} · ${esc(m.author)} · ${tr('vis_'+m.visibility)}</small></li>`).join('')}</ul></section>`;
 }else if(tab==='checkin'){
  const c=await api('GET',`/api/projects/${encodeURIComponent(id)}/checkins`);const now=c.items.find(i=>i.week===c.week)||{};
  body=`<section class="acc-card"><div class="acc-card-head"><h2>${tr('checkin')} · ${tr('week')} ${esc(c.week.split('-W')[1])}</h2><span class="m-flame ${c.streak?'is-on':''}" title="${esc(tr('streak'))}"><span aria-hidden="true">${I('flame')}</span> ${mNum(c.streak)} <small>${pgPlural('weeks',c.streak)}</small></span></div><p class="acc-note">${tr('checkinNote')}</p>${asAdmin&&!adminEditing?'':`<form data-form="checkin" data-id="${esc(id)}"><div class="acc-inline">${field('metricName',tr('metricOfWeek'),{value:now.metricName,attrs:'maxlength="80" placeholder="Interviews"'})}${field('metricValue',tr('metricValue'),{value:now.metricValue,attrs:'maxlength="80"'})}</div>${field('goal',tr('goal2w'),{type:'textarea',value:now.goal,required:true,attrs:'rows="2" maxlength="500"'})}${field('blocker',tr('blocker'),{type:'textarea',value:now.blocker,attrs:'rows="2" maxlength="500"'})}<label class="acc-check"><input type="checkbox" name="needsHelp" ${now.needsHelp?'checked':''}> ${tr('needsHelp')}</label><button class="acc-primary">${tr('save')}</button></form>`}</section>${c.items.length?`<ul class="acc-list">${c.items.map(i=>`<li><div><strong>${tr('week')} ${esc(i.week.split('-W')[1])}</strong>${i.metricName?` · ${esc(i.metricName)}: <b>${esc(i.metricValue)}</b>`:''}<small>${esc(i.goal)}${i.blocker?' · '+tr('blocker')+': '+esc(i.blocker):''}${i.needsHelp?' · '+tr('needsHelp'):''}</small></div><small>${esc(i.author)}</small></li>`).join('')}</ul>`:''}`;
 }else if(tab==='history'){
  const r=p.access.edit?await api('GET',`/api/projects/${encodeURIComponent(id)}/revisions`):{items:[]};
  body=r.items.length?`<ul class="acc-list">${r.items.map(x=>`<li><div><strong>v${x.version}</strong> ${statusChip(x.kind==='published'?'published':x.kind==='conflict'?'changes_requested':'draft')}<small>${esc(x.author)} · ${date(x.created,true)}</small><details><summary>${tr('preview')}</summary>${previewHtml(x.content)}</details></div><button data-act="restore" data-project="${esc(id)}" data-id="${x.id}">${tr('restore')}</button></li>`).join('')}</ul>`:empty();
 }
 return shell('overview',`<a class="acc-back" href="#/account">← ${tr('myProjects')}</a><div class="m-project-head m-rise"><span class="m-ava is-big">${esc(initialsOf((p.draft||p.published).name))}</span><div><h2 class="acc-project-title">${esc((p.draft||p.published).name)}</h2><span class="m-quest-meta">${statusChip(p.status)}<span class="m-tag">${esc(stageLabel((p.draft||p.published).stage))}</span></span></div><span class="m-coin acc-xp">${mNum(xp)}<small>${esc(pgPlural('xp',xp))}</small></span></div><nav class="acc-tabs acc-subtabs m-pills">${tabs.map(([k,l])=>`<a href="#/account/project/${esc(id)}/${k}" ${k===tab?'aria-current="page"':''}>${esc(l)}</a>`).join('')}</nav>${adminBar}${body}`);
}

// Admin ------------------------------------------------------------------------------
const ADMIN_GROUPS=[{label:'dashboard',tabs:['dashboard']},{label:'today',tabs:['today']},{label:'teamsNav',tabs:['overview','users','links','checkins','claims']},{label:'tasks',tabs:['tasks','reviews','import']},{label:'programme',tabs:['lectures','mentors','rewards','news','insights']},{label:'funderReport',tabs:['funder']},{label:'settings',tabs:['system','reports','audit']}];
const TAB_LABEL={reports:'tabModeration',overview:'teamsNav',news:'announcements',system:'settings'};
function adminShell(active,body){
 const group=ADMIN_GROUPS.find(g=>g.tabs.includes(active))||ADMIN_GROUPS[0];
 const link=(k,l,on)=>`<a href="#/admin/${k}" ${on?'aria-current="page"':''}>${esc(l)}</a>`;
 // Messages live in the organiser's own account; the badge says when someone wrote.
 const inbox=`<a href="#/account/messages" class="acc-tab-inbox">${esc(tr('dmTab'))} <b class="acc-dot" data-msgr-count ${cache.messages?'':'hidden'}>${cache.messages}</b></a>`;
 return shell('admin',`<nav class="acc-tabs acc-subtabs">${ADMIN_GROUPS.map(g=>link(g.tabs[0],tr(g.label),g===group)).join('')}${inbox}</nav>${group.tabs.length>1?`<nav class="acc-tabs acc-subtabs acc-subtabs-2">${group.tabs.filter(k=>k!=='links'||!document.body.classList.contains('is-demo')).map(k=>link(k,tr(TAB_LABEL[k]||k),k===active)).join('')}</nav>`:''}${body}`);
}
const recordTask=t=>`<li><a href="#/account/task/${esc(t.id)}"><strong>${esc(taskText(t.title))}</strong><small>${t.who?esc(t.who)+' · ':''}${t.xp} ${pgPlural('xp',t.xp)}${t.dueAt?' · '+tr('due')+' '+date(t.dueAt,true):''}${t.optional?' · '+tr('optionalTask'):''}</small></a>${statusChip(t.status)}</li>`;
const noteList=n=>n.length?`<ul class="acc-list">${n.map(x=>`<li><div>${esc(x.body)}<small>${esc(x.author||'')} · ${date(x.created,true)}</small></div></li>`).join('')}</ul>`:'';
// Points history: readable labels instead of source keys, newest first, a date only where it changes.
const prettyKey=v=>{const t=String(v).replace(/^task-/,'').replace(/[-_]+/g,' ').trim();return t.charAt(0).toUpperCase()+t.slice(1);};
function ledgerLabel(reason,tasks=[]){
 const s=String(reason||''),i=s.indexOf(':'),k=i<0?s:s.slice(0,i),v=i<0?'':s.slice(i+1);
 if(k==='task'){const t=tasks.find(t=>t.taskId===v||t.taskId==='task-'+v||t.key===v);const title=t&&taskText(t.title);return title?esc(title):`${tr('lg_task')}: ${esc(prettyKey(v))}`;}
 if(k==='checkin'){const w=v.split('-W')[1];return esc(tr('lg_checkin').replace('{n}',w?String(Number(w)):v));}
 if(k==='attendance')return tr('lg_attendance');
 if(k==='manual')return v?esc(v):tr('lg_manual');
 if(k==='correction')return tr('lg_correction')+(v?': '+esc(v):'');
 return esc(s);
}
const ledgerList=(l,tasks=[])=>{
 if(!l.length)return empty();
 const day=iso=>shortDate(iso);
 const row=(h,i)=>`<li class="${h.amount<0?'is-minus':''}"><time datetime="${esc(h.created)}">${i>0&&day(l[i-1].created)===day(h.created)?'':day(h.created)}</time><span>${ledgerLabel(h.reason,tasks)}${h.type==='user'?` <small class="ui-chip is-info">${tr('lg_personal')}</small>`:''}</span><b>${h.amount>0?'+':''}${h.amount}</b></li>`;
 const n=8;
 return `<ol class="acc-ledger">${l.slice(0,n).map(row).join('')}</ol>${l.length>n?`<details class="acc-ledger-more"><summary>${tr('showAll').replace('{n}',l.length)}</summary><ol class="acc-ledger">${l.slice(n).map((h,i)=>row(h,i+n)).join('')}</ol></details>`:''}`;
};
const nudgeForm=hidden=>`<form data-form="nudge" class="acc-compact">${hidden}${field('message',tr('nudgeMessage'),{type:'textarea',required:true,attrs:'rows="2" maxlength="300"'})}<button class="acc-primary">${tr('nudgeSend')}</button></form>`;
const xpForm=(type,id)=>`<form data-form="xp" data-type="${type}" data-id="${esc(id)}" class="acc-compact acc-xp-form"><div class="acc-xp-row">${field('amount',tr('xpChange'),{type:'number',required:true,attrs:'min="-1000" max="1000" placeholder="+10 / -5"'})}${field('reason',tr('reasonField'),{required:true,attrs:'minlength="3" maxlength="200"'})}<button class="acc-secondary">${tr('save')}</button></div><small class="acc-muted">${tr('xpChangeHint')}</small></form>`;
const noteForm=(type,id)=>`<form data-form="organiser-note" data-type="${type}" data-id="${esc(id)}" class="acc-compact">${field('body',tr('addNote'),{type:'textarea',required:true,attrs:'rows="2" maxlength="1000"'})}<button class="acc-secondary">${tr('save')}</button></form>`;

// Living characters: whoever has artwork stands on the page; stopped on every re-render.
const crew=people=>window.BirdCharacter&&people.length?`<div class="rec-crew">${window.BirdCharacter.html(people.map(p=>({...p,attrs:`data-sheet="person" data-id="${esc(p.id)}"`,label:p.name})),{size:people.length>5?'md':'lg'})}</div>`:'';
const tile=(value,label,{bar,cls='',sub=''}={})=>`<div class="ui-kpi ${cls}"><span class="ui-label">${esc(label)}</span><b class="ui-num">${value}</b>${bar!==undefined?`<span class="ui-bar is-ok" aria-hidden="true"><i style="--w:${Math.max(0,Math.min(100,bar))}%"></i></span>`:''}${sub?`<span class="ui-kpi-foot">${sub}</span>`:''}</div>`;
const frac=(a,b)=>`${num(a)}<small>/${b}</small>`;
const taskUnits=tasks=>`<span class="ui-units rec-units" aria-hidden="true">${tasks.map((t,j)=>`<i class="${t.status==='accepted'?'is-ok':t.status==='submitted'?'is-watch':t.status==='changes_requested'?'is-risk':''}" style="--j:${j%12}" title="${esc(taskText(t.title))}"></i>`).join('')}</span>`;
async function teamRecord(id){
 const r=await api('GET','/api/admin/team/'+encodeURIComponent(id));
 const open=r.tasks.filter(t=>['not_started','draft','changes_requested'].includes(t.status)),rest=r.tasks.filter(t=>!open.includes(t));
 const doneN=r.tasks.filter(t=>t.status==='accepted').length,seats=r.seats??r.lectures*Math.max(1,r.members.length),att=Math.min(seats,r.members.reduce((n,m)=>n+m.attended,0));
 const people=[...r.members.filter(m=>m.personId).map(m=>({id:m.personId,name:m.name})),...r.noAccount.map(m=>({id:m.id,name:m.name}))];
 return adminShell('overview',`<a class="acc-back" href="#/admin/overview">← ${tr('teamsNav')}</a>
 <header class="rec-head is-${esc(r.risk.level)}"><div class="rec-title"><h2>${esc(r.name)}</h2><span class="acc-light is-${esc(r.risk.level)}">${tr('risk_'+r.risk.level)}</span>${r.streak?`<span class="dash-flame">${I('flame')} ${r.streak} ${esc(pgPlural('weeks',r.streak))}</span>`:''}
 ${r.risk.signals.length?`<p class="dash-signals"><span class="acc-sr">${tr('risk')}: </span>${r.risk.signals.map(x=>`<span>${esc(tr('sig_'+x))}</span>`).join('')}</p>`:''}
 <div class="acc-actions"><a class="acc-primary" href="#/admin/task/new~team~${esc(id)}">${tr('giveTask')}</a><a class="acc-secondary" href="#/account/project/${esc(id)}">${tr('openProject')}</a><a href="#/office/${esc(id)}">${tr('locateInOffice')}</a></div></div>
 ${ring(r.score.percent,'rec-ring')}</header>
 ${crew(people)}
 ${projectCard(r,id)}
 <div class="rec-kpis">${tile(percent(r.score.percent),tr('progress'),{bar:r.score.percent??0,sub:`${r.score.earned}/${r.score.available} ${tr('scoreCounted')}`})}${tile(num(r.wallet.earned),tr('kpiPoints'),{sub:`${tr('walletBalance')} ${r.wallet.balance} · ${tr('walletSpent')} ${r.wallet.spent}`})}<div class="ui-kpi"><span class="ui-label">${tr('tasks')}</span><b class="ui-num">${frac(doneN,r.tasks.length)}</b>${taskUnits(r.tasks)}</div>${tile(frac(att,seats),tr('attendance'),{bar:seats?att/seats*100:0})}${tile(num(r.pitch.pitches),tr('pitches'),{sub:`${tr('deck')}: ${esc(tr('st_'+r.pitch.deck))}`})}</div>
 <div class="acc-grid rec-grid"><section class="acc-card"><h2>${tr('members')}</h2><ul class="acc-list rec-people">${r.members.map(m=>`<li><a href="#/admin/person/${esc(m.id)}"><span class="dash-avatar" aria-hidden="true">${esc(initials(m.name))}</span><span><strong>${esc(m.name)}</strong><small class="${idle(m.lastSeen)?'acc-idle':''}">${esc(seen(m.lastSeen))} · ${m.xp} ${pgPlural('xp',m.xp)} · ${m.attended} ${pgPlural('lecturesShort',m.attended)}</small></span></a></li>`).join('')}${r.noAccount.map(m=>`<li><a href="#/admin/person/${esc(m.id)}"><span class="dash-avatar is-more" aria-hidden="true">${esc(initials(m.name))}</span><span><strong>${esc(m.name)}</strong><small>${tr('noAccount')}</small></span></a></li>`).join('')}</ul></section>
 <section class="acc-card"><h2>${tr('nudgeTeam')}</h2>${r.lastNudge?`<p class="acc-muted">${tr('lastNudge')}: ${date(r.lastNudge,true)}</p>`:''}${r.members.length?nudgeForm(`<input type="hidden" name="projectId" value="${esc(id)}">`):`<p class="acc-muted">${tr('noAccountsYet')}</p>`}</section>
 <section class="acc-card"><h2>${tr('openTasks')} <span class="acc-count">${open.length}</span></h2>${open.length?`<ul class="acc-list">${open.map(recordTask).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><details class="rec-fold"><summary><h2>${tr('doneTasks')} <span class="acc-count">${rest.length}</span></h2></summary>${rest.length?`<ul class="acc-list">${rest.map(recordTask).join('')}</ul>`:empty()}</details></section>
 <section class="acc-card"><h2>${tr('checkins')}</h2>${r.checkins.length?`<ul class="acc-list">${r.checkins.map(c=>`<li><div><strong>${esc(c.week)}</strong> ${esc(c.metric_name)}: ${esc(c.metric_value)}<small>${esc(c.goal)}${c.blocker?' · '+esc(c.blocker):''}${c.needs_help?' · '+tr('needsHelp'):''}</small></div></li>`).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><h2>${tr('files')}</h2>${r.files.length?`<ul class="acc-list">${r.files.map(f=>`<li><a href="/api/files/${esc(f.id)}" download>${esc(f.filename)}</a><small>${size(f.size)} · ${date(f.created)}</small></li>`).join('')}</ul>`:empty()}<h2 class="rec-sub">${tr('mentors')}</h2>${r.mentors.length?`<ul class="acc-list">${r.mentors.map(m=>`<li><div><strong>${esc(m.mentor_name)}</strong><small>${date(m.starts_at,true)} · ${esc(m.topic)}${m.note?' · '+esc(m.note):''}</small></div></li>`).join('')}</ul>`:empty()}</section>
 <section class="acc-card rec-points"><h2>${tr('pointsHistory')}</h2>${ledgerList(r.ledger,r.tasks)}<h3>${tr('adjustPoints')}</h3>${xpForm('project',id)}</section>
 <section class="acc-card"><h2>${tr('notesTitle')}</h2><p class="acc-muted">${tr('notesPrivate')}</p>${noteList(r.notes)}${noteForm('team',id)}</section></div>`);
}
// Financing as the team states it, and whether it agreed to be shown to investors.
const fundingFacts=f=>f?`<dl class="rec-fin"><div><dt>${tr('f_raisedEur')}</dt><dd>${eur(f.raisedEur)}</dd></div><div><dt>${tr('f_raisingEur')}</dt><dd>${eur(f.raisingEur)}</dd></div><div><dt>${tr('f_round')}</dt><dd>${f.round?esc(tr('round_'+f.round)):'—'}</dd></div>${f.investorVisible?`<div><dt>${tr('investorsOn')}</dt><dd>✓</dd></div>`:''}</dl>`:'';
// What the team says about its project (read only), its links and the deck, on the organiser's team card.
function projectCard(r,id){
 const c=r.project||{},deck=r.pitch.deckFile;
 const parts=['short','problem','users','solution','value','ask','nextSteps'].filter(k=>c[k]);
 return `<section class="acc-card rec-project"><div class="acc-card-head"><h2>${tr('projectAbout')}</h2><span class="m-tag">${esc(stageLabel(c.stage))}</span></div>
 ${fundingFacts(r.funding)}
 ${parts.length?`<dl class="rec-project-fields">${parts.map(k=>`<div><dt>${tr(k==='short'?'f_short':'f_'+k)}</dt><dd class="acc-pre">${esc(c[k])}</dd></div>`).join('')}</dl>`:`<p class="acc-muted">${tr('projectEmpty')}</p>`}
 ${c.links?.length?`<ul class="rec-project-links">${c.links.map(l=>`<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(l.label||l.url)} ↗</a></li>`).join('')}</ul>`:''}
 ${r.stageHistory?.length?`<details class="rec-fold rec-stages"><summary>${tr('stageHistory')}</summary>${stageHistoryList(r.stageHistory)}</details>`:''}
 <p class="rec-project-deck"><strong>${tr('deck')}:</strong> ${deck?`<a href="/api/files/${esc(deck.id)}" download>${I('clip')} ${esc(deck.filename)}</a> · `:''}${esc(tr('st_'+r.pitch.deck))}</p>
 <p><a class="acc-secondary" href="#/account/project/${esc(id)}">${tr('openProject')} →</a></p></section>`;
}
// RPG-style sheet: the same level the participant sees (level() above), cohort place of the team, streak,
// tasks as one square each, lectures as a strip (verified, self-reported, missed).
function personSheet(u,r,team,place,teams){
 const lv=level(u.xp),per=lv.b-lv.a,into=Math.max(0,u.xp)-lv.a;
 const done=r.tasks.filter(t=>t.status==='accepted').length,held=r.attendance.filter(a=>!a.before),missed=held.filter(a=>!a.kind).length;
 return `<div class="rec-rpg"><div class="rec-level"><span class="ui-label">${tr('level')}</span><b class="ui-num">${num(lv.n)}</b><span class="ui-bar is-ok" aria-hidden="true"><i style="--w:${lv.pct}%"></i></span><span class="ui-kpi-foot">${u.xp} ${pgPlural('xp',u.xp)} · ${per-into} → ${lv.n+1}</span></div>
 <dl class="rec-traits">${place?`<div><dt>${tr('ranking')}</dt><dd>#${num(place)}<small>/${teams}</small></dd></div>`:''}<div><dt>${tr('dashStreak')}</dt><dd>${team?.streak?`${I('flame')} ${num(team.streak)}`:'—'}</dd></div>
 <div class="rec-wide"><dt>${tr('tasks')} <b>${done}/${r.tasks.length}</b></dt><dd>${taskUnits(r.tasks)}</dd></div>
 <div class="rec-wide"><dt>${tr('attendance')} <b>${held.length-missed}/${held.length}</b></dt><dd><span class="ui-units rec-units" aria-hidden="true">${held.map((a,j)=>`<i class="${a.kind==='verified_by_admin'?'is-ok':a.kind?'is-info':'is-risk'}" style="--j:${j}" title="${esc(pick(a.title))}"></i>`).join('')}</span></dd></div></dl></div>`;
}
async function personRecord(id){
 const r=await api('GET','/api/admin/person/'+encodeURIComponent(id));
 if(!r.hasAccount)return adminShell('users',`<a class="acc-back" href="#/admin/users">← ${tr('users')}</a><h2>${esc(r.person.name)}</h2><p class="acc-flash">${tr('noAccount')}. ${tr('noAccountNote')}</p>${r.teams.map(t=>`<p><a href="#/admin/team/${esc(t.id)}">${esc(t.name)}</a></p>`).join('')}<form data-form="person-invite" class="acc-card"><input type="hidden" name="personId" value="${esc(r.person.id)}"><button class="acc-secondary">${tr('invite')}</button></form>${inviteBox(cache.newInvite)}`);
 const u=r.user,[projects,rank]=await Promise.all([api('GET','/api/admin/overview').then(x=>x.items),api('GET','/api/teams/ranking')]),code=cache.resetCode;cache.resetCode=null;
 // The same place the participant sees: shared on a tie, none while nobody has earned anything.
 const team=projects.find(p=>p.id===r.teams[0]?.id),place=rank.items.find(t=>t.projectId===team?.id)?.place||0;
 const open=r.tasks.filter(t=>['not_started','draft','changes_requested'].includes(t.status)),rest=r.tasks.filter(t=>!open.includes(t));
 const missed=r.attendance.filter(a=>!a.kind);
 return adminShell('users',`<a class="acc-back" href="#/admin/users">← ${tr('users')}</a><section class="rec-sheet">${r.person?.id&&window.BirdCharacter?`<div class="rec-hero">${window.BirdCharacter.html([{id:r.person.id,name:u.name,attrs:`data-sheet="person" data-id="${esc(u.id)}"`}],{size:'lg'})}${r.teams[0]?`<button type="button" class="rec-team-chip" data-sheet="team" data-id="${esc(r.teams[0].id)}">${esc(r.teams[0].name)}</button>`:''}</div>`:''}<div class="rec-stats"><div class="acc-card-head"><h2>${esc(u.name)}</h2><small>${esc(tr('urole_'+u.role))}${u.status==='active'?'':' · '+tr('disabledNow')}</small></div>
 <p class="acc-muted">${esc(u.login)}${u.email?' · '+esc(u.email):''} · <span class="${idle(u.lastSeen)?'acc-idle':''}">${esc(seen(u.lastSeen))}</span>${u.linkedin?` · <a href="${esc(u.linkedin)}" target="_blank" rel="noopener noreferrer nofollow">LinkedIn</a>`:''}${u.website?` · <a href="${esc(u.website)}" target="_blank" rel="noopener noreferrer nofollow">${tr('website')}</a>`:''}</p>
 ${personSheet(u,r,team,place,rank.items.length)}</div></section>
 <div class="acc-actions"><a class="acc-primary" href="#/admin/task/new~user~${esc(u.id)}">${tr('giveTask')}</a>${r.teams[0]?`<a class="acc-secondary" href="#/admin/team/${esc(r.teams[0].id)}">${esc(r.teams[0].name)}</a>`:''}${r.person&&r.teams[0]?`<a href="#/office/${esc(r.teams[0].id)}/${esc(r.person.id)}">${tr('locateInOffice')}</a>`:''}</div>
 <div class="acc-grid rec-grid"><section class="acc-card"><h2>${tr('nudgeTitle')}</h2>${r.lastNudge?`<p class="acc-muted">${tr('lastNudge')}: ${date(r.lastNudge,true)}</p>`:''}${nudgeForm(`<input type="hidden" name="userId" value="${esc(u.id)}">`)}</section>
 <section class="acc-card"><h2>${tr('teamAssign')}</h2><p class="acc-muted">${tr('teamAssignNote')}</p><form data-form="set-team" data-id="${esc(u.id)}" class="acc-compact">${select('projectId',tr('project'),[['',tr('noTeam')],...projects.map(p=>[p.id,p.name])],r.teams[0]?.id||'')}<button class="acc-secondary">${tr('save')}</button></form></section>
 <section class="acc-card"><h2>${tr('openTasks')} <span class="acc-count">${open.length}</span></h2>${open.length?`<ul class="acc-list">${open.map(recordTask).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><details class="rec-fold"><summary><h2>${tr('doneTasks')} <span class="acc-count">${rest.length}</span></h2></summary>${rest.length?`<ul class="acc-list">${rest.map(recordTask).join('')}</ul>`:empty()}</details></section>
 <section class="acc-card"><h2>${tr('lectures')}</h2>${r.attendance.length?`<ul class="acc-list">${r.attendance.map(a=>`<li><span>${esc(pick(a.title))}<small>${date(a.date)}</small></span>${a.kind?`<span class="acc-chip is-accepted">${tr(a.kind==='verified_by_admin'?'verified':'selfReported')}</span>`:a.before?`<span class="acc-chip">${tr('beforeJoinedAdmin')}</span>`:`<span class="acc-chip is-changes_requested">${tr('missedLecture')}</span>`}</li>`).join('')}</ul>`:empty()}</section>
 <section class="acc-card rec-points"><h2>${tr('pointsHistory')}</h2>${ledgerList(r.ledger,r.tasks)}<h3>${tr('adjustPoints')}</h3>${xpForm('user',u.id)}</section>
 <section class="acc-card"><h2>${tr('notesTitle')}</h2><p class="acc-muted">${tr('notesPrivate')}</p>${noteList(r.notes)}${noteForm('user',u.id)}</section>
 ${u.role!=='platform_owner'?`<section class="acc-card"><h2>${tr('accessTitle')}</h2>${code?`<p class="acc-flash" role="status">${tr('resetShow')}<br><code class="acc-code">${esc(code)}</code></p>`:`<p class="acc-muted">${tr('resetNote')}</p>`}<div class="acc-actions"><button data-act="reset-code" data-id="${esc(u.id)}" class="acc-secondary">${tr('resetCode')}</button><button data-act="user-status" data-id="${esc(u.id)}" data-status="${u.status==='active'?'disabled':'active'}" ${u.status==='active'?`data-confirm="${esc(tr('confirmDisable'))}"`:''}>${tr(u.status==='active'?'disable':'enable')}</button></div></section>`:''}</div>`);
}
// Cohort dashboard: every team on one screen with progress, points, signals and the next step.
const PIPELINE=STAGES;
const TEAM_TESTS={all:()=>true,overdue:p=>p.overdue>0,attendance:p=>p.risk.signals.includes('low_attendance'),pitch:p=>p.pitch.deck!=='accepted',waiting:p=>p.tasks.waitingReview>0};
const DASH_TESTS={...TEAM_TESTS,risk:p=>p.risk.level!=='ok',idle:p=>p.members.length>0&&idle(p.lastSeen)};
const RISK_ORDER={risk:0,watch:1,ok:2};
const DASH_SORT={
 risk:(a,b)=>RISK_ORDER[a.risk.level]-RISK_ORDER[b.risk.level]||b.risk.signals.length-a.risk.signals.length||(a.percent??-1)-(b.percent??-1)||a.name.localeCompare(b.name),
 progress:(a,b)=>(b.percent??-1)-(a.percent??-1)||b.totalXp-a.totalXp,
 points:(a,b)=>b.totalXp-a.totalXp||(b.percent??-1)-(a.percent??-1),
 name:(a,b)=>a.name.localeCompare(b.name,loc[lang]),
};
const shortDate=iso=>new Intl.DateTimeFormat(loc[lang],{day:'numeric',month:'short',...(iso.slice(0,4)===new Date().toISOString().slice(0,4)?{}:{year:'numeric'}),timeZone:'Europe/Zagreb'}).format(new Date(iso));
const daysAgo=iso=>Math.max(0,Math.floor((Date.now()-Date.parse(iso))/86400000));
const ago=iso=>{const d=daysAgo(iso);return new Intl.RelativeTimeFormat(loc[lang],{numeric:'auto'}).format(-d,'day');};
const initials=name=>String(name).split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
function pipeline(stage){
 const at=PIPELINE.indexOf(stageKey(stage));
 return `<ol class="dash-stage" aria-hidden="true">${PIPELINE.map((s,i)=>`<li class="${i<at?'is-done':i===at?'is-now':''}"></li>`).join('')}</ol><p class="dash-stage-name"><span>${tr('dashStage')}: <b>${esc(stageLabel(stage))}</b></span><span aria-hidden="true">${at+1}/${PIPELINE.length}</span></p>`;
}
// Progress ring: an SVG stroke that sweeps from zero on first view. pathLength=100 keeps the maths in percent.
function ring(pct,cls=''){
 const has=pct!==null&&pct!==undefined,n=has?Math.max(0,Math.min(100,pct)):0;
 return `<div class="dash-ring ui-ring ${cls}" role="img" aria-label="${esc(tr('progress')+': '+percent(pct))}"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-t" cx="40" cy="40" r="34" pathLength="100"/><circle class="ring-v" cx="40" cy="40" r="34" pathLength="100" style="stroke-dashoffset:${100-n}"/></svg><b aria-hidden="true">${has?`${num(pct)}<small>%</small>`:'—'}</b></div>`;
}
function nextStep(p){
 const t=p.todo?.[0],out=[];
 if(t){
  const when=t.overdue?`<span class="dash-late">${tr('dashOverdueSince')} ${shortDate(t.dueAt)}</span>`:t.dueAt?`${tr('due')} ${shortDate(t.dueAt)}`:tr('dashNoDue');
  const extra=[t.status==='changes_requested'?tr('st_changes_requested'):'',t.open>1?tr('dashNotSubmitted').replace('{n}',t.open):'',`${t.xp} ${pgPlural('xp',t.xp)}`].filter(Boolean).join(' · ');
  out.push(`<p class="dash-next-title">${authored(t.title,'title')}</p><p class="dash-next-meta">${when}${extra?' · '+extra:''}</p>`);
 }else if(!p.members.length)out.push(`<p class="dash-next-title">${tr('dashInvite')}</p>${p.noAccount?.length?`<p class="dash-next-meta">${esc(p.noAccount.join(', '))}</p>`:''}`);
 else if(!p.tasks.waitingReview)out.push(`<p class="dash-next-title">${tr('dashAllDone')}</p>`);
 if(p.tasks.waitingReview)out.push(`<p class="dash-review">${tr('dashWaitingReview')}: <b>${p.tasks.waitingReview}</b></p>`);
 return `<div class="dash-next ${t?.overdue?'is-late':''}"><span class="dash-label">${tr('nextStep')}</span>${out.join('')}</div>`;
}
function teamCard(p,i){
 const people=p.members.length?p.members:[];
 const seenTxt=!p.members.length?'':p.lastSeen?ago(p.lastSeen):tr('neverSeen');
 const signals=p.risk.signals.map(x=>tr('sig_'+x));
 const taskPct=p.tasks.total?Math.round(p.tasks.done/p.tasks.total*100):0;
 return `<article class="dash-card is-${esc(p.risk.level)}" style="--i:${i%9}" aria-labelledby="dash-${esc(p.id)}">
 <header class="dash-card-head"><h3 id="dash-${esc(p.id)}"><a href="#/admin/team/${esc(p.id)}" class="dash-link">${esc(p.name)}</a></h3><span class="acc-light is-${esc(p.risk.level)}">${tr('risk_'+p.risk.level)}</span></header>
 ${pipeline(p.stage)}
 <div class="dash-body">${ring(p.percent)}<dl class="dash-facts"><div><dt>${tr('points')}</dt><dd>${num(p.totalXp)}</dd></div><div><dt>${tr('tasks')}</dt><dd>${num(p.tasks.done)}<small>/${p.tasks.total}</small></dd><span class="ui-bar is-ok" aria-hidden="true"><i style="--w:${taskPct}%"></i></span></div>${p.streak?`<div class="dash-streak"><dd class="dash-flame" title="${esc(tr('dashStreak'))}">${I('flame')} <span class="acc-sr">${tr('dashStreak')}: </span>${p.streak} ${esc(pgPlural('weeks',p.streak))}</dd></div>`:''}</dl></div>
 ${signals.length?`<p class="dash-signals"><span class="acc-sr">${tr('risk')}: </span>${signals.map(s=>`<span>${esc(s)}</span>`).join('')}</p>`:''}
 ${nextStep(p)}
 <footer class="dash-foot">${people.length?`<button type="button" class="dash-people" data-sheet="team" data-id="${esc(p.id)}" aria-label="${esc(tr('dashPeople')+': '+people.join(', '))}">${people.slice(0,4).map(n=>`<span class="dash-avatar" title="${esc(n)}">${esc(initials(n))}</span>`).join('')}${people.length>4?`<span class="dash-avatar is-more">+${people.length-4}</span>`:''}</button>`:`<span class="dash-names is-none">${tr('noAccountsYet')}</span>`}${seenTxt?`<small class="dash-seen ${idle(p.lastSeen)?'acc-idle':''}">${esc(tr('lastSeen'))}: ${esc(seenTxt)}</small>`:''}</footer>
 </article>`;
}
// Charts across the whole cohort, built from the same overview payload.
function cohortCharts(all,avg){
 const byProgress=[...all].sort((a,b)=>(b.percent??-1)-(a.percent??-1));
 const bars=`<section class="dash-panel" style="--i:0"><h3>${tr('vizProgress')}${avg===null?'':`<small>${tr('vizAvg')}: ${avg}%</small>`}</h3><ol class="viz-bars">${byProgress.map((p,j)=>`<li class="is-${esc(p.risk.level)}" style="--j:${j}"><a href="#/admin/team/${esc(p.id)}"><span class="viz-name">${esc(p.name)}</span><span class="viz-track" aria-hidden="true"><i style="--w:${p.percent??0}%"></i>${avg===null?'':`<span class="viz-avg" style="--a:${avg}%"></span>`}</span><b>${percent(p.percent)}</b><span class="acc-sr">${tr('risk_'+p.risk.level)}</span></a></li>`).join('')}</ol>${avg===null?'':`<p class="viz-note" aria-hidden="true">${tr('vizAvg')}</p>`}</section>`;
 const stages=PIPELINE;
 const funnel=`<section class="dash-panel" style="--i:1"><h3>${tr('vizStages')}</h3><ol class="viz-stages">${stages.map(s=>{const teams=all.filter(p=>stageKey(p.stage)===s);return `<li class="${teams.length?'':'is-empty'}" aria-label="${esc(tr('stage_'+s)+': '+teams.length+(teams.length?' — '+teams.map(t=>t.name).join(', '):''))}"><b aria-hidden="true">${teams.length}</b><span class="viz-col" aria-hidden="true">${teams.map((t,j)=>`<i class="is-${esc(t.risk.level)}" style="--j:${j}" title="${esc(t.name)}"></i>`).join('')}</span><span aria-hidden="true">${esc(tr('stage_'+s))}</span></li>`;}).join('')}</ol></section>`;
 const sum=f=>all.reduce((n,p)=>n+f(p),0);
 const total=sum(p=>p.tasks.total),done=sum(p=>p.tasks.done),review=sum(p=>p.tasks.waitingReview),open=Math.max(0,total-done-review);
 const w=(n,of)=>of?(n/of*100).toFixed(1):0;
 const seats=sum(p=>p.attendance.lecturesHeld*p.members.length),ver=sum(p=>p.attendance.verified),self=sum(p=>p.attendance.selfReported),miss=Math.max(0,seats-ver-self);
 const work=`<section class="dash-panel" style="--i:2"><h3>${tr('vizTasks')}</h3><p class="viz-big"><b class="ui-num">${num(done)}<small>/${total}</small></b><span>${tr('vizDone')}</span></p><span class="ui-stack" aria-hidden="true"><i class="is-ok" style="--w:${w(done,total)}%"></i><i class="is-watch" style="--w:${w(review,total)}%;--j:1"></i><i class="is-soft" style="--w:${w(open,total)}%;--j:2"></i></span><ul class="ui-legend"><li class="ui-key is-ok">${tr('vizDone')} <b>${done}</b></li><li class="ui-key is-watch">${tr('vizReview')} <b>${review}</b></li><li class="ui-key is-soft">${tr('vizOpen')} <b>${open}</b></li></ul>
 <h4>${tr('vizAttendance')}</h4>${seats?`<span class="ui-stack" aria-hidden="true"><i class="is-ok" style="--w:${w(ver,seats)}%"></i><i class="is-info" style="--w:${w(Math.min(self,seats-ver),seats)}%;--j:1"></i></span><ul class="ui-legend"><li class="ui-key is-ok">${tr('vizVerified')} <b>${ver}</b></li><li class="ui-key is-info">${tr('vizSelf')} <b>${self}</b></li><li class="ui-key is-soft">${tr('vizMissed')} <b>${miss}</b></li></ul>`:`<p class="acc-muted">${tr('none')}</p>`}</section>`;
 return `<div class="dash-viz">${bars}${funnel}${work}</div>`;
}
async function dashboardView(){
 const o=await api('GET','/api/admin/overview'),all=o.items;
 const view=DASH_TESTS[cache.dashFilter]?cache.dashFilter:'all',sort=DASH_SORT[cache.dashSort]?cache.dashSort:'risk';
 if(!all.length)return adminShell('dashboard',`<div class="dash-empty acc-card"><p>${tr('dashEmpty')}</p></div>`);
 const withPeople=all.filter(p=>p.members.length);
 const active=withPeople.filter(p=>!idle(p.lastSeen)).length;
 const scored=all.filter(p=>p.percent!==null&&p.percent!==undefined);
 const avg=scored.length?Math.round(scored.reduce((n,p)=>n+p.percent,0)/scored.length):null;
 const sum=f=>all.reduce((n,p)=>n+f(p),0);
 const seats=sum(p=>p.attendance.lecturesHeld*p.members.length),verified=sum(p=>p.attendance.verified);
 const attendanceRate=seats?Math.round(verified/seats*100):null;
 const kpi=(inner,{cls='',filter,sortBy,href,label}={})=>{
  const c=`dash-kpi ui-kpi ${cls}`;
  if(filter)return `<button type="button" class="${c}" data-act="dash-filter" data-view="${filter}" aria-pressed="${view===filter}">${inner}</button>`;
  if(sortBy)return `<button type="button" class="${c}" data-act="dash-sort" data-sort="${sortBy}" aria-pressed="${sort===sortBy}">${inner}</button>`;
  if(href)return `<a class="${c}" href="${href}">${inner}</a>`;
  return `<div class="${c}">${inner}</div>`;
 };
 const levels=['ok','watch','risk'].map(l=>[l,all.filter(p=>p.risk.level===l).length]);
 const overdue=sum(p=>p.overdue),waiting=sum(p=>p.tasks.waitingReview),atRisk=all.filter(p=>p.risk.level!=='ok').length,mentor=sum(p=>p.mentorSessions);
 const kpis=`<div class="dash-kpis">${[
  kpi(`<span class="ui-label">${tr('kpiTeams')}</span><b class="ui-num">${num(all.length)}</b><span class="ui-kpi-foot"><span class="ui-stack" aria-hidden="true" style="height:8px">${levels.map(([l,n],j)=>`<i class="is-${l}" style="--w:${n/all.length*100}%;--j:${j}"></i>`).join('')}</span>${atRisk?`${tr('kpiNeedAttention')}: ${atRisk}`:tr('kpiAllOk')}</span>`,{filter:'risk',cls:atRisk?'is-watch':'is-ok'}),
  kpi(`<span class="ui-label">${tr('kpiActive')}</span><b class="ui-num">${num(active)}<small>/${withPeople.length}</small></b><span class="dash-units" aria-hidden="true">${withPeople.map(p=>`<i class="${idle(p.lastSeen)?'':'is-on'}" title="${esc(p.name)}"></i>`).join('')}</span>${withPeople.length<all.length?`<span class="ui-kpi-foot">${esc(pgPlural('kpiActiveOf',withPeople.length).replace('{n}',withPeople.length))}</span>`:''}`,{filter:'idle',cls:withPeople.length-active?'is-watch':''}),
  kpi(`<span class="ui-label">${tr('kpiProgress')}</span><b class="ui-num">${avg===null?'—':`${num(avg)}<small>%</small>`}</b><span class="ui-bar is-ok" aria-hidden="true"><i style="--w:${avg??0}%"></i></span>`,{sortBy:'progress'}),
  kpi(`<span class="ui-label">${tr('kpiPoints')}</span><b class="ui-num">${num(sum(p=>p.totalXp))}</b><span class="ui-kpi-foot">${tr('kpiAttendance')}: <b>${attendanceRate===null?'—':attendanceRate+'%'}</b></span>`,{sortBy:'points'}),
 ].join('')}</div>`;
 const alert=(n,label,{filter,href,level})=>{const inner=`<b>${num(n)}</b><span>${esc(label)}</span><span class="dash-go" aria-hidden="true">→</span>`,cls=`dash-alert ${n?level:'is-calm'}`;return filter?`<button type="button" class="${cls}" data-act="dash-filter" data-view="${filter}" aria-pressed="${view===filter}">${inner}</button>`:`<a class="${cls}" href="${href}">${inner}</a>`;};
 const alerts=`<div class="dash-alerts">${alert(overdue,tr('kpiOverdue'),{filter:'overdue',level:'is-risk'})}${alert(waiting,tr('kpiWaiting'),{filter:'waiting',level:'is-watch'})}${alert(mentor,tr('kpiMentor'),{href:'#/admin/mentors',level:'is-info'})}</div>`;
 const rows=all.filter(DASH_TESTS[view]).sort(DASH_SORT[sort]);
 const time=new Intl.DateTimeFormat(loc[lang],{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Zagreb'}).format(new Date(o.generated));
 return adminShell('dashboard',`<div class="dash-top"><div><h2 class="dash-title">${tr('dashTitle')}</h2><p class="acc-muted">${tr('dashUpdated')} ${time}</p></div><div class="acc-actions"><button type="button" class="acc-secondary" data-act="dash-refresh">↻ ${tr('dashRefresh')}</button><a href="#/admin/overview">${tr('dashTable')} →</a></div></div>
 ${kpis}${alerts}${cohortCharts(all,avg)}
 <div class="dash-controls"><div class="acc-filters" role="group" aria-label="${tr('dashFilter')}">${Object.keys(DASH_TESTS).map(k=>`<button type="button" data-act="dash-filter" data-view="${k}" aria-pressed="${k===view}">${tr('tf_'+k)} <span class="dash-count">${all.filter(DASH_TESTS[k]).length}</span></button>`).join('')}</div>
 <div class="dash-sort" role="group" aria-label="${tr('sortBy')}"><span aria-hidden="true">${tr('sortBy')}</span>${Object.keys(DASH_SORT).map(k=>`<button type="button" data-act="dash-sort" data-sort="${k}" aria-pressed="${k===sort}">${tr('sort_'+k)}</button>`).join('')}</div></div>
 <p class="acc-sr" role="status">${rows.length} / ${all.length}</p>
 ${rows.length?`<div class="dash-grid">${rows.map(teamCard).join('')}</div>`:`<p class="acc-muted dash-empty">${tr('dashNoMatch')} <button type="button" class="acc-link" data-act="dash-filter" data-view="all">${tr('tf_all')}</button></p>`}`);
}
// Today, Programme and Settings: one glance per block, graphics instead of lists (styles: admin-programme.css).
const PG_ICONS={
 clock:'<circle cx="8" cy="8" r="6.2"/><path d="M8 4.5V8l2.4 1.6"/>',
 calendar:'<path d="M2.2 3.4h11.6v10.4H2.2zM2.2 6.6h11.6M5.2 1.6v3.2M10.8 1.6v3.2"/>',
 note:'<path d="M3.4 1.6h6.2l3 3v9.8H3.4z"/><path d="M5.8 8h4.4M5.8 10.8h3"/>',
 flag:'<path d="M3.6 14.6V1.8M3.6 2.4h8.8l-2 3 2 3H3.6"/>',
 moon:'<path d="M13.4 9.8A6 6 0 0 1 6.2 2.6a6 6 0 1 0 7.2 7.2z"/>',
 hourglass:'<path d="M4 1.6h8M4 14.4h8M5 1.6v2.6l3 3.8 3-3.8V1.6M5 14.4v-2.6l3-3.8 3 3.8v2.6"/>',
 user:'<circle cx="8" cy="5" r="2.9"/><path d="M2.6 14.4c0-3 2.4-4.6 5.4-4.6s5.4 1.6 5.4 4.6"/>',
 check:'<path d="M2.6 8.4l3.4 3.4 7.4-7.6"/>',
 chat:'<path d="M1.6 2.6h12.8v8.6H7.4l-3.6 3v-3H1.6z"/>',
 star:'<path d="M8 1.6l1.9 4.2 4.5.5-3.4 3.1.9 4.5L8 11.6l-3.9 2.3.9-4.5-3.4-3.1 4.5-.5z"/>',
 arrow:'<path d="M2.6 8h10.4M9 4l4 4-4 4"/>',
 plus:'<path d="M8 2.6v10.8M2.6 8h10.8"/>',
 mic:'<path d="M6 1.6h4v7.2H6zM3.4 7.6a4.6 4.6 0 0 0 9.2 0M8 12.2v2.2"/>',
 gift:'<path d="M1.8 5.4h12.4v3H1.8zM2.8 8.4h10.4v6H2.8zM8 5.4v9M8 5.4C6.4 1.8 3.6 2.6 4.4 4.2 5 5.4 8 5.4 8 5.4zm0 0c1.6-3.6 4.4-2.8 3.6-1.2C11 5.4 8 5.4 8 5.4"/>',
 megaphone:'<path d="M1.8 6.2h3.2l7.4-4v11.6l-7.4-4H1.8zM5 9.8l1.2 4.4h2l-1-4"/>',
 shield:'<path d="M8 1.6l5.6 2v4.6c0 3.4-2.6 5.4-5.6 6.2-3-.8-5.6-2.8-5.6-6.2V3.6z"/>',
 mail:'<path d="M1.6 3.4h12.8v9.2H1.6zM1.6 3.4L8 8.8l6.4-5.4"/>',
 box:'<path d="M2 4.6L8 1.6l6 3v6.8l-6 3-6-3zM2 4.6l6 3 6-3M8 7.6v6.8"/>',
 key:'<circle cx="5" cy="10.6" r="3"/><path d="M7.2 8.4l6.4-6.4M11.2 4.4l2 2"/>',
 bell:'<path d="M3.4 11.6V7a4.6 4.6 0 0 1 9.2 0v4.6l1.2 1.2H2.2zM6.4 14.4h3.2"/>',
 trophy:'<path d="M4.4 1.8h7.2v4a3.6 3.6 0 0 1-7.2 0zM4.4 3.2H2v1.4a2.4 2.4 0 0 0 2.6 2.4M11.6 3.2H14v1.4a2.4 2.4 0 0 1-2.6 2.4M8 9.4v2.8M5 14.2h6l-.6-2H5.6z"/>',
 link:'<path d="M6.6 9.4l2.8-2.8M7 4.6l1.4-1.4a2.8 2.8 0 0 1 4 4L11 8.6M9 11.4l-1.4 1.4a2.8 2.8 0 0 1-4-4L5 7.4"/>',
};
const pgIcon=k=>`<svg class="pg-i" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${PG_ICONS[k]||''}</svg>`;
const PG_SIGNAL={no_checkin:'note',overdue_tasks:'clock',low_attendance:'calendar',needs_help:'flag',no_accounts:'user'};
// A view animates on its first visit only (count-up, fills, staggered rise); re-renders after a click stay still.
// One rule for every view (BirdMotion): animate when the route was just opened, never after a filter click or a save.
function pgFirst(){return cache.intro?' is-first':'';}
const pgWrap=(key,cls,html)=>`<div class="pg ${cls}${pgFirst(key)}">${html}</div>`;
const pgNum=(n,suffix='')=>n===null||n===undefined||n==='—'?`<b class="pg-num">—</b>`:`<b class="pg-num" data-pg-count="${Number(n)||0}">${esc(n)}</b>${suffix?`<small class="pg-unit">${esc(suffix)}</small>`:''}`;
// Stacked bar: parts are [value, tone]; the rest up to total stays empty track.
const pgBar=(parts,total,label,cls='')=>{const t=Math.max(total||0,parts.reduce((s,p)=>s+p[0],0),1);return `<span class="pg-bar ${cls}" role="img" aria-label="${esc(label)}">${parts.filter(p=>p[0]>0).map(([v,c])=>`<i class="is-${c}" style="--w:${(v/t*100).toFixed(1)}%"></i>`).join('')}</span>`;};
const pgZDay=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).format(d instanceof Date?d:new Date(d.length===10?d+'T12:00:00Z':d));
const pgDayDiff=iso=>Math.round((Date.parse(pgZDay(iso))-Date.parse(pgZDay(new Date())))/86400000);
const pgRel=iso=>new Intl.RelativeTimeFormat(loc[lang],{numeric:'auto'}).format(pgDayDiff(iso),'day');
const pgFmt=(iso,o)=>new Intl.DateTimeFormat(loc[lang],{...o,timeZone:'Europe/Zagreb'}).format(new Date(iso.length===10?iso+'T12:00:00Z':iso));
const pgTime=iso=>pgFmt(iso,{hour:'2-digit',minute:'2-digit'});
const pgDate=(iso,cls='')=>`<span class="pg-date ${cls}" aria-hidden="true"><small>${esc(pgFmt(iso,{weekday:'short'}))}</small><b>${esc(pgFmt(iso,{day:'numeric'}).replace('.',''))}</b><small>${esc(pgFmt(iso,{month:'short'}))}</small></span>`;
const pgGo=(href,label,cls='')=>`<a class="pg-go ${cls}" href="${href}">${esc(label)}${pgIcon('arrow')}</a>`;
const pgHead=(icon,title,badge,tone='')=>`<header class="pg-card-head"><h3>${pgIcon(icon)}<span>${esc(title)}</span></h3>${badge!==undefined&&badge!==null&&badge!==''?`<span class="pg-badge ${tone}">${badge}</span>`:''}</header>`;
const pgCard=(i,cls,head,body,foot='')=>`<section class="pg-card ${cls}" style="--i:${i}">${head}${body}${foot?`<footer class="pg-card-foot">${foot}</footer>`:''}</section>`;
const pgFold=(icon,label,body,{open=false,cls=''}={})=>`<details class="pg-fold ${cls}" ${open?'open':''}><summary>${pgIcon(icon)}<span>${esc(label)}</span></summary><div class="pg-fold-body">${body}</div></details>`;
const pgDot=(tone,label)=>`<span class="pg-status is-${tone}"><i aria-hidden="true"></i>${esc(label)}</span>`;
const pgHue=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h%6;};
const pgPlural=(key,n)=>window.BirdPluralText(T,key,n,lang);
const pgPct=(a,b)=>b?Math.round(a/b*100):null;

async function todayView(){
 const [t,who]=await Promise.all([api('GET','/api/admin/today?lang='+lang),api('GET','/api/auth/me').catch(()=>null)]);
 if(who)cache.messages=who.messages||0;
 const msgLine=cache.messages?`<a class="pg-msgline" href="#/account/messages">${pgIcon('chat')}<strong>${esc(tr('dmTab'))}</strong><span>${esc(pgPlural('msgUnread',cache.messages).replace('{n}',cache.messages))}</span><span aria-hidden="true">→</span></a>`:'';
 const teams=t.teams.filter(x=>x.members),unregistered=t.teams.filter(x=>!x.members).length;
 const lv={ok:0,watch:0,risk:0};teams.forEach(x=>lv[x.level]++);
 const calm=pgPct(lv.ok,teams.length);
 const order={risk:0,watch:1,ok:2};
 const attention=teams.filter(x=>x.level!=='ok'||x.waiting||x.inactive);
 const now=new Date(),dayTitle=pgFmt(now.toISOString(),{weekday:'long',day:'numeric',month:'long'});
 const health=`<div class="pg-health">
  <div class="pg-health-num ${calm===null||calm>=70?'':calm>=45?'is-watch':'is-risk'}"><span class="pg-n">${pgNum(calm,'%')}</span><span>${esc(tr('pgOnTrack'))}</span></div>
  <div class="pg-health-meter"><ol class="pg-segs" aria-label="${esc(tr('pgHealth'))}">${[...teams].sort((a,b)=>order[a.level]-order[b.level]||a.name.localeCompare(b.name)).map((x,i)=>`<li class="is-${x.level}" style="--i:${i}"><a href="#/admin/team/${esc(x.id)}" title="${esc(x.name+' · '+tr('risk_'+x.level))}"><span>${esc(x.name)}</span><span class="acc-sr"> · ${esc(tr('risk_'+x.level))}</span></a></li>`).join('')}</ol>
  <p class="pg-legend">${['ok','watch','risk'].map(k=>`<span><i class="pg-dot is-${k}" aria-hidden="true"></i>${lv[k]} ${esc(tr('risk_'+k))}</span>`).join('')}${unregistered?`<a href="#/admin/overview"><i class="pg-dot is-none" aria-hidden="true"></i>${unregistered} ${esc(pgPlural('pgNotRegistered',unregistered))}</a>`:''}</p></div></div>`;
 const tile=(n,icon,label,href,tone)=>`<a class="pg-tile ${n?'is-'+tone:'is-zero'}" href="${href}">${pgIcon(icon)}<span class="pg-tile-n">${pgNum(n)}</span><span class="pg-tile-l">${esc(tr(label))}</span></a>`;
 const tiles=`<nav class="pg-tiles" aria-label="${esc(tr('pgInbox'))}">${tile(t.waiting,'hourglass','reviews','#/admin/reviews','info')}${tile(t.overdue.length,'clock','overdueTasks','#/admin/tasks','risk')}${tile(t.meetings||0,'chat','meetRequestsAdmin','#/admin/mentors','info')}${tile(t.unverified,'check','digestAttendance','#/admin/lectures','watch')}${tile(t.claims,'user','claims','#/admin/claims','watch')}</nav>`;
 const reasons=x=>[...x.signals.map(s=>[PG_SIGNAL[s]||'flag',tr('pgSig_'+s),s==='needs_help'||s==='overdue_tasks'?'risk':'watch']),...(x.waiting?[['hourglass',tr('pgSigWaiting').replace('{n}',x.waiting),'info']]:[]),...(x.inactive?[['moon',tr('pgSigQuiet'),'watch']]:[])];
 const attentionCard=pgCard(0,'pg-attention',pgHead('flag',tr('needsAttention'),attention.length||'',attention.length?'is-risk':''),
  attention.length?`<ul class="pg-teams">${attention.sort((a,b)=>order[a.level]-order[b.level]||(a.percent??0)-(b.percent??0)).map(x=>`<li class="is-${x.level}"><a href="#/admin/team/${esc(x.id)}"><span class="pg-team-name"><i class="pg-dot is-${x.level}" aria-hidden="true"></i><strong>${esc(x.name)}</strong><span class="acc-sr">${esc(tr('risk_'+x.level))}</span></span><span class="pg-team-pct">${pgBar([[x.percent||0,x.level]],100,tr('progress')+': '+percent(x.percent),'is-thin')}<small>${percent(x.percent)}</small></span></a><ul class="pg-reasons">${reasons(x).map(([i,l,tone])=>`<li class="is-${tone}">${pgIcon(i)}${esc(l)}</li>`).join('')}</ul></li>`).join('')}</ul>`:`<p class="pg-calm">${pgIcon('check')}${esc(tr('allCalm'))}</p>`,
  pgGo('#/admin/overview/nudge',tr('pgNudgeTeams')));
 // Mini timeline: the next two weeks, one cell per day, lectures and mentor hours as marks.
 const start=new Date(pgZDay(now)+'T12:00:00Z'),cells=[];
 for(let i=0;i<14;i++){const d=new Date(start.getTime()+i*86400000),key=d.toISOString().slice(0,10);cells.push({i,key,d,lectures:t.lectures.filter(l=>l.date===key),slots:t.slots.filter(s=>pgZDay(s.startsAt)===key)});}
 const events=[...t.lectures.map(l=>({at:l.date+'T'+(l.time||'00:00'),date:l.date,kind:'lecture',html:`<a href="#/admin/lecture/${esc(l.id)}">${pgDate(l.date)}<span class="pg-ev-main"><strong>${esc(pick(l.title))}</strong><small>${[l.time,l.place].filter(Boolean).map(esc).join(' · ')}</small></span><span class="pg-ev-kind is-lecture" title="${esc(tr('pgLecture'))}">${pgIcon('mic')}<span class="acc-sr">${esc(tr('pgLecture'))}</span></span></a>`})),
  ...t.slots.map(s=>({at:s.startsAt,date:s.startsAt,kind:'slot',html:`<a href="#/admin/mentors">${pgDate(s.startsAt)}<span class="pg-ev-main"><strong>${esc(s.mentor)}</strong><small>${esc(pgTime(s.startsAt))} · ${s.team?esc(s.team):esc(tr('pgFree'))}</small></span><span class="pg-ev-kind is-slot ${s.team?'is-booked':''}" title="${esc(tr(s.team?'pgBooked':'pgFree'))}">${pgIcon('chat')}<span class="acc-sr">${esc(tr(s.team?'pgBooked':'pgFree'))}</span></span></a>`}))].sort((a,b)=>a.at.localeCompare(b.at));
 const strip=`<ol class="pg-strip" aria-hidden="true">${cells.map(c=>`<li class="${c.i===0?'is-today':''} ${[0,6].includes(c.d.getUTCDay())?'is-weekend':''}"><small>${esc(pgFmt(c.key,{weekday:'narrow'}))}</small><b>${c.d.getUTCDate()}</b><span>${c.lectures.map(()=>'<i class="is-lecture"></i>').join('')}${c.slots.map(s=>`<i class="is-slot ${s.team?'is-booked':''}"></i>`).join('')}</span></li>`).join('')}</ol>`;
 const comingCard=pgCard(1,'pg-coming',pgHead('calendar',tr('comingUp')),`${strip}<p class="pg-legend is-small"><span><i class="pg-mark is-lecture"></i>${esc(tr('pgLecture'))}</span><span><i class="pg-mark is-slot is-booked"></i>${esc(tr('pgBooked'))}</span><span><i class="pg-mark is-slot"></i>${esc(tr('pgFree'))}</span></p>${events.length?`<ul class="pg-events">${events.map(e=>`<li>${e.html}</li>`).join('')}</ul>`:`<p class="pg-calm">${esc(tr('pgNothingSoon'))}</p>`}`,pgGo('#/admin/lectures',tr('pgPlanProgramme')));
 const late=iso=>Math.max(1,-pgDayDiff(iso));
 const overdueCard=pgCard(2,'pg-overdue',pgHead('clock',tr('overdueTasks'),t.overdue.length||'',t.overdue.length?'is-risk':''),t.overdue.length?`<ul class="pg-late">${t.overdue.slice(0,8).map(o=>`<li><a href="${o.userId?'#/admin/person/'+esc(o.userId):'#/admin/team/'+esc(o.projectId)}"><span class="pg-late-days" title="${esc(date(o.dueAt,true))}"><b>${late(o.dueAt)}</b><small>${esc(pgPlural('pgDaysLate',late(o.dueAt)))}</small></span><span class="pg-ev-main"><strong>${esc(o.who)}</strong><small>${esc(o.title)}</small></span></a></li>`).join('')}</ul>${t.overdue.length>8?`<p class="pg-more">+${t.overdue.length-8}</p>`:''}`:`<p class="pg-calm">${pgIcon('check')}${esc(tr('pgNoOverdue'))}</p>`,pgGo('#/admin/tasks',tr('pgOpenTasks')));
 const helpCard=t.help.length?pgCard(3,'pg-help',pgHead('flag',tr('needsHelp'),t.help.length,'is-risk'),`<ul class="pg-quotes">${t.help.map(h=>`<li><blockquote>${esc(h.blocker)}</blockquote><a href="#/admin/team/${esc(h.projectId)}">— ${esc(h.name)}</a></li>`).join('')}</ul>`,pgGo('#/admin/team/'+esc(t.help[0].projectId),tr('pgAnswerHelp'))):'';
 return adminShell('today',pgWrap('today','pg-today',`<header class="pg-hero"><div><span class="pg-kicker">${esc(dayTitle)}</span><h2 class="pg-title">${esc(tr('pgBriefing'))}</h2></div>${health}</header>${msgLine}${tiles}<div class="pg-grid pg-split pg-today-grid"><div class="pg-stack">${attentionCard}${overdueCard}</div><div class="pg-stack">${comingCard}${helpCard}</div></div>`));
}

// Programme: lectures ------------------------------------------------------------------
function lectureStats(m){
 const stats=new Map(m.lectures.map(x=>[x.id,{v:0,s:0}]));
 for(const p of m.people)for(const [id,k] of Object.entries(p.marks)){const s=stats.get(id);if(s&&k){if(k==='verified_by_admin')s.v++;else s.s++;}}
 return stats;
}
const pgAttBar=(s,seats)=>`<span class="pg-att">${pgBar([[s.v,'ok'],[s.s,'watch']],seats,`${tr('attendance')}: ${s.v} ${tr('pgVerifiedShort')}, ${s.s} ${tr('selfReportedShort')} / ${seats}`)}<small><b>${s.v+s.s}</b>/${seats}</small></span>`;
const pgScore=f=>f&&f.answers?`<span class="pg-score ${f.average>=8?'is-ok':f.average>=6?'is-watch':'is-risk'}" title="${esc(tr('lectureFeedback')+': '+f.average+'/10 · '+f.answers+' '+pgPlural('answers',f.answers).toLowerCase())}">${pgIcon('star')}${esc(f.average)}</span>`:'';
async function lecturesView(){
 const [l,a,m,fb]=await Promise.all([api('GET','/api/admin/lectures'),api('GET','/api/admin/attendance'),api('GET','/api/admin/attendance/matrix'),api('GET','/api/admin/feedback').catch(()=>({items:[]}))]);
 const seats=m.people.length,stats=lectureStats(m),fbBy=new Map(fb.items.map(f=>[f.lectureId,f])),today=pgZDay(new Date());
 const items=[...l.items].sort((x,y)=>x.date.localeCompare(y.date)||String(x.time||'').localeCompare(String(y.time||'')));
 const held=m.lectures,upcoming=items.filter(x=>x.date>today&&x.status==='published');
 const came=held.reduce((n,x)=>n+stats.get(x.id).v+stats.get(x.id).s,0),rate=pgPct(came,held.length*seats);
 const toVerify=a.items.filter(x=>x.kind==='self_reported'),title=id=>pick(l.items.find(y=>y.id===id)?.title);
 const next=upcoming[0];
 const kpis=`<div class="pg-kpis"><div class="pg-kpi">${pgIcon('mic')}<span class="pg-kpi-n">${pgNum(held.length)}<small class="pg-unit">/${items.filter(x=>x.status==='published').length}</small></span><span class="pg-kpi-l">${esc(pgPlural('pgHeld',held.length))}</span></div>
  <div class="pg-kpi">${pgIcon('user')}<span class="pg-kpi-n">${pgNum(rate,'%')}</span><span class="pg-kpi-l">${esc(tr('pgAvgAttendance'))}</span>${rate!==null?pgBar([[rate,rate>=70?'ok':rate>=45?'watch':'risk']],100,tr('pgAvgAttendance')+': '+rate+'%','is-thin'):''}</div>
  <div class="pg-kpi ${toVerify.length?'is-watch':''}">${pgIcon('check')}<span class="pg-kpi-n">${pgNum(toVerify.length)}</span><span class="pg-kpi-l">${esc(tr('digestAttendance'))}</span></div>
  <div class="pg-kpi">${pgIcon('calendar')}<span class="pg-kpi-n is-text">${next?esc(pgRel(next.date)):'—'}</span><span class="pg-kpi-l">${esc(tr('pgNextLecture'))}</span></div></div>`;
 let marked=false;
 const rows=items.map((x,i)=>{
  const future=x.date>today,s=stats.get(x.id);let divider='';
  if(future&&!marked){marked=true;divider=`<li class="pg-now" aria-hidden="true"><span>${esc(tr('today'))}</span></li>`;}
  const right=s?`${pgAttBar(s,seats)}${pgScore(fbBy.get(x.id))}`:future?`<small class="pg-in">${esc(pgRel(x.date))}</small>`:'';
  return `${divider}<li class="pg-lec ${future?'is-future':''} ${x.status!=='published'?'is-off':''}" style="--i:${i}"><a href="#/admin/lecture/${esc(x.id)}">${pgDate(x.date)}<span class="pg-ev-main"><strong>${esc(pick(x.title))}</strong><small>${[x.time,x.place,x.speaker].filter(Boolean).map(esc).join(' · ')}</small></span>${x.status!=='published'?statusChip(x.status):''}</a><span class="pg-lec-right">${right}</span></li>`;
 }).join('');
 const legend=`<p class="pg-legend is-small"><span><i class="pg-mark is-ok"></i>${esc(tr('pgVerifiedShort'))}</span><span><i class="pg-mark is-watch"></i>${esc(tr('selfReportedShort'))}</span><span><i class="pg-mark is-track"></i>${esc(tr('pgMissed'))}</span></p>`;
 const timeline=pgCard(0,'pg-lectures-card',pgHead('mic',tr('lectures'),items.length),items.length?`${legend}<ol class="pg-timeline">${rows}${marked?'':`<li class="pg-now" aria-hidden="true"><span>${esc(tr('today'))}</span></li>`}</ol>`:empty(),pgFold('plus',tr('addLecture'),`<form data-form="lecture" class="pg-form">${lectureFields()}<button class="acc-primary">${tr('save')}</button></form>`));
 const verify=toVerify.length?pgCard(1,'pg-verify',pgHead('check',tr('digestAttendance'),toVerify.length,'is-watch'),`<ul class="pg-rows">${toVerify.map(x=>`<li><span class="pg-ev-main"><strong>${esc(x.userName)}</strong><small>${esc(title(x.lectureId))}</small></span><span class="acc-actions"><button data-act="verify" data-user="${esc(x.userId)}" data-lecture="${esc(x.lectureId)}" class="acc-primary">${pgIcon('check')}${tr('verify')}</button><button data-act="att-remove" data-user="${esc(x.userId)}" data-lecture="${esc(x.lectureId)}" data-confirm="${esc(tr('confirmRemoveMark'))}">${tr('remove')}</button></span></li>`).join('')}</ul>`):'';
 const recent=m.lectures.slice(-8).reverse(),sign={verified_by_admin:'✓',self_reported:'○'};
 const matrix=pgCard(2,'pg-matrix',pgHead('user',tr('whoCame')),`<p class="pg-note">${tr('whoCameNote')}</p>${recent.length&&m.people.length?`<div class="acc-table-wrap"><table class="acc-table acc-matrix acc-attendance-table pg-table"><thead><tr><th>${tr('displayName')}</th>${recent.map(x=>`<th title="${esc(pick(x.title))}">${date(x.date).replace(/\s*\d{4}.*$/,'')}</th>`).join('')}</tr></thead><tbody>${m.people.map(p=>`<tr><th scope="row"><a href="#/admin/person/${esc(p.id)}">${esc(p.name)}</a><small>${esc(p.team)}</small></th>${recent.map(x=>`<td><button class="acc-mark is-${esc(p.marks[x.id]||'none')}" data-act="att-toggle" data-user="${esc(p.id)}" data-lecture="${esc(x.id)}" data-kind="${esc(p.marks[x.id]||'')}" aria-label="${esc(p.name+' · '+pick(x.title))}">${sign[p.marks[x.id]]||'·'}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty()}`,
  [m.lectures.length?pgFold('check',tr('bulkVerify'),`<form data-form="bulk-verify" class="pg-form">${select('lectureId',tr('lectures'),m.lectures.map(x=>[x.id,pick(x.title)+' · '+x.date]),m.lectures.at(-1)?.id)}<div class="acc-checks">${m.people.map(u=>`<label class="acc-check"><input type="checkbox" name="userId" value="${esc(u.id)}"> ${esc(u.name)}</label>`).join('')}</div><button class="acc-primary">${tr('verify')}</button></form>`):'',
   pgFold('note',`${tr('pgAllMarks')} (${a.items.length})`,a.items.length?`<ul class="pg-rows is-dense">${a.items.map(x=>`<li><span class="pg-ev-main"><strong>${esc(x.userName)}</strong><small>${esc(title(x.lectureId))} · ${pgDot(x.kind==='verified_by_admin'?'ok':'watch',tr(x.kind==='verified_by_admin'?'pgVerifiedShort':'selfReportedShort'))}</small></span><span class="acc-actions">${x.kind==='self_reported'?`<button data-act="verify" data-user="${esc(x.userId)}" data-lecture="${esc(x.lectureId)}" class="acc-secondary">${tr('verify')}</button>`:''}<button data-act="att-remove" data-user="${esc(x.userId)}" data-lecture="${esc(x.lectureId)}" data-confirm="${esc(tr('confirmRemoveMark'))}">${tr('remove')}</button></span></li>`).join('')}</ul>`:empty())].join(''));
 return adminShell('lectures',pgWrap('lectures','pg-lectures',`${kpis}<div class="pg-grid pg-split">${timeline}<div class="pg-stack">${verify}${matrix}</div></div>`));
}
async function lectureDetail(id){
 const [l,m,fb]=await Promise.all([api('GET','/api/admin/lectures'),api('GET','/api/admin/attendance/matrix'),api('GET','/api/admin/feedback').catch(()=>({items:[]}))]);
 const x=l.items.find(y=>y.id===id);if(!x)return adminShell('lectures',empty());
 const s=lectureStats(m).get(x.id),f=fb.items.find(y=>y.lectureId===x.id),seats=m.people.length;
 const missed=s?m.people.filter(p=>!p.marks[x.id]):[];
 const facts=s?`<div class="pg-lecture-facts"><div class="pg-big-att"><span class="pg-n">${pgNum(pgPct(s.v+s.s,seats),'%')}</span><span>${esc(tr('attendance'))}</span>${pgAttBar(s,seats)}</div>
  ${f&&f.answers?`<div class="pg-big-att"><span class="pg-n">${pgNum(f.average)}<small class="pg-unit">/10</small></span><span>${esc(tr('lectureFeedback'))} · ${f.answers} ${esc(pgPlural('answers',f.answers).toLowerCase())}</span>${pgBar([[f.average*10,f.average>=8?'ok':f.average>=6?'watch':'risk']],100,f.average+'/10','is-thin')}</div>`:''}
  ${missed.length?`<div class="pg-missed"><span class="pg-label">${esc(tr('pgMissed'))} · ${missed.length}</span><p>${missed.map(p=>`<a href="#/admin/person/${esc(p.id)}">${esc(p.name)}</a>`).join(', ')}</p></div>`:''}</div>`:`<p class="pg-in">${esc(pgRel(x.date))}</p>`;
 return adminShell('lectures',pgWrap('lecture:'+id,'pg-lecture',`<a class="acc-back" href="#/admin/lectures">← ${tr('lectures')}</a><header class="pg-lecture-head">${pgDate(x.date,'is-big')}<div><h2 class="pg-title">${esc(pick(x.title))}</h2><p class="pg-note">${[x.time,x.place,x.speaker].filter(Boolean).map(esc).join(' · ')} ${x.status!=='published'?statusChip(x.status):''}</p></div></header>${facts}
  <form data-form="lecture" data-id="${esc(x.id)}" class="pg-card pg-form"><h3 class="pg-form-title">${pgIcon('note')}${esc(tr('pgEditLecture'))}</h3>${lectureFields(x)}${select('status',tr('status'),[['published',tr('st_published')],['draft',tr('st_draft')],['archived',tr('lectureCancelled')]],x.status)}<button class="acc-primary">${tr('save')}</button></form>`));
}

// Programme: mentors -------------------------------------------------------------------
async function mentorsAdminView(){
 const [slots,mentors,asks]=await Promise.all([api('GET','/api/office-hours'),api('GET','/api/mentors'),api('GET','/api/meeting-requests?all=1')]);
 const open=asks.items.filter(r=>r.status==='pending'),done=asks.items.filter(r=>r.status!=='pending').slice(0,10);
 const now=Date.now(),upcoming=slots.items.filter(s=>Date.parse(s.startsAt)>=now);
 const mentorSelect=value=>mentors.items.length?select('mentorId',tr('mentorProfiles'),[['',tr('guestMentor')],...mentors.items.map(m=>[m.id,m.name+' · '+m.area])],value):'';
 const slotChip=s=>`<li class="pg-slot ${s.booked?'is-booked':''}" title="${esc([date(s.startsAt,true),s.topic,s.booked?tr('bookedOther')+': '+(s.projectName||''):tr('pgFree')].filter(Boolean).join(' · '))}"><b>${esc(pgFmt(s.startsAt,{weekday:'short',day:'numeric'}))}</b> ${esc(pgTime(s.startsAt))}${s.booked?`<span>${esc(s.projectName||tr('bookedOther'))}</span>`:''}<span class="acc-sr"> · ${esc(s.booked?tr('pgBooked'):tr('pgFree'))}</span></li>`;
 const ratio=list=>{const b=list.filter(s=>s.booked).length;return `<div class="pg-ratio">${pgBar([[b,'info'],[list.length-b,'free']],list.length,`${b} ${tr('pgBooked')} / ${list.length-b} ${tr('pgFree')}`)}<small><b>${b}</b> ${esc(tr('pgBooked'))} · <b>${list.length-b}</b> ${esc(tr('pgFree'))}</small></div>`;};
 const requests=open.length||done.length?pgCard(0,'pg-requests',pgHead('chat',tr('meetRequestsAdmin'),open.length||'',open.length?'is-info':''),`<p class="pg-note">${tr('meetAdminNote')}</p>${open.length?`<ul class="pg-req-list">${open.map(r=>`<li class="pg-req"><div class="pg-req-head"><strong>${esc(r.projectName)}</strong>${pgIcon('arrow')}<strong>${esc(r.mentorName||tr('meetAnyMentor'))}</strong><small>${esc(r.who)} · ${date(r.created,true)} · ${r.price} ${pgPlural('xp',r.price)}</small></div><blockquote>${esc(r.topic)}</blockquote>${r.times?`<p class="pg-note">${pgIcon('clock')} ${esc(r.times)}</p>`:''}
  <form data-form="meet-arrange" data-id="${esc(r.id)}" class="pg-form acc-compact"><div class="acc-inline">${mentorSelect(r.mentorId||mentors.items[0]?.id)}${field('mentorName',tr('guestMentor'),{attrs:'maxlength="100"'})}</div><div class="acc-inline">${field('startsAt',tr('startsAt'),{type:'datetime-local',required:true})}${field('durationMin',tr('duration'),{type:'number',value:30,attrs:'min="10" max="240"'})}${field('location',tr('location'),{attrs:'maxlength="200"'})}</div><div class="acc-actions"><button class="acc-primary">${tr('meetArrange')}</button><button type="button" data-act="meet-decline" data-id="${esc(r.id)}" data-confirm="${esc(tr('meetDeclineConfirm'))}">${tr('decline')}</button></div></form></li>`).join('')}</ul>`:''}`,
  done.length?pgFold('note',`${tr('history')} (${done.length})`,`<ul class="pg-rows is-dense">${done.map(r=>`<li><span class="pg-ev-main"><strong>${esc(r.projectName)} → ${esc(r.mentorName||tr('meetAnyMentor'))}</strong><small>${esc(r.topic)}</small></span>${pgDot(r.status==='arranged'?'ok':'none',tr('meet_'+r.status)+' · '+date(r.decidedAt||r.created))}</li>`).join('')}</ul>`):''):'';
 const known=new Set(mentors.items.map(m=>m.id));
 const cards=mentors.items.map((m,i)=>{const list=upcoming.filter(s=>s.mentorId===m.id);
  return `<article class="pg-mentor" style="--i:${i}"><header><span class="pg-ava is-c${pgHue(m.area)}" aria-hidden="true">${esc(initials(m.name))}</span><div><h3>${esc(m.name)}</h3><span class="pg-area is-c${pgHue(m.area)}">${esc(m.area)}</span></div></header>${m.bio?`<p class="pg-bio">${esc(m.bio)}</p>`:''}${list.length?`${ratio(list)}<ul class="pg-slots">${list.slice(0,6).map(slotChip).join('')}</ul>`:`<p class="pg-empty-slots">${esc(tr('pgNoHours'))}</p>`}
  ${pgFold('note',tr('pgEdit'),`<form data-form="mentor" data-id="${esc(m.id)}" class="pg-form acc-compact"><div class="acc-inline">${field('name',tr('mentorName'),{required:true,value:m.name,attrs:'maxlength="100"'})}${field('area',tr('mentorArea'),{required:true,value:m.area,attrs:'maxlength="60" list="mentor-areas"'})}</div>${field('bio',tr('mentorBio'),{value:m.bio,attrs:'maxlength="600"'})}${field('link',tr('mentorLink'),{type:'url',value:m.link,attrs:'maxlength="300"'})}<div class="acc-actions"><button class="acc-primary">${tr('save')}</button><button type="button" data-act="mentor-archive" data-id="${esc(m.id)}" data-confirm="${esc(tr('confirmRemoveMentor'))}">${tr('remove')}</button></div></form>`,{cls:'is-quiet'})}</article>`;}).join('');
 const guests=upcoming.filter(s=>!s.mentorId||!known.has(s.mentorId));
 const guestCard=guests.length?`<article class="pg-mentor is-guest"><header><span class="pg-ava" aria-hidden="true">${pgIcon('user')}</span><div><h3>${esc(tr('pgGuests'))}</h3><span class="pg-area">${[...new Set(guests.map(s=>s.mentorName))].map(esc).join(', ')}</span></div></header>${ratio(guests)}<ul class="pg-slots">${guests.slice(0,6).map(slotChip).join('')}</ul></article>`:'';
 const allBooked=upcoming.filter(s=>s.booked).length;
 const mentorsCard=pgCard(1,'pg-mentors-card',pgHead('user',tr('mentorProfiles'),mentors.items.length),`<p class="pg-note">${tr('mentorProfilesNote')}</p><datalist id="mentor-areas">${['Sales','Marketing','Product','Fundraising','Legal','Finance','Tech','Pitch'].map(a=>`<option value="${a}">`).join('')}</datalist><div class="pg-mentor-grid">${cards}${guestCard}</div>`,
  `${pgFold('plus',tr('newSlot'),`<form data-form="slot" class="pg-form"><div class="acc-inline">${mentorSelect(mentors.items[0]?.id)}${field('mentorName',tr('guestMentor'),{attrs:'maxlength="100"'})}${field('topic',tr('topic'),{attrs:'maxlength="200"'})}</div><div class="acc-inline">${field('startsAt',tr('startsAt'),{type:'datetime-local',required:true})}${field('durationMin',tr('duration'),{type:'number',value:30,attrs:'min="10" max="240"'})}${field('price',tr('slotPrice'),{type:'number',value:30,attrs:'min="0" max="100000"'})}${field('location',tr('location'),{attrs:'maxlength="200"'})}</div><button class="acc-primary">${tr('save')}</button></form>`)}
  ${pgFold('user',tr('pgAddMentor'),`<form data-form="mentor" class="pg-form"><div class="acc-inline">${field('name',tr('mentorName'),{required:true,attrs:'maxlength="100"'})}${field('area',tr('mentorArea'),{required:true,hint:tr('mentorAreaHint'),attrs:'maxlength="60" list="mentor-areas"'})}</div>${field('bio',tr('mentorBio'),{attrs:'maxlength="600"'})}${field('link',tr('mentorLink'),{type:'url',attrs:'maxlength="300" placeholder="https://"'})}<button class="acc-primary">${tr('save')}</button></form>`)}
  ${pgFold('calendar',`${tr('pgSchedule')} (${slots.items.length})`,slots.items.length?`<ul class="pg-rows is-dense">${slots.items.map(x=>`<li class="${Date.parse(x.startsAt)<now?'is-past':''}"><span class="pg-ev-main"><strong>${date(x.startsAt,true)} · ${esc(x.mentorName)}</strong><small>${esc(x.topic)}${x.booked?` · ${tr('bookedOther')}: ${esc(x.projectName||'')}${x.question?' · '+esc(x.question):''}${x.note?' · '+esc(x.note):''}`:''}</small></span>${pgDot(x.booked?'info':'none',tr(x.booked?'pgBooked':'pgFree'))}<button data-act="slot-cancel" data-id="${esc(x.id)}" data-confirm="${esc(tr('confirmCancelSlot'))}">${tr('cancelSlot')}</button></li>`).join('')}</ul>`:empty())}`);
 const kpis=`<div class="pg-kpis"><div class="pg-kpi">${pgIcon('user')}<span class="pg-kpi-n">${pgNum(mentors.items.length)}</span><span class="pg-kpi-l">${esc(tr('mentorProfiles'))}</span></div><div class="pg-kpi">${pgIcon('calendar')}<span class="pg-kpi-n">${pgNum(upcoming.length)}</span><span class="pg-kpi-l">${esc(pgPlural('pgUpcomingHours',upcoming.length))}</span></div><div class="pg-kpi">${pgIcon('check')}<span class="pg-kpi-n">${pgNum(pgPct(allBooked,upcoming.length),'%')}</span><span class="pg-kpi-l">${esc(tr('pgBookedShare'))}</span>${upcoming.length?pgBar([[allBooked,'info']],upcoming.length,'','is-thin'):''}</div><div class="pg-kpi ${open.length?'is-info':''}">${pgIcon('chat')}<span class="pg-kpi-n">${pgNum(open.length)}</span><span class="pg-kpi-l">${esc(tr('meetRequestsAdmin'))}</span></div></div>`;
 return adminShell('mentors',pgWrap('mentors','pg-mentors',`${kpis}${requests}${mentorsCard}`));
}

// Programme: rewards -------------------------------------------------------------------
async function rewardsAdminView(){
 const [r,o]=await Promise.all([api('GET','/api/rewards?all=1'),api('GET','/api/admin/reward-orders')]);
 const pending=o.items.filter(x=>x.status==='pending'),past=o.items.filter(x=>x.status!=='pending');
 const orders=pgCard(0,'pg-orders',pgHead('gift',tr('rewardOrders'),pending.length||'',pending.length?'is-info':''),pending.length?`<ul class="pg-rows">${pending.map(x=>`<li class="is-pending"><span class="pg-price is-small">${x.price}<small>${pgPlural('xp',x.price)}</small></span><span class="pg-ev-main"><strong>${esc(x.title)} · <a href="#/admin/team/${esc(x.projectId)}">${esc(x.team)}</a></strong><small>${esc(x.who)} · ${date(x.created,true)}${x.note?' · '+esc(x.note):''}</small></span><span class="acc-actions"><button class="acc-primary" data-act="order-decide" data-id="${esc(x.id)}" data-status="approved">${pgIcon('check')}${tr('approve')}</button><button data-act="order-decide" data-id="${esc(x.id)}" data-status="rejected" data-confirm="${esc(tr('orderRejectConfirm'))}">${tr('reject')}</button></span></li>`).join('')}</ul>`:`<p class="pg-calm">${pgIcon('check')}${esc(tr('pgNoOrders'))}</p>`,
  past.length?pgFold('note',`${tr('history')} (${past.length})`,`<ul class="pg-rows is-dense">${past.map(x=>`<li><span class="pg-ev-main"><strong>${esc(x.title)} · <a href="#/admin/team/${esc(x.projectId)}">${esc(x.team)}</a></strong><small>${esc(x.who)} · ${x.price} ${pgPlural('xp',x.price)} · ${date(x.created,true)}${x.note?' · '+esc(x.note):''}</small></span>${pgDot(x.status==='approved'?'ok':'none',tr('order_'+x.status))}</li>`).join('')}</ul>`):'');
 const tiles=r.items.map((x,i)=>`<article class="pg-reward ${x.archived?'is-archived':''}" style="--i:${i}"><span class="pg-price">${x.price}<small>${pgPlural('xp',x.price)}</small></span><h3>${esc(x.title)}</h3>${x.description?`<p class="pg-bio">${esc(x.description)}</p>`:''}${x.stock!==null?`<div class="pg-stock">${pgBar([[x.left,x.left?'ok':'risk']],x.stock,`${tr('rewardLeft')}: ${x.left}/${x.stock}`,'is-thin')}<small><b>${x.left}</b>/${x.stock} ${esc(tr('rewardLeft'))}</small></div>`:`<small class="pg-note">∞ ${esc(tr('pgUnlimited'))}</small>`}${x.archived?pgDot('none',tr('archived')):''}
  ${pgFold('note',tr('pgEdit'),`<form data-form="reward" data-id="${esc(x.id)}" class="pg-form acc-compact">${field('title',tr('title'),{required:true,value:x.title,attrs:'maxlength="120"'})}${field('description',tr('rewardDescription'),{type:'textarea',value:x.description,attrs:'rows="2" maxlength="600"'})}<div class="acc-inline">${field('price',tr('slotPrice'),{type:'number',value:x.price,required:true,attrs:'min="0" max="100000"'})}${field('stock',tr('rewardStock'),{type:'number',value:x.stock??'',hint:tr('rewardStockHint'),attrs:'min="0" max="10000"'})}</div><div class="acc-actions"><button class="acc-primary">${tr('save')}</button>${x.archived?`<button type="button" class="acc-secondary" data-act="reward-restore" data-id="${esc(x.id)}">${tr('rewardRestore')}</button>`:`<button type="button" data-act="reward-archive" data-id="${esc(x.id)}" data-confirm="${esc(tr('rewardArchiveConfirm'))}">${tr('remove')}</button>`}</div></form>`,{cls:'is-quiet'})}</article>`).join('');
 const shop=pgCard(1,'pg-shop',pgHead('trophy',tr('rewardsTitle'),r.items.filter(x=>!x.archived).length||''),`<p class="pg-note">${tr('newRewardNote')}</p>${r.items.length?`<div class="pg-reward-grid">${tiles}</div>`:empty()}`,
  pgFold('plus',tr('newReward'),`<form data-form="reward" class="pg-form">${field('title',tr('title'),{required:true,attrs:'maxlength="120"'})}${field('description',tr('rewardDescription'),{type:'textarea',attrs:'rows="2" maxlength="600"'})}<div class="acc-inline">${field('price',tr('slotPrice'),{type:'number',value:50,required:true,attrs:'min="0" max="100000"'})}${field('stock',tr('rewardStock'),{type:'number',attrs:'min="0" max="10000"'})}</div><button class="acc-primary">${tr('save')}</button></form>`));
 return adminShell('rewards',pgWrap('rewards','pg-rewards',`${orders}${shop}`));
}

// Programme: announcements, quests, reminders ------------------------------------------
async function newsAdminView(){
 const [n,qs,tl,hook,rem]=await Promise.all([api('GET','/api/announcements'),api('GET','/api/quests'),api('GET','/api/admin/tasks?status=published'),api('GET','/api/admin/chat-hook'),api('GET','/api/admin/reminders')]);
 const feed=pgCard(0,'pg-feed',pgHead('megaphone',tr('announcements'),n.items.length),
  `${pgFold('plus',tr('newAnnouncement'),`<form data-form="announcement" class="pg-form">${field('title',tr('title'),{required:true,attrs:'maxlength="160"'})}${field('body',tr('answer'),{type:'textarea',required:true,attrs:'rows="4" maxlength="4000"'})}<label class="acc-check"><input type="checkbox" name="pinned"> ${tr('pinned')}</label>${hook.configured?`<label class="acc-check"><input type="checkbox" name="toChat" checked> ${tr('toChat')}</label>`:''}<button class="acc-primary">${tr('publish')}</button></form>`,{cls:'is-primary'})}
  ${n.items.length?`<ul class="pg-news">${n.items.map((x,i)=>{const p=pgPct(x.readBy||0,x.audience||0);return `<li class="${x.pinned?'is-pinned':''}" style="--i:${i}"><div class="pg-news-head"><strong>${x.pinned?`<span class="pg-pin">${pgIcon('flag')}<span class="acc-sr">${esc(tr('pinned'))}</span></span>`:''}${esc(x.title)}</strong><small>${date(x.created,true)}</small></div><p class="pg-news-body">${esc(x.body)}</p><div class="pg-read">${pgBar([[x.readBy||0,'ok']],x.audience||0,`${x.readBy}/${x.audience} ${tr('readBy')}`,'is-thin')}<small><b>${x.readBy??0}</b>/${x.audience??0} ${esc(tr('readBy'))}${p!==null?` · ${p}%`:''}</small></div><div class="acc-actions">${waLink(`${x.title}\n\n${x.body}\n\n${siteLink('#/account')}`)}<button data-act="news-archive" data-id="${esc(x.id)}">${tr('archive').split(' ')[0]}</button></div></li>`;}).join('')}</ul>`:empty()}`);
 const quests=pgCard(1,'pg-quests',pgHead('trophy',tr('pgQuests'),qs.items.length||''),qs.items.length?`<ul class="pg-quest-list">${qs.items.map(q=>`<li><div class="pg-quest-top"><strong>${esc(pick(q.title))}</strong><button type="button" class="pg-x" data-act="quest-close" data-id="${esc(q.id)}" aria-label="${esc(tr('close')+': '+pick(q.title))}">${tr('close')}</button></div>${pgBar([[q.done,q.done>=q.target?'ok':'info']],q.target,`${q.done}/${q.target}`)}<small><b>${q.done}</b>/${q.target}</small></li>`).join('')}</ul>`:`<p class="pg-note">${esc(tr('pgNoQuests'))}</p>`,
  pgFold('plus',tr('newQuest'),`<form data-form="quest" class="pg-form">${['en','hr','ru'].map(l=>field('qt_'+l,tr('title')+' '+l.toUpperCase(),{required:l==='en',attrs:'maxlength="120"'})).join('')}${select('taskId',tr('tasks'),tl.items.map(x=>[x.id,taskText(x.translations)]),'')}${field('target',tr('target'),{type:'number',value:8,attrs:'min="1" max="1000"'})}<button class="acc-primary">${tr('save')}</button></form>`));
 const reminders=`<form data-form="reminders" class="pg-card pg-switch-card" style="--i:2"><div class="pg-switch-head">${pgIcon('bell')}<h3>${tr('autoReminders')}</h3>${pgDot(rem.enabled?'ok':'none',tr(rem.enabled?'remindersOn':'remindersOff'))}</div><p class="pg-note">${tr('autoRemindersNote')}</p><p class="pg-stat-line">${pgNum(rem.sentWeek)}<span>${esc(tr('remindersWeek'))}</span></p><button class="${rem.enabled?'':'acc-primary'}" name="enabled" value="${rem.enabled?'0':'1'}" ${rem.enabled?`data-confirm="${esc(tr('remindersOffConfirm'))}"`:''}>${tr(rem.enabled?'turnOff':'turnOn')}</button></form>`;
 const chat=`<form data-form="chat-hook" class="pg-card pg-switch-card" style="--i:3"><div class="pg-switch-head">${pgIcon('link')}<h3>${tr('chatHook')}</h3>${pgDot(hook.configured?'ok':'none',hook.configured?tr('configured'):tr('pgNotConnected'))}</div><p class="pg-note">${tr('chatHookNote')}</p><div class="acc-inline">${field('url','URL',{type:'url',attrs:'maxlength="300" autocomplete="off"'})}<button class="acc-secondary">${tr('save')}</button></div></form>`;
 return adminShell('news',pgWrap('news','pg-newsroom',`<div class="pg-grid pg-split">${feed}<div class="pg-stack">${quests}${reminders}${chat}</div></div>`));
}

// Programme: insights ------------------------------------------------------------------
async function insightsView(){
 const [d,fb,hook,tw]=await Promise.all([api('GET','/api/admin/digest'),api('GET','/api/admin/feedback'),api('GET','/api/admin/chat-hook'),api('GET','/api/admin/trends').catch(()=>null)]);
 const names=a=>a.length?a.slice(0,6).map(esc).join(', ')+(a.length>6?` +${a.length-6}`:''):'';
 const checked=d.teamsWithAccounts-d.noCheckin.length;
 const tile=(n,label,{icon,tone,href,sub='',meter=''})=>{const inner=`${pgIcon(icon)}<span class="pg-kpi-n">${n}</span><span class="pg-kpi-l">${esc(label)}</span>${meter}${sub?`<small class="pg-kpi-sub">${sub}</small>`:''}`;return href?`<a class="pg-kpi ${tone||''}" href="${href}">${inner}</a>`:`<div class="pg-kpi ${tone||''}">${inner}</div>`;};
 const digestCard=pgCard(0,'pg-digest',`<header class="pg-card-head"><h3>${pgIcon('calendar')}<span>${esc(tr('digest'))}</span></h3><span class="pg-badge">${esc(d.week)}</span>${hook.configured?`<button class="acc-secondary" data-act="digest-send">${tr('sendDigest')}</button>`:''}</header>`,
  `<div class="pg-kpis is-inside">${[
   tile(`${pgNum(checked)}<small class="pg-unit">/${d.teamsWithAccounts}</small>`,tr('pgCheckedIn'),{icon:'note',tone:d.noCheckin.length?'is-watch':'is-ok',meter:pgBar([[checked,'ok']],d.teamsWithAccounts,`${checked}/${d.teamsWithAccounts}`,'is-thin'),sub:d.noCheckin.length?`${esc(tr('pgMissing'))}: ${names(d.noCheckin)}`:''}),
   tile(pgNum(d.atRisk.length),tr('digestRisk'),{icon:'flag',tone:d.atRisk.length?'is-risk':'',sub:names(d.atRisk.map(t=>t.name))}),
   tile(pgNum(d.needsHelp.length),tr('digestHelp'),{icon:'flag',tone:d.needsHelp.length?'is-watch':'',sub:names(d.needsHelp)}),
   tile(pgNum(d.waitingReview),tr('digestReview'),{icon:'hourglass',tone:d.waitingReview?'is-info':'',href:'#/admin/reviews'}),
   tile(pgNum(d.unverifiedAttendance),tr('digestAttendance'),{icon:'check',tone:d.unverifiedAttendance?'is-watch':'',href:'#/admin/lectures'}),
   tile(pgNum(d.inactive.length),tr('digestInactive'),{icon:'moon',tone:d.inactive.length?'is-watch':'',href:'#/admin/users',sub:names(d.inactive)}),
   tile(pgNum(d.newAccounts),tr('digestNew'),{icon:'user'}),
  ].join('')}</div>${hook.configured?'':`<p class="pg-note">${tr('digestHookNote')}</p>`}`);
 let charts='';
 if(tw){
  const wk=w=>w.week.replace(/^\d{4}-W0?/,tr('pgWeekShort'));
  const max=Math.max(1,...tw.weeks.map(w=>w.checkins+w.submitted+w.attended));
  const activity=`<div class="pg-cols" role="img" aria-label="${esc(tr('pgActivity')+': '+tw.weeks.map(w=>`${wk(w)} ${w.checkins+w.submitted+w.attended}`).join(', '))}">${tw.weeks.map((w,i)=>{const total=w.checkins+w.submitted+w.attended;return `<div class="pg-col ${i===tw.weeks.length-1?'is-now':''}" style="--i:${i}" title="${esc(`${wk(w)} · ${tr('pgCheckins')} ${w.checkins} · ${tr('pgSubmitted')} ${w.submitted} · ${tr('pgAttended')} ${w.attended}`)}"><span class="pg-col-n">${total||''}</span><span class="pg-col-bar"><span class="pg-col-fill" style="--h:${(total/max*100).toFixed(1)}%">${[['checkins','ok'],['submitted','info'],['attended','watch']].map(([k,c])=>w[k]?`<i class="is-${c}" style="flex-grow:${w[k]}"></i>`:'').join('')}</span></span><small>${esc(wk(w))}</small></div>`;}).join('')}</div><p class="pg-legend is-small"><span><i class="pg-mark is-ok"></i>${esc(tr('pgCheckins'))}</span><span><i class="pg-mark is-info"></i>${esc(tr('pgSubmitted'))}</span><span><i class="pg-mark is-watch"></i>${esc(tr('pgAttended'))}</span></p>`;
  const lec=tw.lectures.slice(-8);
  const attendance=lec.length?`<div class="pg-cols is-pct" role="img" aria-label="${esc(tr('pgAttendanceTrend')+': '+lec.map(l=>`${l.date} ${pgPct(l.verified+l.selfReported,l.seats)??0}%`).join(', '))}">${lec.map((l,i)=>{const p=pgPct(l.verified+l.selfReported,l.seats)??0;return `<a class="pg-col" style="--i:${i}" href="#/admin/lecture/${esc(l.id)}" title="${esc(`${pick(l.title)} · ${l.verified} ${tr('pgVerifiedShort')} · ${l.selfReported} ${tr('selfReportedShort')} / ${l.seats}`)}"><span class="pg-col-n">${p}%</span><span class="pg-col-bar is-track"><span class="pg-col-fill" style="--h:${p}%">${l.verified?`<i class="is-ok" style="flex-grow:${l.verified}"></i>`:''}${l.selfReported?`<i class="is-watch" style="flex-grow:${l.selfReported}"></i>`:''}</span></span><small>${esc(pgFmt(l.date,{day:'numeric',month:'numeric'}))}</small></a>`;}).join('')}</div><p class="pg-legend is-small"><span><i class="pg-mark is-ok"></i>${esc(tr('pgVerifiedShort'))}</span><span><i class="pg-mark is-watch"></i>${esc(tr('selfReportedShort'))}</span></p>`:empty();
  const k=tw.tasks,total=k.accepted+k.submitted+k.changes_requested+k.open+k.overdue,parts=[['accepted','ok',tr('pgDone')],['submitted','info',tr('pgInReview')],['changes_requested','watch',tr('st_changes_requested')],['open','muted',tr('pgOpen')],['overdue','risk',tr('overdueTasks')]];
  const tasks=`<div class="pg-task-head"><span class="pg-n">${pgNum(pgPct(k.accepted,total),'%')}</span><span>${esc(tr('pgTasksDone'))}</span></div>${pgBar(parts.map(([key,c])=>[k[key],c]),total,parts.map(([key,,l])=>`${l} ${k[key]}`).join(', '),'is-fat')}<ul class="pg-task-legend">${parts.map(([key,c,l])=>`<li><i class="pg-mark is-${c}"></i><span>${esc(l)}</span><b>${k[key]}</b></li>`).join('')}</ul>`;
  charts=`<div class="pg-grid pg-charts">${pgCard(1,'pg-chart',pgHead('chat',tr('pgActivity')),activity)}${pgCard(2,'pg-chart',pgHead('user',tr('pgAttendanceTrend')),attendance)}${pgCard(3,'pg-chart',pgHead('check',tr('pgTaskCompletion')),tasks)}</div>`;
 }
 const rated=fb.items.filter(l=>l.answers);
 const feedback=pgCard(4,'pg-feedback',pgHead('star',tr('lectureFeedback'),rated.length||''),fb.items.length?`<ul class="pg-fb">${fb.items.map(l=>`<li class="${l.answers?'':'is-empty'}"><span class="pg-ev-main"><strong>${esc(pick(l.title))}</strong><small>${date(l.date)} · ${l.answers} ${esc(pgPlural('answers',l.answers).toLowerCase())}</small></span>${l.answers?`<span class="pg-fb-score">${pgBar([[l.average*10,l.average>=8?'ok':l.average>=6?'watch':'risk']],100,`${tr('average')} ${l.average}/10`,'is-thin')}<b>${l.average}</b></span><span class="pg-nps" role="img" aria-label="NPS ${l.nps}" title="NPS ${l.nps}"><span class="pg-nps-track"><i class="${l.nps>=0?'is-ok':'is-risk'}" style="--w:${Math.abs(l.nps)/2}%;${l.nps>=0?'left:50%':'right:50%'}"></i></span><small>NPS ${l.nps>0?'+':''}${l.nps}</small></span>`:'<span class="pg-note">—</span>'}${l.comments.length?`<details class="pg-comments"><summary>${pgIcon('chat')}${l.comments.length}</summary><ul>${l.comments.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>`:''}</li>`).join('')}</ul><p class="pg-note">${tr('npsNote')}</p>`:empty());
 return adminShell('insights',pgWrap('insights','pg-insights',`${digestCard}${charts}${feedback}`));
}

// Settings ------------------------------------------------------------------------------
async function systemView(){
 const s=await api('GET','/api/admin/settings'),inv=cache.newInvite;cache.newInvite=null;
 const limit=(n,label)=>`<li><b>${esc(n)}<small> MB</small></b><span>${esc(label)}</span></li>`;
 // Pilot requests from the demo's landing page: the platform owner only.
 const leads=me.role==='platform_owner'?await api('GET','/api/admin/pilot-requests').catch(()=>null):null;
 const leadsCard=leads&&(leads.demo||leads.items.length)?pgCard(4,'pg-leads',pgHead('mail',tr('leadsTitle'),leads.items.length||''),leads.items.length?`<ul class="pg-rows">${leads.items.map(l=>`<li><span class="pg-ev-main"><strong>${esc(l.name)}${l.organisation?` · ${esc(l.organisation)}`:''}${l.role&&l.role!=='hub'?` · ${esc(tr('leadRole_'+l.role))}`:''}</strong><small><a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${l.phone?` · <a href="tel:${esc(l.phone.replace(/[^+\d]/g,''))}">${esc(l.phone)}</a>`:''}${l.teams?` · ${esc(tr('leadsTeams'))}: ${esc(l.teams)}`:''} · ${esc(l.language.toUpperCase())} · ${date(l.created,true)}</small>${l.message?`<small class="pg-lead-msg">${esc(l.message)}</small>`:''}</span><button data-act="lead-delete" data-id="${esc(l.id)}" class="acc-secondary" data-confirm="${esc(tr('leadsConfirm'))}">${tr('remove')}</button></li>`).join('')}</ul>`:`<p class="pg-note">${tr('leadsNone')}</p>`):'';
 // Investors waiting for the platform owner (the public workspace only, server/investors.mjs).
 const invs=me.role==='platform_owner'?await api('GET','/api/admin/investors').catch(()=>null):null;
 const link=(href,label)=>`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow">${esc(label)}</a>`;
 const invCard=invs?.here?pgCard(5,'pg-leads pg-investors',pgHead('user',tr('invTitle'),invs.items.filter(x=>x.status==='pending').length||'',invs.items.some(x=>x.status==='pending')?'is-risk':''),`<p class="pg-note">${tr('invNote')}</p>${invs.items.length?`<ul class="pg-rows">${invs.items.map(x=>`<li><span class="pg-ev-main"><strong>${esc(x.name)} · ${esc(x.fund)}</strong><small>${pgDot(x.status==='approved'?'ok':x.status==='rejected'?'risk':'watch',tr('invSt_'+x.status))} · <a href="mailto:${esc(x.email)}">${esc(x.email)}</a> · ${link(x.website,x.website.replace(/^https:\/\//,''))}${x.linkedin?' · '+link(x.linkedin,'LinkedIn'):''}${x.country?' · '+esc(x.city)+', '+esc(x.country):''} · ${date(x.created,true)}</small><small>${tr('invDomain')}: <b>${esc(x.domain)}</b>${x.ticketMin!==null||x.ticketMax!==null?` · ${tr('invTicket')}: ${esc(x.ticketMin??'…')}–${esc(x.ticketMax??'…')} EUR`:''}</small>${x.bio?`<small class="pg-lead-msg">${esc(x.bio)}</small>`:''}</span><span class="acc-actions">${x.status!=='approved'?`<button data-act="inv-approve" data-id="${esc(x.id)}" class="acc-secondary">${tr('invApprove')}</button>`:''}${x.status!=='rejected'?`<button data-act="inv-reject" data-id="${esc(x.id)}" class="acc-secondary" data-confirm="${esc(tr('invRejectConfirm'))}">${tr('invReject')}</button>`:''}</span></li>`).join('')}</ul>`:`<p class="pg-calm">${pgIcon('check')}${esc(tr('invNone'))}</p>`}`):'';
 // Investors who asked about this workspace's projects: the organisers decide whether to reply.
 const interest=await api('GET','/api/admin/investor-interest').catch(()=>null);
 const intCard=interest?pgCard(6,'pg-leads pg-interest',pgHead('mail',tr('intTitle'),interest.items.length||''),`<p class="pg-note">${tr('intNote')}</p>${interest.items.length?`<ul class="pg-rows">${interest.items.map(x=>`<li><span class="pg-ev-main"><strong>${esc(x.name)} · ${esc(x.fund)} → ${esc(x.project.name)}</strong><small>${x.email?`<a href="mailto:${esc(x.email)}">${esc(x.email)}</a> · `:''}${x.website?link(x.website,x.website.replace(/^https:\/\//,''))+' · ':''}${x.linkedin?link(x.linkedin,'LinkedIn')+' · ':''}${tr('intVia_'+x.via)} · ${date(x.created,true)}</small>${x.message?`<small class="pg-lead-msg">${esc(x.message)}</small>`:''}</span></li>`).join('')}</ul>`:`<p class="pg-calm">${pgIcon('check')}${esc(tr('intNone'))}</p>`}`):'';
 return adminShell('system',pgWrap('system','pg-settings',`<div class="pg-grid pg-settings-grid">
  ${pgCard(0,'',pgHead('user',tr('adminsTitle')),`<p class="pg-note">${tr('adminsNote')}</p>${inviteBox(inv)}`,`<button data-act="admin-invite" class="acc-secondary">${pgIcon('plus')}${tr('adminInvite')}</button>`)}
  ${pgCard(1,'',pgHead('mail',tr('mail')),`<p>${pgDot(s.mail==='disabled'?'none':'ok',s.mail==='disabled'?tr('mailOff'):s.mail)}</p>`)}
  ${pgCard(2,'',pgHead('box',tr('limits')),`<ul class="pg-limits">${limit(s.limits.documentMB,'PDF/PPTX')}${limit(s.limits.imageMB,tr('upload'))}${limit(s.limits.projectMB,tr('project'))}${limit(s.limits.uploadsMB,tr('total'))}</ul>`)}
  ${me.role==='platform_owner'?pgCard(3,'',pgHead('key',tr('backup')),`<p class="pg-note">${tr('backupNote')}</p>`,`<a class="acc-secondary" href="/api/admin/backup.sqlite" download>${tr('backupDownload')}</a>`):''}${leadsCard}${invCard}${intCard}</div>
  ${pgFold('shield',tr('whoCanDo'),`<ul class="pg-perms">${[0,1,2,3,4].map(i=>`<li><span>${tr('perm'+i)}</span><b>${tr('permWho'+i)}</b></li>`).join('')}</ul>`,{cls:'is-advanced'})}`));
}
async function reportsView(){
 const r=await api('GET','/api/admin/message-reports'),open=r.items.filter(x=>!x.resolved).length;
 return adminShell('reports',pgWrap('reports','pg-reports',pgCard(0,'',pgHead('shield',tr('dmReports'),open||'',open?'is-risk':''),`<p class="pg-note">${tr('dmReportsNote')}</p>${r.items.length?`<ul class="pg-rows">${r.items.map(x=>`<li class="${x.resolved?'is-done':'is-open'}"><span class="pg-ev-main"><strong><a href="#/admin/person/${esc(x.from.id)}">${esc(x.from.name)}</a> → ${esc(x.to.name)}</strong><blockquote>${esc(x.body)}</blockquote><small>${date(x.sent,true)} · ${tr('dmReportedOn')} ${date(x.created,true)}</small></span>${x.resolved?pgDot('ok',tr('st_accepted')):`<button class="acc-secondary" data-act="dm-resolve" data-id="${esc(x.id)}">${tr('dmResolve')}</button>`}</li>`).join('')}</ul>`:`<p class="pg-calm">${pgIcon('check')}${esc(tr('none'))}</p>`}`)));
}
async function auditView(id){
 const a=await api('GET','/api/admin/audit'+(id?'?prefix='+encodeURIComponent(id):''));
 const kinds=['task','submission','attendance','role','user','xp','nudge','membership','lecture','claim'];
 const hue=k=>kinds.includes(k)?kinds.indexOf(k)%6:pgHue(k);
 const detail=d=>{const v=Object.entries(d).filter(([k])=>k!=='user').map(([k,x])=>`${k}: ${x}`).join(', ');return v?' · '+esc(v):'';};
 return adminShell('audit',pgWrap('audit:'+(id||''),'pg-audit',`<nav class="pg-chips" aria-label="${esc(tr('pgFilter'))}"><a href="#/admin/audit" ${id?'':'aria-current="page"'}>${tr('tf_all')}</a>${kinds.map(k=>`<a href="#/admin/audit/${k}" ${id===k?'aria-current="page"':''}><i class="pg-dot is-c${hue(k)}" aria-hidden="true"></i>${tr('ak_'+k)}</a>`).join('')}</nav>${a.items.length?'':`<p class="pg-calm">${esc(tr('none'))}</p>`}<ol class="pg-log">${a.items.map(x=>`<li><i class="pg-dot is-c${hue(String(x.action).split('.')[0])}" aria-hidden="true"></i><span class="pg-ev-main"><span><strong>${esc(x.actor||tr('system'))}</strong> · ${esc(x.action)}</span><small>${esc(x.targetName||x.targetType)}${detail(x.detail)}</small></span><small class="pg-when">${date(x.created,true)}</small></li>`).join('')}</ol>`));
}
// Tasks section (admin): board, review queue, task editor, import. Styles: admin-tasks.css, classes tk-*.
const TK_ICON={
 checklist:'<path d="M2.5 4.5l1.5 1.5 2.5-2.5M2.5 10.5l1.5 1.5 2.5-2.5M9 5h4.5M9 11h4.5"/>',
 counter:'<path d="M3.5 3v10M6.5 3v10M9.5 3v10M12.5 3v10M1.5 11l13-6"/>',
 text:'<path d="M2.5 3.5h11M2.5 6.5h11M2.5 9.5h11M2.5 12.5h6"/>',
 link:'<path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 9 3.5l-.8.8M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.8-.8"/>',
 attachment:'<path d="M11.5 7.5l-4.6 4.6a2.5 2.5 0 0 1-3.5-3.5l5.3-5.3a1.7 1.7 0 0 1 2.4 2.4L5.9 10.9a.8.8 0 0 1-1.2-1.2L9.4 5"/>',
 attendance:'<path d="M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3M6 10.2l1.5 1.3L10 9"/>',
 team_result:'<path d="M4 14V2.5M4 3h8.5l-2 2.8 2 2.7H4"/>',
 person:'<path d="M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14c.4-2.8 2.4-4.5 5-4.5s4.6 1.7 5 4.5"/>',
 team:'<path d="M6 7a2.2 2.2 0 1 0 0-4.4A2.2 2.2 0 0 0 6 7zM1.8 13.5c.3-2.5 2-4 4.2-4s3.9 1.5 4.2 4M10.5 2.8a2 2 0 0 1 0 4M12 9.7c1.3.5 2.1 1.8 2.3 3.8"/>',
 review:'<path d="M4 2.5h8M4 13.5h8M5 2.5c0 3 6 3.5 6 5.5s-6 2.5-6 5.5M11 2.5c0 3-6 3.5-6 5.5s6 2.5 6 5.5"/>',
 check:'<path d="M2.5 8.5l3.5 3.5 7.5-8"/>',
 back:'<path d="M6 3.5L2.5 7 6 10.5M3 7h6.5a3.5 3.5 0 0 1 0 7H7"/>',
 cross:'<path d="M4 4l8 8M12 4l-8 8"/>',
 mail:'<path d="M1.5 3.5h13v9h-13zM1.5 4l6.5 5 6.5-5"/>',
 plus:'<path d="M8 2.5v11M2.5 8h11"/>',
 clock:'<path d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 4.5V8l2.5 1.5"/>',
 file:'<path d="M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3M5.5 8h5M5.5 11h5"/>',
 down:'<path d="M8 2v9M4 7.5l4 4 4-4M2.5 14h11"/>',
 send:'<path d="M14 2L1.5 7l5 2 2 5zM6.5 9L14 2"/>',
 bell:'<path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.5 1.5h-11zM6.5 13.5a1.5 1.5 0 0 0 3 0"/>',
 share:'<path d="M11.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4.5 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11.5 14.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6.3 9l3.4 2.2M9.7 4.8L6.3 7"/>',
 csv:'<path d="M2.5 2.5h11v11h-11zM2.5 6h11M2.5 9.5h11M6 2.5v11"/>',
 hook:'<path d="M5 2v5a3 3 0 0 0 6 0V5.5M11 5.5L9 7.5M11 5.5l2 2M5 2H3M5 14v-3"/>',
};
const tkI=(k,cls='')=>`<svg class="tk-i ${cls}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${TK_ICON[k]||''}</svg>`;
const tkSr=s=>`<span class="tk-sr">${esc(s)}</span>`;
const tkN=(n,suffix='')=>`<b class="tk-num" data-tk-n="${Number(n)||0}" data-tk-suffix="${esc(suffix)}">${Number(n)||0}${esc(suffix)}</b>`;
const tkPast=t=>!!t.dueAt&&Date.parse(t.dueAt)<Date.now();
// Exclusive parts of one task: accepted, waiting for review, sent back, not handed in, late.
function tkParts(t){
 const total=t.assigned||0,ok=t.accepted||0,wait=t.waiting||0,late=tkPast(t)?(t.overdue||0):0,back=late?0:(t.changes||0);
 return {total,ok,wait,back,late,open:Math.max(0,total-ok-wait-back-late)};
}
const TK_PARTS=[['ok','tkAccepted'],['wait','tkWaiting'],['back','tkBack'],['open','tkOpen'],['late','tkLate']];
function tkBar(p,{big=false,catalog=false}={}){
 const none=tr(catalog?'tkNoneTook':'tkNotSent');
 if(!p.total)return `<div class="tk-prog ${big?'is-big':''}"><div class="tk-bar is-empty" role="img" aria-label="${esc(none)}"></div><span class="tk-frac is-none">${none}</span></div>`;
 const label=TK_PARTS.filter(([k])=>p[k]).map(([k,l])=>`${p[k]} ${tr(l)}`).join(', ')+` · ${p.total} ${tr('assigned')}`;
 return `<div class="tk-prog ${big?'is-big':''}"><div class="tk-bar" role="img" aria-label="${esc(label)}">${TK_PARTS.map(([k])=>p[k]?`<i class="tk-p-${k}" style="--w:${(p[k]/p.total*100).toFixed(2)}%"></i>`:'').join('')}</div><span class="tk-frac"><b>${p.ok}</b>/${p.total}</span></div>`;
}
const tkLegend=(p)=>`<ul class="tk-legend">${TK_PARTS.filter(([k])=>!p||p[k]).map(([k,l])=>`<li><i class="tk-p-${k}"></i>${tr(l)}${p?` <b>${p[k]}</b>`:''}</li>`).join('')}</ul>`;
function tkDue(t){
 if(!t.dueAt)return `<span class="tk-due is-none">${tkSr(tr('dashNoDue'))}<span aria-hidden="true">—</span></span>`;
 const h=(Date.parse(t.dueAt)-Date.now())/3600000,live=t.status==='published';
 const late=h<0,word=late?tr('tkLateBy').replace('{n}',Math.max(1,Math.ceil(-h/24))):h<24?tr('tkToday'):h<24*14?tr('tkInDays').replace('{n}',Math.ceil(h/24)):shortDate(t.dueAt);
 const cls=!live?'is-quiet':late?'is-late':h<72?'is-soon':h<24*7?'is-near':'';
 const x=late?0:Math.min(1,h/24/14);
 return `<span class="tk-due ${cls}" title="${esc(tr('due')+' '+date(t.dueAt,true))}"><span class="tk-track" aria-hidden="true"><i style="--x:${x.toFixed(3)}"></i></span><span>${esc(word)}</span></span>`;
}
const tkPts=xp=>`<span class="tk-pts" title="${esc(xp+' '+pgPlural('xp',xp))}"><b>${xp}</b><small>${tr('tkPts')}</small></span>`;
const TK_FILTERS={all:()=>true,live:t=>t.status==='published',review:t=>t.waiting>0,soon:t=>t.status==='published'&&!!t.dueAt&&!tkPast(t)&&Date.parse(t.dueAt)-Date.now()<7*86400000,late:t=>t.status==='published'&&tkPast(t)&&t.overdue>0,draft:t=>t.status==='draft',closed:t=>['closed','archived'].includes(t.status)};
const tkUrgency=(a,b)=>(tkParts(b).late-tkParts(a).late)||((b.waiting||0)-(a.waiting||0))||((a.dueAt?Date.parse(a.dueAt):Infinity)-(b.dueAt?Date.parse(b.dueAt):Infinity));
function tkRow(t,i){
 const p=tkParts(t),scope=t.scope==='team'?'team':'person';
 return `<li class="tk-row is-${esc(t.status)}" style="--d:${Math.min(i,16)}">
 <span class="tk-type" title="${esc(tr('type_'+t.type))}">${tkI(t.type)}</span>
 <div class="tk-main"><a class="tk-title" href="#/admin/task/${esc(t.id)}">${authored(t.translations,'title')}</a>
 <small class="tk-meta"><span class="tk-st is-${esc(t.status)}">${esc(tr('st_'+t.status))}</span><span title="${esc(tr(t.scope==='team'?'oneForTeam':'eachPerson'))}">${tkI(scope)}${esc(tr('type_'+t.type))}</span>${t.requiresReview?`<span title="${esc(tr('requiresReview'))}">${tkI('review')}${tkSr(tr('requiresReview'))}</span>`:''}${t.pickMode==='catalog'?`<span>${esc(tr('pm_catalog'))}</span>`:''}</small></div>
 ${tkBar(p,{catalog:t.pickMode==='catalog'})}
 ${tkDue(t)}
 ${t.assigned&&t.pickMode!=='catalog'&&t.responses?`<span class="mx-sum tk-answers" title="${esc(`${t.responses.accepted} ${tr('rsAccepted')}, ${t.responses.declined} ${tr('rsDeclined')}, ${t.responses.unanswered} ${tr('rsUnanswered')}`)}"><b>✓${t.responses.accepted}</b> <b>✗${t.responses.declined}</b> <b>?${t.responses.unanswered}</b></span>`:'<span class="tk-answers" aria-hidden="true"></span>'}
 ${t.waiting?`<a class="tk-wait" href="#/admin/reviews" title="${esc(t.waiting+' '+pgPlural('waiting',t.waiting))}">${tkI('review')}<b>${t.waiting}</b>${tkSr(tr('waiting'))}</a>`:'<span class="tk-wait is-none" aria-hidden="true"></span>'}
 ${tkPts(t.xp)}
 </li>`;
}
// Squares for small counts: one per task / submission, capped.
const tkDots=(n,cls,cap=24)=>`<span class="tk-dots" aria-hidden="true">${Array.from({length:Math.min(n,cap)},(_,i)=>`<i class="${cls}" style="--d:${i}"></i>`).join('')}${n>cap?'<em>+</em>':''}</span>`;
async function tkBoard(){
 const list=await api('GET','/api/admin/tasks'),items=list.items;
 const view=TK_FILTERS[cache.tkFilter]?cache.tkFilter:'all',first=cache.intro&&!cache.tkQuiet;cache.tkQuiet=false;
 const live=items.filter(TK_FILTERS.live);
 const agg=live.reduce((s,t)=>{const p=tkParts(t);for(const k in s)s[k]+=p[k];return s;},{total:0,ok:0,wait:0,back:0,open:0,late:0});
 const waiting=items.reduce((n,t)=>n+(t.waiting||0),0),pct=agg.total?Math.round(agg.ok/agg.total*100):0;
 const tile=(cls,inner,act)=>act.startsWith('#')?`<a class="tk-kpi ${cls}" href="${act}">${inner}</a>`:`<button type="button" class="tk-kpi ${cls}" data-act="tk-filter" data-view="${act}" aria-pressed="${view===act}">${inner}</button>`;
 // Live task squares take the colour of their worst signal.
 const liveDots=`<span class="tk-dots" aria-hidden="true">${live.slice(0,30).map((t,i)=>{const p=tkParts(t);return `<i class="${p.late?'is-late':t.waiting?'is-wait':p.total&&p.ok===p.total?'is-ok':'is-live'}" style="--d:${i}"></i>`;}).join('')}</span>`;
 const strip=`<div class="tk-kpis">
 ${tile('is-live',`<span class="tk-kpi-l">${tr('tkLive')}</span>${tkN(live.length)}${liveDots}`,'live')}
 ${tile(waiting?'is-wait':'is-calm',`<span class="tk-kpi-l">${tr('tkToReview')}</span>${tkN(waiting)}${tkDots(waiting,'is-wait')}`,'#/admin/reviews')}
 ${tile(agg.late?'is-late':'is-calm',`<span class="tk-kpi-l">${tr('tkLateWork')}</span>${tkN(agg.late)}${tkDots(agg.late,'is-late')}`,'late')}
 <div class="tk-kpi is-done"><span class="tk-kpi-l">${tr('tkCompletion')}</span>${tkN(pct,'%')}${tkBar(agg)}</div>
 </div>`;
 const filters=`<div class="tk-filters" role="group" aria-label="${esc(tr('tkFilter'))}">${Object.keys(TK_FILTERS).map(k=>{const n=items.filter(TK_FILTERS[k]).length;return `<button type="button" data-act="tk-filter" data-view="${k}" aria-pressed="${k===view}" ${n||k==='all'||k===view?'':'class="is-zero"'}>${tr('tkf_'+k)}<span>${n}</span></button>`;}).join('')}</div>`;
 const tools=`<div class="tk-tools"><div class="tk-filters" role="group">${tkViews('list')}</div>${filters}<div class="tk-new"><a class="tk-btn is-primary" href="#/admin/task/new">${tkI('plus')}${tr('newTask')}</a><a class="tk-btn" href="#/admin/task/new-letter" title="${esc(tr('letterTask'))}">${tkI('mail')}<span>${tr('tkFromEmail')}</span></a></div></div>`;
 const shown=items.filter(TK_FILTERS[view]);
 let n=0;const rows=arr=>`<ol class="tk-rows">${arr.map(t=>tkRow(t,n++)).join('')}</ol>`;
 const groups=view==='all'?['published','draft','closed','archived'].map(s=>{const g=items.filter(t=>t.status===s).sort(s==='published'?tkUrgency:()=>0);if(!g.length)return '';
  const head=`<span class="tk-st is-${s}"></span>${tr(s==='published'?'tkLive':'st_'+s)}<small>${g.length}</small>`;
  return s==='archived'?`<details class="tk-group-box"><summary class="tk-group">${head}</summary>${rows(g)}</details>`:`<section class="tk-group-box"><h3 class="tk-group">${head}</h3>${rows(g)}</section>`;}).join(''):shown.length?rows(shown.sort(tkUrgency)):`<p class="tk-empty">${tr('none')}</p>`;
 return adminShell('tasks',`<div class="tk ${first?'tk-first':''}">${strip}${tools}${tkLegend()}${groups}</div>`);
}
const tkAge=iso=>{const h=(Date.now()-Date.parse(iso))/3600000;return h<1?tr('tkNow'):h<24?tr('tkAgeH').replace('{n}',Math.floor(h)):tr('tkAgeD').replace('{n}',Math.floor(h/24));};
const tkAgeCls=iso=>{const h=(Date.now()-Date.parse(iso))/3600000;return h>72?'is-late':h>24?'is-wait':'is-fresh';};
const tkInitials=s=>String(s||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
function tkAnswer(a,r){
 const t=a.task,out=[];
 if(r.text||r.note)out.push(`<div class="tk-rv-text">${esc(r.text||r.note)}</div>`);
 if(r.count!==undefined){const target=t.counterTarget||1,w=Math.min(100,r.count/target*100);out.push(`<div class="tk-rv-meter"><span class="tk-bar"><i class="tk-p-${r.count>=target?'ok':'wait'}" style="--w:${w}%"></i></span><b>${r.count}</b>/${target}</div>`);}
 if(Array.isArray(r.checked)&&t.checklist?.length){const done=r.checked.filter(Boolean).length;out.push(`<ul class="tk-rv-checks">${t.checklist.map((c,i)=>`<li class="${r.checked[i]?'is-on':''}">${tkI(r.checked[i]?'check':'cross')}${esc(pick(c))}</li>`).join('')}</ul><p class="tk-rv-sum"><b>${done}</b>/${t.checklist.length}</p>`);}
 if(Array.isArray(r.lectureIds))out.push(`<p class="tk-rv-sum">${tkI('attendance')} <b>${r.lectureIds.length}</b> ${esc(pgPlural('lecturesShort',r.lectureIds.length))}</p>`);
 if(r.fileId)out.push(`<a class="tk-btn" href="/api/files/${esc(r.fileId)}" download>${tkI('down')}${tr('download')}</a>`);
 if(r.url){let host=r.url;try{host=new URL(r.url).hostname.replace(/^www\./,'');}catch{}out.push(`<a class="tk-btn tk-url" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer nofollow" title="${esc(r.url)}">${tkI('link')}${esc(host)} ↗</a>`);}
 return out.join('')||`<p class="tk-empty">${tr('tkNoContent')}</p>`;
}
async function tkReviews(id){
 const first=cache.intro&&!cache.tkQuiet;cache.tkQuiet=false;
 if(id==='accepted'){
  const [done,q]=await Promise.all([api('GET','/api/reviews?status=accepted&limit=50'),api('GET','/api/reviews')]);
  // Accepted work grouped by task: one card per task, one chip per person or team, revoke behind ⋯.
  const groups=new Map();for(const a of done.items){const k=a.task.id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a);}
  const chip=a=>`<li class="tk-dchip"><span class="tk-dchip-who" title="${esc((a.authorName?a.authorName+' · ':'')+date(a.updated,true))}">${tkI(a.projectName?'team':'person')}${esc(a.projectName||a.userName||a.authorName||'')}</span><details class="tk-more"><summary title="${esc(tr('revokeWork'))}"><span aria-hidden="true">⋯</span>${tkSr(tr('revokeWork')+': '+(a.projectName||a.userName||''))}</summary><form data-form="revoke" data-id="${esc(a.submissionId)}" class="tk-pop"><p class="tk-note">${esc(a.authorName||'')} · ${date(a.updated,true)}</p>${field('comment',tr('reasonField'),{type:'textarea',required:true,attrs:'rows="2" maxlength="1000"'})}<button class="tk-btn is-back">${tkI('back')}${tr('revokeWork')}</button></form></details></li>`;
  const cards=[...groups.values()].map((g,i)=>`<section class="tk-dgroup" style="--d:${Math.min(i,16)}"><header><span class="tk-done-ok">${tkI('check')}</span><span class="tk-type">${tkI(g[0].task.type)}</span><strong>${authored(g[0].task.translations,'title')}</strong><b class="tk-dcount">${g.length}</b></header><ul class="tk-dchips">${g.map(chip).join('')}</ul></section>`).join('');
  return adminShell('reviews',`<div class="tk ${first?'tk-first':''}">${tkReviewTabs('accepted',q.items.length,done.items.length)}${done.items.length?`<div class="tk-dgroups">${cards}</div>`:`<p class="tk-empty">${tr('none')}</p>`}</div>`);
 }
 const q=await api('GET','/api/reviews');
 const details=await Promise.all(q.items.map(i=>api('GET','/api/tasks/'+i.id).then(r=>r.assignment)));
 const oldest=q.items[0]?.updated;
 const strip=q.items.length?`<div class="tk-kpis is-reviews"><div class="tk-kpi ${q.items.length?'is-wait':'is-calm'}"><span class="tk-kpi-l">${tr('tkToReview')}</span>${tkN(q.items.length)}<span class="tk-dots" aria-hidden="true">${q.items.map((x,i)=>`<i class="${tkAgeCls(x.updated)==='is-late'?'is-late':tkAgeCls(x.updated)==='is-wait'?'is-wait':'is-fresh'}" style="--d:${i}"></i>`).join('')}</span></div><div class="tk-kpi ${tkAgeCls(oldest)==='is-late'?'is-late':'is-calm'}"><span class="tk-kpi-l">${tr('tkOldest')}</span><b class="tk-num">${esc(tkAge(oldest))}</b><small class="tk-kpi-note">${tr('tkAgeNote')}</small></div></div>`:'';
 const cards=details.map((a,i)=>{const item=q.items[i],r=a.revisions[0]?.content||{},who=a.projectName||item.userName||'',last=(a.reviews||[]).find(x=>x.decision!=='accepted'&&x.comment);
  return `<article class="tk-rv" style="--d:${Math.min(i,16)}">
  <header class="tk-rv-head"><span class="tk-type">${tkI(a.task.type)}</span><div class="tk-main"><h3>${authored(a.task.translations,'title')}</h3><small class="tk-meta"><span class="tk-who"><i aria-hidden="true">${esc(tkInitials(who))}</i>${esc(who)}</span>${item.authorName&&item.authorName!==who?`<span>${esc(item.authorName)}</span>`:''}${a.revision>1?`<span class="tk-round" title="${esc(tr('tkRound').replace('{n}',a.revision))}">${'<i></i>'.repeat(Math.min(a.revision,6))}${tkSr(tr('tkRound').replace('{n}',a.revision))}<em aria-hidden="true">${esc(tr('tkRound').replace('{n}',a.revision))}</em></span>`:''}</small></div><span class="tk-age ${tkAgeCls(a.updated)}" title="${esc(date(a.updated,true))}">${tkI('clock')}${esc(tkAge(a.updated))}</span>${tkPts(a.task.xp)}</header>
  <div class="tk-rv-body"><div class="tk-rv-answer">${authored(a.task.translations,'criteria')?`<p class="tk-rv-crit">${tkI('check')}<span><b>${tr('tkDoneWhen')}</b> ${authored(a.task.translations,'criteria')}</span></p>`:''}${last?`<p class="tk-rv-last">${tkI('back')}<span><b>${tr('tkLastNote')}</b> ${esc(last.comment)}</span></p>`:''}${tkAnswer(a,r)}</div>
  <form data-form="review" data-id="${esc(item.submissionId)}" data-revision="${a.revision}" class="tk-rv-form"><label class="tk-sr" for="rv-c-${i}">${tr('comment')}</label><textarea id="rv-c-${i}" name="comment" rows="2" maxlength="3000" placeholder="${esc(tr('tkCommentPh'))}"></textarea><div class="tk-decide"><button name="decision" value="accepted" class="tk-btn is-ok">${tkI('check')}${tr('accept')}</button><button name="decision" value="changes_requested" class="tk-btn is-back">${tkI('back')}${tr('requestChanges')}</button><button name="decision" value="rejected" class="tk-btn is-quiet">${tkI('cross')}${tr('reject')}</button></div></form></div>
  </article>`;}).join('');
 return adminShell('reviews',`<div class="tk ${first?'tk-first':''}">${tkReviewTabs('',q.items.length)}${strip}${q.items.length?`<div class="tk-rvs">${cards}</div>`:`<div class="tk-calm">${tkI('check')}<p>${tr('tkQueueEmpty')}</p></div>`}</div>`);
}
const tkReviewTabs=(on,waiting,done)=>`<div class="tk-filters" role="group">${[['','tf_waiting',waiting],['accepted','acceptedWork',done]].map(([k,l,n])=>`<a href="#/admin/reviews/${k}" ${on===k?'aria-current="page"':''}>${tr(l)}${n!==undefined?`<span>${n}</span>`:''}</a>`).join('')}</div>`;
// Status path of a task: draft → published → closed → archived, with the one allowed next step as a button.
function tkStatus(t){
 const steps=['draft','published','closed','archived'],at=steps.indexOf(t.status);
 const next={draft:['published','publish','is-primary'],published:['closed','close',''],closed:['archived','archive',''],archived:['draft','makeDraft','']}[t.status];
 const reopen=t.status==='closed'?`<button type="button" class="tk-btn" data-act="task-status" data-id="${esc(t.id)}" data-status="published">${tr('tkReopen')}</button>`:'';
 return `<ol class="tk-steps" aria-label="${esc(tr('tkStatus'))}">${steps.map((s,i)=>`<li class="${i<at?'is-done':i===at?'is-now':''}" ${i===at?'aria-current="step"':''}><span>${esc(tr(s==='published'?'tkLive':'st_'+s))}</span></li>`).join('')}</ol><div class="tk-actions"><button type="button" class="tk-btn ${next[2]}" data-act="task-status" data-id="${esc(t.id)}" data-status="${next[0]}">${esc(next[1]==='archive'?tr('archive').split(' ')[0]:tr(next[1]))}</button>${reopen}</div>`;
}
// One screen for a new task: title and instructions in one language, what proof counts, deadline, points, review and
// the teams (every team of the programme, accounts or not), then Publish. Checklist and who submits sit under More options.
const PROOFS=['file','link','text'];
const proofFrom=t=>t?.proof?.length?t.proof:t?.type==='link'?['link']:['text','team_result','counter'].includes(t?.type)?['text']:t?.type==='attachment'?['file','link']:t?.type==='checklist'?[]:['file'];
const tkComposable=t=>!t||['text','link','attachment','checklist'].includes(t.type);
async function tkCompose(t){
 const [mx,lib]=await Promise.all([api('GET','/api/admin/tasks/matrix'),t?{items:[]}:api('GET','/api/admin/tasks?library=1').catch(()=>({items:[]}))]);
 cache.library=lib.items;
 const tl=t?.translations||{},l=t?(tl[lang]?.title?lang:['hr','en','ru'].find(x=>tl[x]?.title)||lang):lang;
 const proof=proofFrom(t),pick_=new Set(cache.pick?.team||[]);
 const teams=mx.teams,now=localInput(new Date(Date.now()+3600000).toISOString());
 const template=!t&&lib.items.length?`<div class="tkc-template"><label class="acc-field"><span>${tkI('file')}${tr('tkcFromTemplate')}</span><select data-act="tk-template" aria-describedby="tkc-tpl-note"><option value="">${esc(tr('tkcTemplateNone'))}</option>${lib.items.map(x=>`<option value="${esc(x.id)}">${esc(taskText(x.translations))}</option>`).join('')}</select></label><small class="tk-note" id="tkc-tpl-note">${tr('tkcTemplateNote')}</small></div>`:'';
 const langNote=l!==lang?`<p class="tk-note">${esc(tr('tkcOtherLang').replace('{l}',l.toUpperCase()))}</p>`:'';
 const teamBox=t?'':`<fieldset class="tkc-who"><legend>${tr('tkcWho')}</legend><div class="tk-seg-row">${tkSeg('audience','',[['all_participants',tr('tkcAllTeams'),'team'],['selected',tr('tkcChoose'),'check']],pick_.size?'selected':'all_participants')}</div>
  <div class="tkc-teams">${teams.length?`<div class="tk-chips">${teams.map(x=>`<label class="tk-chip"><input type="checkbox" name="projectId" value="${esc(x.id)}" ${pick_.has(x.id)?'checked':''}><span>${esc(x.name)}${x.members?'':` <small class="tkc-wait">· ${esc(tr('tkcNoAccounts'))}</small>`}</span></label>`).join('')}</div>`:`<p class="tk-note">${tr('tkcNoTeams')} <a href="#/admin/overview">${tr('teamsNav')} →</a></p>`}</div></fieldset>`;
 return `<form data-form="task-compose" data-id="${esc(t?.id||'')}" data-version="${t?.version||''}" data-lang="${l}" data-tl="${esc(JSON.stringify(tl))}" data-scope="${esc(t?.scope||'')}" class="tk-form tkc" novalidate>
 ${template}
 <section class="tk-sec">${langNote}${field('title',tr('title'),{value:tl[l]?.title,required:true,attrs:'maxlength="160"'})}${field('instructions',tr('instructions'),{type:'textarea',value:tl[l]?.instructions,required:true,attrs:'rows="5" maxlength="4000"'})}
 <fieldset class="tkc-proof"><legend>${tr('tkcProof')}</legend><div class="tk-chips">${PROOFS.map(k=>`<label class="tk-chip"><input type="checkbox" name="proof" value="${k}" ${proof.includes(k)?'checked':''}><span>${tkI(k==='file'?'attachment':k)}${esc(tr('proof_'+k))}</span></label>`).join('')}</div><small class="tk-note">${tr('tkcProofNote')}</small></fieldset>
 <div class="tk-row3">${field('dueAt',tr('due'),{type:'datetime-local',value:localInput(t?.dueAt),attrs:`min="${now}"`})}${field('xp',tr('points'),{type:'number',value:t?.xp??10,attrs:'min="0" max="1000" inputmode="numeric"'})}<label class="tk-switch"><input type="checkbox" name="requiresReview" ${!t||t.requiresReview?'checked':''}><span>${tkI('review')}${tr('tkcReview')}</span></label></div>
 ${teamBox}</section>
 <details class="tk-sec tk-adv"><summary class="tk-sec-h">${tr('tkcMore')}</summary>
  ${field('checklist',tr('checklistItems'),{type:'textarea',value:(t?.checklist||[]).map(c=>pick(c)).join('\n'),hint:tr('tkcChecklistNote'),attrs:'rows="3"'})}
  <div class="tk-row2">${tkSeg('scope',tr('whoSubmits'),[['team',tr('oneForTeam'),'team'],['personal',tr('eachPerson'),'person']],t?.scope||'team')}</div>
  <div class="tk-row3">${select('completionMode',tr('completionMode'),['participant','admin_only'].map(v=>[v,tr('cm_'+v)]),t?.completionMode||'participant')}${select('pickMode',tr('pickMode'),['assigned','catalog'].map(v=>[v,tr('pm_'+v)]),t?.pickMode||'assigned')}${select('repeatRule',tr('repeat'),['once','weekly_reward','per_week'].map(v=>[v,tr('rep_'+v)]),t?.repeatRule||'once')}</div>
  ${t?'':`<button class="tk-btn" name="mode" value="draft">${tr('tkcSaveDraft')}</button>`}
 </details>
 <div class="tk-save">${t?`<button class="tk-btn is-primary" name="mode" value="save">${tkI('check')}${tr('tkcSaveChanges')}</button>`:`<button class="tk-btn is-primary is-big" name="mode" value="publish">${tkI('send')}${tr('tkcPublish')}</button>`}</div></form>`;
}
// A template fills the form; nothing is saved until Publish.
function tkTemplate(sel){
 const x=(cache.library||[]).find(t=>t.id===sel.value),form=sel.closest('form');if(!x||!form)return;
 const set=(n,v)=>{const el=form.elements[n];if(el)el.value=v??'';};
 set('title',taskText(x.translations));set('instructions',taskText(x.translations,'instructions'));set('xp',x.xp);
 const proof=proofFrom(x);form.querySelectorAll('[name=proof]').forEach(c=>c.checked=proof.includes(c.value));
 form.elements.requiresReview.checked=!!x.requiresReview;
 set('checklist',(x.checklist||[]).map(c=>pick(c)).join('\n'));
 form.querySelectorAll('[name=scope]').forEach(r=>r.checked=r.value===x.scope);
 if(x.checklist?.length)form.querySelector('.tk-adv').open=true;
 form.elements.title.focus();
}
const MX=['unanswered','accepted','working','submitted','changes','done','declined','overdue'];
const mxTitle=t=>taskText(t.title)||'—';
// Homework overview: teams down, tasks across, one status per cell; on a phone only the table scrolls sideways.
async function tkMatrix(){
 const m=await api('GET','/api/admin/tasks/matrix');
 const head=`<div class="tk-tools"><div class="tk-filters" role="group">${tkViews('matrix')}</div><div class="tk-new"><a class="tk-btn is-primary" href="#/admin/task/new">${tkI('plus')}${tr('newTask')}</a></div></div>`;
 if(!m.tasks.length||!m.teams.length)return adminShell('tasks',`<div class="tk">${head}<div class="tk-calm">${tkI('plus')}<p>${tr(m.teams.length?'mxEmpty':'tkcNoTeams')}</p></div></div>`);
 const count=t=>MX.reduce((o,k)=>(o[k]=m.teams.filter(x=>m.cells[x.id+'|'+t.id]?.status===k).length,o),{});
 const th=m.tasks.map(t=>{const c=count(t);return `<th scope="col"><a href="#/admin/task/${esc(t.id)}" title="${esc(mxTitle(t))}"><span class="mx-t">${esc(mxTitle(t))}</span></a><small>${t.dueAt?esc(shortDate(t.dueAt)):'—'} · ${t.xp} ${esc(tr('tkPts'))}</small><small class="mx-sum" title="${esc(`${c.accepted+c.working+c.submitted+c.done+c.changes} ${tr('rsAccepted')}, ${c.declined} ${tr('rsDeclined')}, ${c.unanswered} ${tr('rsUnanswered')}`)}"><b>✓${c.accepted+c.working+c.submitted+c.done+c.changes}</b> <b>✗${c.declined}</b> <b>?${c.unanswered}</b></small></th>`;}).join('');
 const cell=(team,t)=>{const c=m.cells[team.id+'|'+t.id];if(!c)return `<td class="mx-c is-none"><span class="tk-sr">${esc(tr('mx_none'))}</span><span aria-hidden="true">·</span></td>`;
  const label=tr('mx_'+c.status)+(c.people>1?' · '+tr('mxPeople').replace('{d}',c.done).replace('{n}',c.people):'')+(c.reason?' · '+c.reason:'');
  return `<td class="mx-c is-${c.status}"><a href="#/admin/answer/${esc(c.assignmentId)}" title="${esc(team.name+' · '+mxTitle(t)+': '+label)}"><i aria-hidden="true"></i><span>${esc(tr('mx_'+c.status))}</span></a></td>`;};
 const table=`<div class="mx-wrap" tabindex="0" role="region" aria-label="${esc(tr('tkMatrix'))}"><table class="mx"><thead><tr><th scope="col" class="mx-corner">${tr('team')}</th>${th}</tr></thead><tbody>${m.teams.map(x=>`<tr><th scope="row"><a href="#/admin/team/${esc(x.id)}">${esc(x.name)}</a>${x.members?'':`<small>${esc(tr('noAccountsYet'))}</small>`}</th>${m.tasks.map(t=>cell(x,t)).join('')}</tr>`).join('')}</tbody></table></div>`;
 const legend=`<ul class="mx-legend">${MX.map(k=>`<li class="is-${k}"><i aria-hidden="true"></i>${esc(tr('mx_'+k))}</li>`).join('')}</ul>`;
 return adminShell('tasks',`<div class="tk tk-mx">${head}<p class="tk-note">${tr('mxHint')}</p>${table}${legend}</div>`);
}
const tkViews=on=>[['matrix','tkMatrix','#/admin/tasks'],['list','tkList','#/admin/tasks/list']].map(([k,l,h])=>`<a href="${h}" ${on===k?'aria-current="page"':''}>${tr(l)}</a>`).join('');
// One team's answer to one task, opened from the matrix: what they handed in, their decline reason, review or reopen.
async function tkAnswerView(id){
 const {assignment:a}=await api('GET','/api/tasks/'+encodeURIComponent(id));
 const r=a.revisions?.[0]?.content,declined=a.response?.decision==='declined',who=a.projectName||'';
 const state=declined?'declined':a.status==='accepted'?'done':a.status==='submitted'?'submitted':a.status==='changes_requested'||a.status==='rejected'?'changes':a.status==='draft'?'working':a.response?'accepted':'unanswered';
 const review=a.status==='submitted'&&a.submissionId?`<form data-form="review" data-id="${esc(a.submissionId)}" data-revision="${a.revision}" class="tk-rv-form"><label class="tk-sr" for="ans-c">${tr('comment')}</label><textarea id="ans-c" name="comment" rows="2" maxlength="3000" placeholder="${esc(tr('tkCommentPh'))}"></textarea><div class="tk-decide"><button name="decision" value="accepted" class="tk-btn is-ok">${tkI('check')}${tr('accept')}</button><button name="decision" value="changes_requested" class="tk-btn is-back">${tkI('back')}${tr('requestChanges')}</button></div></form>`:'';
 const body=declined?`<p class="tk-rv-last">${tkI('cross')}<span><b>${tr('ansReason')}</b> ${a.response.reason?esc(a.response.reason):esc(tr('ansNoReason'))}</span></p><button type="button" class="tk-btn is-primary" data-act="reopen" data-id="${esc(a.id)}">${tkI('back')}${tr('reopenTask')}</button>`
  :r?tkAnswer(a,r):`<p class="tk-empty">${tr('ansNothing')}</p>`;
 const reviews=(a.reviews||[]).length?`<ol class="m-timeline">${a.reviews.map(x=>`<li class="is-${esc(x.decision)}"><div>${statusChip(x.decision)} <small>${esc(x.reviewer)} · ${date(x.created,true)}</small>${x.comment?`<p>${esc(x.comment)}</p>`:''}</div></li>`).join('')}</ol>`:'';
 return adminShell('tasks',`<div class="tk tk-ans"><a class="tk-backlink" href="#/admin/tasks">← ${tr('tkMatrix')}</a><article class="tk-rv"><header class="tk-rv-head"><span class="tk-type">${tkI(a.task.type)}</span><div class="tk-main"><h3>${authored(a.task.translations,'title')}</h3><small class="tk-meta"><span class="tk-who"><i aria-hidden="true">${esc(tkInitials(who))}</i>${esc(who)}</span><span class="mx-pill is-${state}"><i aria-hidden="true"></i>${esc(tr('mx_'+state))}</span>${a.task.dueAt?`<span>${tr('due')} ${date(a.task.dueAt,true)}</span>`:''}</small></div>${tkPts(a.task.xp)}</header><div class="tk-rv-body"><div class="tk-rv-answer">${body}</div>${review}</div>${reviews}</article></div>`);
}
const tkSeg=(name,legend,options,value)=>`<fieldset class="tk-seg"><legend>${esc(legend)}</legend><div>${options.map(([v,l,ic])=>`<label><input type="radio" name="${name}" value="${esc(v)}" ${String(v)===String(value)?'checked':''}><span>${ic?tkI(ic):''}${esc(l)}</span></label>`).join('')}</div></fieldset>`;
async function tkEditor(id){
 const [,presetKind,presetId]=(id||'').split('~');
 if(presetKind)cache.pick={[presetKind]:[presetId]};
 const t=id.startsWith('new')?null:(await api('GET','/api/admin/tasks')).items.find(x=>x.id===id);
 const tl=t?.translations||{};
 const langDone=l=>!!(tl[l]?.title&&tl[l]?.instructions);
 // One language is enough, whichever the organiser writes in; the others fall back to it.
 const anyDone=['en','hr','ru'].some(langDone);
 const langs=`<p class="tk-note">${tr('tkOneLangNote')}</p>`+['en','hr','ru'].map(l=>`<details class="acc-field acc-lang-block tk-lang" ${l===lang||langDone(l)?'open':''}><summary><span class="tk-lang-code">${l.toUpperCase()}</span><span class="tk-lang-state ${langDone(l)?'is-ok':!anyDone&&l===lang?'is-need':''}">${langDone(l)?tkI('check')+tr('tkFilled'):!anyDone&&l===lang?tr('tkOneLang'):tr('tkOptional')}</span></summary>${field('title_'+l,tr('title'),{value:tl[l]?.title,attrs:'maxlength="160"'})}${field('instructions_'+l,tr('instructions'),{type:'textarea',value:tl[l]?.instructions,attrs:'rows="4"'})}<div class="tk-pair">${field('goal_'+l,tr('goal'),{type:'textarea',value:tl[l]?.goal,attrs:'rows="2"'})}${field('criteria_'+l,tr('criteria'),{type:'textarea',value:tl[l]?.criteria,attrs:'rows="2"'})}</div></details>`).join('');
 const types=['checklist','counter','text','link','attachment','attendance','team_result'];
 const form=`<form data-form="task" data-id="${esc(t?.id||'')}" data-version="${t?.version||''}" class="tk-form">
 <section class="tk-sec"><h3 class="tk-sec-h"><span>1</span>${tr('tkWhat')}</h3>${langs}</section>
 <section class="tk-sec"><h3 class="tk-sec-h"><span>2</span>${tr('tkHow')}</h3>
 <fieldset class="tk-types"><legend>${tr('type')}</legend><div>${types.map(v=>`<label><input type="radio" name="type" value="${v}" ${v===(t?.type||'text')?'checked':''}><span>${tkI(v)}${esc(tr('type_'+v))}</span></label>`).join('')}</div></fieldset>
 <div class="tk-only tk-only-checklist">${field('checklist',tr('checklistItems'),{type:'textarea',value:(t?.checklist||[]).map(c=>pick(c)).join('\n'),attrs:'rows="3"'})}</div>
 <div class="tk-only tk-only-counter">${field('counterTarget',tr('target'),{type:'number',value:t?.counterTarget||1,attrs:'min="1" max="100"'})}</div>
 <div class="tk-row2">${tkSeg('scope',tr('whoSubmits'),[['personal',tr('eachPerson'),'person'],['team',tr('oneForTeam'),'team']],t?.scope||(presetKind==='team'?'team':'personal'))}${tkSeg('audience',tr('audience'),[['all_participants',tr('audAll')],['selected',tr('audSelected')]],t?.audience||(presetKind?'selected':'all_participants'))}</div>
 <div class="tk-row3">${field('xp',tr('points'),{type:'number',value:t?.xp??10,attrs:'min="0" max="1000"'})}${field('dueAt',tr('due'),{type:'datetime-local',value:localInput(t?.dueAt)})}<label class="tk-switch"><input type="checkbox" name="requiresReview" ${t?.requiresReview?'checked':''}><span>${tkI('review')}${tr('requiresReview')}</span></label></div>
 </section>
 <details class="tk-sec tk-adv"><summary class="tk-sec-h"><span>3</span>${tr('tkAdvanced')}<small>${esc([tr('cm_'+(t?.completionMode||'participant')),tr('pm_'+(t?.pickMode||'assigned')),tr('rep_'+(t?.repeatRule||'once'))].join(' · '))}</small></summary><div class="tk-row3">${select('completionMode',tr('completionMode'),['participant','admin_only'].map(v=>[v,tr('cm_'+v)]),t?.completionMode||'participant')}${select('pickMode',tr('pickMode'),['assigned','catalog'].map(v=>[v,tr('pm_'+v)]),t?.pickMode||'assigned')}${select('repeatRule',tr('repeat'),['once','weekly_reward','per_week'].map(v=>[v,tr('rep_'+v)]),t?.repeatRule||'once')}</div></details>
 <div class="tk-save"><button class="tk-btn is-primary">${tkI('check')}${tr('save')}</button></div></form>`;
 // Tasks of the usual kinds (text, link, file, checklist) are written and edited on the one-screen form.
 const compose=tkComposable(t)?await tkCompose(t):null;
 const sendable=t&&['draft','published'].includes(t.status);
 const everyone=sendable&&t.audience!=='selected';
 const [teams,users]=sendable&&!everyone?await Promise.all([api('GET','/api/admin/overview'),api('GET','/api/admin/users')]):[{items:[]},{items:[]}];
 const pick_=cache.pick||{};const box=(name,value,label,on)=>`<label class="tk-chip"><input type="checkbox" name="${name}" value="${esc(value)}" ${on?'checked':''}><span>${esc(label)}</span></label>`;
 const picker=sendable?`<form data-form="task-send" data-id="${esc(t.id)}" class="tk-send">${everyone?`<p class="tk-note">${tkI('team')}${tr('audAllNote')}</p>`:`<p class="tk-sub">${tkI('team')}${tr('teamsNav')}</p><div class="tk-chips">${teams.items.filter(p=>p.members.length).map(p=>box('projectId',p.id,p.name,pick_.team?.includes(p.id))).join('')}</div>${t.scope==='personal'?`<p class="tk-sub">${tkI('person')}${tr('usersShort')}</p><div class="tk-chips">${users.items.filter(u=>u.status==='active'&&u.role==='member').map(u=>box('userId',u.id,u.displayName,pick_.user?.includes(u.id))).join('')}</div>`:''}`}<button class="tk-btn">${tkI('send')}${tr('assignPreview')}</button></form>`:'';
 const pv=t&&cache.preview?.id===t.id?cache.preview:null;
 const preview=pv?`<div class="tk-preview"><p class="tk-preview-n"><b>${pv.new}</b> ${pgPlural('newCount',pv.new)} <small>/ ${pv.total} ${tr('total')}</small></p><span class="tk-dots" aria-hidden="true">${pv.items.slice(0,60).map(x=>`<i class="${x.alreadyAssigned?'is-ok':'is-live'}"></i>`).join('')}</span><ul class="tk-names">${pv.items.slice(0,30).map(x=>`<li class="${x.alreadyAssigned?'is-has':''}">${x.alreadyAssigned?tkI('check'):''}${esc(x.name)}</li>`).join('')}</ul><button data-act="task-assign" data-id="${esc(t.id)}" data-draft="${t.status==='draft'?1:''}" data-key="${idem()}" class="tk-btn is-primary" ${pv.new?'':'disabled'}>${tkI('send')}${tr(t.status==='draft'?'publishAssign':'assign')} (${pv.new})</button></div>`:'';
 const nudge=t&&t.status==='published'&&t.assigned?`<details class="tk-fold"><summary>${tkI('bell')}${tr('nudgeUnfinished')}</summary><form data-form="nudge-open" data-id="${esc(t.id)}">${field('message',tr('nudgeMessage'),{type:'textarea',required:true,value:tr('nudgeTemplate'),attrs:'rows="2" maxlength="300"'})}<button class="tk-btn is-primary">${tkI('send')}${tr('nudgeSend')}</button></form></details>`:'';
 let mark='';
 if(t&&t.status==='published'){const targets=t.scope==='team'?(await api('GET','/api/admin/overview')).items.map(p=>({id:p.id,name:p.name})):(await api('GET','/api/admin/users')).items.map(u=>({id:u.id,name:u.displayName}));
  mark=`<details class="tk-fold"><summary>${tkI('check')}${tr('markFor')}</summary><form data-form="mark" data-id="${esc(t.id)}" data-scope="${esc(t.scope)}"><div class="tk-chips">${targets.map(x=>`<label class="tk-chip"><input type="checkbox" name="target" value="${esc(x.id)}"><span>${esc(x.name)}</span></label>`).join('')}</div>${field('note',tr('note'),{attrs:'maxlength="500"'})}<button class="tk-btn is-primary">${tkI('check')}${tr('markDone')}</button></form></details>`;}
 const share=t&&t.status==='published'?`<details class="tk-fold"><summary>${tkI('share')}${tr('waTitle')}</summary><p class="tk-note">${tr('waNote')}</p>${waLink(`${tr('waNewTask')}: ${taskText(tl)}${t.dueAt?`\n${tr('due')} ${date(t.dueAt,true)}`:''}\n${t.xp} ${pgPlural('xp',t.xp)}\n${siteLink('#/account/tasks')}`)}</details>`:'';
 const p=t?tkParts(t):null;
 // Who accepted, declined or has not answered yet, team by team (from the homework overview).
 let answers='';
 if(t&&t.assigned&&t.pickMode!=='catalog'){const mx=await api('GET','/api/admin/tasks/matrix').catch(()=>null);const rows=(mx?.teams||[]).map(x=>({x,c:mx.cells[x.id+'|'+t.id]})).filter(r=>r.c);
  if(rows.length)answers=`<section class="tk-panel"><div class="tk-panel-top"><span class="tk-kpi-l">${tr('rsPanel')}</span><small class="mx-sum"><b>✓${t.responses.accepted}</b> <b>✗${t.responses.declined}</b> <b>?${t.responses.unanswered}</b></small></div><ul class="mx-list">${rows.map(({x,c})=>`<li><a href="#/admin/answer/${esc(c.assignmentId)}"><span>${esc(x.name)}</span><span class="mx-pill is-${c.status}"><i aria-hidden="true"></i>${esc(tr('mx_'+c.status))}</span></a></li>`).join('')}</ul></section>`;}
 const side=t?`<aside class="tk-side">
 <section class="tk-panel">${tkStatus(t)}</section>
 <section class="tk-panel"><div class="tk-panel-top"><span class="tk-kpi-l">${tr('progress')}</span>${tkDue(t)}</div>${tkBar(p,{big:true,catalog:t.pickMode==='catalog'})}${p.total?tkLegend(p):''}${t.waiting?`<a class="tk-btn is-wait" href="#/admin/reviews">${tkI('review')}${tr('tkToReview')} (${t.waiting})</a>`:''}</section>
 ${answers}
 ${sendable&&t.status==='draft'?`<section class="tk-panel"><span class="tk-kpi-l">${tr('recipients')}</span>${picker}${preview}</section>`:''}
 ${nudge||mark||share?`<section class="tk-panel tk-folds">${nudge}${mark}${share}</section>`:''}
 </aside>`:'';
 const letter=t?'':`<details class="tk-panel acc-letter tk-letter" ${id==='new-letter'?'open':''}><summary>${tkI('mail')}<strong>${tr('letterTask')}</strong></summary><p class="tk-note">${tr('letterNote')}</p><label class="acc-field"><span>${tr('letterText')}</span><textarea id="letter-text" rows="8" maxlength="20000"></textarea></label><div class="tk-actions"><button type="button" class="tk-btn is-primary" data-act="letter-fill">${tr('letterFill')}</button></div><p class="acc-muted" id="letter-result" role="status"></p></details>`;
 const head=`<header class="tk-ed-head"><a class="tk-backlink" href="#/admin/tasks">← ${tr('tasks')}</a><div class="tk-ed-title">${t?`<span class="tk-type is-big">${tkI(t.type)}</span><h2>${authored(tl,'title')}</h2>${tkPts(t.xp)}`:`<span class="tk-type is-big">${tkI('plus')}</span><h2>${tr('newTask')}</h2>`}</div></header>`;
 return adminShell('tasks',`<div class="tk tk-ed ${t?'':'is-new'}">${head}<div class="tk-ed-grid">${side}<div class="tk-ed-main">${letter}${compose||form}</div></div></div>`);
}
async function tkImport(){
 const [tl,ll,hooks]=await Promise.all([api('GET','/api/admin/tasks?status=published'),api('GET','/api/admin/lectures'),api('GET','/api/admin/form-hooks')]);
 const pv=cache.importPreview;const secret=cache.hookSecret;cache.hookSecret=null;
 const script=secret?`function onFormSubmit(e) {\n  var r = e.response;\n  var email = r.getRespondentEmail();\n  UrlFetchApp.fetch('${location.origin}/api/forms/hook', {\n    method: 'post', contentType: 'application/json',\n    headers: {'X-Form-Secret': '${secret}'},\n    payload: JSON.stringify({email: email, note: ''}),\n    muteHttpExceptions: true\n  });\n}`:'';
 const steps=[['tkStepKind',1],['tkStepFile',pv?1:0],['tkStepCheck',pv?1:0],['apply',0]];
 const bad=pv?pv.total-pv.ready:0;
 const result=pv?`<div class="tk-import-res"><div class="tk-kpi-row"><span><b>${pv.ready}</b> ${tr('ready')}</span>${bad?`<span class="is-late"><b>${bad}</b> ${tr('tkProblems')}</span>`:''}<span class="tk-muted">/ ${pv.total}</span></div><div class="tk-prog is-big"><div class="tk-bar" role="img" aria-label="${esc(`${pv.ready} ${tr('ready')}, ${bad} ${tr('tkProblems')}`)}">${pv.ready?`<i class="tk-p-ok" style="--w:${pv.ready/Math.max(1,pv.total)*100}%"></i>`:''}${bad?`<i class="tk-p-late" style="--w:${bad/Math.max(1,pv.total)*100}%"></i>`:''}</div></div><div class="acc-table-wrap"><table class="tk-table"><tbody>${pv.rows.map(r=>`<tr class="${r.status==='ok'?'is-ok':'is-bad'}"><td>${r.line}</td><td>${esc(r.who)}</td><td>${esc(r.user?.name||'')}${r.user?.by==='email'?' <small>email</small>':''}</td><td>${esc(r.lecture?.date||'')}</td><td><span class="tk-st is-${r.status==='ok'?'published':'late'}"></span>${tr('is_'+r.status)}</td></tr>`).join('')}</tbody></table></div></div>`:'';
 return adminShell('import',`<div class="tk tk-import"><section class="tk-panel"><div class="tk-panel-top"><h3 class="tk-sec-h">${tkI('csv')}Google Forms → CSV</h3></div><ol class="tk-steps is-small">${steps.map(([k,on],i)=>`<li class="${on?'is-done':i===(pv?3:1)?'is-now':''}"><span>${esc(tr(k))}</span></li>`).join('')}</ol><p class="tk-note">${tr('importNote')}</p><form data-form="import" class="tk-import-form"><div class="tk-row3">${select('kind',tr('importKind'),[['attendance',tr('ik_attendance')],['task',tr('ik_task')]],pv?.kind||'attendance')}<div class="tk-if-att">${select('lectureId',tr('lectures'),[['',tr('lectureFromColumn')],...ll.items.map(x=>[x.id,pick(x.title)+' · '+x.date])],pv?.lectureId||'')}</div><div class="tk-if-task">${select('taskId',tr('tasks'),tl.items.map(x=>[x.id,taskText(x.translations)]),pv?.taskId||'')}</div></div><label class="tk-drop"><span>${tkI('file')}${tr('csvFile')}</span><input type="file" name="file" accept=".csv,text/csv"></label><details class="tk-fold" ${pv?.csv?'open':''}><summary>${tr('orPaste')}</summary>${field('csv',tr('orPaste'),{type:'textarea',value:pv?.csv||'',attrs:'rows="5"'})}</details><div class="tk-actions"><button class="tk-btn" name="step" value="preview">${tr('preview')}</button>${pv?`<button class="tk-btn is-primary" name="step" value="apply">${tkI('check')}${tr('apply')} (${pv.ready})</button>`:''}</div></form>${result}</section>
 <section class="tk-panel"><div class="tk-panel-top"><h3 class="tk-sec-h">${tkI('hook')}${tr('hooks')}</h3></div><p class="tk-note">${tr('hookNote')}</p>${hooks.items.length?`<ul class="tk-hooks">${hooks.items.map(h=>`<li class="${h.revoked_at?'is-off':''}"><span class="tk-st is-${h.revoked_at?'archived':'published'}"></span><div class="tk-main"><strong>${esc(h.label||h.kind)}</strong><small class="tk-meta"><span>${tr('ik_'+h.kind)}</span><span>${h.last_used?tkI('clock')+date(h.last_used,true):tr('tkNeverUsed')}</span>${h.revoked_at?`<span>${tr('tkRevoked')}</span>`:''}</small></div>${h.revoked_at?'':`<button class="tk-btn is-quiet" data-act="hook-revoke" data-id="${esc(h.id)}">${tr('revoke')}</button>`}</li>`).join('')}</ul>`:''}<details class="tk-fold" ${secret?'open':''}><summary>${tkI('plus')}${tr('createHook')}</summary><form data-form="hook" class="tk-hook-form"><div class="tk-row3">${select('kind',tr('importKind'),[['attendance',tr('ik_attendance')],['task',tr('ik_task')]],'attendance')}<div class="tk-if-att">${select('lectureId',tr('lectures'),ll.items.map(x=>[x.id,pick(x.title)+' · '+x.date]),ll.items.at(-1)?.id)}</div><div class="tk-if-task">${select('taskId',tr('tasks'),tl.items.map(x=>[x.id,x.translations.en.title]),'')}</div></div>${field('label',tr('title'),{attrs:'maxlength="80"'})}<button class="tk-btn is-primary">${tr('createHook')}</button></form></details>${secret?`<pre class="acc-pre acc-script tk-script">${esc(script.replace(/\\n/g,'\n'))}</pre>`:''}</section></div>`);
}
async function adminView(tab='dashboard',id){
 if(tab==='dashboard')return dashboardView();
 if(tab==='today')return todayView();
 if(tab==='team'&&id)return teamRecord(id);
 if(tab==='person'&&id)return personRecord(id);
 if(tab==='overview'){
  // Stage (several ticks) and raised-amount range go to the server; the quick buttons below narrow what came back.
  const sf=cache.stageFilter||{stages:[],raisedMin:'',raisedMax:''},q=new URLSearchParams();
  if(sf.stages.length)q.set('stage',sf.stages.join(','));if(sf.raisedMin!=='')q.set('raisedMin',sf.raisedMin);if(sf.raisedMax!=='')q.set('raisedMax',sf.raisedMax);
  const o=await api('GET','/api/admin/overview'+(q.size?'?'+q:'')),view=cache.teamFilter||'all';
  const filtered=sf.stages.length||sf.raisedMin!==''||sf.raisedMax!=='';
  const stageFilter=`<form data-form="stage-filter" class="acc-card acc-stage-filter"><fieldset><legend>${tr('dashStage')}</legend><div class="tk-chips">${STAGES.map(s=>`<label class="tk-chip"><input type="checkbox" name="stage" value="${s}" ${sf.stages.includes(s)?'checked':''}><span>${esc(tr('stage_'+s))}</span></label>`).join('')}</div></fieldset><fieldset class="acc-raised"><legend>${tr('tfRaised')}</legend><div class="acc-inline">${field('raisedMin',tr('tfFrom'),{type:'number',value:sf.raisedMin,attrs:'min="0" step="1" inputmode="numeric"'})}${field('raisedMax',tr('tfTo'),{type:'number',value:sf.raisedMax,attrs:'min="0" step="1" inputmode="numeric"'})}</div>${sf.raisedMin!==''||sf.raisedMax!==''?`<small class="acc-muted">${tr('tfRaisedNote')}</small>`:''}</fieldset><div class="acc-actions"><button class="acc-secondary">${tr('tfApply')}</button>${filtered?`<button type="button" data-act="stage-filter-clear">${tr('tfClear')}</button><span class="acc-muted" role="status">${esc(tr('tfShown').replace('{n}',o.items.length).replace('{m}',o.total??o.items.length))}</span>`:''}</div></form>`;
  const tests=TEAM_TESTS;
  const rows=o.items.filter(tests[view]);
  const deck={accepted:'✓',submitted:'…'};
  // From Today's "Nudge teams": the form is open and the teams that need attention are already ticked.
  const nudging=id==='nudge';
  const made=cache.rosterDone;cache.rosterDone=null;
  const roster=`<div class="acc-grid acc-roster"><details class="acc-card" ${made==='team'?'open':''}><summary><strong>${I('plus')} ${tr('newTeam')}</strong></summary><form data-form="admin-team" class="acc-compact">${field('name',tr('teamName'),{required:true,attrs:'maxlength="100"'})}${field('description',tr('teamDescription'),{type:'textarea',attrs:'rows="2" maxlength="280"'})}<button class="acc-primary">${tr('newTeam')}</button></form></details>
  <details class="acc-card" ${made==='person'?'open':''}><summary><strong>${I('person')} ${tr('addPerson')}</strong></summary><p class="acc-muted">${tr('addPersonNote')}</p><form data-form="admin-person" class="acc-compact">${field('name',tr('fullName'),{required:true,attrs:'maxlength="80"'})}${field('email',tr('personEmail'),{type:'email',attrs:'maxlength="200"'})}${select('projectId',tr('team'),[['',tr('noTeam')],...o.items.map(p=>[p.id,p.name])],cache.lastTeam||'')}<button class="acc-primary">${tr('addPerson')}</button></form><p><a href="#/admin/links">${tr('linksGo')} →</a></p></details></div>`;
  return adminShell(tab,`${roster}<div class="acc-actions acc-admin-tools"><a class="acc-secondary" href="/api/admin/export.csv" download>${tr('exportCsv')}</a><a class="acc-secondary" href="/api/admin/export-people.csv" download>${tr('exportPeople')}</a><a href="/api/calendar.ics">${tr('calendar')} (.ics)</a></div>
  ${stageFilter}
  <div class="acc-filters" role="group">${Object.keys(tests).map(k=>`<button data-act="team-filter" data-view="${k}" aria-pressed="${k===view}">${tr('tf_'+k)}</button>`).join('')}</div>
  <details class="acc-card acc-nudge-team" ${nudging?'open':''}><summary>${tr('nudgeTeam')}</summary><form data-form="nudge" id="team-nudge" class="acc-compact"><p class="acc-muted">${tr('nudgePick')}</p>${field('message',tr('nudgeMessage'),{type:'textarea',required:true,value:nudging?tr('nudgeTeamTemplate'):'',attrs:'rows="2" maxlength="300"'})}<button class="acc-primary">${tr('nudgeSend')}</button></form></details>
  <div class="acc-table-wrap"><table class="acc-table acc-matrix acc-teams-table"><thead><tr><th></th><th>${tr('project')}</th><th>${tr('colStage')}</th><th>${tr('scoreColumn')}</th><th>${tr('tasks')}</th><th>${tr('attendance')}<small>✓ ${tr('pgVerifiedShort')} · ${tr('selfReportedShort')}</small></th><th>${tr('pitches')}</th><th>${tr('mentors')}</th><th>${tr('risk')}</th><th>${tr('lastSeen')}</th></tr></thead><tbody>${rows.map(p=>`<tr class="risk-${esc(p.risk.level)}"><td>${p.members.length?`<label class="acc-tick"><input type="checkbox" name="teamId" value="${esc(p.id)}" form="team-nudge" aria-label="${esc(p.name)}" ${nudging&&p.risk.level!=='ok'?'checked':''}></label>`:''}</td><th scope="row"><a href="#/admin/team/${esc(p.id)}"><strong>${esc(p.name)}</strong></a><small>${esc(p.members.join(', '))||tr('noAccountsYet')}</small></th><td class="acc-stage-cell"><span class="m-tag">${esc(stageLabel(p.stage))}</span>${p.stageSince?`<small>${tr('stageSince')} ${date(p.stageSince)}</small>`:''}${p.funding&&(p.funding.raisedEur!==null||p.funding.raisingEur!==null)?`<small>${p.funding.raisedEur!==null?`${tr('raisedShort')} ${eur(p.funding.raisedEur)}`:''}${p.funding.raisedEur!==null&&p.funding.raisingEur!==null?' · ':''}${p.funding.raisingEur!==null?`${tr('raisingShort')} ${eur(p.funding.raisingEur)}`:''}</small>`:''}${p.funding?.round?`<small>${esc(tr('round_'+p.funding.round))}</small>`:''}</td><td><b>${percent(p.percent)}</b><small>${p.totalXp} ${pgPlural('xp',p.totalXp)}</small></td><td>${p.tasks.done}/${p.tasks.total}${p.overdue?`<small class="acc-idle">${p.overdue} ${pgPlural('overdueShort',p.overdue)}</small>`:''}${p.tasks.waitingReview?`<small>${p.tasks.waitingReview} ${pgPlural('waiting',p.tasks.waitingReview)}</small>`:''}</td><td>${p.attendance.verified} ✓ · ${p.attendance.selfReported}</td><td>${deck[p.pitch.deck]||'—'}<small>${p.pitch.pitches} ${pgPlural('pitches',p.pitch.pitches)}</small></td><td>${p.mentorSessions}</td><td><span class="acc-light is-${esc(p.risk.level)}">${tr('risk_'+p.risk.level)}</span><small>${p.risk.signals.map(x=>tr('sig_'+x)).join(', ')}${p.streak?` · ${I('flame')}${p.streak}`:''}</small></td><td><small class="${idle(p.lastSeen)?'acc-idle':''}">${p.lastSeen?date(p.lastSeen,true):'—'}</small></td></tr>`).join('')}</tbody></table></div>`);
 }
 if(tab==='reviews')return tkReviews(id);
 // Homework overview is the first thing under Tasks; the list of tasks is one tab further.
 if(tab==='tasks')return id==='list'?tkBoard():tkMatrix();
 if(tab==='answer'&&id)return tkAnswerView(id);
 if(tab==='task')return tkEditor(id);
 // Linking cards to accounts lives in whoami.js (it fills this slot after render).
 if(tab==='links')return adminShell(tab,'<div data-admin-links></div>');
 if(tab==='claims'){
  const c=await api('GET','/api/admin/claims');
  const people=(await api('GET','/api/admin/links')).items.filter(p=>!p.linked);
  return adminShell(tab,`${c.items.length?`<ul class="acc-list">${c.items.map(x=>`<li><div><strong>${esc(x.userName)}</strong> (${esc(x.login)}) → <strong>${esc(x.personName)}</strong><small>${esc(x.message)} · ${date(x.created,true)}</small></div><span class="acc-actions"><button data-act="claim" data-id="${esc(x.id)}" data-decision="approved" class="acc-secondary">${tr('approve')}</button><button data-act="claim" data-id="${esc(x.id)}" data-decision="rejected">${tr('reject')}</button></span></li>`).join('')}</ul>`:empty()}
  <form data-form="person-invite" class="acc-card"><h2>${tr('personInvite')}</h2>${select('personId',tr('character'),people.map(p=>[p.id,p.displayName]),'')}<button class="acc-secondary">${tr('invite')}</button></form>${inviteBox(cache.newInvite)}`);
 }
 if(tab==='users'){
  const u=await api('GET','/api/admin/users');
  return adminShell(tab,`<label class="acc-field"><span>${tr('searchPeople')}</span><input type="search" data-filter="people" autocomplete="off"></label><p class="acc-muted acc-pm-note">${tr('pmNote')}</p><div class="acc-table-wrap"><table class="acc-table acc-matrix"><thead><tr><th></th><th>${tr('displayName')}</th><th>${tr('status')}</th><th>${tr('points')}</th><th></th></tr></thead><tbody>${u.items.map(x=>`<tr data-search="${esc((x.displayName+' '+x.login+' '+(x.projects||[]).join(' ')).toLowerCase())}" class="${x.status==='active'&&x.role==='member'&&idle(x.lastSeen)?'risk-watch':''}"><td>${x.status==='active'?`<label class="acc-tick"><input type="checkbox" name="userId" value="${esc(x.id)}" form="nudge-form" data-idle="${x.role==='member'&&idle(x.lastSeen)?1:0}" aria-label="${esc(x.displayName)}"></label>`:''}</td><th scope="row"><a href="#/admin/person/${esc(x.id)}"><strong>${esc(x.displayName)}</strong></a><small>${esc(seen(x.lastSeen))}</small><small>${esc(x.login)}${x.projects?.length?' · '+esc(x.projects.join(', ')):''}</small></th><td>${esc(tr('urole_'+x.role))}<small>${x.status==='active'?'':tr('disabledNow')}</small>${x.role!=='member'&&x.status==='active'?`<button type="button" class="acc-link acc-pm ${x.programmeManager?'is-on':''}" data-act="manager-flag" data-id="${esc(x.id)}" data-on="${x.programmeManager?'':'1'}" aria-pressed="${x.programmeManager?'true':'false'}" title="${esc(tr('pmNote'))}">${x.programmeManager?'✓ ':''}${tr('pmToggle')}</button>`:''}</td><td>${x.xp}<small>${x.tasksDone} ${pgPlural('tasksDoneShort',x.tasksDone)} · ${x.lectures} ${pgPlural('lecturesShort',x.lectures)}</small></td><td>${x.role!=='platform_owner'?`<select data-act="user-role" data-id="${esc(x.id)}" data-current="${esc(x.role)}" aria-label="${tr('roleChange')}">${['member','program_admin'].map(r=>`<option value="${r}" ${x.role===r?'selected':''}>${tr('urole_'+r)}</option>`).join('')}</select><button data-act="user-status" data-id="${esc(x.id)}" data-status="${x.status==='active'?'disabled':'active'}" ${x.status==='active'?`data-confirm="${esc(tr('confirmDisable'))}"`:''}>${tr(x.status==='active'?'disable':'enable')}</button>`:''}</td></tr>`).join('')}</tbody></table></div><form data-form="nudge" id="nudge-form" class="acc-card"><h2>${tr('nudgeTitle')}</h2><p class="acc-muted">${tr('nudgeNote')}</p>${field('message',tr('nudgeMessage'),{type:'textarea',required:true,attrs:'rows="2" maxlength="300"'})}<div class="acc-actions"><button class="acc-primary">${tr('nudgeSend')}</button><button type="button" data-act="pick-idle">${tr('pickIdle')}</button></div></form>`);
 }
 if(tab==='system')return systemView();
 if(tab==='lectures')return lecturesView();
 if(tab==='lecture')return lectureDetail(id);
 if(tab==='insights')return insightsView();
 if(tab==='checkins'){
  const c=await api('GET','/api/admin/checkins'+(id?'?week='+encodeURIComponent(id):''));
  return adminShell(tab,`<h2>${tr('week')} ${esc(c.week)}</h2><div class="acc-table-wrap"><table class="acc-table"><thead><tr><th>${tr('project')}</th><th>${tr('metricOfWeek')}</th><th>${tr('goal2w')}</th><th>${tr('blocker')}</th><th>${tr('streak')}</th></tr></thead><tbody>${c.items.map(r=>`<tr class="${r.done?'':'risk-watch'}"><td><strong>${esc(r.name)}</strong>${r.needsHelp?`<small class="acc-help">${tr('needsHelp')}</small>`:''}</td><td>${r.done?esc(r.metricName)+': <b>'+esc(r.metricValue)+'</b>':`<small>${tr('checkinMissing')}</small>`}</td><td>${esc(r.goal||'')}</td><td>${esc(r.blocker||'')}</td><td>${r.streak?I('flame')+r.streak:'—'}</td></tr>`).join('')}</tbody></table></div>`);
 }
 if(tab==='import')return tkImport();
 if(tab==='news')return newsAdminView();
 if(tab==='mentors')return mentorsAdminView();
 if(tab==='rewards')return rewardsAdminView();
 if(tab==='reports')return reportsView();
 if(tab==='audit')return auditView(id);
 if(tab==='funder'&&window.BirdReport)return adminShell(tab,await window.BirdReport.view({api,lang}));
 return adminShell('overview',empty());
}

// Motion ----------------------------------------------------------------------------------
// Cards rise as they scroll into view and numbers count up from zero. The final value is in the
// HTML from the start, so nothing depends on this; reduced motion skips it entirely.
const REVEAL='[data-reveal],.ui-card,.ui-kpi,.dash-kpis>*,.dash-alerts>*,.rec-crew,.dash-panel,.dash-card,.acc-stats>*,.acc-body>.acc-card,.acc-body>section,.acc-grid>*,.acc-tasksum,.rec-head';
function motion(){
 const box=root.querySelector('.acc.is-intro');if(!box)return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver' in window)){box.classList.remove('is-intro');return;}
 const items=[...box.querySelectorAll(REVEAL)].filter(el=>!el.parentElement.closest('[data-in]')&&!el.matches('details:not(.acc-card)'));
 items.forEach(el=>{el.setAttribute('data-in','');if(!el.style.getPropertyValue('--i'))el.style.setProperty('--i',String([...el.parentElement.children].indexOf(el)%8));});
 box.classList.add('is-io');
 const io=new IntersectionObserver(list=>list.forEach(x=>{if(!x.isIntersecting)return;io.unobserve(x.target);x.target.classList.add('is-in');}),{threshold:.12});
 items.forEach(el=>io.observe(el));
}
const num=n=>Number.isInteger(n)&&n>0?`<span data-count="${n}">${n}</span>`:esc(n??'—');

// Render and events ---------------------------------------------------------------------
async function render(){
 if(!root||!isRoute())return;
 const token=++renderToken;const p=parts();
 // Entrance motion plays when a page is opened, not when a filter or a save re-renders it.
 cache.intro=cache.lastHash!==location.hash;cache.lastHash=location.hash;
 if(me===undefined)await loadMe();
 let html;
 try{
  if(p[0]==='account'&&p[1]==='reset')html=resetView();
  else if(!me&&p[1]==='forgot')html=forgotView();
  else if(!me){html=cache.codes?codesView(cache.codes.codes,cache.codes.next):authView(['register','recover'].includes(p[1])?p[1]:'login');}
  else if(cache.codes){html=codesView(cache.codes.codes,cache.codes.next);}
  else if(p[0]==='admin'){html=isAdmin()?await adminView(p[1]||'dashboard',p[2]):shell('overview',`<p class="acc-flash is-error">${tr('e_FORBIDDEN')}</p>`);}
  else if(!p[1])html=await overviewView();
  else if(p[1]==='tasks')html=await tasksView();
  else if(p[1]==='task')html=await taskView(p[2]);
  else if(p[1]==='progress')html=await progressView();
  else if(p[1]==='messages')html=await messagesView(p[2],p[3],p[4]);
  else if(p[1]==='mentors')html=await mentorsView(p[2]);
  else if(p[1]==='character')html=await characterView();
  else if(p[1]==='settings')html=await settingsView();
  else if(p[1]==='new-project')html=shell('overview',`<a class="acc-back" href="#/account">← ${tr('myProjects')}</a><h2>${tr('newProject')}</h2>${projectForm(null)}`);
  else if(p[1]==='project')html=await projectView(p[2],p[3]||'edit');
  else if(['register','recover'].includes(p[1]))html=await overviewView();
  else html=await overviewView();
 }catch(e){html=me?shell('overview',`<p class="acc-flash is-error" role="alert">${errText(e)}</p>`):authView('login');}
 if(token!==renderToken||!root)return;
 cache.stopChars?.();cache.stopChars=null;stopChar?.();stopChar=null;cache.stopMsgr?.();cache.stopMsgr=null;
 root.innerHTML=html;updateNav();motion();
 const msgr=root.querySelector('[data-msgr-app]');
 if(msgr&&window.BirdMessenger)cache.stopMsgr=window.BirdMessenger.app(msgr,{lang,route:msgr.dataset.route?msgr.dataset.route.split('/'):[],newGroup:'#/account/messages/new-group'});
 // One owner for the living characters: the admin stage and the participant's own one.
 const stage=root.querySelector('[data-cs-stage]');if(window.BirdCharacter&&stage)cache.stopChars=window.BirdCharacter.start(root);
 liven(p);
 // Numbers count up once, on the first render of the view only (shared with the office panel).
 if(cache.intro)window.BirdMotion?.play(root);
 const thread=root.querySelector('.acc-dm-thread');if(thread)thread.scrollTop=thread.scrollHeight;
 if(me&&['account'].includes(p[0])&&(!p[1]||p[1]==='progress'))celebrateBadges();
 const status=root.querySelector('.acc-flash');if(status)status.focus?.();
 if(cache.refocus){root.querySelector(cache.refocus)?.focus();cache.refocus=null;}
 const points=root.querySelector('#acc-points[data-auto]');if(points&&!root.querySelector('.acc-flash[role]'))try{points.showModal();localStorage.setItem('bird-points:'+me.id,points.dataset.auto);}catch{}
 phoneFit();
 window.BirdWhoami?.enhance(root,{lang,csrf,refresh:render});
}
// Phones: strips that scroll sideways (tabs, filters, sort) keep the current item in view and fade
// on the side where more items hide; table cells get their column name so rows can stack as cards.
const STRIPS='.acc-tabs,.acc-filters,.dash-sort,.tk-filters';
function stripEdges(el){const m=el.scrollWidth-el.clientWidth;el.classList.toggle('is-more-start',m>1&&el.scrollLeft>1);el.classList.toggle('is-more-end',m>1&&el.scrollLeft<m-1);}
function phoneFit(){
 root.querySelectorAll(STRIPS).forEach(el=>{
  const cur=el.querySelector('[aria-current=page],[aria-pressed=true]');
  if(cur&&el.scrollWidth>el.clientWidth){const r=cur.getBoundingClientRect(),b=el.getBoundingClientRect();if(r.left<b.left||r.right>b.right)el.scrollTo({left:el.scrollLeft+r.left-b.left-(b.width-r.width)/2,behavior:'instant'});}
  stripEdges(el);el.addEventListener('scroll',()=>stripEdges(el),{passive:true});
 });
 root.querySelectorAll('.acc-table:not(.acc-attendance-table)').forEach(t=>{const h=[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim());t.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((c,i)=>{if(h[i]&&c.tagName==='TD')c.dataset.label=h[i];}));});
}
addEventListener('resize',()=>root?.querySelectorAll(STRIPS).forEach(stripEdges),{passive:true});
function setFlash(html,error=false){flash={html,error};}
// First visit of a participant view: cards rise in turn, numbers count up, bars fill. Re-renders stay still.
let stopChar=null;
function liven(){
 const acc=root.querySelector('.acc-m');if(!acc||!cache.intro||window.BirdMotion?.reduced())return;
 acc.classList.add('m-anim');
 acc.querySelectorAll('.m-rise').forEach((el,i)=>el.style.setProperty('--d',Math.min(i,16)*45+'ms'));
}
// New badge: a short pixel achievement toast (static frame with reduced motion).
async function celebrateBadges(){
 if(!me||!window.BirdOfficeFX?.achievement)return;
 let p;try{p=await api('GET','/api/progress');}catch{return;}
 const key='bird-seen-badges:'+me.id;let seen=null;try{seen=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 const ids=p.badges.map(b=>b.id);try{localStorage.setItem(key,JSON.stringify(ids));}catch{}
 if(!seen)return;
 const fresh=p.badges.find(b=>!seen.includes(b.id));if(!fresh)return;
 const img=document.createElement('img');img.className='acc-achievement';img.alt=tr('n_badge')+': '+pick(fresh.title);img.setAttribute('role','status');document.body.append(img);
 const title=(fresh.title.en||'').toUpperCase().slice(0,22),still=matchMedia('(prefers-reduced-motion: reduce)').matches,start=performance.now();
 const frame=now=>{const t=still?1.2:(now-start)/1000;img.src=BirdOfficeFX.achievement(Math.min(t,2.39),'ACHIEVEMENT',title);if(!still&&t<2.4)requestAnimationFrame(frame);else setTimeout(()=>img.remove(),still?2500:200);};
 requestAnimationFrame(frame);
}
async function run(fn){try{await fn();}catch(e){if(e.code==='CONFLICT'&&e.detail?.yours){cache.conflict={id:parts()[2],yours:e.detail.yours};render();return;}setFlash(errText(e),true);render();}}

async function onSubmit(e){
 const form=e.target.closest('form[data-form]');if(!form||!root.contains(form))return;
 e.preventDefault();const f=new FormData(form),kind=form.dataset.form,btn=e.submitter;
 if(btn?.dataset.confirm&&!window.confirm(btn.dataset.confirm))return;
 if(form.dataset.busy)return;form.dataset.busy='1';[...form.querySelectorAll('button')].forEach(b=>b.disabled=true);
 await run(async()=>{
  if(kind==='login'){await api('POST','/api/auth/login',{login:f.get('login'),password:f.get('password')});await loadMe();
   // Signed in from an invitation link: the code is used at once.
   const code=hashParam('invite');if(code){try{await api('POST','/api/invites/accept',{code});await loadMe();setFlash(tr('saved'));}catch(err){setFlash(errText(err),true);}}
   announce();go('#/account');return;}
  if(kind==='register'){const r=await api('POST','/api/auth/register',{login:f.get('login'),password:f.get('password'),displayName:f.get('displayName'),email:f.get('email'),language:lang});me=r.user;if(f.get('invite')){try{await api('POST','/api/invites/accept',{code:f.get('invite')});await loadMe();}catch(err){setFlash(errText(err),true);}}announce();cache.codesNotice=r.recoveryCodes;go('#/account');return;}
  if(kind==='forgot'){const r=await api('POST','/api/auth/password-reset/request',{login:f.get('login')});cache.forgotSent={mail:!!r.mail};render();return;}
  if(kind==='reset'){if(f.get('newPassword')!==f.get('newPassword2')){setFlash(tr('passwordsDiffer'),true);render();return;}
   try{await api('POST','/api/auth/password-reset/confirm',{token:hashParam('token'),newPassword:f.get('newPassword')});}catch(err){if(err.code!=='RESET_INVALID')throw err;cache.resetBad=true;render();return;}
   await loadMe();announce();setFlash(tr('resetDone'));go('#/account');return;}
  if(kind==='recover'){await api('POST','/api/auth/recover',{login:f.get('login'),code:f.get('code'),newPassword:f.get('newPassword')});await loadMe();setFlash(tr('saved'));go('#/account/settings');return;}
  if(kind==='invite'){const r=await api('POST','/api/invites/accept',{code:f.get('code')});await loadMe();setFlash(tr('saved'));go(r.projectId?'#/account/project/'+r.projectId:'#/account');return;}
  if(kind==='claim'){await api('POST','/api/people/claims',{personId:f.get('personId'),message:f.get('message')});setFlash(tr('st_pending'));render();return;}
  if(kind==='stage-filter'){const n=k=>{const v=String(f.get(k)||'').trim();return /^\d+$/.test(v)?v:'';};cache.stageFilter={stages:f.getAll('stage'),raisedMin:n('raisedMin'),raisedMax:n('raisedMax')};render();return;}
  if(kind==='project'){const content=readProjectForm(form),funding=readFunding(form);
   if(!form.dataset.id){const r=await api('POST','/api/projects',{...content,funding},{key:form.dataset.key||(form.dataset.key=idem())});go('#/account/project/'+r.project.id);return;}
   try{sessionStorage.setItem(DRAFT_KEY(form.dataset.id),JSON.stringify({version:Number(form.dataset.version),content,funding}));}catch{}
   await api('PUT',`/api/projects/${encodeURIComponent(form.dataset.id)}/draft`,{content,funding},{headers:{'If-Match':`"${form.dataset.version}"`}});
   try{sessionStorage.removeItem(DRAFT_KEY(form.dataset.id));}catch{}
   setFlash(tr('saved'));render();return;}
  if(kind==='upload'||kind==='reference'){const file=f.get('file');if(!file?.size)return;
   const purpose=kind==='reference'?'reference':/\.(png|jpe?g|webp)$/i.test(file.name)?'image':'document';
   const url=`/api/files?purpose=${purpose}${kind==='upload'?'&projectId='+encodeURIComponent(form.dataset.id):''}`;
   await api('POST',url,undefined,{raw:file,key:idem(),headers:{'X-Filename':encodeURIComponent(file.name),'Content-Type':file.type||'application/octet-stream'}});setFlash(tr('saved'));render();return;}
  if(kind==='project-invite'){const r=await api('POST','/api/invites',{kind:'project',projectId:form.dataset.id,role:f.get('role')});cache.newInvite=r.code;render();return;}
  if(kind==='admin-team'){const r=await api('POST','/api/admin/teams',{name:f.get('name'),description:f.get('description')});cache.lastTeam=r.projectId;cache.rosterDone='person';setFlash(tr('teamCreated').replace('{name}',esc(r.name)));render();return;}
  if(kind==='admin-person'){const r=await api('POST','/api/admin/people',{name:f.get('name'),email:f.get('email'),projectId:f.get('projectId')||null});cache.lastTeam=f.get('projectId')||'';cache.rosterDone='person';setFlash(tr(r.linkedUserId?'personAddedLinked':r.email?'personAdded':'personAddedNoMail').replace('{name}',esc(r.name)));render();return;}
  if(kind==='person-invite'){const r=await api('POST','/api/invites',{kind:'person',personId:f.get('personId')});cache.newInvite=r.code;render();return;}
  if(kind==='update'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/updates`,{body:f.get('body'),visibility:f.get('visibility')},{key:btn?.dataset.key});setFlash(tr('saved'));render();return;}
  if(kind==='help'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/help`,{kind:f.get('kind'),body:f.get('body')});render();return;}
  if(kind==='milestone'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/milestones`,{title:f.get('title'),due:f.get('due')||null});render();return;}
  if(kind==='metric'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/metrics`,{name:f.get('name'),value:f.get('value'),measuredOn:f.get('measuredOn'),visibility:f.get('visibility')});render();return;}
  if(kind==='answer'){await uploadInto(form);await api('POST',`/api/tasks/${encodeURIComponent(form.dataset.id)}/submit`,{content:answerContent(form,form.dataset.type)},{key:btn?.dataset.key});setFlash(tr('saved'));render();return;}
  if(kind==='character'){const body=Object.fromEntries([...f.entries()]);await api('PUT','/api/me/character',body);setFlash(tr('saved'));render();return;}
  if(kind==='email-prefs'){const r=await api('PUT','/api/me/profile',{emailMessages:f.get('emailMessages')==='on',emailReminders:f.get('emailReminders')==='on'});me=r.user;setFlash(tr('saved'));render();return;}
  if(kind==='profile'){const r=await api('PUT','/api/me/profile',{displayName:f.get('displayName'),email:f.get('email'),language:f.get('language'),leaderboardOptIn:f.get('leaderboardOptIn')==='on'});me=r.user;setFlash(tr('saved'));render();return;}
  if(kind==='password'){await api('POST','/api/auth/password',{currentPassword:f.get('currentPassword'),newPassword:f.get('newPassword')});setFlash(tr('saved'));render();return;}
  if(kind==='codes'){const r=await api('POST','/api/auth/recovery-codes',{currentPassword:f.get('currentPassword')});cache.codes={codes:r.recoveryCodes,next:'#/account/settings'};render();return;}
  if(kind==='review'){await api('POST','/api/reviews/'+encodeURIComponent(form.dataset.id),{decision:btn?.value,comment:f.get('comment'),revision:Number(form.dataset.revision)});setFlash(tr('saved'));render();return;}
  if(kind==='task'){
   const body={completionMode:f.get('completionMode'),pickMode:f.get('pickMode'),type:f.get('type'),scope:f.get('scope'),xp:Number(f.get('xp')),counterTarget:Number(f.get('counterTarget')),repeatRule:f.get('repeatRule'),audience:f.get('audience'),requiresReview:f.get('requiresReview')==='on',dueAt:f.get('dueAt')?new Date(f.get('dueAt')).toISOString():null,translations:Object.fromEntries(['en','hr','ru'].map(l=>[l,{title:f.get('title_'+l),goal:f.get('goal_'+l),instructions:f.get('instructions_'+l),criteria:f.get('criteria_'+l)}])),checklist:String(f.get('checklist')||'').split('\n').map(s=>s.trim()).filter(Boolean).map(line=>({en:'',hr:'',ru:'',[lang]:line})),version:Number(form.dataset.version)};
   // Errors stay on the form so nothing typed is lost.
   const say=msg=>{let p=form.querySelector('.tk-form-error');if(!p){p=document.createElement('p');p.className='acc-flash is-error tk-form-error';p.setAttribute('role','alert');form.querySelector('.tk-save').before(p);}p.textContent=msg;p.scrollIntoView?.({block:'center',behavior:'smooth'});};
   if(!['en','hr','ru'].some(l=>String(body.translations[l].title||'').trim()&&String(body.translations[l].instructions||'').trim())){say(tr('tkNeedOneLang'));const d=form.querySelector(`.tk-lang:has([name=title_${lang}])`)||form.querySelector('.tk-lang');if(d){d.open=true;d.querySelector('input')?.focus();}return;}
   let r;try{r=form.dataset.id?await api('PUT','/api/admin/tasks/'+encodeURIComponent(form.dataset.id),body):await api('POST','/api/admin/tasks',body);}catch(err){if(err.code==='CONFLICT')throw err;say(errText(err).replace(/<[^>]+>/g,''));return;}
   setFlash(tr('saved'));go('#/admin/task/'+r.task.id);return;}
  if(kind==='task-compose'){
   const say=msg=>{let p=form.querySelector('.tk-form-error');if(!p){p=document.createElement('p');p.className='acc-flash is-error tk-form-error';p.setAttribute('role','alert');form.querySelector('.tk-save').before(p);}p.textContent=msg;p.scrollIntoView?.({block:'center',behavior:'smooth'});};
   const l=form.dataset.lang||lang,tl=JSON.parse(form.dataset.tl||'{}'),mode=btn?.value||'publish',edit=!!form.dataset.id;
   const title=String(f.get('title')||'').trim(),instructions=String(f.get('instructions')||'').trim();
   const checklist=String(f.get('checklist')||'').split('\n').map(x=>x.trim()).filter(Boolean),proof=f.getAll('proof');
   const due=f.get('dueAt')?new Date(f.get('dueAt')):null,audience=f.get('audience')||'all_participants',projectIds=f.getAll('projectId');
   if(!title||!instructions){say(tr('tkcNeedText'));form.elements[title?'instructions':'title'].focus();return;}
   if(!proof.length&&!checklist.length){say(tr('tkcNeedProof'));form.querySelector('[name=proof]')?.focus();return;}
   if(due&&due<Date.now()&&!(edit&&form.elements.dueAt.defaultValue===f.get('dueAt'))){say(tr('tkcPastDue'));form.elements.dueAt.focus();return;}
   if(!edit&&mode==='publish'&&audience==='selected'&&!projectIds.length){say(tr('tkcNeedTeams'));form.querySelector('[name=projectId]')?.focus();return;}
   // Other languages the task already has stay as they are; the form writes the one it shows.
   const body={type:checklist.length?'checklist':'attachment',proof,checklist:checklist.map(line=>({en:'',hr:'',ru:'',[l]:line})),scope:f.get('scope')||form.dataset.scope||'team',xp:Number(f.get('xp')||0),dueAt:due?due.toISOString():null,requiresReview:f.get('requiresReview')==='on',
    completionMode:f.get('completionMode'),pickMode:f.get('pickMode'),repeatRule:f.get('repeatRule'),translations:{...tl,[l]:{...(tl[l]||{}),title,instructions}},version:Number(form.dataset.version)};
   if(!edit)Object.assign(body,{audience,projectIds:audience==='selected'?projectIds:[],publish:mode==='publish'});
   let r;try{r=edit?await api('PUT','/api/admin/tasks/'+encodeURIComponent(form.dataset.id),body):await api('POST','/api/admin/tasks',body);}
   catch(err){if(err.code==='CONFLICT')throw err;say(err.detail?.reason==='past'?tr('tkcPastDue'):errText(err).replace(/<[^>]+>/g,''));return;}
   cache.pick=null;
   if(!edit&&mode==='publish'){setFlash(esc(pgPlural('tkcPublished',r.assigned).replace('{n}',r.assigned)));go('#/admin/tasks');return;}
   setFlash(tr('saved'));go('#/admin/task/'+r.task.id);return;}
  if(kind==='decline'){await api('POST',`/api/tasks/${encodeURIComponent(form.dataset.id)}/respond`,{decision:'declined',reason:f.get('reason')});setFlash(tr('taskDeclined'));go('#/account/tasks');return;}
  if(kind==='checkin'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/checkins`,{metricName:f.get('metricName'),metricValue:f.get('metricValue'),goal:f.get('goal'),blocker:f.get('blocker'),needsHelp:f.get('needsHelp')==='on'});setFlash(tr('saved'));render();return;}
  if(kind==='outcome'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/outcomes`,{kind:f.get('kind'),fundingType:f.get('fundingType'),amount:f.get('amount')===''?undefined:Number(f.get('amount')),happenedOn:f.get('happenedOn'),note:f.get('note')});render();return;}
  if(kind==='mark'){const ids=f.getAll('target');const r=await api('POST',`/api/admin/tasks/${encodeURIComponent(form.dataset.id)}/mark`,{[form.dataset.scope==='team'?'projectIds':'userIds']:ids,note:f.get('note')});setFlash(`${tr('markDone')}: ${r.marked}`);render();return;}
  if(kind==='bulk-verify'){const r=await api('POST','/api/admin/attendance/bulk',{lectureId:f.get('lectureId'),userIds:f.getAll('userId')});setFlash(`${tr('verify')}: ${r.changed}`);render();return;}
  if(kind==='import'){const file=f.get('file');const csv=file?.size?await file.text():f.get('csv');const body={kind:f.get('kind'),csv,lectureId:f.get('lectureId')||null,taskId:f.get('taskId')};
   if(btn?.value==='apply'){const r=await api('POST','/api/admin/import/apply',body);cache.importPreview=null;setFlash(`${tr('apply')}: ${r.applied}/${r.total}`);render();return;}
   const r=await api('POST','/api/admin/import/preview',body);cache.importPreview={...body,...r};render();return;}
  if(kind==='hook'){const r=await api('POST','/api/admin/form-hooks',{kind:f.get('kind'),lectureId:f.get('lectureId'),taskId:f.get('taskId'),label:f.get('label')});cache.hookSecret=r.secret;render();return;}
  if(kind==='nudge'){let sent=0;const teams=f.getAll('teamId');
   for(const projectId of teams)sent+=(await api('POST','/api/admin/nudge',{message:f.get('message'),userIds:[],projectId})).sent;
   if(!teams.length)sent=(await api('POST','/api/admin/nudge',{message:f.get('message'),userIds:f.getAll('userId'),projectId:f.get('projectId')||null})).sent;
   setFlash(`${tr('nudgeSent')}: ${sent}`);render();return;}
  if(kind==='task-send'){const userIds=f.getAll('userId'),projectIds=f.getAll('projectId'),q=new URLSearchParams();userIds.forEach(x=>q.append('userId',x));projectIds.forEach(x=>q.append('projectId',x));
   cache.preview={id:form.dataset.id,userIds,projectIds,...await api('GET',`/api/admin/tasks/${encodeURIComponent(form.dataset.id)}/preview?${q}`)};cache.pick={user:userIds,team:projectIds};render();return;}
  if(kind==='nudge-open'){const r=await api('POST',`/api/admin/tasks/${encodeURIComponent(form.dataset.id)}/nudge-open`,{message:f.get('message')});setFlash(`${tr('nudgeSent')}: ${r.sent}`);render();return;}
  if(kind==='revoke'){await api('POST',`/api/admin/submissions/${encodeURIComponent(form.dataset.id)}/revoke`,{comment:f.get('comment')});setFlash(tr('saved'));render();return;}
  if(kind==='xp'){await api('POST','/api/admin/xp',{type:form.dataset.type,id:form.dataset.id,amount:Number(f.get('amount')),reason:f.get('reason')});setFlash(tr('saved'));render();return;}
  if(kind==='organiser-note'){await api('POST','/api/admin/notes',{type:form.dataset.type,id:form.dataset.id,body:f.get('body')});render();return;}
  if(kind==='set-team'){await api('PUT',`/api/admin/users/${encodeURIComponent(form.dataset.id)}/team`,{projectId:f.get('projectId')||null});setFlash(tr('saved'));render();return;}
  if(kind==='mentor'){const body={name:f.get('name'),area:f.get('area'),bio:f.get('bio'),link:f.get('link')},mid=form.dataset.id;await (mid?api('PUT','/api/admin/mentors/'+encodeURIComponent(mid),body):api('POST','/api/admin/mentors',body));setFlash(tr('saved'));render();return;}
  if(kind==='slot'){await api('POST','/api/admin/office-hours',{mentorId:f.get('mentorId')||null,mentorName:f.get('mentorName'),topic:f.get('topic'),startsAt:new Date(f.get('startsAt')).toISOString(),durationMin:Number(f.get('durationMin')),price:Number(f.get('price')??30),location:f.get('location')});setFlash(tr('saved'));render();return;}
  if(kind==='meet-arrange'){await api('POST','/api/admin/meeting-requests/'+encodeURIComponent(form.dataset.id),{status:'arranged',mentorId:f.get('mentorId')||null,mentorName:f.get('mentorName'),startsAt:new Date(f.get('startsAt')).toISOString(),durationMin:Number(f.get('durationMin')),location:f.get('location')});setFlash(tr('saved'));render();return;}
  if(kind==='meet-ask'){await api('POST','/api/meeting-requests',{projectId:f.get('projectId'),mentorId:f.get('mentorId')||null,topic:f.get('topic'),times:f.get('times')});setFlash(tr('meetSent'));render();return;}
  if(kind==='book'){await api('POST',`/api/office-hours/${encodeURIComponent(form.dataset.id)}/book`,{projectId:f.get('projectId'),question:f.get('question')});setFlash(tr('saved'));render();return;}
  if(kind==='meeting-note'){await api('POST',`/api/office-hours/${encodeURIComponent(form.dataset.id)}/note`,{note:f.get('note')});setFlash(tr('saved'));render();return;}
  if(kind==='quest'){await api('POST','/api/admin/quests',{title:{en:f.get('qt_en'),hr:f.get('qt_hr'),ru:f.get('qt_ru')},taskId:f.get('taskId'),target:Number(f.get('target'))});setFlash(tr('saved'));render();return;}
  if(kind==='reward'){const id=form.dataset.id;await api(id?'PUT':'POST','/api/admin/rewards'+(id?'/'+encodeURIComponent(id):''),{title:f.get('title'),description:f.get('description'),price:Number(f.get('price')),stock:f.get('stock')===''?null:Number(f.get('stock'))});setFlash(tr('saved'));render();return;}
  if(kind==='reward-order'){await api('POST',`/api/rewards/${encodeURIComponent(form.dataset.id)}/order`,{projectId:f.get('projectId'),note:f.get('note')});setFlash(tr('rewardOrdered'));render();return;}
  if(kind==='dm-find'){cache.dmQuery=String(f.get('q')||'').trim();render();return;}
  if(kind==='group-new'){const r=await api('POST','/api/messages/groups',{title:f.get('title'),userIds:[...cache.groupPick.keys()]});cache.groupPick=null;cache.dmQuery='';go('#/account/messages/g/'+r.id);return;}
  if(kind==='group-rename'){await api('PUT','/api/messages/groups/'+encodeURIComponent(form.dataset.id),{title:f.get('title')});setFlash(tr('saved'));render();return;}
  if(kind==='group-find'){cache.groupQuery=String(f.get('q')||'').trim();render();return;}
  if(kind==='reminders'){await api('PUT','/api/admin/reminders',{enabled:btn?.value==='1'});setFlash(tr('saved'));render();return;}
  if(kind==='chat-hook'){await api('PUT','/api/admin/chat-hook',{url:f.get('url')});setFlash(tr('saved'));render();return;}
  if(kind==='announcement'){await api('POST','/api/admin/announcements',{title:f.get('title'),body:f.get('body'),pinned:f.get('pinned')==='on',toChat:f.get('toChat')==='on'});setFlash(tr('saved'));render();return;}
  if(kind==='feedback'){await api('POST',`/api/lectures/${encodeURIComponent(form.dataset.id)}/feedback`,{score:Number(f.get('score')),comment:f.get('comment')});setFlash(tr('feedbackThanks'));render();return;}
  if(kind==='lecture'){const body={date:f.get('date'),time:f.get('time'),place:f.get('place'),speaker:f.get('speaker'),status:f.get('status')||'published',title:{en:f.get('title_en'),hr:f.get('title_hr'),ru:f.get('title_ru')}},lid=form.dataset.id;await (lid?api('PUT','/api/admin/lectures/'+encodeURIComponent(lid),body):api('POST','/api/admin/lectures',body));setFlash(tr('saved'));if(lid)go('#/admin/lectures');else render();return;}
 });
 delete form.dataset.busy;[...form.querySelectorAll('button')].forEach(b=>b.disabled=false);
}

async function onClick(e){
 // A person or a team anywhere on these pages opens the people sheet (people-sheet.js): characters full height and the card.
 const who=e.target.closest('[data-sheet]');
 if(who&&root.contains(who)&&window.BirdSheet){e.preventDefault();window.BirdSheet.language(lang);const go=()=>window.BirdSheet.open({kind:who.dataset.sheet,id:who.dataset.id});if(who.classList.contains('cs-char')&&!window.BirdMotion?.reduced())setTimeout(go,380);else go();return;}
 const el=e.target.closest('[data-act]');if(!el||!root.contains(el)||el.tagName==='SELECT')return;
 const d=el.dataset,act=d.act;
 if(act==='copy'){e.preventDefault();const input=el.parentElement.querySelector('input');try{await navigator.clipboard.writeText(input.value);el.textContent=tr('copied');}catch{input.focus();input.select();}return;}
 if(act==='admin-edit'){cache.adminEdit=d.on?d.id:null;render();return;}
 if(act==='toggle-password'){e.preventDefault();const input=el.previousElementSibling,show=input.type==='password';input.type=show?'text':'password';el.textContent=tr(show?'hidePassword':'showPassword');el.setAttribute('aria-pressed',String(show));input.focus();return;}
 if(act==='count'){const form=el.closest('form'),input=form.elements.count,max=Number(form.closest('.acc-task')?.querySelector('.acc-counter')?.textContent.match(/\/\s*(\d+)/)?.[1]||100);input.value=Math.max(0,Math.min(max,Number(input.value)+Number(d.d)));form.elements.countOut.value=input.value;const cb=form.querySelector('.m-counter-bar');if(cb){const pc=Math.round(input.value/max*100);cb.style.setProperty('--p',pc+'%');cb.setAttribute('aria-valuenow',pc);}return;}
 if(act==='office-me')return;
 if(act==='letter-fill'){fillFromLetter();return;}
 if(act==='points-help'){root.querySelector('#acc-points')?.showModal?.();return;}
 if(act==='points-close'){root.querySelector('#acc-points')?.close?.();return;}
 if(d.confirm&&!window.confirm(d.confirm))return;
 if(act==='codes-done'){cache.codes=null;go(d.next||'#/account');return;}
 if(act==='codes-ok'){cache.codesNotice=null;render();return;}
 e.preventDefault();
 if(el.dataset.busy)return;el.dataset.busy='1';el.disabled=true;
 await run(async()=>{
  if(act==='answer-draft'){const form=el.closest('form');await uploadInto(form);await api('PUT',`/api/tasks/${encodeURIComponent(form.dataset.id)}/draft`,{content:answerContent(form,form.dataset.type)});setFlash(tr('saved'));render();}
  else if(act==='preview'){const form=el.closest('form');const c=readProjectForm(form);let box=root.querySelector('.acc-preview-box');if(!box){box=document.createElement('div');box.className='acc-preview-box acc-card';form.after(box);}box.innerHTML=previewHtml(c);box.scrollIntoView({block:'nearest'});}
  else if(act==='publish'){await api('POST',`/api/projects/${encodeURIComponent(d.id)}/publish`,{version:Number(d.version)});setFlash(tr('st_published'));render();}
  else if(act==='archive'||act==='unarchive'){await api('POST',`/api/projects/${encodeURIComponent(d.id)}/${act}`,{});render();}
  else if(act==='restore'){await api('POST',`/api/projects/${encodeURIComponent(d.project)}/revisions/${d.id}/restore`,{});go(`#/account/project/${d.project}/edit`);}
  else if(act==='file-delete'){await api('DELETE','/api/files/'+encodeURIComponent(d.id));render();}
  else if(act==='member-remove'){await api('PUT',`/api/projects/${encodeURIComponent(d.project)}/members/${encodeURIComponent(d.user)}`,{remove:true});render();}
  else if(act==='invite-revoke'){await api('DELETE','/api/invites/'+encodeURIComponent(d.id));render();}
  else if(act==='help'){await api('POST','/api/help/confirmations/'+encodeURIComponent(d.id),{decision:d.decision});render();}
  else if(act==='help-close'){await api('DELETE','/api/help/'+encodeURIComponent(d.id));render();}
  else if(act==='milestone-done'){await api('POST',`/api/projects/${encodeURIComponent(d.project)}/milestones/${encodeURIComponent(d.id)}/done`,{});render();}
  else if(act==='order-decide'){await api('POST','/api/admin/reward-orders/'+encodeURIComponent(d.id),{status:d.status});render();}
  else if(act==='reward-archive'){await api('DELETE','/api/admin/rewards/'+encodeURIComponent(d.id));render();}
  else if(act==='reward-restore'){await api('POST',`/api/admin/rewards/${encodeURIComponent(d.id)}/restore`);render();}
  else if(act==='team-chat'){const r=await api('POST','/api/messages/team/'+encodeURIComponent(d.id));go('#/account/messages/g/'+r.id);}
  else if(act==='group-pick'){cache.groupPick.set(d.id,d.name);render();}
  else if(act==='group-unpick'){cache.groupPick.delete(d.id);render();}
  else if(act==='group-add'){await api('POST',`/api/messages/groups/${encodeURIComponent(d.id)}/members`,{userIds:[d.user]});render();}
  else if(act==='group-leave'){await api('DELETE',`/api/messages/groups/${encodeURIComponent(d.id)}/members/${encodeURIComponent(d.user)}`);if(d.user===me.id)go('#/account/messages');else render();}
  else if(act==='dm-resolve'){await api('POST',`/api/admin/message-reports/${encodeURIComponent(d.id)}/resolve`);render();}
  else if(act==='read'){await api('POST','/api/notifications/read',{});cache.unread=0;render();}
  else if(act==='session'){await api('DELETE','/api/auth/sessions/'+encodeURIComponent(d.id));await loadMe();render();}
  else if(act==='logout'||act==='logout-all'){await api('POST','/api/auth/'+act,{});me=null;csrf='';announce();go('#/account/login');}
  else if(act==='claim'){await api('POST','/api/admin/claims/'+encodeURIComponent(d.id),{decision:d.decision});render();}
  else if(act==='task-status'){await api('POST',`/api/admin/tasks/${encodeURIComponent(d.id)}/status`,{status:d.status});render();}
  else if(act==='task-assign'){if(d.draft)await api('POST',`/api/admin/tasks/${encodeURIComponent(d.id)}/status`,{status:'published'});const {period,userIds,projectIds}=cache.preview;const r=await api('POST',`/api/admin/tasks/${encodeURIComponent(d.id)}/assign`,{period,userIds,projectIds},{key:d.key});cache.preview=null;cache.pick=null;setFlash(`${tr('assign')}: ${r.created}`);render();}
  else if(act==='verify'){await api('POST','/api/admin/attendance',{userId:d.user,lectureId:d.lecture});render();}
  else if(act==='att-remove'){await api('POST','/api/admin/attendance/remove',{userId:d.user,lectureId:d.lecture});render();}
  else if(act==='att-toggle'){if(d.kind==='verified_by_admin'){if(window.confirm(tr('confirmRemoveMark'))){await api('POST','/api/admin/attendance/remove',{userId:d.user,lectureId:d.lecture});render();}}else{await api('POST','/api/admin/attendance',{userId:d.user,lectureId:d.lecture});render();}}
  else if(act==='team-filter'){cache.teamFilter=d.view;render();}
  else if(act==='stage-filter-clear'){cache.stageFilter=null;render();}
  else if(act==='tk-filter'){cache.tkFilter=cache.tkFilter===d.view&&d.view!=='all'?'all':d.view;cache.tkQuiet=true;cache.refocus=`[data-act="tk-filter"][data-view="${cache.tkFilter}"]`;render();}
  else if(act==='dash-filter'){cache.dashFilter=cache.dashFilter===d.view&&d.view!=='all'?'all':d.view;cache.refocus=`[data-act="dash-filter"][data-view="${cache.dashFilter}"]`;render();}
  else if(act==='dash-sort'){cache.dashSort=d.sort;cache.refocus=`.dash-sort [data-sort="${d.sort}"]`;render();}
  else if(act==='dash-refresh'){cache.refocus='[data-act="dash-refresh"]';cache.lastHash=null;render();}
  else if(act==='reset-code'){const r=await api('POST',`/api/admin/users/${encodeURIComponent(d.id)}/reset-code`,{});cache.resetCode=r.code;render();}
  else if(act==='user-status'){await api('PUT',`/api/admin/users/${encodeURIComponent(d.id)}/status`,{status:d.status});render();}
  else if(act==='accept-task'){await api('POST',`/api/tasks/${encodeURIComponent(d.id)}/respond`,{decision:'accepted'});setFlash(tr('taskAccepted'));render();}
  else if(act==='reopen'){await api('POST',`/api/admin/assignments/${encodeURIComponent(d.id)}/reopen`,{});setFlash(tr('reopenDone'));render();}
  else if(act==='manager-pick'){go('#/account/messages/'+encodeURIComponent(d.id));}
  else if(act==='write-manager'){const m=(await api('GET','/api/messages/managers')).items;
   // One manager: straight to the conversation. Several: a short chooser right under the button.
   if(m.length===1){go('#/account/messages/'+encodeURIComponent(m[0].id));}
   else{const box=el.parentElement.querySelector('.m-managers')||el.insertAdjacentElement('afterend',document.createElement('div'));box.className='m-managers';box.setAttribute('role','group');
    box.innerHTML=m.length?`<p>${tr('writeManagerPick')}</p><ul>${m.map(x=>`<li><a class="acc-secondary" href="#/account/messages/${esc(x.id)}">${I('chat')} ${esc(x.name)}</a></li>`).join('')}</ul>`:`<p class="acc-muted">${tr('writeManagerNone')}</p>`;box.querySelector('a')?.focus();}}
  else if(act==='manager-flag'){await api('PUT',`/api/admin/users/${encodeURIComponent(d.id)}/manager`,{on:d.on==='1'});render();}
  else if(act==='fs-hide'){try{localStorage.setItem('bird-first-steps:'+me.id,'hidden');}catch{}render();}
  else if(act==='take'){const r=await api('POST',`/api/catalog/${encodeURIComponent(d.id)}/take`,d.project?{projectId:d.project}:{});go('#/account/task/'+r.assignmentId);}
  else if(act==='meet-decline'){await api('POST','/api/admin/meeting-requests/'+encodeURIComponent(d.id),{status:'declined'});render();}
  else if(act==='meet-withdraw'){await api('DELETE','/api/meeting-requests/'+encodeURIComponent(d.id));render();}
  else if(act==='unbook'){await api('DELETE',`/api/office-hours/${encodeURIComponent(d.id)}/book`);render();}
  else if(act==='pick-idle'){root.querySelectorAll('input[data-idle="1"]').forEach(x=>x.checked=true);}
  else if(act==='mentor-archive'){await api('DELETE','/api/admin/mentors/'+encodeURIComponent(d.id));render();}
  else if(act==='slot-cancel'){await api('DELETE','/api/admin/office-hours/'+encodeURIComponent(d.id));render();}
  else if(act==='quest-close'){await api('DELETE','/api/admin/quests/'+encodeURIComponent(d.id));render();}
  else if(act==='digest-send'){await api('POST','/api/admin/digest/send',{});setFlash(tr('digestSent'));render();}
  else if(act==='news-read'){await api('POST','/api/announcements/read',{});render();}
  else if(act==='news-archive'){await api('DELETE','/api/admin/announcements/'+encodeURIComponent(d.id));render();}
  else if(act==='hook-revoke'){await api('DELETE','/api/admin/form-hooks/'+encodeURIComponent(d.id));render();}
  else if(act==='outcome-delete'){await api('DELETE',`/api/projects/${encodeURIComponent(d.project)}/outcomes/${encodeURIComponent(d.id)}`);render();}
  else if(act==='inv-approve'||act==='inv-reject'){await api('POST','/api/admin/investors/'+encodeURIComponent(d.id),{approve:act==='inv-approve'});render();}
  else if(act==='lead-delete'){await api('DELETE','/api/admin/pilot-requests/'+encodeURIComponent(d.id));render();}
  else if(act==='admin-invite'){const r=await api('POST','/api/invites',{kind:'program_admin'});cache.newInvite=r.code;render();}
 });
 delete el.dataset.busy;el.disabled=false;
}
function onInput(e){
 const list=e.target.closest('.m-checklist');if(list){const all=[...list.querySelectorAll('[name=checked]')],d=all.filter(x=>x.checked).length,pc=all.length?Math.round(d/all.length*100):0,b=list.querySelector('.m-check-bar');list.querySelector('.m-check-n').textContent=d;if(b){b.style.setProperty('--p',pc+'%');b.setAttribute('aria-valuenow',pc);}}
 const box=e.target.closest('.acc-date');if(box)box.classList.toggle('is-empty',!e.target.value);
 const el=e.target.closest('[data-filter="people"]');if(!el)return;
 const q=el.value.trim().toLowerCase();root.querySelectorAll('tr[data-search]').forEach(r=>{r.hidden=!!q&&!r.dataset.search.includes(q);});
}
async function onChange(e){
 const el=e.target.closest('select[data-act]');if(!el||!root.contains(el))return;
 if(el.dataset.act==='tk-template'){tkTemplate(el);return;}
 await run(async()=>{
  if(el.dataset.act==='visibility')await api('PATCH','/api/files/'+encodeURIComponent(el.dataset.id),{visibility:el.value});
  if(el.dataset.act==='member-role')await api('PUT',`/api/projects/${encodeURIComponent(el.dataset.project)}/members/${encodeURIComponent(el.dataset.user)}`,{role:el.value});
  if(el.dataset.act==='user-role'){if(!window.confirm(tr('confirmRole'))){el.value=el.dataset.current;return;}await api('PUT',`/api/admin/users/${encodeURIComponent(el.dataset.id)}/role`,{role:el.value});}
  setFlash(tr('saved'));render();
 });
}

window.BirdAccount={
 isRoute,
 title:()=>tr(parts()[0]==='admin'?'admin':'nav'),
 navLabel:language=>{if(language)lang=language;return me?tr('nav'):tr('signIn');},
 isSignedIn:()=>!!me,
 mount(el,language){
  root?.removeEventListener('submit',onSubmit);root?.removeEventListener('click',onClick);root?.removeEventListener('change',onChange);root?.removeEventListener('change',onInput);root?.removeEventListener('input',onInput);
  root=el;lang=language;if(cache.codes&&!location.hash.startsWith('#/account'))cache.codes=null;
  root.addEventListener('submit',onSubmit);root.addEventListener('click',onClick);root.addEventListener('change',onChange);root.addEventListener('change',onInput);root.addEventListener('input',onInput);
  root.innerHTML=`<p class="acc-muted">${tr('loading')}</p>`;render();
 },
 async refresh(){await loadMe();},
 codesShown(){cache.codes=null;},
};
loadMe();
})();
