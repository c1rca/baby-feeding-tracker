#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { hashPassword } from '../server/authCrypto.js'
import { DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID, openTrackerDatabase } from '../server/database.js'

// This script destructively rewrites accounts and data. It is a local dev tool
// only: it refuses to run in production, demands an explicit target database and
// an explicit --force, and never falls back to a hardcoded password.
const args = process.argv.slice(2)
const readOption = (name) => {
  const idx = args.indexOf(name)
  return idx !== -1 ? args[idx + 1] : undefined
}

const dbArg = readOption('--db')
const force = args.includes('--force')
const password = readOption('--password') || process.env.DEV_ACCOUNT_PASSWORD || ''
const now = new Date().toISOString()

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the dev data migration with NODE_ENV=production.')
  process.exit(1)
}
if (!dbArg) {
  console.error('Refusing to run without an explicit --db <path>. This script rewrites accounts and data in that database; DB_PATH is intentionally not honored.')
  process.exit(1)
}
if (!force) {
  console.error('Refusing to run without --force. This is a destructive rewrite; pass --force to confirm.')
  process.exit(1)
}
if (!password) {
  console.error('No account password provided. Pass --password <pw> or set DEV_ACCOUNT_PASSWORD.')
  process.exit(1)
}

const dbPath = path.resolve(dbArg)
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`)
  process.exit(1)
}

const db = openTrackerDatabase({
  dbPath,
  dbDir: path.dirname(dbPath),
  backupDir: path.join(path.dirname(dbPath), 'backups'),
})
try {
  db.transaction(() => {
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
        PRIMARY KEY (user_id, household_id)
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
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
        PRIMARY KEY (household_id, baby_id)
      );
      CREATE TABLE IF NOT EXISTS babies (
        id TEXT PRIMARY KEY,
        household_id TEXT NOT NULL,
        name TEXT NOT NULL,
        dob TEXT NOT NULL,
        archived_at TEXT,
        created_at TEXT NOT NULL
      );
    `)

    const passwordHash = hashPassword(password)
    db.prepare('DELETE FROM auth_sessions').run()
    db.prepare('DELETE FROM household_members').run()
    db.prepare("DELETE FROM users WHERE id NOT IN ('dev-mom', 'dev-data')").run()
    db.prepare('INSERT OR IGNORE INTO households (id, name, created_at) VALUES (?, ?, ?)').run(DEFAULT_HOUSEHOLD_ID, 'Ryan household', now)
    db.prepare('UPDATE households SET name = ? WHERE id = ?').run('Ryan household', DEFAULT_HOUSEHOLD_ID)

    for (const account of [
      { id: 'dev-mom', email: 'mom', displayName: 'Mom', role: 'owner' },
      { id: 'dev-data', email: 'data', displayName: 'Data', role: 'owner' },
    ]) {
      db.prepare(`
        INSERT INTO users (id, email, display_name, password_hash, created_at)
        VALUES (@id, @email, @displayName, @passwordHash, @createdAt)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          display_name = excluded.display_name,
          password_hash = excluded.password_hash
      `).run({ ...account, passwordHash, createdAt: now })
      db.prepare(`
        INSERT INTO household_members (user_id, household_id, role, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, household_id) DO UPDATE SET role = excluded.role
      `).run(account.id, DEFAULT_HOUSEHOLD_ID, account.role, now)
    }

    const appState = db.prepare('SELECT household_id, baby_id, baby_dob FROM app_state WHERE id = 1').get()
    const babyDob = appState?.baby_dob || '2026-06-03'
    db.prepare(`
      INSERT INTO babies (id, household_id, name, dob, archived_at, created_at)
      VALUES (?, ?, 'Ryan', ?, NULL, ?)
      ON CONFLICT(id) DO UPDATE SET
        household_id = excluded.household_id,
        name = excluded.name,
        dob = excluded.dob,
        archived_at = NULL
    `).run(DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID, babyDob, now)
    db.prepare('UPDATE babies SET archived_at = ? WHERE id != ? AND household_id = ? AND archived_at IS NULL').run(now, DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID)
    db.prepare('UPDATE app_state SET household_id = ?, baby_id = ?, baby_dob = COALESCE(NULLIF(baby_dob, \'\'), ?) WHERE id = 1').run(DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_ID, babyDob)

    const row = db.prepare('SELECT * FROM app_state WHERE id = 1').get()
    if (row) {
      db.prepare(`
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
      `).run({ ...row, household_id: DEFAULT_HOUSEHOLD_ID, baby_id: DEFAULT_BABY_ID })
    }
  })()

  const summary = {
    users: db.prepare('SELECT email FROM users ORDER BY email').all().map((row) => row.email),
    babies: db.prepare('SELECT name FROM babies WHERE archived_at IS NULL ORDER BY created_at').all().map((row) => row.name),
    entries: JSON.parse(db.prepare('SELECT entries_json FROM app_state WHERE id = 1').get()?.entries_json || '[]').length,
  }
  console.log(JSON.stringify({ ok: true, dbPath, ...summary }, null, 2))
} finally {
  db.close()
}
