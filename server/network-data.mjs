/**
 * Fixed lists of the Hubvers network (server/network.mjs): countries with their region and capital, known cities for
 * the map, expertise categories and languages. Names are {hr,en,ru}; languages are written in their own language,
 * so they need no translation. Regions are the ones of data/hubs.json.
 */
const N=(hr,en,ru)=>({hr,en,ru});
// code: [region, name, capital latitude, longitude]
export const COUNTRIES={
 AL:['balkans',N('Albanija','Albania','Албания'),41.327,19.819],
 AT:['western',N('Austrija','Austria','Австрия'),48.208,16.373],
 BA:['balkans',N('Bosna i Hercegovina','Bosnia and Herzegovina','Босния и Герцеговина'),43.856,18.413],
 BE:['western',N('Belgija','Belgium','Бельгия'),50.85,4.35],
 BG:['cee',N('Bugarska','Bulgaria','Болгария'),42.698,23.322],
 CH:['western',N('Švicarska','Switzerland','Швейцария'),46.948,7.447],
 CY:['southern',N('Cipar','Cyprus','Кипр'),35.185,33.382],
 CZ:['cee',N('Češka','Czechia','Чехия'),50.075,14.437],
 DE:['western',N('Njemačka','Germany','Германия'),52.52,13.405],
 DK:['nordics',N('Danska','Denmark','Дания'),55.676,12.568],
 EE:['cee',N('Estonija','Estonia','Эстония'),59.437,24.753],
 ES:['southern',N('Španjolska','Spain','Испания'),40.417,-3.704],
 FI:['nordics',N('Finska','Finland','Финляндия'),60.169,24.938],
 FR:['western',N('Francuska','France','Франция'),48.857,2.352],
 GB:['western',N('Ujedinjeno Kraljevstvo','United Kingdom','Великобритания'),51.507,-0.128],
 GR:['southern',N('Grčka','Greece','Греция'),37.984,23.728],
 HR:['cee',N('Hrvatska','Croatia','Хорватия'),45.815,15.982],
 HU:['cee',N('Mađarska','Hungary','Венгрия'),47.498,19.04],
 IE:['western',N('Irska','Ireland','Ирландия'),53.35,-6.26],
 IT:['southern',N('Italija','Italy','Италия'),41.9,12.496],
 LT:['cee',N('Litva','Lithuania','Литва'),54.687,25.28],
 LU:['western',N('Luksemburg','Luxembourg','Люксембург'),49.611,6.13],
 LV:['cee',N('Latvija','Latvia','Латвия'),56.949,24.105],
 ME:['balkans',N('Crna Gora','Montenegro','Черногория'),42.441,19.263],
 MK:['balkans',N('Sjeverna Makedonija','North Macedonia','Северная Македония'),41.998,21.425],
 MT:['southern',N('Malta','Malta','Мальта'),35.899,14.514],
 NL:['western',N('Nizozemska','Netherlands','Нидерланды'),52.368,4.904],
 NO:['nordics',N('Norveška','Norway','Норвегия'),59.913,10.752],
 PL:['cee',N('Poljska','Poland','Польша'),52.23,21.012],
 PT:['southern',N('Portugal','Portugal','Португалия'),38.722,-9.139],
 RO:['cee',N('Rumunjska','Romania','Румыния'),44.426,26.102],
 RS:['balkans',N('Srbija','Serbia','Сербия'),44.787,20.457],
 SE:['nordics',N('Švedska','Sweden','Швеция'),59.329,18.069],
 SI:['cee',N('Slovenija','Slovenia','Словения'),46.056,14.506],
 SK:['cee',N('Slovačka','Slovakia','Словакия'),48.149,17.107],
 UA:['cee',N('Ukrajina','Ukraine','Украина'),50.45,30.523],
 XK:['balkans',N('Kosovo','Kosovo','Косово'),42.663,21.165],
};
// Cities with their own dot on the map; a city not on this list sits at its country's capital.
// [country, name, latitude, longitude, other spellings]
export const CITIES=[
 ['HR',N('Zagreb','Zagreb','Загреб'),45.815,15.982],['HR',N('Split','Split','Сплит'),43.508,16.44],['HR',N('Rijeka','Rijeka','Риека'),45.327,14.442],['HR',N('Osijek','Osijek','Осиек'),45.554,18.695],
 ['SI',N('Ljubljana','Ljubljana','Любляна'),46.056,14.506],['SI',N('Maribor','Maribor','Марибор'),46.554,15.646],
 ['RS',N('Beograd','Belgrade','Белград'),44.787,20.457,['belgrad']],['RS',N('Novi Sad','Novi Sad','Нови-Сад'),45.267,19.833],
 ['AT',N('Beč','Vienna','Вена'),48.208,16.373,['wien']],['AT',N('Graz','Graz','Грац'),47.07,15.439],
 ['IT',N('Milano','Milan','Милан'),45.464,9.19],['IT',N('Rim','Rome','Рим'),41.9,12.496,['roma']],
 ['DE',N('Berlin','Berlin','Берлин'),52.52,13.405],['DE',N('München','Munich','Мюнхен'),48.137,11.575,['munchen','muenchen']],['DE',N('Hamburg','Hamburg','Гамбург'),53.551,9.993],
 ['BA',N('Sarajevo','Sarajevo','Сараево'),43.856,18.413],['HU',N('Budimpešta','Budapest','Будапешт'),47.498,19.04],
 ['CZ',N('Prag','Prague','Прага'),50.075,14.437,['praha']],['PL',N('Varšava','Warsaw','Варшава'),52.23,21.012,['warszawa']],['PL',N('Krakov','Kraków','Краков'),50.065,19.945,['krakow']],
 ['RO',N('Bukurešt','Bucharest','Бухарест'),44.426,26.102,['bucuresti']],['RO',N('Cluj-Napoca','Cluj-Napoca','Клуж-Напока'),46.77,23.59,['cluj']],
 ['BG',N('Sofija','Sofia','София'),42.698,23.322],['GB',N('London','London','Лондон'),51.507,-0.128],['FR',N('Pariz','Paris','Париж'),48.857,2.352],
 ['NL',N('Amsterdam','Amsterdam','Амстердам'),52.368,4.904],['ES',N('Madrid','Madrid','Мадрид'),40.417,-3.704],['ES',N('Barcelona','Barcelona','Барселона'),41.385,2.173],
 ['CH',N('Zürich','Zurich','Цюрих'),47.377,8.541,['zuerich']],['SE',N('Stockholm','Stockholm','Стокгольм'),59.329,18.069],['FI',N('Helsinki','Helsinki','Хельсинки'),60.169,24.938],
 ['EE',N('Tallinn','Tallinn','Таллин'),59.437,24.753],['PT',N('Lisabon','Lisbon','Лиссабон'),38.722,-9.139,['lisboa']],['DK',N('Kopenhagen','Copenhagen','Копенгаген'),55.676,12.568,['kobenhavn']],
];
// Expertise of a mentor: a fixed list, so filters and the map count the same things.
export const CATEGORIES={
 sales:N('Prodaja','Sales','Продажи'),fundraising:N('Prikupljanje sredstava','Fundraising','Привлечение инвестиций'),big_tech:N('Big Tech','Big Tech','Big Tech'),
 product:N('Proizvod','Product','Продукт'),marketing:N('Marketing','Marketing','Маркетинг'),legal:N('Pravo','Legal','Юридические вопросы'),
 finance:N('Financije','Finance','Финансы'),engineering:N('Tehnologija','Engineering','Разработка'),ai_data:N('AI i podaci','AI and data','ИИ и данные'),
 design:N('Dizajn','Design','Дизайн'),people:N('Tim i zapošljavanje','People and hiring','Команда и найм'),operations:N('Operacije','Operations','Операции'),
 impact:N('Održivost','Impact and climate','Устойчивое развитие'),
};
export const LANGUAGES={hr:'Hrvatski',en:'English',de:'Deutsch',it:'Italiano',sl:'Slovenščina',sr:'Srpski',bs:'Bosanski',hu:'Magyar',cs:'Čeština',sk:'Slovenčina',pl:'Polski',ro:'Română',bg:'Български',mk:'Македонски',sq:'Shqip',fr:'Français',es:'Español',pt:'Português',nl:'Nederlands',sv:'Svenska',ru:'Русский',uk:'Українська'};
export const OPEN_TO=['messages','calls','investing'];

const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').toLowerCase().trim();
const CITY_INDEX=new Map();
for(const [country,name,lat,lon,also=[]] of CITIES)for(const v of [...Object.values(name),...also])CITY_INDEX.set(country+':'+fold(v),{name,lat,lon});
/** Where a profile sits on the map: the known city, or the capital of its country. */
export function place(country,city){
 const known=CITY_INDEX.get(country+':'+fold(city));
 if(known)return {key:country+':'+fold(known.name.en),name:known.name,lat:known.lat,lon:known.lon};
 const c=COUNTRIES[country];
 return c?{key:country+':'+fold(city),name:N(city,city,city),lat:c[2],lon:c[3]}:null;
}

// Investors (server/investors.mjs) -------------------------------------------------------------------------------------
// Sectors an investor looks at: a fixed list like the mentors' expertise. Projects have no sector yet, so today the list
// only describes the investor; a project filter by sector comes when projects get one.
export const INDUSTRIES={
 software:N('Softver i SaaS','Software and SaaS','ПО и SaaS'),fintech:N('Fintech','Fintech','Финтех'),health:N('Zdravlje i medtech','Health and medtech','Здоровье и медтех'),
 climate:N('Klima i energija','Climate and energy','Климат и энергетика'),food:N('Hrana i poljoprivreda','Food and agriculture','Еда и агро'),education:N('Obrazovanje','Education','Образование'),
 mobility:N('Mobilnost','Mobility','Мобильность'),commerce:N('Trgovina i potrošači','Commerce and consumer','Торговля и потребители'),industry:N('Industrija i hardver','Industry and hardware','Промышленность и железо'),
 tourism:N('Turizam','Tourism','Туризм'),media:N('Mediji i kreativa','Media and creative','Медиа и креатив'),ai:N('Umjetna inteligencija','AI','ИИ'),
};
// Free mail providers: an investor signs up with the fund's own domain, never with one of these (or their country variants).
export const FREE_MAIL=['gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','msn.com','yahoo.com','ymail.com','rocketmail.com','aol.com','icloud.com','me.com','mac.com',
 'proton.me','protonmail.com','protonmail.ch','pm.me','tutanota.com','tuta.io','gmx.com','gmx.net','gmx.de','gmx.at','gmx.ch','yandex.com','yandex.ru','ya.ru','mail.ru','bk.ru','inbox.ru','list.ru',
 'web.de','t-online.de','freenet.de','abv.bg','zoho.com','mail.com','email.com','fastmail.com','hey.com','qq.com','163.com','seznam.cz','centrum.cz','wp.pl','o2.pl','interia.pl','onet.pl',
 'libero.it','virgilio.it','orange.fr','wanadoo.fr','laposte.net','free.fr','sfr.fr','btinternet.com','sky.com','post.cz','net.hr','inet.hr','t-com.hr','yahoo.co.uk','hotmail.co.uk','live.co.uk','rambler.ru','ukr.net','bluewin.ch','telenet.be','skynet.be','ziggo.nl','kpnmail.nl','hushmail.com','gmx.fr'];
// Country variants of the big ones: hotmail.fr, yahoo.de, outlook.hr, live.it and the like.
export const FREE_MAIL_FAMILIES=/^(?:gmail|googlemail|hotmail|outlook|live|yahoo|ymail|icloud|proton(?:mail)?|gmx|yandex|aol|mail|msn)\.[a-z]{2,3}(?:\.[a-z]{2})?$/;
export const isFreeMail=domain=>FREE_MAIL.includes(domain)||FREE_MAIL_FAMILIES.test(domain);
