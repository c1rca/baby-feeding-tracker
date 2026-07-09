import fs from 'node:fs'
import Database from 'better-sqlite3'

export const DEFAULT_HOUSEHOLD_ID = 'default-household'
export const DEFAULT_BABY_ID = 'default-baby'
export const DEFAULT_USER_ID = 'default-user'
export const DEFAULT_USER_EMAIL = 'local@baby-feeding-tracker.invalid'
export const DEFAULT_USER_DISPLAY_NAME = 'Local caregiver'
export const DEFAULT_HOUSEHOLD_NAME = 'My household'
export const DEFAULT_BABY_NAME = 'Baby'
export const DEFAULT_BABY_DOB = '2026-06-03'

export function openTrackerDatabase({ dbDir, backupDir, logDir, dbPath }) {
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

  const now = new Date().toISOString()
  db.prepare('INSERT OR IGNORE INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)').run(DEFAULT_USER_ID, DEFAULT_USER_EMAIL, DEFAULT_USER_DISPLAY_NAME, now)
  db.prepare('INSERT OR IGNORE INTO households (id, name, created_at) VALUES (?, ?, ?)').run(DEFAULT_HOUSEHOLD_ID, DEFAULT_HOUSEHOLD_NAME, now)
  db.prepare('INSERT OR IGNORE INTO household_members (user_id, household_id, role, created_at) VALUES (?, ?, ?, ?)').run(DEFAULT_USER_ID, DEFAULT_HOUSEHOLD_ID, 'owner', now)
  db.prepare('INSERT OR IGNORE INTO babies (id, household_id, name, dob, created_at) VALUES (?, ?, ?, ?, ?)').run(DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_NAME, DEFAULT_BABY_DOB, now)
  db.prepare('UPDATE app_state SET household_id = COALESCE(NULLIF(household_id, \'\'), ?), baby_id = COALESCE(NULLIF(baby_id, \'\'), ?) WHERE id = 1').run(DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_ID)

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
    upsertSetting: db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `),
    selectDeletedItems: db.prepare('SELECT item_id, collection FROM deleted_items'),
    selectSessionContext: db.prepare(`
      SELECT auth_sessions.user_id, household_members.household_id, household_members.role, babies.id AS baby_id
      FROM auth_sessions
      JOIN household_members ON household_members.user_id = auth_sessions.user_id
      JOIN babies ON babies.household_id = household_members.household_id AND babies.archived_at IS NULL
      WHERE auth_sessions.token_hash = ?
        AND auth_sessions.revoked_at IS NULL
        AND auth_sessions.expires_at > datetime('now')
      ORDER BY babies.created_at ASC
      LIMIT 1
    `),
    upsertDeletedItem: db.prepare(`
      INSERT INTO deleted_items (item_id, collection, deleted_at)
      VALUES (@item_id, @collection, @deleted_at)
      ON CONFLICT(item_id) DO UPDATE SET
        collection = excluded.collection,
        deleted_at = excluded.deleted_at
    `),
  }
}
