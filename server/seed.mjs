/** Idempotent seed of curated records, lectures, badges and the voluntary game tasks. */
import {nowIso} from './db.mjs';
import {curatedContent} from './projects.mjs';
import {seedBadges} from './progress.mjs';

const STAFF=[['staff-bird-1','Sara'],['staff-bird-2','Sven'],['staff-bird-3','Nika']];
// Mentor speed dating, 5 Nov (owner-provided list). Organisers set each mentor's area in Admin.
const MENTORS=[
 ['mikael-hietala','Mikael Hietala','m','mhhietala/'],['miroslav-kovac','Miroslav Kovač','m','kovacmiroslav/'],['marko-brkljacic','Marko Brkljačić','m','markobrkljacic/'],
 ['damir-first','Damir Firšt','m','damir-first/'],['davor-anicic','Davor Aničić','m','davor-anicic/'],['marijana-sarolic-robic','Marijana Š. Robić','f','marijana-sarolic-robic-27363712/'],
 ['lisa-lines','Lisa Lines','f','lisa-lines-8469b8115/'],['jana-klaric','Jana Klarić','f','jana-klari%C4%87/'],['kristijan-paksec','Kristijan Pakšec','m','kristijan-paksec/'],
 ['josko-bobanovic','Joško Bobanović','m','josko/'],['vid-zavalic','Vid Zavalić','m','vzavalic/'],['christer-andersson','Christer Andersson','m','christerandersson/'],
 ['nikola-tavic','Nikola Tavić','m','ntavic/'],['drazen-orescanin','Dražen Oreščanin','m','dorescanin/'],['branimir-buntak','Branimir Buntak','m','branimir23/'],
 ['jasmina-kutlesa-matosevic','Jasmina Kutleša Matošević','f','jasmina-kutlesa-matosevic/'],
];
// Owner-provided dates. Pitch day (3 November) is not a lecture.
const LECTURES=[
 {id:'startup-pricing',date:'2026-10-29',speaker:'Ivan Bračić',title:{en:'Pricing for startups',hr:'Određivanje cijena za startupe',ru:'Ценообразование для стартапов'}},
 {id:'founder-led-sales',date:'2026-11-02',speaker:'',title:{en:'Founder-led sales',hr:'Prodaja koju vodi osnivač',ru:'Продажи силами основателя'}},
];

export function seedCurated(db,data,lectures=LECTURES){
 const now=nowIso();
 db.transaction(()=>{
  for(const p of data.people)db.query("INSERT INTO people(id,display_name,kind,source,created,updated) VALUES(?,?,'participant','curated',?,?) ON CONFLICT(id) DO NOTHING").run(p.id,p.displayName,now,now);
  for(const [id,name] of STAFF)db.query("INSERT INTO people(id,display_name,kind,source,public_role,created,updated) VALUES(?,?,'staff','curated','BIRD',?,?) ON CONFLICT(id) DO NOTHING").run(id,name,now,now);
  for(const p of data.projects){
   db.query('INSERT INTO teams(id,name,created) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').run(p.teamId,p.displayName.en,now);
   for(const personId of p.memberIds)db.query('INSERT OR IGNORE INTO team_people(team_id,person_id) VALUES(?,?)').run(p.teamId,personId);
   const content=JSON.stringify(curatedContent(p));
   const r=db.query("INSERT INTO projects(id,team_id,source,status,draft,draft_version,published,published_version,published_at,created,updated) VALUES(?,?,'curated','published',?,1,?,1,?,?,?) ON CONFLICT(id) DO NOTHING").run(p.id,p.teamId,content,content,p.contentDate||now,now,now);
   if(r.changes)db.query("INSERT INTO project_revisions(project_id,version,kind,content,author,created) VALUES(?,1,'published',?,NULL,?)").run(p.id,content,now);
  }
  for(const l of lectures)db.query('INSERT INTO lectures(id,date,speaker,title,created,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(l.id,l.date,l.speaker,JSON.stringify(l.title),now,now);
  db.query("INSERT INTO programs(id,name,created) VALUES('bird-2026',?,?) ON CONFLICT(id) DO NOTHING").run(JSON.stringify({en:'BIRD Incubator 2026',hr:'BIRD Inkubator 2026',ru:'Инкубатор BIRD 2026'}),now);
  if(db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='mentors'").get()&&db.query("SELECT 1 FROM pragma_table_info('mentors') WHERE name='gender'").get())
   for(const [slug,name,gender,link] of MENTORS)db.query("INSERT INTO mentors(id,name,area,bio,link,gender,created_by,created,updated) VALUES(?,?,'Mentor speed dating','',?,?,'seed',?,?) ON CONFLICT(id) DO NOTHING").run('mentor-'+slug,name,'https://www.linkedin.com/in/'+link,gender,now,now);
  seedBadges(db);
  seedTasks(db,now);
  // A first shared goal for the cohort (organisers can close it and add others).
  if(!db.query('SELECT 1 FROM cohort_quests').get()&&db.query("SELECT 1 FROM task_templates WHERE id='task-user-interviews'").get())db.query("INSERT INTO cohort_quests(id,title,task_id,target,created_by,created) VALUES('quest-user-interviews',?, 'task-user-interviews',8,'system',?)").run(JSON.stringify({en:'8 teams talk to five users each',hr:'8 timova razgovara s po pet korisnika',ru:'8 команд поговорили с пятью пользователями'}),now);
 })();
}

const T=(en,hr,ru)=>({en,hr,ru});
/** Voluntary site game tasks. They are not official BIRD homework. */
export const EXAMPLE_TASKS=[
 {key:'profile',type:'checklist',scope:'personal',xp:10,checklist:[T('Name and role are correct','Ime i uloga su točni','Имя и роль указаны верно'),T('Character chosen','Odabran lik','Персонаж выбран'),T('Language chosen','Odabran jezik','Язык выбран')],
  t:T(['Fill in your profile','Check your name, role and character so teams can find you.','Open My account, check the name and role, choose a character and a language. Then tick the three items.','All three items are ticked.'],
   ['Ispunite profil','Provjerite ime, ulogu i lik kako bi vas timovi lakše pronašli.','Otvorite Moj račun, provjerite ime i ulogu, odaberite lik i jezik. Zatim označite tri stavke.','Označene su sve tri stavke.'],
   ['Заполнить профиль','Проверьте имя, роль и персонажа, чтобы команды могли вас найти.','Откройте «Мой кабинет», проверьте имя и роль, выберите персонажа и язык. Затем отметьте три пункта.','Отмечены все три пункта.'])},
 {key:'problem-users',type:'text',scope:'team',xp:20,
  t:T(['Describe the problem and the users','Write down who has the problem and why it matters to them.','In a few sentences: who are your users, what problem do they have today and how do they cope with it now.','A short, specific description. Guesses are fine if you mark them as guesses.'],
   ['Opišite problem i korisnike','Zapišite tko ima problem i zašto mu je važan.','U nekoliko rečenica: tko su vaši korisnici, koji problem danas imaju i kako ga sada rješavaju.','Kratak i konkretan opis. Pretpostavke su u redu ako ih tako označite.'],
   ['Описать проблему и пользователей','Запишите, у кого есть проблема и почему она для них важна.','В нескольких предложениях: кто ваши пользователи, какая у них проблема сегодня и как они справляются с ней сейчас.','Короткое конкретное описание. Догадки допустимы, если они так и помечены.'])},
 {key:'presentation',type:'attachment',scope:'team',xp:25,requiresReview:true,
  t:T(['Add a current presentation','Keep one up-to-date deck in the project.','Upload a PDF or PPTX to the project files, then select it here and send it for review.','The deck is current and opens without errors.'],
   ['Dodajte aktualnu prezentaciju','Neka u projektu bude jedna ažurna prezentacija.','Učitajte PDF ili PPTX u datoteke projekta, odaberite ga ovdje i pošaljite na pregled.','Prezentacija je aktualna i otvara se bez pogrešaka.'],
   ['Добавить актуальную презентацию','Держите в проекте одну свежую презентацию.','Загрузите PDF или PPTX в файлы проекта, выберите его здесь и отправьте на проверку.','Презентация актуальна и открывается без ошибок.'])},
 {key:'one-lecture',type:'attendance',scope:'personal',xp:15,counterTarget:1,
  t:T(['Mark one lecture you attended','A self-report of a session you really attended.','Choose a lecture that already took place and that you attended. This is your own report, not an official attendance record.','One past lecture is marked.'],
   ['Označite jedno predavanje na kojem ste bili','Vlastita prijava predavanja kojem ste stvarno prisustvovali.','Odaberite predavanje koje je već održano i na kojem ste bili. Ovo je vaša prijava, a ne službena evidencija.','Označeno je jedno održano predavanje.'],
   ['Отметить одно посещённое занятие','Самоотчёт о занятии, на котором вы действительно были.','Выберите прошедшую лекцию, на которой вы были. Это ваш собственный отчёт, а не официальный учёт посещений.','Отмечена одна прошедшая лекция.'])},
 {key:'three-lectures',type:'attendance',scope:'personal',xp:30,counterTarget:3,
  t:T(['Attend three different lectures','Three different sessions over the programme.','Mark lectures as they happen. The task completes when three different past lectures are recorded. Lectures cannot be added just for this task.','Three different lectures are recorded.'],
   ['Prisustvujte trima različitim predavanjima','Tri različita predavanja tijekom programa.','Označavajte predavanja kako se održavaju. Zadatak je završen kad su zabilježena tri različita održana predavanja. Predavanja se ne mogu dodati samo zbog zadatka.','Zabilježena su tri različita predavanja.'],
   ['Посетить три разные лекции','Три разных занятия за время программы.','Отмечайте лекции по мере их проведения. Задание выполнено, когда записаны три разные прошедшие лекции. Добавить лекции ради задания нельзя.','Записаны три разные лекции.'])},
 {key:'tell-friends',type:'counter',scope:'personal',xp:40,counterTarget:5,
  t:T(['Tell five friends about your project','Practise explaining the project in your own words.','Each time you tell someone about the project, add one. At five, write one short conclusion: what was clear and what was not.','Five conversations and a short conclusion.'],
   ['Ispričajte petero prijatelja o projektu','Vježbajte objašnjavanje projekta svojim riječima.','Svaki put kad nekome ispričate o projektu, dodajte jedan. Kod pet napišite kratak zaključak: što je bilo jasno, a što nije.','Pet razgovora i kratak zaključak.'],
   ['Рассказать о проекте пяти друзьям','Потренируйтесь объяснять проект своими словами.','Каждый раз, когда рассказываете кому-то о проекте, прибавляйте один. На пяти напишите короткий вывод: что было понятно, а что нет.','Пять разговоров и короткий вывод.'])},
 {key:'investor-pitches',type:'counter',scope:'team',xp:80,counterTarget:5,requiresReview:true,
  t:T(['Give five investor pitches','Five real pitch conversations with investors.','Count each pitch. Then write what you learned. Do not write investor names or contacts here. The site never contacts anyone for you.','Five pitches and a short report, reviewed by an organiser.'],
   ['Održite pet pitcheva investitorima','Pet stvarnih razgovora s investitorima.','Brojite svaki pitch. Zatim napišite što ste naučili. Ne upisujte imena ni kontakte investitora. Stranica nikoga ne kontaktira umjesto vas.','Pet pitcheva i kratko izvješće koje pregledava organizator.'],
   ['Провести пять питчей для инвесторов','Пять настоящих разговоров с инвесторами.','Считайте каждый питч. Затем напишите, что вы узнали. Не указывайте имена и контакты инвесторов. Сайт никому не пишет за вас.','Пять питчей и короткий отчёт, который проверяет организатор.'])},
 {key:'user-interviews',type:'counter',scope:'team',xp:60,counterTarget:5,
  t:T(['Talk to five potential users','Learn from people who might use the product.','Count each conversation. At five, write short anonymous findings: no names, no contact details.','Five conversations and anonymous findings.'],
   ['Razgovarajte s petero potencijalnih korisnika','Učite od ljudi koji bi mogli koristiti proizvod.','Brojite svaki razgovor. Kod pet napišite kratke anonimne nalaze, bez imena i kontakata.','Pet razgovora i anonimni nalazi.'],
   ['Поговорить с пятью потенциальными пользователями','Узнайте мнение людей, которые могут пользоваться продуктом.','Считайте каждый разговор. На пяти напишите короткие обезличенные выводы: без имён и контактов.','Пять разговоров и обезличенные выводы.'])},
 {key:'pricing-hypotheses',type:'text',scope:'team',xp:30,
  t:T(['Write three pricing hypotheses','Use the pricing lecture notes.','Write three hypotheses: who pays, for what value, roughly how much, and how you could test each one.','Three hypotheses, each with a test.'],
   ['Zapišite tri hipoteze o cijeni','Koristite bilješke s predavanja o cijenama.','Napišite tri hipoteze: tko plaća, za koju vrijednost, otprilike koliko i kako biste svaku provjerili.','Tri hipoteze, svaka s provjerom.'],
   ['Записать три гипотезы ценообразования','Используйте конспект лекции о ценообразовании.','Запишите три гипотезы: кто платит, за какую ценность, примерно сколько и как вы проверите каждую.','Три гипотезы, у каждой есть проверка.'])},
 {key:'project-update',type:'team_result',scope:'team',xp:20,repeatRule:'weekly_reward',
  t:T(['Publish a project update','Share what changed this week.','Post a public update on the project page. Points are given at most once a week.','A public update was posted this week.'],
   ['Objavite novost o projektu','Podijelite što se promijenilo ovaj tjedan.','Objavite javnu novost na stranici projekta. Bodovi se dodjeljuju najviše jednom tjedno.','Ovaj je tjedan objavljena javna novost.'],
   ['Опубликовать обновление проекта','Расскажите, что изменилось за неделю.','Опубликуйте открытое обновление на странице проекта. Баллы начисляются не чаще раза в неделю.','На этой неделе опубликовано открытое обновление.'])},
 {key:'help-team',type:'team_result',scope:'team',xp:20,
  t:T(['Help another team','Share a skill, a contact or feedback.','Describe briefly how you helped and choose the team. That team confirms it in their account. Nothing from your conversation is published.','The other team confirmed the help.'],
   ['Pomozite drugom timu','Podijelite vještinu, kontakt ili povratnu informaciju.','Ukratko opišite kako ste pomogli i odaberite tim. Taj tim to potvrđuje u svom računu. Ništa iz vašeg razgovora se ne objavljuje.','Drugi tim je potvrdio pomoć.'],
   ['Помочь другой команде','Поделитесь навыком, контактом или отзывом.','Коротко опишите, как вы помогли, и выберите команду. Эта команда подтверждает помощь в своём кабинете. Ничего из вашей переписки не публикуется.','Другая команда подтвердила помощь.'])},
 {key:'weekly-report',type:'text',scope:'team',xp:20,repeatRule:'per_week',
  t:T(['Weekly report','A short note for the assigned week.','What did the team do this week, what did you learn and what is next? Three short answers are enough.','The report for the assigned week is sent.'],
   ['Tjedno izvješće','Kratka bilješka za zadani tjedan.','Što je tim radio ovaj tjedan, što ste naučili i što slijedi? Dovoljna su tri kratka odgovora.','Izvješće za zadani tjedan je poslano.'],
   ['Недельный отчёт','Короткая заметка за назначенную неделю.','Что команда сделала за неделю, что вы узнали и что дальше? Достаточно трёх коротких ответов.','Отчёт за назначенную неделю отправлен.'])},
 {key:'pitch-ten-people',type:'counter',scope:'personal',xp:30,counterTarget:10,pick:'catalog',
  t:T(['Pitch to ten people','Ten short pitches to anyone: friends, family, strangers at a café.','Count each pitch. At ten, write which sentence made people lean in.','Ten pitches and one useful sentence.'],
   ['Pitchajte desetero ljudi','Deset kratkih pitcheva bilo kome: prijateljima, obitelji, strancima u kafiću.','Brojite svaki pitch. Kod deset napišite koja je rečenica najviše zainteresirala ljude.','Deset pitcheva i jedna korisna rečenica.'],
   ['Запитчить десяти людям','Десять коротких питчей кому угодно: друзьям, семье, незнакомцам в кафе.','Считайте каждый питч. На десяти напишите, какая фраза больше всего зацепила слушателей.','Десять питчей и одна полезная фраза.'])},
 {key:'linkedin-post',type:'link',scope:'personal',xp:15,pick:'catalog',
  t:T(['Post about your project','One public post on LinkedIn or another network.','Write what you are building and what you are looking for. Paste the link here.','A public post with a link.'],
   ['Objavite nešto o projektu','Jedna javna objava na LinkedInu ili drugoj mreži.','Napišite što gradite i što tražite. Ovdje zalijepite poveznicu.','Javna objava s poveznicom.'],
   ['Написать пост о проекте','Одна публичная запись в LinkedIn или другой сети.','Напишите, что вы делаете и что ищете. Вставьте сюда ссылку.','Публичный пост со ссылкой.'])},
 {key:'video-pitch',type:'link',scope:'team',xp:25,pick:'catalog',
  t:T(['Record a 60-second video pitch','Short, clear, phone camera is fine.','Problem, solution, who it is for, what you ask for. Upload anywhere and paste the link.','A link to a video of about one minute.'],
   ['Snimite video pitch od 60 sekundi','Kratko i jasno, kamera mobitela je dovoljna.','Problem, rješenje, za koga je, što tražite. Učitajte bilo gdje i zalijepite poveznicu.','Poveznica na video od oko jedne minute.'],
   ['Записать видео-питч на 60 секунд','Коротко и ясно, камеры телефона достаточно.','Проблема, решение, для кого, что вы просите. Загрузите куда угодно и вставьте ссылку.','Ссылка на видео примерно на минуту.'])},
 {key:'landing-test',type:'link',scope:'team',xp:30,pick:'catalog',
  t:T(['Test demand with a landing page','A one-page site with a sign-up button.','Publish a simple page, share it, and write how many people visited and signed up.','A link and two numbers: visitors and sign-ups.'],
   ['Provjerite potražnju landing stranicom','Stranica s gumbom za prijavu.','Objavite jednostavnu stranicu, podijelite je i napišite koliko je ljudi posjetilo i prijavilo se.','Poveznica i dva broja: posjetitelji i prijave.'],
   ['Проверить спрос лендингом','Одностраничный сайт с кнопкой записи.','Опубликуйте простую страницу, поделитесь ею и напишите, сколько людей зашло и оставило заявку.','Ссылка и два числа: посетители и заявки.'])},
 {key:'mentor-session',type:'text',scope:'team',xp:15,pick:'catalog',
  t:T(['Book a mentor conversation','Get outside eyes on your hardest question.','Meet a mentor or an organiser. Write the question you brought and the one piece of advice you will act on.','One question and one action.'],
   ['Dogovorite razgovor s mentorom','Neka netko izvana pogleda vaše najteže pitanje.','Nađite se s mentorom ili organizatorom. Napišite pitanje koje ste donijeli i jedan savjet koji ćete primijeniti.','Jedno pitanje i jedna radnja.'],
   ['Поговорить с ментором','Свежий взгляд на самый сложный вопрос.','Встретьтесь с ментором или организатором. Напишите вопрос, с которым пришли, и один совет, который примените.','Один вопрос и одно действие.'])},
 {key:'first-paying-customer',type:'team_result',scope:'team',xp:100,completion:'admin_only',
  t:T(['First paying customer','The first real payment for your product or service.','Tell the organisers when it happens. They mark it here.','Confirmed by the organisers.'],
   ['Prvi kupac koji plaća','Prva stvarna uplata za vaš proizvod ili uslugu.','Javite organizatorima kad se dogodi. Oni to ovdje označavaju.','Potvrdili organizatori.'],
   ['Первый платящий клиент','Первая настоящая оплата за ваш продукт или услугу.','Сообщите организаторам, когда это случится. Они отметят это здесь.','Подтверждено организаторами.'])},
 {key:'demo-day-ready',type:'team_result',scope:'team',xp:50,completion:'admin_only',
  t:T(['Ready for demo day','Deck, one-pager and a rehearsed pitch.','Organisers mark this after a rehearsal.','Confirmed by the organisers after a rehearsal.'],
   ['Spremni za demo dan','Prezentacija, jedna stranica i uvježban pitch.','Organizatori ovo označavaju nakon probe.','Potvrdili organizatori nakon probe.'],
   ['Готовы к демо-дню','Презентация, one-pager и отрепетированный питч.','Организаторы отмечают это после репетиции.','Подтверждено организаторами после репетиции.'])},
 {key:'demo-day-kit',type:'checklist',scope:'team',xp:40,requiresReview:true,
  checklist:[T('Pitch deck (10–12 slides)','Prezentacija (10–12 slajdova)','Питч-дек (10–12 слайдов)'),T('One-pager for investors','Jedna stranica za investitore','One-pager для инвесторов'),T('Slide with your key numbers','Slajd s ključnim brojevima','Слайд с ключевыми цифрами'),T('Two-minute pitch rehearsed with a timer','Pitch od dvije minute uvježban sa štopericom','Двухминутный питч отрепетирован с таймером'),T('Team photo','Fotografija tima','Фото команды')],
  t:T(['Demo day kit','Everything you need on stage, ready a week early.','Upload the deck and one-pager to project files, tick what is ready and send for review. Organisers check it before the rehearsal.','All five items are ready and checked.'],
   ['Paket za demo dan','Sve što trebate na pozornici, spremno tjedan ranije.','Učitajte prezentaciju i jednu stranicu u datoteke projekta, označite što je spremno i pošaljite na pregled. Organizatori to provjeravaju prije probe.','Svih pet stavki je spremno i provjereno.'],
   ['Набор к демо-дню','Всё нужное для выступления, готово за неделю.','Загрузите презентацию и one-pager в файлы проекта, отметьте готовое и отправьте на проверку. Организаторы проверят до репетиции.','Все пять пунктов готовы и проверены.'])},
];
function seedTasks(db,now){
 for(const task of EXAMPLE_TASKS){
  const translations=Object.fromEntries(Object.entries(task.t).map(([l,[title,goal,instructions,criteria]])=>[l,{title,goal,instructions,criteria}]));
  db.query(`INSERT INTO task_templates(id,key,program_id,type,scope,xp,counter_target,requires_review,self_report,repeat_rule,checklist,translations,status,audience,completion_mode,pick_mode,created,updated) VALUES(?,?,'bird-2026',?,?,?,?,?,1,?,?,?,'published','all_participants',?,?,?,?) ON CONFLICT(key) DO NOTHING`)
   .run('task-'+task.key,task.key,task.type,task.scope,task.xp,task.counterTarget||0,task.requiresReview?1:0,task.repeatRule||'once',JSON.stringify(task.checklist||[]),JSON.stringify(translations),task.completion||'participant',task.pick||'assigned',now,now);
 }
}
