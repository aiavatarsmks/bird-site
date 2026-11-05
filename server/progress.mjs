/** XP ledger, progress events and badges. Every award has a unique source key. */
import {json,page} from './http.mjs';
import {nowIso} from './db.mjs';
import {notify} from './notifications.mjs';

export const BADGES=[
 {id:'first-project',rule:'project.created',t:{en:'First project',hr:'Prvi projekt',ru:'Первый проект'}},
 {id:'first-presentation',rule:'presentation.accepted',t:{en:'First presentation',hr:'Prva prezentacija',ru:'Первая презентация'}},
 {id:'first-report',rule:'submission.accepted',t:{en:'First report',hr:'Prvo izvješće',ru:'Первый отчёт'}},
 {id:'team-helper',rule:'help.confirmed',t:{en:'Helped another team',hr:'Pomoć drugom timu',ru:'Помощь другой команде'}},
 {id:'three-lectures',rule:'attendance.3',t:{en:'Three different lectures',hr:'Tri različita predavanja',ru:'Три разные лекции'}},
 {id:'stage-complete',rule:'milestone.done',t:{en:'Stage completed',hr:'Završena faza',ru:'Этап завершён'}},
];

export function seedBadges(db){
 for(const b of BADGES)db.query('INSERT INTO badge_definitions(id,translations,rule) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET translations=excluded.translations,rule=excluded.rule').run(b.id,JSON.stringify(b.t),b.rule);
}

/** Inserts one ledger row. Returns false when the same source was already rewarded. */
export function award(db,{type,id,amount,sourceKey,reason,actor=null}){
 if(!amount)return false;
 const r=db.query('INSERT OR IGNORE INTO xp_ledger(beneficiary_type,beneficiary_id,amount,source_key,reason,actor,created) VALUES(?,?,?,?,?,?,?)').run(type,id,amount,sourceKey,reason,actor,nowIso());
 if(r.changes)db.query('INSERT INTO progress_events(user_id,project_id,kind,ref,created) VALUES(?,?,?,?,?)').run(type==='user'?id:null,type==='project'?id:null,'xp.awarded',sourceKey,nowIso());
 return r.changes>0;
}
/** Correction: a separate negative row. History is never deleted. */
export function reverse(db,{type,id,sourceKey,actor,reason='correction'}){
 const original=db.query('SELECT amount FROM xp_ledger WHERE beneficiary_type=? AND beneficiary_id=? AND source_key=?').get(type,id,sourceKey);
 if(!original)return false;
 return award(db,{type,id,amount:-original.amount,sourceKey:'reversal:'+sourceKey,reason,actor});
}

export function grantBadge(db,userId,badgeId){
 const r=db.query('INSERT OR IGNORE INTO badge_awards(user_id,badge_id,created) VALUES(?,?,?)').run(userId,badgeId,nowIso());
 if(r.changes){db.query('INSERT INTO progress_events(user_id,kind,ref,created) VALUES(?,?,?,?)').run(userId,'badge',badgeId,nowIso());notify(db,userId,'badge',{badgeId});}
 return r.changes>0;
}
export function badgeForRule(db,userId,rule){const b=BADGES.find(x=>x.rule===rule);if(b)grantBadge(db,userId,b.id);}

export function userXp(db,userId){return db.query("SELECT coalesce(sum(amount),0) n FROM xp_ledger WHERE beneficiary_type='user' AND beneficiary_id=?").get(userId).n;}
export function projectXp(db,projectId){return db.query("SELECT coalesce(sum(amount),0) n FROM xp_ledger WHERE beneficiary_type='project' AND beneficiary_id=?").get(projectId).n;}

export function myProgress(ctx){
 const user=ctx.user;
 const projects=ctx.db.query("SELECT p.id,p.draft FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member')").all(user.id);
 const badges=ctx.db.query('SELECT a.badge_id,a.created,d.translations FROM badge_awards a JOIN badge_definitions d ON d.id=a.badge_id WHERE a.user_id=? ORDER BY a.created').all(user.id);
 const history=ctx.db.query("SELECT amount,reason,created FROM xp_ledger WHERE beneficiary_type='user' AND beneficiary_id=? ORDER BY id DESC LIMIT 30").all(user.id);
 return json({
  xp:userXp(ctx.db,user.id),
  teams:projects.map(p=>({projectId:p.id,name:JSON.parse(p.draft).name,xp:projectXp(ctx.db,p.id),history:ctx.db.query("SELECT amount,reason,created FROM xp_ledger WHERE beneficiary_type='project' AND beneficiary_id=? ORDER BY id DESC LIMIT 20").all(p.id)})),
  badges:badges.map(b=>({id:b.badge_id,title:JSON.parse(b.translations),created:b.created})),
  available:BADGES.map(b=>({id:b.id,title:b.t})),
  history,leaderboardOptIn:!!user.leaderboard_opt_in,
 });
}

/** Voluntary comparison: only people who opted in, only total XP. */
export function leaderboard(ctx){
 const {limit}=page(ctx.url,50);
 const rows=ctx.db.query("SELECT u.display_name name,coalesce(sum(x.amount),0) xp FROM users u LEFT JOIN xp_ledger x ON x.beneficiary_type='user' AND x.beneficiary_id=u.id WHERE u.leaderboard_opt_in=1 AND u.status='active' GROUP BY u.id ORDER BY xp DESC,name LIMIT ?").all(limit);
 return json({items:rows});
}
