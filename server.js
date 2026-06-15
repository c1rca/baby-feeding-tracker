import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStateAudit } from './server/auditLog.js'
import { createHealthRouter, createNotificationSettingsRouter, createStateRouter } from './server/apiRoutes.js'
import { openTrackerDatabase, prepareTrackerStatements } from './server/database.js'
import { createEventLogger, redactError } from './server/eventLog.js'
import { createTrackerNotificationScheduler } from './server/notificationRuntime.js'
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
const { selectState, upsertState, getNotificationState, upsertNotificationState, selectSetting, upsertSetting, selectDeletedItems, upsertDeletedItem } = statements
const appendEventLog = createEventLogger(config.eventLogPath)

const readBooleanSetting = (key, fallback) => {
  const row = selectSetting.get(key)
  return row ? row.value === '1' : fallback
}
const writeBooleanSetting = (key, value) => upsertSetting.run({ key, value: value ? '1' : '0', updated_at: new Date().toISOString() })

let gotifyRemindersEnabled = config.notificationChannelsAvailable && readBooleanSetting('gotify_reminders_enabled', config.notificationsDefaultEnabled)
const getGotifyRemindersEnabled = () => gotifyRemindersEnabled
const setGotifyRemindersEnabled = (enabled) => {
  gotifyRemindersEnabled = enabled
}

const notificationScheduler = createTrackerNotificationScheduler({
  config,
  selectState,
  getNotificationState,
  upsertNotificationState,
  gotifyRemindersEnabled,
  appendEventLog,
  redactError,
})

const deletedItemOptions = createDeletedItemOptionsReader(selectDeletedItems)
const recordDeletedItems = createDeletedItemRecorder(upsertDeletedItem)
const { broadcastStateChange, handleStateEvents } = createStateEventHub({ selectState, serializeState })
const createBackupOnStart = createStartupBackup({ db, backupDir: config.backupDir, appendEventLog, redactError })

app.use(express.json({ limit: '1mb' }))

createHealthRouter({ config, getGotifyRemindersEnabled })(app)
createNotificationSettingsRouter({
  config,
  getGotifyRemindersEnabled,
  setGotifyRemindersEnabled,
  writeBooleanSetting,
  appendEventLog,
  notificationScheduler,
})(app)
createStateRouter({
  selectState,
  upsertState,
  serializeState,
  resolveIncomingState,
  deletedItemOptions,
  buildStateAudit,
  recordDeletedItems,
  appendEventLog,
  summarizeState,
  notificationScheduler,
  broadcastStateChange,
  handleStateEvents,
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
