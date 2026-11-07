/**
 * Team wallet: everything a team and its members earned, minus what the team spent.
 * Spending never lowers the ranking, which counts earned points only.
 * A cancelled booking or a declined reward gives the points back by itself.
 */
import {fail,json,readJson,text,int,newId} from './http.mjs';
import {nowIso} from './db.mjs';
import {audit,isAdmin,membership,requireAdmin} from './permissions.mjs';
import {requireUser} from './auth.mjs';
import {notify} from './notifications.mjs';
import {projectXp,userXp} from './progress.mjs';

export const DEFAULT_SESSION_PRICE=30;
const TEAM=['owner','editor','member'];
export const onTeam=(db,projectId,userId)=>TEAM.includes(membership(db,projectId,userId));
const members=(db,projectId)=>db.query(`SELECT user_id FROM memberships WHERE project_id=? AND revoked_at IS NULL AND role IN ('owner','editor','member')`).all(projectId).map(r=>r.user_id);

export function wallet(db,projectId){
 const earned=projectXp(db,projectId)+members(db,projectId).reduce((n,id)=>n+userXp(db,id),0);
 const sessions=db.query('SELECT coalesce(sum(b.cost),0) n FROM office_hour_bookings b JOIN office_hours h ON h.id=b.slot_id WHERE b.project_id=? AND h.cancelled_at IS NULL').get(projectId).n;
 const rewards=db.query("SELECT coalesce(sum(price),0) n FROM reward_orders WHERE project_id=? AND status IN ('pending','approved')").get(projectId).n;
 return {earned,spent:sessions+rewards,balance:earned-sessions-rewards};
}
/** Fails when the team cannot pay; call inside the same transaction as the purchase. */
export function charge(db,projectId,price){
 const w=wallet(db,projectId);
 if(w.balance<price)fail(409,'NOT_ENOUGH_POINTS',{balance:w.balance,price});
 return w;
}

/** The signed-in person's teams with their wallets and recent spending. */
export function myWallets(ctx){
 const user=requireUser(ctx);
 const teams=ctx.db.query(`SELECT p.id,json_extract(p.draft,'$.name') name FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.revoked_at IS NULL AND m.role IN ('owner','editor','member') AND p.status<>'archived' ORDER BY m.created`).all(user.id);
 return json({items:teams.map(t=>({projectId:t.id,name:t.name,...wallet(ctx.db,t.id),history:history(ctx.db,t.id)}))});
}
function history(db,projectId){
 const sessions=db.query('SELECT h.mentor_name label,b.cost amount,b.created,h.cancelled_at FROM office_hour_bookings b JOIN office_hours h ON h.id=b.slot_id WHERE b.project_id=? AND b.cost>0').all(projectId).map(r=>({kind:'session',label:r.label,amount:r.amount,created:r.created,refunded:!!r.cancelled_at}));
 const orders=db.query('SELECT r.title label,o.price amount,o.created,o.status FROM reward_orders o JOIN rewards r ON r.id=o.reward_id WHERE o.project_id=?').all(projectId).map(r=>({kind:'reward',label:r.label,amount:r.amount,created:r.created,status:r.status,refunded:r.status==='rejected'}));
 return [...sessions,...orders].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,30);
}

// Rewards organisers offer: a pitch slot, a deck review, perks.
const rewardView=(db,r)=>{const taken=db.query("SELECT count(*) n FROM reward_orders WHERE reward_id=? AND status IN ('pending','approved')").get(r.id).n;return {id:r.id,title:r.title,description:r.description,price:r.price,stock:r.stock,left:r.stock===null?null:Math.max(0,r.stock-taken),archived:!!r.archived_at};};
export function listRewards(ctx){
 const user=requireUser(ctx),all=isAdmin(user)&&ctx.url.searchParams.get('all')==='1';
 return json({items:ctx.db.query(`SELECT * FROM rewards ${all?'':'WHERE archived_at IS NULL'} ORDER BY archived_at IS NOT NULL,price,created`).all().map(r=>rewardView(ctx.db,r))});
}
export async function saveReward(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const title=text(body.title,{min:1,max:120},'title'),description=text(body.description??'',{max:600,multiline:true},'description');
 const price=int(body.price,{min:0,max:100000},'price'),stock=body.stock===null||body.stock===''||body.stock===undefined?null:int(body.stock,{min:0,max:10000},'stock');
 if(id){const r=ctx.db.query('UPDATE rewards SET title=?,description=?,price=?,stock=? WHERE id=?').run(title,description,price,stock,id);if(!r.changes)fail(404,'NOT_FOUND');}
 else{id=newId('reward');ctx.db.query('INSERT INTO rewards(id,title,description,price,stock,created_by,created) VALUES(?,?,?,?,?,?,?)').run(id,title,description,price,stock,admin.id,nowIso());}
 audit(ctx.db,admin.id,'reward.save','reward',id,{price,stock});
 return json({id},201);
}
export function archiveReward(ctx,id){const admin=requireAdmin(ctx);ctx.db.query('UPDATE rewards SET archived_at=? WHERE id=? AND archived_at IS NULL').run(nowIso(),id);audit(ctx.db,admin.id,'reward.archive','reward',id,{});return json({ok:true});}

export async function orderReward(ctx,id){
 const user=requireUser(ctx),body=await readJson(ctx.request);
 const projectId=text(body.projectId,{max:80},'projectId');if(!onTeam(ctx.db,projectId,user.id))fail(403,'FORBIDDEN');
 const note=text(body.note??'',{max:300,multiline:true},'note');
 const orderId=newId('order');
 ctx.db.transaction(()=>{
  const r=ctx.db.query('SELECT * FROM rewards WHERE id=? AND archived_at IS NULL').get(id);if(!r)fail(404,'NOT_FOUND');
  const v=rewardView(ctx.db,r);if(v.left===0)fail(409,'SOLD_OUT');
  charge(ctx.db,projectId,r.price);
  ctx.db.query('INSERT INTO reward_orders(id,reward_id,project_id,ordered_by,price,note,created) VALUES(?,?,?,?,?,?,?)').run(orderId,id,projectId,user.id,r.price,note,nowIso());
 })();
 for(const a of ctx.db.query("SELECT id,role FROM users WHERE status='active'").all().filter(isAdmin))notify(ctx.db,a.id,'reward.ordered',{});
 audit(ctx.db,user.id,'reward.order','reward',id,{project:projectId});
 return json({id:orderId,...wallet(ctx.db,projectId)},201);
}
export function adminOrders(ctx){
 requireAdmin(ctx);
 const rows=ctx.db.query("SELECT o.*,r.title,json_extract(p.draft,'$.name') team,u.display_name who FROM reward_orders o JOIN rewards r ON r.id=o.reward_id JOIN projects p ON p.id=o.project_id JOIN users u ON u.id=o.ordered_by ORDER BY o.status<>'pending',o.created DESC LIMIT 200").all();
 return json({items:rows.map(o=>({id:o.id,title:o.title,team:o.team,projectId:o.project_id,who:o.who,price:o.price,note:o.note,status:o.status,created:o.created,decidedAt:o.decided_at}))});
}
export async function decideOrder(ctx,id){
 const admin=requireAdmin(ctx),body=await readJson(ctx.request);
 const status=body.status==='approved'?'approved':body.status==='rejected'?'rejected':fail(400,'INVALID_FIELDS',{field:'status'});
 const o=ctx.db.query("SELECT * FROM reward_orders WHERE id=? AND status='pending'").get(id);if(!o)fail(404,'NOT_FOUND');
 ctx.db.query('UPDATE reward_orders SET status=?,decided_by=?,decided_at=? WHERE id=?').run(status,admin.id,nowIso(),id);
 notify(ctx.db,o.ordered_by,'reward.'+status,{});
 audit(ctx.db,admin.id,'reward.'+status,'reward_order',id,{project:o.project_id,price:o.price});
 return json({ok:true});
}
