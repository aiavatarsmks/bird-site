/** Public landing page of the demo workspace. The product name lives here only; the page reads it from its meta tag. */
export const PRODUCT_NAME='Evidentio';
// Everything the landing page loads besides the shell; the demo serves these next to the app.
export const LANDING_ASSETS=['landing.js','landing.css','landing-world.js','landing-office.webp','landing-dashboard.webp','landing-tasks.webp','landing-points.webp','landing-social.png'];
export const renderLanding=(html,origin)=>html.replaceAll('{{product}}',PRODUCT_NAME).replaceAll('{{origin}}',origin);
