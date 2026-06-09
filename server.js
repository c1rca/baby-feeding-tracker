import express from 'express'
import Database from 'better-sqlite3'
import nodemailer from 'nodemailer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createNotificationScheduler, normalizeTextEmailRecipients, sendGotifyMessage } from './server/notifications.js'
import { resolveIncomingState } from './server/stateMerge.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const stateClients = new Set()
const port = Number(process.env.PORT || 8080)
const dbDir = process.env.DB_DIR || path.join(__dirname, 'data')
const dbPath = process.env.DB_PATH || path.join(dbDir, 'feeding-tracker.db')
const backupDir = process.env.BACKUP_DIR || path.join(dbDir, 'backups')
const logDir = process.env.LOG_DIR || path.join(dbDir, 'logs')
const eventLogPath = path.join(logDir, 'feeding-tracker-events.jsonl')
const gotifyUrl = process.env.GOTIFY_URL || ''
const gotifyToken = process.env.GOTIFY_TOKEN || ''
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
const smtpPort = Number(process.env.SMTP_PORT || 465)
const smtpUser = process.env.SMTP_USER || ''
const smtpPassword = process.env.SMTP_PASSWORD || ''
const textEmailTo = normalizeTextEmailRecipients(process.env.TEXT_EMAIL_TO)
const textEmailFrom = process.env.TEXT_EMAIL_FROM || smtpUser
const textEmailAvailable = Boolean(smtpUser && smtpPassword && textEmailTo.length > 0 && textEmailFrom)
const notificationsAvailable = Boolean(gotifyUrl && gotifyToken)
const notificationChannelsAvailable = notificationsAvailable || textEmailAvailable
const notificationsDefaultEnabled = process.env.NOTIFICATIONS_ENABLED === '1' && notificationChannelsAvailable

fs.mkdirSync(dbDir, { recursive: true })
fs.mkdirSync(backupDir, { recursive: true })
fs.mkdirSync(logDir, { recursive: true })
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    entries_json TEXT NOT NULL,
    session_json TEXT,
    theme TEXT NOT NULL DEFAULT 'light',
    diapers_json TEXT NOT NULL DEFAULT '[]',
    medicines_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_state (
    entry_id TEXT PRIMARY KEY,
    due_at TEXT NOT NULL,
    sent_at TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

const hasDiapersColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'diapers_json'").get().count > 0
if (!hasDiapersColumn) db.exec("ALTER TABLE app_state ADD COLUMN diapers_json TEXT NOT NULL DEFAULT '[]'")
const hasMedicinesColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'medicines_json'").get().count > 0
if (!hasMedicinesColumn) db.exec("ALTER TABLE app_state ADD COLUMN medicines_json TEXT NOT NULL DEFAULT '[]'")

const selectState = db.prepare('SELECT entries_json, diapers_json, medicines_json, session_json, theme, updated_at FROM app_state WHERE id = 1')
const upsertState = db.prepare(`
  INSERT INTO app_state (id, entries_json, diapers_json, medicines_json, session_json, theme, updated_at)
  VALUES (1, @entries_json, @diapers_json, @medicines_json, @session_json, @theme, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    entries_json = excluded.entries_json,
    diapers_json = excluded.diapers_json,
    medicines_json = excluded.medicines_json,
    session_json = excluded.session_json,
    theme = excluded.theme,
    updated_at = excluded.updated_at
`)
const getNotificationState = db.prepare('SELECT entry_id, due_at, sent_at, updated_at FROM notification_state WHERE entry_id = ?')
const upsertNotificationState = db.prepare(`
  INSERT INTO notification_state (entry_id, due_at, sent_at, updated_at)
  VALUES (@entry_id, @due_at, @sent_at, @updated_at)
  ON CONFLICT(entry_id) DO UPDATE SET
    due_at = excluded.due_at,
    sent_at = COALESCE(notification_state.sent_at, excluded.sent_at),
    updated_at = excluded.updated_at
`)
const selectSetting = db.prepare('SELECT value FROM app_settings WHERE key = ?')
const upsertSetting = db.prepare(`
  INSERT INTO app_settings (key, value, updated_at)
  VALUES (@key, @value, @updated_at)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`)

const redactError = (error) => ({
  name: error?.name ?? 'Error',
  message: error?.message ?? String(error),
})

const appendEventLog = (event, payload = {}) => {
  const record = { at: new Date().toISOString(), event, ...payload }
  try {
    fs.appendFileSync(eventLogPath, `${JSON.stringify(record)}\n`, { encoding: 'utf8' })
  } catch (error) {
    console.warn('event log write failed', redactError(error))
  }
}

const serializeState = (row) => {
  if (!row) return { entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: null }
  return {
    entries: JSON.parse(row.entries_json),
    diapers: JSON.parse(row.diapers_json || '[]'),
    medicines: JSON.parse(row.medicines_json || '[]'),
    session: row.session_json ? JSON.parse(row.session_json) : null,
    theme: row.theme || 'light',
    updatedAt: row.updated_at,
  }
}

const sendStateEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

const broadcastStateChange = (payload) => {
  for (const res of stateClients) sendStateEvent(res, 'state', payload)
}

const summarizeState = (entries, session, theme, diapers = [], medicines = []) => ({
  entryCount: entries.length,
  diaperCount: diapers.length,
  medicineCount: medicines.length,
  latestEntryId: entries[0]?.id ?? null,
  latestEndedAt: entries[0]?.endedAt ?? null,
  hasSession: Boolean(session),
  sessionStartedAt: session?.startedAt ?? null,
  theme,
})

const createStartupBackup = async () => {
  if (process.env.BACKUP_ON_START !== '1') return null
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-')
  const backupPath = path.join(backupDir, `feeding-tracker-startup-${timestamp}.db`)
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
let gotifyRemindersEnabled = notificationChannelsAvailable && readBooleanSetting('gotify_reminders_enabled', notificationsDefaultEnabled)

const smtpTransporter = textEmailAvailable
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPassword },
    })
  : null

const sendTextEmailMessage = smtpTransporter
  ? async ({ subject, title, message }) => {
      await smtpTransporter.sendMail({
        from: textEmailFrom,
        to: textEmailTo,
        subject: subject || title || 'Feedr reminder',
        text: message,
      })
    }
  : null

const notificationScheduler = notificationChannelsAvailable
  ? createNotificationScheduler({
      selectState,
      getNotificationState,
      upsertNotificationState,
      sendGotify: notificationsAvailable
        ? async (payload) => {
            appendEventLog('gotify_send_attempt', { title: payload.title, message: payload.message, priority: payload.priority })
            try {
              await sendGotifyMessage({ url: gotifyUrl, token: gotifyToken, ...payload })
              appendEventLog('gotify_send_success', { title: payload.title, message: payload.message, priority: payload.priority })
            } catch (error) {
              appendEventLog('gotify_send_failed', { title: payload.title, message: payload.message, priority: payload.priority, error: redactError(error) })
              throw error
            }
          }
        : null,
      sendTextEmail: sendTextEmailMessage
        ? async (payload) => {
            appendEventLog('text_email_send_attempt', { subject: payload.subject || payload.title, to: textEmailTo })
            try {
              await sendTextEmailMessage(payload)
              appendEventLog('text_email_send_success', { subject: payload.subject || payload.title, to: textEmailTo })
            } catch (error) {
              appendEventLog('text_email_send_failed', { subject: payload.subject || payload.title, to: textEmailTo, error: redactError(error) })
              throw error
            }
          }
        : null,
      enabled: gotifyRemindersEnabled,
    })
  : null

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbPath, notificationsAvailable: notificationChannelsAvailable, gotifyAvailable: notificationsAvailable, textEmailAvailable, gotifyRemindersEnabled })
})

app.get('/api/notification-settings', (_req, res) => {
  res.json({ available: notificationChannelsAvailable, gotifyRemindersEnabled })
})

app.put('/api/notification-settings', (req, res) => {
  const enabled = Boolean(req.body?.gotifyRemindersEnabled) && notificationChannelsAvailable
  gotifyRemindersEnabled = enabled
  writeBooleanSetting('gotify_reminders_enabled', enabled)
  appendEventLog('settings_update', { key: 'gotify_reminders_enabled', value: enabled ? '1' : '0' })
  notificationScheduler?.setEnabled(enabled)
  res.json({ ok: true, available: notificationChannelsAvailable, gotifyRemindersEnabled })
})

app.get('/api/state', (_req, res) => {
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
  })
  const { entries, diapers, medicines, session, theme } = incoming

  const entriesJson = JSON.stringify(entries)
  const diapersJson = JSON.stringify(diapers)
  const medicinesJson = JSON.stringify(medicines)
  const sessionJson = session ? JSON.stringify(session) : null

  const updatedAt = new Date().toISOString()
  upsertState.run({
    entries_json: entriesJson,
    diapers_json: diapersJson,
    medicines_json: medicinesJson,
    session_json: sessionJson,
    theme,
    updated_at: updatedAt,
  })

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

app.listen(port, () => {
  console.log(`feeding-tracker server listening on :${port}`)
  console.log(`sqlite db: ${dbPath}`)
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
  if (notificationChannelsAvailable) {
    notificationScheduler.evaluate()
    console.log(`reminders ${gotifyRemindersEnabled ? 'enabled' : 'disabled'}: gotify=${notificationsAvailable ? gotifyUrl : 'off'}, textEmail=${textEmailAvailable ? 'on' : 'off'}`)
  }
})
