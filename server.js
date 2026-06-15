import express from 'express'
import nodemailer from 'nodemailer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createNotificationScheduler, sendGotifyMessage } from './server/notifications.js'
import { buildStateAudit } from './server/auditLog.js'
import { resolveIncomingState } from './server/stateMerge.js'
import { openTrackerDatabase, prepareTrackerStatements } from './server/database.js'
import { createEventLogger, redactError } from './server/eventLog.js'
import { createRuntimeConfig } from './server/runtimeConfig.js'
import { createDeletedItemOptionsReader, createDeletedItemRecorder, serializeState, summarizeState } from './server/stateStore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const stateClients = new Set()
const config = createRuntimeConfig({ rootDir: __dirname })
const db = openTrackerDatabase(config)
const statements = prepareTrackerStatements(db)
const { selectState, upsertState, getNotificationState, upsertNotificationState, selectSetting, upsertSetting, selectDeletedItems, upsertDeletedItem } = statements
const appendEventLog = createEventLogger(config.eventLogPath)

const sendStateEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

const broadcastStateChange = (payload) => {
  for (const res of stateClients) sendStateEvent(res, 'state', payload)
}

const deletedItemOptions = createDeletedItemOptionsReader(selectDeletedItems)
const recordDeletedItems = createDeletedItemRecorder(upsertDeletedItem)

const createStartupBackup = async () => {
  if (process.env.BACKUP_ON_START !== '1') return null
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-')
  const backupPath = path.join(config.backupDir, `feeding-tracker-startup-${timestamp}.db`)
  try {
    await db.backup(backupPath)
    const size = fs.statSync(backupPath).size
    appendEventLog('backup_created', { backupPath, size, reason: 'startup' })
    console.log(`startup backup created: ${backupPath} (${size} bytes)`)
    return backupPath
  } catch (error) {
    appendEventLog('backup_failed', { reason: 'startup', error: redactError(error) })
    console.warn('startup backup failed', error)
    return null
  }
}

const readBooleanSetting = (key, fallback) => {
  const row = selectSetting.get(key)
  return row ? row.value === '1' : fallback
}
const writeBooleanSetting = (key, value) => upsertSetting.run({ key, value: value ? '1' : '0', updated_at: new Date().toISOString() })
let gotifyRemindersEnabled = config.notificationChannelsAvailable && readBooleanSetting('gotify_reminders_enabled', config.notificationsDefaultEnabled)

const smtpTransporter = config.textEmailAvailable
  ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPassword },
    })
  : null

const sendTextEmailMessage = smtpTransporter
  ? async ({ subject, title, message }) => {
      await smtpTransporter.sendMail({
        from: config.textEmailFrom,
        to: config.textEmailTo,
        subject: subject || title || 'Feedr reminder',
        text: message,
      })
    }
  : null

const notificationScheduler = config.notificationChannelsAvailable
  ? createNotificationScheduler({
      selectState,
      getNotificationState,
      upsertNotificationState,
      sendGotify: config.gotifyAvailable
        ? async (payload) => {
            appendEventLog('gotify_send_attempt', { title: payload.title, message: payload.message, priority: payload.priority })
            try {
              await sendGotifyMessage({ url: config.gotifyUrl, token: config.gotifyToken, ...payload })
              appendEventLog('gotify_send_success', { title: payload.title, message: payload.message, priority: payload.priority })
            } catch (error) {
              appendEventLog('gotify_send_failed', { title: payload.title, message: payload.message, priority: payload.priority, error: redactError(error) })
              throw error
            }
          }
        : null,
      sendTextEmail: sendTextEmailMessage
        ? async (payload) => {
            appendEventLog('text_email_send_attempt', { subject: payload.subject || payload.title, to: config.textEmailTo })
            try {
              await sendTextEmailMessage(payload)
              appendEventLog('text_email_send_success', { subject: payload.subject || payload.title, to: config.textEmailTo })
            } catch (error) {
              appendEventLog('text_email_send_failed', { subject: payload.subject || payload.title, to: config.textEmailTo, error: redactError(error) })
              throw error
            }
          }
        : null,
      enabled: gotifyRemindersEnabled,
    })
  : null

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbPath: config.dbPath, notificationsAvailable: config.notificationChannelsAvailable, gotifyAvailable: config.gotifyAvailable, textEmailAvailable: config.textEmailAvailable, gotifyRemindersEnabled })
})

app.get('/api/notification-settings', (_req, res) => {
  res.json({ available: config.notificationChannelsAvailable, gotifyRemindersEnabled })
})

app.put('/api/notification-settings', (req, res) => {
  const enabled = Boolean(req.body?.gotifyRemindersEnabled) && config.notificationChannelsAvailable
  gotifyRemindersEnabled = enabled
  writeBooleanSetting('gotify_reminders_enabled', enabled)
  appendEventLog('settings_update', { key: 'gotify_reminders_enabled', value: enabled ? '1' : '0' })
  notificationScheduler?.setEnabled(enabled)
  res.json({ ok: true, available: config.notificationChannelsAvailable, gotifyRemindersEnabled })
})

app.get('/api/state', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(serializeState(selectState.get()))
})

app.get('/api/state/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.flushHeaders?.()
  stateClients.add(res)
  sendStateEvent(res, 'state', serializeState(selectState.get()))
  const heartbeat = setInterval(() => sendStateEvent(res, 'ping', { at: new Date().toISOString() }), 25000)
  req.on('close', () => {
    clearInterval(heartbeat)
    stateClients.delete(res)
    res.end()
  })
})

app.put('/api/state', (req, res) => {
  const existingRow = selectState.get()
  const incoming = resolveIncomingState(existingRow, {
    entries: Array.isArray(req.body?.entries) ? req.body.entries : [],
    diapers: Array.isArray(req.body?.diapers) ? req.body.diapers : [],
    medicines: Array.isArray(req.body?.medicines) ? req.body.medicines : [],
    session: req.body?.session ?? null,
    theme: req.body?.theme === 'dark' ? 'dark' : 'light',
    updatedAt: req.body?.updatedAt,
  }, deletedItemOptions())
  const { entries, diapers, medicines, session, theme } = incoming
  const updatedAt = new Date().toISOString()

  upsertState.run({
    entries_json: JSON.stringify(entries),
    diapers_json: JSON.stringify(diapers),
    medicines_json: JSON.stringify(medicines),
    session_json: session ? JSON.stringify(session) : null,
    theme,
    updated_at: updatedAt,
  })

  const audit = buildStateAudit(existingRow, { entries, diapers, medicines, session, theme }, {
    staleWriteMerged: incoming.stale,
    clientUpdatedAt: req.body?.updatedAt,
    nextUpdatedAt: updatedAt,
  })
  recordDeletedItems(audit, updatedAt)
  appendEventLog('state_write_audit', audit)
  appendEventLog('state_replace', { ...summarizeState(entries, session, theme, diapers, medicines), staleWriteMerged: incoming.stale, entries, diapers, medicines, session })
  notificationScheduler?.evaluate()

  const responseState = { entries, diapers, medicines, session, theme, updatedAt }
  broadcastStateChange(responseState)
  res.json({ ok: true, updatedAt, staleWriteMerged: incoming.stale, state: responseState })
})

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
  void createStartupBackup()
  const startupRow = selectState.get()
  if (startupRow) {
    try {
      const entries = JSON.parse(startupRow.entries_json)
      const diapers = JSON.parse(startupRow.diapers_json || '[]')
      const medicines = JSON.parse(startupRow.medicines_json || '[]')
      const session = startupRow.session_json ? JSON.parse(startupRow.session_json) : null
      appendEventLog('startup_state_snapshot', { ...summarizeState(entries, session, startupRow.theme || 'light', diapers, medicines), entries, diapers, medicines, session })
    } catch (error) {
      appendEventLog('startup_state_snapshot_failed', { error: redactError(error) })
    }
  }
  if (config.notificationChannelsAvailable) {
    notificationScheduler.evaluate()
    console.log(`reminders ${gotifyRemindersEnabled ? 'enabled' : 'disabled'}: gotify=${config.gotifyAvailable ? config.gotifyUrl : 'off'}, textEmail=${config.textEmailAvailable ? 'on' : 'off'}`)
  }
})
