import test from 'node:test'
import assert from 'node:assert/strict'
import { createHealthRouter, createNotificationSettingsRouter } from '../server/apiRoutes.js'
import { createFakeApp, createJsonResponse } from './server-test-helpers.mjs'

test('health route reports runtime availability and current reminder enablement', () => {
  const app = createFakeApp()
  createHealthRouter({
    config: {
      dbPath: '/data/app.db',
      notificationChannelsAvailable: true,
      gotifyAvailable: true,
      textEmailAvailable: false,
    },
    getGotifyRemindersEnabled: () => true,
  })(app)

  const res = createJsonResponse()
  app.route('GET', '/api/health')({}, res)

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
  const writes = []
  const events = []
  const schedulerCalls = []
  createNotificationSettingsRouter({
    config: { notificationChannelsAvailable: false },
    getGotifyRemindersEnabled: () => enabled,
    setGotifyRemindersEnabled: (value) => { enabled = value },
    writeBooleanSetting: (key, value) => writes.push({ key, value }),
    appendEventLog: (event, payload) => events.push({ event, payload }),
    notificationScheduler: { setEnabled: (value) => schedulerCalls.push(value) },
  })(app)

  const res = createJsonResponse()
  app.route('PUT', '/api/notification-settings')({ body: { gotifyRemindersEnabled: true } }, res)

  assert.equal(enabled, false)
  assert.deepEqual(writes, [{ key: 'gotify_reminders_enabled', value: false }])
  assert.deepEqual(schedulerCalls, [false])
  assert.deepEqual(events, [{ event: 'settings_update', payload: { key: 'gotify_reminders_enabled', value: '0' } }])
  assert.deepEqual(res.body, { ok: true, available: false, gotifyRemindersEnabled: false })
})
