/** Public visit of a demo workspace: anyone can look around as the invented manager or a team, but nothing is saved. */
import {fail,json,readJson,rateLimit} from './http.mjs';
import {createSession} from './auth.mjs';
import {stageOf} from './stages.mjs';

const VISIT_HOURS=4;
// Whose eyes a visitor borrows: the manager sees the admin pages, AgroBit has open tasks and asked for help, the invented
// investor sees the investor dashboard (the invented projects only, server/investors.mjs).
const ENTRIES={manager:'demo-user-manager',team:'demo-user-agrobit-1',investor:'demo-user-investor-adria'};

export const isDemo=db=>Boolean(db.query("SELECT 1 FROM settings WHERE key='demo_filled'").get());
// Every account the demo filler made has an id that starts like this; real accounts never do.
export const isDemoUser=user=>Boolean(user?.id?.startsWith('demo-user-'));
// A visitor of the public demo sees only the invented cohort: the real accounts that run the workspace stay out of every list.
export const onlyDemoPeople=ctx=>isDemoUser(ctx.user)&&isDemo(ctx.db);

export function status(ctx){
 const demo=isDemo(ctx.db);
 return json({demo,entries:demo?Object.keys(ENTRIES).filter(k=>ctx.db.query("SELECT 1 FROM users WHERE id=? AND status='active'").get(ENTRIES[k])):[]});
}

export async function enter(ctx){
 if(!isDemo(ctx.db))fail(404,'NOT_FOUND');
 // Generous: a whole incubator may sit behind one office router.
 rateLimit(ctx.db,'demo-enter:'+ctx.ip,120,3600);
 const body=await readJson(ctx.request);
 const userId=ENTRIES[body.as];
 if(!userId||!ctx.db.query("SELECT 1 FROM users WHERE id=? AND status='active'").get(userId))fail(400,'BAD_REQUEST');
 if(ctx.session)ctx.db.query('UPDATE sessions SET revoked_at=? WHERE id=?').run(new Date().toISOString(),ctx.session.id);
 const session=createSession(ctx,userId);
 ctx.db.query('UPDATE sessions SET expires=? WHERE id=?').run(Date.now()+VISIT_HOURS*3600000,session.id);
 return json({ok:true,csrf:session.csrf});
}

/** Teams and their people for the office map. Published projects and their teams are public anyway. */
export function roster(ctx){
 if(!isDemo(ctx.db))fail(404,'NOT_FOUND');
 const projects=ctx.db.query("SELECT id,team_id,published FROM projects WHERE status='published' ORDER BY id").all();
 const members=ctx.db.query('SELECT tp.team_id,p.id,p.display_name FROM team_people tp JOIN people p ON p.id=tp.person_id ORDER BY p.id').all();
 return json({items:projects.map(p=>{const c=JSON.parse(p.published);return {id:p.id,teamId:p.team_id,name:c.name,short:c.short||'',stage:stageOf(c.stage),members:members.filter(m=>m.team_id===p.team_id).map(m=>({id:m.id,name:m.display_name}))};})});
}
