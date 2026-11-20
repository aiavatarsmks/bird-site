/**
 * Hubvers: the public site around the demo workspace (docs/hubverse-vision.md). One top menu on every public page
 * (the landing and the section pages /hubs, /mentors, /investors); each section page is its own light HTML file that
 * loads only the shared menu files and its own CSS/JS. Served where the landing is served: a demo workspace.
 * Croatian is in the markup for the first paint; site-menu.js switches to English or Russian like the landing does.
 */
export const SITE_NAME='Hubvers';
// Section pages: address -> page file (repo root, copied to public/ by build-site.mjs).
// /privacy and /contact are not in the top menu: the footer links them on every page.
export const SITE_PAGES={'/hubs':'hubs.html','/mentors':'mentors.html','/investors':'investors.html','/privacy':'privacy.html','/contact':'contact.html'};
// The catalogue of hubs behind the map and list on /hubs: data/hubs.json, published as public/hubs.json.
export const HUBS_FILE='hubs.json';
// Assets of the menu and the section pages; served next to the landing in a demo workspace.
export const SITE_ASSETS=['site-menu.css','site-menu.js','site-page.css','hubs.css','hubs.js','showcase.js','privacy.js','network.js','network.css','investor.js','investor.css'];
// The mentor network (server/network.mjs): pages below /mentors, not in the sitemap (they need an account, or say so).
// A profile's address is /mentors/@<account id>; one page file shows any of them.
export const NETWORK_PAGES={'/mentors/network':'mentors-network.html','/mentors/me':'mentors-me.html'};
export const PROFILE_PAGE='mentor-profile.html',PROFILE_PATH=/^\/mentors\/@[A-Za-z0-9_-]{1,80}$/;
// The investor cabinet (server/investors.mjs): the dashboard and a project's read-only page, /investors/p/<hub>/<project>.
export const INVESTOR_PAGES={'/investors/me':'investors-me.html'};
export const INVESTOR_PROJECT_PAGE='investors-project.html',INVESTOR_PROJECT_PATH=/^\/investors\/p\/[a-z0-9][a-z0-9-]{1,30}\/[A-Za-z0-9._-]{1,100}$/;
export const ALL_PAGE_FILES=[...Object.values(SITE_PAGES),...Object.values(NETWORK_PAGES),PROFILE_PAGE,...Object.values(INVESTOR_PAGES),INVESTOR_PROJECT_PAGE];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LINKS=[['hubs','/hubs','Hubovi'],['demo','/demo','Demo'],['mentors','/mentors','Mentori'],['investors','/investors','Investitori']];

/** The shared top menu. `current` is the key of the page it sits on ('home' for the landing). The sign-in slot is also
 *  whoami.js's account control: where that script runs (the landing) it shows who is signed in; elsewhere it stays a link. */
export function renderMenu(current){
 return `<link rel="stylesheet" href="/assets/site-menu.css"><script>document.documentElement.classList.add('sm-js')</script><script src="/assets/site-menu.js" defer></script>
<header class="sm" id="top"><div class="sm-in">
 <a class="sm-logo" href="/"${current==='home'?' aria-current="page"':''}><span class="sm-mark" aria-hidden="true"><i></i><i></i><i></i></span><b>${esc(SITE_NAME)}</b></a>
 <button class="sm-toggle" type="button" aria-expanded="false" aria-controls="sm-panel" data-sm-toggle><span class="sm-burger" aria-hidden="true"><i></i><i></i><i></i></span><span data-m="menu">Izbornik</span></button>
 <div class="sm-panel" id="sm-panel">
  <nav class="sm-nav" aria-label="Glavna navigacija" data-m-aria="navLabel">${LINKS.map(([k,href,label])=>`<a href="${href}" data-m="${k}"${k===current?' aria-current="page"':''}>${label}</a>`).join('')}</nav>
  <div class="sm-langs" role="group" aria-label="Jezik" data-m-aria="langLabel"><button type="button" data-lang="hr" aria-pressed="true">HR</button><button type="button" data-lang="en" aria-pressed="false">EN</button><button type="button" data-lang="ru" aria-pressed="false">RU</button></div>
  <div class="sm-account" data-account-menu="/demo"><a class="sm-signin" href="/demo#/account/login" data-m="signIn">Prijava</a></div>
 </div>
</div></header>`;
}

const FOOT=[['footPrivacy','/privacy','Privatnost'],['footContact','/contact','Kontakt'],['hubs','/hubs','Hubovi'],['demo','/demo','Demo']];
/** The shared footer: what the site is, the legal and contact pages, the copyright. Styles in site-menu.css. */
export function renderFooter(){
 return `<footer class="sf"><div class="sf-in">
 <p class="sf-about"><b>${esc(SITE_NAME)}</b> <span data-m="footLine">· platforma za inkubatore i akceleratore · Zagreb, Hrvatska</span></p>
 <nav class="sf-nav" aria-label="Podnožje" data-m-aria="footLabel">${FOOT.map(([k,href,label])=>`<a href="${href}" data-m="${k}">${label}</a>`).join('')}</nav>
 <p class="sf-copy">© 2026 ${esc(SITE_NAME)}</p>
</div></footer>`;
}

/** Fills a public page: the menu and footer, the site and product names, and the absolute address for canonical and social tags. */
export const renderSite=(html,{origin,current,product='',europe=''})=>html.replace('{{europe}}',()=>europe).replace('{{menu}}',()=>renderMenu(current)).replace('{{footer}}',()=>renderFooter()).replaceAll('{{site}}',SITE_NAME).replaceAll('{{product}}',product).replaceAll('{{origin}}',origin);

// The public address. Crawlers and web filters should see one site, so on hubvers.com (with or without www) canonical
// links always name https://www.hubvers.com; elsewhere (Railway's own address, a local run) the address of the request.
export const SITE_ORIGIN='https://www.hubvers.com';
export const siteOrigin=(request,fallback)=>/^(?:www\.)?hubvers\.com(?::\d+)?$/i.test(new URL(request.url).host)?SITE_ORIGIN:fallback;

// Crawler files of the public site; served only where the site is (a demo workspace).
const INDEXED=['/','/hubs','/mentors','/investors','/privacy','/contact'];
export const robotsTxt=()=>`User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
export const sitemapXml=()=>`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${INDEXED.map(p=>` <url><loc>${SITE_ORIGIN}${p}</loc></url>`).join('\n')}\n</urlset>\n`;
// RFC 9116. Expires stays a year ahead of the day it is read, so the file never goes stale.
export const securityTxt=(now=Date.now())=>`Contact: ${SITE_ORIGIN}/contact\nExpires: ${new Date(now+365*86400000).toISOString().slice(0,10)}T00:00:00.000Z\nPreferred-Languages: en, hr\nCanonical: ${SITE_ORIGIN}/.well-known/security.txt\n`;
