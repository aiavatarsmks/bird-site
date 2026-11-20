'use strict';
/* Hubvers mentor network (server/network.mjs), one script for four pages, by <body data-page>:
   mentors  /mentors            join as a mentor or a startup, sign in, public cards (name, headline, categories, country)
   network  /mentors/network    directory with filters and a map of Europe (signed-in)
   profile  /mentors/@<id>      one profile: Write (the messenger) and Connect (signed-in)
   me       /mentors/me         cabinet: profile, connections, messages (messenger.js), delete my account
   Texts: Croatian is in the pages for the first paint; everything here is {hr,en,ru}. Elements drawn here carry
   data-l="key" (or "cat:sales", "country:HR", "region:cee", "open:calls") and are relabelled when the language changes,
   so nothing typed into a form is lost. The server decides every permission; this file only shows what it is given. */
document.addEventListener('DOMContentLoaded',()=>{
const M=window.SiteMenu;if(!M)return;
const page=document.body.dataset.page;
const X=(hr,en,ru)=>({hr,en,ru});
const D={
 // Static texts of the pages (Croatian also in the markup).
 skip:X('Preskoči na sadržaj','Skip to content','К содержанию'),loading:X('Učitavanje…','Loading…','Загрузка…'),
 netEyebrow:X('Mreža mentora','Mentor network','Сеть менторов'),netTitle:X('Pronađite mentora','Find a mentor','Найдите ментора'),
 netLead:X('Po stručnosti, regiji, zemlji, hubu i jeziku, ili na karti. Profil vide samo prijavljeni korisnici.','By expertise, region, country, hub and language, or on the map. Profiles are visible to signed-in users only.','По экспертизе, региону, стране, хабу и языку или на карте. Профили видят только вошедшие пользователи.'),
 myCabinet:X('Moj kabinet','My cabinet','Мой кабинет'),filtersLabel:X('Filtri','Filters','Фильтры'),searchLabel:X('Traži po imenu','Search by name','Поиск по имени'),
 searchPh:X('Traži po imenu ili opisu','Search by name or headline','Поиск по имени или описанию'),fCategories:X('Stručnost','Expertise','Экспертиза'),
 fRegion:X('Regija','Region','Регион'),fCountry:X('Zemlja','Country','Страна'),fHub:X('Hub','Hub','Хаб'),fLang:X('Jezik','Language','Язык'),
 reset:X('Očisti filtre','Clear filters','Сбросить фильтры'),viewLabel:X('Prikaz','View','Вид'),viewList:X('Popis','List','Список'),viewMap:X('Karta','Map','Карта'),
 mapCap:X('Karta Europe: broj u točki je broj mentora u tom gradu. Odaberite točku.','Map of Europe: the number in a dot is how many mentors are in that city. Choose a dot.','Карта Европы: число в точке — сколько менторов в этом городе. Выберите точку.'),
 meEyebrow:X('Mreža mentora','Mentor network','Сеть менторов'),meTitle:X('Moj kabinet','My cabinet','Мой кабинет'),openNetwork:X('Mreža mentora','Mentor network','Сеть менторов'),
 signOut:X('Odjava','Sign out','Выйти'),cabLabel:X('Kabinet','Cabinet','Кабинет'),tabProfile:X('Profil','Profile','Профиль'),tabConnections:X('Veze','Connections','Связи'),tabMessages:X('Poruke','Messages','Сообщения'),
 backNetwork:X('Mreža mentora','Mentor network','Сеть менторов'),
 jTitle:X('Pridružite se mreži','Join the network','Присоединяйтесь к сети'),
 jLead:X('Mentori dobivaju profil i kabinet. Startupi otvaraju račun kako bi mogli pisati mentorima. Besplatno je.','Mentors get a profile and a cabinet. Startups open an account to write to mentors. It is free.','Менторы получают профиль и кабинет. Стартапы открывают аккаунт, чтобы писать менторам. Это бесплатно.'),
 jTick1:X('E-pošta i telefon nikad se ne prikazuju drugima.','Your email and phone are never shown to anyone.','Почта и телефон никогда не показываются другим.'),
 jTick2:X('Profil vide samo prijavljeni korisnici; javna kartica pokazuje ime, opis, stručnost i zemlju.','Only signed-in users see your profile; the public card shows your name, headline, expertise and country.','Профиль видят только вошедшие пользователи; публичная карточка показывает имя, описание, экспертизу и страну.'),
 jTick3:X('Profil i račun možete obrisati u kabinetu, jednim klikom.','You can delete your profile and account in your cabinet at any time.','Профиль и аккаунт можно удалить в кабинете в любой момент.'),
 cardsTitle:X('Mentori u mreži','Mentors in the network','Менторы в сети'),
 cardsLead:X('Javna kartica: ime, opis, stručnost i zemlja. Cijeli profil, karta i poruke otvaraju se nakon prijave.','Public card: name, headline, expertise and country. The full profile, the map and messages open after you sign in.','Публичная карточка: имя, описание, экспертиза и страна. Полный профиль, карта и сообщения — после входа.'),
 ctaJoin:X('Postanite mentor','Become a mentor','Стать ментором'),ctaSignIn:X('Prijava','Sign in','Войти'),
 // Drawn here.
 any:X('Sve','All','Все'),anyRegion:X('Sve regije','All regions','Все регионы'),anyCountry:X('Sve zemlje','All countries','Все страны'),anyHub:X('Svi hubovi','All hubs','Все хабы'),anyLang:X('Svi jezici','All languages','Все языки'),
 none:X('Nitko ne odgovara filtrima.','Nobody matches these filters.','Под эти фильтры никто не подходит.'),demo:X('Demo profil','Demo profile','Демо-профиль'),you:X('Vi','You','Вы'),
 write:X('Napiši poruku','Write a message','Написать'),connect:X('Poveži se','Connect','Связаться'),outgoing:X('Zahtjev poslan','Request sent','Запрос отправлен'),
 incoming:X('Želi se povezati s vama','Wants to connect with you','Хочет связаться с вами'),accepted:X('Povezani ste','Connected','Вы на связи'),declined:X('Zahtjev je odbijen','Request declined','Запрос отклонён'),
 withdraw:X('Povuci zahtjev','Withdraw','Отозвать'),removeConn:X('Prekini vezu','Remove connection','Удалить связь'),accept:X('Prihvati','Accept','Принять'),decline:X('Odbij','Decline','Отклонить'),
 hubsAt:X('Mentorira u hubovima','Mentors at','Ментор в хабах'),languages:X('Jezici','Languages','Языки'),availability:X('Dostupnost','Availability','Доступность'),
 hours:X('{n} h mjesečno','{n} h a month','{n} ч в месяц'),openTo:X('Otvoren/a za','Open to','Открыт(а) для'),about:X('O meni','About','О себе'),expertise:X('Stručnost','Expertise','Экспертиза'),
 'open:messages':X('poruke','messages','сообщений'),'open:calls':X('pozive','calls','звонков'),'open:investing':X('ulaganje','investing','инвестиций'),
 linkedin:X('LinkedIn profil','LinkedIn profile','Профиль в LinkedIn'),thisIsYou:X('Ovo je vaš profil.','This is your profile.','Это ваш профиль.'),editProfile:X('Uredi profil','Edit profile','Редактировать'),
 connectHint:X('Veze su između mentora. Ali možete pisati svakom mentoru.','Connections are between mentors. You can still write to any mentor.','Связи — между менторами. Но написать можно любому ментору.'),
 limitNote:X('Do {n} zahtjeva za vezu i {n} novih razgovora dnevno.','Up to {n} connection requests and {n} new conversations a day.','До {n} запросов на связь и {n} новых разговоров в день.'),
 gateTitle:X('Prijavite se da biste vidjeli mrežu','Sign in to see the network','Войдите, чтобы увидеть сеть'),
 gateText:X('Profili mentora, karta i poruke dostupni su prijavljenim korisnicima. Račun je besplatan, za mentore i za startupe.','Mentor profiles, the map and messages are for signed-in users. An account is free, for mentors and for startups.','Профили менторов, карта и сообщения доступны после входа. Аккаунт бесплатный — для менторов и стартапов.'),
 gateBtn:X('Prijava ili registracija','Sign in or join','Войти или зарегистрироваться'),
 demoNote:X('Gledate demo kao izmišljeni korisnik i ne možete ništa mijenjati. Odjavite se kako biste otvorili vlastiti račun.','You are looking around the demo as an invented user and cannot change anything. Sign out to open your own account.','Вы смотрите демо как вымышленный пользователь и ничего не можете менять. Выйдите, чтобы открыть свой аккаунт.'),
 tabMentor:X('Ja sam mentor','I am a mentor','Я ментор'),tabStartup:X('Ja sam startup','I am a startup','Я стартап'),tabSignIn:X('Prijava','Sign in','Вход'),
 fName:X('Ime i prezime','Full name','Имя и фамилия'),fLogin:X('Korisničko ime','Username','Логин'),fLoginHint:X('Za prijavu: mala slova, brojke i . _ - @','For signing in: lower-case letters, digits and . _ - @','Для входа: строчные буквы, цифры и . _ - @'),
 fPassword:X('Lozinka','Password','Пароль'),fPasswordHint:X('Najmanje 10 znakova.','At least 10 characters.','Не меньше 10 символов.'),
 fEmail:X('E-pošta','Email','Почта'),optional:X('(neobavezno)','(optional)','(необязательно)'),fEmailHint:X('Vidite je samo vi.','Only you see it.','Видите только вы.'),
 fHeadline:X('Kratki opis','Headline','Кратко о себе'),fHeadlinePh:X('npr. Bivša voditeljica prodaje u SaaS tvrtki','e.g. Former head of sales at a SaaS company','напр. Бывший руководитель продаж в SaaS-компании'),
 fCats:X('Stručnost (do 5)','Expertise (up to 5)','Экспертиза (до 5)'),fCity:X('Grad','City','Город'),fLanguages:X('Jezici','Languages','Языки'),
 fBio:X('O vama','About you','О себе'),fHubs:X('Hubovi u kojima mentorirate','Hubs you mentor at','Хабы, где вы ментор'),fLinkedin:X('LinkedIn','LinkedIn','LinkedIn'),
 fAvailability:X('Sati mjesečno za mentoriranje','Hours a month for mentoring','Часов в месяц на менторство'),fOpenTo:X('Otvoren/a za','Open to','Открыт(а) для'),
 fConsent:X('Pročitao/la sam <a href="/privacy" target="_blank">obavijest o privatnosti</a> i slažem se da se moj profil prikazuje prijavljenim korisnicima.','I have read the <a href="/privacy" target="_blank">privacy notice</a> and agree that signed-in users see my profile.','Я прочитал(а) <a href="/privacy" target="_blank">уведомление о конфиденциальности</a> и согласен(на), что мой профиль видят вошедшие пользователи.'),
 fConsentStartup:X('Pročitao/la sam <a href="/privacy" target="_blank">obavijest o privatnosti</a>.','I have read the <a href="/privacy" target="_blank">privacy notice</a>.','Я прочитал(а) <a href="/privacy" target="_blank">уведомление о конфиденциальности</a>.'),
 submitMentor:X('Otvori profil mentora','Create my mentor profile','Создать профиль ментора'),submitStartup:X('Otvori račun','Create my account','Создать аккаунт'),submitSignIn:X('Prijava','Sign in','Войти'),
 eRequired:X('Ispunite označena polja.','Fill in the marked fields.','Заполните отмеченные поля.'),
 eLogin:X('Korisničko ime: 3–60 znakova, mala slova, brojke i . _ - @','Username: 3–60 characters, lower-case letters, digits and . _ - @','Логин: 3–60 символов, строчные буквы, цифры и . _ - @'),
 eTaken:X('To korisničko ime je zauzeto.','This username is taken.','Этот логин занят.'),ePassword:X('Lozinka mora imati najmanje 10 znakova.','The password needs at least 10 characters.','В пароле нужно не меньше 10 символов.'),
 eEmail:X('Provjerite e-poštu.','Check the email address.','Проверьте адрес почты.'),eCats:X('Odaberite od 1 do 5 područja stručnosti.','Choose 1 to 5 areas of expertise.','Выберите от 1 до 5 областей экспертизы.'),
 eLangs:X('Odaberite barem jedan jezik.','Choose at least one language.','Выберите хотя бы один язык.'),eConsent:X('Potvrdite obavijest o privatnosti.','Please confirm the privacy notice.','Подтвердите уведомление о конфиденциальности.'),
 eLoginBad:X('Pogrešno korisničko ime ili lozinka.','Wrong username or password.','Неверный логин или пароль.'),eRate:X('Previše pokušaja. Pokušajte kasnije.','Too many attempts. Try again later.','Слишком много попыток. Попробуйте позже.'),
 eNet:X('Nešto nije uspjelo. Pokušajte ponovno.','Something went wrong. Try again.','Что-то пошло не так. Попробуйте ещё раз.'),eLinkedin:X('Upišite adresu LinkedIn profila (linkedin.com/in/…).','Enter a LinkedIn profile address (linkedin.com/in/…).','Укажите адрес профиля LinkedIn (linkedin.com/in/…).'),
 eHeadline:X('Napišite kratki opis (2–120 znakova).','Write a headline (2–120 characters).','Напишите краткое описание (2–120 символов).'),eCountry:X('Odaberite zemlju.','Choose a country.','Выберите страну.'),eCity:X('Upišite grad.','Enter a city.','Укажите город.'),
 eName:X('Upišite ime.','Enter your name.','Укажите имя.'),eAvailability:X('Sati: od 0 do 160.','Hours: 0 to 160.','Часы: от 0 до 160.'),eBio:X('Opis je predug (najviše 1500 znakova).','The text is too long (1500 characters at most).','Текст слишком длинный (не больше 1500 символов).'),
 eDemo:X('U demo pregledu ne možete mijenjati podatke.','You cannot change anything in the demo.','В демо ничего нельзя менять.'),
 codesTitle:X('Spremite kodove za oporavak','Save your recovery codes','Сохраните коды восстановления'),
 codesText:X('Ako zaboravite lozinku, jednim od ovih kodova postavljate novu. Svaki vrijedi jednom. Prikazujemo ih samo sada.','If you forget your password, one of these codes sets a new one. Each works once. We show them only now.','Если забудете пароль, любой из этих кодов позволит задать новый. Каждый действует один раз. Показываем их только сейчас.'),
 codesDone:X('Spremio/la sam, nastavi','Saved, continue','Сохранил(а), дальше'),
 signedAs:X('Prijavljeni ste kao','Signed in as','Вы вошли как'),
 cardsEmpty:X('Još nema profila.','No profiles yet.','Профилей пока нет.'),
 hello:X('Pozdrav, {n}','Hello, {n}','Здравствуйте, {n}'),
 noProfileTitle:X('Još nemate profil mentora','You have no mentor profile yet','У вас пока нет профиля ментора'),
 noProfileText:X('Kao startup možete pregledavati mrežu i pisati mentorima. Ako i sami mentorirate, ispunite profil ispod.','As a startup you can browse the network and write to mentors. If you mentor too, fill in the profile below.','Как стартап вы можете смотреть сеть и писать менторам. Если вы и сами ментор, заполните профиль ниже.'),
 save:X('Spremi profil','Save profile','Сохранить профиль'),saved:X('Spremljeno.','Saved.','Сохранено.'),
 photo:X('Fotografija','Photo','Фото'),photoAdd:X('Dodaj fotografiju','Add a photo','Добавить фото'),photoRemove:X('Ukloni fotografiju','Remove the photo','Убрать фото'),
 photoHint:X('Vide je samo prijavljeni korisnici. Bez fotografije prikazuju se inicijali.','Only signed-in users see it. Without a photo, your initials are shown.','Её видят только вошедшие пользователи. Без фото показываются инициалы.'),
 photoBad:X('Ova se slika ne može koristiti. Pokušajte JPG ili PNG.','This picture cannot be used. Try a JPG or PNG.','Эту картинку нельзя использовать. Попробуйте JPG или PNG.'),
 myHubs:X('Moji hubovi','My hubs','Мои хабы'),viewProfile:X('Pogledaj svoj profil','View my profile','Посмотреть мой профиль'),
 deleteTitle:X('Brisanje računa','Delete my account','Удаление аккаунта'),
 deleteText:X('Briše profil, fotografiju, veze i privatne poruke te zatvara račun. Ne može se poništiti.','Deletes your profile, photo, connections and private messages, and closes the account. This cannot be undone.','Удаляет профиль, фото, связи и личные сообщения и закрывает аккаунт. Отменить нельзя.'),
 deletePassword:X('Lozinka za potvrdu','Your password, to confirm','Пароль для подтверждения'),deleteBtn:X('Obriši moj račun','Delete my account','Удалить мой аккаунт'),
 deleteConfirm:X('Sigurno obrisati račun, profil i sve poruke?','Delete your account, profile and all messages for good?','Точно удалить аккаунт, профиль и все сообщения?'),
 deleted:X('Račun je obrisan. Hvala što ste bili s nama.','Your account has been deleted. Thank you for being with us.','Аккаунт удалён. Спасибо, что были с нами.'),
 adminNoDelete:X('Organizatori ne mogu ovdje obrisati račun.','Organisers cannot delete their account here.','Организаторы не могут удалить аккаунт здесь.'),
 connIncoming:X('Zahtjevi za vezu','Connection requests','Запросы на связь'),connMine:X('Moje veze','My connections','Мои связи'),connOutgoing:X('Poslani zahtjevi','Sent requests','Отправленные запросы'),
 connNone:X('Još nemate veza. Pronađite mentore u mreži i pošaljite zahtjev.','No connections yet. Find mentors in the network and send a request.','Связей пока нет. Найдите менторов в сети и отправьте запрос.'),
 startup:X('Startup','Startup','Стартап'),
 notFound:X('Profil nije pronađen.','Profile not found.','Профиль не найден.'),close:X('Zatvori','Close','Закрыть'),
 inCity:X('{c}: mentori','{c}: mentors','{c}: менторы'),
 mentorsN:X(n=>n%10===1&&n%100!==11?n+' mentor':n+' mentora',n=>n===1?'1 mentor':n+' mentors',n=>n+' '+(n%10===1&&n%100!==11?'ментор':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'ментора':'менторов')),
};
const pageKeys={};for(const [k,v] of Object.entries(D))if(typeof v.en==='string')pageKeys[k]={en:v.en,ru:v.ru};
M.add(pageKeys);

// Helpers ---------------------------------------------------------------------------------------------------------
let meta=null;
const lang=()=>M.lang;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc=o=>o?.[lang()]??o?.hr??o?.en??'';
function L(key,vars={}){
 const [kind,id]=key.includes(':')&&!D[key]?key.split(/:(.*)/):[null,null];
 if(kind==='cat')return loc(meta?.categories?.[id])||id;
 if(kind==='country')return loc(meta?.countries?.[id]?.name)||id;
 if(kind==='region')return loc(meta?.regions?.find(r=>r.id===id)?.name)||id;
 if(kind==='lng')return meta?.languages?.[id]||id;
 if(kind==='hub')return hubName(id);
 const v=D[key]?.[lang()]??D[key]?.hr??key;
 return typeof v==='function'?v(vars.n):String(v).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
// data-l: text; data-lh: trusted markup from D (links to /privacy); data-lph: placeholder; data-lv: JSON vars.
function relabel(root=document){
 root.querySelectorAll('[data-l]').forEach(el=>{const v=L(el.dataset.l,el.dataset.lv?JSON.parse(el.dataset.lv):{});if(el.textContent!==v)el.textContent=v;});
 root.querySelectorAll('[data-lh]').forEach(el=>{const v=L(el.dataset.lh);if(el.innerHTML!==v)el.innerHTML=v;});
 root.querySelectorAll('[data-lph]').forEach(el=>el.setAttribute('placeholder',L(el.dataset.lph)));
}
const l=(key,vars)=>`<span data-l="${esc(key)}"${vars?` data-lv='${esc(JSON.stringify(vars))}'`:''}>${esc(L(key,vars))}</span>`;
const initials=n=>String(n||'?').trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase()||'?';
const avatar=(p,size='')=>p.photo?`<img class="net-av ${size}" src="/api/network/people/${encodeURIComponent(p.id)}/photo" alt="" loading="lazy" width="96" height="96">`:`<span class="net-av ${size}" aria-hidden="true">${esc(initials(p.name))}</span>`;
const chips=(cats=[])=>`<ul class="net-tags">${cats.map(c=>`<li>${l('cat:'+c)}</li>`).join('')}</ul>`;
const safeNext=v=>/^\/mentors(\/[A-Za-z0-9@_\/-]*)?(#[A-Za-z0-9\/_-]*)?$/.test(v||'')?v:'';

// Session and calls. The messenger hears about sign-in and sign-out through the 'bird:auth' event, as in the app.
const S={user:undefined,csrf:''};
async function who(){
 try{const d=await (await fetch('/api/auth/me',{credentials:'same-origin'})).json();S.user=d.user||null;S.csrf=d.csrf||'';}catch{S.user=null;}
 return S.user;
}
const isDemoVisit=()=>!!S.user?.id?.startsWith('demo-user-');
async function api(method,url,body,{raw,type}={}){
 const h={};if(body!==undefined)h['content-type']=type||'application/json';if(method!=='GET'&&S.csrf)h['x-csrf-token']=S.csrf;
 let r;try{r=await fetch(url,{method,credentials:'same-origin',headers:h,body:body===undefined?undefined:raw?body:JSON.stringify(body)});}catch{return {ok:false,status:0,data:{}};}
 const data=await r.json().catch(()=>({}));
 if(data?.csrf)S.csrf=data.csrf;
 return {ok:r.ok,status:r.status,data,code:data?.error?.code||'',field:data?.error?.detail?.field||''};
}
const announce=()=>dispatchEvent(new CustomEvent('bird:auth',{detail:{user:S.user,csrf:S.csrf}}));
async function signOut(to){await api('POST','/api/auth/logout');S.user=null;S.csrf='';announce();if(to)location.href=to;}
async function loadMeta(){if(!meta){const r=await api('GET','/api/network/meta');meta=r.ok?r.data:{categories:{},countries:{},regions:[],hubs:[],languages:{},openTo:[]};}return meta;}
const countryOptions=(sel='',empty='')=>`${empty?`<option value="">${esc(L(empty))}</option>`:'<option value=""></option>'}${Object.keys(meta.countries).sort((a,b)=>L('country:'+a).localeCompare(L('country:'+b),lang())).map(c=>`<option value="${c}"${c===sel?' selected':''} data-l="country:${c}">${esc(L('country:'+c))}</option>`).join('')}`;
function gate(next){
 const el=document.querySelector('[data-net-gate]');if(!el)return;
 el.hidden=false;
 el.innerHTML=`<div class="net-gate-in"><h2>${l('gateTitle')}</h2><p class="lead">${l('gateText')}</p><p><a class="btn" href="/mentors?next=${encodeURIComponent(next||location.pathname+location.hash)}#join"><span data-l="gateBtn">${esc(L('gateBtn'))}</span> <span aria-hidden="true">→</span></a></p></div>`;
}
const demoBanner=()=>isDemoVisit()?`<p class="note net-demo-note"><span data-l="demoNote">${esc(L('demoNote'))}</span> <button class="net-link" type="button" data-net-out>${l('signOut')}</button></p>`:'';
document.addEventListener('click',e=>{if(e.target.closest('[data-net-out]')){e.preventDefault();signOut(location.pathname==='/mentors'?'/mentors#join':location.href);}});

// Error line of a form: the message follows the language; the field is marked.
const FIELD_ERR={login:'eLogin',password:'ePassword',email:'eEmail',categories:'eCats',languages:'eLangs',consent:'eConsent',linkedin:'eLinkedin',headline:'eHeadline',country:'eCountry',city:'eCity',displayName:'eName',availability:'eAvailability',bio:'eBio'};
function showError(form,res){
 const box=form.querySelector('.net-err');
 form.querySelectorAll('[aria-invalid=true]').forEach(el=>el.setAttribute('aria-invalid','false'));
 if(!res){box.hidden=true;box.innerHTML='';return;}
 const key=res.code==='LOGIN_TAKEN'?'eTaken':res.code==='WEAK_PASSWORD'?'ePassword':res.code==='INVALID_LOGIN'?'eLoginBad':res.code==='RATE_LIMITED'?'eRate':res.code==='DEMO_READ_ONLY'?'eDemo':res.code==='INVALID_FIELDS'&&FIELD_ERR[res.field]?FIELD_ERR[res.field]:res.code==='INVALID_FIELDS'?'eRequired':'eNet';
 const name=res.code==='WEAK_PASSWORD'?'password':res.field==='displayName'?'name':res.field;
 const el=name&&(form.querySelector(`[name="${name}"]`));
 if(el){el.setAttribute('aria-invalid','true');(el.closest('fieldset')||el).scrollIntoView?.({block:'center'});el.focus?.({preventScroll:true});}
 box.hidden=false;box.innerHTML=l(key);
}
async function busy(btn,fn){btn.disabled=true;try{return await fn();}finally{btn.disabled=false;}}

// Profile fields: the sign-up shows the required ones; the cabinet all of them.
function profileFields(p={},{full=false}={}){
 const has=(list,v)=>(list||[]).includes(v);
 const chipBox=(name,items,checked,lab)=>`<div class="chips">${items.map(v=>`<label class="chip"><input type="checkbox" name="${name}" value="${esc(v)}"${has(checked,v)?' checked':''}><span data-l="${esc(lab(v))}">${esc(L(lab(v)))}</span></label>`).join('')}</div>`;
 return `
 <label class="net-f"><span>${l('fHeadline')}</span><input name="headline" required minlength="2" maxlength="120" value="${esc(p.headline||'')}" data-lph="fHeadlinePh" placeholder="${esc(L('fHeadlinePh'))}"></label>
 <fieldset class="net-f"><legend>${l('fCats')}</legend>${chipBox('categories',Object.keys(meta.categories),p.categories,v=>'cat:'+v)}</fieldset>
 <div class="net-two">
  <label class="net-f"><span>${l('fCountry')}</span><select name="country" required>${countryOptions(p.country||'')}</select></label>
  <label class="net-f"><span>${l('fCity')}</span><input name="city" required maxlength="80" value="${esc(p.city||'')}" autocomplete="address-level2"></label>
 </div>
 <fieldset class="net-f"><legend>${l('fLanguages')}</legend>${chipBox('languages',Object.keys(meta.languages),p.languages,v=>'lng:'+v)}</fieldset>
 ${full?`
 <fieldset class="net-f"><legend>${l('fHubs')} <span class="opt">${l('optional')}</span></legend>${meta.hubs.length?chipBox('hubs',meta.hubs.map(h=>h.id),p.hubs,v=>'hub:'+v):''}</fieldset>
 <label class="net-f"><span>${l('fBio')} <span class="opt">${l('optional')}</span></span><textarea name="bio" maxlength="1500" rows="5">${esc(p.bio||'')}</textarea></label>
 <div class="net-two">
  <label class="net-f"><span>${l('fLinkedin')} <span class="opt">${l('optional')}</span></span><input name="linkedin" type="url" maxlength="200" inputmode="url" placeholder="https://www.linkedin.com/in/…" value="${esc(p.linkedin||'')}"></label>
  <label class="net-f"><span>${l('fAvailability')}</span><input name="availability" type="number" min="0" max="160" step="1" inputmode="numeric" value="${esc(p.availability??4)}"></label>
 </div>
 <fieldset class="net-f"><legend>${l('fOpenTo')}</legend>${chipBox('openTo',meta.openTo,p.openTo||['messages'],v=>'open:'+v)}</fieldset>`:''}`;
}
// Hubs keep their own names in every language.
const hubName=id=>meta?.hubs?.find(h=>h.id===id)?.name||id;
function readProfile(form,full){
 const f=new FormData(form),all=n=>f.getAll(n).map(String);
 const p={headline:f.get('headline')||'',country:f.get('country')||'',city:f.get('city')||'',categories:all('categories'),languages:all('languages')};
 if(full)Object.assign(p,{hubs:all('hubs'),bio:f.get('bio')||'',linkedin:f.get('linkedin')||'',availability:Number(f.get('availability')||0),openTo:all('openTo')});
 return p;
}
// Checks on the way out, so the commonest slips are named before a round trip; the server checks everything again.
function precheck(form,p){
 if(p.categories.length<1||p.categories.length>5)return {code:'INVALID_FIELDS',field:'categories'};
 if(p.languages.length<1)return {code:'INVALID_FIELDS',field:'languages'};
 return null;
}
function codesView(codes,next){
 return `<div class="net-codes" tabindex="-1"><h3>${l('codesTitle')}</h3><p>${l('codesText')}</p><ol class="net-code-list">${codes.map(c=>`<li><code>${esc(c)}</code></li>`).join('')}</ol><p><a class="btn" href="${esc(next)}"><span data-l="codesDone">${esc(L('codesDone'))}</span> <span aria-hidden="true">→</span></a></p></div>`;
}

// /mentors: join or sign in, and the public cards ------------------------------------------------------------------
async function pageMentors(){
 const host=document.querySelector('[data-net-join]'),cardsHost=document.querySelector('[data-net-cards]');
 await Promise.all([who(),loadMeta()]);
 const next=safeNext(new URLSearchParams(location.search).get('next'));
 let tab=next?'signin':'mentor';
 document.querySelector('[data-net-signin]')?.addEventListener('click',()=>{tab='signin';draw();});
 document.querySelector('[data-net-cta]')?.addEventListener('click',()=>{if(!S.user||isDemoVisit()){tab='mentor';draw();}});
 function draw(){
  if(S.user&&!isDemoVisit()){
   host.innerHTML=`<div class="net-signed"><p>${l('signedAs')} <b>${esc(S.user.displayName)}</b></p><p class="net-actions"><a class="btn" href="${esc(next||'/mentors/me')}"><span data-l="myCabinet">${esc(L('myCabinet'))}</span> <span aria-hidden="true">→</span></a><a class="btn btn-ghost" href="/mentors/network"><span data-l="openNetwork">${esc(L('openNetwork'))}</span></a></p><p><button class="net-link" type="button" data-net-out>${l('signOut')}</button></p></div>`;
   return;
  }
  const tabs=[['mentor','tabMentor'],['startup','tabStartup'],['signin','tabSignIn']];
  host.innerHTML=`${demoBanner()}<div class="net-jtabs" role="tablist">${tabs.map(([k,t])=>`<button type="button" role="tab" id="jt-${k}" aria-controls="jp" aria-selected="${k===tab}" data-jtab="${k}">${l(t)}</button>`).join('')}</div>
  <form class="wl net-form" id="jp" role="tabpanel" aria-labelledby="jt-${tab}" novalidate>${tab==='signin'?`
   <label class="net-f"><span>${l('fLogin')}</span><input name="login" required autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="60"></label>
   <label class="net-f"><span>${l('fPassword')}</span><input name="password" type="password" required autocomplete="current-password" maxlength="200"></label>`:`
   <label class="net-f"><span>${l('fName')}</span><input name="name" required maxlength="80" autocomplete="name"></label>
   <div class="net-two">
    <label class="net-f"><span>${l('fLogin')}</span><input name="login" required autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="60" aria-describedby="h-login"><small id="h-login" class="fine">${l('fLoginHint')}</small></label>
    <label class="net-f"><span>${l('fPassword')}</span><input name="password" type="password" required minlength="10" autocomplete="new-password" maxlength="200" aria-describedby="h-pw"><small id="h-pw" class="fine">${l('fPasswordHint')}</small></label>
   </div>
   <label class="net-f"><span>${l('fEmail')} <span class="opt">${l('optional')}</span></span><input name="email" type="email" autocomplete="email" maxlength="200" aria-describedby="h-em"><small id="h-em" class="fine">${l('fEmailHint')}</small></label>
   ${tab==='mentor'?profileFields({languages:[lang()==='ru'?'en':lang()]}):''}
   <label class="check"><input name="consent" type="checkbox" required><span data-lh="${tab==='mentor'?'fConsent':'fConsentStartup'}">${L(tab==='mentor'?'fConsent':'fConsentStartup')}</span></label>`}
   <p class="wl-err net-err" role="alert" hidden></p>
   <p><button class="btn" type="submit"><span data-l="${tab==='signin'?'submitSignIn':tab==='mentor'?'submitMentor':'submitStartup'}">${esc(L(tab==='signin'?'submitSignIn':tab==='mentor'?'submitMentor':'submitStartup'))}</span> <span aria-hidden="true">→</span></button></p>
   ${tab==='mentor'?`<p class="fine">${l('limitNote',{n:meta.dailyRequests||20})}</p>`:''}
  </form>`;
  host.querySelectorAll('[data-jtab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.jtab;draw();host.querySelector(`[data-jtab="${tab}"]`).focus();}));
  host.querySelector('[role=tablist]').addEventListener('keydown',e=>{const i=tabs.findIndex(t=>t[0]===tab),d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(d){tab=tabs[(i+d+tabs.length)%tabs.length][0];draw();host.querySelector(`[data-jtab="${tab}"]`).focus();}});
  const form=host.querySelector('form');
  form.addEventListener('submit',e=>{e.preventDefault();busy(form.querySelector('[type=submit]'),()=>submit(form));});
 }
 async function submit(form){
  const f=new FormData(form);
  // A visitor still borrowing an invented demo account signs out of it first.
  if(isDemoVisit())await signOut();
  if(tab==='signin'){
   const r=await api('POST','/api/auth/login',{login:f.get('login'),password:f.get('password')});
   if(!r.ok)return showError(form,r);
   S.user=r.data.user;announce();location.href=next||'/mentors/network';return;
  }
  if(!f.get('consent'))return showError(form,{code:'INVALID_FIELDS',field:'consent'});
  const body={login:String(f.get('login')||'').trim().toLowerCase(),password:f.get('password'),displayName:String(f.get('name')||'').trim(),email:String(f.get('email')||'').trim(),language:lang(),consent:true};
  if(!body.displayName)return showError(form,{code:'INVALID_FIELDS',field:'displayName'});
  if(tab==='mentor'){body.profile=readProfile(form,false);body.profile.openTo=['messages'];body.profile.availability=4;const bad=precheck(form,body.profile);if(bad)return showError(form,bad);}
  const r=await api('POST','/api/network/signup/'+(tab==='mentor'?'mentor':'member'),body);
  if(!r.ok)return showError(form,r);
  S.user=r.data.user;announce();
  host.innerHTML=codesView(r.data.recoveryCodes||[],next||(tab==='mentor'?'/mentors/me#profile':'/mentors/network'));
  host.querySelector('.net-codes').focus();
 }
 draw();
 if(location.hash==='#join'&&next)host.scrollIntoView();
 // Public cards: no contacts, no city; the profile itself needs an account.
 const r=await api('GET','/api/network/cards/mentor');
 const drawCards=()=>{if(!r.ok)return;cardsHost.innerHTML=r.data.items.length?r.data.items.slice(0,12).map(p=>`<a class="net-card" href="/mentors/@${encodeURIComponent(p.id)}">${avatar({...p,photo:false})}<span class="net-card-main"><b>${esc(p.name)}</b><span class="net-card-h">${esc(p.headline)}</span><span class="fine">${l('country:'+p.country)}${p.demo?` · ${l('demo')}`:''}</span>${chips(p.categories)}</span></a>`).join(''):`<p class="fine">${l('cardsEmpty')}</p>`;};
 drawCards();
 M.onLang(()=>relabel());
}

// /mentors/network: filters, list and map ---------------------------------------------------------------------------
async function pageNetwork(){
 await Promise.all([who(),loadMeta()]);
 if(!S.user)return gate();
 document.querySelector('[data-net-me]').hidden=false;
 const dir=document.querySelector('[data-net-dir]');dir.hidden=false;
 if(isDemoVisit())dir.querySelector('.wrap').insertAdjacentHTML('afterbegin',demoBanner());
 const form=dir.querySelector('[data-net-filters]'),list=dir.querySelector('[data-net-list]'),mapView=dir.querySelector('[data-net-mapview]'),side=dir.querySelector('[data-net-side]'),count=dir.querySelector('[data-net-count]');
 const params=new URLSearchParams(location.search);
 let view=params.get('view')==='map'?'map':'list',data={items:[],places:[]},openPlace=params.get('place')||'';
 // Filters, drawn from the server's lists.
 const selected=new Set((params.get('category')||'').split(',').filter(Boolean));
 dir.querySelector('[data-net-cats]').innerHTML=Object.keys(meta.categories).map(c=>`<label class="chip"><input type="checkbox" name="category" value="${c}"${selected.has(c)?' checked':''}><span data-l="cat:${c}">${esc(L('cat:'+c))}</span></label>`).join('');
 const fill=(sel,html,v)=>{const el=dir.querySelector(sel);el.innerHTML=html;el.value=v||'';};
 fill('[data-net-region]',`<option value="" data-l="anyRegion">${esc(L('anyRegion'))}</option>`+meta.regions.map(r=>`<option value="${esc(r.id)}" data-l="region:${esc(r.id)}">${esc(L('region:'+r.id))}</option>`).join(''),params.get('region'));
 fill('[data-net-country]',countryOptions('', 'anyCountry').replace('<option value="">','<option value="" data-l="anyCountry">'),params.get('country'));
 fill('[data-net-hub]',`<option value="" data-l="anyHub">${esc(L('anyHub'))}</option>`+meta.hubs.map(h=>`<option value="${esc(h.id)}">${esc(h.name)}</option>`).join(''),params.get('hub'));
 fill('[data-net-lang]',`<option value="" data-l="anyLang">${esc(L('anyLang'))}</option>`+Object.entries(meta.languages).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join(''),params.get('lang'));
 form.elements.q.value=params.get('q')||'';
 const query=()=>{const f=new FormData(form),q=new URLSearchParams();const cats=f.getAll('category');if(cats.length)q.set('category',cats.join(','));for(const k of ['region','country','hub','lang'])if(f.get(k))q.set(k,f.get(k));const s=String(f.get('q')||'').trim();if(s)q.set('q',s);return q;};
 let seq=0;
 async function load(){
  const q=query(),n=++seq;
  const r=await api('GET','/api/network/directory/mentor?'+q);
  if(n!==seq)return;
  if(!r.ok){list.innerHTML=`<p class="fine">${l('eNet')}</p>`;return;}
  data=r.data;
  if(view==='map')q.set('view','map');if(openPlace&&view==='map')q.set('place',openPlace);
  history.replaceState(null,'',location.pathname+(q.size?'?'+q:''));
  draw();
 }
 const card=p=>`<a class="net-card" href="/mentors/@${encodeURIComponent(p.id)}">${avatar(p)}<span class="net-card-main"><b>${esc(p.name)}${p.me?` <span class="net-pill">${l('you')}</span>`:''}</b><span class="net-card-h">${esc(p.headline)}</span><span class="fine">${esc(p.city)} · ${l('country:'+p.country)}${p.demo?` · ${l('demo')}`:''}</span>${chips(p.categories)}<span class="fine net-card-langs">${p.languages.map(x=>esc(meta.languages[x]||x)).join(' · ')}</span>${p.connection==='accepted'?`<span class="net-pill is-ok">${l('accepted')}</span>`:p.connection==='incoming'?`<span class="net-pill">${l('incoming')}</span>`:''}</span></a>`;
 // Lambert azimuthal equal-area, the same projection as /hubs (data-proj on the <svg>).
 const svg=dir.querySelector('[data-net-map]'),dots=svg?.querySelector('[data-dots]');
 const [PS,TX,TY,RL,RP]=(svg?.dataset.proj||'1,0,0,0,0').split(',').map(Number),R=Math.PI/180;
 function project(lat,lon){const lo=(lon+RL)*R,p=lat*R,dp=RP*R,x=Math.cos(lo)*Math.cos(p),y=Math.sin(lo)*Math.cos(p),z=Math.sin(p),k=z*Math.cos(dp)+x*Math.sin(dp);const Lm=Math.atan2(y,x*Math.cos(dp)-z*Math.sin(dp)),P=Math.asin(k),c=Math.sqrt(2/(1+Math.cos(Lm)*Math.cos(P)));return [TX+PS*c*Math.cos(P)*Math.sin(Lm),TY-PS*c*Math.sin(P)];}
 function draw(){
  count.textContent=L('mentorsN',{n:data.items.length});
  dir.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  list.hidden=view!=='list';mapView.hidden=view!=='map';
  if(view==='list')list.innerHTML=data.items.length?`<div class="net-grid">${data.items.map(card).join('')}</div>`:`<p class="net-empty">${l('none')}</p>`;
  if(view==='map'&&dots){
   if(openPlace&&!data.places.some(p=>p.key===openPlace))openPlace='';
   // The map zooms to where the mentors are (never beyond the whole of Europe), so close cities stay apart.
   const pts=data.places.map(p=>project(p.lat,p.lon)),k=frame(pts);
   dots.innerHTML=data.places.map((p,i)=>{const [x,y]=pts[i],r=Math.min(22,10+p.count*2);return `<g class="net-pin${p.key===openPlace?' is-on':''}" data-place="${esc(p.key)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(3)})" tabindex="0" role="button" aria-label="${esc(loc(p.name)+': '+L('mentorsN',{n:p.count}))}" aria-pressed="${p.key===openPlace}"><circle r="${r}"/><text y="5">${p.count}</text><text class="net-pin-name" x="${r+5}" y="${-r+6}">${esc(loc(p.name))}</text></g>`;}).join('');
   drawSide();
  }
 }
 function frame(pts){
  const W=800,H=640,pad=70;
  if(!pts.length){svg.setAttribute('viewBox',`0 0 ${W} ${H}`);return 1;}
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  let w=Math.max(320,Math.max(...xs)-Math.min(...xs)+2*pad),h=Math.max(Math.max(...ys)-Math.min(...ys)+2*pad,w*H/W);
  w=Math.min(W,Math.max(w,h*W/H));h=w*H/W;
  const cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;
  const x=Math.min(W-w,Math.max(0,cx-w/2)),y=Math.min(H-h,Math.max(0,cy-h/2));
  svg.setAttribute('viewBox',`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
  return w/W;
 }
 function drawSide(){
  const p=data.places.find(x=>x.key===openPlace);
  side.hidden=!p;mapView.classList.toggle('has-side',!!p);
  if(!p){side.innerHTML='';return;}
  const people=data.items.filter(i=>i.place===p.key);
  side.innerHTML=`<div class="net-side-head"><h2>${esc(loc(p.name))}</h2><button class="net-x" type="button" data-close aria-label="${esc(L('close'))}">×</button></div><p class="fine">${l('country:'+p.country)} · ${esc(L('mentorsN',{n:people.length}))}</p><div class="net-side-list">${people.map(card).join('')}</div>`;
 }
 const pickPlace=key=>{openPlace=openPlace===key?'':key;draw();const q=query();q.set('view','map');if(openPlace)q.set('place',openPlace);history.replaceState(null,'',location.pathname+'?'+q);if(openPlace)side.querySelector('.net-side-head h2')?.focus?.();};
 dots?.addEventListener('click',e=>{const g=e.target.closest('[data-place]');if(g)pickPlace(g.dataset.place);});
 dots?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const g=e.target.closest('[data-place]');if(g){e.preventDefault();pickPlace(g.dataset.place);}}});
 side.addEventListener('click',e=>{if(e.target.closest('[data-close]')){openPlace='';draw();}});
 dir.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;load();}));
 let timer=0;
 form.addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(load,e.target.name==='q'?250:0);});
 form.addEventListener('submit',e=>{e.preventDefault();load();});
 form.addEventListener('reset',()=>setTimeout(load));
 M.onLang(()=>{relabel();if(data.items)draw();});
 load();
}

// /mentors/@id: one profile -------------------------------------------------------------------------------------------
async function pageProfile(){
 const id=decodeURIComponent(location.pathname.split('/@')[1]||'');
 await Promise.all([who(),loadMeta()]);
 if(!S.user)return gate();
 const host=document.querySelector('[data-net-profile]');host.hidden=false;const box=host.querySelector('.wrap');
 let r=await api('GET','/api/network/people/'+encodeURIComponent(id));
 if(!r.ok){box.innerHTML=`<p class="lead">${l('notFound')}</p>`;return;}
 function draw(){
  const p=r.data.profile,canConnect=r.data.canConnect,canWrite=r.data.canWrite;
  document.title=p.name+' · '+document.title.split(' · ').slice(-1)[0];
  const conn=p.me?`<p class="note">${l('thisIsYou')} <a href="/mentors/me#profile">${l('editProfile')}</a></p>`
   :p.connection==='accepted'?`<span class="net-pill is-ok">${l('accepted')}</span><button class="net-link" type="button" data-act="remove">${l('removeConn')}</button>`
   :p.connection==='outgoing'?`<span class="net-pill">${l('outgoing')}</span><button class="net-link" type="button" data-act="remove">${l('withdraw')}</button>`
   :p.connection==='incoming'?`<span class="net-pill">${l('incoming')}</span><button class="btn" type="button" data-act="accept">${l('accept')}</button><button class="btn btn-ghost" type="button" data-act="decline">${l('decline')}</button>`
   :p.connection==='declined'?`<span class="net-pill">${l('declined')}</span>`
   :canConnect?`<button class="btn btn-ghost" type="button" data-act="connect">${l('connect')}</button>`:'';
  box.innerHTML=`${demoBanner()}<article class="net-profile">
   <header class="net-profile-head">${avatar(p,'is-big')}<div><h1>${esc(p.name)}</h1><p class="lead">${esc(p.headline)}</p><p class="fine">${esc(p.city)} · ${l('country:'+p.country)} · ${l('region:'+p.region)}${p.demo?` · <span class="net-pill">${l('demo')}</span>`:''}</p></div></header>
   ${p.me?'':`<div class="net-actions">${canWrite?`<a class="btn" href="/mentors/me#messages/${encodeURIComponent(p.id)}"><span data-l="write">${esc(L('write'))}</span> <span aria-hidden="true">→</span></a>`:''}${conn}</div>${!canConnect&&p.connection==='none'?`<p class="fine">${l('connectHint')}</p>`:''}`}
   ${p.me?conn:''}
   <p class="net-err wl-err" role="alert" hidden></p>
   <dl class="facts net-facts">
    <div><dt>${l('expertise')}</dt><dd>${chips(p.categories)}</dd></div>
    ${p.bio?`<div><dt>${l('about')}</dt><dd class="net-bio">${esc(p.bio)}</dd></div>`:''}
    <div><dt>${l('languages')}</dt><dd>${p.languages.map(x=>esc(meta.languages[x]||x)).join(' · ')}</dd></div>
    ${p.hubNames.length?`<div><dt>${l('hubsAt')}</dt><dd>${p.hubNames.map(h=>`<a href="/hubs">${esc(h.name)}</a>`).join(' · ')}</dd></div>`:''}
    <div><dt>${l('availability')}</dt><dd>${l('hours',{n:p.availability})}</dd></div>
    ${p.openTo.length?`<div><dt>${l('openTo')}</dt><dd>${p.openTo.map(o=>l('open:'+o)).join(', ')}</dd></div>`:''}
    ${p.linkedin?`<div><dt>${l('linkedin')}</dt><dd><a href="${esc(p.linkedin)}" target="_blank" rel="noopener noreferrer nofollow">${esc(p.linkedin.replace(/^https:\/\/(www\.)?/,''))}</a></dd></div>`:''}
   </dl></article>`;
 }
 box.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act,u='/api/network/connections/'+encodeURIComponent(id);
  const res=await busy(b,()=>act==='connect'?api('POST',u):act==='remove'?api('DELETE',u):api('POST',u+'/decide',{accept:act==='accept'}));
  if(!res.ok){const err=box.querySelector('.net-err');err.hidden=false;err.innerHTML=l(res.code==='RATE_LIMITED'?'eRate':res.code==='DEMO_READ_ONLY'?'eDemo':'eNet');return;}
  r=await api('GET','/api/network/people/'+encodeURIComponent(id));if(r.ok)draw();
 });
 draw();
 M.onLang(()=>{relabel();});
}

// /mentors/me: the cabinet -----------------------------------------------------------------------------------------------
async function pageMe(){
 await Promise.all([who(),loadMeta()]);
 if(!S.user)return gate('/mentors/me'+location.hash);
 const cab=document.querySelector('[data-net-cab]');cab.hidden=false;
 const panes=Object.fromEntries([...cab.querySelectorAll('[data-pane]')].map(p=>[p.dataset.pane,p]));
 const hello=document.querySelector('[data-net-hello]'),out=document.querySelector('[data-net-logout]');
 out.hidden=false;out.addEventListener('click',()=>signOut('/mentors'));
 let mine=null,stopMsgr=null;
 async function refresh(){const r=await api('GET','/api/network/me');if(r.ok)mine=r.data;return r.ok;}
 if(!(await refresh()))return gate();
 hello.removeAttribute('data-m');hello.dataset.l='hello';hello.dataset.lv=JSON.stringify({n:mine.user.name});hello.textContent=L('hello',{n:mine.user.name});
 if(isDemoVisit())cab.querySelector('.wrap').insertAdjacentHTML('afterbegin',demoBanner());
 function badge(){const n=mine.incoming.length,b=cab.querySelector('[data-net-req]');b.hidden=!n;b.textContent=n;}
 // Profile -------------------------------------------------------------------------------------------------
 function drawProfile(){
  const p=mine.profile,el=panes.profile;
  el.innerHTML=`${p?'':`<div class="net-intro"><h2>${l('noProfileTitle')}</h2><p>${l('noProfileText')}</p></div>`}
  <form class="wl net-form net-edit" novalidate>
   ${p?`<div class="net-photo">${avatar({...p,photo:p.photo},'is-big')}<div><p><b>${l('photo')}</b></p><p class="fine">${l('photoHint')}</p><p class="net-actions"><label class="btn btn-ghost net-file"><input type="file" accept="image/*" data-photo><span data-l="photoAdd">${esc(L('photoAdd'))}</span></label>${p.photo?`<button class="net-link" type="button" data-photo-del>${l('photoRemove')}</button>`:''}</p><p class="wl-err" data-photo-err hidden></p></div></div>`:''}
   <label class="net-f"><span>${l('fName')}</span><input name="name" required maxlength="80" value="${esc(mine.user.name)}" autocomplete="name"></label>
   ${profileFields(p||{languages:[lang()==='ru'?'en':lang()]},{full:true})}
   <p class="wl-err net-err" role="alert" hidden></p>
   <p class="net-actions"><button class="btn" type="submit"><span data-l="${p?'save':'submitMentor'}">${esc(L(p?'save':'submitMentor'))}</span></button>${p?`<a class="btn btn-ghost" href="/mentors/@${encodeURIComponent(mine.user.id)}"><span data-l="viewProfile">${esc(L('viewProfile'))}</span></a>`:''}<span class="net-saved" role="status" data-saved></span></p>
  </form>
  ${p?.hubs?.length?`<section class="net-block"><h2>${l('myHubs')}</h2><p>${p.hubs.map(h=>`<a class="net-hub" href="/hubs">${esc(hubName(h))}</a>`).join(' ')}</p></section>`:''}
  <section class="net-block net-danger"><h2>${l('deleteTitle')}</h2><p>${l('deleteText')}</p>${mine.user.admin?`<p class="fine">${l('adminNoDelete')}</p>`:`
   <form class="net-delete" novalidate><label class="net-f"><span>${l('deletePassword')}</span><input name="password" type="password" required autocomplete="current-password" maxlength="200"></label><p class="wl-err net-err" role="alert" hidden></p><p><button class="btn btn-danger" type="submit"><span data-l="deleteBtn">${esc(L('deleteBtn'))}</span></button></p></form>`}</section>`;
  const form=el.querySelector('.net-edit');
  form.addEventListener('submit',e=>{e.preventDefault();busy(form.querySelector('[type=submit]'),async()=>{
   const prof=readProfile(form,true),bad=precheck(form,prof);if(bad)return showError(form,bad);
   const r=await api('PUT','/api/network/me/mentor',{displayName:String(new FormData(form).get('name')||'').trim(),profile:prof});
   if(!r.ok)return showError(form,r);
   showError(form,null);const had=!!mine.profile;await refresh();
   if(!had){drawProfile();}else{const s=form.querySelector('[data-saved]');s.textContent=L('saved');setTimeout(()=>{s.textContent='';},2500);}
   hello.dataset.lv=JSON.stringify({n:mine.user.name});hello.textContent=L('hello',{n:mine.user.name});
  });});
  el.querySelector('[data-photo]')?.addEventListener('change',async e=>{
   const file=e.target.files[0];if(!file)return;const err=el.querySelector('[data-photo-err]');err.hidden=true;
   try{
    const blob=await shrink(file);
    const r=await api('PUT','/api/me/avatar',blob,{raw:true,type:blob.type});
    if(!r.ok)throw 0;
    await refresh();drawProfile();
   }catch{err.hidden=false;err.innerHTML=l('photoBad');}
  });
  el.querySelector('[data-photo-del]')?.addEventListener('click',async()=>{await api('DELETE','/api/me/avatar');await refresh();drawProfile();});
  const del=el.querySelector('.net-delete');
  del?.addEventListener('submit',e=>{e.preventDefault();if(!confirm(L('deleteConfirm')))return;busy(del.querySelector('[type=submit]'),async()=>{
   const r=await api('DELETE','/api/network/me',{password:new FormData(del).get('password')});
   if(!r.ok)return showError(del,r.code==='INVALID_LOGIN'?{code:'INVALID_LOGIN',field:'password'}:r);
   S.user=null;S.csrf='';announce();stopMsgr?.();
   cab.innerHTML=`<div class="wrap"><div class="net-gate-in"><h2>${l('deleted')}</h2><p><a class="btn" href="/mentors"><span data-l="openNetwork">${esc(L('openNetwork'))}</span></a></p></div></div>`;
  });});
 }
 // A photo is made small in the browser (the server takes 400 KB at most): a 480 px square, WebP or JPEG.
 async function shrink(file){
  const img=await createImageBitmap(file),side=Math.min(img.width,img.height),size=Math.min(480,side);
  const c=document.createElement('canvas');c.width=c.height=size;
  c.getContext('2d').drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,size,size);
  for(const [type,q] of [['image/webp',.85],['image/jpeg',.85],['image/jpeg',.6]]){
   const b=await new Promise(r=>c.toBlob(r,type,q));
   if(b&&b.type===type&&b.size<=400*1024)return b;
  }
  throw Error('too big');
 }
 // Connections ---------------------------------------------------------------------------------------------
 function drawConnections(){
  const el=panes.connections,row=(p,acts)=>`<li class="net-row">${avatar({...p,photo:false})}<div class="net-row-main"><a href="${p.profile?`/mentors/@${encodeURIComponent(p.id)}`:`/mentors/me#messages/${encodeURIComponent(p.id)}`}"><b>${esc(p.name)}</b></a><span class="fine">${p.profile?esc(p.headline)+' · '+l('country:'+p.country):l('startup')}</span></div><div class="net-row-acts">${acts(p)}</div></li>`;
  const write=p=>`<a class="net-link" href="#messages/${encodeURIComponent(p.id)}">${l('write')}</a>`;
  const sec=(title,items,acts)=>items.length?`<section class="net-block"><h2>${l(title)} <span class="fine">${items.length}</span></h2><ul class="net-rows">${items.map(p=>row(p,acts)).join('')}</ul></section>`:'';
  el.innerHTML=(sec('connIncoming',mine.incoming,p=>`<button class="btn" type="button" data-id="${esc(p.id)}" data-act="accept">${l('accept')}</button><button class="btn btn-ghost" type="button" data-id="${esc(p.id)}" data-act="decline">${l('decline')}</button>`)
   +sec('connMine',mine.connections,p=>write(p)+`<button class="net-link" type="button" data-id="${esc(p.id)}" data-act="remove">${l('removeConn')}</button>`)
   +sec('connOutgoing',mine.outgoing,p=>`<button class="net-link" type="button" data-id="${esc(p.id)}" data-act="remove">${l('withdraw')}</button>`))
   ||`<p class="net-empty">${l('connNone')} <a href="/mentors/network">${l('openNetwork')}</a></p>`;
  el.insertAdjacentHTML('beforeend',`<p class="wl-err net-err" role="alert" hidden></p><p class="fine">${l('limitNote',{n:meta.dailyRequests||20})}</p>`);
  badge();
 }
 panes.connections.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const u='/api/network/connections/'+encodeURIComponent(b.dataset.id),act=b.dataset.act;
  const r=await busy(b,()=>act==='remove'?api('DELETE',u):api('POST',u+'/decide',{accept:act==='accept'}));
  if(!r.ok){const err=panes.connections.querySelector('.net-err');err.hidden=false;err.innerHTML=l(r.code==='DEMO_READ_ONLY'?'eDemo':'eNet');return;}
  await refresh();drawConnections();
 });
 // Messages: the app's messenger, routes under #messages.
 function showMessages(route){
  if(!window.BirdMessenger){panes.messages.innerHTML=`<p class="fine">${l('eNet')}</p>`;return;}
  window.BirdMessenger.language(lang());
  stopMsgr?.();stopMsgr=window.BirdMessenger.app(panes.messages,{lang:lang(),base:'#messages',route});
 }
 function route(){
  const h=location.hash.slice(1),[tab,...rest]=h.split('/'),name=['profile','connections','messages'].includes(tab)?tab:'profile';
  cab.querySelectorAll('[data-tab]').forEach(a=>{a.toggleAttribute('aria-current',a.dataset.tab===name);if(a.dataset.tab===name)a.setAttribute('aria-current','page');});
  for(const [k,p] of Object.entries(panes))p.hidden=k!==name;
  if(name!=='messages'&&stopMsgr){stopMsgr();stopMsgr=null;}
  if(name==='messages')showMessages(rest.filter(Boolean));
  // Requests may have arrived since the page opened: draw what is known, then what the server says now.
  if(name==='connections'){drawConnections();refresh().then(ok=>{if(ok&&!panes.connections.hidden)drawConnections();});}
 }
 addEventListener('hashchange',route);
 drawProfile();badge();route();
 M.onLang(()=>{relabel();if(!panes.connections.hidden)drawConnections();if(stopMsgr)window.BirdMessenger.language(lang());});
}

({mentors:pageMentors,network:pageNetwork,profile:pageProfile,me:pageMe})[page]?.();
});
