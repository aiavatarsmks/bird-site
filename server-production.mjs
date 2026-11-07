import {loadConfig,freeBytes} from './server/config.mjs';
import {createApp} from './server/app.mjs';
import {dailyBackup} from './server/insights.mjs';
import {runReminders} from './server/reminders.mjs';
const config=loadConfig(Bun.env);
const app=createApp(config);
const free=freeBytes(config.dataDir);
if(free<config.limits.minFreeBytes)console.warn('Low free space on the data volume');
const maxBody=Math.max(config.limits.documentBytes,config.limits.imageBytes)+1024*1024;
Bun.serve({port:Number(Bun.env.PORT||8080),maxRequestBodySize:maxBody,fetch:app.fetch});
console.log('BIRD serving release',JSON.parse(await Bun.file(new URL('./public/release.json',import.meta.url)).text()).release,'schema migrations applied:',app.migration.applied.length);
// One copy per Zagreb day on the data volume; the owner can also download a copy from Admin.
dailyBackup(app.db,config.backupDir,console.log);
setInterval(()=>dailyBackup(app.db,config.backupDir,console.log),60*60*1000);
// Deadline, lecture and mentor reminders inside the account; each one reaches a person once.
const remind=()=>{try{const n=runReminders(app.db);if(n)console.log('Reminders created:',n);}catch(e){console.error('Reminders failed',e);}};
remind();
setInterval(remind,15*60*1000);
