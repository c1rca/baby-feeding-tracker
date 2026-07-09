import fs from 'node:fs'
import Database from 'better-sqlite3'
import { hashPassword } from './authCrypto.js'

export const DEFAULT_HOUSEHOLD_ID = 'default-household'
export const DEFAULT_BABY_ID = 'default-baby'
export const DEFAULT_USER_ID = 'default-user'
export const DEFAULT_USER_EMAIL = 'local@baby-feeding-tracker.invalid'
export const DEFAULT_USER_DISPLAY_NAME = 'Local caregiver'
export const DEFAULT_HOUSEHOLD_NAME = 'My household'
export const DEFAULT_BABY_NAME = 'Baby'
export const DEFAULT_BABY_DOB = '2026-06-03'

export function openTrackerDatabase({ dbDir, backupDir, logDir, dbPath, bootstrapPassword = '' }) {
  fs.mkdirSync(dbDir, { recursive: true })
  fs.mkdirSync(backupDir, { recursive: true })
  fs.mkdirSync(logDir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS household_members (
      user_id TEXT NOT NULL,
      household_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'caregiver', 'viewer')),
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, household_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS auth_login_codes (
      code_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS babies (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      dob TEXT NOT NULL,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      household_id TEXT NOT NULL DEFAULT 'default-household',
      baby_id TEXT NOT NULL DEFAULT 'default-baby',
      entries_json TEXT NOT NULL,
      session_json TEXT,
      theme TEXT NOT NULL DEFAULT 'light',
      diapers_json TEXT NOT NULL DEFAULT '[]',
      medicines_json TEXT NOT NULL DEFAULT '[]',
      tummy_times_json TEXT NOT NULL DEFAULT '[]',
      tummy_session_json TEXT,
      growth_measurements_json TEXT NOT NULL DEFAULT '[]',
      baby_dob TEXT NOT NULL DEFAULT '2026-06-03',
      tummy_goal_minutes INTEGER NOT NULL DEFAULT 20,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS baby_state (
      household_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      entries_json TEXT NOT NULL,
      diapers_json TEXT NOT NULL DEFAULT '[]',
      medicines_json TEXT NOT NULL DEFAULT '[]',
      tummy_times_json TEXT NOT NULL DEFAULT '[]',
      tummy_session_json TEXT,
      tummy_goal_minutes INTEGER NOT NULL DEFAULT 20,
      growth_measurements_json TEXT NOT NULL DEFAULT '[]',
      baby_dob TEXT NOT NULL DEFAULT '2026-06-03',
      session_json TEXT,
      theme TEXT NOT NULL DEFAULT 'light',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (household_id, baby_id),
      FOREIGN KEY (household_id) REFERENCES households(id),
      FOREIGN KEY (baby_id) REFERENCES babies(id)
    );

    CREATE TABLE IF NOT EXISTS notification_state (
      entry_id TEXT PRIMARY KEY,
      due_at TEXT NOT NULL,
      sent_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deleted_items (
      item_id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      household_id TEXT NOT NULL DEFAULT 'default-household',
      baby_id TEXT NOT NULL DEFAULT 'default-baby',
      deleted_at TEXT NOT NULL
    );
  `)

  const hasHouseholdColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'household_id'").get().count > 0
  if (!hasHouseholdColumn) db.exec("ALTER TABLE app_state ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default-household'")
  const hasBabyIdColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'baby_id'").get().count > 0
  if (!hasBabyIdColumn) db.exec("ALTER TABLE app_state ADD COLUMN baby_id TEXT NOT NULL DEFAULT 'default-baby'")
  const hasDiapersColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'diapers_json'").get().count > 0
  if (!hasDiapersColumn) db.exec("ALTER TABLE app_state ADD COLUMN diapers_json TEXT NOT NULL DEFAULT '[]'")
  const hasMedicinesColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'medicines_json'").get().count > 0
  if (!hasMedicinesColumn) db.exec("ALTER TABLE app_state ADD COLUMN medicines_json TEXT NOT NULL DEFAULT '[]'")
  const hasTummyTimesColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'tummy_times_json'").get().count > 0
  if (!hasTummyTimesColumn) db.exec("ALTER TABLE app_state ADD COLUMN tummy_times_json TEXT NOT NULL DEFAULT '[]'")
  const hasTummySessionColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'tummy_session_json'").get().count > 0
  if (!hasTummySessionColumn) db.exec("ALTER TABLE app_state ADD COLUMN tummy_session_json TEXT")
  const hasGrowthMeasurementsColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'growth_measurements_json'").get().count > 0
  if (!hasGrowthMeasurementsColumn) db.exec("ALTER TABLE app_state ADD COLUMN growth_measurements_json TEXT NOT NULL DEFAULT '[]'")
  const hasBabyDobColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'baby_dob'").get().count > 0
  if (!hasBabyDobColumn) db.exec("ALTER TABLE app_state ADD COLUMN baby_dob TEXT NOT NULL DEFAULT '2026-06-03'")
  const hasTummyGoalColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'tummy_goal_minutes'").get().count > 0
  if (!hasTummyGoalColumn) db.exec("ALTER TABLE app_state ADD COLUMN tummy_goal_minutes INTEGER NOT NULL DEFAULT 20")
  const hasGoogleSubColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('users') WHERE name = 'google_sub'").get().count > 0
  if (!hasGoogleSubColumn) db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL')
  // Tombstones are per-tenant: the DEFAULT clause backfills pre-scoping rows to
  // the default household/baby so a legacy delete list keeps suppressing exactly
  // the records it did before, and never leaks across households.
  const hasDeletedHouseholdColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('deleted_items') WHERE name = 'household_id'").get().count > 0
  if (!hasDeletedHouseholdColumn) db.exec("ALTER TABLE deleted_items ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default-household'")
  const hasDeletedBabyColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('deleted_items') WHERE name = 'baby_id'").get().count > 0
  if (!hasDeletedBabyColumn) db.exec("ALTER TABLE deleted_items ADD COLUMN baby_id TEXT NOT NULL DEFAULT 'default-baby'")

  const now = new Date().toISOString()
  db.prepare('INSERT OR IGNORE INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)').run(DEFAULT_USER_ID, DEFAULT_USER_EMAIL, DEFAULT_USER_DISPLAY_NAME, now)
  const password = String(bootstrapPassword || '').trim()
  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND password_hash IS NULL').run(hashPassword(password), DEFAULT_USER_ID)
  }
  db.prepare('INSERT OR IGNORE INTO households (id, name, created_at) VALUES (?, ?, ?)').run(DEFAULT_HOUSEHOLD_ID, DEFAULT_HOUSEHOLD_NAME, now)
  db.prepare('INSERT OR IGNORE INTO household_members (user_id, household_id, role, created_at) VALUES (?, ?, ?, ?)').run(DEFAULT_USER_ID, DEFAULT_HOUSEHOLD_ID, 'owner', now)
  db.prepare('INSERT OR IGNORE INTO babies (id, household_id, name, dob, created_at) VALUES (?, ?, ?, ?, ?)').run(DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_NAME, DEFAULT_BABY_DOB, now)
  db.prepare('UPDATE app_state SET household_id = COALESCE(NULLIF(household_id, \'\'), ?), baby_id = COALESCE(NULLIF(baby_id, \'\'), ?) WHERE id = 1').run(DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_ID)

  // Copy the legacy single-row state into its scoped row exactly once; later
  // writes land in baby_state directly, so an existing scoped row always wins.
  db.exec(`
    INSERT OR IGNORE INTO baby_state (household_id, baby_id, entries_json, diapers_json, medicines_json, tummy_times_json, tummy_session_json, tummy_goal_minutes, growth_measurements_json, baby_dob, session_json, theme, updated_at)
    SELECT household_id, baby_id, entries_json, diapers_json, medicines_json, tummy_times_json, tummy_session_json, tummy_goal_minutes, growth_measurements_json, baby_dob, session_json, theme, updated_at
    FROM app_state WHERE id = 1
  `)

  return db
}

export function prepareTrackerStatements(db) {
  return {
    selectState: db.prepare('SELECT household_id, baby_id, entries_json, diapers_json, medicines_json, tummy_times_json, tummy_session_json, tummy_goal_minutes, growth_measurements_json, baby_dob, session_json, theme, updated_at FROM app_state WHERE id = 1'),
    upsertState: db.prepare(`
      INSERT INTO app_state (id, household_id, baby_id, entries_json, diapers_json, medicines_json, tummy_times_json, tummy_session_json, tummy_goal_minutes, growth_measurements_json, baby_dob, session_json, theme, updated_at)
      VALUES (1, @household_id, @baby_id, @entries_json, @diapers_json, @medicines_json, @tummy_times_json, @tummy_session_json, @tummy_goal_minutes, @growth_measurements_json, @baby_dob, @session_json, @theme, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        household_id = excluded.household_id,
        baby_id = excluded.baby_id,
        entries_json = excluded.entries_json,
        diapers_json = excluded.diapers_json,
        medicines_json = excluded.medicines_json,
        tummy_times_json = excluded.tummy_times_json,
        tummy_session_json = excluded.tummy_session_json,
        tummy_goal_minutes = excluded.tummy_goal_minutes,
        growth_measurements_json = excluded.growth_measurements_json,
        baby_dob = excluded.baby_dob,
        session_json = excluded.session_json,
        theme = excluded.theme,
        updated_at = excluded.updated_at
    `),
    selectStateForBaby: db.prepare('SELECT household_id, baby_id, entries_json, diapers_json, medicines_json, tummy_times_json, tummy_session_json, tummy_goal_minutes, growth_measurements_json, baby_dob, session_json, theme, updated_at FROM baby_state WHERE household_id = ? AND baby_id = ?'),
    upsertStateForBaby: db.prepare(`
      INSERT INTO baby_state (household_id, baby_id, entries_json, diapers_json, medicines_json, tummy_times_json, tummy_session_json, tummy_goal_minutes, growth_measurements_json, baby_dob, session_json, theme, updated_at)
      VALUES (@household_id, @baby_id, @entries_json, @diapers_json, @medicines_json, @tummy_times_json, @tummy_session_json, @tummy_goal_minutes, @growth_measurements_json, @baby_dob, @session_json, @theme, @updated_at)
      ON CONFLICT(household_id, baby_id) DO UPDATE SET
        entries_json = excluded.entries_json,
        diapers_json = excluded.diapers_json,
        medicines_json = excluded.medicines_json,
        tummy_times_json = excluded.tummy_times_json,
        tummy_session_json = excluded.tummy_session_json,
        tummy_goal_minutes = excluded.tummy_goal_minutes,
        growth_measurements_json = excluded.growth_measurements_json,
        baby_dob = excluded.baby_dob,
        session_json = excluded.session_json,
        theme = excluded.theme,
        updated_at = excluded.updated_at
    `),
    getNotificationState: db.prepare('SELECT entry_id, due_at, sent_at, updated_at FROM notification_state WHERE entry_id = ?'),
    upsertNotificationState: db.prepare(`
      INSERT INTO notification_state (entry_id, due_at, sent_at, updated_at)
      VALUES (@entry_id, @due_at, @sent_at, @updated_at)
      ON CONFLICT(entry_id) DO UPDATE SET
        due_at = excluded.due_at,
        sent_at = COALESCE(notification_state.sent_at, excluded.sent_at),
        updated_at = excluded.updated_at
    `),
    selectSetting: db.prepare('SELECT value FROM app_settings WHERE key = ?'),
    selectUserByEmail: db.prepare('SELECT id, email, display_name, password_hash, google_sub FROM users WHERE email = ?'),
    selectUserByGoogleSub: db.prepare('SELECT id, email, display_name, password_hash, google_sub FROM users WHERE google_sub = ?'),
    upsertGoogleUser: db.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, google_sub, created_at)
      VALUES (@id, @email, @display_name, NULL, @google_sub, @created_at)
      ON CONFLICT(email) DO UPDATE SET google_sub = excluded.google_sub, display_name = excluded.display_name
    `),
    upsertGoogleHouseholdMember: db.prepare(`
      INSERT INTO household_members (user_id, household_id, role, created_at)
      VALUES (@user_id, @household_id, @role, @created_at)
      ON CONFLICT(user_id, household_id) DO UPDATE SET role = household_members.role
    `),
    selectUserById: db.prepare('SELECT id, email, display_name, password_hash, google_sub FROM users WHERE id = ?'),
    updateUserPassword: db.prepare('UPDATE users SET password_hash = @password_hash WHERE id = @user_id'),
    selectBabiesByHousehold: db.prepare('SELECT id, household_id, name, dob, archived_at FROM babies WHERE household_id = ? AND archived_at IS NULL ORDER BY created_at ASC'),
    selectBabyForHousehold: db.prepare('SELECT id, household_id, name, dob, archived_at FROM babies WHERE id = ? AND household_id = ? AND archived_at IS NULL'),
    insertBaby: db.prepare(`
      INSERT INTO babies (id, household_id, name, dob, archived_at, created_at)
      VALUES (@id, @household_id, @name, @dob, @archived_at, @created_at)
    `),
    archiveBaby: db.prepare(`
      UPDATE babies
      SET archived_at = @archived_at
      WHERE id = @id AND household_id = @household_id AND archived_at IS NULL
    `),
    insertSession: db.prepare(`
      INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at, revoked_at)
      VALUES (@id, @user_id, @token_hash, @created_at, @expires_at, @revoked_at)
    `),
    insertLoginCode: db.prepare(`
      INSERT INTO auth_login_codes (code_hash, user_id, created_at, expires_at, consumed_at)
      VALUES (@code_hash, @user_id, @created_at, @expires_at, NULL)
    `),
    selectLoginCode: db.prepare('SELECT code_hash, user_id, created_at, expires_at, consumed_at FROM auth_login_codes WHERE code_hash = ?'),
    consumeLoginCode: db.prepare(`
      UPDATE auth_login_codes
      SET consumed_at = @consumed_at
      WHERE code_hash = @code_hash AND consumed_at IS NULL
    `),
    revokeSession: db.prepare(`
      UPDATE auth_sessions
      SET revoked_at = @revoked_at
      WHERE token_hash = @token_hash AND revoked_at IS NULL
    `),
    revokeOtherUserSessions: db.prepare(`
      UPDATE auth_sessions
      SET revoked_at = @revoked_at
      WHERE user_id = @user_id AND token_hash != @token_hash AND revoked_at IS NULL
    `),
    upsertSetting: db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `),
    selectDeletedItems: db.prepare('SELECT item_id, collection FROM deleted_items WHERE household_id = ? AND baby_id = ?'),
    // LEFT JOINs so a valid session still resolves when the user has no
    // membership yet (needs onboarding) or a household has zero babies — both
    // return a row with NULL household/baby instead of a hard 401.
    selectSessionContext: db.prepare(`
      SELECT auth_sessions.user_id, household_members.household_id, household_members.role, babies.id AS baby_id
      FROM auth_sessions
      LEFT JOIN household_members ON household_members.user_id = auth_sessions.user_id
      LEFT JOIN babies ON babies.household_id = household_members.household_id AND babies.archived_at IS NULL
      WHERE auth_sessions.token_hash = ?
        AND auth_sessions.revoked_at IS NULL
        AND auth_sessions.expires_at > datetime('now')
      ORDER BY babies.created_at ASC
      LIMIT 1
    `),
    selectMembershipsByUser: db.prepare('SELECT household_id, role FROM household_members WHERE user_id = ? ORDER BY created_at ASC'),
    upsertDeletedItem: db.prepare(`
      INSERT INTO deleted_items (item_id, collection, household_id, baby_id, deleted_at)
      VALUES (@item_id, @collection, @household_id, @baby_id, @deleted_at)
      ON CONFLICT(item_id) DO UPDATE SET
        collection = excluded.collection,
        household_id = excluded.household_id,
        baby_id = excluded.baby_id,
        deleted_at = excluded.deleted_at
    `),
  }
}
