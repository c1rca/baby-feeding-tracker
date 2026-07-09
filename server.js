import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAuthMiddleware, createAuthRouter, createAuthSessionRouter } from './server/auth.js'
import { buildStateAudit } from './server/auditLog.js'
import { createDiagnosticsRouter, createHealthRouter, createNotificationSettingsRouter, createStateRouter, createBabyRouter } from './server/apiRoutes.js'
import { openTrackerDatabase, prepareTrackerStatements, DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID } from './server/database.js'
import { createEventLogger, redactError } from './server/eventLog.js'
import { createTrackerNotificationScheduler } from './server/notificationRuntime.js'
import { normalizeMedicineReminderSettings } from './server/notificationModels.js'
import { createRuntimeConfig } from './server/runtimeConfig.js'
import { createDeletedItemOptionsReader, createDeletedItemRecorder, serializeState, summarizeState } from './server/stateStore.js'
import { createStateEventHub } from './server/stateEvents.js'
import { resolveIncomingState } from './server/stateMerge.js'
import { appendStartupStateSnapshot, createStartupBackup } from './server/startup.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const config = createRuntimeConfig({ rootDir: __dirname })
const db = openTrackerDatabase(config)
const statements = prepareTrackerStatements(db)
const { selectState, upsertState, selectStateForBaby, upsertStateForBaby, getNotificationState, upsertNotificationState, selectSetting, upsertSetting, selectDeletedItems, upsertDeletedItem, selectSessionContext, selectUserByEmail, selectUserById, updateUserPassword, selectBabiesByHousehold, selectBabyForHousehold, insertBaby, archiveBaby, insertSession, revokeSession, revokeOtherUserSessions } = statements
const appendEventLog = createEventLogger(config.eventLogPath)

const readBooleanSetting = (key, fallback) => {
  const row = selectSetting.get(key)
  return row ? row.value === '1' : fallback
}
const writeBooleanSetting = (key, value) => upsertSetting.run({ key, value: value ? '1' : '0', updated_at: new Date().toISOString() })
const readJsonSetting = (key, fallback) => {
  const row = selectSetting.get(key)
  if (!row) return fallback
  try {
    return JSON.parse(row.value)
  } catch {
    return fallback
  }
}
const writeJsonSetting = (key, value) => upsertSetting.run({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() })

let gotifyRemindersEnabled = config.notificationChannelsAvailable && readBooleanSetting('gotify_reminders_enabled', config.notificationsDefaultEnabled)
let medicineReminderSettings = normalizeMedicineReminderSettings(readJsonSetting('medicine_reminder_settings', { tylenol: 6, motrin: 6 }))
const getGotifyRemindersEnabled = () => gotifyRemindersEnabled
const setGotifyRemindersEnabled = (enabled) => {
  gotifyRemindersEnabled = enabled
}
const getMedicineReminderSettings = () => medicineReminderSettings
const setMedicineReminderSettings = (settings) => {
  medicineReminderSettings = normalizeMedicineReminderSettings(settings)
}

const notificationScheduler = createTrackerNotificationScheduler({
  config,
  selectState,
  getNotificationState,
  upsertNotificationState,
  gotifyRemindersEnabled,
  getMedicineReminderSettings,
  appendEventLog,
  redactError,
})

const deletedItemOptions = createDeletedItemOptionsReader(selectDeletedItems)
const recordDeletedItems = createDeletedItemRecorder(upsertDeletedItem)
const writeStateAndDeletedItems = db.transaction((statePayload, audit, updatedAt) => {
  upsertStateForBaby.run(statePayload)
  // The legacy single row keeps mirroring the default baby so pre-scoping
  // builds (and a prod rollback) still read current data.
  if (statePayload.household_id === DEFAULT_HOUSEHOLD_ID && statePayload.baby_id === DEFAULT_BABY_ID) upsertState.run(statePayload)
  recordDeletedItems(audit, updatedAt)
})
const { broadcastStateChange, handleStateEvents } = createStateEventHub({ selectState, selectStateForBaby, serializeState })
const createBackupOnStart = createStartupBackup({ db, backupDir: config.backupDir, appendEventLog, redactError })

const checkDatabaseReady = () => {
  try {
    selectState.get()
    return true
  } catch {
    return false
  }
}

app.use(express.json({ limit: '1mb' }))
createHealthRouter({ checkDatabaseReady })(app)
createAuthRouter({ authRequired: config.authRequired, selectUserByEmail, insertSession, appendEventLog })(app)
app.use('/api', createAuthMiddleware({ authRequired: config.authRequired, selectSessionContext, selectBabyForHousehold }))
createAuthSessionRouter({ revokeSession, revokeOtherUserSessions, selectUserById, updateUserPassword, appendEventLog })(app)
createBabyRouter({ selectBabiesByHousehold, insertBaby, archiveBaby, appendEventLog })(app)

createDiagnosticsRouter({ config, getGotifyRemindersEnabled })(app)
createNotificationSettingsRouter({
  config,
  getGotifyRemindersEnabled,
  setGotifyRemindersEnabled,
  getMedicineReminderSettings,
  setMedicineReminderSettings,
  writeBooleanSetting,
  writeJsonSetting,
  appendEventLog,
  notificationScheduler,
})(app)
createStateRouter({
  selectState,
  upsertState,
  selectStateForBaby,
  upsertStateForBaby,
  serializeState,
  resolveIncomingState,
  deletedItemOptions,
  buildStateAudit,
  writeStateAndDeletedItems,
  appendEventLog,
  summarizeState,
  notificationScheduler,
  broadcastStateChange,
  handleStateEvents,
  selectBabyForHousehold,
})(app)

const distPath = path.join(__dirname, 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(config.port, () => {
  console.log(`feeding-tracker server listening on :${config.port}`)
  console.log(`sqlite db: ${config.dbPath}`)
  void createBackupOnStart()
  appendStartupStateSnapshot({ selectState, appendEventLog, summarizeState, redactError })
  if (config.notificationChannelsAvailable) {
    notificationScheduler.evaluate()
    console.log(`reminders ${gotifyRemindersEnabled ? 'enabled' : 'disabled'}: gotify=${config.gotifyAvailable ? config.gotifyUrl : 'off'}, textEmail=${config.textEmailAvailable ? 'on' : 'off'}`)
  }
})
