'use strict';
/* One drawn icon set instead of phone emoji: 24px grid, square ends, a soft tint under the line.
   BirdIcon(name, extraClass) -> inline SVG markup, sized 1.15em so it follows the surrounding font size. */
(()=>{
const t=d=>`<path class="t" d="${d}"/>`;          // tinted fill, no line
const s=d=>`<path d="${d}"/>`;                    // line
const ts=d=>t(d)+s(d);                            // both
const c=(x,y,r,cls='')=>`<circle${cls?` class="${cls}"`:''} cx="${x}" cy="${y}" r="${r}"/>`;
const medal=n=>s('M8 2l3.2 7M16 2l-3.2 7')+c(12,15,6,'t')+c(12,15,6)+`<text class="k" x="12" y="18.2" text-anchor="middle">${n}</text>`;
const ICONS={
 write:ts('M4 20l1-4.5L15.5 5 19 8.5 8.5 19z')+s('M13 7.5l3.5 3.5M12 20h8'),
 flag:t('M5 4h14l-3.5 4.5L19 13H5z')+s('M5 21V3M5 4h14l-3.5 4.5L19 13H5')+s('M9 4v9M13 4v9'),
 checklist:ts('M3 4h6v6H3z')+s('M4.5 7l1.5 1.5L8.5 5.5M3 14h6v6H3zM12 7h9M12 17h9'),
 counter:t('M9 9h7v6H9z')+s('M10 3L8 21M16 3l-2 18M4 9h17M3 15h17'),
 link:s('M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1.2 1.2M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1.2-1.2'),
 clip:s('M20 11.5l-8 8a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15 7'),
 cap:ts('M2 9l10-5 10 5-10 5z')+s('M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6'),
 rocket:ts('M12 2c3 2.6 4.5 6 4.5 10v5h-9v-5C7.5 8 9 4.6 12 2z')+c(12,10,1.8)+s('M7.5 13L5 16v3.5l2.5-2M16.5 13L19 16v3.5l-2.5-2M10.5 20l1.5 2.5 1.5-2.5'),
 mic:ts('M9 2h6v11H9z')+s('M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8'),
 note:ts('M5 3h10l4 4v14H5z')+s('M14 3v5h5M8.5 12h7M8.5 16h5'),
 help:c(12,12,9,'t')+c(12,12,9)+c(12,12,4)+s('M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6'),
 trophy:ts('M7 3h10v6a5 5 0 0 1-10 0z')+s('M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 14v4M9 18h6v3H9z'),
 star:ts('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'),
 team:c(9,8,3.2,'t')+c(9,8,3.2)+ts('M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1z')+c(17,7.5,2.5)+s('M17.5 13a4 4 0 0 1 4 4v2'),
 person:c(12,8,4,'t')+c(12,8,4)+ts('M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1z'),
 gold:medal(1),silver:medal(2),bronze:medal(3),
 medal:s('M8 2l3.2 7M16 2l-3.2 7')+c(12,15,6,'t')+c(12,15,6)+`<path class="k" d="M12 11.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"/>`,
 flame:ts('M12 22c4 0 7-2.7 7-6.6 0-3.4-2.2-5.6-3.8-7.4-.3 2-1.2 3.2-2.4 3.7C13 8 11.5 4.5 9 2c.2 3.5-1.6 5.6-3.3 7.6C4.6 11 4 12.8 4 15.4 4 19.3 7.6 22 12 22z')+`<path class="k" d="M12 22c-1.7 0-3-1.2-3-2.9 0-1.6 1.3-2.8 3-4.6 1.7 1.8 3 3 3 4.6 0 1.7-1.3 2.9-3 2.9z"/>`,
 bolt:ts('M13 2L4 14h7l-1 8 9-12h-7z'),
 target:c(12,12,9)+c(12,12,5.5,'t')+c(12,12,5.5)+c(12,12,1.8,'k')+s('M12 12l8-8M17 3.5h3.5V7'),
 megaphone:ts('M3 9.5v5h3l9 5V4.5L6 9.5z')+s('M6 14.5L7.5 21h3L9 15.5M18.5 9a4 4 0 0 1 0 6'),
 chat:ts('M3 4h18v12H10l-5 4v-4H3z')+s('M7.5 8.5h9M7.5 12h5'),
 bell:ts('M6 17v-6a6 6 0 0 1 12 0v6l2 2H4z')+s('M10 21.5h4M12 3v2'),
 check:ts('M3 3h18v18H3z')+s('M7 12.5l3.5 3.5L17 8.5'),
 ticket:ts('M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z')+s('M14 6v2.5M14 10.8v2.4M14 15.5V18'),
 coin:`<ellipse class="t" cx="12" cy="7" rx="8" ry="3.5"/><ellipse cx="12" cy="7" rx="8" ry="3.5"/>`+s('M4 7v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V7M4 12v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-5'),
 calendar:t('M3 5h18v5H3z')+s('M3 5h18v16H3zM3 10h18M8 2.5v4M16 2.5v4')+`<path class="k" d="M7 13.5h3.5V17H7z"/>`,
 gift:ts('M4 11h16v10H4z')+s('M3 7h18v4H3zM12 7v14M12 7c-1-3-5-4.2-5-1.6S10 7 12 7c1-3 5-4.2 5-1.6S14 7 12 7'),
 globe:c(12,12,9,'t')+c(12,12,9)+s('M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z'),
 lock:ts('M5 11h14v10H5z')+s('M8 11V7a4 4 0 0 1 8 0v4M12 15v2.5'),
 hand:t('M7 13V9.5a1.5 1.5 0 0 1 3 0V5a1.5 1.5 0 0 1 3 0v-.5a1.5 1.5 0 0 1 3 0V6a1.5 1.5 0 0 1 3 0v9a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 15a1.6 1.6 0 0 1 2.6-1.8z')+s('M10 11V5a1.5 1.5 0 0 1 3 0v6M13 10.5v-6a1.5 1.5 0 0 1 3 0v6.5M16 11V6a1.5 1.5 0 0 1 3 0v9a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 15a1.6 1.6 0 0 1 2.6-1.8L7 14.5V9.5a1.5 1.5 0 0 1 3 0V12'),
 camera:ts('M3 7h4l2-3h6l2 3h4v13H3z')+c(12,13.5,4),
 mail:ts('M3 5h18v14H3z')+s('M3 6l9 7 9-7'),
 laptop:ts('M5 4h14v11H5z')+s('M2 20h20l-2.5-5h-15z'),
 key:c(8,15,4.5,'t')+c(8,15,4.5)+s('M11.2 11.8L20 3M16 7l3 3M18 5l2 2'),
 timer:c(12,13.5,7.5,'t')+c(12,13.5,7.5)+s('M12 13.5V9.5M10 2h4M12 2v4M18.5 6.5L20 5'),
 pin:ts('M9 3h6l-1 6 3 4H7l3-4z')+s('M12 13v8'),
 eye:ts('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z')+c(12,12,3),
 office:ts('M4 21V4h10v17z')+s('M14 9h6v12M2 21h20M7 8h1M10 8h1M7 12h1M10 12h1M7 16h1M10 16h1M17 13h.5M17 17h.5'),
 palette:ts('M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1-2 0-3s2.5-.5 4-.5A3 3 0 0 0 21 12.5 9 9 0 0 0 12 3z')+c(7.5,11,1.2,'k')+c(10.5,7,1.2,'k')+c(15,7.5,1.2,'k'),
 dice:ts('M4 4h16v16H4z')+c(8.5,8.5,1.4,'k')+c(15.5,8.5,1.4,'k')+c(12,12,1.4,'k')+c(8.5,15.5,1.4,'k')+c(15.5,15.5,1.4,'k'),
};
const CSS=`.ic{display:inline-block;width:1.15em;height:1.15em;vertical-align:-.22em;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:square;stroke-linejoin:miter;overflow:visible}
.ic .t{fill:var(--ic-tint,currentColor);fill-opacity:var(--ic-tint-o,.16);stroke:none}.ic .k{fill:currentColor;stroke:none}
.ic text{font:700 7px/1 ui-sans-serif,system-ui,sans-serif;stroke:none}
.ic-gold{color:#b8860b;--ic-tint-o:.35}.ic-silver{color:#7b8794;--ic-tint-o:.3}.ic-bronze{color:#a0522d;--ic-tint-o:.3}
.ic-flame{color:#d9531e;--ic-tint-o:.25}.ic-star,.ic-medal,.ic-trophy{color:#b8860b;--ic-tint-o:.28}`;
function inject(){if(document.getElementById('bird-icons-css'))return;const st=document.createElement('style');st.id='bird-icons-css';st.textContent=CSS;document.head.append(st);}
if(document.head)inject();else document.addEventListener('DOMContentLoaded',inject);
window.BirdIcon=(name,cls='')=>ICONS[name]?`<svg class="ic ic-${name}${cls?' '+cls:''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`:'';
window.BirdIcon.names=Object.keys(ICONS);
})();
