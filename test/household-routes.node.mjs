import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHouseholdRouter } from '../server/apiRoutes.js'
import { openTrackerDatabase, prepareTrackerStatements } from '../server/database.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

function mountRouter(deps) {
  const app = createFakeApp()
  createHouseholdRouter(deps)(app)
  return app
}

const sessionAuth = (overrides = {}) => ({ userId: 'user-1', householdId: null, babyId: null, role: null, mode: 'session', ...overrides })

test('creating a household provisions household, owner membership, and first baby', () => {
  const calls = { households: [], events: [] }
  const ids = ['household-new', 'baby-new']
  let idIndex = 0
  const app = mountRouter({
    selectMembershipsByUser: { all: () => [] },
    createHousehold: (payload) => calls.households.push(payload),
    appendEventLog: (event, payload) => calls.events.push({ event, payload }),
    idFactory: () => ids[idIndex++],
    now: () => new Date('2026-07-09T00:00:00.000Z'),
  })
  const res = createJsonResponse()

  app.route('POST', '/api/households')({ auth: sessionAuth(), body: { householdName: 'Ours', babyName: 'Ryan', babyDob: '2026-06-03' } }, res)

  assert.equal(res.statusCode, 201)
  assert.deepEqual(res.body.household, { id: 'household-new', name: 'Ours' })
  assert.deepEqual(res.body.baby, { id: 'baby-new', householdId: 'household-new', name: 'Ryan', dob: '2026-06-03' })
  assert.equal(calls.households.length, 1)
  assert.deepEqual(calls.households[0], { userId: 'user-1', householdId: 'household-new', householdName: 'Ours', babyId: 'baby-new', babyName: 'Ryan', babyDob: '2026-06-03', createdAt: '2026-07-09T00:00:00.000Z' })
  assert.deepEqual(calls.events, [{ event: 'household_create', payload: { householdId: 'household-new', babyId: 'baby-new', userId: 'user-1' } }])
})

test('a user already in a household cannot create another (beta single-household rule)', () => {
  const calls = { households: [] }
  const app = mountRouter({
    selectMembershipsByUser: { all: () => [{ household_id: 'existing', role: 'owner' }] },
    createHousehold: (payload) => calls.households.push(payload),
  })
  const res = createJsonResponse()

  app.route('POST', '/api/households')({ auth: sessionAuth({ householdId: 'existing' }), body: { babyName: 'Ryan', babyDob: '2026-06-03' } }, res)

  assert.equal(res.statusCode, 409)
  assert.deepEqual(res.body, { ok: false, error: 'already_in_household' })
  assert.equal(calls.households.length, 0)
})

test('creating a household validates baby name and dob', () => {
  const app = mountRouter({ selectMembershipsByUser: { all: () => [] }, createHousehold: () => {} })

  const missingName = createJsonResponse()
  app.route('POST', '/api/households')({ auth: sessionAuth(), body: { babyDob: '2026-06-03' } }, missingName)
  assert.equal(missingName.statusCode, 400)

  const badDob = createJsonResponse()
  app.route('POST', '/api/households')({ auth: sessionAuth(), body: { babyName: 'Ryan', babyDob: 'June' } }, badDob)
  assert.equal(badDob.statusCode, 400)
})

test('a non-session (local) context cannot create a household', () => {
  const app = mountRouter({ selectMembershipsByUser: { all: () => [] }, createHousehold: () => {} })
  const res = createJsonResponse()
  app.route('POST', '/api/households')({ auth: { userId: 'default-user', householdId: 'default-household', mode: 'local' }, body: { babyName: 'Ryan', babyDob: '2026-06-03' } }, res)
  assert.equal(res.statusCode, 403)
})

test('the real household transaction writes household, owner membership, baby, and empty state', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-household-'))
  const db = openTrackerDatabase({ dbDir: path.join(tmp, 'data'), backupDir: path.join(tmp, 'backups'), logDir: path.join(tmp, 'logs'), dbPath: path.join(tmp, 'data', 'feeding-tracker.db') })
  const { insertHousehold, insertHouseholdMember, insertBaby, insertEmptyBabyState, selectMembershipsByUser, selectBabyForHousehold, selectStateForBaby } = prepareTrackerStatements(db)
  // Seed a signed-in user with no membership yet.
  db.prepare('INSERT INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)').run('user-2', 'new@example.com', 'New', '2026-07-09T00:00:00.000Z')

  const createHousehold = db.transaction(({ userId, householdId, householdName, babyId, babyName, babyDob, createdAt }) => {
    insertHousehold.run({ id: householdId, name: householdName, created_at: createdAt })
    insertHouseholdMember.run({ user_id: userId, household_id: householdId, role: 'owner', created_at: createdAt })
    insertBaby.run({ id: babyId, household_id: householdId, name: babyName, dob: babyDob, archived_at: null, created_at: createdAt })
    insertEmptyBabyState.run({ household_id: householdId, baby_id: babyId, updated_at: createdAt })
  })
  createHousehold({ userId: 'user-2', householdId: 'hh-2', householdName: 'Twos', babyId: 'baby-2', babyName: 'Sam', babyDob: '2026-05-01', createdAt: '2026-07-09T00:00:00.000Z' })

  const memberships = selectMembershipsByUser.all('user-2')
  const baby = selectBabyForHousehold.get('baby-2', 'hh-2')
  const state = selectStateForBaby.get('hh-2', 'baby-2')
  db.close()

  assert.deepEqual(memberships, [{ household_id: 'hh-2', role: 'owner' }])
  assert.equal(baby.name, 'Sam')
  assert.equal(state.entries_json, '[]')
})
