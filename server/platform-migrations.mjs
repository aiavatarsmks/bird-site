/**
 * Migrations of the platform database (platform.sqlite): the register of incubators and their workspaces.
 * It never holds a workspace's people, teams, messages or files. Same rules as migrations.mjs:
 * numbered, additive, never edit an applied one.
 */
export const PLATFORM_MIGRATIONS=[
 {id:1,name:'workspace-register',sql:`
CREATE TABLE IF NOT EXISTS organisations(
 id TEXT PRIMARY KEY,name TEXT NOT NULL,city TEXT NOT NULL DEFAULT '',country TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 network_enabled INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workspaces(
 id TEXT PRIMARY KEY,organisation_id TEXT NOT NULL REFERENCES organisations(id),slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL,
 data_path TEXT NOT NULL DEFAULT '',seed_profile TEXT NOT NULL DEFAULT 'blank' CHECK(seed_profile IN ('bird','blank')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','suspended')),
 timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',languages TEXT NOT NULL DEFAULT 'en,hr,ru',
 is_default INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_default ON workspaces(is_default) WHERE is_default=1;
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_data_path ON workspaces(data_path);
CREATE TABLE IF NOT EXISTS workspace_hosts(host TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS platform_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS platform_audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '{}',created TEXT NOT NULL);
`},
];
