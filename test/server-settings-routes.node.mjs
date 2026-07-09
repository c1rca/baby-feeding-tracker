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
    writeBooleanSetting: (key, value) => writes.push({ key, value }),
    writeJsonSetting: (key, value) => writes.push({ key, value }),
    appendEventLog: (event, payload) => events.push({ event, payload }),
    notificationScheduler: { setEnabled: (value) => schedulerCalls.push(value), evaluate: () => schedulerCalls.push('evaluate') },
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/notification-settings')({ body: { gotifyRemindersEnabled: true } }, res)

  assert.equal(enabled, false)
  assert.deepEqual(writes, [{ key: 'gotify_reminders_enabled', value: false }])
  assert.deepEqual(schedulerCalls, [false])
  assert.deepEqual(events, [{ event: 'settings_update', payload: { key: 'gotify_reminders_enabled', value: '0' } }])
  assert.deepEqual(res.body, { ok: true, available: false, gotifyRemindersEnabled: false, medicineReminderSettings: { tylenol: 6, motrin: 6 } })
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
    writeBooleanSetting: () => {},
    writeJsonSetting: (key, value) => writes.push({ key, value }),
    appendEventLog: (event, payload) => events.push({ event, payload }),
    notificationScheduler: { setEnabled: () => {}, evaluate: () => schedulerCalls.push('evaluate') },
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/notification-settings')({ body: { medicineReminderSettings: { tylenol: 4, motrin: 0 } } }, res)

  assert.deepEqual(medicineReminderSettings, { tylenol: 4, motrin: 0 })
  assert.deepEqual(writes, [{ key: 'medicine_reminder_settings', value: { tylenol: 4, motrin: 0 } }])
  assert.deepEqual(schedulerCalls, ['evaluate'])
  assert.deepEqual(events, [{ event: 'settings_update', payload: { key: 'medicine_reminder_settings', value: { tylenol: 4, motrin: 0 } } }])
  assert.deepEqual(res.body, { ok: true, available: true, gotifyRemindersEnabled: true, medicineReminderSettings: { tylenol: 4, motrin: 0 } })
})
