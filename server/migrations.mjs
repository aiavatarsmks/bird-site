/**
 * Numbered, additive migrations. Never edit an applied migration: add a new one.
 * The checksum covers the SQL text, or the source of up() for JS migrations,
 * so even a comment inside an applied up() makes the server refuse to start.
 */
export const MIGRATIONS=[
 {id:1,name:'core-platform',sql:`
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS people(
 id TEXT PRIMARY KEY,display_name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('participant','staff','visitor')),
 source TEXT NOT NULL CHECK(source IN ('curated','user')),
 appearance TEXT NOT NULL DEFAULT '',public_role TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
 created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY,login TEXT NOT NULL COLLATE NOCASE UNIQUE,display_name TEXT NOT NULL,
 email TEXT,email_verified INTEGER NOT NULL DEFAULT 0,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','program_admin','platform_owner')),
 person_id TEXT UNIQUE REFERENCES people(id),language TEXT NOT NULL DEFAULT 'en',
 leaderboard_opt_in INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
 created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS password_credentials(user_id TEXT PRIMARY KEY REFERENCES users(id),hash TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),token_hash TEXT NOT NULL UNIQUE,csrf TEXT NOT NULL,
 device TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,last_seen TEXT NOT NULL,expires INTEGER NOT NULL,revoked_at TEXT);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS recovery_codes(id INTEGER PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),code_hash TEXT NOT NULL UNIQUE,used_at TEXT);
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS person_claims(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),person_id TEXT NOT NULL REFERENCES people(id),
 message TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','withdrawn')),
 decided_by TEXT,decided_at TEXT,created TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS person_claims_pending ON person_claims(user_id,person_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY,name TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects(
 id TEXT PRIMARY KEY,team_id TEXT NOT NULL REFERENCES teams(id),
 source TEXT NOT NULL CHECK(source IN ('curated','user')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 created_by TEXT,draft TEXT NOT NULL,draft_version INTEGER NOT NULL DEFAULT 1,
 published TEXT,published_version INTEGER,published_at TEXT,archived_at TEXT,
 created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS team_people(team_id TEXT NOT NULL REFERENCES teams(id),person_id TEXT NOT NULL REFERENCES people(id),PRIMARY KEY(team_id,person_id));
CREATE TABLE IF NOT EXISTS memberships(
 project_id TEXT NOT NULL REFERENCES projects(id),user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','editor','member','reviewer')),
 created TEXT NOT NULL,revoked_at TEXT,PRIMARY KEY(project_id,user_id));
CREATE TABLE IF NOT EXISTS invites(
 id TEXT PRIMARY KEY,code_hash TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('project','person','platform_owner','program_admin')),
 project_id TEXT REFERENCES projects(id),person_id TEXT REFERENCES people(id),role TEXT,
 created_by TEXT,expires INTEGER NOT NULL,used_by TEXT,used_at TEXT,revoked_at TEXT,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS project_revisions(
 id INTEGER PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),version INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('draft','published','conflict','restored')),
 content TEXT NOT NULL,author TEXT,created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS project_revisions_project ON project_revisions(project_id,id);
CREATE TABLE IF NOT EXISTS project_updates(
 id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),author TEXT NOT NULL,body TEXT NOT NULL,
 visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('team','public')),created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS files(
 id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),owner_user_id TEXT NOT NULL REFERENCES users(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('document','image','reference')),
 storage_key TEXT NOT NULL UNIQUE,filename TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','team','reviewer','public')),
 scan_status TEXT NOT NULL DEFAULT 'not_scanned',status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleted')),
 idem_key TEXT,created TEXT NOT NULL,deleted_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS files_idem ON files(owner_user_id,idem_key) WHERE idem_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS file_links(file_id TEXT NOT NULL REFERENCES files(id),target_type TEXT NOT NULL,target_id TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(file_id,target_type,target_id));
CREATE TABLE IF NOT EXISTS upload_reservations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,project_id TEXT,bytes INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lectures(
 id TEXT PRIMARY KEY,date TEXT NOT NULL,speaker TEXT NOT NULL DEFAULT '',title TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS lecture_materials(id TEXT PRIMARY KEY,lecture_id TEXT NOT NULL REFERENCES lectures(id),label TEXT NOT NULL,url TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attendance(
 user_id TEXT NOT NULL REFERENCES users(id),lecture_id TEXT NOT NULL REFERENCES lectures(id),
 kind TEXT NOT NULL CHECK(kind IN ('self_reported','verified_by_admin')),note TEXT NOT NULL DEFAULT '',
 verified_by TEXT,created TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(user_id,lecture_id));
CREATE TABLE IF NOT EXISTS programs(id TEXT PRIMARY KEY,name TEXT NOT NULL,timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS program_weeks(id TEXT PRIMARY KEY,program_id TEXT NOT NULL REFERENCES programs(id),number INTEGER NOT NULL,title TEXT NOT NULL,starts TEXT NOT NULL,ends TEXT NOT NULL,UNIQUE(program_id,number));
CREATE TABLE IF NOT EXISTS task_templates(
 id TEXT PRIMARY KEY,key TEXT UNIQUE,program_id TEXT REFERENCES programs(id),week_id TEXT REFERENCES program_weeks(id),
 type TEXT NOT NULL CHECK(type IN ('checklist','counter','text','link','attachment','attendance','team_result')),
 scope TEXT NOT NULL CHECK(scope IN ('personal','team')),
 xp INTEGER NOT NULL DEFAULT 0 CHECK(xp BETWEEN 0 AND 1000),counter_target INTEGER NOT NULL DEFAULT 0,
 requires_review INTEGER NOT NULL DEFAULT 0,self_report INTEGER NOT NULL DEFAULT 1,
 repeat_rule TEXT NOT NULL DEFAULT 'once' CHECK(repeat_rule IN ('once','weekly_reward','per_week')),
 checklist TEXT NOT NULL DEFAULT '[]',translations TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed','archived')),
 audience TEXT NOT NULL DEFAULT 'all_participants' CHECK(audience IN ('all_participants','selected')),
 due_at TEXT,timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',reviewer_user_id TEXT,
 visibility TEXT NOT NULL DEFAULT 'participants' CHECK(visibility IN ('participants','team')),
 official INTEGER NOT NULL DEFAULT 0,created_by TEXT,created TEXT NOT NULL,updated TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS assignments(
 id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES task_templates(id),
 user_id TEXT NOT NULL DEFAULT '',project_id TEXT NOT NULL DEFAULT '',period TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','cancelled')),created TEXT NOT NULL,
 UNIQUE(task_id,user_id,project_id,period));
CREATE TABLE IF NOT EXISTS submissions(
 id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL REFERENCES assignments(id),submitted_by TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','accepted','changes_requested','rejected')),
 revision INTEGER NOT NULL DEFAULT 0,draft TEXT NOT NULL DEFAULT '{}',created TEXT NOT NULL,updated TEXT NOT NULL,
 UNIQUE(assignment_id));
CREATE TABLE IF NOT EXISTS submission_revisions(
 id INTEGER PRIMARY KEY,submission_id TEXT NOT NULL REFERENCES submissions(id),revision INTEGER NOT NULL,
 content TEXT NOT NULL,submitted_by TEXT NOT NULL,idem_key TEXT,created TEXT NOT NULL,
 UNIQUE(submission_id,revision));
CREATE UNIQUE INDEX IF NOT EXISTS submission_revisions_idem ON submission_revisions(submission_id,idem_key) WHERE idem_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS reviews(
 id TEXT PRIMARY KEY,submission_id TEXT NOT NULL REFERENCES submissions(id),revision INTEGER NOT NULL,
 reviewer TEXT NOT NULL,decision TEXT NOT NULL CHECK(decision IN ('accepted','changes_requested','rejected')),
 comment TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,UNIQUE(submission_id,revision));
CREATE TABLE IF NOT EXISTS progress_events(id INTEGER PRIMARY KEY,user_id TEXT,project_id TEXT,kind TEXT NOT NULL,ref TEXT NOT NULL DEFAULT '',created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS xp_ledger(
 id INTEGER PRIMARY KEY,beneficiary_type TEXT NOT NULL CHECK(beneficiary_type IN ('user','project')),beneficiary_id TEXT NOT NULL,
 amount INTEGER NOT NULL,source_key TEXT NOT NULL,reason TEXT NOT NULL,actor TEXT,created TEXT NOT NULL,
 UNIQUE(beneficiary_type,beneficiary_id,source_key));
CREATE TABLE IF NOT EXISTS badge_definitions(id TEXT PRIMARY KEY,translations TEXT NOT NULL,rule TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS badge_awards(user_id TEXT NOT NULL REFERENCES users(id),badge_id TEXT NOT NULL REFERENCES badge_definitions(id),created TEXT NOT NULL,PRIMARY KEY(user_id,badge_id));
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,payload TEXT NOT NULL DEFAULT '{}',read_at TEXT,created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,created);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,actor TEXT,action TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '{}',created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS integration_clients(id TEXT PRIMARY KEY,origin TEXT NOT NULL UNIQUE,contract_version TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS idempotency(user_id TEXT NOT NULL,route TEXT NOT NULL,key TEXT NOT NULL,status INTEGER NOT NULL,response TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(user_id,route,key));
`},
 {id:2,name:'legacy-profiles-copy',up(db,now){
  db.exec(`CREATE TABLE IF NOT EXISTS legacy_profiles(
   id TEXT PRIMARY KEY,body TEXT NOT NULL,owner_hash TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,deleted INTEGER NOT NULL,
   status TEXT NOT NULL DEFAULT 'unclaimed' CHECK(status IN ('unclaimed','claimed')),claimed_by TEXT,claimed_at TEXT,migrated_at TEXT NOT NULL);`);
  // The legacy profiles table is read, never altered.
  db.exec(`CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, body TEXT NOT NULL, owner_hash TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)`);
  db.query(`INSERT OR IGNORE INTO legacy_profiles(id,body,owner_hash,created,updated,deleted,migrated_at) SELECT id,body,owner_hash,created,updated,deleted,? FROM profiles`).run(now);
 }},
 {id:3,name:'help-catalogue-and-reviewers',sql:`
CREATE TABLE IF NOT EXISTS help_offers(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),kind TEXT NOT NULL CHECK(kind IN ('offer','ask')),body TEXT NOT NULL,author TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS help_confirmations(id TEXT PRIMARY KEY,helper_project_id TEXT NOT NULL,recipient_project_id TEXT NOT NULL,requested_by TEXT NOT NULL,confirmed_by TEXT,note TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','declined')),created TEXT NOT NULL,decided_at TEXT);
CREATE TABLE IF NOT EXISTS project_milestones(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),title TEXT NOT NULL,due TEXT,done_at TEXT,author TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS project_metrics(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,value TEXT NOT NULL,measured_on TEXT NOT NULL,author TEXT NOT NULL,visibility TEXT NOT NULL DEFAULT 'team' CHECK(visibility IN ('team','public')),created TEXT NOT NULL);
`},
 {id:4,name:'task-catalogue-and-admin-marking',sql:`
ALTER TABLE task_templates ADD COLUMN completion_mode TEXT NOT NULL DEFAULT 'participant';
ALTER TABLE task_templates ADD COLUMN pick_mode TEXT NOT NULL DEFAULT 'assigned';
CREATE TABLE IF NOT EXISTS form_hooks(id TEXT PRIMARY KEY,secret_hash TEXT NOT NULL UNIQUE,kind TEXT NOT NULL CHECK(kind IN ('task','attendance')),task_id TEXT,lecture_id TEXT,label TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created TEXT NOT NULL,revoked_at TEXT,last_used TEXT);
CREATE TABLE IF NOT EXISTS import_runs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,source TEXT NOT NULL,target TEXT NOT NULL,rows INTEGER NOT NULL,applied INTEGER NOT NULL,created_by TEXT NOT NULL,created TEXT NOT NULL);
`},
 {id:5,name:'checkins-outcomes-announcements',sql:`
CREATE TABLE IF NOT EXISTS checkins(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),week TEXT NOT NULL,metric_name TEXT NOT NULL DEFAULT '',metric_value TEXT NOT NULL DEFAULT '',goal TEXT NOT NULL DEFAULT '',blocker TEXT NOT NULL DEFAULT '',needs_help INTEGER NOT NULL DEFAULT 0,author TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,UNIQUE(project_id,week));
CREATE TABLE IF NOT EXISTS project_outcomes(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),kind TEXT NOT NULL CHECK(kind IN ('funding','hire','company','customer','revenue')),funding_type TEXT NOT NULL DEFAULT '',amount INTEGER,currency TEXT NOT NULL DEFAULT 'EUR',happened_on TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',author TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS announcements(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,pinned INTEGER NOT NULL DEFAULT 0,author TEXT NOT NULL,created TEXT NOT NULL,archived_at TEXT);
CREATE TABLE IF NOT EXISTS announcement_reads(user_id TEXT NOT NULL,announcement_id TEXT NOT NULL,read_at TEXT NOT NULL,PRIMARY KEY(user_id,announcement_id));
`},
 {id:6,name:'cohort-quests',sql:`
CREATE TABLE IF NOT EXISTS cohort_quests(id TEXT PRIMARY KEY,title TEXT NOT NULL,task_id TEXT NOT NULL REFERENCES task_templates(id),target INTEGER NOT NULL,created_by TEXT NOT NULL,created TEXT NOT NULL,closed_at TEXT);
`},
 {id:7,name:'office-hours',sql:`
CREATE TABLE IF NOT EXISTS office_hours(id TEXT PRIMARY KEY,mentor_name TEXT NOT NULL,topic TEXT NOT NULL DEFAULT '',starts_at TEXT NOT NULL,duration_min INTEGER NOT NULL DEFAULT 30,location TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created TEXT NOT NULL,cancelled_at TEXT);
CREATE TABLE IF NOT EXISTS office_hour_bookings(slot_id TEXT PRIMARY KEY REFERENCES office_hours(id),project_id TEXT NOT NULL REFERENCES projects(id),booked_by TEXT NOT NULL,question TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',created TEXT NOT NULL);
`},
 // The production check account created during the 5 Nov verification.
 {id:8,name:'disable-deploy-check-account',sql:`
UPDATE sessions SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE login='bird-deploy-check' AND role='member');
UPDATE users SET status='disabled',updated=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE login='bird-deploy-check' AND role='member';
`},
];
