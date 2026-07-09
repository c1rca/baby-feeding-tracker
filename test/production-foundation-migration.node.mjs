import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { openTrackerDatabase, prepareTrackerStatements } from '../server/database.js'
import { serializeState } from '../server/stateStore.js'

const DEFAULT_HOUSEHOLD_ID = 'default-household'
const DEFAULT_BABY_ID = 'default-baby'

function makeLegacyDb(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new Database(filePath)
  db.exec(`
    CREATE TABLE app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      entries_json TEXT NOT NULL,
      session_json TEXT,
      theme TEXT NOT NULL DEFAULT 'light',
      updated_at TEXT NOT NULL
    );
  `)
  db.prepare(`
    INSERT INTO app_state (id, entries_json, session_json, theme, updated_at)
    VALUES (1, ?, ?, 'dark', 'legacy-updated')
  `).run(JSON.stringify([{ id: 'feed-1', startedAt: 1, endedAt: 2, type: 'bottle', bottleOunces: 2 }]), JSON.stringify({ id: 'session-1', startedAt: 3 }))
  db.close()
}

test('legacy single-family app_state migrates into the default household and baby without losing data', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-prod-foundation-'))
  const dbPath = path.join(tmp, 'data', 'feeding-tracker.db')
  makeLegacyDb(dbPath)

  const db = openTrackerDatabase({
    dbDir: path.dirname(dbPath),
    backupDir: path.join(tmp, 'backups'),
    logDir: path.join(tmp, 'logs'),
    dbPath,
  })

  const household = db.prepare('SELECT id, name FROM households WHERE id = ?').get(DEFAULT_HOUSEHOLD_ID)
  const baby = db.prepare('SELECT id, household_id, name, dob FROM babies WHERE id = ?').get(DEFAULT_BABY_ID)
  const stateRow = db.prepare('SELECT household_id, baby_id, entries_json, session_json, theme, updated_at FROM app_state WHERE id = 1').get()
  db.close()

  assert.deepEqual(household, { id: DEFAULT_HOUSEHOLD_ID, name: 'My household' })
  assert.deepEqual(baby, { id: DEFAULT_BABY_ID, household_id: DEFAULT_HOUSEHOLD_ID, name: 'Baby', dob: '2026-06-03' })
  assert.equal(stateRow.household_id, DEFAULT_HOUSEHOLD_ID)
  assert.equal(stateRow.baby_id, DEFAULT_BABY_ID)
  assert.match(stateRow.entries_json, /feed-1/)
  assert.match(stateRow.session_json, /session-1/)
  assert.equal(stateRow.theme, 'dark')
  assert.equal(stateRow.updated_at, 'legacy-updated')
})

test('prepared state statement remains backwards-compatible and reads the default baby state', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-prod-foundation-read-'))
  const dbPath = path.join(tmp, 'data', 'feeding-tracker.db')
  makeLegacyDb(dbPath)

  const db = openTrackerDatabase({
    dbDir: path.dirname(dbPath),
    backupDir: path.join(tmp, 'backups'),
    logDir: path.join(tmp, 'logs'),
    dbPath,
  })
  const statements = prepareTrackerStatements(db)
  const state = serializeState(statements.selectState.get())
  db.close()

  assert.deepEqual(state.entries.map((entry) => entry.id), ['feed-1'])
  assert.equal(state.session.id, 'session-1')
  assert.equal(state.babyDob, '2026-06-03')
  assert.equal(state.theme, 'dark')
  assert.equal(state.householdId, DEFAULT_HOUSEHOLD_ID)
  assert.equal(state.babyId, DEFAULT_BABY_ID)
})
