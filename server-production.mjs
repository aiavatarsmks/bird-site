import {loadConfig,freeBytes} from './server/config.mjs';
import {createPlatform} from './server/tenancy.mjs';
import {dailyBackup} from './server/insights.mjs';
import {runReminders} from './server/reminders.mjs';
import {offsiteStore,copyOffsite} from './server/offsite.mjs';
const config=loadConfig(Bun.env);
const platform=createPlatform(config);
const free=freeBytes(config.dataDir);
if(free<config.limits.minFreeBytes)console.warn('Low free space on the data volume');
const maxBody=Math.max(config.limits.documentBytes,config.limits.imageBytes)+1024*1024;
Bun.serve({port:Number(Bun.env.PORT||8080),maxRequestBodySize:maxBody,fetch:platform.fetch});
console.log('BIRD serving release',JSON.parse(await Bun.file(new URL('./public/release.json',import.meta.url)).text()).release,'mode:',config.platformMode,'workspaces:',platform.workspaces().length,'schema migrations applied:',platform.migrationsApplied());
// One copy per Zagreb day on the data volume for every workspace; the owner can also download a copy from Admin.
const offsite=offsiteStore(config);
console.log('Backups outside the volume:',offsite?'on':'off');
const backup=()=>{
 platform.forEach((app,ws)=>{const say=m=>console.log(`[${ws.slug}] ${m}`);copyOffsite(offsite,ws.slug,dailyBackup(app.db,app.config.backupDir,say),say);});
 copyOffsite(offsite,'platform',platform.dailyBackup(),m=>console.log('[platform] '+m));
};
backup();
setInterval(backup,60*60*1000);
// Deadline, lecture and mentor reminders inside the account; each one reaches a person once.
const remind=()=>platform.forEach((app,ws)=>{const n=runReminders(app.db);if(n)console.log(`[${ws.slug}] Reminders created:`,n);});
remind();
setInterval(remind,15*60*1000);
