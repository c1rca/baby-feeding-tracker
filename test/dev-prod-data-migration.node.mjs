import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { verifyPassword } from '../server/auth.js'
import { openTrackerDatabase } from '../server/database.js'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)

test('dev prod-data migration creates mom/data accounts and moves legacy data under Ryan', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-dev-migrate-'))
  const dbPath = path.join(tmp, 'feeding-tracker-dev.db')
  const db = openTrackerDatabase({ dbDir: tmp, backupDir: path.join(tmp, 'backups'), logDir: path.join(tmp, 'logs'), dbPath })
  db.prepare(`
    INSERT INTO app_state (id, household_id, baby_id, entries_json, session_json, theme, diapers_json, medicines_json, tummy_times_json, tummy_session_json, growth_measurements_json, baby_dob, tummy_goal_minutes, updated_at)
    VALUES (1, 'default-household', 'default-baby', ?, NULL, 'dark', '[]', '[]', '[]', NULL, '[]', '2026-06-01', 20, ?)
  `).run(JSON.stringify([{ id: 'prod-feed-1', type: 'bottle', bottleOunces: 4 }]), new Date().toISOString())
  db.close()

  const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'migrate-dev-prod-data.mjs'), '--db', dbPath, '--force', '--password', '1'], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'development' },
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  const migrated = new Database(dbPath)
  const users = migrated.prepare('SELECT id, email, password_hash FROM users ORDER BY email').all()
  const babies = migrated.prepare('SELECT id, household_id, name, dob, archived_at FROM babies WHERE archived_at IS NULL').all()
  const appState = migrated.prepare('SELECT household_id, baby_id, entries_json, theme FROM app_state WHERE id = 1').get()
  const scopedState = migrated.prepare('SELECT entries_json, theme FROM baby_state WHERE household_id = ? AND baby_id = ?').get(appState.household_id, appState.baby_id)
  migrated.close()

  assert.deepEqual(users.map((user) => user.email), ['data', 'mom'])
  assert.equal(users.every((user) => verifyPassword('1', user.password_hash)), true)
  assert.deepEqual(babies, [{ id: 'default-baby', household_id: 'default-household', name: 'Ryan', dob: '2026-06-01', archived_at: null }])
  assert.match(appState.entries_json, /prod-feed-1/)
  assert.equal(scopedState.theme, 'dark')
  assert.match(scopedState.entries_json, /prod-feed-1/)
})

test('dev prod-data migration refuses to run without the required safety flags', () => {
  const script = path.join(rootDir, 'scripts', 'migrate-dev-prod-data.mjs')
  const run = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { cwd: rootDir, env: { ...process.env, NODE_ENV: 'development', ...env }, encoding: 'utf8' })

  // Missing --db, missing --force, and missing password are each fatal.
  assert.notEqual(run(['--force', '--password', '1']).status, 0)
  assert.notEqual(run(['--db', '/tmp/whatever.db', '--password', '1']).status, 0)
  assert.notEqual(run(['--db', '/tmp/whatever.db', '--force'], { DEV_ACCOUNT_PASSWORD: '' }).status, 0)
  // Production is refused outright even with every flag present.
  assert.notEqual(run(['--db', '/tmp/whatever.db', '--force', '--password', '1'], { NODE_ENV: 'production' }).status, 0)
})
