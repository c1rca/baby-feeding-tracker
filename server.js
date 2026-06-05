import express from 'express'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createNotificationScheduler, sendGotifyMessage } from './server/notifications.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = Number(process.env.PORT || 8080)
const dbDir = process.env.DB_DIR || path.join(__dirname, 'data')
const dbPath = process.env.DB_PATH || path.join(dbDir, 'feeding-tracker.db')
const gotifyUrl = process.env.GOTIFY_URL || ''
const gotifyToken = process.env.GOTIFY_TOKEN || ''
const notificationsEnabled = process.env.NOTIFICATIONS_ENABLED === '1' && Boolean(gotifyUrl && gotifyToken)

fs.mkdirSync(dbDir, { recursive: true })
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    entries_json TEXT NOT NULL,
    session_json TEXT,
    theme TEXT NOT NULL DEFAULT 'light',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_state (
    entry_id TEXT PRIMARY KEY,
    due_at TEXT NOT NULL,
    sent_at TEXT,
    updated_at TEXT NOT NULL
  );
`)

const selectState = db.prepare('SELECT entries_json, session_json, theme, updated_at FROM app_state WHERE id = 1')
const upsertState = db.prepare(`
  INSERT INTO app_state (id, entries_json, session_json, theme, updated_at)
  VALUES (1, @entries_json, @session_json, @theme, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    entries_json = excluded.entries_json,
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

const notificationScheduler = notificationsEnabled
  ? createNotificationScheduler({
      selectState,
      getNotificationState,
      upsertNotificationState,
      sendGotify: (payload) => sendGotifyMessage({ url: gotifyUrl, token: gotifyToken, ...payload }),
    })
  : null

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbPath, notificationsEnabled })
})

app.get('/api/state', (_req, res) => {
  const row = selectState.get()
  if (!row) {
    return res.json({ entries: [], session: null, theme: 'light', updatedAt: null })
  }

  res.json({
    entries: JSON.parse(row.entries_json),
    session: row.session_json ? JSON.parse(row.session_json) : null,
    theme: row.theme || 'light',
    updatedAt: row.updated_at,
  })
})

app.put('/api/state', (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : []
  const session = req.body?.session ?? null
  const theme = req.body?.theme === 'dark' ? 'dark' : 'light'

  upsertState.run({
    entries_json: JSON.stringify(entries),
    session_json: session ? JSON.stringify(session) : null,
    theme,
    updated_at: new Date().toISOString(),
  })

  notificationScheduler?.evaluate()

  res.json({ ok: true })
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
  if (notificationsEnabled) {
    notificationScheduler.evaluate()
    console.log(`gotify reminders enabled: ${gotifyUrl}`)
  }
})
