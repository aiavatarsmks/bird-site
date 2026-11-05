import {loadConfig,freeBytes} from './server/config.mjs';
import {createApp} from './server/app.mjs';
const config=loadConfig(Bun.env);
const app=createApp(config);
const free=freeBytes(config.dataDir);
if(free<config.limits.minFreeBytes)console.warn('Low free space on the data volume');
const maxBody=Math.max(config.limits.documentBytes,config.limits.imageBytes)+1024*1024;
Bun.serve({port:Number(Bun.env.PORT||8080),maxRequestBodySize:maxBody,fetch:app.fetch});
console.log('BIRD serving release',JSON.parse(await Bun.file(new URL('./public/release.json',import.meta.url)).text()).release,'schema migrations applied:',app.migration.applied.length);
