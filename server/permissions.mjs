/** Server-side permission checks and the audit log. The UI never decides access. */
import {fail} from './http.mjs';

export function audit(db,actor,action,targetType,targetId,detail={}){
 db.query('INSERT INTO audit_log(actor,action,target_type,target_id,detail,created) VALUES(?,?,?,?,?,?)').run(actor||null,action,targetType,String(targetId),JSON.stringify(detail),new Date().toISOString());
}

export const isOwner=u=>u?.role==='platform_owner';
export const isAdmin=u=>u?.role==='program_admin'||u?.role==='platform_owner';
export function requireAdmin(ctx){if(!ctx.user)fail(401,'UNAUTHENTICATED');if(!isAdmin(ctx.user))fail(403,'FORBIDDEN');return ctx.user;}
export function requireOwner(ctx){if(!ctx.user)fail(401,'UNAUTHENTICATED');if(!isOwner(ctx.user))fail(403,'FORBIDDEN');return ctx.user;}

export function membership(db,projectId,userId){
 if(!userId)return null;
 return db.query('SELECT role FROM memberships WHERE project_id=? AND user_id=? AND revoked_at IS NULL').get(projectId,userId)?.role||null;
}

/**
 * Capabilities on one project:
 * read      published or own team project
 * team      read team-only material, act on team tasks
 * edit      change description, sections and files
 * manage    membership, invitations, archive
 * review    reviewer-visible material and reports
 */
export function projectAccess(db,user,project){
 const role=membership(db,project.id,user?.id),admin=isAdmin(user);
 const team=['owner','editor','member'].includes(role);
 return {
  role,
  read:project.status==='published'||team||role==='reviewer'||admin,
  team:team||admin,
  edit:['owner','editor'].includes(role)||admin,
  manage:role==='owner'||admin,
  review:role==='reviewer'||admin,
 };
}
export function requireProject(db,user,projectId,need='read'){
 const project=db.query('SELECT * FROM projects WHERE id=?').get(projectId);
 if(!project)fail(404,'NOT_FOUND');
 const access=projectAccess(db,user,project);
 if(!access.read)fail(404,'NOT_FOUND');
 if(!access[need])fail(user?403:401,user?'FORBIDDEN':'UNAUTHENTICATED');
 if(project.status==='archived'&&need==='edit'&&!isAdmin(user)&&access.role!=='owner')fail(409,'INVALID_STATE');
 return {project,access};
}

/** Matrix used by RUNBOOK and the admin screen. */
export const PERMISSION_MATRIX=[
 ['Read published lectures, projects and office cards','guest, everyone'],
 ['Edit own profile and own confirmed character','member'],
 ['Create own project','member'],
 ['Edit project description and files','project owner, editor, admin'],
 ['Manage project team and invitations, archive','project owner, admin'],
 ['Read team material, act on team tasks','project owner, editor, member'],
 ['Read assigned projects and reports','reviewer (only assigned projects), admin'],
 ['Create and publish tasks, review reports, verify attendance','program admin, platform owner'],
 ['Approve character claims, moderate','program admin, platform owner'],
 ['Grant or revoke program admin, change settings','platform owner'],
];
