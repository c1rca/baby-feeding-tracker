#!/usr/bin/env node
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)
const source = process.argv[2] || process.env.EVENT_LOG_PATH || path.join(rootDir, 'logs', 'feeding-tracker-events.jsonl')
const dbPath = process.env.DB_PATH || path.join(rootDir, 'data', 'feeding-tracker.db')

if (!fs.existsSync(source)) {
  console.error(`Event log not found: ${source}`)
  process.exit(1)
}

const lines = fs.readFileSync(source, 'utf8').split('\n').filter(Boolean)
let latestState = null
let gotifyEnabled = null
for (const [index, line] of lines.entries()) {
  let record
  try {
    record = JSON.parse(line)
  } catch (error) {
    console.error(`Invalid JSONL at line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  if ((record.event === 'state_replace' || record.event === 'startup_state_snapshot') && Array.isArray(record.entries)) {
    latestState = {
      entries: record.entries,
      diapers: Array.isArray(record.diapers) ? record.diapers : [],
      medicines: Array.isArray(record.medicines) ? record.medicines : [],
      tummyTimes: Array.isArray(record.tummyTimes) ? record.tummyTimes : [],
      tummySession: record.tummySession ?? null,
      session: record.session ?? null,
      theme: record.theme === 'dark' ? 'dark' : 'light',
      updatedAt: record.at,
    }
  }
  if (record.event === 'settings_update' && record.key === 'gotify_reminders_enabled') {
    gotifyEnabled = record.value === '1' || record.value === true
  }
}

if (!latestState) {
  console.error('No state_replace or startup_state_snapshot event with entries found')
  process.exit(1)
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
for (const suffix of ['', '-wal', '-shm']) {
  const target = `${dbPath}${suffix}`
  if (fs.existsSync(target)) fs.rmSync(target)
}

const db = new Database(dbPath)
try {
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      entries_json TEXT NOT NULL,
      session_json TEXT,
      theme TEXT NOT NULL DEFAULT 'light',
      diapers_json TEXT NOT NULL DEFAULT '[]',
      medicines_json TEXT NOT NULL DEFAULT '[]',
      tummy_times_json TEXT NOT NULL DEFAULT '[]',
      tummy_session_json TEXT,
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
  db.prepare(`
    INSERT INTO app_state (id, entries_json, session_json, theme, diapers_json, medicines_json, tummy_times_json, tummy_session_json, updated_at)
    VALUES (1, @entries_json, @session_json, @theme, @diapers_json, @medicines_json, @tummy_times_json, @tummy_session_json, @updated_at)
  `).run({
    entries_json: JSON.stringify(latestState.entries),
    session_json: latestState.session ? JSON.stringify(latestState.session) : null,
    diapers_json: JSON.stringify(latestState.diapers),
    medicines_json: JSON.stringify(latestState.medicines),
    tummy_times_json: JSON.stringify(latestState.tummyTimes),
    tummy_session_json: latestState.tummySession ? JSON.stringify(latestState.tummySession) : null,
    theme: latestState.theme,
    updated_at: latestState.updatedAt,
  })
  if (gotifyEnabled !== null) {
    db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run('gotify_reminders_enabled', gotifyEnabled ? '1' : '0', latestState.updatedAt)
  }
} finally {
  db.close()
}

console.log(`Replayed event log: ${source}`)
console.log(`Recreated database: ${dbPath}`)
console.log(`Entries: ${latestState.entries.length}`)
console.log(`Diapers: ${latestState.diapers.length}`)
console.log(`Medicines: ${latestState.medicines.length}`)
console.log(`Tummy times: ${latestState.tummyTimes.length}`)
