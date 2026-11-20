/** One-screen personal profile: character, points, badges, lectures, tasks, projects and own links. */
import {json,readJson,httpUrl} from './http.mjs';
import {nowIso} from './db.mjs';
import {requireUser} from './auth.mjs';
import {userXp,BADGES} from './progress.mjs';
import {hasAvatar} from './avatars.mjs';

export function myProfile(ctx){
 const user=requireUser(ctx),db=ctx.db;
 const person=user.person_id?db.query('SELECT id,display_name,kind FROM people WHERE id=?').get(user.person_id):null;
 const earned=db.query('SELECT badge_id,created FROM badge_awards WHERE user_id=? ORDER BY created').all(user.id);
 const today=new Date().toISOString().slice(0,10);
 const attendance=db.query('SELECT kind,count(*) n FROM attendance WHERE user_id=? GROUP BY kind').all(user.id);
 const tasks=db.query("SELECT coalesce(s.status,'not_started') st,count(*) n FROM assignments a JOIN task_templates t ON t.id=a.task_id LEFT JOIN submissions s ON s.assignment_id=a.id WHERE t.status='published' AND a.user_id=? GROUP BY st").all(user.id);
 const count=st=>tasks.filter(x=>st.includes(x.st)).reduce((n,x)=>n+x.n,0);
 const projects=db.query("SELECT p.id,p.status,json_extract(p.draft,'$.name') name FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member') AND p.status<>'archived'").all(user.id);
 return json({
  displayName:user.display_name,role:user.role,hasAvatar:hasAvatar(db,user.id),
  character:person&&person.kind==='participant'?{personId:person.id,name:person.display_name}:null,
  xp:userXp(db,user.id),
  badges:BADGES.map(b=>({id:b.id,title:b.t,earned:earned.find(e=>e.badge_id===b.id)?.created||null})),
  lectures:{verified:attendance.find(a=>a.kind==='verified_by_admin')?.n||0,selfReported:attendance.find(a=>a.kind==='self_reported')?.n||0,held:db.query("SELECT count(*) n FROM lectures WHERE status='published' AND date<=?").get(today).n},
  tasks:{done:count(['accepted']),waiting:count(['submitted']),open:count(['not_started','draft','changes_requested'])},
  projects:projects.map(p=>({id:p.id,name:p.name,published:p.status==='published'})),
  links:{linkedin:user.linkedin||'',website:user.website||''},
 });
}
export async function saveLinks(ctx){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const linkedin=httpUrl(body.linkedin??'','linkedin'),website=httpUrl(body.website??'','website');
 ctx.db.query('UPDATE users SET linkedin=?,website=?,updated=? WHERE id=?').run(linkedin,website,nowIso(),user.id);
 return json({ok:true,links:{linkedin,website}});
}

/**
 * First steps of a team member, each ticked from real data: the team card (description, problem, solution),
 * the pitch deck (a PDF or PPTX in the project), teammates (a second member or an invitation sent) and the first
 * task (answered or started). The team is the person's first active project.
 */
export function firstSteps(ctx){
 const user=requireUser(ctx),db=ctx.db;
 const p=db.query("SELECT p.id,p.draft FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member') AND p.status<>'archived' ORDER BY p.source='user',m.created LIMIT 1").get(user.id);
 if(!p)return json({projectId:null,steps:[]});
 let c={};try{c=JSON.parse(p.draft)||{};}catch{}
 const filled=['short','problem','solution'].every(k=>String(c[k]||'').trim().length>=3);
 const deck=!!db.query("SELECT 1 FROM files WHERE project_id=? AND status='active' AND purpose='document' AND (lower(filename) LIKE '%.pdf' OR lower(filename) LIKE '%.pptx' OR lower(filename) LIKE '%.ppt' OR lower(filename) LIKE '%.odp')").get(p.id);
 const mates=db.query("SELECT count(*) n FROM memberships WHERE project_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')").get(p.id).n>1||!!db.query("SELECT 1 FROM invites WHERE project_id=? AND kind='project' AND revoked_at IS NULL").get(p.id);
 const task=!!db.query("SELECT 1 FROM assignments a WHERE (a.project_id=?1 OR a.user_id=?2) AND (EXISTS(SELECT 1 FROM task_responses r WHERE r.assignment_id=a.id) OR EXISTS(SELECT 1 FROM submissions s WHERE s.assignment_id=a.id))").get(p.id,user.id);
 return json({projectId:p.id,steps:[{key:'card',done:filled},{key:'deck',done:deck},{key:'invite',done:mates},{key:'task',done:task}]});
}
