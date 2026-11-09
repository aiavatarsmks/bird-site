/* 9 November 2026: summary of the attendee-supplied lecture transcript.
   Unclear speaker/company names and garbled numerical examples are omitted. */
LECTURES.push({
 id:'vc-fundraising',date:'2026-11-09',speaker:'',
 title:tr('How venture investors choose startups','Kako VC investitori biraju startupe','Как венчурные инвесторы выбирают стартапы'),
 subtitle:tr('When to raise, what a fund looks for and how to choose an investor.','Kada prikupljati kapital, što fond traži i kako odabrati investitora.','Когда привлекать капитал, что ищет фонд и как выбрать инвестора.'),
 bio:tr('BIRD Incubator · Q&A, 9 November 2026. Notes from the supplied transcript, presenting the speaker’s venture-investing perspective.','BIRD Incubator · Pitanja i odgovori, 9. studenoga 2026. Bilješke prema dostavljenom prijepisu, iz perspektive predavača kao VC investitora.','BIRD Incubator · Вопросы и ответы, 9 ноября 2026 года. Конспект по предоставленной расшифровке: взгляд лектора с позиции венчурного инвестора.'),
 tags:tr(['Fundraising','VC & angels','Global markets','Investment terms'],['Prikupljanje kapitala','VC i poslovni anđeli','Strana tržišta','Uvjeti ulaganja'],['Привлечение капитала','Фонды и бизнес-ангелы','Зарубежные рынки','Условия сделки']),
 takeaways:[
  {title:tr('Raise to accelerate','Kapital za brži rast','Капитал для ускорения'),body:tr('Explain what already works and what the investment will help you achieve.','Objasnite što već funkcionira i što ćete postići ulaganjem.','Объясните, что уже работает и каких результатов помогут достичь инвестиции.')},
  {title:tr('Check the fit','Provjerite usklađenost','Проверьте соответствие'),body:tr('A strong business can succeed with a different source of funding.','Dobar posao može uspjeti uz drugi izvor financiranja.','Успешному бизнесу может подойти другой источник финансирования.')},
  {title:tr('Choose the partner','Odaberite partnera','Выбирайте партнёра'),body:tr('Look for useful experience, customer access and fair terms.','Tražite korisno iskustvo, pristup kupcima i poštene uvjete.','Ищите полезный опыт, доступ к клиентам и понятные условия.')}
 ],
 sections:[{
  id:'overview',nav:tr('Overview','Pregled','Обзор'),
  title:tr('A conversation about capital and growth','Razgovor o kapitalu i rastu','Разговор о капитале и росте'),
  intro:tr('On 9 November, BIRD participants discussed fundraising, founder evaluation, international expansion and working with a venture fund in a Q&A session.','Na susretu 9. studenoga polaznici BIRD-a kroz pitanja i odgovore razgovarali su o prikupljanju kapitala, procjeni osnivača, međunarodnom širenju i suradnji s VC fondom.','На встрече 9 ноября участники BIRD обсудили привлечение инвестиций, оценку основателей, международное развитие и работу с венчурным фондом. Встреча прошла в формате вопросов и ответов.'),
  blocks:[block(tr('The main idea','Glavna poruka','Главная мысль'),tr('Funding should support concrete growth goals. The discussion covered when to raise, what evidence investors expect, which terms deserve attention and when bootstrapping or industry angels may be a better fit.','Financiranje treba poduprijeti konkretne ciljeve rasta. Rasprava je obuhvatila pravi trenutak za ulaganje, dokaze koje investitori očekuju, uvjete ugovora te situacije u kojima su vlastiti prihodi ili poslovni anđeli iz industrije prikladniji izbor.','Финансирование должно помогать достигать конкретных целей роста. Обсудили подходящий момент для раунда, доказательства спроса, условия сделок и ситуации, когда лучше развиваться на собственную выручку или с отраслевыми бизнес-ангелами.'),'text')]
 },{
  id:'timing',nav:tr('When to raise','Kada tražiti kapital','Когда привлекать'),
  title:tr('Show what capital will accelerate','Pokažite što će kapital ubrzati','Покажите, что ускорят инвестиции'),
  intro:tr('The speaker’s preferred starting point: a clear product, a customer segment and a tested way to reach buyers.','Predavač kao dobru polaznu točku navodi jasan proizvod, segment kupaca i provjeren način prodaje.','По мнению лектора, сильная отправная точка — понятный продукт, определённые клиенты и проверенный способ продаж.'),
  blocks:[block(null,tr([
   'For most software businesses, revenue and growth are stronger evidence than a pitch alone. Early profitability was not the speaker’s main criterion.',
   'Hardware may need funding before delivery. Design partners and prospective customers can help demonstrate demand.',
   'Investments before a product exists are possible when a fund has strong confidence in the founders.'
  ],[
   'Za većinu softverskih tvrtki prihodi i rast uvjerljiviji su od same prezentacije. Rana profitabilnost predavaču nije bila glavni kriterij.',
   'Hardver može zahtijevati kapital prije isporuke. Razvojni partneri i budući kupci mogu pomoći dokazati potražnju.',
   'Ulaganje prije postojanja proizvoda moguće je kada fond ima veliko povjerenje u osnivače.'
  ],[
   'Для большинства программных продуктов выручка и рост убедительнее одной презентации. Ранняя прибыльность не была главным критерием лектора.',
   'Оборудованию может понадобиться капитал до начала поставок. Спрос помогают подтвердить партнёры по разработке и будущие заказчики.',
   'Инвестиции до появления продукта возможны, если фонд достаточно уверен в основателях.'
  ]))]
 },{
  id:'venture-fit',nav:tr('Venture fit','Prikladnost za VC','Подходит ли VC'),
  title:tr('Understand the fund’s return expectations','Razumijte očekivanja fonda','Поймите ожидания фонда'),
  intro:tr('A venture fund needs a few large successes to compensate for losses elsewhere in its portfolio.','VC fond treba nekoliko velikih uspjeha koji nadoknađuju gubitke drugih ulaganja.','Венчурному фонду нужно несколько крупных успехов, чтобы компенсировать потери других инвестиций.'),
  blocks:[block(null,tr('The speaker looks for the potential for one investment to return an amount comparable to the whole fund. The required company exit value depends on the stake and future dilution. A profitable regional business may still be outside that mandate.','Predavač traži potencijal da jedno ulaganje vrati iznos usporediv s veličinom cijelog fonda. Potrebna vrijednost tvrtke pri prodaji ovisi o udjelu i budućem razrjeđivanju. Profitabilna regionalna tvrtka ipak može biti izvan tog mandata.','Лектор ищет потенциал, при котором одна инвестиция может вернуть сумму, сопоставимую с размером всего фонда. Необходимая стоимость продажи компании зависит от доли фонда и её будущего размывания. Прибыльный региональный бизнес может не подходить под эти требования.'),'text'),
  block(tr('Other funding paths','Drugi izvori financiranja','Другие пути финансирования'),tr('The discussion included building from customer revenue, industry angels, loans and programmes with different investment goals. The speaker also supported founders who grow without VC, keep ownership and later sell the business.','Spomenuti su rast iz prihoda od kupaca, poslovni anđeli iz industrije, krediti i programi s drukčijim ciljevima ulaganja. Predavač je podržao i osnivače koji rastu bez VC-a, zadržavaju vlasništvo i kasnije prodaju tvrtku.','Обсудили развитие на выручку, отраслевых бизнес-ангелов, кредиты и программы с другими инвестиционными целями. Лектор также поддержал путь, при котором основатели растут без VC, сохраняют доли и позже продают бизнес.'),'text')]
 },{
  id:'founders',nav:tr('Founders','Osnivači','Основатели'),
  title:tr('Experience, commitment and ambition','Iskustvo, predanost i ambicija','Опыт, вовлечённость и амбиции'),
  intro:tr('A fund evaluates the people as well as the current idea.','Fond procjenjuje ljude jednako kao i trenutačnu ideju.','Фонд оценивает людей вместе с текущей идеей.'),
  blocks:[block(null,tr([
   'Previous startup experience, including failures, can show that a founder has learned by building.',
   'An early role at a successful startup and deep industry knowledge are useful signals.',
   'The speaker values full commitment, ambitious goals and the ability to change direction when evidence calls for it.',
   'A founder bet means trusting the team to find a stronger opportunity even if the initial idea changes.'
  ],[
   'Prethodno iskustvo sa startupima, uključujući neuspjehe, može pokazati da je osnivač učio kroz rad.',
   'Rani rad u uspješnom startupu i duboko poznavanje industrije korisni su pokazatelji.',
   'Predavač cijeni potpunu predanost, ambiciozne ciljeve i sposobnost promjene smjera kada dokazi to opravdavaju.',
   'Ulaganje u osnivače znači povjerenje da će tim pronaći bolju priliku čak i ako se početna ideja promijeni.'
  ],[
   'Опыт предыдущих стартапов, включая неудачные, может показать, чему основатель научился на практике.',
   'Работа на раннем этапе успешного стартапа и глубокое знание отрасли — полезные сигналы.',
   'Лектор ценит полную вовлечённость, амбиции и способность менять направление на основе полученных данных.',
   'Ставка на основателей означает доверие к способности команды найти более сильную возможность, даже если первоначальная идея изменится.'
  ]))]
 },{
  id:'evidence',nav:tr('Evidence & budget','Dokazi i proračun','Доказательства и бюджет'),
  title:tr('Make demand and spending concrete','Konkretizirajte potražnju i troškove','Конкретизируйте спрос и расходы'),
  intro:tr('A data room is a folder of documents that supports the claims made in a pitch.','Data room je mapa dokumenata koji potkrepljuju tvrdnje iz prezentacije.','Data room — папка документов, подтверждающих утверждения из презентации.'),
  blocks:[block(tr('What to prepare','Što pripremiti','Что подготовить'),tr([
   'Cap table: who owns the company and in what proportions.',
   'Customer and design-partner contracts, available financial results and relevant intellectual-property documents.',
   'Evidence of actual commitments. The speaker distinguished binding customer contracts from non-binding letters of intent.',
   'A specific use of funds: who you will hire, why they are needed and which tested sales channels you will expand.'
  ],[
   'Vlasnička struktura: tko posjeduje tvrtku i u kojim omjerima.',
   'Ugovori s kupcima i razvojnim partnerima, raspoloživi financijski rezultati i relevantni dokumenti o intelektualnom vlasništvu.',
   'Dokazi stvarnih obveza. Predavač je razlikovao obvezujuće ugovore s kupcima od neobvezujućih pisama namjere.',
   'Konkretna namjena kapitala: koga ćete zaposliti, zašto i koje ćete provjerene prodajne kanale proširiti.'
  ],[
   'Распределение долей: кому и в каких пропорциях принадлежит компания.',
   'Договоры с клиентами и партнёрами по разработке, имеющиеся финансовые результаты и документы на интеллектуальную собственность.',
   'Подтверждения реальных обязательств. Лектор различал договоры с клиентами и необязывающие письма о намерениях.',
   'Конкретное назначение капитала: кого нанять, зачем эти люди нужны и какие проверенные каналы продаж расширять.'
  ])),block(null,tr('General categories such as hiring and marketing say little on their own. Connect the requested amount to growth milestones and the next stage of the company.','Opće kategorije poput zapošljavanja i marketinga same po sebi govore malo. Povežite traženi iznos s ciljevima rasta i sljedećom fazom tvrtke.','Общие категории вроде найма и маркетинга мало что объясняют сами по себе. Свяжите запрашиваемую сумму с результатами роста и следующим этапом компании.'),'text')]
 },{
  id:'investors',nav:tr('Choosing an investor','Odabir investitora','Выбор инвестора'),
  title:tr('Ask what the investor can help you do','Pitajte kako investitor može pomoći','Выясните, чем инвестор поможет'),
  intro:tr('Industry knowledge, introductions and practical support were central to the speaker’s view of a good investment partnership.','Poznavanje industrije, povezivanje s ljudima i praktična podrška bili su ključni u predavačevu opisu dobrog investicijskog partnerstva.','Отраслевой опыт, знакомства и практическая поддержка — основные признаки полезного партнёрства в изложении лектора.'),
  blocks:[block(null,tr([
   'Ask what year of its investment cycle the fund is in and how much capital it still has available to invest.',
   'Discuss access to customers, hiring, go-to-market support and help with the next round.',
   'Agree on the investor’s involvement: board seat, observer role and frequency of working meetings.',
   'Early industry advisors may also invest as angels. The speaker favoured relevant expertise and useful connections.'
  ],[
   'Pitajte u kojoj je godini investicijskog ciklusa fond i koliko kapitala još može uložiti.',
   'Razgovarajte o pristupu kupcima, zapošljavanju, izlasku na tržište i pomoći sa sljedećom rundom.',
   'Dogovorite ulogu investitora: mjesto u upravi, promatračku ulogu i učestalost radnih sastanaka.',
   'Rani savjetnici iz industrije mogu ulagati i kao poslovni anđeli. Predavač je istaknuo relevantno iskustvo i korisne kontakte.'
  ],[
   'Спросите, на каком году инвестиционного цикла находится фонд и сколько капитала ещё может вложить.',
   'Обсудите доступ к клиентам, найм, поддержку выхода на рынок и помощь со следующим раундом.',
   'Согласуйте участие инвестора: место в совете директоров, роль наблюдателя и частоту рабочих встреч.',
   'Отраслевые советники на раннем этапе могут также вложиться как бизнес-ангелы. Лектор выделил пользу профильного опыта и связей.'
  ]))]
 },{
  id:'deal',nav:tr('Process & terms','Postupak i uvjeti','Процесс и условия'),
  title:tr('Understand the deal before signing','Razumijte uvjete prije potpisa','Разберитесь в сделке до подписания'),
  intro:tr('A term sheet sets out the main proposed terms. The final investment requires further agreements.','Term sheet navodi glavne predložene uvjete. Za konačno ulaganje potrebni su dodatni ugovori.','Term sheet фиксирует основные предлагаемые условия. Для завершения инвестиции подписывают окончательные договоры.'),
  blocks:[block(tr('The process described','Opisani postupak','Описанный процесс'),tr('Initial conversation → partner meetings → due diligence on the team, customers, documents and market → agreement on terms → final contracts and investment. The speaker estimated around four weeks for his fund, with longer processes at some institutionally funded funds.','Prvi razgovor → sastanci s partnerima → provjera tima, kupaca, dokumenata i tržišta → dogovor o uvjetima → konačni ugovori i ulaganje. Predavač je za svoj fond naveo približno četiri tjedna, uz dulje postupke kod nekih institucionalno financiranih fondova.','Первый разговор → встречи с партнёрами фонда → проверка команды, клиентов, документов и рынка → согласование условий → окончательные договоры и инвестиция. Лектор назвал около четырёх недель для своего фонда; у некоторых фондов с институциональным финансированием процесс дольше.'),'text'),
  block(tr('Terms discussed','Uvjeti o kojima se govorilo','Обсуждавшиеся условия'),tr([
   'Liquidation preference determines priority in distributing proceeds on a sale or liquidation. The speaker highlighted multiples above 1x as a warning sign in early rounds.',
   'Control rights and special shares can affect the founder’s decisions and future fundraising.',
   'A SAFE provides for future equity under its agreed terms. A convertible loan is debt that may convert into equity; direct equity investment buys a stake immediately.'
  ],[
   'Likvidacijska povlastica određuje prvenstvo pri raspodjeli prihoda od prodaje ili likvidacije. Predavač je višekratnike iznad 1x istaknuo kao znak za oprez u ranim rundama.',
   'Prava kontrole i posebne dionice mogu utjecati na odluke osnivača i buduće financiranje.',
   'SAFE predviđa budući vlasnički udio prema dogovorenim uvjetima. Konvertibilni zajam dug je koji se može pretvoriti u udio; izravnim ulaganjem u kapital udio se kupuje odmah.'
  ],[
   'Ликвидационная привилегия определяет приоритет распределения средств при продаже или ликвидации. Лектор назвал множители выше 1x поводом для внимания в ранних раундах.',
   'Права контроля и особые акции могут влиять на решения основателя и будущие раунды.',
   'SAFE предусматривает получение доли в будущем на согласованных условиях. Конвертируемый заём — долг, который может превратиться в долю; прямая инвестиция в капитал означает покупку доли сразу.'
  ]))]
 },{
  id:'markets',nav:tr('Markets & focus','Tržišta i fokus','Рынки и фокус'),
  title:tr('Start focused, plan for a larger market','Počnite fokusirano, planirajte veće tržište','Начинайте с фокусом на конкретной задаче'),
  intro:tr('Starting small means solving a specific problem first, with room to expand the product and reach more customers.','Početi malo znači najprije riješiti konkretan problem, uz prostor za proširenje proizvoda i dosega kupaca.','Начать с малого означает сначала решить конкретную проблему, сохранив возможность расширять продукт и аудиторию.'),
  blocks:[block(null,tr([
   'Estimate the broader addressable market, including places where competitors already operate.',
   'Test international demand through founder-led sales, LinkedIn, industry forums, Reddit and local or expat communities.',
   'Time spent in a target country can help build market understanding when it has a clear commercial purpose.',
   'Local partners and revenue sharing can help, but alignment and execution matter. A new partner does not automatically replace the founder’s sales effort.'
  ],[
   'Procijenite šire dostupno tržište, uključujući zemlje u kojima konkurenti već posluju.',
   'Provjerite međunarodnu potražnju kroz prodaju koju vodi osnivač, LinkedIn, strukovne forume, Reddit te lokalne ili iseljeničke zajednice.',
   'Boravak u ciljanoj zemlji može pomoći razumjeti tržište kada ima jasan poslovni cilj.',
   'Lokalni partneri i podjela prihoda mogu pomoći, ali važni su usklađenost i izvedba. Novi partner ne zamjenjuje automatski prodajni rad osnivača.'
  ],[
   'Оценивайте весь доступный рынок, включая страны, где конкуренты уже работают.',
   'Проверяйте международный спрос через продажи силами основателя, LinkedIn, отраслевые форумы, Reddit, местные сообщества и сообщества экспатов.',
   'Пребывание в целевой стране помогает понять рынок, если у поездки есть конкретная деловая цель.',
   'Местные партнёры и разделение выручки могут помочь, но важны совпадение целей и качество работы. Новый партнёр не заменяет автоматически продажи силами основателя.'
  ]))]
 },{
  id:'moats',nav:tr('Competitive advantages','Konkurentske prednosti','Конкурентные преимущества'),
  title:tr('Distribution, data and hardware risks','Distribucija, podaci i rizici hardvera','Дистрибуция, данные и риски оборудования'),
  intro:tr('In the AI discussion, the speaker emphasised distribution and unique data as sources of defensibility.','U raspravi o AI-ju predavač je istaknuo distribuciju i jedinstvene podatke kao izvore konkurentske zaštite.','В обсуждении AI лектор выделил дистрибуцию и уникальные данные как источники защиты от конкурентов.'),
  blocks:[block(null,tr([
   'Distribution: reaching customers and becoming deeply integrated in their work, especially in industries that are difficult to sell into.',
   'Data: collecting useful information that competitors do not have.',
   'For hardware, assess supply chains, inventory, seasonality, production costs and protection of intellectual property.'
  ],[
   'Distribucija: pristup kupcima i duboka integracija u njihov rad, posebno u industrijama u kojima je prodaja zahtjevna.',
   'Podaci: prikupljanje korisnih informacija koje konkurenti nemaju.',
   'Kod hardvera procijenite lance opskrbe, zalihe, sezonalnost, proizvodne troškove i zaštitu intelektualnog vlasništva.'
  ],[
   'Дистрибуция: доступ к клиентам и глубокое внедрение в их работу, особенно в отраслях со сложными продажами.',
   'Данные: сбор полезной информации, которой нет у конкурентов.',
   'Для оборудования оцените цепочки поставок, запасы, сезонность, затраты на производство и защиту интеллектуальной собственности.'
  ]))]
 },{
  id:'after-funding',nav:tr('After funding','Nakon ulaganja','После инвестиций'),
  title:tr('Capital brings new expectations','Kapital donosi nova očekivanja','Капитал повышает ожидания'),
  intro:tr('Closing a round begins the next stage of work. The money must help the company reach the milestones it raised for.','Zatvaranje runde početak je sljedeće faze rada. Kapital treba pomoći tvrtki ostvariti ciljeve zbog kojih je prikupljen.','Закрытие раунда начинает следующий этап работы. Деньги должны помочь компании достичь результатов, ради которых их привлекали.'),
  blocks:[block(null,tr('The speaker described greater responsibility, regular communication with investors and pressure to turn spending into growth. The right financing path depends on the founders’ goals, the market and the scale of company they want to build.','Predavač je opisao veću odgovornost, redovitu komunikaciju s investitorima i pritisak da se ulaganja pretvore u rast. Prikladan put financiranja ovisi o ciljevima osnivača, tržištu i veličini tvrtke koju žele izgraditi.','Лектор описал рост ответственности, регулярное общение с инвесторами и необходимость превращать расходы в рост. Подходящий путь финансирования зависит от целей основателей, рынка и масштаба компании, которую они хотят построить.'),'text')]
 }]
});
UI.count=tr(`${LECTURES.length} lectures · 3 languages`,`${LECTURES.length} predavanja · 3 jezika`,`${LECTURES.length} лекции · 3 языка`);
