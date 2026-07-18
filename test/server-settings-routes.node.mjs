import test from 'node:test'
import assert from 'node:assert/strict'
import { createDiagnosticsRouter, createHealthRouter, createNotificationSettingsRouter } from '../server/apiRoutes.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

test('public health route reports readiness without leaking configuration', () => {
  const app = createFakeApp()
  createHealthRouter({ checkDatabaseReady: () => true })(app)

  const res = createJsonResponse()
  app.route('GET', '/api/health')({}, res)

  assert.deepEqual(res.body, { ok: true })
})

test('public health route can be backed by scoped baby_state readiness without touching legacy app_state', () => {
  const app = createFakeApp()
  let scopedReadCount = 0
  createHealthRouter({ checkDatabaseReady: () => { scopedReadCount += 1; return true } })(app)

  const res = createJsonResponse()
  app.route('GET', '/api/health')({}, res)

  assert.equal(scopedReadCount, 1)
  assert.deepEqual(res.body, { ok: true })
})

test('public health route reports 503 when the database is not readable', () => {
  const app = createFakeApp()
  createHealthRouter({ checkDatabaseReady: () => false })(app)

  const res = createJsonResponse()
  app.route('GET', '/api/health')({}, res)

  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { ok: false })
})

test('authenticated diagnostics route reports runtime availability and reminder enablement', () => {
  const app = createFakeApp()
  createDiagnosticsRouter({
    config: {
      dbPath: '/data/app.db',
      notificationChannelsAvailable: true,
      gotifyAvailable: true,
      textEmailAvailable: false,
    },
    getGotifyRemindersEnabled: () => true,
  })(app)

  const res = createJsonResponse()
  app.route('GET', '/api/diagnostics')({}, res)

  assert.deepEqual(res.body, {
    ok: true,
    dbPath: '/data/app.db',
    notificationsAvailable: true,
    gotifyAvailable: true,
    textEmailAvailable: false,
    gotifyRemindersEnabled: true,
  })
})

test('notification settings route clamps disabled channels and persists the resulting setting', () => {
  const app = createFakeApp()
  let enabled = true
  let medicineReminderSettings = { tylenol: 6, motrin: 6 }
  const writes = []
  const events = []
  const schedulerCalls = []
  createNotificationSettingsRouter({
    config: { notificationChannelsAvailable: false },
    getGotifyRemindersEnabled: () => enabled,
    setGotifyRemindersEnabled: (value) => { enabled = value },
    getMedicineReminderSettings: () => medicineReminderSettings,
    setMedicineReminderSettings: (value) => { medicineReminderSettings = value },
    getNotificationPreferences: () => ({}),
    writeBooleanSetting: (key, value) => writes.push({ key, value }),
    writeJsonSetting: (key, value) => writes.push({ key, value }),
    appendEventLog: (event, payload) => events.push({ event, payload }),
    notificationScheduler: { setEnabled: (value) => schedulerCalls.push(value), evaluate: () => schedulerCalls.push('evaluate') },
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/notification-settings')({ auth: { role: 'owner' }, body: { gotifyRemindersEnabled: true } }, res)

  assert.equal(enabled, false)
  assert.deepEqual(writes, [{ key: 'gotify_reminders_enabled', value: false }])
  assert.deepEqual(schedulerCalls, [false])
  assert.deepEqual(events, [{ event: 'settings_update', payload: { key: 'gotify_reminders_enabled', value: '0' } }])
  assert.deepEqual(res.body, { ok: true, available: false, gotifyRemindersEnabled: false, medicineReminderSettings: { tylenol: 6, motrin: 6 }, notificationPreferences: {} })
})

test('notification settings route persists per-kind medicine reminder intervals', () => {
  const app = createFakeApp()
  let medicineReminderSettings = { tylenol: 6, motrin: 6 }
  const writes = []
  const events = []
  const schedulerCalls = []
  createNotificationSettingsRouter({
    config: { notificationChannelsAvailable: true },
    getGotifyRemindersEnabled: () => true,
    setGotifyRemindersEnabled: () => {},
    getMedicineReminderSettings: () => medicineReminderSettings,
    setMedicineReminderSettings: (value) => { medicineReminderSettings = value },
    getNotificationPreferences: () => ({}),
    writeBooleanSetting: () => {},
    writeJsonSetting: (key, value) => writes.push({ key, value }),
    appendEventLog: (event, payload) => events.push({ event, payload }),
    notificationScheduler: { setEnabled: () => {}, evaluate: () => schedulerCalls.push('evaluate') },
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/notification-settings')({ auth: { role: 'owner' }, body: { medicineReminderSettings: { tylenol: 4, motrin: 0 } } }, res)

  assert.deepEqual(medicineReminderSettings, { tylenol: 4, motrin: 0 })
  assert.deepEqual(writes, [{ key: 'medicine_reminder_settings', value: { tylenol: 4, motrin: 0 } }])
  assert.deepEqual(schedulerCalls, ['evaluate'])
  assert.deepEqual(events, [{ event: 'settings_update', payload: { key: 'medicine_reminder_settings', value: { tylenol: 4, motrin: 0 } } }])
  assert.deepEqual(res.body, { ok: true, available: true, gotifyRemindersEnabled: true, medicineReminderSettings: { tylenol: 4, motrin: 0 }, notificationPreferences: {} })
})

test('notification settings are isolated by household', () => {
  const app = createFakeApp()
  const settings = new Map([
    ['house-a', { gotifyRemindersEnabled: true, medicineReminderSettings: { tylenol: 6, motrin: 6 }, notificationPreferences: { household: 'a' } }],
    ['house-b', { gotifyRemindersEnabled: false, medicineReminderSettings: { tylenol: 4, motrin: 0 }, notificationPreferences: { household: 'b' } }],
  ])
  createNotificationSettingsRouter({
    config: { notificationChannelsAvailable: true },
    getHouseholdNotificationSettings: (householdId) => settings.get(householdId),
    setHouseholdNotificationSettings: (householdId, next) => settings.set(householdId, next),
    appendEventLog: () => {},
    notificationScheduler: { evaluate: () => {} },
  })(app)

  const getA = createJsonResponse()
  app.route('GET', '/api/notification-settings')({ auth: { role: 'owner', householdId: 'house-a' } }, getA)
  assert.equal(getA.body.notificationPreferences.household, 'a')

  const putB = createJsonResponse()
  app.route('PUT', '/api/notification-settings')({ auth: { role: 'owner', householdId: 'house-b' }, body: { medicineReminderSettings: { tylenol: 6, motrin: 4 } } }, putB)
  assert.deepEqual(settings.get('house-b').medicineReminderSettings, { tylenol: 6, motrin: 4 })
  assert.deepEqual(settings.get('house-a').medicineReminderSettings, { tylenol: 6, motrin: 6 })
})

test('notification settings mutation is rejected for non-owner members and changes nothing', () => {
  const app = createFakeApp()
  let enabled = true
  const writes = []
  createNotificationSettingsRouter({
    config: { notificationChannelsAvailable: true },
    getGotifyRemindersEnabled: () => enabled,
    setGotifyRemindersEnabled: (value) => { enabled = value },
    getMedicineReminderSettings: () => ({ tylenol: 6, motrin: 6 }),
    setMedicineReminderSettings: () => {},
    writeBooleanSetting: (key, value) => writes.push({ key, value }),
    writeJsonSetting: (key, value) => writes.push({ key, value }),
    appendEventLog: () => {},
    notificationScheduler: { setEnabled: () => {}, evaluate: () => {} },
  })(app)

  for (const role of ['viewer', 'caregiver']) {
    const res = createJsonResponse()
    app.route('PUT', '/api/notification-settings')({ auth: { role }, body: { gotifyRemindersEnabled: false } }, res)
    assert.equal(res.statusCode, 403, `${role} should be forbidden`)
  }
  assert.equal(enabled, true)
  assert.deepEqual(writes, [])
})
