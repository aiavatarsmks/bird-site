'use strict';
/* Hubvers investors (server/investors.mjs), one script for three pages, by <body data-page>:
   investors   /investors                 join as an investor (work email on the fund's domain), sign in, the demo
   invme       /investors/me              dashboard: startups (filters, list, map of hubs), fund profile, messages
   invproject  /investors/p/<hub>/<id>    one project, read-only, and "Express interest"
   Texts: Croatian is in the pages for the first paint; everything drawn here is {hr,en,ru} and carries data-l="key"
   (or "stage:mvp", "round:seed", "ind:fintech", "country:HR", "region:cee") so it follows the language switch.
   The server decides every permission (pending investors get 403 INVESTOR_PENDING); this file only shows what it gets. */
document.addEventListener('DOMContentLoaded',()=>{
const M=window.SiteMenu;if(!M)return;
const page=document.body.dataset.page;
const X=(hr,en,ru)=>({hr,en,ru});
const D={
 // Static texts of the pages (Croatian also in the markup).
 skip:X('Preskoči na sadržaj','Skip to content','К содержанию'),loading:X('Učitavanje…','Loading…','Загрузка…'),
 ctaJoin:X('Pridružite se kao investitor','Join as an investor','Присоединиться как инвестор'),ctaSignIn:X('Prijava','Sign in','Войти'),
 jTitle:X('Pridružite se kao investitor','Join as an investor','Присоединяйтесь как инвестор'),
 jLead:X('Fondovi, anđeli i korporativni investitori dobivaju pregled startupa iz svih povezanih hubova, s filtrima i kartom. Besplatno je.','Funds, angels and corporate investors get an overview of startups from every connected hub, with filters and a map. It is free.','Фонды, бизнес-ангелы и корпоративные инвесторы получают обзор стартапов всех подключённых хабов с фильтрами и картой. Это бесплатно.'),
 jTick1:X('Samo poslovna e-pošta na domeni fonda, ne Gmail ili slično. Domena e-pošte mora odgovarati web-stranici fonda.','A work email on your fund’s domain only, not Gmail and the like. The email’s domain must match the fund’s website.','Только рабочая почта на домене фонда, не Gmail и подобные. Домен почты должен совпадать с сайтом фонда.'),
 jTick2:X('Svakog investitora ručno provjeravamo i odobravamo. Dok čekate, možete urediti profil.','We check and approve every investor by hand. While you wait, you can edit your profile.','Каждого инвестора мы проверяем и одобряем вручную. Пока вы ждёте, профиль можно редактировать.'),
 jTick3:X('Vidite samo projekte čiji je tim uključio prikaz investitorima. Kontakte članova tima nikad ne vidite.','You see only projects whose team switched on “visible to investors”. You never see team members’ contacts.','Вы видите только проекты, команда которых включила показ инвесторам. Контакты участников команд вы не видите никогда.'),
 demoBtn:X('Pogledajte demo kao investitor','Look around as a demo investor','Посмотреть демо глазами инвестора'),
 meEyebrow:X('Kabinet investitora','Investor cabinet','Кабинет инвестора'),meTitle:X('Startupi za vas','Startups for you','Стартапы для вас'),
 signOut:X('Odjava','Sign out','Выйти'),cabLabel:X('Kabinet','Cabinet','Кабинет'),tabStartups:X('Startupi','Startups','Стартапы'),tabProfile:X('Profil fonda','Fund profile','Профиль фонда'),tabMessages:X('Poruke','Messages','Сообщения'),
 filtersLabel:X('Filtri','Filters','Фильтры'),fStages:X('Stadij','Stage','Стадия'),fRaising:X('Traže (EUR)','Raising (EUR)','Привлекают (EUR)'),fRaised:X('Već prikupili (EUR)','Already raised (EUR)','Уже привлекли (EUR)'),
 from:X('od','from','от'),to:X('do','to','до'),fromPh:X('od','from','от'),toPh:X('do','to','до'),
 fRound:X('Runda','Round','Раунд'),fRegion:X('Regija','Region','Регион'),fCountry:X('Zemlja','Country','Страна'),fHub:X('Hub','Hub','Хаб'),fSort:X('Poredak','Sort','Порядок'),
 reset:X('Očisti filtre','Clear filters','Сбросить фильтры'),viewLabel:X('Prikaz','View','Вид'),viewList:X('Popis','List','Список'),viewMap:X('Karta','Map','Карта'),
 mapCap:X('Karta Europe: broj u točki je broj projekata u tom hubu koji odgovaraju filtrima. Odaberite točku.','Map of Europe: the number in a dot is how many projects of that hub match the filters. Choose a dot.','Карта Европы: число в точке — сколько проектов этого хаба подходят под фильтры. Выберите точку.'),
 backDash:X('Startupi za vas','Startups for you','Стартапы для вас'),
 // Drawn here.
 anyRound:X('Sve runde','Any round','Любой раунд'),anyRegion:X('Sve regije','All regions','Все регионы'),anyCountry:X('Sve zemlje','All countries','Все страны'),anyHub:X('Svi hubovi','All hubs','Все хабы'),
 sortNewest:X('Najnoviji','Newest','Сначала новые'),sortStage:X('Najdalji stadij','Furthest stage','Дальше по стадии'),sortRaising:X('Najveća runda','Largest round','Крупнее раунд'),
 none:X('Nijedan projekt ne odgovara filtrima.','No project matches these filters.','Под эти фильтры не подходит ни один проект.'),empty:X('Još nema projekata koji su se otvorili investitorima.','No project has opened itself to investors yet.','Пока ни один проект не открылся инвесторам.'),
 projectsN:X(n=>n%10===1&&n%100!==11?n+' projekt':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?n+' projekta':n+' projekata',n=>n===1?'1 project':n+' projects',n=>n+' '+(n%10===1&&n%100!==11?'проект':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'проекта':'проектов')),
 raising:X('Traže','Raising','Привлекают'),raised:X('Prikupili','Raised','Привлекли'),round:X('Runda','Round','Раунд'),stage:X('Stadij','Stage','Стадия'),notSaid:X('nije navedeno','not stated','не указано'),
 demo:X('Demo','Demo','Демо'),open:X('Otvori projekt','Open the project','Открыть проект'),close:X('Zatvori','Close','Закрыть'),noPlace:X('Hub bez lokacije','Hub without a location','Хаб без адреса'),
 inHub:X('Projekti huba','Projects of the hub','Проекты хаба'),
 waitTitle:X('Provjeravamo vaš fond','We are checking your fund','Мы проверяем ваш фонд'),
 waitText:X('Svakog investitora provjeravamo i odobravamo ručno: fond, web-stranicu i domenu e-pošte. Potvrdu e-pošte poveznicom još ne šaljemo, pa vas možemo kontaktirati na adresu koju ste upisali. Do odobrenja ne vidite startupe, ali možete urediti profil fonda.','We check and approve every investor by hand: the fund, its website and your email’s domain. We cannot send an email confirmation link yet, so we may contact you at the address you gave. Until you are approved you see no startups, but you can edit your fund profile.','Каждого инвестора мы проверяем и одобряем вручную: фонд, сайт и домен почты. Письмо со ссылкой для подтверждения мы пока не отправляем, поэтому можем связаться с вами по указанному адресу. До одобрения стартапы не видны, но профиль фонда можно редактировать.'),
 rejTitle:X('Profil nije odobren','Your profile was not approved','Профиль не одобрен'),
 rejText:X('Nismo mogli potvrditi fond. Ako mislite da je riječ o pogrešci, pišite nam preko <a href="/contact">obrasca za kontakt</a>.','We could not confirm the fund. If you think this is a mistake, write to us through the <a href="/contact">contact form</a>.','Мы не смогли подтвердить фонд. Если это ошибка, напишите нам через <a href="/contact">форму обратной связи</a>.'),
 st_pending:X('Čeka odobrenje','Waiting for approval','Ждёт одобрения'),st_approved:X('Odobreno','Approved','Одобрено'),st_rejected:X('Nije odobreno','Not approved','Не одобрено'),
 notInvestorTitle:X('Ovaj račun nije račun investitora','This account is not an investor account','Это не аккаунт инвестора'),
 notInvestorText:X('Prijavljeni ste računom mentora ili startupa. Za kabinet investitora odjavite se i otvorite račun investitora s poslovnom e-poštom fonda.','You are signed in with a mentor or startup account. For the investor cabinet, sign out and open an investor account with your fund’s work email.','Вы вошли как ментор или стартап. Для кабинета инвестора выйдите и откройте аккаунт инвестора с рабочей почтой фонда.'),
 gateTitle:X('Prijavite se kao investitor','Sign in as an investor','Войдите как инвестор'),
 gateText:X('Startupe iz povezanih hubova vide samo odobreni investitori.','Only approved investors see the startups of the connected hubs.','Стартапы подключённых хабов видят только одобренные инвесторы.'),
 gateBtn:X('Prijava ili registracija','Sign in or join','Войти или зарегистрироваться'),
 demoNote:X('Gledate demo kao izmišljeni investitor: samo izmišljeni projekti, ništa se ne sprema. Odjavite se kako biste otvorili vlastiti račun.','You are looking around as an invented investor: invented projects only, nothing is saved. Sign out to open your own account.','Вы смотрите демо как вымышленный инвестор: только вымышленные проекты, ничего не сохраняется. Выйдите, чтобы открыть свой аккаунт.'),
 tabJoin:X('Novi investitor','New investor','Новый инвестор'),tabSignIn:X('Prijava','Sign in','Вход'),
 fName:X('Ime i prezime','Full name','Имя и фамилия'),fEmail:X('Poslovna e-pošta','Work email','Рабочая почта'),fEmailHint:X('Na domeni fonda. Vidite je vi i vlasnik platforme; hub je vidi samo kad iskažete interes za njegov projekt.','On the fund’s domain. You and the platform owner see it; a hub sees it only when you express interest in one of its projects.','На домене фонда. Её видите вы и владелец платформы; хаб видит её, только когда вы проявите интерес к его проекту.'),
 fLogin:X('Korisničko ime','Username','Логин'),fLoginHint:X('Za prijavu: mala slova, brojke i . _ - @','For signing in: lower-case letters, digits and . _ - @','Для входа: строчные буквы, цифры и . _ - @'),
 fPassword:X('Lozinka','Password','Пароль'),fPasswordHint:X('Najmanje 10 znakova.','At least 10 characters.','Не меньше 10 символов.'),
 fFund:X('Fond ili organizacija','Fund or organisation','Фонд или организация'),fWebsite:X('Web-stranica fonda','Fund website','Сайт фонда'),
 fCountryHq:X('Sjedište: zemlja','Head office: country','Офис: страна'),fCity:X('Grad','City','Город'),
 fStagesI:X('Stadiji koji vas zanimaju','Stages you invest in','Стадии, которые вас интересуют'),fSectors:X('Sektori','Sectors','Отрасли'),
 fTicket:X('Iznos ulaganja (EUR, od–do)','Ticket size (EUR, from–to)','Размер чека (EUR, от–до)'),fAreas:X('Regije koje vas zanimaju','Regions of interest','Интересующие регионы'),
 fLinkedin:X('LinkedIn','LinkedIn','LinkedIn'),fBio:X('Kratko o vama i fondu','A short bio','Коротко о вас и фонде'),optional:X('(neobavezno)','(optional)','(необязательно)'),
 fConsent:X('Pročitao/la sam <a href="/privacy" target="_blank">obavijest o privatnosti</a> i slažem se da vlasnik platforme provjeri moj fond.','I have read the <a href="/privacy" target="_blank">privacy notice</a> and agree that the platform owner checks my fund.','Я прочитал(а) <a href="/privacy" target="_blank">уведомление о конфиденциальности</a> и согласен(на), что владелец платформы проверит мой фонд.'),
 submitJoin:X('Otvori račun investitora','Create my investor account','Создать аккаунт инвестора'),submitSignIn:X('Prijava','Sign in','Войти'),
 save:X('Spremi profil','Save profile','Сохранить профиль'),saved:X('Spremljeno.','Saved.','Сохранено.'),savedPending:X('Spremljeno. Promijenili ste fond ili web-stranicu, pa ga ponovno provjeravamo.','Saved. You changed the fund or its website, so we check it again.','Сохранено. Вы изменили фонд или сайт, поэтому мы проверим его снова.'),
 emailFixed:X('Poslovna e-pošta','Work email','Рабочая почта'),
 eRequired:X('Ispunite označena polja.','Fill in the marked fields.','Заполните отмеченные поля.'),
 eLogin:X('Korisničko ime: 3–60 znakova, mala slova, brojke i . _ - @','Username: 3–60 characters, lower-case letters, digits and . _ - @','Логин: 3–60 символов, строчные буквы, цифры и . _ - @'),
 eTaken:X('To korisničko ime je zauzeto.','This username is taken.','Этот логин занят.'),ePassword:X('Lozinka mora imati najmanje 10 znakova.','The password needs at least 10 characters.','В пароле нужно не меньше 10 символов.'),
 eEmail:X('Upišite poslovnu e-poštu, npr. ime@vasfond.com.','Enter a work email, e.g. name@yourfund.com.','Укажите рабочую почту, например name@yourfund.com.'),
 eFreeMail:X('Besplatne adrese (Gmail, Outlook, Yahoo…) ne primamo. Upišite e-poštu na domeni fonda.','Free addresses (Gmail, Outlook, Yahoo…) are not accepted. Use an email on your fund’s domain.','Бесплатные адреса (Gmail, Outlook, Yahoo…) не принимаются. Укажите почту на домене фонда.'),
 eMismatch:X('Domena e-pošte mora biti ista kao domena web-stranice fonda (ili njezina poddomena).','The email’s domain must be the fund website’s domain (or a subdomain of it).','Домен почты должен совпадать с доменом сайта фонда (или быть его поддоменом).'),
 eWebsite:X('Upišite web-stranicu fonda, npr. vasfond.com.','Enter the fund’s website, e.g. yourfund.com.','Укажите сайт фонда, например yourfund.com.'),
 eFund:X('Upišite naziv fonda (2–120 znakova).','Enter the fund’s name (2–120 characters).','Укажите название фонда (2–120 символов).'),
 eStages:X('Odaberite barem jedan stadij.','Choose at least one stage.','Выберите хотя бы одну стадию.'),eSectors:X('Odaberite od 1 do 8 sektora.','Choose 1 to 8 sectors.','Выберите от 1 до 8 отраслей.'),
 eTicket:X('Iznos: cijeli euri, „od” ne veći od „do”.','Ticket: whole euros, “from” not above “to”.','Чек: целые евро, «от» не больше «до».'),
 eCountry:X('Odaberite zemlju.','Choose a country.','Выберите страну.'),eCity:X('Upišite grad.','Enter a city.','Укажите город.'),eName:X('Upišite ime.','Enter your name.','Укажите имя.'),
 eLinkedin:X('Upišite adresu LinkedIn profila (linkedin.com/in/…).','Enter a LinkedIn profile address (linkedin.com/in/…).','Укажите адрес профиля LinkedIn (linkedin.com/in/…).'),eBio:X('Tekst je predug (najviše 1500 znakova).','The text is too long (1500 characters at most).','Текст слишком длинный (не больше 1500 символов).'),
 eConsent:X('Potvrdite obavijest o privatnosti.','Please confirm the privacy notice.','Подтвердите уведомление о конфиденциальности.'),
 eLoginBad:X('Pogrešno korisničko ime ili lozinka.','Wrong username or password.','Неверный логин или пароль.'),eRate:X('Previše pokušaja. Pokušajte kasnije.','Too many attempts. Try again later.','Слишком много попыток. Попробуйте позже.'),
 eNet:X('Nešto nije uspjelo. Pokušajte ponovno.','Something went wrong. Try again.','Что-то пошло не так. Попробуйте ещё раз.'),eDemo:X('U demo pregledu ne možete ništa mijenjati.','You cannot change anything in the demo.','В демо ничего нельзя менять.'),
 codesTitle:X('Spremite kodove za oporavak','Save your recovery codes','Сохраните коды восстановления'),
 codesText:X('Ako zaboravite lozinku, jednim od ovih kodova postavljate novu. Svaki vrijedi jednom. Prikazujemo ih samo sada.','If you forget your password, one of these codes sets a new one. Each works once. We show them only now.','Если забудете пароль, любой из этих кодов позволит задать новый. Каждый действует один раз. Показываем их только сейчас.'),
 codesDone:X('Spremio/la sam, nastavi','Saved, continue','Сохранил(а), дальше'),
 signedAs:X('Prijavljeni ste kao','Signed in as','Вы вошли как'),myCabinet:X('Moj kabinet','My cabinet','Мой кабинет'),
 hello:X('Pozdrav, {n}','Hello, {n}','Здравствуйте, {n}'),
 deleteTitle:X('Brisanje računa','Delete my account','Удаление аккаунта'),
 deleteText:X('Briše profil, fond, privatne poruke i zatvara račun. Interes koji ste iskazali hubovima ostaje kod njihovih organizatora dok ga oni ne obrišu. Ne može se poništiti.','Deletes your profile, fund and private messages, and closes the account. Interest you expressed stays with the hubs’ organisers until they delete it. This cannot be undone.','Удаляет профиль, фонд и личные сообщения и закрывает аккаунт. Проявленный интерес остаётся у организаторов хабов, пока они его не удалят. Отменить нельзя.'),
 deletePassword:X('Lozinka za potvrdu','Your password, to confirm','Пароль для подтверждения'),deleteBtn:X('Obriši moj račun','Delete my account','Удалить мой аккаунт'),
 deleteConfirm:X('Sigurno obrisati račun i profil fonda?','Delete your account and fund profile for good?','Точно удалить аккаунт и профиль фонда?'),
 deleted:X('Račun je obrisan.','Your account has been deleted.','Аккаунт удалён.'),
 notFound:X('Projekt nije pronađen ili ga tim više ne prikazuje investitorima.','Project not found, or its team no longer shows it to investors.','Проект не найден или команда больше не показывает его инвесторам.'),
 pProblem:X('Problem','Problem','Проблема'),pUsers:X('Kupci i korisnici','Customers and users','Клиенты и пользователи'),pSolution:X('Rješenje','Solution','Решение'),pValue:X('Vrijednost','Value','Ценность'),
 pAsk:X('Što traže','What they ask for','Что им нужно'),pNext:X('Sljedeći koraci','Next steps','Следующие шаги'),pDetails:X('Više o projektu','More about the project','Подробнее о проекте'),pLinks:X('Poveznice','Links','Ссылки'),
 pHub:X('Hub','Hub','Хаб'),pShown:X('Tim je odlučio ove podatke pokazati investitorima. Članove tima i njihove kontakte ne prikazujemo.','The team chose to show these details to investors. Team members and their contacts are not shown.','Команда решила показать эти данные инвесторам. Участников команды и их контакты мы не показываем.'),
 iTitle:X('Iskažite interes','Express interest','Проявить интерес'),
 iSame:X('Poruka stiže timu u Poruke ovdje na Hubversu. Vide vaše ime, fond i web-stranicu, a odgovor stiže u vaše Poruke.','Your note reaches the team in Messages here on Hubvers. They see your name, fund and website; their reply arrives in your Messages.','Сообщение придёт команде в «Сообщения» здесь, на Hubvers. Они увидят ваше имя, фонд и сайт; ответ придёт в ваши «Сообщения».'),
 iOther:X('Ovaj projekt je u drugom hubu. Vaš interes šaljemo organizatorima tog huba: vide vaše ime, fond, web-stranicu, LinkedIn i poslovnu e-poštu i odlučuju hoće li vam se javiti.','This project is in another hub. We pass your interest to that hub’s organisers: they see your name, fund, website, LinkedIn and work email, and decide whether to reply.','Этот проект в другом хабе. Мы передадим ваш интерес организаторам хаба: они увидят ваше имя, фонд, сайт, LinkedIn и рабочую почту и решат, ответить ли вам.'),
 iMsg:X('Poruka','Message','Сообщение'),iMsgPh:X('npr. Zanima nas vaša seed runda. Možemo li razgovarati sljedeći tjedan?','e.g. We are interested in your seed round. Can we talk next week?','напр. Нас интересует ваш seed-раунд. Можем поговорить на следующей неделе?'),
 iSend:X('Iskaži interes','Express interest','Проявить интерес'),
 iDoneMsg:X('Interes je poslan timu kao poruka ({d}). Odgovor stiže u Poruke.','Your interest was sent to the team as a message ({d}). The reply arrives in Messages.','Интерес отправлен команде сообщением ({d}). Ответ придёт в «Сообщения».'),
 iDoneOrg:X('Interes je proslijeđen organizatorima huba ({d}). Oni odlučuju hoće li vam se javiti.','Your interest was passed to the hub’s organisers ({d}). They decide whether to reply.','Интерес передан организаторам хаба ({d}). Они решат, ответить ли вам.'),
 openMessages:X('Otvori poruke','Open messages','Открыть сообщения'),
};
const pageKeys={};for(const [k,v] of Object.entries(D))if(typeof v.en==='string')pageKeys[k]={en:v.en,ru:v.ru};
M.add(pageKeys);

// Helpers -------------------------------------------------------------------------------------------------------------
let meta=null;
const lang=()=>M.lang;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc=o=>o?.[lang()]??o?.hr??o?.en??'';
function L(key,vars={}){
 const [kind,id]=key.includes(':')&&!D[key]?key.split(/:(.*)/):[null,null];
 if(kind==='stage')return loc(meta?.stages?.find(s=>s.id===id)?.name)||id;
 if(kind==='round')return loc(meta?.rounds?.find(s=>s.id===id)?.name)||id;
 if(kind==='ind')return loc(meta?.industries?.[id])||id;
 if(kind==='country')return loc(meta?.countries?.[id]?.name)||id;
 if(kind==='region')return loc(meta?.regions?.find(r=>r.id===id)?.name)||id;
 const v=D[key]?.[lang()]??D[key]?.hr??key;
 return typeof v==='function'?v(vars.n):String(v).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
function relabel(root=document){
 root.querySelectorAll('[data-l]').forEach(el=>{const v=L(el.dataset.l,el.dataset.lv?JSON.parse(el.dataset.lv):{});if(el.textContent!==v)el.textContent=v;});
 root.querySelectorAll('[data-lh]').forEach(el=>{const v=L(el.dataset.lh);if(el.innerHTML!==v)el.innerHTML=v;});
 root.querySelectorAll('[data-lph]').forEach(el=>el.setAttribute('placeholder',L(el.dataset.lph)));
 root.querySelectorAll('[data-eur]').forEach(el=>{el.textContent=eur(el.dataset.eur===''?null:Number(el.dataset.eur));});
}
const l=(key,vars)=>`<span data-l="${esc(key)}"${vars?` data-lv='${esc(JSON.stringify(vars))}'`:''}>${esc(L(key,vars))}</span>`;
const eur=v=>v===null||v===undefined||Number.isNaN(v)?L('notSaid'):new Intl.NumberFormat(lang()==='hr'?'hr-HR':lang()==='ru'?'ru-RU':'en-GB',{style:'currency',currency:'EUR',notation:v>=10000?'compact':'standard',maximumFractionDigits:v>=10000?1:0}).format(v);
const money=v=>`<span data-eur="${v??''}">${esc(eur(v))}</span>`;
const day=iso=>{try{return new Date(iso).toLocaleDateString(lang()==='hr'?'hr-HR':lang()==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'long',year:'numeric'});}catch{return '';}};
const safeNext=v=>/^\/investors(\/[A-Za-z0-9\/._-]*)?(#[A-Za-z0-9\/_-]*)?$/.test(v||'')?v:'';
const store={get(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};

const S={user:undefined,csrf:''};
async function who(){
 try{const d=await (await fetch('/api/auth/me',{credentials:'same-origin'})).json();S.user=d.user||null;S.csrf=d.csrf||'';}catch{S.user=null;}
 return S.user;
}
const isDemoVisit=()=>!!S.user?.id?.startsWith('demo-user-');
async function api(method,url,body){
 const h={};if(body!==undefined)h['content-type']='application/json';if(method!=='GET'&&S.csrf)h['x-csrf-token']=S.csrf;
 let r;try{r=await fetch(url,{method,credentials:'same-origin',headers:h,body:body===undefined?undefined:JSON.stringify(body)});}catch{return {ok:false,status:0,data:{}};}
 const data=await r.json().catch(()=>({}));
 if(data?.csrf)S.csrf=data.csrf;
 return {ok:r.ok,status:r.status,data,code:data?.error?.code||'',field:data?.error?.detail?.field||'',reason:data?.error?.detail?.reason||''};
}
const announce=()=>dispatchEvent(new CustomEvent('bird:auth',{detail:{user:S.user,csrf:S.csrf}}));
async function signOut(to){await api('POST','/api/auth/logout');S.user=null;S.csrf='';announce();if(to)location.href=to;}
async function loadMeta(){if(!meta){const r=await api('GET','/api/network/meta');meta=r.ok?r.data:{industries:{},countries:{},regions:[],stages:[],rounds:[]};}return meta;}
async function enterDemo(){
 const r=await api('POST','/api/demo/enter',{as:'investor'});
 if(r.ok)location.href='/investors/me';
}
const countryOptions=(sel='',empty='')=>`<option value=""${empty?` data-l="${empty}"`:''}>${empty?esc(L(empty)):''}</option>${Object.keys(meta.countries).sort((a,b)=>L('country:'+a).localeCompare(L('country:'+b),lang())).map(c=>`<option value="${c}"${c===sel?' selected':''} data-l="country:${c}">${esc(L('country:'+c))}</option>`).join('')}`;
function gate(next){
 const el=document.querySelector('[data-net-gate]');if(!el)return;
 el.hidden=false;
 el.innerHTML=`<div class="net-gate-in"><h2>${l('gateTitle')}</h2><p class="lead">${l('gateText')}</p><p class="net-actions"><a class="btn" href="/investors?next=${encodeURIComponent(next||location.pathname+location.hash)}#join"><span data-l="gateBtn">${esc(L('gateBtn'))}</span> <span aria-hidden="true">→</span></a><button class="btn btn-ghost" type="button" data-inv-demo-btn><span data-l="demoBtn">${esc(L('demoBtn'))}</span></button></p></div>`;
}
const demoBanner=()=>isDemoVisit()?`<p class="note net-demo-note"><span data-l="demoNote">${esc(L('demoNote'))}</span> <button class="net-link" type="button" data-inv-out>${l('signOut')}</button></p>`:'';
document.addEventListener('click',e=>{
 if(e.target.closest('[data-inv-out]')){e.preventDefault();signOut('/investors#join');}
 if(e.target.closest('[data-inv-demo-btn]')){e.preventDefault();enterDemo();}
});

const FIELD_ERR={login:'eLogin',password:'ePassword',email:'eEmail',consent:'eConsent',linkedin:'eLinkedin',fund:'eFund',website:'eWebsite',country:'eCountry',city:'eCity',displayName:'eName',bio:'eBio',stages:'eStages',categories:'eSectors',ticketMin:'eTicket',ticketMax:'eTicket'};
function showError(form,res){
 const box=form.querySelector('.net-err');
 form.querySelectorAll('[aria-invalid=true]').forEach(el=>el.setAttribute('aria-invalid','false'));
 if(!res){box.hidden=true;box.innerHTML='';return;}
 const key=res.reason==='free_mail'?'eFreeMail':res.reason==='domain_mismatch'?'eMismatch':res.code==='LOGIN_TAKEN'?'eTaken':res.code==='WEAK_PASSWORD'?'ePassword':res.code==='INVALID_LOGIN'?'eLoginBad':res.code==='RATE_LIMITED'?'eRate':res.code==='DEMO_READ_ONLY'?'eDemo':res.code==='INVALID_FIELDS'&&FIELD_ERR[res.field]?FIELD_ERR[res.field]:res.code==='INVALID_FIELDS'?'eRequired':'eNet';
 const name=res.code==='WEAK_PASSWORD'?'password':res.field==='displayName'?'name':res.field;
 const el=name&&form.querySelector(`[name="${name}"]`);
 const mark=el?.closest('fieldset')&&el.type==='checkbox'&&name!=='consent'?el.closest('fieldset'):el;
 if(mark){mark.setAttribute('aria-invalid','true');mark.scrollIntoView?.({block:'center'});el.focus?.({preventScroll:true});}
 box.hidden=false;box.innerHTML=l(key);
}
async function busy(btn,fn){btn.disabled=true;try{return await fn();}finally{btn.disabled=false;}}

// The fund's fields: the sign-up and the cabinet share them; the cabinet adds the bio.
function fundFields(p={},inv={},{full=false}={}){
 const has=(list,v)=>(list||[]).includes(v);
 const chipBox=(name,items,checked,lab)=>`<div class="chips">${items.map(v=>`<label class="chip"><input type="checkbox" name="${name}" value="${esc(v)}"${has(checked,v)?' checked':''}><span data-l="${esc(lab(v))}">${esc(L(lab(v)))}</span></label>`).join('')}</div>`;
 return `
 <div class="net-two">
  <label class="net-f"><span>${l('fFund')}</span><input name="fund" required minlength="2" maxlength="120" value="${esc(inv.fund||'')}" autocomplete="organization"></label>
  <label class="net-f"><span>${l('fWebsite')}</span><input name="website" required maxlength="200" inputmode="url" autocapitalize="none" spellcheck="false" placeholder="https://" value="${esc(inv.website||'')}"></label>
 </div>
 <div class="net-two">
  <label class="net-f"><span>${l('fCountryHq')}</span><select name="country" required>${countryOptions(p.country||'')}</select></label>
  <label class="net-f"><span>${l('fCity')}</span><input name="city" required maxlength="80" value="${esc(p.city||'')}" autocomplete="address-level2"></label>
 </div>
 <fieldset class="net-f"><legend>${l('fStagesI')}</legend>${chipBox('stages',meta.stages.map(s=>s.id),inv.stages,v=>'stage:'+v)}</fieldset>
 <fieldset class="net-f"><legend>${l('fSectors')}</legend>${chipBox('categories',Object.keys(meta.industries),p.categories,v=>'ind:'+v)}</fieldset>
 <fieldset class="net-f inv-range"><legend>${l('fTicket')} <span class="opt">${l('optional')}</span></legend><label><span class="sr">${l('from')}</span><input name="ticketMin" type="number" min="0" step="1000" inputmode="numeric" data-lph="fromPh" placeholder="${esc(L('fromPh'))}" value="${esc(inv.ticketMin??'')}"></label><span aria-hidden="true">–</span><label><span class="sr">${l('to')}</span><input name="ticketMax" type="number" min="0" step="1000" inputmode="numeric" data-lph="toPh" placeholder="${esc(L('toPh'))}" value="${esc(inv.ticketMax??'')}"></label></fieldset>
 <fieldset class="net-f"><legend>${l('fAreas')} <span class="opt">${l('optional')}</span></legend>${chipBox('areas',meta.regions.map(r=>r.id),inv.areas,v=>'region:'+v)}</fieldset>
 <label class="net-f"><span>${l('fLinkedin')} <span class="opt">${l('optional')}</span></span><input name="linkedin" type="url" maxlength="200" inputmode="url" placeholder="https://www.linkedin.com/in/…" value="${esc(p.linkedin||'')}"></label>
 ${full?`<label class="net-f"><span>${l('fBio')} <span class="opt">${l('optional')}</span></span><textarea name="bio" maxlength="1500" rows="4">${esc(p.bio||'')}</textarea></label>`:''}`;
}
function readFund(form){
 const f=new FormData(form),all=n=>f.getAll(n).map(String);
 return {fund:String(f.get('fund')||'').trim(),website:String(f.get('website')||'').trim(),country:f.get('country')||'',city:f.get('city')||'',stages:all('stages'),categories:all('categories'),
  ticketMin:f.get('ticketMin')||'',ticketMax:f.get('ticketMax')||'',areas:all('areas'),linkedin:f.get('linkedin')||'',bio:f.get('bio')||''};
}
function precheck(p){
 if(!p.stages.length)return {code:'INVALID_FIELDS',field:'stages'};
 if(p.categories.length<1||p.categories.length>8)return {code:'INVALID_FIELDS',field:'categories'};
 if(p.ticketMin!==''&&p.ticketMax!==''&&Number(p.ticketMin)>Number(p.ticketMax))return {code:'INVALID_FIELDS',field:'ticketMax'};
 return null;
}
// The commonest slips of the work email, named before a round trip; the server checks the full list again.
const FREE=/^(?:gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|proton(?:mail)?|gmx|yandex|aol)\.[a-z.]{2,6}$/;
function mailCheck(email,website){
 const d=(/@([^@\s]+)$/.exec(String(email).toLowerCase())||[])[1]||'';
 if(!d.includes('.'))return {code:'INVALID_FIELDS',field:'email'};
 if(FREE.test(d))return {code:'INVALID_FIELDS',field:'email',reason:'free_mail'};
 let host='';try{host=new URL(/^https?:\/\//i.test(website)?website:'https://'+website).hostname.toLowerCase().replace(/^www\./,'');}catch{return {code:'INVALID_FIELDS',field:'website'};}
 if(!(d===host||d.endsWith('.'+host)||host.endsWith('.'+d)))return {code:'INVALID_FIELDS',field:'email',reason:'domain_mismatch'};
 return null;
}
function codesView(codes,next){
 return `<div class="net-codes" tabindex="-1"><h3>${l('codesTitle')}</h3><p>${l('codesText')}</p><ol class="net-code-list">${codes.map(c=>`<li><code>${esc(c)}</code></li>`).join('')}</ol><p><a class="btn" href="${esc(next)}"><span data-l="codesDone">${esc(L('codesDone'))}</span> <span aria-hidden="true">→</span></a></p></div>`;
}

// /investors: join or sign in ------------------------------------------------------------------------------------------
async function pageInvestors(){
 const host=document.querySelector('[data-inv-join]');if(!host)return;
 await Promise.all([who(),loadMeta()]);
 const next=safeNext(new URLSearchParams(location.search).get('next'));
 let tab=next?'signin':'join';
 document.querySelector('[data-inv-signin]')?.addEventListener('click',()=>{tab='signin';draw();});
 document.querySelector('[data-inv-cta]')?.addEventListener('click',()=>{if(!S.user||isDemoVisit()){tab='join';draw();}});
 function draw(){
  if(S.user&&!isDemoVisit()){
   host.innerHTML=`<div class="net-signed"><p>${l('signedAs')} <b>${esc(S.user.displayName)}</b></p><p class="net-actions"><a class="btn" href="${esc(next||'/investors/me')}"><span data-l="myCabinet">${esc(L('myCabinet'))}</span> <span aria-hidden="true">→</span></a></p><p><button class="net-link" type="button" data-inv-out>${l('signOut')}</button></p></div>`;
   return;
  }
  const tabs=[['join','tabJoin'],['signin','tabSignIn']];
  host.innerHTML=`${demoBanner()}<div class="net-jtabs" role="tablist">${tabs.map(([k,t])=>`<button type="button" role="tab" id="it-${k}" aria-controls="ip" aria-selected="${k===tab}" data-jtab="${k}">${l(t)}</button>`).join('')}</div>
  <form class="wl net-form" id="ip" role="tabpanel" aria-labelledby="it-${tab}" novalidate>${tab==='signin'?`
   <label class="net-f"><span>${l('fLogin')}</span><input name="login" required autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="60"></label>
   <label class="net-f"><span>${l('fPassword')}</span><input name="password" type="password" required autocomplete="current-password" maxlength="200"></label>`:`
   <label class="net-f"><span>${l('fName')}</span><input name="name" required maxlength="80" autocomplete="name"></label>
   <label class="net-f"><span>${l('fEmail')}</span><input name="email" type="email" required autocomplete="work email" maxlength="200" aria-describedby="ih-em"><small id="ih-em" class="fine">${l('fEmailHint')}</small></label>
   <div class="net-two">
    <label class="net-f"><span>${l('fLogin')}</span><input name="login" required autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="60" aria-describedby="ih-login"><small id="ih-login" class="fine">${l('fLoginHint')}</small></label>
    <label class="net-f"><span>${l('fPassword')}</span><input name="password" type="password" required minlength="10" autocomplete="new-password" maxlength="200" aria-describedby="ih-pw"><small id="ih-pw" class="fine">${l('fPasswordHint')}</small></label>
   </div>
   ${fundFields({},{})}
   <label class="check"><input name="consent" type="checkbox" required><span data-lh="fConsent">${L('fConsent')}</span></label>`}
   <p class="wl-err net-err" role="alert" hidden></p>
   <p><button class="btn" type="submit"><span data-l="${tab==='signin'?'submitSignIn':'submitJoin'}">${esc(L(tab==='signin'?'submitSignIn':'submitJoin'))}</span> <span aria-hidden="true">→</span></button></p>
  </form>`;
  host.querySelectorAll('[data-jtab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.jtab;draw();host.querySelector(`[data-jtab="${tab}"]`).focus();}));
  host.querySelector('[role=tablist]').addEventListener('keydown',e=>{const i=tabs.findIndex(t=>t[0]===tab),d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(d){tab=tabs[(i+d+tabs.length)%tabs.length][0];draw();host.querySelector(`[data-jtab="${tab}"]`).focus();}});
  // The username follows the email until it is typed by hand.
  const form=host.querySelector('form'),em=form.elements.email,lg=form.elements.login;
  if(em&&lg){let auto=true;lg.addEventListener('input',()=>{auto=false;});em.addEventListener('input',()=>{if(auto)lg.value=em.value.trim().toLowerCase().replace(/[^a-z0-9._@-]/g,'').slice(0,60);});}
  form.addEventListener('submit',e=>{e.preventDefault();busy(form.querySelector('[type=submit]'),()=>submit(form));});
 }
 async function submit(form){
  const f=new FormData(form);
  if(isDemoVisit())await signOut();
  if(tab==='signin'){
   const r=await api('POST','/api/auth/login',{login:f.get('login'),password:f.get('password')});
   if(!r.ok)return showError(form,r);
   S.user=r.data.user;announce();location.href=next||'/investors/me';return;
  }
  const body={login:String(f.get('login')||'').trim().toLowerCase(),password:f.get('password'),displayName:String(f.get('name')||'').trim(),email:String(f.get('email')||'').trim(),language:lang(),consent:!!f.get('consent'),profile:readFund(form)};
  if(!body.displayName)return showError(form,{code:'INVALID_FIELDS',field:'displayName'});
  if(!body.email)return showError(form,{code:'INVALID_FIELDS',field:'email'});
  const bad=precheck(body.profile)||mailCheck(body.email,body.profile.website);if(bad)return showError(form,bad);
  if(!body.consent)return showError(form,{code:'INVALID_FIELDS',field:'consent'});
  const r=await api('POST','/api/network/signup/investor',body);
  if(!r.ok)return showError(form,r);
  S.user=r.data.user;announce();
  host.innerHTML=codesView(r.data.recoveryCodes||[],next||'/investors/me');
  host.querySelector('.net-codes').focus();
 }
 draw();
 if(location.hash==='#join'&&next)host.scrollIntoView();
 M.onLang(()=>relabel());
}

// Cards of projects -----------------------------------------------------------------------------------------------------
const projectUrl=p=>`/investors/p/${encodeURIComponent(p.hub)}/${encodeURIComponent(p.id)}`;
const where=p=>`${esc(p.hubName)}${p.city?' · '+esc(p.city):''}${p.country?' · '+l('country:'+p.country):''}`;
const card=p=>`<a class="inv-card" href="${projectUrl(p)}">
 <span class="inv-card-top"><b>${esc(p.name)}</b>${p.demo?`<span class="net-pill">${l('demo')}</span>`:''}</span>
 <span class="fine">${where(p)}</span>
 <span class="inv-stage">${l('stage:'+p.stage)}</span>
 ${p.short?`<span class="inv-card-short">${esc(p.short)}</span>`:''}
 <dl class="inv-money"><div><dt>${l('raising')}</dt><dd>${money(p.raisingEur)}</dd></div><div><dt>${l('raised')}</dt><dd>${money(p.raisedEur)}</dd></div><div><dt>${l('round')}</dt><dd>${p.round?l('round:'+p.round):l('notSaid')}</dd></div></dl>
</a>`;

// /investors/me: dashboard, profile, messages ---------------------------------------------------------------------------
async function pageMe(){
 await Promise.all([who(),loadMeta()]);
 if(!S.user)return gate('/investors/me'+location.hash);
 const r0=await api('GET','/api/network/me');
 if(!r0.ok)return gate();
 let mine=r0.data;
 const hello=document.querySelector('[data-inv-hello]'),out=document.querySelector('[data-inv-logout]'),pill=document.querySelector('[data-inv-status]');
 out.hidden=false;out.addEventListener('click',()=>signOut('/investors'));
 if(mine.profile?.kind!=='investor'||!mine.investor){
  const el=document.querySelector('[data-net-gate]');el.hidden=false;
  el.innerHTML=`<div class="net-gate-in"><h2>${l('notInvestorTitle')}</h2><p class="lead">${l('notInvestorText')}</p><p class="net-actions"><button class="btn" type="button" data-inv-out>${l('signOut')}</button><a class="btn btn-ghost" href="/mentors/me">${l('myCabinet')}</a></p></div>`;
  M.onLang(()=>relabel());return;
 }
 const cab=document.querySelector('[data-inv-cab]');cab.hidden=false;
 const panes=Object.fromEntries([...cab.querySelectorAll('[data-pane]')].map(p=>[p.dataset.pane,p]));
 hello.removeAttribute('data-m');hello.dataset.l='hello';hello.dataset.lv=JSON.stringify({n:mine.user.name});hello.textContent=L('hello',{n:mine.user.name});
 if(isDemoVisit())cab.querySelector('.wrap').insertAdjacentHTML('afterbegin',demoBanner());
 const drawStatus=()=>{const s=mine.investor.status;pill.hidden=false;pill.className='net-pill'+(s==='approved'?' is-ok':s==='rejected'?' is-risk':'');pill.dataset.l='st_'+s;pill.textContent=L('st_'+s);};
 drawStatus();
 let stopMsgr=null,dashReady=false;

 // Startups -----------------------------------------------------------------------------------------------------------
 const wait=panes.startups.querySelector('[data-inv-wait]'),dash=panes.startups.querySelector('[data-inv-dash]');
 const form=dash.querySelector('[data-inv-filters]'),list=dash.querySelector('[data-inv-list]'),mapView=dash.querySelector('[data-inv-mapview]'),side=dash.querySelector('[data-inv-side]'),count=dash.querySelector('[data-inv-count]');
 let view='list',data={items:[],hubs:[],total:0},openHub='';
 const KEY='hubvers.investor.filter';
 function drawWait(){
  const s=mine.investor.status;
  wait.hidden=s==='approved';dash.hidden=s!=='approved';
  wait.innerHTML=s==='rejected'?`<div class="net-intro"><h2>${l('rejTitle')}</h2><p data-lh="rejText">${L('rejText')}</p></div>`
   :`<div class="net-intro inv-wait-in"><h2>${l('waitTitle')}</h2><p>${l('waitText')}</p><p class="net-actions"><a class="btn btn-ghost" href="#profile">${l('tabProfile')}</a></p></div>`;
 }
 function setupFilters(){
  if(dashReady)return;dashReady=true;
  const saved=store.get(KEY)||{};
  const picked=new Set(saved.stage||[]);
  dash.querySelector('[data-inv-stages]').innerHTML=meta.stages.map(s=>`<label class="chip"><input type="checkbox" name="stage" value="${s.id}"${picked.has(s.id)?' checked':''}><span data-l="stage:${s.id}">${esc(L('stage:'+s.id))}</span></label>`).join('');
  const fill=(sel,html,v)=>{const el=dash.querySelector(sel);el.innerHTML=html;el.value=v||'';};
  fill('[data-inv-round]',`<option value="" data-l="anyRound">${esc(L('anyRound'))}</option>`+meta.rounds.map(r=>`<option value="${r.id}" data-l="round:${r.id}">${esc(L('round:'+r.id))}</option>`).join(''),saved.round);
  fill('[data-inv-region]',`<option value="" data-l="anyRegion">${esc(L('anyRegion'))}</option>`+meta.regions.map(r=>`<option value="${esc(r.id)}" data-l="region:${esc(r.id)}">${esc(L('region:'+r.id))}</option>`).join(''),saved.region);
  fill('[data-inv-country]',countryOptions('','anyCountry'),saved.country);
  fill('[data-inv-hub]',`<option value="" data-l="anyHub">${esc(L('anyHub'))}</option>`,'');
  fill('[data-inv-sort]',[['newest','sortNewest'],['stage','sortStage'],['raising','sortRaising']].map(([v,k])=>`<option value="${v}" data-l="${k}">${esc(L(k))}</option>`).join(''),saved.sort||'newest');
  for(const k of ['raisingMin','raisingMax','raisedMin','raisedMax'])form.elements[k].value=saved[k]??'';
  form.dataset.hub=saved.hub||'';
  view=saved.view==='map'?'map':'list';
  let timer=0;
  form.addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(load,e.target.type==='number'?350:0);});
  form.addEventListener('submit',e=>{e.preventDefault();load();});
  form.addEventListener('reset',()=>{form.dataset.hub='';setTimeout(load);});
  dash.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;save();draw();}));
  dots?.addEventListener('click',e=>{const g=e.target.closest('[data-hub]');if(g)pickHub(g.dataset.hub);});
  dots?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const g=e.target.closest('[data-hub]');if(g){e.preventDefault();pickHub(g.dataset.hub);}}});
  side.addEventListener('click',e=>{if(e.target.closest('[data-close]')){openHub='';draw();}});
 }
 const query=()=>{
  const f=new FormData(form),q=new URLSearchParams();
  const st=f.getAll('stage');if(st.length)q.set('stage',st.join(','));
  for(const k of ['raisingMin','raisingMax','raisedMin','raisedMax','round','region','country','sort']){const v=String(f.get(k)||'').trim();if(v&&!(k==='sort'&&v==='newest'))q.set(k,v);}
  const hub=f.get('hub')||'';if(hub)q.set('hub',hub);
  return q;
 };
 function save(){const f=new FormData(form);store.set(KEY,{stage:f.getAll('stage'),round:f.get('round'),region:f.get('region'),country:f.get('country'),hub:f.get('hub'),sort:f.get('sort'),view,
  raisingMin:f.get('raisingMin'),raisingMax:f.get('raisingMax'),raisedMin:f.get('raisedMin'),raisedMax:f.get('raisedMax')});}
 let seq=0;
 async function load(){
  const q=query(),n=++seq,r=await api('GET','/api/investors/projects?'+q);
  if(n!==seq)return;
  if(!r.ok){
   if(r.code==='INVESTOR_PENDING'||r.code==='NOT_INVESTOR'){mine.investor.status=mine.investor.status==='approved'?'pending':mine.investor.status;drawStatus();drawWait();return;}
   list.innerHTML=`<p class="net-empty">${l('eNet')}</p>`;return;
  }
  data=r.data;
  // The hub list comes from the server (hubs that show anything); keep the chosen one.
  const hubSel=dash.querySelector('[data-inv-hub]'),cur=hubSel.value||form.dataset.hub||'';form.dataset.hub='';
  hubSel.innerHTML=`<option value="" data-l="anyHub">${esc(L('anyHub'))}</option>`+data.hubs.map(h=>`<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('');
  hubSel.value=data.hubs.some(h=>h.id===cur)?cur:'';
  // A saved hub was not in the list yet when this answer was asked for: ask again with it.
  if(hubSel.value!==(q.get('hub')||''))return load();
  save();draw();
 }
 // Lambert azimuthal equal-area, the same projection as /hubs (data-proj on the <svg>).
 const svg=dash.querySelector('[data-net-map]'),dots=svg?.querySelector('[data-dots]');
 const [PS,TX,TY,RL,RP]=(svg?.dataset.proj||'1,0,0,0,0').split(',').map(Number),R=Math.PI/180;
 function project(lat,lon){const lo=(lon+RL)*R,p=lat*R,dp=RP*R,x=Math.cos(lo)*Math.cos(p),y=Math.sin(lo)*Math.cos(p),z=Math.sin(p),k=z*Math.cos(dp)+x*Math.sin(dp);const Lm=Math.atan2(y,x*Math.cos(dp)-z*Math.sin(dp)),P=Math.asin(k),c=Math.sqrt(2/(1+Math.cos(Lm)*Math.cos(P)));return [TX+PS*c*Math.cos(P)*Math.sin(Lm),TY-PS*c*Math.sin(P)];}
 function frame(pts){
  const W=800,H=640,pad=90;
  if(!pts.length){svg.setAttribute('viewBox',`0 0 ${W} ${H}`);return 1;}
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  let w=Math.max(240,Math.max(...xs)-Math.min(...xs)+2*pad),h=Math.max(Math.max(...ys)-Math.min(...ys)+2*pad,w*H/W);
  w=Math.min(W,Math.max(w,h*W/H));h=w*H/W;
  const cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;
  const x=Math.min(W-w,Math.max(0,cx-w/2)),y=Math.min(H-h,Math.max(0,cy-h/2));
  svg.setAttribute('viewBox',`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
  return w/W;
 }
 function draw(){
  count.textContent=L('projectsN',{n:data.items.length});
  dash.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  list.hidden=view!=='list';mapView.hidden=view!=='map';
  if(view==='list')list.innerHTML=data.items.length?`<div class="inv-grid">${data.items.map(card).join('')}</div>`:`<p class="net-empty">${l(data.total?'none':'empty')}</p>`;
  if(view==='map'&&dots){
   const placed=data.hubs.filter(h=>h.lat!==null&&h.count);
   if(openHub&&!data.hubs.some(h=>h.id===openHub&&h.count))openHub='';
   const pts=placed.map(h=>project(h.lat,h.lon)),k=frame(pts);
   // Hubs close to each other (Zagreb and Ljubljana) would print their names over each other: a name that would
   // collide with an earlier one goes to the left of its dot instead.
   const names=[];
   dots.innerHTML=placed.map((h,i)=>{const [x,y]=pts[i],r=Math.min(24,11+h.count*2);
    const clash=names.some(([nx,ny])=>Math.abs(nx-x)<220*k&&Math.abs(ny-y)<34*k);names.push([x,y]);
    return `<g class="net-pin${h.id===openHub?' is-on':''}" data-hub="${esc(h.id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(3)})" tabindex="0" role="button" aria-label="${esc(h.name+': '+L('projectsN',{n:h.count}))}" aria-pressed="${h.id===openHub}"><circle r="${r}"/><text y="5">${h.count}</text><text class="net-pin-name${clash?' is-left':''}" x="${clash?-(r+5):r+5}" y="${-r+6}">${esc(h.name)}</text></g>`;}).join('');
   drawSide();
  }
 }
 function drawSide(){
  const h=data.hubs.find(x=>x.id===openHub);
  side.hidden=!h;mapView.classList.toggle('has-side',!!h);
  if(!h){side.innerHTML='';return;}
  const items=data.items.filter(p=>p.hub===h.id);
  const stages=meta.stages.filter(s=>h.stages[s.id]).map(s=>`<li>${l('stage:'+s.id)} <b>${h.stages[s.id]}</b></li>`).join('');
  side.innerHTML=`<div class="net-side-head"><h2 tabindex="-1">${esc(h.name)}</h2><button class="net-x" type="button" data-close aria-label="${esc(L('close'))}">×</button></div><p class="fine">${esc(h.city)}${h.country?' · '+l('country:'+h.country):''} · ${esc(L('projectsN',{n:items.length}))}</p>${stages?`<ul class="net-tags inv-side-stages">${stages}</ul>`:''}<div class="net-side-list">${items.map(card).join('')}</div>`;
 }
 function pickHub(id){openHub=openHub===id?'':id;draw();if(openHub)side.querySelector('.net-side-head h2')?.focus?.();}

 // Profile ------------------------------------------------------------------------------------------------------------
 function drawProfile(){
  const p=mine.profile,inv=mine.investor,el=panes.profile;
  el.innerHTML=`<form class="wl net-form net-edit" novalidate>
   <label class="net-f"><span>${l('fName')}</span><input name="name" required maxlength="80" value="${esc(mine.user.name)}" autocomplete="name"></label>
   <p class="fine inv-email">${l('emailFixed')}: <b>${esc(S.user.email||'')}</b></p>
   ${fundFields(p,inv,{full:true})}
   <p class="wl-err net-err" role="alert" hidden></p>
   <p class="net-actions"><button class="btn" type="submit"><span data-l="save">${esc(L('save'))}</span></button><span class="net-saved" role="status" data-saved></span></p>
  </form>
  <section class="net-block net-danger"><h2>${l('deleteTitle')}</h2><p>${l('deleteText')}</p>
   <form class="net-delete" novalidate><label class="net-f"><span>${l('deletePassword')}</span><input name="password" type="password" required autocomplete="current-password" maxlength="200"></label><p class="wl-err net-err" role="alert" hidden></p><p><button class="btn btn-danger" type="submit"><span data-l="deleteBtn">${esc(L('deleteBtn'))}</span></button></p></form></section>`;
  const f=el.querySelector('.net-edit');
  f.addEventListener('submit',e=>{e.preventDefault();busy(f.querySelector('[type=submit]'),async()=>{
   const prof=readFund(f),bad=precheck(prof);if(bad)return showError(f,bad);
   const r=await api('PUT','/api/network/me/investor',{displayName:String(new FormData(f).get('name')||'').trim(),profile:prof});
   if(!r.ok)return showError(f,r);
   showError(f,null);
   const before=mine.investor.status;
   const again=await api('GET','/api/network/me');if(again.ok)mine=again.data;
   drawStatus();drawWait();if(mine.investor.status==='approved'&&!dashReady){setupFilters();load();}
   const s=f.querySelector('[data-saved]');s.textContent=L(before==='approved'&&mine.investor.status==='pending'?'savedPending':'saved');setTimeout(()=>{s.textContent='';},4000);
   hello.dataset.lv=JSON.stringify({n:mine.user.name});hello.textContent=L('hello',{n:mine.user.name});
  });});
  const del=el.querySelector('.net-delete');
  del.addEventListener('submit',e=>{e.preventDefault();if(!confirm(L('deleteConfirm')))return;busy(del.querySelector('[type=submit]'),async()=>{
   const r=await api('DELETE','/api/network/me',{password:new FormData(del).get('password')});
   if(!r.ok)return showError(del,r.code==='INVALID_LOGIN'?{code:'INVALID_LOGIN',field:'password'}:r);
   S.user=null;S.csrf='';announce();stopMsgr?.();
   cab.innerHTML=`<div class="wrap"><div class="net-gate-in"><h2>${l('deleted')}</h2><p><a class="btn" href="/investors">${l('ctaJoin')}</a></p></div></div>`;
  });});
 }
 function showMessages(route){
  if(!window.BirdMessenger){panes.messages.innerHTML=`<p class="fine">${l('eNet')}</p>`;return;}
  window.BirdMessenger.language(lang());
  stopMsgr?.();stopMsgr=window.BirdMessenger.app(panes.messages,{lang:lang(),base:'#messages',route});
 }
 function route(){
  const h=location.hash.slice(1),[tab,...rest]=h.split('/'),name=['startups','profile','messages'].includes(tab)?tab:'startups';
  cab.querySelectorAll('[data-tab]').forEach(a=>{if(a.dataset.tab===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  for(const [k,p] of Object.entries(panes))p.hidden=k!==name;
  if(name!=='messages'&&stopMsgr){stopMsgr();stopMsgr=null;}
  if(name==='messages')showMessages(rest.filter(Boolean));
 }
 addEventListener('hashchange',route);
 drawWait();drawProfile();route();
 if(mine.investor.status==='approved'){setupFilters();load();}
 M.onLang(()=>{relabel();if(dashReady)draw();if(stopMsgr)window.BirdMessenger.language(lang());});
}

// /investors/p/<hub>/<id>: one project ---------------------------------------------------------------------------------
async function pageProject(){
 const [,,,hub,id]=location.pathname.split('/').map(decodeURIComponent);
 await Promise.all([who(),loadMeta()]);
 if(!S.user)return gate();
 const host=document.querySelector('[data-inv-project]');host.hidden=false;const box=host.querySelector('.wrap');
 const url=`/api/investors/projects/${encodeURIComponent(hub)}/${encodeURIComponent(id)}`;
 let r=await api('GET',url);
 if(!r.ok){box.innerHTML=r.code==='INVESTOR_PENDING'||r.code==='NOT_INVESTOR'?`<div class="net-intro"><h2>${l('waitTitle')}</h2><p>${l('waitText')}</p></div>`:`<p class="lead">${l('notFound')}</p>`;M.onLang(()=>relabel());return;}
 function draw(){
  const p=r.data.project,asked=r.data.interest;
  document.title=p.name+' · '+document.title.split(' · ').slice(-1)[0];
  const block=(k,label)=>p[k]?`<div><dt>${l(label)}</dt><dd class="net-bio">${esc(p[k])}</dd></div>`:'';
  box.innerHTML=`${demoBanner()}<article class="net-profile inv-project">
   <header><p class="fine">${where(p)}${p.demo?` · <span class="net-pill">${l('demo')}</span>`:''}</p><h1>${esc(p.name)}</h1>${p.short?`<p class="lead">${esc(p.short)}</p>`:''}</header>
   <dl class="inv-money is-big"><div><dt>${l('stage')}</dt><dd>${l('stage:'+p.stage)}</dd></div><div><dt>${l('raising')}</dt><dd>${money(p.raisingEur)}</dd></div><div><dt>${l('raised')}</dt><dd>${money(p.raisedEur)}</dd></div><div><dt>${l('round')}</dt><dd>${p.round?l('round:'+p.round):l('notSaid')}</dd></div></dl>
   <dl class="facts net-facts">${block('problem','pProblem')}${block('users','pUsers')}${block('solution','pSolution')}${block('value','pValue')}${block('ask','pAsk')}${block('nextSteps','pNext')}${block('details','pDetails')}
    ${p.links.length?`<div><dt>${l('pLinks')}</dt><dd>${p.links.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(x.label||x.url.replace(/^https?:\/\/(www\.)?/,''))}</a>`).join(' · ')}</dd></div>`:''}</dl>
   <p class="fine">${l('pShown')}</p>
   <section class="net-block inv-interest" id="interest"><h2>${l('iTitle')}</h2>${asked
    ?`<p class="note" role="status">${l(asked.via==='message'?'iDoneMsg':'iDoneOrg',{d:day(asked.created)})}</p>${asked.via==='message'?`<p><a class="btn btn-ghost" href="/investors/me#messages">${l('openMessages')}</a></p>`:''}`
    :`<p>${l(p.same?'iSame':'iOther')}</p><form class="wl net-form" novalidate><label class="net-f"><span>${l('iMsg')} <span class="opt">${l('optional')}</span></span><textarea name="message" maxlength="1000" rows="4" data-lph="iMsgPh" placeholder="${esc(L('iMsgPh'))}"></textarea></label><p class="wl-err net-err" role="alert" hidden></p><p><button class="btn" type="submit"><span data-l="iSend">${esc(L('iSend'))}</span> <span aria-hidden="true">→</span></button></p></form>`}</section>
  </article>`;
  const f=box.querySelector('.inv-interest form');
  f?.addEventListener('submit',e=>{e.preventDefault();busy(f.querySelector('[type=submit]'),async()=>{
   const res=await api('POST',url+'/interest',{message:String(new FormData(f).get('message')||'')});
   if(!res.ok)return showError(f,res);
   r=await api('GET',url);if(r.ok){draw();box.querySelector('.inv-interest [role=status]')?.focus?.();}
  });});
 }
 draw();
 M.onLang(()=>relabel());
}

({investors:pageInvestors,invme:pageMe,invproject:pageProject})[page]?.();
});
