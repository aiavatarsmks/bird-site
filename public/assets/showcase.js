'use strict';
/* /mentors and /investors: what each role will get (their join forms are in network.js and investor.js). /contact: who we are and
   the same form with the role picked by the visitor (a select named "role"). Every form goes to the landing's
   pilot-request endpoint with a role (server/leads.mjs), so the owner reads every lead in one list.
   Croatian is in the page; English and Russian here, per page (body[data-page]). */
document.addEventListener('DOMContentLoaded',()=>{
const M=window.SiteMenu;if(!M)return;
const page=document.body.dataset.page;
const COMMON={
 skip:{en:'Skip to content',ru:'К содержанию'},
 status:{en:'Coming soon · the waitlist is open',ru:'Скоро · лист ожидания открыт'},
 getsTitle:{en:'What you will get',ru:'Что вы получите'},
 wlTitle:{en:'Waitlist',ru:'Лист ожидания'},
 fName:{en:'Full name',ru:'Имя и фамилия'},fEmail:{en:'Email',ru:'Почта'},optional:{en:'(optional)',ru:'(необязательно)'},
 fConsent:{en:'I agree to be contacted about the waitlist.',ru:'Я согласен(на), чтобы со мной связались по поводу листа ожидания.'},
 fPrivacy:{en:'We use these details only for the waitlist. We do not share them and delete them on request. <a href="/privacy">Privacy notice</a>',ru:'Данные используем только для листа ожидания. Не передаём третьим лицам и удаляем по запросу. <a href="/privacy">Политика конфиденциальности</a>'},
 fSend:{en:'Put me on the list',ru:'Записаться'},fSending:{hr:'Šaljemo…',en:'Sending…',ru:'Отправляем…'},
 doneTitle:{en:'You are on the list.',ru:'Вы в списке.'},doneText:{en:'We will write to you at',ru:'Мы напишем вам на'},
 errName:{hr:'Upišite ime i prezime.',en:'Enter your name.',ru:'Укажите имя и фамилию.'},
 errOrg:{hr:'Upišite naziv fonda ili organizacije.',en:'Enter the name of your fund or organisation.',ru:'Укажите название фонда или организации.'},
 errEmail:{hr:'Upišite e-poštu, npr. ime@tvrtka.hr.',en:'Enter an email address, e.g. name@company.com.',ru:'Укажите почту, например name@company.com.'},
 errConsent:{hr:'Bez suglasnosti ne možemo vam odgovoriti.',en:'We need your consent to reply.',ru:'Без согласия мы не сможем ответить.'},
 errRate:{hr:'Previše upita s ove adrese. Pokušajte ponovno za sat vremena.',en:'Too many requests from this address. Please try again in an hour.',ru:'Слишком много заявок с этого адреса. Попробуйте через час.'},
 errNet:{hr:'Slanje nije uspjelo. Provjerite vezu i pokušajte ponovno.',en:'Sending failed. Check your connection and try again.',ru:'Не удалось отправить. Проверьте соединение и попробуйте снова.'},
};
const PAGES={
 mentors:{
  eyebrow:{en:'For mentors',ru:'Для менторов'},
  title:{en:'Mentor startups from all over Europe.',ru:'Менторьте стартапы со всей Европы.'},
  lead:{en:'One profile for every hub you work with. Startups find you by expertise and region, other mentors on the map.',ru:'Один профиль для всех хабов, где вы работаете. Стартапы находят вас по экспертизе и региону, другие менторы — по карте.'},
  g1:{en:'Your own space and profile',ru:'Свой кабинет и профиль'},g1t:{en:'Expertise, region, the hubs you work with and your languages. One profile instead of a separate one in every hub.',ru:'Экспертиза, регион, хабы, где вы работаете, и языки. Один профиль вместо отдельного в каждом хабе.'},
  g2:{en:'A network of mentors across hubs',ru:'Сеть менторов поверх хабов'},g2t:{en:'Find another mentor on the map, by category (sales, Big Tech, fundraising…) and by region, open their profile and write to them.',ru:'Найдите другого ментора на карте, по категории (продажи, Big Tech, привлечение денег…) и по региону, откройте профиль и напишите.'},
  g3:{en:'Startups find you',ru:'Стартапы находят вас'},g3t:{en:'A startup from any connected hub sees the mentors of every hub and can write to you. It does not see other hubs’ projects.',ru:'Стартап из любого подключённого хаба видит менторов всех хабов и может вам написать. Проекты других хабов он не видит.'},
  g4:{en:'In your own hub, everything as today',ru:'В своём хабе — всё как сейчас'},g4t:{en:'Office hours, team bookings and meeting notes, as mentors already work in the BIRD hub.',ru:'Часы консультаций, записи команд и заметки со встреч — как менторы уже работают в хабе BIRD.'},
  wlLead:{en:'The mentor space and network are still being built. Leave your details and we will get back to you as soon as the first places open.',ru:'Кабинет ментора и сеть ещё строятся. Оставьте контакт, и мы напишем, как только откроем первые места.'},
  fOrgMentor:{en:'Company or hub',ru:'Компания или хаб'},fMsgMentor:{en:'Area of expertise',ru:'Область экспертизы'},
 },
 investors:{
  eyebrow:{en:'For investors',ru:'Для инвесторов'},
  title:{en:'Startups from European incubators, in one place.',ru:'Стартапы европейских инкубаторов в одном месте.'},
  lead:{en:'Projects from every connected hub, with their stage and the round they are raising, and the details each project chooses to show you.',ru:'Проекты всех подключённых хабов, со стадией и раундом, который они ищут, и с теми данными, которые проект решит вам показать.'},
  g1:{en:'An overview with filters',ru:'Обзор с фильтрами'},g1t:{en:'Startups of every connected hub. Filters: stage (several at once), round size from–to in euros, how much they have raised, round type, country and region, hub.',ru:'Стартапы всех подключённых хабов. Фильтры: стадия (несколько сразу), сумма раунда от–до в евро, сколько уже привлекли, тип раунда, страна и регион, хаб.'},
  g2:{en:'A map of Europe',ru:'Карта Европы'},g2t:{en:'Hubs on the map, and in every hub its projects by stage.',ru:'Хабы на карте, а в каждом хабе — его проекты по стадиям.'},
  g3:{en:'The same stages in every hub',ru:'Одинаковые стадии во всех хабах'},g3t:{en:'Every project has a stage on the same scale, from idea and pitch through MVP and first customer to sales, so projects from different hubs can be compared.',ru:'У каждого проекта стадия по одной шкале — от идеи и презентации через MVP и первого клиента до продаж, — поэтому проекты разных хабов можно сравнивать.'},
  g4:{en:'The project decides what you see',ru:'Что вы видите, решает проект'},g4t:{en:'Which details of a project you see is up to the project and its hub. Nothing is shown without their consent.',ru:'Какие данные проекта вы видите, решают проект и его хаб. Без их согласия ничего не показывается.'},
 },
 contact:{
  cEyebrow:{en:'Contact',ru:'Контакты'},
  cTitle:{en:'Get in touch.',ru:'Напишите нам.'},
  cLead:{en:'Hubvers is a platform for startup incubators and accelerators. We work in Zagreb, Croatia, and run our first pilot with the BIRD incubator.',ru:'Hubvers это платформа для стартап-инкубаторов и акселераторов. Мы работаем в Загребе, в Хорватии, и проводим первый пилот с инкубатором BIRD.'},
  cWhoTitle:{en:'Who we are',ru:'Кто мы'},
  cWhat:{en:'What we do',ru:'Что мы делаем'},cWhatT:{en:'A platform on which an incubator runs its programme: a virtual office, teams, tasks, mentors and reports for programme managers.',ru:'Платформу, на которой инкубатор ведёт свою программу: виртуальный офис, команды, задания, менторы и отчёты для руководителей программы.'},
  cWhere:{en:'Where we are',ru:'Где мы'},cWhereT:{en:'Zagreb, Croatia.',ru:'Загреб, Хорватия.'},
  cPilot:{en:'Pilot',ru:'Пилот'},cPilotT:{en:'Our first pilot runs with the BIRD incubator in Zagreb. The <a href="/demo">demo</a> is open to everyone, no sign-up needed.',ru:'Первый пилот идёт с инкубатором BIRD в Загребе. <a href="/demo">Демо</a> открыто всем, без регистрации.'},
  cHow:{en:'How to reach us',ru:'Как с нами связаться'},cHowT:{en:'Through the form on this page. We reply by email to the address you enter.',ru:'Через форму на этой странице. Отвечаем письмом на адрес, который вы укажете.'},
  cFormTitle:{en:'Write to us',ru:'Напишите нам'},
  cFormLead:{en:'About a pilot in your incubator, the waitlist for mentors and investors, or any question, including questions about your data.',ru:'О пилоте в вашем инкубаторе, о листе ожидания для менторов и инвесторов или с любым вопросом, в том числе о ваших данных.'},
  cRole:{en:'I am writing as',ru:'Я пишу как'},cRoleHub:{en:'Incubator or accelerator',ru:'Инкубатор или акселератор'},cRoleMentor:{en:'Mentor',ru:'Ментор'},cRoleInvestor:{en:'Investor',ru:'Инвестор'},
  cOrg:{en:'Organisation',ru:'Организация'},cMsg:{en:'Message',ru:'Сообщение'},
  cConsent:{en:'I agree to be contacted about this message.',ru:'Я согласен(на), чтобы со мной связались по поводу этого сообщения.'},
  cPrivacy:{en:'We use these details only to reply to you. We do not sell them and delete them on request. <a href="/privacy">Privacy notice</a>',ru:'Данные используем только для ответа вам. Не продаём их и удаляем по запросу. <a href="/privacy">Политика конфиденциальности</a>'},
  cSend:{en:'Send message',ru:'Отправить'},
  cDoneTitle:{en:'Thank you, your message has arrived.',ru:'Спасибо, сообщение получено.'},cDoneText:{en:'We will reply to',ru:'Мы ответим на'},
  errOrg:{hr:'Upišite naziv organizacije.',en:'Enter the name of your organisation.',ru:'Укажите название организации.'},
  errMsg:{hr:'Napišite nam nekoliko riječi.',en:'Write us a few words.',ru:'Напишите нам несколько слов.'},
 },
};
M.add({...COMMON,...PAGES[page]});
const t=k=>M.t(k);

// Waitlist form: checked on submit, errors in one line above the button (they follow the language), the field marked.
const form=document.querySelector('[data-waitlist]');if(!form)return;
const err=form.querySelector('[data-wl-err]'),done=document.querySelector('[data-wl-done]'),send=form.querySelector('[type=submit]');
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
let errKey='';
const showErr=key=>{errKey=key;err.hidden=!key;err.textContent=key?t(key):'';};
M.onLang(()=>{if(errKey)showErr(errKey);});
// /contact: the visitor picks the role; a mentor may write without an organisation, as on /mentors.
const roleSelect=form.elements.role,role=()=>roleSelect?.value||form.dataset.waitlist;
if(roleSelect){
 const org=form.elements.organisation,opt=form.querySelector('[data-org-optional]');
 const sync=()=>{const mentor=role()==='mentor';org.required=!mentor;if(opt)opt.hidden=!mentor;if(mentor&&org.getAttribute('aria-invalid')==='true'){org.setAttribute('aria-invalid','false');showErr('');}};
 roleSelect.addEventListener('change',sync);sync();
}
const problem=el=>{
 const v=el.type==='checkbox'?el.checked:el.value.trim();
 if(el.name==='name')return v.length<2?'errName':'';
 if(el.name==='organisation'&&el.required)return v.length<2?'errOrg':'';
 if(el.name==='email')return EMAIL.test(v)?'':'errEmail';
 if(el.name==='message'&&el.required)return v.length<2?'errMsg':'';
 if(el.name==='consent')return v?'':'errConsent';
 return '';
};
form.addEventListener('input',e=>{if(e.target.getAttribute('aria-invalid')==='true'&&!problem(e.target)){e.target.setAttribute('aria-invalid','false');showErr('');}});
form.addEventListener('submit',async e=>{
 e.preventDefault();
 const fields=[...form.elements].filter(el=>el.name&&el.name!=='website');
 let first=null;
 for(const el of fields){const k=problem(el);el.setAttribute('aria-invalid',String(!!k));if(k&&!first)first=[el,k];}
 if(first){showErr(first[1]);first[0].focus();return;}
 showErr('');
 const f=new FormData(form),body={role:role(),name:f.get('name'),organisation:f.get('organisation')||'',email:f.get('email'),message:f.get('message')||'',consent:f.get('consent')==='on',website:f.get('website')||'',language:M.lang};
 const label=send.querySelector('[data-m]'),key=label.dataset.m;send.disabled=true;label.dataset.m='fSending';label.textContent=t('fSending');
 const stop=()=>{send.disabled=false;label.dataset.m=key;label.textContent=t(key);};
 let r;
 try{r=await fetch('/api/pilot-request',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
 catch{stop();showErr('errNet');return;}
 stop();
 if(r.ok){done.querySelector('[data-wl-email]').textContent=body.email.trim();form.hidden=true;done.hidden=false;done.focus();return;}
 const data=await r.json().catch(()=>({})),field=data?.error?.detail?.field,el=field&&form.elements[field];
 if(el){el.setAttribute('aria-invalid','true');showErr({name:'errName',organisation:'errOrg',email:'errEmail',message:'errMsg',consent:'errConsent'}[field]||'errNet');el.focus?.();return;}
 showErr(r.status===429?'errRate':'errNet');
});
});
