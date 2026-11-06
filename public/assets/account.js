/* Accounts, project cabinet, tasks and admin. Plain HTML forms; the server checks every permission. */
(()=>{'use strict';
const T=window.BIRD_ACCOUNT_TEXT;
let lang='en',root=null,me,csrf='',flash=null,cache={},renderToken=0;
const tr=k=>T[k]?.[lang]??T[k]?.en??k;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc={en:'en-GB',hr:'hr-HR',ru:'ru-RU'};
const date=(iso,time=false)=>iso?new Intl.DateTimeFormat(loc[lang],{day:'numeric',month:'short',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit'}:{}),timeZone:'Europe/Zagreb'}).format(new Date(iso.length===10?iso+'T12:00:00Z':iso)):'';
const size=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const pick=o=>o?.[lang]||o?.en||'';
const seen=iso=>iso?`${tr('lastSeen')}: ${date(iso,true)}`:tr('neverSeen');
const idle=iso=>!iso||Date.now()-Date.parse(iso)>7*86400000;
// Authored task text falls back to English with a visible language marker.
const authored=(t,field)=>{const own=t?.[lang]?.[field];if(own)return esc(own);const en=t?.en?.[field];return en?`<span lang="en">${esc(en)}</span>${lang!=='en'?' <small class="acc-lang">EN</small>':''}`:'';};
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
const errText=e=>tr('e_'+(e?.code||'SERVER_ERROR'))+(e?.detail?.field?` (${esc(e.detail.field)})`:'');
async function loadMe(){try{const r=await api('GET','/api/auth/me');me=r.user;csrf=r.csrf||'';cache.unread=r.unread||0;}catch{me=null;}updateNav();}
function updateNav(){document.querySelectorAll('.nav-account').forEach(a=>{a.textContent=me?tr('nav'):tr('signIn');});}

function parts(){return location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);}
function isRoute(){return ['account','admin'].includes(parts()[0]);}
const go=h=>{if(location.hash===h)render();else location.hash=h;};

// Layout -------------------------------------------------------------------------
function shell(active,body){
 const tabs=active==='admin'?[['#/account','← '+tr('nav'),'account'],['#/admin',tr('admin'),'admin']]:[['#/account',tr('overview'),'overview'],['#/account/tasks',tr('tasks'),'tasks'],['#/account/mentors',tr('mentors'),'mentors'],['#/account/progress',tr('progress'),'progress'],['#/account/character',tr('character'),'character'],['#/account/settings',tr('settings'),'settings'],...(isAdmin()?[['#/admin',tr('admin'),'admin']]:[])];
 return `<div class="acc"><div class="acc-head"><div><span class="eyebrow">${esc(tr('urole_'+me.role))}</span><h1>${esc(me.displayName)}</h1></div><a class="acc-office" href="#/office">${tr('office')} ↗</a></div><nav class="acc-tabs" aria-label="${tr('nav')}">${tabs.map(([h,l,k])=>`<a href="${h}" ${k===active?'aria-current="page"':''}>${esc(l)}${k==='overview'&&cache.unread?` <b class="acc-dot">${cache.unread}</b>`:''}</a>`).join('')}</nav>${flashHtml()}<div class="acc-body">${body}</div><p class="acc-small">${tr('unofficial')}</p></div>`;
}
function flashHtml(){if(!flash)return '';const f=flash;flash=null;return `<p class="acc-flash ${f.error?'is-error':''}" role="${f.error?'alert':'status'}">${f.html}</p>`;}
const field=(name,label,{type='text',value='',hint='',required=false,attrs=''}={})=>`<label class="acc-field"><span>${esc(label)}</span>${type==='textarea'?`<textarea name="${name}" ${required?'required':''} ${attrs}>${esc(value)}</textarea>`:type==='password'?`<span class="acc-pass"><input name="${name}" type="password" value="${esc(value)}" ${required?'required':''} ${attrs}><button type="button" class="acc-pass-toggle" data-act="toggle-password" aria-pressed="false">${tr('showPassword')}</button></span>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${attrs}>`}${hint?`<small>${esc(hint)}</small>`:''}</label>`;
const select=(name,label,options,value)=>`<label class="acc-field"><span>${esc(label)}</span><select name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
const statusChip=s=>`<span class="acc-chip is-${esc(s)}">${esc(tr('st_'+s))}</span>`;
const empty=()=>`<p class="acc-muted">${tr('none')}</p>`;

// Signed-out ------------------------------------------------------------------------
function authView(mode){
 const tabs=`<div class="acc-switch">${[['login',tr('signIn')],['register',tr('createAccount')],['recover',tr('recover')]].map(([m,l])=>`<a href="#/account/${m==='login'?'':m}" ${m===mode?'aria-current="page"':''}>${esc(l)}</a>`).join('')}</div>`;
 const form=mode==='register'?`<form data-form="register">${field('login',tr('login'),{required:true,hint:tr('loginHint'),attrs:'autocomplete="username" maxlength="60" autocapitalize="none"'})}${field('password',tr('password'),{type:'password',required:true,hint:tr('passwordHint'),attrs:'autocomplete="new-password" minlength="10" maxlength="200"'})}${field('displayName',tr('displayName'),{required:true,attrs:'maxlength="80"'})}${field('email',tr('email'),{type:'email',hint:tr('emailNote'),attrs:'autocomplete="email" maxlength="200"'})}${field('invite',tr('inviteCodeOptional'),{attrs:'maxlength="100" autocomplete="off"'})}<button class="acc-primary">${tr('createAccount')}</button></form>`
 :mode==='recover'?`<form data-form="recover"><p class="acc-muted">${tr('noEmail')}</p>${field('login',tr('login'),{required:true,attrs:'autocomplete="username" autocapitalize="none"'})}${field('code',tr('recoveryCode'),{required:true,attrs:'autocomplete="off"'})}${field('newPassword',tr('newPassword'),{type:'password',required:true,hint:tr('passwordHint'),attrs:'autocomplete="new-password" minlength="10"'})}<button class="acc-primary">${tr('recover')}</button></form>`
 :`<form data-form="login">${field('login',tr('login'),{required:true,attrs:'autocomplete="username" autocapitalize="none"'})}${field('password',tr('password'),{type:'password',required:true,attrs:'autocomplete="current-password"'})}<button class="acc-primary">${tr('signIn')}</button></form>`;
 return `<div class="acc acc-auth"><h1>${tr(mode==='register'?'createAccount':mode==='recover'?'recover':'signIn')}</h1>${tabs}${flashHtml()}${form}<p class="acc-small">${tr('unofficial')}</p></div>`;
}
function codesView(codes,next){return `<div class="acc acc-auth"><h1>${tr('codesTitle')}</h1><p>${tr('codesText')}</p><ol class="acc-codes">${codes.map(c=>`<li><code>${esc(c)}</code></li>`).join('')}</ol><button class="acc-primary" data-act="codes-done" data-next="${esc(next)}">${tr('codesDone')}</button></div>`;}

// Account pages --------------------------------------------------------------------------
// Public ranking: the top three and the neighbours of your own team, nobody is shown as last.
function rankRows(items,mine){
 const show=new Set([0,1,2]);
 items.forEach((t,i)=>{if(mine.has(t.projectId))[i-1,i,i+1].forEach(x=>{if(x>=0&&x<items.length)show.add(x);});});
 const rows=[];let last=-1;
 [...show].sort((a,b)=>a-b).forEach(i=>{if(i>=items.length)return;if(i>last+1)rows.push({gap:true});rows.push({...items[i],place:i+1});last=i;});
 return rows;
}
async function overviewView(){
 const [projects,tasks,notes,claims,help,news]=await Promise.all([api('GET','/api/projects?mine=1'),api('GET','/api/tasks'),api('GET','/api/notifications?limit=8'),api('GET','/api/people/claims'),api('GET','/api/help/confirmations'),api('GET','/api/announcements'),]);
 const quests=await api('GET','/api/quests').catch(()=>({items:[]}));
 const due=await api('GET','/api/feedback/due').catch(()=>({items:[]}));
 const teamProjects=projects.items.filter(p=>['owner','editor','member'].includes(p.role)&&p.status!=='archived');
 const checks=await Promise.all(teamProjects.map(p=>api('GET',`/api/projects/${encodeURIComponent(p.id)}/checkins`).then(r=>({p,r})).catch(()=>null)));
 const missing=checks.filter(c=>c&&!c.r.items.some(i=>i.week===c.r.week));
 const unreadNews=news.items.filter(n=>!n.read);
 const character=await api('GET','/api/me/character');
 const open=tasks.items.filter(t=>['not_started','draft','changes_requested'].includes(t.status)&&t.task.status==='published');
 const claimBlock=character.person?.confirmed?'':await claimForm(claims.items);
 return shell('overview',`${due.items.slice(0,1).map(l=>`<section class="acc-card acc-feedback"><h2>${tr('feedbackTitle')}</h2><p class="acc-muted">${esc(pick(l.title))} · ${date(l.date)}</p><form data-form="feedback" data-id="${esc(l.id)}"><fieldset class="acc-field"><legend>${tr('feedbackScore')}</legend><div class="acc-scale">${Array.from({length:10},(_,i)=>`<label><input type="radio" name="score" value="${i+1}" required><span>${i+1}</span></label>`).join('')}</div></fieldset>${field('comment',tr('feedbackComment'),{type:'textarea',attrs:'rows="2" maxlength="1000"'})}<button class="acc-secondary">${tr('send')}</button><small class="acc-muted">${tr('feedbackAnon')}</small></form></section>`).join('')}${quests.items.map(q=>`<section class="acc-card acc-quest"><div class="acc-card-head"><h2>${tr('quest')}: ${esc(pick(q.title))}</h2><b>${q.done}/${q.target}</b></div><div class="acc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${q.target}" aria-valuenow="${q.done}"><span style="width:${Math.round(q.done/q.target*100)}%"></span></div><small class="acc-muted">${q.complete?tr('questDone'):tr('questNote')}</small></section>`).join('')}${news.items.length?`<section class="acc-card acc-news ${unreadNews.length?'is-unread':''}"><div class="acc-card-head"><h2>${tr('announcements')}</h2>${unreadNews.length?`<button data-act="news-read">${tr('markRead')}</button>`:''}</div><ul class="acc-list">${news.items.slice(0,3).map(n=>`<li><div><strong>${n.pinned?'📌 ':''}${esc(n.title)}</strong><p class="acc-pre">${esc(n.body)}</p><small>${esc(n.author)} · ${date(n.created,true)}</small></div></li>`).join('')}</ul></section>`:''}${missing.map(c=>`<p class="acc-flash acc-reminder"><a href="#/account/project/${esc(c.p.id)}/checkin">${tr('checkinMissing')}: <strong>${esc(c.p.name)}</strong> →</a></p>`).join('')}<div class="acc-grid">
 <section class="acc-card"><div class="acc-card-head"><h2>${tr('myProjects')}</h2><a class="acc-secondary" href="#/account/new-project">+ ${tr('newProject')}</a></div>${projects.items.length?`<ul class="acc-list">${projects.items.map(p=>`<li><a href="#/account/project/${esc(p.id)}"><strong>${esc(p.name)}</strong><small>${esc(tr('role_'+p.role))} · ${esc(tr('st_'+p.status))}</small></a></li>`).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><div class="acc-card-head"><h2>${tr('tasks')}</h2><a href="#/account/tasks">${tr('open')} →</a></div>${open.length?`<ul class="acc-list">${open.slice(0,6).map(taskRow).join('')}</ul>`:empty()}</section>
 ${help.items.length?`<section class="acc-card"><h2>${tr('helpRequests')}</h2><ul class="acc-list">${help.items.map(h=>`<li><div><strong>${esc(h.helperName)}</strong><small>${esc(h.note)}</small></div><span class="acc-actions"><button data-act="help" data-id="${esc(h.id)}" data-decision="confirmed" class="acc-secondary">${tr('confirmHelp')}</button><button data-act="help" data-id="${esc(h.id)}" data-decision="declined">${tr('decline')}</button></span></li>`).join('')}</ul></section>`:''}
 <section class="acc-card"><div class="acc-card-head"><h2>${tr('notifications')}</h2>${notes.unread?`<button data-act="read">${tr('markRead')}</button>`:''}</div>${notes.items.length?`<ul class="acc-list">${notes.items.map(n=>`<li class="${n.read?'':'is-unread'}"><span>${n.kind==='nudge'?`<strong>${esc(n.payload.from)}:</strong> ${esc(n.payload.message)}`:esc(tr('n_'+n.kind.replace('.','_')))}</span><small>${date(n.created,true)}</small></li>`).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><h2>${tr('acceptInvite')}</h2><form data-form="invite" class="acc-inline">${field('code',tr('inviteCode'),{required:true,attrs:'autocomplete="off" maxlength="100"'})}<button class="acc-secondary">${tr('acceptInvite')}</button></form></section>
 ${claimBlock}</div>`);
}
async function claimForm(claims){
 const people=(await api('GET','/api/people?limit=100')).items.filter(p=>p.kind==='participant');
 const pending=claims.filter(c=>c.status==='pending');
 return `<section class="acc-card"><h2>${tr('claimTitle')}</h2><p class="acc-muted">${tr('claimText')}</p>${pending.length?`<ul class="acc-list">${pending.map(c=>`<li><span>${esc(c.personName)}</span>${statusChip('pending')}</li>`).join('')}</ul>`:`<form data-form="claim">${select('personId',tr('character'),people.map(p=>[p.id,p.displayName]),'')}${field('message',tr('claimMessage'),{type:'textarea',attrs:'maxlength="500" rows="2"'})}<button class="acc-secondary">${tr('claimSend')}</button></form>`}</section>`;
}
const lectureFields=(x={})=>`<div class="acc-inline">${field('date',tr('lectureDate'),{type:'date',required:true,value:x.date})}${field('time',tr('lectureTime'),{type:'time',value:x.time})}${field('place',tr('location'),{value:x.place,attrs:'maxlength="160"'})}</div>${field('speaker',tr('speaker'),{value:x.speaker,attrs:'maxlength="120"'})}${['en','hr','ru'].map(l=>field('title_'+l,tr('title')+' '+l.toUpperCase(),{value:x.title?.[l],required:l==='en',attrs:'maxlength="200"'})).join('')}`;
const taskRow=t=>`<li><a href="#/account/task/${esc(t.id)}"><strong>${authored(t.task.translations,'title')}</strong><small>${esc(tr(t.task.scope==='team'?'team':'personal'))}${t.projectName?' · '+esc(t.projectName):''}${t.period?' · '+tr('week')+' '+esc(t.period.split('-W')[1]):''} · ${t.task.xp} ${tr('xp')}${t.task.dueAt?' · '+tr('due')+' '+date(t.task.dueAt):''}</small></a>${statusChip(t.status)}</li>`;

async function tasksView(){
 const [tasks,cat]=await Promise.all([api('GET','/api/tasks'),api('GET','/api/catalog')]);
 const catalog=cat.items.length?`<section class="acc-card acc-catalog"><h2>${tr('catalog')}</h2><p class="acc-muted">${tr('catalogNote')}</p><ul class="acc-list">${cat.items.map(t=>{const free=t.scope==='team'?t.projects.filter(p=>!t.taken.some(x=>x.projectId===p.id)):(t.taken.length?[]:[null]);return `<li><div><strong>${authored(t.translations,'title')}</strong><small>${esc(tr(t.scope==='team'?'team':'personal'))} · ${t.xp} ${tr('xp')} · ${authored(t.translations,'goal')}</small></div><span class="acc-actions">${t.taken.map(x=>`<a class="acc-chip is-accepted" href="#/account/task/${esc(x.assignmentId)}">${tr('taken')}</a>`).join('')}${free.map(p=>`<button class="acc-secondary" data-act="take" data-id="${esc(t.id)}" data-project="${esc(p?.id||'')}">${tr('take')}${p?' · '+esc(p.name):''}</button>`).join('')}</span></li>`;}).join('')}</ul></section>`:'';
 const groups=[['changes_requested'],['not_started','draft'],['submitted'],['accepted','rejected']];
 return shell('tasks',`<p class="acc-note">${tr('voluntary')}</p>${catalog}${groups.map(g=>{const items=tasks.items.filter(t=>g.includes(t.status));return items.length?`<section class="acc-card"><h2>${esc(tr('st_'+g[0]))}</h2><ul class="acc-list">${items.map(taskRow).join('')}</ul></section>`:'';}).join('')||empty()}`);
}

async function taskView(id){
 const {assignment:a}=await api('GET','/api/tasks/'+encodeURIComponent(id));
 const t=a.task,content=a.draft||{},locked=!['not_started','draft','changes_requested'].includes(a.status)&&!(t.repeatRule==='weekly_reward'&&a.status==='accepted')||t.status!=='published';
 let input='';
 if(t.type==='checklist')input=t.checklist.map((c,i)=>`<label class="acc-check"><input type="checkbox" name="checked" value="${i}" ${content.checked?.[i]?'checked':''}> ${esc(pick(c))}</label>`).join('')+field('note',tr('note'),{type:'textarea',value:content.note,attrs:'rows="2" maxlength="2000"'});
 else if(t.type==='counter')input=`<div class="acc-counter"><button type="button" data-act="count" data-d="-1" aria-label="−1">−</button><output name="countOut">${content.count||0}</output> / ${t.counterTarget}<button type="button" data-act="count" data-d="1" aria-label="+1">+</button><input type="hidden" name="count" value="${content.count||0}"></div>`+field('note',tr('note'),{type:'textarea',value:content.note,attrs:'rows="4" maxlength="2000"'});
 else if(t.type==='text'||t.type==='team_result'){
  if(t.key==='project-update')input=`<p><a href="#/account/project/${esc(a.projectId)}/updates">${tr('postUpdate')} →</a></p>`;
  else{input=field('text',tr('answer'),{type:'textarea',value:content.text,attrs:'rows="7" maxlength="5000"'});
   if(t.key==='help-team'){const list=(await api('GET','/api/projects?limit=50')).items.filter(p=>p.id!==a.projectId);input+=select('recipientProjectId',tr('recipient'),[['',''],...list.map(p=>[p.id,p.name])],content.recipientProjectId);}}
 }
 else if(t.type==='link')input=field('url',tr('link'),{type:'url',value:content.url,attrs:'maxlength="500"'})+field('note',tr('note'),{type:'textarea',value:content.note,attrs:'rows="2"'});
 else if(t.type==='attachment'){const files=a.projectId?(await api('GET',`/api/projects/${encodeURIComponent(a.projectId)}/files`)).items.filter(f=>f.purpose!=='reference'):[];input=(files.length?select('fileId',tr('chooseFile'),[['',''],...files.map(f=>[f.id,f.filename])],content.fileId):`<p class="acc-muted">${tr('none')}</p>`)+(a.projectId?`<p><a href="#/account/project/${esc(a.projectId)}/files">${tr('upload')} →</a></p>`:'')+field('note',tr('note'),{type:'textarea',value:content.note,attrs:'rows="2"'});}
 else if(t.type==='attendance'){const lectures=(await api('GET','/api/lectures'));input=`<fieldset class="acc-field"><legend>${tr('chooseLectures')}</legend>${lectures.items.filter(l=>l.date<=lectures.today).map(l=>`<label class="acc-check"><input type="checkbox" name="lectureIds" value="${esc(l.id)}" ${l.attendance?'checked disabled':''}> ${esc(pick(l.title))} · ${date(l.date)} ${l.attendance?`<small>(${tr(l.attendance.kind==='verified_by_admin'?'verified':'selfReported')})</small>`:''}</label>`).join('')}</fieldset><p class="acc-note">${tr('selfReport')}</p>`;}
 const reviews=a.reviews?.length?`<section class="acc-card"><h2>${tr('reviewsTitle')}</h2><ul class="acc-list">${a.reviews.map(r=>`<li><div>${statusChip(r.decision)} <small>${esc(r.reviewer)} · ${date(r.created,true)}</small><p>${esc(r.comment)}</p></div></li>`).join('')}</ul></section>`:'';
 const revs=a.revisions?.length?`<details class="acc-card"><summary>${tr('revisions')} (${a.revisions.length})</summary><ul class="acc-list">${a.revisions.map(r=>`<li><div><strong>#${r.revision}</strong> <small>${esc(r.author)} · ${date(r.created,true)}</small><pre class="acc-pre">${esc(r.content.text||r.content.note||'')}</pre></div></li>`).join('')}</ul></details>`:'';
 return shell('tasks',`<a class="acc-back" href="#/account/tasks">← ${tr('tasks')}</a><article class="acc-card acc-task"><div class="acc-card-head"><h2>${authored(t.translations,'title')}</h2>${statusChip(a.status)}</div><p class="acc-meta">${esc(tr(t.scope==='team'?'team':'personal'))}${a.projectName?' · '+esc(a.projectName):''} · ${t.xp} ${tr('xp')}${t.dueAt?' · '+tr('due')+' '+date(t.dueAt,true):''}${t.requiresReview?' · '+tr('requiresReview'):''}</p>${t.translations.en.goal?`<h3>${tr('goal')}</h3><p>${authored(t.translations,'goal')}</p>`:''}<h3>${tr('instructions')}</h3><p class="acc-pre">${authored(t.translations,'instructions')}</p>${t.translations.en.criteria?`<h3>${tr('criteria')}</h3><p>${authored(t.translations,'criteria')}</p>`:''}<p class="acc-note">${tr('voluntary')}</p>
 ${a.helpConfirmation?`<p>${statusChip(a.helpConfirmation.status==='confirmed'?'accepted':a.helpConfirmation.status==='declined'?'changes_requested':'pending')}</p>`:''}
 ${t.completionMode==='admin_only'?`<p class="acc-note">${tr('adminOnly')}</p>`:locked||t.key==='project-update'?(t.key==='project-update'?input:''):`<form data-form="answer" data-id="${esc(a.id)}" data-type="${esc(t.type)}">${input}<div class="acc-actions"><button type="button" data-act="answer-draft" class="acc-secondary">${tr('saveDraft')}</button><button class="acc-primary" data-key="${idem()}">${tr(t.requiresReview?'submitReview':'submit')}</button></div></form>`}</article>${reviews}${revs}`);
}
function answerContent(form,type){
 const f=new FormData(form),c={note:f.get('note')||''};
 if(type==='checklist')c.checked=[...form.querySelectorAll('[name=checked]')].map(x=>x.checked);
 if(type==='counter')c.count=Number(f.get('count')||0);
 if(type==='text'||type==='team_result'){c.text=f.get('text')||'';if(f.get('recipientProjectId'))c.recipientProjectId=f.get('recipientProjectId');}
 if(type==='link')c.url=f.get('url')||'';
 if(type==='attachment')c.fileId=f.get('fileId')||'';
 if(type==='attendance')c.lectureIds=f.getAll('lectureIds');
 return c;
}

async function mentorsView(only){
 const [all,projects,mentors]=await Promise.all([api('GET','/api/office-hours'),api('GET','/api/projects?mine=1'),api('GET','/api/mentors')]);
 const slots={items:only?all.items.filter(x=>x.mentorId===only):all.items};
 const chosen=mentors.items.find(m=>m.id===only);
 const cards=mentors.items.length?`<div class="acc-mentors">${mentors.items.map(m=>`<a class="acc-mentor ${m.id===only?'is-selected':''}" href="#/account/mentors${m.id===only?'':'/'+esc(m.id)}"><strong>${esc(m.name)}</strong><small class="acc-chip">${esc(m.area)}</small>${m.bio?`<span>${esc(m.bio)}</span>`:''}<small>${m.freeSlots} ${tr('freeSlots')}</small></a>`).join('')}</div>`:'';
 const teams=projects.items.filter(p=>['owner','editor','member'].includes(p.role)&&p.status!=='archived');
 const byDay={};for(const x of slots.items){const d=x.startsAt.slice(0,10);(byDay[d]||=[]).push(x);}
 const future=x=>Date.parse(x.startsAt)>Date.now();
 return shell('mentors',`<p class="acc-note">${tr('officeNote')}</p>${cards}${chosen?`<section class="acc-card"><h2>${esc(chosen.name)} · ${esc(chosen.area)}</h2>${chosen.bio?`<p>${esc(chosen.bio)}</p>`:''}${chosen.link?`<p><a href="${esc(chosen.link)}" target="_blank" rel="noopener noreferrer">${esc(chosen.link)}</a></p>`:''}</section>`:''}${Object.keys(byDay).length?Object.entries(byDay).map(([d,list])=>`<section class="acc-card"><h2>${date(d)}</h2><ul class="acc-list">${list.map(x=>`<li><div><strong>${new Intl.DateTimeFormat(loc[lang],{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Zagreb'}).format(new Date(x.startsAt))} · ${esc(x.mentorName)}</strong><small>${esc(x.topic)}${x.topic?' · ':''}${x.durationMin} min${x.location?' · '+esc(x.location):''}</small>${x.mine?`<small>${tr('yourBooking')}: ${esc(x.projectName)}${x.question?' · '+esc(x.question):''}</small>`:''}</div><span class="acc-actions">${x.mine?(future(x)?`<button data-act="unbook" data-id="${esc(x.id)}">${tr('cancelBooking')}</button>`:`<form data-form="meeting-note" data-id="${esc(x.id)}" class="acc-inline">${field('note',tr('meetingNote'),{value:x.note,attrs:'maxlength="2000"'})}<button class="acc-secondary">${tr('save')}</button></form>`):x.booked?`<span class="acc-chip">${tr('bookedOther')}</span>`:future(x)&&teams.length?`<form data-form="book" data-id="${esc(x.id)}" class="acc-inline">${teams.length>1?select('projectId',tr('project'),teams.map(p=>[p.id,p.name]),teams[0].id):`<input type="hidden" name="projectId" value="${esc(teams[0].id)}">`}${field('question',tr('question'),{attrs:'maxlength="500"'})}<button class="acc-primary">${tr('book')}</button></form>`:''}</span></li>`).join('')}</ul></section>`).join(''):empty()}`);
}
async function progressView(){
 const [p,rank]=await Promise.all([api('GET','/api/progress'),api('GET','/api/teams/ranking')]);
 const mine=new Set(p.teams.map(t=>t.projectId));
 const owned=new Set(p.badges.map(b=>b.id));
 return shell('progress',`<div class="acc-grid"><section class="acc-card acc-score"><h2>${tr('myPoints')}</h2><b>${p.xp}</b><ul class="acc-list">${p.history.map(h=>`<li><span>${h.amount>0?'+':''}${h.amount}</span><small>${esc(h.reason)} · ${date(h.created)}</small></li>`).join('')}</ul></section>
 ${p.teams.map(t=>`<section class="acc-card acc-score"><h2>${tr('teamPoints')} · ${esc(t.name)}</h2><b>${t.xp}</b><ul class="acc-list">${t.history.map(h=>`<li><span>${h.amount>0?'+':''}${h.amount}</span><small>${esc(h.reason)} · ${date(h.created)}</small></li>`).join('')}</ul></section>`).join('')}
 <section class="acc-card acc-ranking"><h2>${tr('ranking')}</h2><ol class="acc-rank">${rankRows(rank.items,mine).map(t=>t.gap?`<li class="acc-rank-gap" aria-hidden="true">…</li>`:`<li value="${t.place}" class="${mine.has(t.projectId)?'is-mine':''}"><span>${esc(t.name)}</span><span><b>${percent(t.percent)}</b>${t.weekGain?` <small>+${t.weekGain} ${tr('thisWeek')}</small>`:''}${t.streak?` <small>🔥${t.streak}</small>`:''}</span></li>`).join('')}</ol><details><summary>${tr('rules')}</summary><p class="acc-muted">${tr('rankingRules')}</p></details></section>
 <section class="acc-card"><h2>${tr('badges')}</h2><ul class="acc-badges">${p.available.map(b=>`<li class="${owned.has(b.id)?'is-owned':''}"><span aria-hidden="true">${owned.has(b.id)?'★':'☆'}</span>${esc(pick(b.title))}</li>`).join('')}</ul></section></div>`);
}

async function characterView(){
 const c=await api('GET','/api/me/character'),p=c.person;
 return shell('character',`<section class="acc-card"><h2>${tr('character')}</h2><p>${statusChip(p.confirmed?'approved':'pending')} ${tr(p.confirmed?'confirmed':'visitor')}</p>
 <form data-form="character">${p.confirmed?`<p><strong>${esc(p.displayName)}</strong></p>${field('publicRole',tr('publicRole'),{value:p.publicRole,attrs:'maxlength="80"'})}<p class="acc-note">${tr('appearanceNote')}</p>${field('appearanceRequest',tr('appearanceRequest'),{type:'textarea',attrs:'rows="2" maxlength="500"'})}`:`${field('displayName',tr('displayName'),{value:p.displayName,required:true,attrs:'maxlength="80"'})}${select('appearance',tr('appearance'),['','woman','man'].map(v=>[v,tr('app_'+v)]),p.appearance||'')}`}<button class="acc-primary">${tr('save')}</button></form>
 <h3>${tr('reference')}</h3><form data-form="reference"><input type="file" name="file" accept="image/png,image/jpeg,image/webp"><button class="acc-secondary">${tr('upload')}</button></form>${c.references.length?`<ul class="acc-list">${c.references.map(r=>`<li><span>${esc(r.filename)}</span><small>${date(r.created)}</small></li>`).join('')}</ul>`:''}
 ${p.confirmed?`<p><a href="#/office/${esc(window.BirdProjects?.person(p.id)?.projectIds?.[0]||'')}/${esc(p.id)}" data-act="office-me">${tr('showInOffice')} →</a></p>`:''}</section>`);
}

async function settingsView(){
 const s=await api('GET','/api/auth/sessions');
 return shell('settings',`<div class="acc-grid"><section class="acc-card"><h2>${tr('settings')}</h2><form data-form="profile">${field('displayName',tr('displayName'),{value:me.displayName,required:true,attrs:'maxlength="80"'})}${field('email',tr('email'),{type:'email',value:me.email,hint:tr('emailNote')})}${select('language',tr('language'),[['en','English'],['hr','Hrvatski'],['ru','Русский']],me.language)}<label class="acc-check"><input type="checkbox" name="leaderboardOptIn" ${me.leaderboardOptIn?'checked':''}> ${tr('leaderboard')}</label><small class="acc-muted">${tr('leaderboardNote')}</small><button class="acc-primary">${tr('save')}</button></form></section>
 <section class="acc-card"><h2>${tr('sessions')}</h2><ul class="acc-list">${s.items.map(x=>`<li><div><strong>${esc(x.device)}</strong>${x.current?` <small>(${tr('thisDevice')})</small>`:''}<small>${date(x.lastSeen,true)}</small></div><button data-act="session" data-id="${esc(x.id)}">${tr('revoke')}</button></li>`).join('')}</ul><div class="acc-actions"><button data-act="logout">${tr('signOut')}</button><button data-act="logout-all">${tr('signOutAll')}</button></div></section>
 <section class="acc-card"><h2>${tr('password')}</h2><form data-form="password">${field('currentPassword',tr('currentPassword'),{type:'password',required:true,attrs:'autocomplete="current-password"'})}${field('newPassword',tr('newPassword'),{type:'password',required:true,hint:tr('passwordHint'),attrs:'autocomplete="new-password" minlength="10"'})}<button class="acc-secondary">${tr('save')}</button></form>
 <h3>${tr('newCodes')}</h3><form data-form="codes">${field('currentPassword',tr('currentPassword'),{type:'password',required:true,attrs:'autocomplete="current-password"'})}<button class="acc-secondary">${tr('newCodes')}</button></form></section></div>`);
}

// Project cabinet ------------------------------------------------------------------------
const FIELDS=['name','short','problem','users','solution','value','ask','nextSteps','details'];
function projectForm(c,version,id){
 return `<form data-form="project" data-id="${esc(id||'')}" data-version="${esc(version||'')}"><p class="acc-note">${tr('optional')}</p>${FIELDS.map(k=>field(k,tr('f_'+k),{type:k==='name'?'text':'textarea',value:c?.[k]||'',required:k==='name',attrs:k==='name'?'maxlength="100"':`rows="${k==='short'?2:4}" maxlength="${k==='details'?8000:3000}"`})).join('')}${select('stage',tr('f_stage'),['idea','research','prototype','pilot','launched'].map(s=>[s,tr('stage_'+s)]),c?.stage||'idea')}<fieldset class="acc-field"><legend>${tr('f_links')}</legend>${[0,1,2].map(i=>`<div class="acc-inline"><input name="linkLabel" placeholder="${tr('title')}" aria-label="${tr('f_links')} ${i+1}" value="${esc(c?.links?.[i]?.label||'')}" maxlength="80"><input name="linkUrl" type="url" placeholder="https://" aria-label="URL ${i+1}" value="${esc(c?.links?.[i]?.url||'')}" maxlength="500"></div>`).join('')}</fieldset><div class="acc-actions"><button class="acc-primary">${tr(id?'saveDraft':'newProject')}</button>${id?`<button type="button" data-act="preview" class="acc-secondary">${tr('preview')}</button>`:''}</div></form>`;
}
function readProjectForm(form){const f=new FormData(form),c={};for(const k of FIELDS)c[k]=f.get(k)||'';c.stage=f.get('stage');const labels=f.getAll('linkLabel'),urls=f.getAll('linkUrl');c.links=urls.map((u,i)=>({label:labels[i]||'',url:u})).filter(l=>l.url);return c;}
function previewHtml(c){return `<article class="acc-preview"><span class="eyebrow">${esc(tr('stage_'+c.stage))}</span><h2>${esc(c.name)}</h2><p class="acc-lede">${esc(c.short)}</p>${FIELDS.slice(2).filter(k=>c[k]).map(k=>`<h3>${tr('f_'+k)}</h3><p class="acc-pre">${esc(c[k])}</p>`).join('')}${c.links?.length?`<ul>${c.links.map(l=>`<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(l.label||l.url)}</a></li>`).join('')}</ul>`:''}</article>`;}

const DRAFT_KEY=id=>'bird-project-draft:'+id;
async function projectView(id,tab='edit'){
 const {project:p}=await api('GET','/api/projects/'+encodeURIComponent(id));
 const tabs=[['edit',tr('description')],['checkin',tr('checkin')],['files',tr('files')],['team',tr('members')],['updates',tr('updates')],['journal',tr('journal')],['history',tr('history')]];
 const progress=await api('GET','/api/progress');const xp=progress.teams.find(t=>t.projectId===id)?.xp??0;
 let body='';
 if(tab==='edit'){
  let local=null;try{local=JSON.parse(sessionStorage.getItem(DRAFT_KEY(id))||'null');}catch{}
  const conflict=cache.conflict?.id===id?cache.conflict:null;cache.conflict=null;
  body=(conflict?`<div class="acc-flash is-error" role="alert">${tr('conflict')}<details open><summary>${tr('yourText')}</summary>${previewHtml(conflict.yours)}</details></div>`:'')+(p.access.edit?projectForm(local&&local.version===p.draftVersion?local.content:p.draft,p.draftVersion,id)+`<div class="acc-card"><p class="acc-note">${tr('publishNote')}</p><button data-act="publish" data-id="${esc(id)}" data-version="${p.draftVersion}" class="acc-primary">${tr('publish')}</button>${p.access.manage?`<button data-act="${p.status==='archived'?'unarchive':'archive'}" data-id="${esc(id)}">${tr(p.status==='archived'?'unarchive':'archive')}</button>`:''}</div>`:previewHtml(p.draft||p.published));
 }else if(tab==='files'){
  const f=await api('GET',`/api/projects/${encodeURIComponent(id)}/files`);
  body=`${p.access.edit?`<form data-form="upload" data-id="${esc(id)}" class="acc-card"><p class="acc-note">${tr('uploadHint')}</p><input type="file" name="file" accept=".pdf,.pptx,.png,.jpg,.jpeg,.webp" required><button class="acc-primary">${tr('upload')}</button></form>`:''}<p class="acc-muted">${tr('used')}: ${size(f.usedBytes)} / ${size(f.limitBytes)}</p>${f.items.length?`<ul class="acc-list">${f.items.map(x=>`<li><div><a href="/api/files/${esc(x.id)}" download>${esc(x.filename)}</a><small>${size(x.size)} · ${date(x.created)} · ${tr('notScanned')}</small></div>${p.access.edit?`<span class="acc-actions"><select data-act="visibility" data-id="${esc(x.id)}" aria-label="${tr('status')}">${['private','team','reviewer','public'].map(v=>`<option value="${v}" ${x.visibility===v?'selected':''}>${tr('vis_'+v)}</option>`).join('')}</select><button data-act="file-delete" data-id="${esc(x.id)}">${tr('remove')}</button></span>`:`<small>${tr('vis_'+x.visibility)}</small>`}</li>`).join('')}</ul>`:empty()}`;
 }else if(tab==='team'){
  const invites=p.access.manage?await api('GET','/api/invites?projectId='+encodeURIComponent(id)):{items:[]};
  body=`<ul class="acc-list">${(p.members||[]).map(m=>`<li><div><strong>${esc(m.displayName)}</strong><small>${esc(tr('role_'+m.role))}</small></div>${p.access.manage&&m.userId!==me.id?`<span class="acc-actions"><select data-act="member-role" data-project="${esc(id)}" data-user="${esc(m.userId)}" aria-label="${tr('roleChange')}">${['owner','editor','member'].map(r=>`<option value="${r}" ${m.role===r?'selected':''}>${tr('role_'+r)}</option>`).join('')}</select><button data-act="member-remove" data-project="${esc(id)}" data-user="${esc(m.userId)}">${tr('remove')}</button></span>`:''}</li>`).join('')}</ul>
  ${p.access.manage?`<form data-form="project-invite" data-id="${esc(id)}" class="acc-card">${select('role',tr('roleChange'),[['editor',tr('role_editor')],['member',tr('role_member')]],'editor')}<button class="acc-secondary">${tr('invite')}</button></form>${cache.newInvite?`<p class="acc-flash" role="status">${tr('inviteShow')}<br><code class="acc-code">${esc(cache.newInvite)}</code></p>`:''}<ul class="acc-list">${invites.items.filter(i=>!i.used&&!i.revoked).map(i=>`<li><span>${tr('role_'+i.role)} · ${date(i.expires)}</span><button data-act="invite-revoke" data-id="${esc(i.id)}">${tr('revoke')}</button></li>`).join('')}</ul>`:''}`;
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
  body=`<section class="acc-card"><div class="acc-card-head"><h2>${tr('checkin')} · ${tr('week')} ${esc(c.week.split('-W')[1])}</h2><span class="acc-chip ${c.streak?'is-accepted':''}">${tr('streak')}: ${c.streak} ${tr('weeks')}</span></div><p class="acc-note">${tr('checkinNote')}</p><form data-form="checkin" data-id="${esc(id)}"><div class="acc-inline">${field('metricName',tr('metricOfWeek'),{value:now.metricName,attrs:'maxlength="80" placeholder="Interviews"'})}${field('metricValue',tr('metricValue'),{value:now.metricValue,attrs:'maxlength="80"'})}</div>${field('goal',tr('goal2w'),{type:'textarea',value:now.goal,required:true,attrs:'rows="2" maxlength="500"'})}${field('blocker',tr('blocker'),{type:'textarea',value:now.blocker,attrs:'rows="2" maxlength="500"'})}<label class="acc-check"><input type="checkbox" name="needsHelp" ${now.needsHelp?'checked':''}> ${tr('needsHelp')}</label><button class="acc-primary">${tr('save')}</button></form></section>${c.items.length?`<ul class="acc-list">${c.items.map(i=>`<li><div><strong>${tr('week')} ${esc(i.week.split('-W')[1])}</strong>${i.metricName?` · ${esc(i.metricName)}: <b>${esc(i.metricValue)}</b>`:''}<small>${esc(i.goal)}${i.blocker?' · '+tr('blocker')+': '+esc(i.blocker):''}${i.needsHelp?' · '+tr('needsHelp'):''}</small></div><small>${esc(i.author)}</small></li>`).join('')}</ul>`:''}`;
 }else if(tab==='history'){
  const r=p.access.edit?await api('GET',`/api/projects/${encodeURIComponent(id)}/revisions`):{items:[]};
  body=r.items.length?`<ul class="acc-list">${r.items.map(x=>`<li><div><strong>v${x.version}</strong> ${statusChip(x.kind==='published'?'published':x.kind==='conflict'?'changes_requested':'draft')}<small>${esc(x.author)} · ${date(x.created,true)}</small><details><summary>${tr('preview')}</summary>${previewHtml(x.content)}</details></div><button data-act="restore" data-project="${esc(id)}" data-id="${x.id}">${tr('restore')}</button></li>`).join('')}</ul>`:empty();
 }
 return shell('overview',`<a class="acc-back" href="#/account">← ${tr('myProjects')}</a><div class="acc-card-head"><h2 class="acc-project-title">${esc((p.draft||p.published).name)}</h2><span>${statusChip(p.status)} <b class="acc-xp">${xp} ${tr('xp')}</b></span></div><nav class="acc-tabs acc-subtabs">${tabs.map(([k,l])=>`<a href="#/account/project/${esc(id)}/${k}" ${k===tab?'aria-current="page"':''}>${esc(l)}</a>`).join('')}</nav>${body}`);
}

// Admin ------------------------------------------------------------------------------
const ADMIN_GROUPS=[{label:'today',tabs:['today']},{label:'teamsNav',tabs:['overview','users','checkins','claims']},{label:'tasks',tabs:['tasks','reviews','import']},{label:'programme',tabs:['lectures','mentors','news','insights']},{label:'settings',tabs:['system','audit']}];
const TAB_LABEL={overview:'teamsNav',news:'announcements',system:'settings'};
function adminShell(active,body){
 const group=ADMIN_GROUPS.find(g=>g.tabs.includes(active))||ADMIN_GROUPS[0];
 const link=(k,l,on)=>`<a href="#/admin/${k}" ${on?'aria-current="page"':''}>${esc(l)}</a>`;
 return shell('admin',`<nav class="acc-tabs acc-subtabs">${ADMIN_GROUPS.map(g=>link(g.tabs[0],tr(g.label),g===group)).join('')}</nav>${group.tabs.length>1?`<nav class="acc-tabs acc-subtabs acc-subtabs-2">${group.tabs.map(k=>link(k,tr(TAB_LABEL[k]||k),k===active)).join('')}</nav>`:''}${body}`);
}
const recordTask=t=>`<li><a href="#/account/task/${esc(t.id)}"><strong>${esc(pick(t.title).title||t.title.en?.title)}</strong><small>${t.who?esc(t.who)+' · ':''}${t.xp} ${tr('xp')}${t.dueAt?' · '+tr('due')+' '+date(t.dueAt,true):''}${t.optional?' · '+tr('optionalTask'):''}</small></a>${statusChip(t.status)}</li>`;
const noteList=n=>n.length?`<ul class="acc-list">${n.map(x=>`<li><div>${esc(x.body)}<small>${esc(x.author||'')} · ${date(x.created,true)}</small></div></li>`).join('')}</ul>`:'';
const ledgerList=l=>l.length?`<ul class="acc-list">${l.map(h=>`<li><span>${h.amount>0?'+':''}${h.amount}</span><small>${esc(String(h.reason).replace(/^manual:/,''))} · ${date(h.created)}</small></li>`).join('')}</ul>`:empty();
const nudgeForm=hidden=>`<form data-form="nudge" class="acc-compact">${hidden}${field('message',tr('nudgeMessage'),{type:'textarea',required:true,attrs:'rows="2" maxlength="300"'})}<button class="acc-primary">${tr('nudgeSend')}</button></form>`;
const xpForm=(type,id)=>`<form data-form="xp" data-type="${type}" data-id="${esc(id)}" class="acc-compact"><div class="acc-inline">${field('amount',tr('xpChange'),{type:'number',required:true,attrs:'min="-1000" max="1000"',hint:tr('xpChangeHint')})}${field('reason',tr('reasonField'),{required:true,attrs:'minlength="3" maxlength="200"'})}</div><button class="acc-secondary">${tr('save')}</button></form>`;
const noteForm=(type,id)=>`<form data-form="organiser-note" data-type="${type}" data-id="${esc(id)}" class="acc-compact">${field('body',tr('addNote'),{type:'textarea',required:true,attrs:'rows="2" maxlength="1000"'})}<button class="acc-secondary">${tr('save')}</button></form>`;

async function teamRecord(id){
 const r=await api('GET','/api/admin/team/'+encodeURIComponent(id));
 const open=r.tasks.filter(t=>['not_started','draft','changes_requested'].includes(t.status)),rest=r.tasks.filter(t=>!open.includes(t));
 return adminShell('overview',`<a class="acc-back" href="#/admin/overview">← ${tr('teamsNav')}</a><div class="acc-card-head"><h2>${esc(r.name)}</h2><span class="acc-light is-${esc(r.risk.level)}">${tr('risk_'+r.risk.level)}</span></div>
 <div class="acc-stats"><div><b>${percent(r.score.percent)}</b><small>${r.score.earned}/${r.score.available} ${tr('xp')}</small></div><div><b>${r.tasks.filter(t=>t.status==='accepted').length}/${r.tasks.length}</b><small>${tr('tasks')}</small></div><div><b>${r.members.reduce((n,m)=>n+m.attended,0)}/${r.lectures*Math.max(1,r.members.length)}</b><small>${tr('attendance')}</small></div><div><b>${r.pitch.pitches}</b><small>${tr('pitches')} · ${tr('deck')}: ${esc(tr('st_'+r.pitch.deck))}</small></div></div>
 ${r.risk.signals.length?`<p class="acc-muted">${r.risk.signals.map(x=>tr('sig_'+x)).join(', ')}${r.streak?` · 🔥${r.streak}`:''}</p>`:''}
 <div class="acc-actions"><a class="acc-primary" href="#/admin/task/new~team~${esc(id)}">${tr('giveTask')}</a><a class="acc-secondary" href="#/account/project/${esc(id)}">${tr('openProject')}</a><a href="#/office/${esc(id)}">${tr('locateInOffice')}</a></div>
 <div class="acc-grid"><section class="acc-card"><h2>${tr('members')}</h2><ul class="acc-list">${r.members.map(m=>`<li><a href="#/admin/person/${esc(m.id)}"><strong>${esc(m.name)}</strong><small class="${idle(m.lastSeen)?'acc-idle':''}">${esc(seen(m.lastSeen))} · ${m.xp} ${tr('xp')} · ${m.attended} ${tr('lecturesShort')}</small></a></li>`).join('')}${r.noAccount.map(m=>`<li><a href="#/admin/person/${esc(m.id)}"><strong>${esc(m.name)}</strong><small>${tr('noAccount')}</small></a></li>`).join('')}</ul></section>
 <section class="acc-card"><h2>${tr('nudgeTeam')}</h2>${r.lastNudge?`<p class="acc-muted">${tr('lastNudge')}: ${date(r.lastNudge,true)}</p>`:''}${r.members.length?nudgeForm(`<input type="hidden" name="projectId" value="${esc(id)}">`):`<p class="acc-muted">${tr('noAccountsYet')}</p>`}</section>
 <section class="acc-card"><h2>${tr('openTasks')} (${open.length})</h2>${open.length?`<ul class="acc-list">${open.map(recordTask).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><h2>${tr('doneTasks')} (${rest.length})</h2>${rest.length?`<ul class="acc-list">${rest.map(recordTask).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><h2>${tr('checkins')}</h2>${r.checkins.length?`<ul class="acc-list">${r.checkins.map(c=>`<li><div><strong>${esc(c.week)}</strong> ${esc(c.metric_name)}: ${esc(c.metric_value)}<small>${esc(c.goal)}${c.blocker?' · '+esc(c.blocker):''}${c.needs_help?' · '+tr('needsHelp'):''}</small></div></li>`).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><h2>${tr('files')}</h2>${r.files.length?`<ul class="acc-list">${r.files.map(f=>`<li><a href="/api/files/${esc(f.id)}" download>${esc(f.filename)}</a><small>${size(f.size)} · ${date(f.created)}</small></li>`).join('')}</ul>`:empty()}<h2>${tr('mentors')}</h2>${r.mentors.length?`<ul class="acc-list">${r.mentors.map(m=>`<li><div><strong>${esc(m.mentor_name)}</strong><small>${date(m.starts_at,true)} · ${esc(m.topic)}${m.note?' · '+esc(m.note):''}</small></div></li>`).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><h2>${tr('pointsHistory')}</h2>${ledgerList(r.ledger)}<h3>${tr('adjustPoints')}</h3>${xpForm('project',id)}</section>
 <section class="acc-card"><h2>${tr('notesTitle')}</h2><p class="acc-muted">${tr('notesPrivate')}</p>${noteList(r.notes)}${noteForm('team',id)}</section></div>`);
}
async function personRecord(id){
 const r=await api('GET','/api/admin/person/'+encodeURIComponent(id));
 if(!r.hasAccount)return adminShell('users',`<a class="acc-back" href="#/admin/users">← ${tr('users')}</a><h2>${esc(r.person.name)}</h2><p class="acc-flash">${tr('noAccount')}. ${tr('noAccountNote')}</p>${r.teams.map(t=>`<p><a href="#/admin/team/${esc(t.id)}">${esc(t.name)}</a></p>`).join('')}<form data-form="person-invite" class="acc-card"><input type="hidden" name="personId" value="${esc(r.person.id)}"><button class="acc-secondary">${tr('invite')}</button></form>${cache.newInvite?`<p class="acc-flash" role="status">${tr('inviteShow')}<br><code class="acc-code">${esc(cache.newInvite)}</code></p>`:''}`);
 const u=r.user,projects=(await api('GET','/api/admin/overview')).items,code=cache.resetCode;cache.resetCode=null;
 const open=r.tasks.filter(t=>['not_started','draft','changes_requested'].includes(t.status)),rest=r.tasks.filter(t=>!open.includes(t));
 const missed=r.attendance.filter(a=>!a.kind);
 return adminShell('users',`<a class="acc-back" href="#/admin/users">← ${tr('users')}</a><div class="acc-card-head"><h2>${esc(u.name)}</h2><small>${esc(tr('urole_'+u.role))}${u.status==='active'?'':' · '+tr('disabledNow')}</small></div>
 <p class="acc-muted">${esc(u.login)}${u.email?' · '+esc(u.email):''} · <span class="${idle(u.lastSeen)?'acc-idle':''}">${esc(seen(u.lastSeen))}</span>${u.linkedin?` · <a href="${esc(u.linkedin)}" target="_blank" rel="noopener noreferrer nofollow">LinkedIn</a>`:''}${u.website?` · <a href="${esc(u.website)}" target="_blank" rel="noopener noreferrer nofollow">${tr('website')}</a>`:''}</p>
 <div class="acc-stats"><div><b>${u.xp}</b><small>${tr('points')}</small></div><div><b>${r.tasks.filter(t=>t.status==='accepted').length}/${r.tasks.length}</b><small>${tr('tasks')}</small></div><div><b>${r.attendance.length-missed.length}/${r.attendance.length}</b><small>${tr('attendance')}</small></div></div>
 <div class="acc-actions"><a class="acc-primary" href="#/admin/task/new~user~${esc(u.id)}">${tr('giveTask')}</a>${r.teams[0]?`<a class="acc-secondary" href="#/admin/team/${esc(r.teams[0].id)}">${esc(r.teams[0].name)}</a>`:''}${r.person&&r.teams[0]?`<a href="#/office/${esc(r.teams[0].id)}/${esc(r.person.id)}">${tr('locateInOffice')}</a>`:''}</div>
 <div class="acc-grid"><section class="acc-card"><h2>${tr('nudgeTitle')}</h2>${r.lastNudge?`<p class="acc-muted">${tr('lastNudge')}: ${date(r.lastNudge,true)}</p>`:''}${nudgeForm(`<input type="hidden" name="userId" value="${esc(u.id)}">`)}</section>
 <section class="acc-card"><h2>${tr('teamAssign')}</h2><p class="acc-muted">${tr('teamAssignNote')}</p><form data-form="set-team" data-id="${esc(u.id)}" class="acc-compact">${select('projectId',tr('project'),[['',tr('noTeam')],...projects.map(p=>[p.id,p.name])],r.teams[0]?.id||'')}<button class="acc-secondary">${tr('save')}</button></form></section>
 <section class="acc-card"><h2>${tr('openTasks')} (${open.length})</h2>${open.length?`<ul class="acc-list">${open.map(recordTask).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><h2>${tr('doneTasks')} (${rest.length})</h2>${rest.length?`<ul class="acc-list">${rest.map(recordTask).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><h2>${tr('lectures')}</h2>${r.attendance.length?`<ul class="acc-list">${r.attendance.map(a=>`<li><span>${esc(pick(a.title))}<small>${date(a.date)}</small></span>${a.kind?`<span class="acc-chip is-accepted">${tr(a.kind==='verified_by_admin'?'verified':'selfReported')}</span>`:`<span class="acc-chip is-changes_requested">${tr('missedLecture')}</span>`}</li>`).join('')}</ul>`:empty()}</section>
 <section class="acc-card"><h2>${tr('pointsHistory')}</h2>${ledgerList(r.ledger)}<h3>${tr('adjustPoints')}</h3>${xpForm('user',u.id)}</section>
 <section class="acc-card"><h2>${tr('notesTitle')}</h2><p class="acc-muted">${tr('notesPrivate')}</p>${noteList(r.notes)}${noteForm('user',u.id)}</section>
 ${u.role!=='platform_owner'?`<section class="acc-card"><h2>${tr('accessTitle')}</h2>${code?`<p class="acc-flash" role="status">${tr('resetShow')}<br><code class="acc-code">${esc(code)}</code></p>`:`<p class="acc-muted">${tr('resetNote')}</p>`}<div class="acc-actions"><button data-act="reset-code" data-id="${esc(u.id)}" class="acc-secondary">${tr('resetCode')}</button><button data-act="user-status" data-id="${esc(u.id)}" data-status="${u.status==='active'?'disabled':'active'}" ${u.status==='active'?`data-confirm="${esc(tr('confirmDisable'))}"`:''}>${tr(u.status==='active'?'disable':'enable')}</button></div></section>`:''}</div>`);
}
async function todayView(){
 const t=await api('GET','/api/admin/today');
 const stat=(n,label,href)=>`<a href="${href}" class="${n?'has-work':''}"><b>${n}</b><small>${tr(label)}</small></a>`;
 const teams=t.teams.filter(x=>x.members&&(x.level!=='ok'||x.waiting||x.inactive)),unregistered=t.teams.filter(x=>!x.members).length;
 return adminShell('today',`<div class="acc-stats">${stat(t.waiting,'reviews','#/admin/reviews')}${stat(t.overdue.length,'overdueTasks','#/admin/today')}${stat(t.claims,'claims','#/admin/claims')}${stat(t.unverified,'digestAttendance','#/admin/lectures')}</div>
 <div class="acc-grid"><section class="acc-card"><h2>${tr('needsAttention')}</h2>${teams.length?`<ul class="acc-list">${teams.map(x=>`<li><a href="#/admin/team/${esc(x.id)}"><strong>${esc(x.name)}</strong><small>${x.signals.map(k=>tr('sig_'+k)).join(', ')}${x.waiting?` · ${x.waiting} ${tr('waiting')}`:''}${x.inactive?' · '+tr('noVisit7'):''}</small></a><span class="acc-light is-${esc(x.level)}">${percent(x.percent)}</span></li>`).join('')}</ul>`:`<p class="acc-muted">${tr('allCalm')}</p>`}${unregistered?`<p class="acc-muted"><a href="#/admin/overview">${tr('teamsUnregistered')}: ${unregistered}</a></p>`:''}</section>
 <section class="acc-card"><h2>${tr('overdueTasks')}</h2>${t.overdue.length?`<ul class="acc-list">${t.overdue.map(o=>`<li><a href="${o.userId?'#/admin/person/'+esc(o.userId):'#/admin/team/'+esc(o.projectId)}"><strong>${esc(o.who)}</strong><small>${esc(o.title)} · ${date(o.dueAt,true)}</small></a></li>`).join('')}</ul>`:empty()}</section>
 ${t.help.length?`<section class="acc-card"><h2>${tr('needsHelp')}</h2><ul class="acc-list">${t.help.map(h=>`<li><a href="#/admin/team/${esc(h.projectId)}"><strong>${esc(h.name)}</strong><small>${esc(h.blocker)}</small></a></li>`).join('')}</ul></section>`:''}
 <section class="acc-card"><h2>${tr('comingUp')}</h2>${t.lectures.length||t.slots.length?`<ul class="acc-list">${t.lectures.map(l=>`<li><a href="#/admin/lecture/${esc(l.id)}"><strong>${esc(pick(l.title))}</strong><small>${date(l.date)}${l.time?' '+esc(l.time):''}${l.place?' · '+esc(l.place):''}</small></a></li>`).join('')}${t.slots.map(x=>`<li><a href="#/admin/mentors"><strong>${esc(x.mentor)}</strong><small>${date(x.startsAt,true)}${x.team?' · '+esc(x.team):''}</small></a></li>`).join('')}</ul>`:empty()}</section></div>`);
}
async function adminView(tab='today',id){
 if(tab==='today')return todayView();
 if(tab==='team'&&id)return teamRecord(id);
 if(tab==='person'&&id)return personRecord(id);
 if(tab==='overview'){
  const o=await api('GET','/api/admin/overview'),view=cache.teamFilter||'all';
  const tests={all:()=>true,overdue:p=>p.overdue>0,attendance:p=>p.risk.signals.includes('low_attendance'),pitch:p=>p.pitch.deck!=='accepted',waiting:p=>p.tasks.waitingReview>0};
  const rows=o.items.filter(tests[view]);
  const deck={accepted:'✓',submitted:'…'};
  return adminShell(tab,`<div class="acc-actions acc-admin-tools"><a class="acc-secondary" href="/api/admin/export.csv" download>${tr('exportCsv')}</a><a class="acc-secondary" href="/api/admin/export-people.csv" download>${tr('exportPeople')}</a><a href="/api/calendar.ics">${tr('calendar')} (.ics)</a></div>
  <div class="acc-filters" role="group">${Object.keys(tests).map(k=>`<button data-act="team-filter" data-view="${k}" aria-pressed="${k===view}">${tr('tf_'+k)}</button>`).join('')}</div>
  <details class="acc-card acc-nudge-team"><summary>${tr('nudgeTeam')}</summary><form data-form="nudge" id="team-nudge" class="acc-compact"><p class="acc-muted">${tr('nudgePick')}</p>${field('message',tr('nudgeMessage'),{type:'textarea',required:true,attrs:'rows="2" maxlength="300"'})}<button class="acc-primary">${tr('nudgeSend')}</button></form></details>
  <div class="acc-table-wrap"><table class="acc-table acc-matrix acc-teams-table"><thead><tr><th></th><th>${tr('project')}</th><th>${tr('scoreColumn')}</th><th>${tr('tasks')}</th><th>${tr('attendance')}</th><th>${tr('pitches')}</th><th>${tr('mentors')}</th><th>${tr('risk')}</th><th>${tr('lastSeen')}</th></tr></thead><tbody>${rows.map(p=>`<tr class="risk-${esc(p.risk.level)}"><td>${p.members.length?`<label class="acc-tick"><input type="checkbox" name="teamId" value="${esc(p.id)}" form="team-nudge" aria-label="${esc(p.name)}"></label>`:''}</td><th scope="row"><a href="#/admin/team/${esc(p.id)}"><strong>${esc(p.name)}</strong></a><small>${esc(p.members.join(', '))||tr('noAccountsYet')}</small></th><td><b>${percent(p.percent)}</b><small>${p.totalXp} ${tr('xp')}</small></td><td>${p.tasks.done}/${p.tasks.total}${p.overdue?`<small class="acc-idle">${p.overdue} ${tr('overdueShort')}</small>`:''}${p.tasks.waitingReview?`<small>${p.tasks.waitingReview} ${tr('waiting')}</small>`:''}</td><td>${p.attendance.verified} ✓ · ${p.attendance.selfReported}<small>${tr('verified')} · ${tr('selfReportedShort')}</small></td><td>${deck[p.pitch.deck]||'—'}<small>${p.pitch.pitches} ${tr('pitches')}</small></td><td>${p.mentorSessions}</td><td><span class="acc-light is-${esc(p.risk.level)}">${tr('risk_'+p.risk.level)}</span><small>${p.risk.signals.map(x=>tr('sig_'+x)).join(', ')}${p.streak?` · 🔥${p.streak}`:''}</small></td><td><small class="${idle(p.lastSeen)?'acc-idle':''}">${p.lastSeen?date(p.lastSeen,true):'—'}</small></td></tr>`).join('')}</tbody></table></div>`);
 }
 if(tab==='reviews'){
  const reviewTabs=`<div class="acc-filters">${[['','tf_waiting'],['accepted','acceptedWork']].map(([k,l])=>`<a class="acc-secondary" href="#/admin/reviews/${k}" ${(id||'')===k?'aria-current="page"':''}>${tr(l)}</a>`).join('')}</div>`;
  if(id==='accepted'){
   const done=await api('GET','/api/reviews?status=accepted&limit=50');
   return adminShell(tab,reviewTabs+(done.items.length?done.items.map(a=>`<section class="acc-card"><div class="acc-card-head"><h2>${authored(a.task.translations,'title')}</h2><small>${esc(a.projectName||a.userName||'')}${a.authorName?' · '+esc(a.authorName):''} · ${date(a.updated,true)}</small></div><details><summary>${tr('revokeWork')}</summary><form data-form="revoke" data-id="${esc(a.submissionId)}" class="acc-compact">${field('comment',tr('reasonField'),{type:'textarea',required:true,attrs:'rows="2" maxlength="1000"'})}<button class="acc-secondary">${tr('revokeWork')}</button></form></details></section>`).join(''):empty()));
  }
  const q=await api('GET','/api/reviews');
  const details=await Promise.all(q.items.map(i=>api('GET','/api/tasks/'+i.id).then(r=>r.assignment)));
  return adminShell(tab,reviewTabs+(q.items.length?details.map((a,i)=>{const r=a.revisions[0]?.content||{};return `<section class="acc-card"><div class="acc-card-head"><h2>${authored(a.task.translations,'title')}</h2><small>${esc(a.projectName||q.items[i].userName||'')}${q.items[i].authorName?' · '+esc(q.items[i].authorName):''} · v${a.revision}</small></div><p class="acc-muted">${tr('criteria')}: ${authored(a.task.translations,'criteria')}</p><pre class="acc-pre">${esc(r.text||r.note||'')}</pre>${r.count!==undefined?`<p>${tr('count')}: ${r.count}</p>`:''}${r.fileId?`<p><a href="/api/files/${esc(r.fileId)}" download>${tr('download')}</a></p>`:''}${r.url?`<p><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(r.url)}</a></p>`:''}<form data-form="review" data-id="${esc(q.items[i].submissionId)}" data-revision="${a.revision}">${field('comment',tr('comment'),{type:'textarea',attrs:'rows="2" maxlength="3000"'})}<div class="acc-actions"><button name="decision" value="accepted" class="acc-primary">${tr('accept')}</button><button name="decision" value="changes_requested" class="acc-secondary">${tr('requestChanges')}</button><button name="decision" value="rejected">${tr('reject')}</button></div></form></section>`;}).join(''):empty()));
 }
 if(tab==='tasks'){
  const list=await api('GET','/api/admin/tasks');
  return adminShell(tab,`<a class="acc-secondary" href="#/admin/task/new">+ ${tr('newTask')}</a><ul class="acc-list">${list.items.map(t=>`<li><a href="#/admin/task/${esc(t.id)}"><strong>${authored(t.translations,'title')}</strong><small>${esc(tr('type_'+t.type))} · ${esc(tr(t.scope==='team'?'team':'personal'))} · ${t.xp} ${tr('xp')} · ${t.assigned} ${tr('assigned')}${t.waiting?` · ${t.waiting} ${tr('waiting')}`:''}</small></a>${statusChip(t.status)}</li>`).join('')}</ul>`);
 }
 if(tab==='task'){
  const [,presetKind,presetId]=(id||'').split('~');
  if(presetKind)cache.pick={[presetKind]:[presetId]};
  const t=id.startsWith('new')?null:(await api('GET','/api/admin/tasks')).items.find(x=>x.id===id);
  const tl=t?.translations||{};
  const form=`<form data-form="task" data-id="${esc(t?.id||'')}" data-version="${t?.version||''}" class="acc-card">${select('type',tr('type'),['checklist','counter','text','link','attachment','attendance','team_result'].map(v=>[v,tr('type_'+v)]),t?.type||'text')}${select('audience',tr('audience'),[['all_participants',tr('audAll')],['selected',tr('audSelected')]],t?.audience||(presetKind?'selected':'all_participants'))}${select('scope',tr('whoSubmits'),[['personal',tr('eachPerson')],['team',tr('oneForTeam')]],t?.scope||(presetKind==='team'?'team':'personal'))}${field('xp',tr('points'),{type:'number',value:t?.xp??10,attrs:'min="0" max="1000"'})}${field('counterTarget',tr('target'),{type:'number',value:t?.counterTarget||1,attrs:'min="1" max="100"'})}${select('completionMode',tr('completionMode'),['participant','admin_only'].map(v=>[v,tr('cm_'+v)]),t?.completionMode||'participant')}${select('pickMode',tr('pickMode'),['assigned','catalog'].map(v=>[v,tr('pm_'+v)]),t?.pickMode||'assigned')}${select('repeatRule',tr('repeat'),['once','weekly_reward','per_week'].map(v=>[v,tr('rep_'+v)]),t?.repeatRule||'once')}<label class="acc-check"><input type="checkbox" name="requiresReview" ${t?.requiresReview?'checked':''}> ${tr('requiresReview')}</label>${field('dueAt',tr('due'),{type:'datetime-local',value:localInput(t?.dueAt)})}
  ${['en','hr','ru'].map(l=>`<details class="acc-field acc-lang-block" ${l==='en'||l===lang?'open':''}><summary>${l.toUpperCase()}</summary>${field('title_'+l,tr('title'),{value:tl[l]?.title,required:l==='en',attrs:'maxlength="160"'})}${field('goal_'+l,tr('goal'),{type:'textarea',value:tl[l]?.goal,attrs:'rows="2"'})}${field('instructions_'+l,tr('instructions'),{type:'textarea',value:tl[l]?.instructions,required:l==='en',attrs:'rows="4"'})}${field('criteria_'+l,tr('criteria'),{type:'textarea',value:tl[l]?.criteria,attrs:'rows="2"'})}</details>`).join('')}
  ${field('checklist',tr('checklistItems'),{type:'textarea',value:(t?.checklist||[]).map(c=>c.en).join('\n'),attrs:'rows="3"'})}<button class="acc-primary">${tr('save')}</button></form>`;
  const sendable=t&&['draft','published'].includes(t.status);
  const everyone=sendable&&t.audience!=='selected';
  const [teams,users]=sendable&&!everyone?await Promise.all([api('GET','/api/admin/overview'),api('GET','/api/admin/users')]):[{items:[]},{items:[]}];
  const pick_=cache.pick||{};const box=(name,value,label,on)=>`<label class="acc-check"><input type="checkbox" name="${name}" value="${esc(value)}" ${on?'checked':''}> ${esc(label)}</label>`;
  const picker=sendable?`<form data-form="task-send" data-id="${esc(t.id)}" class="acc-compact"><h3>${tr('recipients')}</h3>${everyone?`<p class="acc-muted">${tr('audAllNote')}</p>`:`<h4>${tr('teamsNav')}</h4><div class="acc-checks">${teams.items.filter(p=>p.members.length).map(p=>box('projectId',p.id,p.name,pick_.team?.includes(p.id))).join('')}</div>${t.scope==='personal'?`<h4>${tr('usersShort')}</h4><div class="acc-checks">${users.items.filter(u=>u.status==='active'&&u.role==='member').map(u=>box('userId',u.id,u.displayName,pick_.user?.includes(u.id))).join('')}</div>`:''}`}<button class="acc-secondary">${tr('assignPreview')}</button></form>`:'';
  const status=t?`<section class="acc-card"><p>${statusChip(t.status)} ${tr(t.audience==='selected'?'audSelected':'audAll')}</p><div class="acc-actions">${t.status==='draft'?`<button data-act="task-status" data-id="${esc(t.id)}" data-status="published" class="acc-primary">${tr('publish')}</button>`:''}${t.status==='published'?`<button data-act="task-status" data-id="${esc(t.id)}" data-status="closed">${tr('close')}</button>`:''}${t.status==='closed'?`<button data-act="task-status" data-id="${esc(t.id)}" data-status="archived">${tr('archive').split(' ')[0]}</button>`:''}${t.status==='archived'?`<button data-act="task-status" data-id="${esc(t.id)}" data-status="draft">${tr('makeDraft')}</button>`:''}</div>${picker}${cache.preview?.id===t.id?`<p>${tr('total')}: ${cache.preview.total} · ${tr('newCount')}: ${cache.preview.new}</p><ul class="acc-list">${cache.preview.items.slice(0,30).map(x=>`<li><span>${esc(x.name)}</span>${x.alreadyAssigned?statusChip('accepted'):''}</li>`).join('')}</ul><button data-act="task-assign" data-id="${esc(t.id)}" data-draft="${t.status==='draft'?1:''}" data-key="${idem()}" class="acc-primary" ${cache.preview.new?'':'disabled'}>${tr(t.status==='draft'?'publishAssign':'assign')} (${cache.preview.new})</button>`:''}${t.status==='published'&&t.assigned?`<details><summary>${tr('nudgeUnfinished')}</summary><form data-form="nudge-open" data-id="${esc(t.id)}" class="acc-compact">${field('message',tr('nudgeMessage'),{type:'textarea',required:true,value:tr('nudgeTemplate'),attrs:'rows="2" maxlength="300"'})}<button class="acc-primary">${tr('nudgeSend')}</button></form></details>`:''}</section>`:'';
  let mark='';
  if(t&&t.status==='published'){const targets=t.scope==='team'?(await api('GET','/api/admin/overview')).items.map(p=>({id:p.id,name:p.name})):(await api('GET','/api/admin/users')).items.map(u=>({id:u.id,name:u.displayName}));
   mark=`<form data-form="mark" data-id="${esc(t.id)}" data-scope="${esc(t.scope)}" class="acc-card"><h2>${tr('markFor')}</h2><div class="acc-checks">${targets.map(x=>`<label class="acc-check"><input type="checkbox" name="target" value="${esc(x.id)}"> ${esc(x.name)}</label>`).join('')}</div>${field('note',tr('note'),{attrs:'maxlength="500"'})}<button class="acc-primary">${tr('markDone')}</button></form>`;}
  return adminShell('tasks',`<a class="acc-back" href="#/admin/task/">← ${tr('tasks')}</a>${status}${mark}${form}`.replace('href="#/admin/task/"','href="#/admin/tasks"'));
 }
 if(tab==='claims'){
  const c=await api('GET','/api/admin/claims');
  const people=(await api('GET','/api/people?limit=100')).items.filter(p=>p.kind==='participant');
  return adminShell(tab,`${c.items.length?`<ul class="acc-list">${c.items.map(x=>`<li><div><strong>${esc(x.userName)}</strong> (${esc(x.login)}) → <strong>${esc(x.personName)}</strong><small>${esc(x.message)} · ${date(x.created,true)}</small></div><span class="acc-actions"><button data-act="claim" data-id="${esc(x.id)}" data-decision="approved" class="acc-secondary">${tr('approve')}</button><button data-act="claim" data-id="${esc(x.id)}" data-decision="rejected">${tr('reject')}</button></span></li>`).join('')}</ul>`:empty()}
  <form data-form="person-invite" class="acc-card"><h2>${tr('personInvite')}</h2>${select('personId',tr('character'),people.map(p=>[p.id,p.displayName]),'')}<button class="acc-secondary">${tr('invite')}</button></form>${cache.newInvite?`<p class="acc-flash" role="status">${tr('inviteShow')}<br><code class="acc-code">${esc(cache.newInvite)}</code></p>`:''}`);
 }
 if(tab==='users'){
  const u=await api('GET','/api/admin/users');
  return adminShell(tab,`<label class="acc-field"><span>${tr('searchPeople')}</span><input type="search" data-filter="people" autocomplete="off"></label><div class="acc-table-wrap"><table class="acc-table acc-matrix"><thead><tr><th></th><th>${tr('displayName')}</th><th>${tr('status')}</th><th>${tr('points')}</th><th></th></tr></thead><tbody>${u.items.map(x=>`<tr data-search="${esc((x.displayName+' '+x.login+' '+(x.projects||[]).join(' ')).toLowerCase())}" class="${x.status==='active'&&x.role==='member'&&idle(x.lastSeen)?'risk-watch':''}"><td>${x.status==='active'?`<label class="acc-tick"><input type="checkbox" name="userId" value="${esc(x.id)}" form="nudge-form" data-idle="${x.role==='member'&&idle(x.lastSeen)?1:0}" aria-label="${esc(x.displayName)}"></label>`:''}</td><th scope="row"><a href="#/admin/person/${esc(x.id)}"><strong>${esc(x.displayName)}</strong></a><small>${esc(seen(x.lastSeen))}</small><small>${esc(x.login)}${x.projects?.length?' · '+esc(x.projects.join(', ')):''}</small></th><td>${esc(tr('urole_'+x.role))}<small>${x.status==='active'?'':tr('disabledNow')}</small></td><td>${x.xp}<small>${x.tasksDone} ${tr('tasksDoneShort')} · ${x.lectures} ${tr('lecturesShort')}</small></td><td>${x.role!=='platform_owner'?`<select data-act="user-role" data-id="${esc(x.id)}" data-current="${esc(x.role)}" aria-label="${tr('roleChange')}">${['member','program_admin'].map(r=>`<option value="${r}" ${x.role===r?'selected':''}>${tr('urole_'+r)}</option>`).join('')}</select><button data-act="user-status" data-id="${esc(x.id)}" data-status="${x.status==='active'?'disabled':'active'}" ${x.status==='active'?`data-confirm="${esc(tr('confirmDisable'))}"`:''}>${tr(x.status==='active'?'disable':'enable')}</button>`:''}</td></tr>`).join('')}</tbody></table></div><form data-form="nudge" id="nudge-form" class="acc-card"><h2>${tr('nudgeTitle')}</h2><p class="acc-muted">${tr('nudgeNote')}</p>${field('message',tr('nudgeMessage'),{type:'textarea',required:true,attrs:'rows="2" maxlength="300"'})}<div class="acc-actions"><button class="acc-primary">${tr('nudgeSend')}</button><button type="button" data-act="pick-idle">${tr('pickIdle')}</button></div></form>`);
 }
 if(tab==='system'){
  const s=await api('GET','/api/admin/settings'),inv=cache.newInvite;cache.newInvite=null;
  return adminShell(tab,`<section class="acc-card"><h2>${tr('adminsTitle')}</h2><p class="acc-muted">${tr('adminsNote')}</p><button data-act="admin-invite" class="acc-secondary">${tr('adminInvite')}</button>${inv?`<p class="acc-flash" role="status">${tr('inviteShow')}<br><code class="acc-code">${esc(inv)}</code></p>`:''}</section>
  <section class="acc-card"><h2>${tr('backup')}</h2><p class="acc-muted">${tr('backupNote')}</p><a class="acc-secondary" href="/api/admin/backup.sqlite" download>${tr('backupDownload')}</a></section>
  <section class="acc-card"><h2>${tr('limits')}</h2><p>PDF/PPTX ${s.limits.documentMB} MB · ${tr('upload')} ${s.limits.imageMB} MB · ${tr('project')} ${s.limits.projectMB} MB · ${tr('total')} ${s.limits.uploadsMB} MB</p><p>${tr('mail')}: ${s.mail==='disabled'?tr('mailOff'):esc(s.mail)}</p></section>
  <section class="acc-card"><h2>${tr('whoCanDo')}</h2><ul class="acc-list">${[0,1,2,3,4].map(i=>`<li><div><strong>${tr('perm'+i)}</strong><small>${tr('permWho'+i)}</small></div></li>`).join('')}</ul></section>`);
 }
 if(tab==='lectures'){
  const [l,a,m]=await Promise.all([api('GET','/api/admin/lectures'),api('GET','/api/admin/attendance'),api('GET','/api/admin/attendance/matrix')]);
  const recent=m.lectures.slice(-8).reverse(),sign={verified_by_admin:'✓',self_reported:'○'};
  return adminShell(tab,`<section class="acc-card"><h2>${tr('whoCame')}</h2><p class="acc-muted">${tr('whoCameNote')}</p>${recent.length&&m.people.length?`<div class="acc-table-wrap"><table class="acc-table acc-matrix acc-attendance-table"><thead><tr><th>${tr('displayName')}</th>${recent.map(x=>`<th title="${esc(pick(x.title))}">${date(x.date).replace(/\s*\d{4}.*$/,'')}</th>`).join('')}</tr></thead><tbody>${m.people.map(p=>`<tr><th scope="row"><a href="#/admin/person/${esc(p.id)}">${esc(p.name)}</a><small>${esc(p.team)}</small></th>${recent.map(x=>`<td><button class="acc-mark is-${esc(p.marks[x.id]||'none')}" data-act="att-toggle" data-user="${esc(p.id)}" data-lecture="${esc(x.id)}" data-kind="${esc(p.marks[x.id]||'')}" aria-label="${esc(p.name+' · '+pick(x.title))}">${sign[p.marks[x.id]]||'·'}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty()}</section>
  <ul class="acc-list">${l.items.map(x=>`<li><a href="#/admin/lecture/${esc(x.id)}"><strong>${esc(pick(x.title))}</strong><small>${date(x.date)}${x.time?' '+esc(x.time):''}${x.place?' · '+esc(x.place):''}${x.speaker?' · '+esc(x.speaker):''}</small></a>${statusChip(x.status)}</li>`).join('')}</ul>
  <form data-form="lecture" class="acc-card"><h2>${tr('addLecture')}</h2>${lectureFields()}<button class="acc-secondary">${tr('save')}</button></form>
  ${m.lectures.length?`<form data-form="bulk-verify" class="acc-card"><h2>${tr('bulkVerify')}</h2>${select('lectureId',tr('lectures'),m.lectures.map(x=>[x.id,pick(x.title)+' · '+x.date]),m.lectures.at(-1)?.id)}<div class="acc-checks">${m.people.map(u=>`<label class="acc-check"><input type="checkbox" name="userId" value="${esc(u.id)}"> ${esc(u.name)}</label>`).join('')}</div><button class="acc-primary">${tr('verify')}</button></form>`:''}
  <h2>${tr('attendance')}</h2>${a.items.length?`<ul class="acc-list">${a.items.map(x=>`<li><div><strong>${esc(x.userName)}</strong><small>${esc(pick(l.items.find(y=>y.id===x.lectureId)?.title))} · ${tr(x.kind==='verified_by_admin'?'verified':'selfReported')}</small></div><span class="acc-actions">${x.kind==='self_reported'?`<button data-act="verify" data-user="${esc(x.userId)}" data-lecture="${esc(x.lectureId)}" class="acc-secondary">${tr('verify')}</button>`:''}<button data-act="att-remove" data-user="${esc(x.userId)}" data-lecture="${esc(x.lectureId)}" data-confirm="${esc(tr('confirmRemoveMark'))}">${tr('remove')}</button></span></li>`).join('')}</ul>`:empty()}`);
 }
 if(tab==='lecture'){
  const x=(await api('GET','/api/admin/lectures')).items.find(y=>y.id===id);if(!x)return adminShell('lectures',empty());
  return adminShell('lectures',`<a class="acc-back" href="#/admin/lectures">← ${tr('lectures')}</a><form data-form="lecture" data-id="${esc(x.id)}" class="acc-card"><h2>${esc(pick(x.title))}</h2>${lectureFields(x)}${select('status',tr('status'),[['published',tr('st_published')],['draft',tr('st_draft')],['archived',tr('lectureCancelled')]],x.status)}<button class="acc-primary">${tr('save')}</button></form>`);
 }
 if(tab==='insights'){
  const [d,fb,hook]=await Promise.all([api('GET','/api/admin/digest'),api('GET','/api/admin/feedback'),api('GET','/api/admin/chat-hook')]);
  const names=a=>a.length?a.map(esc).join(', '):'—';
  return adminShell(tab,`<section class="acc-card"><div class="acc-card-head"><h2>${tr('digest')} · ${esc(d.week)}</h2>${hook.configured?`<button class="acc-secondary" data-act="digest-send">${tr('sendDigest')}</button>`:''}</div><ul class="acc-list acc-digest">
   <li><span>${tr('digestNoCheckin')}</span><b>${names(d.noCheckin)}</b></li>
   <li><span>${tr('digestRisk')}</span><b>${names(d.atRisk.map(t=>t.name))}</b></li>
   <li><span>${tr('digestHelp')}</span><b>${names(d.needsHelp)}</b></li>
   <li><span><a href="#/admin/reviews">${tr('digestReview')}</a></span><b>${d.waitingReview}</b></li>
   <li><span><a href="#/admin/lectures">${tr('digestAttendance')}</a></span><b>${d.unverifiedAttendance}</b></li>
   <li><span><a href="#/admin/users">${tr('digestInactive')}</a></span><b>${names(d.inactive.slice(0,15))}${d.inactive.length>15?' +'+(d.inactive.length-15):''}</b></li>
   <li><span>${tr('digestNew')}</span><b>${d.newAccounts}</b></li></ul>${hook.configured?'':`<p class="acc-note">${tr('digestHookNote')}</p>`}</section>
  <section class="acc-card"><h2>${tr('lectureFeedback')}</h2>${fb.items.length?`<div class="acc-table-wrap"><table class="acc-table"><thead><tr><th>${tr('lectures')}</th><th>${tr('answers')}</th><th>${tr('average')}</th><th>NPS</th></tr></thead><tbody>${fb.items.map(l=>`<tr><td><strong>${esc(pick(l.title))}</strong><small>${date(l.date)}</small>${l.comments.length?`<details><summary>${tr('comments')} (${l.comments.length})</summary><ul class="acc-todo">${l.comments.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>`:''}</td><td>${l.answers}</td><td>${l.average??'—'}</td><td>${l.nps??'—'}</td></tr>`).join('')}</tbody></table></div><p class="acc-note">${tr('npsNote')}</p>`:empty()}</section>`);
 }
 if(tab==='checkins'){
  const c=await api('GET','/api/admin/checkins'+(id?'?week='+encodeURIComponent(id):''));
  return adminShell(tab,`<h2>${tr('week')} ${esc(c.week)}</h2><div class="acc-table-wrap"><table class="acc-table"><thead><tr><th>${tr('project')}</th><th>${tr('metricOfWeek')}</th><th>${tr('goal2w')}</th><th>${tr('blocker')}</th><th>${tr('streak')}</th></tr></thead><tbody>${c.items.map(r=>`<tr class="${r.done?'':'risk-watch'}"><td><strong>${esc(r.name)}</strong>${r.needsHelp?`<small class="acc-help">${tr('needsHelp')}</small>`:''}</td><td>${r.done?esc(r.metricName)+': <b>'+esc(r.metricValue)+'</b>':`<small>${tr('checkinMissing')}</small>`}</td><td>${esc(r.goal||'')}</td><td>${esc(r.blocker||'')}</td><td>${r.streak?'🔥'+r.streak:'—'}</td></tr>`).join('')}</tbody></table></div>`);
 }
 if(tab==='import'){
  const [tl,ll,hooks]=await Promise.all([api('GET','/api/admin/tasks?status=published'),api('GET','/api/admin/lectures'),api('GET','/api/admin/form-hooks')]);
  const pv=cache.importPreview;const secret=cache.hookSecret;cache.hookSecret=null;
  const script=secret?`function onFormSubmit(e) {\n  var r = e.response;\n  var email = r.getRespondentEmail();\n  UrlFetchApp.fetch('${location.origin}/api/forms/hook', {\n    method: 'post', contentType: 'application/json',\n    headers: {'X-Form-Secret': '${secret}'},\n    payload: JSON.stringify({email: email, note: ''}),\n    muteHttpExceptions: true\n  });\n}`:'';
  return adminShell(tab,`<section class="acc-card"><h2>Google Forms → CSV</h2><p class="acc-note">${tr('importNote')}</p><form data-form="import">${select('kind',tr('importKind'),[['attendance',tr('ik_attendance')],['task',tr('ik_task')]],pv?.kind||'attendance')}${select('lectureId',tr('lectures'),[['',tr('lectureFromColumn')],...ll.items.map(x=>[x.id,pick(x.title)+' · '+x.date])],pv?.lectureId||'')}${select('taskId',tr('tasks'),tl.items.map(x=>[x.id,pick(x.translations).title||x.translations.en.title]),pv?.taskId||'')}<label class="acc-field"><span>${tr('csvFile')}</span><input type="file" name="file" accept=".csv,text/csv"></label>${field('csv',tr('orPaste'),{type:'textarea',value:pv?.csv||'',attrs:'rows="5"'})}<div class="acc-actions"><button class="acc-secondary" name="step" value="preview">${tr('preview')}</button>${pv?`<button class="acc-primary" name="step" value="apply">${tr('apply')} (${pv.ready})</button>`:''}</div></form>
  ${pv?`<p>${tr('total')}: ${pv.total} · ${tr('ready')}: ${pv.ready}</p><div class="acc-table-wrap"><table class="acc-table"><tbody>${pv.rows.map(r=>`<tr class="${r.status==='ok'?'':'risk-watch'}"><td>${r.line}</td><td>${esc(r.who)}</td><td>${esc(r.user?.name||'')}${r.user?.by==='email'?' <small>email</small>':''}</td><td>${esc(r.lecture?.date||'')}</td><td>${tr('is_'+r.status)}</td></tr>`).join('')}</tbody></table></div>`:''}</section>
  <section class="acc-card"><h2>${tr('hooks')}</h2><p class="acc-muted">${tr('hookNote')}</p><form data-form="hook" class="acc-inline">${select('kind',tr('importKind'),[['attendance',tr('ik_attendance')],['task',tr('ik_task')]],'attendance')}${select('lectureId',tr('lectures'),ll.items.map(x=>[x.id,pick(x.title)+' · '+x.date]),ll.items.at(-1)?.id)}${select('taskId',tr('tasks'),tl.items.map(x=>[x.id,x.translations.en.title]),'')}${field('label',tr('title'),{attrs:'maxlength="80"'})}<button class="acc-secondary">${tr('createHook')}</button></form>${secret?`<pre class="acc-pre acc-script">${esc(script.replace(/\\n/g,'\n'))}</pre>`:''}<ul class="acc-list">${hooks.items.map(h=>`<li><span>${esc(h.label||h.kind)} · ${tr('ik_'+h.kind)}${h.last_used?' · '+date(h.last_used,true):''}${h.revoked_at?' · '+tr('revoke'):''}</span>${h.revoked_at?'':`<button data-act="hook-revoke" data-id="${esc(h.id)}">${tr('revoke')}</button>`}</li>`).join('')}</ul></section>`);
 }
 if(tab==='news'){
  const n=await api('GET','/api/announcements');
  const [qs,tl,hook]=await Promise.all([api('GET','/api/quests'),api('GET','/api/admin/tasks?status=published'),api('GET','/api/admin/chat-hook')]);
  return adminShell(tab,`<form data-form="quest" class="acc-card"><h2>${tr('newQuest')}</h2>${['en','hr','ru'].map(l=>field('qt_'+l,tr('title')+' '+l.toUpperCase(),{required:l==='en',attrs:'maxlength="120"'})).join('')}${select('taskId',tr('tasks'),tl.items.map(x=>[x.id,x.translations.en.title]),'')}${field('target',tr('target'),{type:'number',value:8,attrs:'min="1" max="1000"'})}<button class="acc-secondary">${tr('save')}</button><ul class="acc-list">${qs.items.map(q=>`<li><span>${esc(pick(q.title))} · ${q.done}/${q.target}</span><button type="button" data-act="quest-close" data-id="${esc(q.id)}">${tr('close')}</button></li>`).join('')}</ul></form><form data-form="announcement" class="acc-card"><h2>${tr('newAnnouncement')}</h2>${field('title',tr('title'),{required:true,attrs:'maxlength="160"'})}${field('body',tr('answer'),{type:'textarea',required:true,attrs:'rows="4" maxlength="4000"'})}<label class="acc-check"><input type="checkbox" name="pinned"> ${tr('pinned')}</label>${hook.configured?`<label class="acc-check"><input type="checkbox" name="toChat" checked> ${tr('toChat')}</label>`:''}<button class="acc-primary">${tr('publish')}</button></form><form data-form="chat-hook" class="acc-card"><h2>${tr('chatHook')} ${hook.configured?`<span class="acc-chip is-accepted">${tr('configured')}</span>`:''}</h2><p class="acc-muted">${tr('chatHookNote')}</p><div class="acc-inline">${field('url','URL',{type:'url',attrs:'maxlength="300" autocomplete="off"'})}<button class="acc-secondary">${tr('save')}</button></div></form><ul class="acc-list">${n.items.map(x=>`<li><div><strong>${x.pinned?'📌 ':''}${esc(x.title)}</strong><p class="acc-pre">${esc(x.body)}</p><small>${date(x.created,true)} · ${x.readBy}/${x.audience} ${tr('readBy')}</small></div><button data-act="news-archive" data-id="${esc(x.id)}">${tr('archive').split(' ')[0]}</button></li>`).join('')}</ul>`);
 }
 if(tab==='mentors'){
  const [slots,mentors]=await Promise.all([api('GET','/api/office-hours'),api('GET','/api/mentors')]);
  return adminShell(tab,`<section class="acc-card"><h2>${tr('mentorProfiles')}</h2><p class="acc-muted">${tr('mentorProfilesNote')}</p><form data-form="mentor" class="acc-inline">${field('name',tr('mentorName'),{required:true,attrs:'maxlength="100"'})}${field('area',tr('mentorArea'),{required:true,hint:tr('mentorAreaHint'),attrs:'maxlength="60" list="mentor-areas"'})}<datalist id="mentor-areas">${['Sales','Marketing','Product','Fundraising','Legal','Finance','Tech','Pitch'].map(a=>`<option value="${a}">`).join('')}</datalist>${field('bio',tr('mentorBio'),{attrs:'maxlength="600"'})}${field('link',tr('mentorLink'),{type:'url',attrs:'maxlength="300" placeholder="https://"'})}<button class="acc-secondary">${tr('save')}</button></form><ul class="acc-list">${mentors.items.map(m=>`<li><details class="acc-grow"><summary><strong>${esc(m.name)}</strong> <small>${esc(m.area)}${m.bio?' · '+esc(m.bio):''} · ${m.freeSlots} ${tr('freeSlots')}</small></summary><form data-form="mentor" data-id="${esc(m.id)}" class="acc-compact"><div class="acc-inline">${field('name',tr('mentorName'),{required:true,value:m.name,attrs:'maxlength="100"'})}${field('area',tr('mentorArea'),{required:true,value:m.area,attrs:'maxlength="60" list="mentor-areas"'})}</div>${field('bio',tr('mentorBio'),{value:m.bio,attrs:'maxlength="600"'})}${field('link',tr('mentorLink'),{type:'url',value:m.link,attrs:'maxlength="300"'})}<div class="acc-actions"><button class="acc-primary">${tr('save')}</button><button type="button" data-act="mentor-archive" data-id="${esc(m.id)}" data-confirm="${esc(tr('confirmRemoveMentor'))}">${tr('remove')}</button></div></form></details></li>`).join('')}</ul></section><form data-form="slot" class="acc-card"><h2>${tr('newSlot')}</h2><div class="acc-inline">${mentors.items.length?select('mentorId',tr('mentorProfiles'),[['',tr('guestMentor')],...mentors.items.map(m=>[m.id,m.name+' · '+m.area])],mentors.items[0].id):''}${field('mentorName',tr('guestMentor'),{attrs:'maxlength="100"'})}${field('topic',tr('topic'),{attrs:'maxlength="200"'})}</div><div class="acc-inline">${field('startsAt',tr('startsAt'),{type:'datetime-local',required:true})}${field('durationMin',tr('duration'),{type:'number',value:30,attrs:'min="10" max="240"'})}${field('location',tr('location'),{attrs:'maxlength="200"'})}</div><button class="acc-primary">${tr('save')}</button></form><ul class="acc-list">${slots.items.map(x=>`<li><div><strong>${date(x.startsAt,true)} · ${esc(x.mentorName)}</strong><small>${esc(x.topic)}${x.booked?` · ${tr('bookedOther')}: ${esc(x.projectName||'')}${x.question?' · '+esc(x.question):''}${x.note?' · '+esc(x.note):''}`:''}</small></div><button data-act="slot-cancel" data-id="${esc(x.id)}" data-confirm="${esc(tr('confirmCancelSlot'))}">${tr('cancelSlot')}</button></li>`).join('')}</ul>`);
 }
 if(tab==='audit'){
  const a=await api('GET','/api/admin/audit'+(id?'?prefix='+encodeURIComponent(id):''));
  const kinds=['task','submission','attendance','role','user','xp','nudge','membership','lecture','claim'];
  const detail=d=>{const v=Object.entries(d).filter(([k])=>k!=='user').map(([k,x])=>`${k}: ${x}`).join(', ');return v?' · '+esc(v):'';};
  return adminShell(tab,`<div class="acc-filters"><a class="acc-secondary" href="#/admin/audit" ${id?'':'aria-current="page"'}>${tr('tf_all')}</a>${kinds.map(k=>`<a class="acc-secondary" href="#/admin/audit/${k}" ${id===k?'aria-current="page"':''}>${tr('ak_'+k)}</a>`).join('')}</div><ul class="acc-list acc-audit">${a.items.map(x=>`<li><div><strong>${esc(x.actor||tr('system'))}</strong> · ${esc(x.action)}<small>${esc(x.targetName||x.targetType)}${detail(x.detail)}</small></div><small>${date(x.created,true)}</small></li>`).join('')}</ul>`);
 }
 return adminShell('overview',empty());
}

// Render and events ---------------------------------------------------------------------
async function render(){
 if(!root||!isRoute())return;
 const token=++renderToken;const p=parts();
 if(me===undefined)await loadMe();
 let html;
 try{
  if(!me){html=cache.codes?codesView(cache.codes.codes,cache.codes.next):authView(['register','recover'].includes(p[1])?p[1]:'login');}
  else if(cache.codes){html=codesView(cache.codes.codes,cache.codes.next);}
  else if(p[0]==='admin'){html=isAdmin()?await adminView(p[1]||'today',p[2]):shell('overview',`<p class="acc-flash is-error">${tr('e_FORBIDDEN')}</p>`);}
  else if(!p[1])html=await overviewView();
  else if(p[1]==='tasks')html=await tasksView();
  else if(p[1]==='task')html=await taskView(p[2]);
  else if(p[1]==='progress')html=await progressView();
  else if(p[1]==='mentors')html=await mentorsView(p[2]);
  else if(p[1]==='character')html=await characterView();
  else if(p[1]==='settings')html=await settingsView();
  else if(p[1]==='new-project')html=shell('overview',`<a class="acc-back" href="#/account">← ${tr('myProjects')}</a><h2>${tr('newProject')}</h2>${projectForm(null)}`);
  else if(p[1]==='project')html=await projectView(p[2],p[3]||'edit');
  else if(['register','recover'].includes(p[1]))html=await overviewView();
  else html=await overviewView();
 }catch(e){html=me?shell('overview',`<p class="acc-flash is-error" role="alert">${errText(e)}</p>`):authView('login');}
 if(token!==renderToken||!root)return;
 root.innerHTML=html;updateNav();
 if(me&&['account'].includes(p[0])&&(!p[1]||p[1]==='progress'))celebrateBadges();
 const status=root.querySelector('.acc-flash');if(status)status.focus?.();
}
function setFlash(html,error=false){flash={html,error};}
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
 if(form.dataset.busy)return;form.dataset.busy='1';[...form.querySelectorAll('button')].forEach(b=>b.disabled=true);
 await run(async()=>{
  if(kind==='login'){await api('POST','/api/auth/login',{login:f.get('login'),password:f.get('password')});await loadMe();go('#/account');return;}
  if(kind==='register'){const r=await api('POST','/api/auth/register',{login:f.get('login'),password:f.get('password'),displayName:f.get('displayName'),email:f.get('email'),language:lang});me=r.user;if(f.get('invite')){try{await api('POST','/api/invites/accept',{code:f.get('invite')});await loadMe();}catch(err){setFlash(errText(err),true);}}cache.codes={codes:r.recoveryCodes,next:'#/account'};render();return;}
  if(kind==='recover'){await api('POST','/api/auth/recover',{login:f.get('login'),code:f.get('code'),newPassword:f.get('newPassword')});await loadMe();setFlash(tr('saved'));go('#/account/settings');return;}
  if(kind==='invite'){const r=await api('POST','/api/invites/accept',{code:f.get('code')});await loadMe();setFlash(tr('saved'));go(r.projectId?'#/account/project/'+r.projectId:'#/account');return;}
  if(kind==='claim'){await api('POST','/api/people/claims',{personId:f.get('personId'),message:f.get('message')});setFlash(tr('st_pending'));render();return;}
  if(kind==='project'){const content=readProjectForm(form);
   if(!form.dataset.id){const r=await api('POST','/api/projects',content,{key:form.dataset.key||(form.dataset.key=idem())});go('#/account/project/'+r.project.id);return;}
   try{sessionStorage.setItem(DRAFT_KEY(form.dataset.id),JSON.stringify({version:Number(form.dataset.version),content}));}catch{}
   await api('PUT',`/api/projects/${encodeURIComponent(form.dataset.id)}/draft`,{content},{headers:{'If-Match':`"${form.dataset.version}"`}});
   try{sessionStorage.removeItem(DRAFT_KEY(form.dataset.id));}catch{}
   setFlash(tr('saved'));render();return;}
  if(kind==='upload'||kind==='reference'){const file=f.get('file');if(!file?.size)return;
   const purpose=kind==='reference'?'reference':file.type.startsWith('image/')?'image':'document';
   const url=`/api/files?purpose=${purpose}${kind==='upload'?'&projectId='+encodeURIComponent(form.dataset.id):''}`;
   await api('POST',url,undefined,{raw:file,key:idem(),headers:{'X-Filename':encodeURIComponent(file.name),'Content-Type':file.type||'application/octet-stream'}});setFlash(tr('saved'));render();return;}
  if(kind==='project-invite'){const r=await api('POST','/api/invites',{kind:'project',projectId:form.dataset.id,role:f.get('role')});cache.newInvite=r.code;render();return;}
  if(kind==='person-invite'){const r=await api('POST','/api/invites',{kind:'person',personId:f.get('personId')});cache.newInvite=r.code;render();return;}
  if(kind==='update'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/updates`,{body:f.get('body'),visibility:f.get('visibility')},{key:btn?.dataset.key});setFlash(tr('saved'));render();return;}
  if(kind==='help'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/help`,{kind:f.get('kind'),body:f.get('body')});render();return;}
  if(kind==='milestone'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/milestones`,{title:f.get('title'),due:f.get('due')||null});render();return;}
  if(kind==='metric'){await api('POST',`/api/projects/${encodeURIComponent(form.dataset.id)}/metrics`,{name:f.get('name'),value:f.get('value'),measuredOn:f.get('measuredOn'),visibility:f.get('visibility')});render();return;}
  if(kind==='answer'){await api('POST',`/api/tasks/${encodeURIComponent(form.dataset.id)}/submit`,{content:answerContent(form,form.dataset.type)},{key:btn?.dataset.key});setFlash(tr('saved'));render();return;}
  if(kind==='character'){const body=Object.fromEntries([...f.entries()]);await api('PUT','/api/me/character',body);setFlash(tr('saved'));render();return;}
  if(kind==='profile'){const r=await api('PUT','/api/me/profile',{displayName:f.get('displayName'),email:f.get('email'),language:f.get('language'),leaderboardOptIn:f.get('leaderboardOptIn')==='on'});me=r.user;setFlash(tr('saved'));render();return;}
  if(kind==='password'){await api('POST','/api/auth/password',{currentPassword:f.get('currentPassword'),newPassword:f.get('newPassword')});setFlash(tr('saved'));render();return;}
  if(kind==='codes'){const r=await api('POST','/api/auth/recovery-codes',{currentPassword:f.get('currentPassword')});cache.codes={codes:r.recoveryCodes,next:'#/account/settings'};render();return;}
  if(kind==='review'){await api('POST','/api/reviews/'+encodeURIComponent(form.dataset.id),{decision:btn?.value,comment:f.get('comment'),revision:Number(form.dataset.revision)});setFlash(tr('saved'));render();return;}
  if(kind==='task'){
   const body={completionMode:f.get('completionMode'),pickMode:f.get('pickMode'),type:f.get('type'),scope:f.get('scope'),xp:Number(f.get('xp')),counterTarget:Number(f.get('counterTarget')),repeatRule:f.get('repeatRule'),audience:f.get('audience'),requiresReview:f.get('requiresReview')==='on',dueAt:f.get('dueAt')?new Date(f.get('dueAt')).toISOString():null,translations:Object.fromEntries(['en','hr','ru'].map(l=>[l,{title:f.get('title_'+l),goal:f.get('goal_'+l),instructions:f.get('instructions_'+l),criteria:f.get('criteria_'+l)}])),checklist:String(f.get('checklist')||'').split('\n').map(s=>s.trim()).filter(Boolean).map(en=>({en,hr:'',ru:''})),version:Number(form.dataset.version)};
   const r=form.dataset.id?await api('PUT','/api/admin/tasks/'+encodeURIComponent(form.dataset.id),body):await api('POST','/api/admin/tasks',body);
   setFlash(tr('saved'));go('#/admin/task/'+r.task.id);return;}
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
  if(kind==='slot'){await api('POST','/api/admin/office-hours',{mentorId:f.get('mentorId')||null,mentorName:f.get('mentorName'),topic:f.get('topic'),startsAt:new Date(f.get('startsAt')).toISOString(),durationMin:Number(f.get('durationMin')),location:f.get('location')});setFlash(tr('saved'));render();return;}
  if(kind==='book'){await api('POST',`/api/office-hours/${encodeURIComponent(form.dataset.id)}/book`,{projectId:f.get('projectId'),question:f.get('question')});setFlash(tr('saved'));render();return;}
  if(kind==='meeting-note'){await api('POST',`/api/office-hours/${encodeURIComponent(form.dataset.id)}/note`,{note:f.get('note')});setFlash(tr('saved'));render();return;}
  if(kind==='quest'){await api('POST','/api/admin/quests',{title:{en:f.get('qt_en'),hr:f.get('qt_hr'),ru:f.get('qt_ru')},taskId:f.get('taskId'),target:Number(f.get('target'))});setFlash(tr('saved'));render();return;}
  if(kind==='chat-hook'){await api('PUT','/api/admin/chat-hook',{url:f.get('url')});setFlash(tr('saved'));render();return;}
  if(kind==='announcement'){await api('POST','/api/admin/announcements',{title:f.get('title'),body:f.get('body'),pinned:f.get('pinned')==='on',toChat:f.get('toChat')==='on'});setFlash(tr('saved'));render();return;}
  if(kind==='feedback'){await api('POST',`/api/lectures/${encodeURIComponent(form.dataset.id)}/feedback`,{score:Number(f.get('score')),comment:f.get('comment')});setFlash(tr('feedbackThanks'));render();return;}
  if(kind==='lecture'){const body={date:f.get('date'),time:f.get('time'),place:f.get('place'),speaker:f.get('speaker'),status:f.get('status')||'published',title:{en:f.get('title_en'),hr:f.get('title_hr'),ru:f.get('title_ru')}},lid=form.dataset.id;await (lid?api('PUT','/api/admin/lectures/'+encodeURIComponent(lid),body):api('POST','/api/admin/lectures',body));setFlash(tr('saved'));if(lid)go('#/admin/lectures');else render();return;}
 });
 delete form.dataset.busy;[...form.querySelectorAll('button')].forEach(b=>b.disabled=false);
}

async function onClick(e){
 const el=e.target.closest('[data-act]');if(!el||!root.contains(el)||el.tagName==='SELECT')return;
 const d=el.dataset,act=d.act;
 if(act==='toggle-password'){e.preventDefault();const input=el.previousElementSibling,show=input.type==='password';input.type=show?'text':'password';el.textContent=tr(show?'hidePassword':'showPassword');el.setAttribute('aria-pressed',String(show));input.focus();return;}
 if(act==='count'){const form=el.closest('form'),input=form.elements.count,max=Number(form.closest('.acc-task')?.querySelector('.acc-counter')?.textContent.match(/\/\s*(\d+)/)?.[1]||100);input.value=Math.max(0,Math.min(max,Number(input.value)+Number(d.d)));form.elements.countOut.value=input.value;return;}
 if(act==='office-me')return;
 if(d.confirm&&!window.confirm(d.confirm))return;
 if(act==='codes-done'){cache.codes=null;go(d.next||'#/account');return;}
 e.preventDefault();
 if(el.dataset.busy)return;el.dataset.busy='1';el.disabled=true;
 await run(async()=>{
  if(act==='answer-draft'){const form=el.closest('form');await api('PUT',`/api/tasks/${encodeURIComponent(form.dataset.id)}/draft`,{content:answerContent(form,form.dataset.type)});setFlash(tr('saved'));render();}
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
  else if(act==='read'){await api('POST','/api/notifications/read',{});cache.unread=0;render();}
  else if(act==='session'){await api('DELETE','/api/auth/sessions/'+encodeURIComponent(d.id));await loadMe();render();}
  else if(act==='logout'||act==='logout-all'){await api('POST','/api/auth/'+act,{});me=null;csrf='';go('#/account');}
  else if(act==='claim'){await api('POST','/api/admin/claims/'+encodeURIComponent(d.id),{decision:d.decision});render();}
  else if(act==='task-status'){await api('POST',`/api/admin/tasks/${encodeURIComponent(d.id)}/status`,{status:d.status});render();}
  else if(act==='task-assign'){if(d.draft)await api('POST',`/api/admin/tasks/${encodeURIComponent(d.id)}/status`,{status:'published'});const {period,userIds,projectIds}=cache.preview;const r=await api('POST',`/api/admin/tasks/${encodeURIComponent(d.id)}/assign`,{period,userIds,projectIds},{key:d.key});cache.preview=null;cache.pick=null;setFlash(`${tr('assign')}: ${r.created}`);render();}
  else if(act==='verify'){await api('POST','/api/admin/attendance',{userId:d.user,lectureId:d.lecture});render();}
  else if(act==='att-remove'){await api('POST','/api/admin/attendance/remove',{userId:d.user,lectureId:d.lecture});render();}
  else if(act==='att-toggle'){if(d.kind==='verified_by_admin'){if(window.confirm(tr('confirmRemoveMark'))){await api('POST','/api/admin/attendance/remove',{userId:d.user,lectureId:d.lecture});render();}}else{await api('POST','/api/admin/attendance',{userId:d.user,lectureId:d.lecture});render();}}
  else if(act==='team-filter'){cache.teamFilter=d.view;render();}
  else if(act==='reset-code'){const r=await api('POST',`/api/admin/users/${encodeURIComponent(d.id)}/reset-code`,{});cache.resetCode=r.code;render();}
  else if(act==='user-status'){await api('PUT',`/api/admin/users/${encodeURIComponent(d.id)}/status`,{status:d.status});render();}
  else if(act==='take'){const r=await api('POST',`/api/catalog/${encodeURIComponent(d.id)}/take`,d.project?{projectId:d.project}:{});go('#/account/task/'+r.assignmentId);}
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
  else if(act==='admin-invite'){const r=await api('POST','/api/invites',{kind:'program_admin'});cache.newInvite=r.code;render();}
 });
 delete el.dataset.busy;el.disabled=false;
}
function onInput(e){
 const el=e.target.closest('[data-filter="people"]');if(!el)return;
 const q=el.value.trim().toLowerCase();root.querySelectorAll('tr[data-search]').forEach(r=>{r.hidden=!!q&&!r.dataset.search.includes(q);});
}
async function onChange(e){
 const el=e.target.closest('select[data-act]');if(!el||!root.contains(el))return;
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
  root?.removeEventListener('submit',onSubmit);root?.removeEventListener('click',onClick);root?.removeEventListener('change',onChange);root?.removeEventListener('input',onInput);
  root=el;lang=language;if(cache.codes&&!location.hash.startsWith('#/account'))cache.codes=null;
  root.addEventListener('submit',onSubmit);root.addEventListener('click',onClick);root.addEventListener('change',onChange);root.addEventListener('input',onInput);
  root.innerHTML=`<p class="acc-muted">${tr('loading')}</p>`;render();
 },
 async refresh(){await loadMe();},
 codesShown(){cache.codes=null;},
};
loadMe();
})();
