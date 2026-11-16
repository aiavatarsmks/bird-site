/* Admin tab "Report for the funder": period, headline numbers, funding chart, funder indicators, per-team table.
   Every number has an "i" that lists the records behind it. Styles: admin-report.css. Data: /api/admin/report. */
(()=>{'use strict';
const L=(en,hr,ru)=>({en,hr,ru});
const TEXT={
 funderReport:L('Report for funder','Izvješće za financijera','Отчёт для фонда'),
 frTitle:L('Report for the funder','Izvješće za financijera','Отчёт для фонда'),
 frLede:L('Numbers for your grant report. Each one opens the records it was counted from.','Brojke za izvješće o potpori. Uz svaku možete otvoriti zapise iz kojih je izračunata.','Цифры для отчёта по гранту. У каждой можно открыть записи, из которых она посчитана.'),
 frFrom:L('From','Od','С'),frTo:L('To','Do','По'),frShow:L('Show','Prikaži','Показать'),
 frPresetDefault:L('Programme / last 4 months','Program / posljednja 4 mjeseca','Программа / последние 4 месяца'),
 frPresetYear:L('This year','Ova godina','Этот год'),frPresetQuarter:L('Last 3 months','Posljednja 3 mjeseca','Последние 3 месяца'),
 frBasis_programme:L('programme period','razdoblje programa','период программы'),frBasis_last4months:L('last 4 months','posljednja 4 mjeseca','последние 4 месяца'),frBasis_custom:L('chosen period','odabrano razdoblje','выбранный период'),
 frCsv:L('Download CSV','Preuzmi CSV','Скачать CSV'),frCsvSemi:L('CSV for Excel (HR)','CSV za Excel (HR)','CSV для Excel (;)'),frXlsx:L('Excel (.xlsx)','Excel (.xlsx)','Excel (.xlsx)'),
 frPrint:L('Print / PDF','Ispis / PDF','Печать / PDF'),
 frHeadline:L('Headline results','Glavni rezultati','Главные результаты'),frActivity:L('Programme activity','Aktivnosti programa','Активность программы'),
 frFunding:L('Funding raised, by type','Prikupljena sredstva po vrsti','Привлечённые средства по типам'),
 frF_grant:L('Grants','Bespovratna sredstva','Гранты'),frF_equity:L('Equity','Vlasnička ulaganja','Инвестиции в долю'),frF_loan:L('Loans','Zajmovi','Займы'),frF_prize:L('Prizes','Nagrade','Призы'),frF_other:L('Other','Ostalo','Другое'),
 frTotal:L('Total','Ukupno','Итого'),frNoFunding:L('No funding reported in this period.','U ovom razdoblju nema prijavljenih sredstava.','За этот период привлечённых средств нет.'),
 frWeekly:L('Check-ins per week','Tjedna javljanja','Отчёты по неделям'),frWeekTeams:L('teams reported','timova se javilo','команд отчитались'),
 frMapping:L('The same numbers under funder labels','Iste brojke prema pokazateljima financijera','Те же цифры в терминах фондов'),
 frApprox:L('Approximate mapping, check against your call’s template.','Približna usporedba, provjerite prema predlošku svog poziva.','Приблизительное соответствие, сверьте с шаблоном вашего конкурса.'),
 frApproxNote:L('Labels are paraphrased. The platform does not know the official field numbers of your form, so copy the values into the funder’s own template. ERDF codes are the 2021–2027 common indicators; what counts towards them is decided by your call.','Nazivi su prepričani. Platforma ne zna službene brojeve polja vašeg obrasca, pa vrijednosti prepišite u predložak financijera. Oznake EFRR-a zajednički su pokazatelji za razdoblje 2021.–2027.; što se u njih ubraja, određuje vaš poziv.','Названия даны своими словами. Платформа не знает официальных номеров полей вашей формы, поэтому перенесите значения в шаблон фонда. Коды ЕФРР — общие индикаторы 2021–2027; что в них засчитывается, решает ваш конкурс.'),
 frApproxTag:L('approximate','približno','приблизительно'),frFrom_metric:L('from','iz','из'),
 frTeams:L('Per team','Po timovima','По командам'),frTeam:L('Team','Tim','Команда'),frPeople:L('People','Osobe','Люди'),frCompany:L('Company','Tvrtka','Компания'),frJobs:L('Jobs','Radna mjesta','Рабочие места'),
 frFundingCol:L('Funding','Sredstva','Финансирование'),frRevenue:L('Revenue','Prihod','Выручка'),frCustomers:L('Customers','Kupci','Клиенты'),frAttendance:L('Attendance','Posjećenost','Посещаемость'),
 frMentor:L('Mentor sessions','Sastanci s mentorima','Встречи с менторами'),frCheckins:L('Check-ins','Javljanja','Отчёты'),frTasks:L('Tasks done','Završeni zadaci','Выполненные задания'),frActive:L('Active','Aktivan','Активна'),
 frYes:L('yes','da','да'),frNo:L('no','ne','нет'),frNoTeams:L('No teams in this period.','Nema timova u ovom razdoblju.','В этом периоде нет команд.'),
 frOutcomes:L('Outcomes and their evidence','Rezultati i dokazi','Результаты и подтверждения'),
 frOutcomesNote:L('Teams report outcomes themselves. Mark one as verified once you have seen the evidence: contract, invoice, court register entry.','Timovi sami prijavljuju rezultate. Označite rezultat kao provjeren kad vidite dokaz: ugovor, račun, upis u sudski registar.','Команды сами сообщают о результатах. Отметьте результат как проверенный, когда увидите подтверждение: договор, счёт, запись в реестре.'),
 frVerify:L('Mark verified','Označi kao provjereno','Отметить проверенным'),frUnverify:L('Remove mark','Ukloni oznaku','Снять отметку'),
 frProof_verified:L('verified','provjereno','проверено'),frProof_organiser:L('entered by organiser','unio organizator','внесено организатором'),frProof_self:L('self-reported','prijavio tim','со слов команды'),
 frK_funding:L('funding','prikupljeni novac','привлечены деньги'),frK_hire:L('hire','zapošljavanje','найм'),frK_company:L('company registered','registrirana tvrtka','компания зарегистрирована'),frK_customer:L('customer','kupci koji plaćaju','платящие клиенты'),frK_revenue:L('revenue','prihod','выручка'),
 frSource:L('Where this number comes from','Odakle dolazi ovaj broj','Откуда это число'),frRule:L('How it is counted','Kako se broji','Как считается'),frTable:L('Records','Zapisi','Записи'),
 frNoRecords:L('No records in this period.','Nema zapisa u ovom razdoblju.','Нет записей за этот период.'),frMore:L('more not shown','nije prikazano','не показано'),
 frClose:L('Close','Zatvori','Закрыть'),frInfo:L('Source of','Izvor:','Источник:'),frNotTracked:L('not tracked','ne prati se','не отслеживается'),
 frRecordsN:L('records','zapisa','записей'),frRecordsN_one:L('record','zapis','запись'),frRecordsN_few:L('records','zapisa','записи'),frVerifiedN:L('verified','provjereno','проверено'),frSelfN:L('self-reported','prijavio tim','со слов команды'),
 frAttendedOf:L('marks of','oznaka od','отметок из'),frAttendedOf_one:L('mark of','oznaka od','отметка из'),frAttendedOf_few:L('marks of','oznake od','отметки из'),frBooked:L('booked length of the sessions','rezervirano trajanje sesija','забронированная длительность сессий'),
 frDemo:L('Demo visitors see the report but cannot change records.','Posjetitelji demo verzije vide izvješće, ali ne mogu mijenjati zapise.','В демо отчёт можно смотреть, но записи менять нельзя.'),
 frGenerated:L('Generated','Izrađeno','Сформирован'),frLoading:L('Loading…','Učitavanje…','Загрузка…'),frSaved:L('Saved.','Spremljeno.','Сохранено.'),
 frMappingFrom:L('Platform number','Broj iz platforme','Число платформы'),frNote:L('Note','Napomena','Примечание'),
};
window.BIRD_ACCOUNT_TEXT=Object.assign(window.BIRD_ACCOUNT_TEXT||{},TEXT);

let state={from:'',to:'',data:null,lastHash:null,api:null,lang:'en'};
const tr=k=>{const t=window.BIRD_ACCOUNT_TEXT?.[k];return t?.[state.lang]??t?.en??k;};
// After a number: the form for that count (k_one / k_few) when there is one.
const trp=(k,n)=>window.BirdPluralText?window.BirdPluralText(window.BIRD_ACCOUNT_TEXT,k,n,state.lang):tr(k);
const pick=o=>o?.[state.lang]||o?.en||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LOC={en:'en-GB',hr:'hr-HR',ru:'ru-RU'};
const fmt=n=>n===null||n===undefined?'—':new Intl.NumberFormat(LOC[state.lang],{maximumFractionDigits:1}).format(n);
const fmtDate=iso=>iso?new Intl.DateTimeFormat(LOC[state.lang],{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Zagreb'}).format(new Date(iso.length===10?iso+'T12:00:00Z':iso)):'';
const I=(n,c)=>window.BirdIcon?.(n,c)||'';
const UNIT={EUR:'€','%':'%',h:'h'};
const FUND=['grant','equity','loan','prize','other'];

// A number that counts up once (BirdMotion) and lands formatted; decimals never count, they are shown as they are.
const big=(v,unit='')=>{
 if(v===null||v===undefined)return `<b class="fr-num">—</b>`;
 const counts=Number.isInteger(v)&&v>0;
 return `<b class="fr-num"><span ${counts?`data-count="${v}" data-fr-fmt="${esc(fmt(v))}"`:''}>${esc(fmt(v))}</span>${unit?`<small>${esc(UNIT[unit]||unit)}</small>`:''}</b>`;
};
const info=(key,label)=>`<button type="button" class="fr-i" data-fr="prov" data-key="${esc(key)}" aria-label="${esc(tr('frInfo')+' '+label)}" title="${esc(tr('frSource'))}">i</button>`;
const proofFoot=s=>s.verified===undefined?'':s.total?`${s.total} ${trp('frRecordsN',s.total)} · ${s.verified} ${tr('frVerifiedN')}${s.self?` · ${s.self} ${tr('frSelfN')}`:''}`:'';
function tile(key,icon,{lead=false,foot=''}={}){
 const m=state.data.metrics[key],label=pick(m.label);
 return `<div class="fr-tile ${lead?'is-lead':''}"><div class="fr-tile-top"><span class="fr-ico" aria-hidden="true">${I(icon)}</span><span class="fr-label">${esc(label)}</span>${info(key,label)}</div>${big(m.value,m.unit)}${foot?`<span class="fr-foot">${esc(foot)}</span>`:''}</div>`;
}

function donut(f){
 const total=f.total||0;let at=0;
 const segs=total?FUND.filter(k=>f[k]>0).map((k,j)=>{const p=f[k]/total*100,s=`<circle class="fr-seg is-${k}" r="15.915" cx="21" cy="21" pathLength="100" stroke-dasharray="${p.toFixed(2)} ${(100-p).toFixed(2)}" stroke-dashoffset="${(-at).toFixed(2)}" style="--j:${j}"></circle>`;at+=p;return s;}).join(''):'';
 return `<svg class="fr-donut" viewBox="0 0 42 42" role="img" aria-label="${esc(tr('frFunding')+': '+FUND.map(k=>tr('frF_'+k)+' '+fmt(f[k])+' €').join(', '))}"><circle class="fr-track" r="15.915" cx="21" cy="21"></circle>${segs}</svg>`;
}
function fundingPanel(){
 const f=state.data.funding,max=Math.max(1,...FUND.map(k=>f[k]));
 const bars=`<ol class="fr-bars">${FUND.map((k,j)=>`<li class="is-${k}" style="--j:${j}"><span class="fr-bar-name"><i class="fr-key is-${k}" aria-hidden="true"></i>${esc(tr('frF_'+k))}</span><span class="fr-track-h" aria-hidden="true"><i style="--w:${(f[k]/max*100).toFixed(1)}%"></i></span><b>${esc(fmt(f[k]))} €</b></li>`).join('')}</ol>`;
 return `<section class="fr-card fr-funding" style="--i:1"><header class="fr-card-head"><h3>${I('coin')}<span>${esc(tr('frFunding'))}</span></h3>${info('funding',tr('frFunding'))}</header>
 <div class="fr-funding-body"><div class="fr-donut-box">${donut(f)}<div class="fr-donut-mid"><small>${esc(tr('frTotal'))}</small>${big(f.total,'EUR')}</div></div>${f.total?bars:`<p class="fr-muted">${esc(tr('frNoFunding'))}</p>`}</div></section>`;
}
function weeklyPanel(){
 const w=state.data.checkinWeeks;if(!w.length)return '';
 return `<section class="fr-card fr-weekly" style="--i:2"><header class="fr-card-head"><h3>${I('note')}<span>${esc(tr('frWeekly'))}</span></h3>${info('checkinRate',tr('frWeekly'))}</header>
 <ol class="fr-cols">${w.map((x,j)=>`<li style="--j:${j%20}" title="${esc(x.week+': '+x.done+'/'+x.teams+' '+tr('frWeekTeams'))}"><span class="fr-col" aria-hidden="true"><i style="--h:${x.rate??0}%"></i></span><small aria-hidden="true">${j%Math.ceil(w.length/8)===0||j===w.length-1?esc(x.week.replace(/^\d{4}-/,'')):''}</small><span class="fr-sr">${esc(x.week)}: ${x.done}/${x.teams} ${esc(tr('frWeekTeams'))}</span></li>`).join('')}</ol></section>`;
}
function mappingPanel(){
 return `<section class="fr-card fr-map" style="--i:3"><header class="fr-card-head"><h3>${I('flag')}<span>${esc(tr('frMapping'))}</span></h3><span class="fr-approx">${esc(tr('frApproxTag'))}</span></header>
 <p class="fr-warn">${I('eye')}<span><strong>${esc(tr('frApprox'))}</strong> ${esc(tr('frApproxNote'))}</span></p>
 <div class="fr-map-groups">${state.data.mappings.map(g=>`<article class="fr-map-group"><h4>${esc(pick(g.title))}</h4><ul>${g.rows.map(x=>{const m=x.metric?state.data.metrics[x.metric]:null;return `<li><span class="fr-map-label">${x.code?`<code>${esc(x.code)}</code>`:''}<span>${esc(pick(x.label))}<small>${esc(tr('frApproxTag'))}${m?` · ${esc(tr('frFrom_metric'))} “${esc(pick(m.label))}”`:''}${x.note?' · '+esc(pick(x.note)):''}</small></span></span><span class="fr-map-val">${x.value===null?`<em>${esc(tr('frNotTracked'))}</em>`:`<b>${esc(fmt(x.value))}${x.unit?` ${esc(UNIT[x.unit]||x.unit)}`:''}</b>`}${m?info(x.metric,pick(x.label)):''}</span></li>`;}).join('')}</ul></article>`).join('')}</div></section>`;
}
function teamTable(){
 const t=state.data.teams;if(!t.length)return `<p class="fr-muted">${esc(tr('frNoTeams'))}</p>`;
 const cols=[tr('frTeam'),tr('frPeople'),tr('frCompany'),tr('frJobs'),tr('frFundingCol')+' €',tr('frRevenue')+' €',tr('frCustomers'),tr('frAttendance'),tr('frMentor'),tr('frCheckins'),tr('frTasks'),tr('frActive')];
 const td=(i,v,cls='')=>`<td data-label="${esc(cols[i])}" class="${cls}">${v}</td>`;
 return `<div class="acc-table-wrap"><table class="acc-table fr-table"><thead><tr>${cols.map((c,i)=>`<th ${i?'class="fr-n"':''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.map(x=>`<tr class="${x.active?'':'risk-watch'}"><td><a href="#/admin/team/${esc(x.id)}"><strong>${esc(x.name)}</strong></a>${x.unverified?`<small>${x.unverified} ${esc(tr('frSelfN'))}</small>`:''}</td>${td(1,x.people,'fr-n')}${td(2,x.company?`<span class="fr-yes">${I('check')}${esc(tr('frYes'))}</span>`:esc(tr('frNo')),'fr-n')}${td(3,x.jobs,'fr-n')}${td(4,esc(fmt(x.funding.total)),'fr-n')}${td(5,esc(fmt(x.revenue)),'fr-n')}${td(6,x.customers,'fr-n')}${td(7,x.attendance===null?'—':x.attendance+'%','fr-n')}${td(8,x.mentorSessions,'fr-n')}${td(9,`${x.checkins}/${x.weeks}`,'fr-n')}${td(10,x.tasks,'fr-n')}${td(11,x.active?esc(tr('frYes')):esc(tr('frNo')),'fr-n')}</tr>`).join('')}</tbody></table></div>`;
}
function outcomesPanel(){
 const o=state.data.outcomes;if(!o.total)return '';
 return `<details class="fr-card fr-outcomes" style="--i:5"><summary><span>${I('check')}${esc(tr('frOutcomes'))}</span><span class="fr-proofs">${['verified','organiser','self'].filter(k=>o[k]).map(k=>`<span class="fr-proof is-${k}">${o[k]} ${esc(tr('frProof_'+k))}</span>`).join('')}</span></summary>
 <p class="fr-muted">${esc(tr('frOutcomesNote'))}</p>${state.data.canVerify?'':`<p class="fr-muted">${esc(tr('frDemo'))}</p>`}
 <ul class="fr-records">${o.records.map(r=>recordRow(r,true)).join('')}</ul></details>`;
}
function recordRow(r,actions=false){
 const amount=r.amount!==null&&r.amount!==undefined&&r.amount!==''?(['funding','revenue'].includes(r.kind)?fmt(r.amount)+' €':fmt(r.amount)):'';
 const what=r.kind?tr('frK_'+r.kind)+(r.fundingType?' · '+tr('frF_'+r.fundingType).toLowerCase():''):r.label||'';
 return `<li><span class="fr-rec-main"><strong>${esc(r.team||r.label||r.id)}</strong><small>${[r.date&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)?fmtDate(r.date):r.date,what&&r.team?what:'',r.note].filter(Boolean).map(esc).join(' · ')}</small></span>${amount?`<b class="fr-rec-amt">${esc(amount)}</b>`:''}${r.proof?`<span class="fr-proof is-${r.proof}">${esc(tr('frProof_'+r.proof))}</span>`:''}${actions&&state.data.canVerify&&r.proof!=='organiser'?`<button type="button" class="fr-mini" data-fr="verify" data-id="${esc(r.id)}" data-on="${r.proof==='verified'?'0':'1'}">${esc(tr(r.proof==='verified'?'frUnverify':'frVerify'))}</button>`:''}</li>`;
}
function provenance(key){
 const m=state.data.metrics[key];if(!m)return '';const s=m.source;
 const extra=key==='attendance'?`<p class="fr-muted">${s.attended} ${esc(trp('frAttendedOf',s.attended))} ${s.expected} · ${s.verified} ${esc(tr('frProof_verified'))} · ${s.self} ${esc(tr('frProof_self'))}</p>`:key==='mentorHours'?`<p class="fr-muted">${esc(tr('frBooked'))}</p>`:'';
 const list=key==='mentorHours'||key==='attendance'?state.data.metrics[key==='mentorHours'?'mentorSessions':'lectures'].source:s;
 return `<header class="fr-dlg-head"><div><span class="fr-eyebrow">${esc(tr('frSource'))}</span><h2 id="fr-dlg-title">${esc(pick(m.label))}: ${esc(fmt(m.value))}${m.unit?' '+esc(UNIT[m.unit]||m.unit):''}</h2></div><button type="button" class="fr-x" data-fr="close" aria-label="${esc(tr('frClose'))}">×</button></header>
 <dl class="fr-dl"><dt>${esc(tr('frRule'))}</dt><dd>${esc(pick(s.rule))}</dd><dt>${esc(tr('frTable'))}</dt><dd><code>${esc(s.table)}</code>${s.verified!==undefined?` · ${esc(proofFoot(s))}`:''}</dd></dl>${extra}
 ${list.records.length?`<ul class="fr-records">${list.records.map(r=>recordRow(r)).join('')}</ul>${list.total>list.records.length?`<p class="fr-muted">+${list.total-list.records.length} ${esc(tr('frMore'))}</p>`:''}`:list===s&&!s.records.length?`<p class="fr-muted">${esc(tr('frNoRecords'))}</p>`:''}`;
}

const q=(extra='')=>`?from=${encodeURIComponent(state.from)}&to=${encodeURIComponent(state.to)}&lang=${state.lang}${extra}`;
function body(first){
 const d=state.data,m=d.metrics;
 const today=new Date().toISOString().slice(0,10),year=today.slice(0,4)+'-01-01',quarter=new Date(Date.now()-91*86400000).toISOString().slice(0,10);
 return `<div class="fr ${first?'is-first':''}" data-fr-root>
 <header class="fr-top"><div><span class="fr-eyebrow">${esc(d.workspace)} · ${esc(tr('frBasis_'+d.period.basis))}</span><h2 class="fr-title">${esc(tr('frTitle'))}</h2><p class="fr-muted">${esc(tr('frLede'))}</p></div>
 <div class="fr-exports"><a class="acc-primary" href="/api/admin/report/print${q('&autoprint=1')}" target="_blank" rel="noopener">${I('note')} ${esc(tr('frPrint'))}</a><a class="acc-secondary" href="/api/admin/report.csv${q()}" download>${esc(tr('frCsv'))}</a><a class="acc-secondary" href="/api/admin/report.xlsx${q()}" download>${esc(tr('frXlsx'))}</a><a class="fr-link" href="/api/admin/report.csv${q('&sep=semicolon')}" download>${esc(tr('frCsvSemi'))}</a></div></header>
 <form class="fr-period" data-fr-form><label class="acc-field"><span>${esc(tr('frFrom'))}</span><input type="date" name="from" value="${esc(state.from)}" required></label><label class="acc-field"><span>${esc(tr('frTo'))}</span><input type="date" name="to" value="${esc(state.to)}" required></label><button class="acc-secondary">${esc(tr('frShow'))}</button>
 <div class="fr-presets" role="group"><button type="button" data-fr="preset" data-from="" data-to="">${esc(tr('frPresetDefault'))}</button><button type="button" data-fr="preset" data-from="${quarter}" data-to="${today}">${esc(tr('frPresetQuarter'))}</button><button type="button" data-fr="preset" data-from="${year}" data-to="${today}">${esc(tr('frPresetYear'))}</button></div>
 <small class="fr-muted">${esc(tr('frGenerated'))}: ${esc(fmtDate(d.generated))} · ${esc(fmtDate(d.period.from))} – ${esc(fmtDate(d.period.to))}</small></form>
 <h3 class="fr-h">${esc(tr('frHeadline'))}</h3>
 <div class="fr-tiles is-lead" style="--i:0">${tile('teams','team',{lead:true})}${tile('startups','rocket',{lead:true,foot:proofFoot(m.startups.source)})}${tile('jobs','person',{lead:true,foot:proofFoot(m.jobs.source)})}${tile('funding','coin',{lead:true,foot:proofFoot(m.funding.source)})}</div>
 <div class="fr-tiles" style="--i:0">${tile('people','team')}${tile('revenue','target',{foot:proofFoot(m.revenue.source)})}${tile('customers','hand',{foot:proofFoot(m.customers.source)})}</div>
 <div class="fr-split">${fundingPanel()}${weeklyPanel()}</div>
 <h3 class="fr-h">${esc(tr('frActivity'))}</h3>
 <div class="fr-tiles is-small">${tile('lectures','cap')}${tile('attendance','calendar')}${tile('mentorSessions','chat')}${tile('mentorHours','timer')}${tile('checkinRate','note')}${tile('tasks','checklist')}${tile('activeShare','bolt')}</div>
 ${mappingPanel()}
 <section class="fr-card fr-teams" style="--i:4"><header class="fr-card-head"><h3>${I('team')}<span>${esc(tr('frTeams'))}</span></h3>${info('teams',tr('frTeams'))}</header>${teamTable()}</section>
 ${outcomesPanel()}
 <dialog class="fr-dlg" aria-labelledby="fr-dlg-title"></dialog></div>`;
}

async function load(){
 const d=await state.api('GET','/api/admin/report'+(state.from&&state.to?`?from=${encodeURIComponent(state.from)}&to=${encodeURIComponent(state.to)}`:''));
 state.data=d;state.from=d.period.from;state.to=d.period.to;return d;
}
// Re-draw in place after a period change or a verify mark: no entrance motion, counters show final values.
async function refresh(box,{keepOpen=false}={}){
 const open=keepOpen&&box.querySelector('.fr-outcomes')?.open;
 box.setAttribute('aria-busy','true');
 try{await load();const tmp=document.createElement('div');tmp.innerHTML=body(false);box.replaceWith(tmp.firstElementChild);if(open)document.querySelector('[data-fr-root] .fr-outcomes')?.setAttribute('open','');}
 catch(e){box.removeAttribute('aria-busy');const msg=window.BIRD_ACCOUNT_TEXT?.['e_'+(e?.code||'SERVER_ERROR')];alert(msg?.[state.lang]||msg?.en||e?.code||'Error');}
}

document.addEventListener('submit',e=>{
 const form=e.target.closest?.('[data-fr-form]');if(!form)return;e.preventDefault();
 const f=new FormData(form),from=f.get('from'),to=f.get('to');if(!from||!to)return;
 state.from=from<=to?from:to;state.to=from<=to?to:from;refresh(form.closest('[data-fr-root]'));
});
document.addEventListener('click',async e=>{
 const el=e.target.closest?.('[data-fr]');if(!el)return;const box=el.closest('[data-fr-root]');if(!box)return;
 const act=el.dataset.fr,dlg=box.querySelector('.fr-dlg');
 if(act==='prov'){dlg.innerHTML=provenance(el.dataset.key);dlg.dataset.back=el.dataset.key;try{dlg.showModal();}catch{dlg.setAttribute('open','');}dlg.querySelector('.fr-x')?.focus();return;}
 if(act==='close'){dlg.close?.();dlg.removeAttribute('open');return;}
 if(act==='preset'){state.from=el.dataset.from;state.to=el.dataset.to;refresh(box);return;}
 if(act==='verify'){el.disabled=true;try{await state.api('POST',`/api/admin/report/outcomes/${encodeURIComponent(el.dataset.id)}/verify`,{verified:el.dataset.on==='1'});await refresh(box,{keepOpen:true});}catch(err){el.disabled=false;const msg=window.BIRD_ACCOUNT_TEXT?.['e_'+(err?.code||'SERVER_ERROR')];alert(msg?.[state.lang]||msg?.en||err?.code);}}
});
// Clicking the dimmed backdrop closes the source list.
document.addEventListener('click',e=>{if(e.target.classList?.contains('fr-dlg'))e.target.close?.();});
// Money counts as a plain integer, then lands with its thousands separator (BirdMotion adds .is-landed at the end).
document.addEventListener('animationstart',e=>{const el=e.target;if(el.dataset?.frFmt&&el.classList.contains('is-landed'))el.textContent=el.dataset.frFmt;});

window.BirdReport={
 /** HTML of the tab for account.js; api is account.js's fetch helper (CSRF included). */
 async view({api,lang}){
  state.api=api;state.lang=lang||'en';
  const first=state.lastHash!==location.hash;state.lastHash=location.hash;
  await load();
  return body(first);
 },
};
})();
