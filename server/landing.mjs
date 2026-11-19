/** Public landing page of the demo workspace. The product name lives here only; the page reads it from its meta tag. */
export const PRODUCT_NAME='Evidentio';
// Everything the landing page loads besides the shell; the demo serves these next to the app.
export const LANDING_ASSETS=['landing.js','anime.js','bird-motion.js','landing.css','landing-world.js','landing-office.webp','landing-dashboard.webp','landing-tasks.webp','landing-points.webp','landing-social.png',
 // Painted plates: shared plumbing, the two art variants (?art=watercolour|oil) and their public-domain pictures.
 'landing-paint.js','paint-watercolour.js','paint-oil.js',
 ...['wc-hero','oil-hero'].flatMap(f=>[800,1200,1600].map(w=>`${f}-${w}`)),
 // One picture per section below the hero, at the widths landing-paint.js asks for (PICS there).
 ...['wc','oil'].flatMap(v=>[['pains',[800,960,1200]],['how',[800,1200,1600]],['map',[800,1200]],['faq',[480,720,960]],['act',[800,1200,1600]]]
  .flatMap(([k,ws])=>ws.map(w=>`${v}-${k}-${w}`)))
].flatMap(n=>n.includes('.')?[n]:[`art/${n}.avif`,`art/${n}.webp`]);
export const renderLanding=(html,origin)=>html.replaceAll('{{product}}',PRODUCT_NAME).replaceAll('{{origin}}',origin);
