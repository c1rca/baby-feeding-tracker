import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { createStateRouter } from '../server/apiRoutes.js'
import { openTrackerDatabase, prepareTrackerStatements, DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID } from '../server/database.js'
import { serializeState } from '../server/stateStore.js'
import { resolveIncomingState } from '../server/stateMerge.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

const openScratchDb = (prefix, seedLegacy = true) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  const dbPath = path.join(tmp, 'data', 'feeding-tracker.db')
  if (seedLegacy) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    const legacy = new Database(dbPath)
    legacy.exec(`
      CREATE TABLE app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        entries_json TEXT NOT NULL,
        session_json TEXT,
        theme TEXT NOT NULL DEFAULT 'light',
        updated_at TEXT NOT NULL
      );
    `)
    legacy.prepare("INSERT INTO app_state (id, entries_json, session_json, theme, updated_at) VALUES (1, ?, NULL, 'dark', 'legacy-updated')")
      .run(JSON.stringify([{ id: 'feed-legacy', startedAt: 1, endedAt: 2, type: 'bottle', bottleOunces: 2 }]))
    legacy.close()
  }
  return openTrackerDatabase({
    dbDir: path.dirname(dbPath),
    backupDir: path.join(tmp, 'backups'),
    logDir: path.join(tmp, 'logs'),
    dbPath,
  })
}

const seedSecondHousehold = (db) => {
  const now = new Date().toISOString()
  db.prepare('INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)').run('household-2', 'Second household', now)
  db.prepare('INSERT INTO babies (id, household_id, name, dob, created_at) VALUES (?, ?, ?, ?, ?)').run('baby-2', 'household-2', 'Second baby', '2026-01-01', now)
}

const buildScopedRouter = (statements) => {
  const app = createFakeApp()
  createStateRouter({
    selectState: statements.selectState,
    upsertState: statements.upsertState,
    selectStateForBaby: statements.selectStateForBaby,
    upsertStateForBaby: statements.upsertStateForBaby,
    selectBabyForHousehold: statements.selectBabyForHousehold,
    serializeState,
    resolveIncomingState,
    deletedItemOptions: () => ({}),
    buildStateAudit: () => ({}),
    recordDeletedItems: () => {},
    appendEventLog: () => {},
    summarizeState: () => ({}),
    notificationScheduler: { evaluate: () => {} },
    broadcastStateChange: () => {},
    handleStateEvents: () => {},
  })(app)
  return app
}

const putBody = (overrides = {}) => ({
  entries: [],
  diapers: [],
  medicines: [],
  tummyTimes: [],
  growthMeasurements: [],
  session: null,
  tummySession: null,
  tummyGoalMinutes: 20,
  babyDob: '2026-06-03',
  theme: 'light',
  ...overrides,
})

test('startup migrates the legacy app_state row into a scoped baby_state row without losing data', () => {
  const db = openScratchDb('feeding-scoped-migrate-')
  const scoped = db.prepare('SELECT household_id, baby_id, entries_json, theme, updated_at FROM baby_state WHERE household_id = ? AND baby_id = ?').get(DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_ID)
  db.close()

  assert.ok(scoped, 'expected a scoped baby_state row for the default household and baby')
  assert.match(scoped.entries_json, /feed-legacy/)
  assert.equal(scoped.theme, 'dark')
  assert.equal(scoped.updated_at, 'legacy-updated')
})

test('reopening the database never overwrites newer scoped state with the legacy row', () => {
  const dbFirst = openScratchDb('feeding-scoped-reopen-')
  const dbPath = dbFirst.name
  dbFirst.prepare("UPDATE baby_state SET entries_json = ?, updated_at = 'scoped-newer' WHERE household_id = ? AND baby_id = ?")
    .run(JSON.stringify([{ id: 'feed-newer' }]), DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_ID)
  dbFirst.close()

  const reopened = openTrackerDatabase({
    dbDir: path.dirname(dbPath),
    backupDir: path.join(path.dirname(path.dirname(dbPath)), 'backups'),
    logDir: path.join(path.dirname(path.dirname(dbPath)), 'logs'),
    dbPath,
  })
  const scoped = reopened.prepare('SELECT entries_json, updated_at FROM baby_state WHERE household_id = ? AND baby_id = ?').get(DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_ID)
  reopened.close()

  assert.match(scoped.entries_json, /feed-newer/)
  assert.equal(scoped.updated_at, 'scoped-newer')
})

test('GET /api/state returns only the authenticated scope and never another household state', () => {
  const db = openScratchDb('feeding-scoped-get-')
  seedSecondHousehold(db)
  const app = buildScopedRouter(prepareTrackerStatements(db))

  const defaultRes = createJsonResponse()
  app.route('GET', '/api/state')({ auth: { householdId: DEFAULT_HOUSEHOLD_ID, babyId: DEFAULT_BABY_ID } }, defaultRes)
  assert.deepEqual(defaultRes.body.entries.map((entry) => entry.id), ['feed-legacy'])
  assert.equal(defaultRes.body.householdId, DEFAULT_HOUSEHOLD_ID)

  const secondRes = createJsonResponse()
  app.route('GET', '/api/state')({ auth: { householdId: 'household-2', babyId: 'baby-2' } }, secondRes)
  db.close()

  assert.deepEqual(secondRes.body.entries, [])
  assert.equal(secondRes.body.householdId, 'household-2')
  assert.equal(secondRes.body.babyId, 'baby-2')
})

test('GET /api/state rejects babies outside the authenticated household', () => {
  const db = openScratchDb('feeding-scoped-get-guard-')
  seedSecondHousehold(db)
  const app = buildScopedRouter(prepareTrackerStatements(db))

  const res = createJsonResponse()
  app.route('GET', '/api/state')({ auth: { householdId: DEFAULT_HOUSEHOLD_ID, babyId: 'baby-2' } }, res)
  db.close()

  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.body, { ok: false, error: 'Baby not found' })
})

test('PUT /api/state writes scoped rows without leaking into other babies', () => {
  const db = openScratchDb('feeding-scoped-put-')
  seedSecondHousehold(db)
  const app = buildScopedRouter(prepareTrackerStatements(db))

  const writeRes = createJsonResponse()
  app.route('PUT', '/api/state')({
    auth: { householdId: 'household-2', babyId: 'baby-2' },
    body: putBody({ entries: [{ id: 'feed-second', startedAt: 10, endedAt: 20, type: 'bottle', bottleOunces: 3 }], theme: 'dark' }),
  }, writeRes)
  assert.equal(writeRes.body.ok, true)

  const secondRes = createJsonResponse()
  app.route('GET', '/api/state')({ auth: { householdId: 'household-2', babyId: 'baby-2' } }, secondRes)
  const defaultRes = createJsonResponse()
  app.route('GET', '/api/state')({ auth: { householdId: DEFAULT_HOUSEHOLD_ID, babyId: DEFAULT_BABY_ID } }, defaultRes)
  db.close()

  assert.deepEqual(secondRes.body.entries.map((entry) => entry.id), ['feed-second'])
  assert.deepEqual(defaultRes.body.entries.map((entry) => entry.id), ['feed-legacy'])
})

test('PUT /api/state for the default scope dual-writes the legacy app_state row for rollback compatibility', () => {
  const db = openScratchDb('feeding-scoped-dualwrite-')
  const app = buildScopedRouter(prepareTrackerStatements(db))

  const writeRes = createJsonResponse()
  app.route('PUT', '/api/state')({
    auth: { householdId: DEFAULT_HOUSEHOLD_ID, babyId: DEFAULT_BABY_ID },
    body: putBody({ entries: [{ id: 'feed-legacy', startedAt: 1, endedAt: 2, type: 'bottle', bottleOunces: 2 }, { id: 'feed-new', startedAt: 30, endedAt: 40, type: 'bottle', bottleOunces: 4 }], theme: 'dark' }),
  }, writeRes)
  assert.equal(writeRes.body.ok, true)

  const legacyRow = db.prepare('SELECT entries_json, updated_at FROM app_state WHERE id = 1').get()
  const scopedRow = db.prepare('SELECT entries_json, updated_at FROM baby_state WHERE household_id = ? AND baby_id = ?').get(DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_ID)
  db.close()

  assert.match(legacyRow.entries_json, /feed-new/)
  assert.equal(legacyRow.updated_at, scopedRow.updated_at)
  assert.match(scopedRow.entries_json, /feed-new/)
})

test('PUT /api/state for a non-default scope leaves the legacy app_state row untouched', () => {
  const db = openScratchDb('feeding-scoped-nolegacy-')
  seedSecondHousehold(db)
  const app = buildScopedRouter(prepareTrackerStatements(db))

  const writeRes = createJsonResponse()
  app.route('PUT', '/api/state')({
    auth: { householdId: 'household-2', babyId: 'baby-2' },
    body: putBody({ entries: [{ id: 'feed-second', startedAt: 10, endedAt: 20, type: 'bottle', bottleOunces: 3 }] }),
  }, writeRes)
  assert.equal(writeRes.body.ok, true)

  const legacyRow = db.prepare('SELECT entries_json, updated_at FROM app_state WHERE id = 1').get()
  db.close()

  assert.doesNotMatch(legacyRow.entries_json, /feed-second/)
  assert.equal(legacyRow.updated_at, 'legacy-updated')
})
