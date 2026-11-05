/** HTTP application: routing, session, origin/CSRF checks and static files. */
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {fail,json,errorResponse,checkOrigin,clientIp} from './http.mjs';
import {openDatabase,migrate,schemaStatus,nowIso} from './db.mjs';
import {prepareDirectories,freeBytes} from './config.mjs';
import {createDirectoryHandler} from '../directory-api.mjs';
import * as auth from './auth.mjs';
import * as people from './people.mjs';
import * as projects from './projects.mjs';
import * as files from './files.mjs';
import * as lectures from './lectures.mjs';
import * as tasks from './tasks.mjs';
import * as progress from './progress.mjs';
import * as notifications from './notifications.mjs';
import * as admin from './admin.mjs';
import * as imports from './imports.mjs';
import * as cohort from './cohort.mjs';
import * as mentors from './mentors.mjs';
import * as insights from './insights.mjs';
import * as avatars from './avatars.mjs';
import {seedCurated} from './seed.mjs';
import {createIntegration,CONTRACT} from './integration.mjs';
import {localStorage,noScanner} from './storage.mjs';
import {publicUser} from './auth.mjs';
import {isAdmin} from './permissions.mjs';

const MUTATING=new Set(['POST','PUT','PATCH','DELETE']);

export function createApp(config,{publicDir=new URL('../public/',import.meta.url).pathname.replace(/\/$/,''),data,log=console.log}={}){
 prepareDirectories(config);
 const db=openDatabase(config.dbPath);
 const migration=migrate(db,{backupDir:config.backupDir,log});
 data??=JSON.parse(readFileSync(new URL('../data/projects-public.json',import.meta.url),'utf8'));
 seedCurated(db,data);
 // New published tasks reach existing participants too (idempotent).
 for(const u of db.query("SELECT * FROM users WHERE status='active'").all())tasks.assignForUser(db,u);
 const bootstrap=auth.ensureOwnerBootstrap(db,config);
 if(bootstrap.status!=='completed')log('Owner bootstrap invitation is waiting in the private data directory');
 const directory=createDirectoryHandler(db);
 const storage=config.storage||localStorage(config.uploadDir);
 const scanner=config.scanner||noScanner;
 let releaseInfo={release:'dev',assets:[]};
 try{releaseInfo=JSON.parse(readFileSync(publicDir+'/release.json','utf8'));}catch{}
 const integration=createIntegration({config,db,data,publicDir,release:releaseInfo.release});
 const staticFiles=new Map([['/','index.html'],['/index.html','index.html'],['/city-harness.html','city-harness.html'],...releaseInfo.assets.map(n=>['/assets/'+n,'assets/'+n])]);

 // Side effects of domain events: task assignment, rewards and badges.
 const hooks={
  onUserReady(ctx,user){tasks.assignForUser(db,user);},
  onEvent(ctx,e){
   if(e.type==='project.created'){progress.badgeForRule(db,e.userId,'project.created');tasks.assignForUser(db,ctx.user);}
   if(e.type==='project.update')tasks.onProjectUpdate(db,e);
   if(e.type==='milestone.done'){for(const m of db.query("SELECT user_id FROM memberships WHERE project_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')").all(e.projectId))progress.badgeForRule(db,m.user_id,'milestone.done');}
   if(e.type==='attendance'){
    const n=db.query('SELECT count(DISTINCT lecture_id) n FROM attendance WHERE user_id=?').get(e.userId).n;
    if(n>=3)progress.badgeForRule(db,e.userId,'attendance.3');
    // Points for attendance only after an organiser verified it.
    const a=db.query('SELECT kind FROM attendance WHERE user_id=? AND lecture_id=?').get(e.userId,e.lectureId);
    if(a?.kind==='verified_by_admin')progress.award(db,{type:'user',id:e.userId,amount:10,sourceKey:'attendance:'+e.lectureId,reason:'attendance:verified'});
   }
  },
 };

 const routes=[];
 const on=(method,pattern,handler,{auth:needs=false}={})=>routes.push({method,re:new RegExp('^'+pattern.replace(/:(\w+)/g,'(?<$1>[A-Za-z0-9._-]{1,100})')+'$'),handler,needs});
 const user=true;
 // Auth
 on('POST','/api/auth/register',ctx=>auth.register(ctx));
 on('POST','/api/auth/login',ctx=>auth.login(ctx));
 on('POST','/api/auth/logout',ctx=>auth.logout(ctx),{auth:user});
 on('POST','/api/auth/logout-all',ctx=>auth.logout(ctx,true),{auth:user});
 on('GET','/api/auth/me',ctx=>ctx.user?json({user:{...publicUser(ctx.user),hasAvatar:avatars.hasAvatar(db,ctx.user.id)},csrf:ctx.session.csrf,unread:db.query('SELECT count(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').get(ctx.user.id).n}):json({user:null}));
 on('GET','/api/auth/sessions',ctx=>auth.listSessions(ctx),{auth:user});
 on('DELETE','/api/auth/sessions/:id',(ctx,p)=>auth.revokeSession(ctx,p.id),{auth:user});
 on('POST','/api/auth/recover',ctx=>auth.recover(ctx));
 on('POST','/api/auth/password',ctx=>auth.changePassword(ctx),{auth:user});
 on('POST','/api/auth/recovery-codes',ctx=>auth.regenerateCodes(ctx),{auth:user});
 on('PUT','/api/me/profile',ctx=>people.updateProfile(ctx),{auth:user});
 on('GET','/api/me/character',ctx=>people.myCharacter(ctx),{auth:user});
 on('PUT','/api/me/character',ctx=>people.updateCharacter(ctx),{auth:user});
 // People, claims, invitations
 on('GET','/api/people',ctx=>people.listPeople(ctx));
 on('POST','/api/people/claims',ctx=>people.createClaim(ctx),{auth:user});
 on('GET','/api/people/claims',ctx=>people.myClaims(ctx),{auth:user});
 on('POST','/api/invites',ctx=>people.createInvite(ctx),{auth:user});
 on('GET','/api/invites',ctx=>people.listInvites(ctx),{auth:user});
 on('DELETE','/api/invites/:id',(ctx,p)=>people.revokeInvite(ctx,p.id),{auth:user});
 on('POST','/api/invites/accept',ctx=>people.acceptInvite(ctx),{auth:user});
 // Projects
 on('GET','/api/projects',ctx=>projects.listProjects(ctx));
 on('POST','/api/projects',ctx=>projects.createProject(ctx),{auth:user});
 on('GET','/api/projects/:id',(ctx,p)=>projects.getProject(ctx,p.id));
 on('PUT','/api/projects/:id/draft',(ctx,p)=>projects.saveDraft(ctx,p.id),{auth:user});
 on('POST','/api/projects/:id/publish',(ctx,p)=>projects.publishProject(ctx,p.id),{auth:user});
 on('GET','/api/projects/:id/revisions',(ctx,p)=>projects.revisions(ctx,p.id),{auth:user});
 on('POST','/api/projects/:id/revisions/:rev/restore',(ctx,p)=>projects.restoreRevision(ctx,p.id,p.rev),{auth:user});
 on('POST','/api/projects/:id/archive',(ctx,p)=>projects.setArchived(ctx,p.id,true),{auth:user});
 on('POST','/api/projects/:id/unarchive',(ctx,p)=>projects.setArchived(ctx,p.id,false),{auth:user});
 on('PUT','/api/projects/:id/members/:userId',(ctx,p)=>projects.changeMember(ctx,p.id,p.userId),{auth:user});
 on('GET','/api/projects/:id/updates',(ctx,p)=>projects.listUpdates(ctx,p.id));
 on('POST','/api/projects/:id/updates',(ctx,p)=>projects.addUpdate(ctx,p.id),{auth:user});
 on('GET','/api/projects/:id/files',(ctx,p)=>files.listProjectFiles(ctx,p.id));
 on('GET','/api/projects/:id/journal',(ctx,p)=>projects.projectJournal(ctx,p.id));
 on('POST','/api/projects/:id/milestones',(ctx,p)=>projects.addMilestone(ctx,p.id),{auth:user});
 on('POST','/api/projects/:id/milestones/:mid/done',(ctx,p)=>projects.completeMilestone(ctx,p.id,p.mid),{auth:user});
 on('POST','/api/projects/:id/metrics',(ctx,p)=>projects.addMetric(ctx,p.id),{auth:user});
 on('POST','/api/projects/:id/help',(ctx,p)=>projects.addHelp(ctx,p.id),{auth:user});
 on('GET','/api/help',ctx=>projects.listHelp(ctx));
 on('DELETE','/api/help/:id',(ctx,p)=>projects.closeHelp(ctx,p.id),{auth:user});
 on('GET','/api/help/confirmations',ctx=>tasks.helpRequests(ctx),{auth:user});
 on('POST','/api/help/confirmations/:id',(ctx,p)=>tasks.decideHelp(ctx,p.id),{auth:user});
 // Files
 on('POST','/api/files',ctx=>files.upload(ctx),{auth:user});
 on('GET','/api/files/:id',(ctx,p)=>files.download(ctx,p.id));
 on('PATCH','/api/files/:id',(ctx,p)=>files.updateFile(ctx,p.id),{auth:user});
 on('DELETE','/api/files/:id',(ctx,p)=>files.deleteFile(ctx,p.id),{auth:user});
 // Lectures and attendance
 on('GET','/api/lectures',ctx=>lectures.listLectures(ctx));
 on('POST','/api/lectures/:id/attendance',(ctx,p)=>lectures.postAttendance(ctx,p.id),{auth:user});
 // Tasks
 on('GET','/api/tasks',ctx=>tasks.myTasks(ctx),{auth:user});
 on('GET','/api/tasks/:id',(ctx,p)=>tasks.getAssignment(ctx,p.id),{auth:user});
 on('PUT','/api/tasks/:id/draft',(ctx,p)=>tasks.saveAnswerDraft(ctx,p.id),{auth:user});
 on('POST','/api/tasks/:id/submit',(ctx,p)=>tasks.submitAnswer(ctx,p.id),{auth:user});
 on('GET','/api/reviews',ctx=>tasks.reviewQueue(ctx),{auth:user});
 on('POST','/api/reviews/:id',(ctx,p)=>tasks.review(ctx,p.id),{auth:user});
 // Progress
 on('GET','/api/progress',ctx=>progress.myProgress(ctx),{auth:user});
 on('GET','/api/progress/leaderboard',ctx=>progress.leaderboard(ctx));
 on('GET','/api/badges',()=>json({items:progress.BADGES.map(b=>({id:b.id,title:b.t}))}));
 on('GET','/api/notifications',ctx=>notifications.listNotifications(ctx),{auth:user});
 on('POST','/api/notifications/read',ctx=>notifications.markRead(ctx),{auth:user});
 // Admin
 on('GET','/api/admin/overview',ctx=>admin.projectsOverview(ctx),{auth:user});
 on('GET','/api/admin/users',ctx=>admin.listUsers(ctx),{auth:user});
 on('PUT','/api/admin/users/:id/role',(ctx,p)=>admin.setRole(ctx,p.id),{auth:user});
 on('PUT','/api/admin/users/:id/status',(ctx,p)=>admin.setUserStatus(ctx,p.id),{auth:user});
 on('GET','/api/admin/claims',ctx=>people.adminClaims(ctx),{auth:user});
 on('POST','/api/admin/claims/:id',(ctx,p)=>people.decideClaim(ctx,p.id),{auth:user});
 on('GET','/api/admin/tasks',ctx=>tasks.adminTasks(ctx),{auth:user});
 on('POST','/api/admin/tasks',ctx=>tasks.createTask(ctx),{auth:user});
 on('PUT','/api/admin/tasks/:id',(ctx,p)=>tasks.updateTask(ctx,p.id),{auth:user});
 on('POST','/api/admin/tasks/:id/status',(ctx,p)=>tasks.setTaskStatus(ctx,p.id),{auth:user});
 on('GET','/api/admin/tasks/:id/preview',(ctx,p)=>tasks.previewAssign(ctx,p.id),{auth:user});
 on('POST','/api/admin/tasks/:id/assign',(ctx,p)=>tasks.assignTask(ctx,p.id),{auth:user});
 on('POST','/api/admin/submissions/:id/revoke',(ctx,p)=>tasks.revokeAcceptance(ctx,p.id),{auth:user});
 on('GET','/api/admin/lectures',ctx=>lectures.adminLectures(ctx),{auth:user});
 on('POST','/api/admin/lectures',ctx=>lectures.saveLecture(ctx,null),{auth:user});
 on('PUT','/api/admin/lectures/:id',(ctx,p)=>lectures.saveLecture(ctx,p.id),{auth:user});
 on('GET','/api/admin/attendance',ctx=>lectures.adminAttendance(ctx),{auth:user});
 on('POST','/api/admin/attendance',ctx=>lectures.verifyAttendance(ctx),{auth:user});
 // Catalogue, marking, imports, cohort tools
 on('GET','/api/catalog',ctx=>tasks.catalog(ctx),{auth:user});
 on('POST','/api/catalog/:id/take',(ctx,p)=>tasks.takeTask(ctx,p.id),{auth:user});
 on('POST','/api/admin/tasks/:id/mark',(ctx,p)=>tasks.adminMark(ctx,p.id),{auth:user});
 on('POST','/api/admin/attendance/bulk',ctx=>lectures.bulkVerify(ctx),{auth:user});
 on('POST','/api/admin/import/preview',ctx=>imports.importPreview(ctx),{auth:user});
 on('POST','/api/admin/import/apply',ctx=>imports.importApply(ctx),{auth:user});
 on('GET','/api/admin/form-hooks',ctx=>imports.listHooks(ctx),{auth:user});
 on('POST','/api/admin/form-hooks',ctx=>imports.createHook(ctx),{auth:user});
 on('DELETE','/api/admin/form-hooks/:id',(ctx,p)=>imports.revokeHook(ctx,p.id),{auth:user});
 on('GET','/api/projects/:id/checkins',(ctx,p)=>cohort.listCheckins(ctx,p.id),{auth:user});
 on('POST','/api/projects/:id/checkins',(ctx,p)=>cohort.saveCheckin(ctx,p.id),{auth:user});
 on('GET','/api/projects/:id/outcomes',(ctx,p)=>cohort.listOutcomes(ctx,p.id),{auth:user});
 on('POST','/api/projects/:id/outcomes',(ctx,p)=>cohort.addOutcome(ctx,p.id),{auth:user});
 on('DELETE','/api/projects/:id/outcomes/:oid',(ctx,p)=>cohort.deleteOutcome(ctx,p.id,p.oid),{auth:user});
 on('GET','/api/admin/checkins',ctx=>cohort.adminCheckins(ctx),{auth:user});
 on('GET','/api/admin/export.csv',ctx=>cohort.exportCsv(ctx),{auth:user});
 on('GET','/api/announcements',ctx=>cohort.listAnnouncements(ctx),{auth:user});
 on('POST','/api/announcements/read',ctx=>cohort.readAnnouncements(ctx),{auth:user});
 on('GET','/api/admin/chat-hook',ctx=>cohort.chatHookStatus(ctx),{auth:user});
 on('PUT','/api/admin/chat-hook',ctx=>cohort.setChatHook(ctx),{auth:user});
 on('POST','/api/admin/announcements',ctx=>cohort.createAnnouncement(ctx),{auth:user});
 on('DELETE','/api/admin/announcements/:id',(ctx,p)=>cohort.archiveAnnouncement(ctx,p.id),{auth:user});
 on('GET','/api/office-hours',ctx=>mentors.listSlots(ctx),{auth:user});
 on('POST','/api/admin/office-hours',ctx=>mentors.createSlot(ctx),{auth:user});
 on('DELETE','/api/admin/office-hours/:id',(ctx,p)=>mentors.cancelSlot(ctx,p.id),{auth:user});
 on('GET','/api/mentors',ctx=>mentors.listMentors(ctx));
 on('POST','/api/admin/mentors',ctx=>mentors.saveMentor(ctx),{auth:user});
 on('PUT','/api/admin/mentors/:id',(ctx,p)=>mentors.saveMentor(ctx,p.id),{auth:user});
 on('DELETE','/api/admin/mentors/:id',(ctx,p)=>mentors.archiveMentor(ctx,p.id),{auth:user});
 on('PUT','/api/me/avatar',ctx=>avatars.putAvatar(ctx),{auth:user});
 on('DELETE','/api/me/avatar',ctx=>avatars.deleteAvatar(ctx),{auth:user});
 on('GET','/api/avatars/:id',(ctx,p)=>avatars.getAvatar(ctx,p.id),{auth:user});
 on('POST','/api/office-hours/:id/book',(ctx,p)=>mentors.book(ctx,p.id),{auth:user});
 on('DELETE','/api/office-hours/:id/book',(ctx,p)=>mentors.unbook(ctx,p.id),{auth:user});
 on('POST','/api/office-hours/:id/note',(ctx,p)=>mentors.addNote(ctx,p.id),{auth:user});
 on('GET','/api/quests',ctx=>cohort.listQuests(ctx));
 on('POST','/api/admin/quests',ctx=>cohort.createQuest(ctx),{auth:user});
 on('DELETE','/api/admin/quests/:id',(ctx,p)=>cohort.closeQuest(ctx,p.id),{auth:user});
 on('GET','/api/teams/ranking',ctx=>cohort.teamRanking(ctx));
 on('GET','/api/calendar.ics',ctx=>cohort.calendar(ctx));
 on('GET','/api/feedback/due',ctx=>insights.feedbackDue(ctx),{auth:user});
 on('POST','/api/lectures/:id/feedback',(ctx,p)=>insights.saveFeedback(ctx,p.id),{auth:user});
 on('GET','/api/admin/feedback',ctx=>insights.adminFeedback(ctx),{auth:user});
 on('GET','/api/admin/digest',ctx=>insights.digest(ctx),{auth:user});
 on('POST','/api/admin/digest/send',ctx=>insights.sendDigest(ctx),{auth:user});
 on('GET','/api/admin/backup.sqlite',ctx=>insights.downloadBackup(ctx),{auth:user});
 on('GET','/api/admin/audit',ctx=>admin.auditLog(ctx),{auth:user});
 on('GET','/api/admin/settings',ctx=>admin.settings(ctx),{auth:user});

 async function handleApi(request,server){
  const url=new URL(request.url);
  const ctx={db,config,request,url,storage,scanner,hooks,ip:clientIp(request,server,config)};
  try{
   if(url.pathname.startsWith('/api/integration/v1/')){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':config.cityOrigins.includes(request.headers.get('origin'))?request.headers.get('origin'):'null','Access-Control-Allow-Methods':'GET','Vary':'Origin'}});
    if(request.method!=='GET')fail(405,'BAD_REQUEST');
    return integration.handle(ctx,url.pathname.slice('/api/integration/v1/'.length));
   }
   if(url.pathname.startsWith('/api/profiles'))return directory(request,ctx.ip);
   // Google Apps Script calls this server-to-server with its own secret; no browser cookie or Origin.
   if(url.pathname==='/api/forms/hook'&&request.method==='POST')return await imports.hook(ctx);
   if(MUTATING.has(request.method))checkOrigin(request,config);
   auth.loadSession(ctx);
   const route=routes.find(r=>r.method===request.method&&r.re.test(url.pathname));
   if(!route){if(routes.some(r=>r.re.test(url.pathname)))fail(405,'BAD_REQUEST');fail(404,'NOT_FOUND');}
   if(route.needs&&!ctx.user)fail(401,'UNAUTHENTICATED');
   if(MUTATING.has(request.method))auth.checkCsrf(ctx);
   const response=await route.handler(ctx,url.pathname.match(route.re).groups||{});
   return finish(ctx,response);
  }catch(error){return finish(ctx,errorResponse(error));}
 }
 function finish(ctx,response){
  if(ctx.setCookie)response.headers.append('Set-Cookie',ctx.setCookie);
  else if(ctx.clearCookie)response.headers.append('Set-Cookie',`${auth.SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${config.secureCookies?'; Secure':''}; Max-Age=0`);
  return response;
 }

 async function fetch(request,server){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/'))return handleApi(request,server);
  if(url.pathname==='/health'){const s=schemaStatus(db);return Response.json({status:s.ready?'ok':'migrating',release:releaseInfo.release,schema:s.schema,schemaReady:s.ready,contract:CONTRACT},{status:s.ready?200:503,headers:{'Cache-Control':'no-store'}});}
  const file=staticFiles.get(url.pathname);if(!file)return new Response('Not found',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  let body;try{body=await readFile(publicDir+'/'+file);}catch{return new Response('Not found',{status:404});}
  const type=file.endsWith('.webp')?'image/webp':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
  const headers={'Content-Type':type+(type.startsWith('image/')?'':'; charset=utf-8'),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-BIRD-Release':releaseInfo.release,'Referrer-Policy':'same-origin'};
  // The office may be framed only by the allowed city origin (light visit); other pages not at all.
  if(type==='text/html')headers['Content-Security-Policy']=`frame-ancestors 'self' ${config.cityOrigins.join(' ')}`;
  return new Response(request.method==='HEAD'?null:body,{headers});
 }
 return {fetch,db,config,migration,close:()=>db.close(),storage,integration};
}
export {isAdmin,nowIso,freeBytes};
