/** HTTP application: routing, session, origin/CSRF checks and static files. */
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {fail,json,errorResponse,checkOrigin,clientIp,selfOrigin} from './http.mjs';
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
import * as profile from './profile.mjs';
import * as organiser from './organiser.mjs';
import * as reminders from './reminders.mjs';
import * as messages from './messages.mjs';
import * as wallet from './wallet.mjs';
import * as report from './report.mjs';
import * as demoVisit from './demo-visit.mjs';
import * as demoJoin from './demo-join.mjs';
import * as leads from './leads.mjs';
import * as network from './network.mjs';
import * as investors from './investors.mjs';
import {LANDING_ASSETS,renderLanding,PRODUCT_NAME} from './landing.mjs';
import {SITE_ASSETS,SITE_PAGES,NETWORK_PAGES,PROFILE_PAGE,PROFILE_PATH,INVESTOR_PAGES,INVESTOR_PROJECT_PAGE,INVESTOR_PROJECT_PATH,HUBS_FILE,renderSite,siteOrigin,robotsTxt,sitemapXml,securityTxt} from './site.mjs';
import {createDemoOffice} from './demo-office.mjs';
import {startDemo,ensureDemoFiles} from './demo.mjs';
import {seedCurated} from './seed.mjs';
import {createIntegration,CONTRACT} from './integration.mjs';
import {localStorage,noScanner} from './storage.mjs';
import {publicUser} from './auth.mjs';
import {isAdmin} from './permissions.mjs';

const MUTATING=new Set(['POST','PUT','PATCH','DELETE']);

export function createApp(config,{publicDir=new URL('../public/',import.meta.url).pathname.replace(/\/$/,''),data,log=console.log,peers}={}){
 prepareDirectories(config);
 const db=openDatabase(config.dbPath);
 const migration=migrate(db,{backupDir:config.backupDir,log});
 const seedProfile=config.seedProfile||'bird';
 data??=seedProfile==='bird'?JSON.parse(readFileSync(new URL('../data/projects-public.json',import.meta.url),'utf8')):{schemaVersion:1,revision:'',contentDate:'',projects:[],teams:[],people:[]};
 seedCurated(db,data,undefined,{profile:seedProfile,programId:config.workspace?.id,programName:config.workspace?.name});
 // New published tasks reach existing participants too (idempotent).
 for(const u of db.query("SELECT * FROM users WHERE status='active'").all())tasks.assignForUser(db,u);
 const bootstrap=auth.ensureOwnerBootstrap(db,config);
 if(bootstrap.status!=='completed')log('Owner bootstrap invitation is waiting in the private data directory');
 const directory=createDirectoryHandler(db);
 // Workspaces the investor dashboard may read (server/investors.mjs): the platform's list, or this workspace alone.
 const self=config.workspace?.id||'bird';
 const workspaces=()=>(peers?.()||[{id:self,name:config.workspace?.name||'',city:config.workspace?.city||'',country:config.workspace?.country||'',db}]).map(w=>({...w,self:w.id===self}));
 const storage=config.storage||localStorage(config.uploadDir);
 const scanner=config.scanner||noScanner;
 let releaseInfo={release:'dev',assets:[]};
 try{releaseInfo=JSON.parse(readFileSync(publicDir+'/release.json','utf8'));}catch{}
 const integration=createIntegration({config,db,data,publicDir,release:releaseInfo.release});
 // A workspace from the blank template has the account pages only: BIRD's lecture notes, teams, people and office stay with BIRD.
 const blank=seedProfile!=='bird',WORKSPACE_ASSETS=['style.css','account.css','account-i18n.js','whoami.js','whoami.css','messenger.js','messenger.css','letter.js','account.js','workspace.js','workspace.css','character-stage.js','character-stage.css','icons.js','admin-tasks.css','admin-programme.css','account-member.css','bird-motion.js','people-sheet.js','people-sheet.css','admin-report.js','admin-report.css','anime.js','demo-skin.css','character-kit.js','demo-join.js','demo-join.css'];
 const staticFiles=blank
  ?new Map([['/','workspace.html'],['/index.html','workspace.html'],...releaseInfo.assets.filter(n=>WORKSPACE_ASSETS.includes(n)).map(n=>['/assets/'+n,'assets/'+n])])
  :new Map([['/','index.html'],['/index.html','index.html'],['/city-harness.html','city-harness.html'],...releaseInfo.assets.map(n=>['/assets/'+n,'assets/'+n])]);
 const DEMO_ASSETS=new Set(['office-scene.js','office-iso-assets.js','office-art-data.js','office-pixelfx.js','office-life.js','office-model.js','office.js','office.css','incubator-map.js','incubators-hr.js',...LANDING_ASSETS,...SITE_ASSETS].filter(n=>releaseInfo.assets.includes(n)));
 // A demo workspace refreshes an older invented cohort and keeps real accounts out of its authorship.
 // On start and from the server's hourly timer (server-production.mjs); BIRD's own workspace never has a demo.
 let refusedLogged=false;
 function refreshDemo(){
  if(blank){const r=startDemo(db);if(r){if(r.refilled?.filled||r.repaired||(r.refilled&&!refusedLogged&&(refusedLogged=true)))log('Demo workspace: '+JSON.stringify(r));ensureDemoFiles(db,storage).catch(e=>log('Demo files: '+e.message));}return r;}
  return null;
 }
 refreshDemo();
 // The outline of Europe drawn on /hubs (inline in hubs.html), reused by the mentor map: read once from the built page.
 let europeCache=null;
 const europeMap=()=>europeCache??=(()=>{try{const h=readFileSync(publicDir+'/hubs.html','utf8');return (h.match(/<svg viewBox="0 0 800 640"[^>]*data-proj="[^"]+">/)?.[0]||'').replace(/ data-hubs-map/,' data-net-map').replace(/aria-labelledby="[^"]*"/,'aria-labelledby="net-map-cap"')+(h.match(/<!-- HUBS-EUROPE -->[\s\S]*?<!-- \/HUBS-EUROPE -->/)?.[0]||'')+'<g data-dots></g></svg>';}catch{return '';}})();
 let demoOfficeCache=null;const demoOffice=()=>demoOfficeCache??=createDemoOffice(publicDir);
 const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 // Side effects of domain events: task assignment, rewards and badges.
 const hooks={
  onUserReady(ctx,user){if(people.autoLinkByEmail(db,user))ctx.user=user=db.query('SELECT * FROM users WHERE id=?').get(user.id);tasks.assignForUser(db,user);},
  onProfileUpdated(ctx,user){if(people.autoLinkByEmail(db,user)){ctx.user=db.query('SELECT * FROM users WHERE id=?').get(user.id);tasks.assignForUser(db,ctx.user);}},
  onEvent(ctx,e){
   if(e.type==='project.created'){progress.badgeForRule(db,e.userId,'project.created');tasks.assignForUser(db,ctx.user);}
   if(e.type==='project.update')tasks.onProjectUpdate(db,e);
   if(e.type==='team.created')tasks.assignForProject(db,e.projectId);
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
 // Public demo: look around as the invented manager or a team.
 on('GET','/api/demo',ctx=>demoVisit.status(ctx));
 on('POST','/api/demo/enter',ctx=>demoVisit.enter(ctx));
 on('GET','/api/demo/roster',ctx=>demoVisit.roster(ctx));
 // Join as yourself: the visitor's own character and team, demo only (demo-join.mjs).
 const withPublic=fn=>ctx=>{ctx.publicDir=publicDir;return fn(ctx);};
 on('GET','/api/demo/teams',ctx=>demoJoin.listTeams(ctx));
 on('POST','/api/demo/join',withPublic(demoJoin.join));
 on('GET','/api/demo/me',ctx=>demoJoin.mine(ctx));
 on('PUT','/api/demo/me',withPublic(demoJoin.updateMine));
 on('POST','/api/auth/login',ctx=>auth.login(ctx));
 on('POST','/api/auth/logout',ctx=>auth.logout(ctx),{auth:user});
 on('POST','/api/auth/logout-all',ctx=>auth.logout(ctx,true),{auth:user});
 on('GET','/api/auth/me',ctx=>ctx.user?json({user:{...publicUser(ctx.user),hasAvatar:avatars.hasAvatar(db,ctx.user.id)},csrf:ctx.session.csrf,unread:db.query('SELECT count(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').get(ctx.user.id).n,messages:messages.unreadMessages(db,ctx.user.id)}):json({user:null}));
 on('GET','/api/auth/sessions',ctx=>auth.listSessions(ctx),{auth:user});
 on('DELETE','/api/auth/sessions/:id',(ctx,p)=>auth.revokeSession(ctx,p.id),{auth:user});
 on('POST','/api/auth/recover',ctx=>auth.recover(ctx));
 on('POST','/api/auth/password-reset/request',ctx=>auth.requestReset(ctx));
 on('POST','/api/auth/password-reset/confirm',ctx=>auth.confirmReset(ctx));
 on('POST','/api/auth/password',ctx=>auth.changePassword(ctx),{auth:user});
 on('POST','/api/auth/recovery-codes',ctx=>auth.regenerateCodes(ctx),{auth:user});
 on('PUT','/api/me/profile',ctx=>people.updateProfile(ctx),{auth:user});
 on('GET','/api/me/character',ctx=>people.myCharacter(ctx),{auth:user});
 on('PUT','/api/me/character',ctx=>people.updateCharacter(ctx),{auth:user});
 // People, claims, invitations
 on('GET','/api/people',ctx=>people.listPeople(ctx));
 on('POST','/api/people/claims',ctx=>people.createClaim(ctx),{auth:user});
 on('GET','/api/people/claims',ctx=>people.myClaims(ctx),{auth:user});
 on('GET','/api/people/:id/status',(ctx,p)=>people.personStatus(ctx,p.id),{auth:user});
 on('POST','/api/people/:id/link-self',(ctx,p)=>people.linkSelf(ctx,p.id),{auth:user});
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
 on('POST','/api/tasks/:id/respond',(ctx,p)=>tasks.respond(ctx,p.id),{auth:user});
 on('POST','/api/admin/assignments/:id/reopen',(ctx,p)=>tasks.reopen(ctx,p.id),{auth:user});
 on('GET','/api/admin/tasks/matrix',ctx=>tasks.matrix(ctx),{auth:user});
 on('GET','/api/me/first-steps',ctx=>profile.firstSteps(ctx),{auth:user});
 on('GET','/api/messages/managers',ctx=>messages.managers(ctx),{auth:user});
 on('PUT','/api/admin/users/:id/manager',(ctx,p)=>admin.setManager(ctx,p.id),{auth:user});
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
 on('POST','/api/admin/nudge',ctx=>admin.nudge(ctx),{auth:user});
 on('PUT','/api/admin/users/:id/role',(ctx,p)=>admin.setRole(ctx,p.id),{auth:user});
 on('PUT','/api/admin/users/:id/status',(ctx,p)=>admin.setUserStatus(ctx,p.id),{auth:user});
 on('GET','/api/admin/claims',ctx=>people.adminClaims(ctx),{auth:user});
 on('POST','/api/admin/claims/:id',(ctx,p)=>people.decideClaim(ctx,p.id),{auth:user});
 on('GET','/api/admin/links',ctx=>people.adminLinks(ctx),{auth:user});
 on('POST','/api/admin/links/by-email',ctx=>people.adminLinkByEmail(ctx),{auth:user});
 on('GET','/api/admin/links/auto',ctx=>people.autoLinkStatus(ctx),{auth:user});
 on('PUT','/api/admin/links/auto',ctx=>people.setAutoLink(ctx),{auth:user});
 on('POST','/api/admin/teams',ctx=>people.adminCreateTeam(ctx),{auth:user});
 on('POST','/api/admin/people',ctx=>people.adminCreatePerson(ctx),{auth:user});
 on('PUT','/api/admin/people/:id/email',(ctx,p)=>people.setPersonEmail(ctx,p.id),{auth:user});
 on('POST','/api/admin/people/:id/link',(ctx,p)=>people.adminLink(ctx,p.id),{auth:user});
 on('POST','/api/admin/people/:id/unlink',(ctx,p)=>people.adminUnlink(ctx,p.id),{auth:user});
 on('GET','/api/admin/tasks',ctx=>tasks.adminTasks(ctx),{auth:user});
 on('POST','/api/admin/tasks',ctx=>tasks.createTask(ctx),{auth:user});
 on('PUT','/api/admin/tasks/:id',(ctx,p)=>tasks.updateTask(ctx,p.id),{auth:user});
 on('POST','/api/admin/tasks/:id/status',(ctx,p)=>tasks.setTaskStatus(ctx,p.id),{auth:user});
 on('GET','/api/admin/tasks/:id/preview',(ctx,p)=>tasks.previewAssign(ctx,p.id),{auth:user});
 on('POST','/api/admin/tasks/:id/assign',(ctx,p)=>tasks.assignTask(ctx,p.id),{auth:user});
 on('POST','/api/admin/tasks/:id/nudge-open',(ctx,p)=>tasks.nudgeOpen(ctx,p.id),{auth:user});
 on('POST','/api/admin/submissions/:id/revoke',(ctx,p)=>tasks.revokeAcceptance(ctx,p.id),{auth:user});
 on('GET','/api/admin/lectures',ctx=>lectures.adminLectures(ctx),{auth:user});
 on('POST','/api/admin/lectures',ctx=>lectures.saveLecture(ctx,null),{auth:user});
 on('PUT','/api/admin/lectures/:id',(ctx,p)=>lectures.saveLecture(ctx,p.id),{auth:user});
 on('GET','/api/admin/attendance',ctx=>lectures.adminAttendance(ctx),{auth:user});
 on('POST','/api/admin/attendance',ctx=>lectures.verifyAttendance(ctx),{auth:user});
 on('POST','/api/admin/attendance/remove',ctx=>lectures.removeAttendance(ctx),{auth:user});
 on('GET','/api/admin/attendance/matrix',ctx=>lectures.attendanceMatrix(ctx),{auth:user});
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
 on('GET','/api/admin/report',ctx=>report.report(ctx),{auth:user});on('GET','/api/admin/report.csv',ctx=>report.reportCsv(ctx),{auth:user});on('GET','/api/admin/report.xlsx',ctx=>report.reportXlsx(ctx),{auth:user});on('GET','/api/admin/report/print',ctx=>report.reportPrint(ctx),{auth:user});on('POST','/api/admin/report/outcomes/:id/verify',(ctx,p)=>report.verifyOutcome(ctx,p.id),{auth:user});
 on('GET','/api/announcements',ctx=>cohort.listAnnouncements(ctx),{auth:user});
 on('POST','/api/announcements/read',ctx=>cohort.readAnnouncements(ctx),{auth:user});
 on('GET','/api/wallet',ctx=>wallet.myWallets(ctx),{auth:user});
 on('GET','/api/rewards',ctx=>wallet.listRewards(ctx),{auth:user});
 on('POST','/api/rewards/:id/order',(ctx,p)=>wallet.orderReward(ctx,p.id),{auth:user});
 on('POST','/api/admin/rewards',ctx=>wallet.saveReward(ctx,null),{auth:user});
 on('PUT','/api/admin/rewards/:id',(ctx,p)=>wallet.saveReward(ctx,p.id),{auth:user});
 on('DELETE','/api/admin/rewards/:id',(ctx,p)=>wallet.archiveReward(ctx,p.id),{auth:user});
 on('POST','/api/admin/rewards/:id/restore',(ctx,p)=>wallet.restoreReward(ctx,p.id),{auth:user});
 on('GET','/api/admin/reward-orders',ctx=>wallet.adminOrders(ctx),{auth:user});
 on('POST','/api/admin/reward-orders/:id',(ctx,p)=>wallet.decideOrder(ctx,p.id),{auth:user});
 on('GET','/api/messages',ctx=>messages.conversations(ctx),{auth:user});
 on('GET','/api/messages/unread',ctx=>messages.unreadSummary(ctx),{auth:user});
 on('GET','/api/messages/people',ctx=>messages.directory(ctx),{auth:user});
 on('GET','/api/messages/person/:personId',(ctx,p)=>messages.forPerson(ctx,p.personId),{auth:user});
 on('POST','/api/messages/report/:id',(ctx,p)=>messages.report(ctx,p.id),{auth:user});
 on('GET','/api/messages/with/:userId',(ctx,p)=>messages.thread(ctx,p.userId),{auth:user});
 on('POST','/api/messages/with/:userId',(ctx,p)=>messages.send(ctx,p.userId),{auth:user});
 on('POST','/api/messages/with/:userId/block',(ctx,p)=>messages.block(ctx,p.userId,true),{auth:user});
 on('DELETE','/api/messages/with/:userId/block',(ctx,p)=>messages.block(ctx,p.userId,false),{auth:user});
 on('POST','/api/messages/groups',ctx=>messages.createGroup(ctx),{auth:user});
 on('POST','/api/messages/team/:projectId',(ctx,p)=>messages.teamChat(ctx,p.projectId),{auth:user});
 on('GET','/api/messages/groups/:id',(ctx,p)=>messages.groupThread(ctx,p.id),{auth:user});
 on('POST','/api/messages/groups/:id',(ctx,p)=>messages.groupSend(ctx,p.id),{auth:user});
 on('PUT','/api/messages/groups/:id',(ctx,p)=>messages.renameGroup(ctx,p.id),{auth:user});
 on('POST','/api/messages/groups/:id/members',(ctx,p)=>messages.addMembers(ctx,p.id),{auth:user});
 on('DELETE','/api/messages/groups/:id/members/:userId',(ctx,p)=>messages.removeMember(ctx,p.id,p.userId),{auth:user});
 on('POST','/api/messages/group-report/:id',(ctx,p)=>messages.groupReport(ctx,p.id),{auth:user});
 on('GET','/api/admin/message-reports',ctx=>messages.adminReports(ctx),{auth:user});
 on('POST','/api/admin/message-reports/:id/resolve',(ctx,p)=>messages.resolveReport(ctx,p.id),{auth:user});
 on('GET','/api/admin/reminders',ctx=>reminders.reminderStatus(ctx),{auth:user});
 on('PUT','/api/admin/reminders',ctx=>reminders.setReminders(ctx),{auth:user});
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
 on('GET','/api/me/profile',ctx=>profile.myProfile(ctx),{auth:user});
 on('PUT','/api/me/links',ctx=>profile.saveLinks(ctx),{auth:user});
 on('DELETE','/api/me/avatar',ctx=>avatars.deleteAvatar(ctx),{auth:user});
 on('GET','/api/avatars/:id',(ctx,p)=>avatars.getAvatar(ctx,p.id),{auth:user});
 on('POST','/api/office-hours/:id/book',(ctx,p)=>mentors.book(ctx,p.id),{auth:user});
 on('DELETE','/api/office-hours/:id/book',(ctx,p)=>mentors.unbook(ctx,p.id),{auth:user});
 on('POST','/api/office-hours/:id/note',(ctx,p)=>mentors.addNote(ctx,p.id),{auth:user});
 on('GET','/api/meeting-requests',ctx=>mentors.listRequests(ctx),{auth:user});
 on('POST','/api/meeting-requests',ctx=>mentors.requestMeeting(ctx),{auth:user});
 on('DELETE','/api/meeting-requests/:id',(ctx,p)=>mentors.withdrawRequest(ctx,p.id),{auth:user});
 on('POST','/api/admin/meeting-requests/:id',(ctx,p)=>mentors.decideRequest(ctx,p.id),{auth:user});
 on('GET','/api/quests',ctx=>cohort.listQuests(ctx));
 on('POST','/api/admin/quests',ctx=>cohort.createQuest(ctx),{auth:user});
 on('DELETE','/api/admin/quests/:id',(ctx,p)=>cohort.closeQuest(ctx,p.id),{auth:user});
 on('GET','/api/teams/ranking',ctx=>cohort.teamRanking(ctx));
 on('GET','/api/calendar.ics',ctx=>cohort.calendar(ctx));
 on('GET','/api/feedback/due',ctx=>insights.feedbackDue(ctx),{auth:user});
 on('POST','/api/lectures/:id/feedback',(ctx,p)=>insights.saveFeedback(ctx,p.id),{auth:user});
 on('GET','/api/admin/feedback',ctx=>insights.adminFeedback(ctx),{auth:user});
 on('GET','/api/admin/digest',ctx=>insights.digest(ctx),{auth:user});
 on('GET','/api/admin/trends',ctx=>insights.trends(ctx),{auth:user});
 on('POST','/api/admin/digest/send',ctx=>insights.sendDigest(ctx),{auth:user});
 on('GET','/api/admin/backup.sqlite',ctx=>insights.downloadBackup(ctx),{auth:user});
 on('GET','/api/admin/audit',ctx=>admin.auditLog(ctx),{auth:user});
 on('GET','/api/admin/today',ctx=>organiser.today(ctx),{auth:user});
 on('GET','/api/admin/office-signals',ctx=>organiser.officeSignals(ctx),{auth:user});
 on('GET','/api/admin/team/:id',(ctx,p)=>organiser.teamRecord(ctx,p.id),{auth:user});
 on('GET','/api/admin/person/:id',(ctx,p)=>organiser.personRecord(ctx,p.id),{auth:user});
 on('POST','/api/admin/xp',ctx=>organiser.adjustXp(ctx),{auth:user});
 on('POST','/api/admin/notes',ctx=>organiser.addNote(ctx),{auth:user});
 on('PUT','/api/admin/users/:id/team',(ctx,p)=>organiser.setTeam(ctx,p.id),{auth:user});
 on('POST','/api/admin/users/:id/reset-code',(ctx,p)=>organiser.resetCode(ctx,p.id),{auth:user});
 on('GET','/api/admin/export-people.csv',ctx=>organiser.exportPeople(ctx),{auth:user});
 on('GET','/api/admin/settings',ctx=>admin.settings(ctx),{auth:user});
 on('GET','/api/admin/pilot-requests',ctx=>leads.list(ctx),{auth:user});
 on('DELETE','/api/admin/pilot-requests/:id',(ctx,p)=>leads.remove(ctx,p.id),{auth:user});
 // Hubvers network (server/network.mjs): public sign-up with a profile, the directory, connections, deleting one's account.
 on('GET','/api/network/meta',ctx=>network.meta(ctx));
 on('POST','/api/network/signup/:kind',(ctx,p)=>network.signup(ctx,p.kind));
 on('GET','/api/network/cards/:kind',(ctx,p)=>network.cards(ctx,p.kind));
 on('GET','/api/network/directory/:kind',(ctx,p)=>network.directory(ctx,p.kind),{auth:user});
 on('GET','/api/network/people/:id',(ctx,p)=>network.profile(ctx,p.id),{auth:user});
 on('GET','/api/network/people/:id/photo',(ctx,p)=>network.photo(ctx,p.id),{auth:user});
 on('GET','/api/network/me',ctx=>network.mine(ctx),{auth:user});
 on('PUT','/api/network/me/:kind',(ctx,p)=>network.saveMine(ctx,p.kind),{auth:user});
 on('DELETE','/api/network/me',ctx=>network.deleteMine(ctx),{auth:user});
 on('POST','/api/network/connections/:id',(ctx,p)=>network.requestConnection(ctx,p.id),{auth:user});
 on('POST','/api/network/connections/:id/decide',(ctx,p)=>network.decideConnection(ctx,p.id),{auth:user});
 on('DELETE','/api/network/connections/:id',(ctx,p)=>network.removeConnection(ctx,p.id),{auth:user});
 // Investors (server/investors.mjs): approved investors read opted-in projects of every workspace; organisers see interest.
 on('GET','/api/investors/projects',ctx=>investors.projects(ctx),{auth:user});
 on('GET','/api/investors/projects/:hub/:id',(ctx,p)=>investors.project(ctx,p.hub,p.id),{auth:user});
 on('POST','/api/investors/projects/:hub/:id/interest',(ctx,p)=>investors.interest(ctx,p.hub,p.id),{auth:user});
 on('GET','/api/admin/investors',ctx=>investors.pending(ctx),{auth:user});
 on('POST','/api/admin/investors/:id',(ctx,p)=>investors.decide(ctx,p.id),{auth:user});
 on('GET','/api/admin/investor-interest',ctx=>investors.interestList(ctx),{auth:user});

 async function handleApi(request,server){
  const url=new URL(request.url);
  const ctx={db,config,request,url,storage,scanner,hooks,workspaces,ip:clientIp(request,server,config)};
  try{
   if(url.pathname.startsWith('/api/integration/v1/')){
    // The city visit shows BIRD's office; other workspaces have none.
    if(blank)fail(404,'NOT_FOUND');
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':config.cityOrigins.includes(request.headers.get('origin'))?request.headers.get('origin'):'null','Access-Control-Allow-Methods':'GET','Vary':'Origin'}});
    if(request.method!=='GET')fail(405,'BAD_REQUEST');
    return integration.handle(ctx,url.pathname.slice('/api/integration/v1/'.length));
   }
   if(url.pathname.startsWith('/api/profiles'))return directory(request,ctx.ip);
   // Google Apps Script calls this server-to-server with its own secret; no browser cookie or Origin.
   if(url.pathname==='/api/forms/hook'&&request.method==='POST')return await imports.hook(ctx);
   // Pilot requests from the public landing: no account, so neither the session nor the demo's read-only rule applies.
   if(url.pathname==='/api/pilot-request'&&request.method==='POST'){checkOrigin(request,config);if(!blank)fail(404,'NOT_FOUND');return await leads.submit(ctx);}
   if(MUTATING.has(request.method))checkOrigin(request,config);
   auth.loadSession(ctx);
   const route=routes.find(r=>r.method===request.method&&r.re.test(url.pathname));
   if(!route){if(routes.some(r=>r.re.test(url.pathname)))fail(405,'BAD_REQUEST');fail(404,'NOT_FOUND');}
   if(route.needs&&!ctx.user)fail(401,'UNAUTHENTICATED');
   if(MUTATING.has(request.method))auth.checkCsrf(ctx);
   // Demo visitors share the invented accounts, so nothing they do may change them.
   if(MUTATING.has(request.method)&&demoVisit.isDemoUser(ctx.user)&&!['/api/auth/logout','/api/demo/enter','/api/demo/join','/api/demo/me'].includes(url.pathname))fail(403,'DEMO_READ_ONLY');
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
  const demo=blank&&demoVisit.isDemo(db);
  // A demo workspace opens on the public landing page; the app itself lives at /demo (hash routes as before).
  if(demo&&url.pathname==='/demo/')return new Response(null,{status:301,headers:{Location:'/demo'}});
  // Hubvers section pages (server/site.mjs) and the catalogue of hubs behind /hubs sit next to the landing.
  if(demo&&url.pathname.length>1&&url.pathname.endsWith('/')&&SITE_PAGES[url.pathname.slice(0,-1)])return new Response(null,{status:301,headers:{Location:url.pathname.slice(0,-1)}});
  // Crawler files of the public site (server/site.mjs); BIRD and other workspaces have none.
  const crawl=demo&&{'/robots.txt':robotsTxt,'/sitemap.xml':sitemapXml,'/.well-known/security.txt':securityTxt}[url.pathname];
  if(crawl){
   if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
   return new Response(request.method==='HEAD'?null:crawl(),{headers:{'Content-Type':(url.pathname.endsWith('.xml')?'application/xml':'text/plain')+'; charset=utf-8','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
  }
  let file=demo&&['/','/index.html'].includes(url.pathname)?'landing.html':demo&&url.pathname==='/demo'?'workspace.html':demo&&SITE_PAGES[url.pathname]?SITE_PAGES[url.pathname]:demo&&NETWORK_PAGES[url.pathname]?NETWORK_PAGES[url.pathname]:demo&&PROFILE_PATH.test(url.pathname)?PROFILE_PAGE:demo&&INVESTOR_PAGES[url.pathname]?INVESTOR_PAGES[url.pathname]:demo&&INVESTOR_PROJECT_PATH.test(url.pathname)?INVESTOR_PROJECT_PAGE:demo&&url.pathname==='/'+HUBS_FILE?HUBS_FILE:staticFiles.get(url.pathname);
  // A demo workspace also gets the office and the incubator map, with characters under invented names.
  if(!file&&demo){
   if(url.pathname==='/assets/office-demo-data.js')return new Response(demoOffice().script+demoJoin.officeScript(db,publicDir),{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   const own=demoJoin.art(db,publicDir,url.pathname,request);if(own)return own;
   file=DEMO_ASSETS.has(url.pathname.slice(8))&&url.pathname.startsWith('/assets/')?url.pathname.slice(1):demoOffice().files.get(url.pathname);
  }
  if(!file)return new Response('Not found',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  let body;try{body=await readFile(publicDir+'/'+file);}catch{return new Response('Not found',{status:404});}
  if(file==='workspace.html')body=body.toString('utf8').replaceAll('{{name}}',escapeHtml(config.workspace?.name||''));
  const origin=siteOrigin(request,selfOrigin(request,config));
  if(file==='landing.html')body=renderSite(renderLanding(body.toString("utf8"),origin),{origin,current:'home',product:PRODUCT_NAME});
  else if(Object.values(SITE_PAGES).includes(file))body=renderSite(body.toString('utf8'),{origin,current:file.replace('.html',''),product:PRODUCT_NAME});
  else if(file===PROFILE_PAGE||Object.values(NETWORK_PAGES).includes(file))body=renderSite(body.toString('utf8'),{origin,current:'mentors',product:PRODUCT_NAME,europe:file==='mentors-network.html'?europeMap():''});
  else if(file===INVESTOR_PROJECT_PAGE||Object.values(INVESTOR_PAGES).includes(file))body=renderSite(body.toString('utf8'),{origin,current:'investors',product:PRODUCT_NAME,europe:file==='investors-me.html'?europeMap():''});
  const type=file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':file.endsWith('.avif')?'image/avif':file.endsWith('.webm')?'video/webm':file.endsWith('.mp4')?'video/mp4':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html';
  // Caching: pages stay no-store; scripts and styles are revalidated against the release (a 304 costs no body);
  // pictures change rarely and are cached for a day; videos are cached for a year (a new recording gets a new file name).
  // Text is gzipped when the browser accepts it.
  const video=type.startsWith('video/'),image=type.startsWith('image/')||video,etag=`"${releaseInfo.release}"`;
  const cache=type==='text/html'?'no-store':video?'public, max-age=31536000, immutable':image?'public, max-age=86400':'no-cache';
  const headers={'Content-Type':type+(image?'':'; charset=utf-8'),'Cache-Control':cache,'X-Content-Type-Options':'nosniff','X-BIRD-Release':releaseInfo.release,'Referrer-Policy':'same-origin'};
  if(type!=='text/html'){headers.ETag=etag;if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});}
  // Videos answer byte ranges (Safari plays a video only from a server that does).
  if(video){
   headers['Accept-Ranges']='bytes';
   const m=/^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range')||'');
   if(m&&(m[1]||m[2])){
    const size=body.length,from=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),to=m[1]&&m[2]?Math.min(Number(m[2]),size-1):size-1;
    if(from>=size||from>to)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${size}`}});
    return new Response(request.method==='HEAD'?null:body.subarray(from,to+1),{status:206,headers:{...headers,'Content-Range':`bytes ${from}-${to}/${size}`,'Content-Length':String(to-from+1)}});
   }
  }
  if(!image&&body.length>1024&&/\bgzip\b/.test(request.headers.get('accept-encoding')||'')){body=Bun.gzipSync(typeof body==='string'?new TextEncoder().encode(body):body);headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding';}
  // The office may be framed only by the allowed city origin (light visit); other pages not at all.
  if(type==='text/html')headers['Content-Security-Policy']=`frame-ancestors 'self' ${config.cityOrigins.join(' ')}`;
  return new Response(request.method==='HEAD'?null:body,{headers});
 }
 return {fetch,db,config,migration,close:()=>db.close(),storage,integration,refreshDemo};
}
export {isAdmin,nowIso,freeBytes};
