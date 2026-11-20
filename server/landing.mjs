/** Public landing page of the demo workspace. The product name lives here only; the page reads it from its meta tag. */
export const PRODUCT_NAME='Hubvers';
// Everything the landing page loads besides the shell; the demo serves these next to the app.
// The hero video (our demo office, recorded from /demo) is served with long caching: a new recording gets a new file name.
export const LANDING_ASSETS=['landing.js','landing.css','landing-world.js','landing-dashboard.webp','landing-tasks.webp','landing-points.webp','landing-social.png',
 'landing-hero-office.webp','landing-hero-office.webm','landing-hero-office.mp4'];
export const renderLanding=(html,origin)=>html.replaceAll('{{product}}',PRODUCT_NAME).replaceAll('{{origin}}',origin);
