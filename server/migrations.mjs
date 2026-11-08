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
 // Owner chosen by the site owner on 5 Nov; only an account that existed before this release, only while there is no owner.
 {id:9,name:'owner-maksid',sql:`
UPDATE users SET role='platform_owner',updated=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE login='maksid' AND status='active' AND created<'2026-11-05T09:12:00.000Z' AND NOT EXISTS(SELECT 1 FROM users WHERE role='platform_owner');
UPDATE invites SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE kind='platform_owner' AND used_at IS NULL AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM users WHERE role='platform_owner');
`},
 // Same, for an account registered while release 9 was deploying.
 {id:10,name:'owner-maksid-late',sql:`
UPDATE users SET role='platform_owner',updated=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE login='maksid' AND status='active' AND created<'2026-11-05T09:20:00.000Z' AND NOT EXISTS(SELECT 1 FROM users WHERE role='platform_owner');
UPDATE invites SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE kind='platform_owner' AND used_at IS NULL AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM users WHERE role='platform_owner');
`},
 {id:11,name:'lecture-feedback',sql:`
CREATE TABLE IF NOT EXISTS lecture_feedback(user_id TEXT NOT NULL REFERENCES users(id),lecture_id TEXT NOT NULL REFERENCES lectures(id),score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 10),comment TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(user_id,lecture_id));
`},
 {id:12,name:'mentor-profiles-and-avatars',sql:`
CREATE TABLE IF NOT EXISTS mentors(id TEXT PRIMARY KEY,name TEXT NOT NULL,area TEXT NOT NULL,bio TEXT NOT NULL DEFAULT '',link TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,archived_at TEXT);
ALTER TABLE office_hours ADD COLUMN mentor_id TEXT REFERENCES mentors(id);
CREATE TABLE IF NOT EXISTS user_avatars(user_id TEXT PRIMARY KEY REFERENCES users(id),mime TEXT NOT NULL,bytes BLOB NOT NULL,updated TEXT NOT NULL);
`},
 {id:13,name:'profile-links-and-mentor-look',sql:`
ALTER TABLE users ADD COLUMN linkedin TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN website TEXT NOT NULL DEFAULT '';
ALTER TABLE mentors ADD COLUMN gender TEXT NOT NULL DEFAULT '';
`},
 // Second owner named by the owner on 5 Nov: the single active account with this email, registered before this release.
 {id:14,name:'owner-pavel',sql:`
UPDATE users SET role='platform_owner',updated=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE lower(email)='pavelisajkov@gmail.com' AND status='active' AND created<'2026-11-05T12:58:00.000Z' AND (SELECT count(*) FROM users WHERE lower(email)='pavelisajkov@gmail.com')=1;
UPDATE sessions SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE lower(email)='pavelisajkov@gmail.com' AND role='platform_owner');
`},
 // Areas confirmed from the 26/27 programme brochure and public mentor posts; organiser edits are kept.
 {id:15,name:'mentor-areas',sql:`
UPDATE mentors SET area='Go-to-market',bio=CASE WHEN bio='' THEN 'Positioning & Distribution workshop' ELSE bio END,updated=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='mentor-damir-first' AND area='Mentor speed dating';
UPDATE mentors SET area='AI & Tech',bio=CASE WHEN bio='' THEN 'AI Defensibility & What to Own workshop' ELSE bio END,updated=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='mentor-davor-anicic' AND area='Mentor speed dating';
UPDATE mentors SET area='Pitch',bio=CASE WHEN bio='' THEN 'The Deck: hands-on clinic on your pitch deck' ELSE bio END,updated=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='mentor-lisa-lines' AND area='Mentor speed dating';
UPDATE mentors SET area='Legal & IP',bio=CASE WHEN bio='' THEN 'Intellectual property, digital regulation, legal side of scaling' ELSE bio END,updated=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='mentor-jana-klaric' AND area='Mentor speed dating';
UPDATE mentors SET area='Legal & IP',bio=CASE WHEN bio='' THEN 'Startup law and AI regulation' ELSE bio END,updated=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='mentor-marijana-sarolic-robic' AND area='Mentor speed dating';
UPDATE mentors SET area='General' WHERE id LIKE 'mentor-%' AND area='Mentor speed dating';
`},
 // Organiser tools. People linked to a team by an organiser edit their own team's project.
 {id:16,name:'organiser-tools',sql:`
ALTER TABLE lectures ADD COLUMN time TEXT NOT NULL DEFAULT '';
ALTER TABLE lectures ADD COLUMN place TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS organiser_notes(id TEXT PRIMARY KEY,target_type TEXT NOT NULL CHECK(target_type IN ('team','user')),target_id TEXT NOT NULL,body TEXT NOT NULL,author TEXT NOT NULL,created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS organiser_notes_target ON organiser_notes(target_type,target_id,created);
UPDATE memberships SET role='editor' WHERE role='member' AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM users u JOIN projects p ON p.id=memberships.project_id JOIN team_people t ON t.team_id=p.team_id AND t.person_id=u.person_id WHERE u.id=memberships.user_id);
`}, // Private messages between any two people. Organisers see only messages someone reported.
 {id:17,name:'direct-messages',sql:`
CREATE TABLE IF NOT EXISTS direct_messages(id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES users(id),recipient_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created TEXT NOT NULL,read_at TEXT);
CREATE INDEX IF NOT EXISTS direct_messages_pair ON direct_messages(sender_id,recipient_id,created);
CREATE INDEX IF NOT EXISTS direct_messages_inbox ON direct_messages(recipient_id,read_at);
CREATE TABLE IF NOT EXISTS message_blocks(user_id TEXT NOT NULL REFERENCES users(id),blocked_id TEXT NOT NULL REFERENCES users(id),created TEXT NOT NULL,PRIMARY KEY(user_id,blocked_id));
CREATE TABLE IF NOT EXISTS message_reports(id TEXT PRIMARY KEY,message_id TEXT NOT NULL REFERENCES direct_messages(id),reporter_id TEXT NOT NULL REFERENCES users(id),created TEXT NOT NULL,resolved_at TEXT,resolved_by TEXT,UNIQUE(message_id,reporter_id));
`}, // Points become a team currency: mentor sessions and organiser rewards cost points. Bookings made before stay free.
 {id:18,name:'team-wallet',sql:`
ALTER TABLE office_hours ADD COLUMN price INTEGER NOT NULL DEFAULT 30;
ALTER TABLE office_hour_bookings ADD COLUMN cost INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS rewards(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',price INTEGER NOT NULL CHECK(price>=0),stock INTEGER,created_by TEXT NOT NULL,created TEXT NOT NULL,archived_at TEXT);
CREATE TABLE IF NOT EXISTS reward_orders(id TEXT PRIMARY KEY,reward_id TEXT NOT NULL REFERENCES rewards(id),project_id TEXT NOT NULL REFERENCES projects(id),ordered_by TEXT NOT NULL REFERENCES users(id),price INTEGER NOT NULL,note TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),decided_by TEXT,decided_at TEXT,created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS reward_orders_project ON reward_orders(project_id,status);
`}, // Files in messages, group chats (a team chat follows the team's members), email preferences (stored; sending comes later).
 {id:19,name:'group-chats-files-email',sql:`
ALTER TABLE direct_messages ADD COLUMN file_id TEXT REFERENCES files(id);
CREATE TABLE IF NOT EXISTS chat_groups(id TEXT PRIMARY KEY,title TEXT NOT NULL,project_id TEXT UNIQUE REFERENCES projects(id),created_by TEXT NOT NULL REFERENCES users(id),created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_members(group_id TEXT NOT NULL REFERENCES chat_groups(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),joined TEXT NOT NULL,left_at TEXT,last_read INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(group_id,user_id));
CREATE INDEX IF NOT EXISTS chat_members_user ON chat_members(user_id,left_at);
CREATE TABLE IF NOT EXISTS chat_messages(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,group_id TEXT NOT NULL REFERENCES chat_groups(id),sender_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,file_id TEXT REFERENCES files(id),created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS chat_messages_group ON chat_messages(group_id,seq);
CREATE TABLE IF NOT EXISTS chat_reports(id TEXT PRIMARY KEY,message_id TEXT NOT NULL REFERENCES chat_messages(id),reporter_id TEXT NOT NULL REFERENCES users(id),created TEXT NOT NULL,resolved_at TEXT,resolved_by TEXT,UNIQUE(message_id,reporter_id));
ALTER TABLE users ADD COLUMN email_messages INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN email_reminders INTEGER NOT NULL DEFAULT 0;
`}, // A team asks for a mentor meeting when no free slot fits; the price is held until an organiser arranges or declines it.
 {id:20,name:'meeting-requests',sql:`
CREATE TABLE IF NOT EXISTS meeting_requests(id TEXT PRIMARY KEY,mentor_id TEXT REFERENCES mentors(id),project_id TEXT NOT NULL REFERENCES projects(id),requested_by TEXT NOT NULL REFERENCES users(id),topic TEXT NOT NULL,times TEXT NOT NULL DEFAULT '',price INTEGER NOT NULL CHECK(price>=0),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','arranged','declined','withdrawn')),slot_id TEXT REFERENCES office_hours(id),decided_by TEXT,decided_at TEXT,created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS meeting_requests_project ON meeting_requests(project_id,status);
`},
];
