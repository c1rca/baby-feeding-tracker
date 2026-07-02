import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)

function makeDb(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new Database(filePath)
  db.exec(`
    CREATE TABLE app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      entries_json TEXT NOT NULL,
      session_json TEXT,
      theme TEXT NOT NULL DEFAULT 'light',
      updated_at TEXT NOT NULL
    );
  `)
  db.prepare(`
    INSERT INTO app_state (id, entries_json, session_json, theme, updated_at)
    VALUES (1, ?, NULL, 'dark', ?)
  `).run(JSON.stringify([{ id: 'feed-1', type: 'bottle', bottleOunces: 2.5 }]), new Date().toISOString())
  db.close()
}

test('backup creates a portable single SQLite file without WAL sidecars', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-backup-'))
  const dbPath = path.join(tmp, 'data', 'feeding-tracker.db')
  const backupDir = path.join(tmp, 'backups')
  makeDb(dbPath)

  const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'backup-db.mjs')], {
    cwd: rootDir,
    env: { ...process.env, DB_PATH: dbPath, BACKUP_DIR: backupDir, BACKUP_TIMESTAMP: '20260101-010203' },
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  const backupPath = path.join(backupDir, 'feeding-tracker-20260101-010203.db')
  assert.equal(fs.existsSync(backupPath), true)
  assert.equal(fs.existsSync(`${backupPath}-wal`), false)

  const backup = new Database(backupPath, { readonly: true })
  const row = backup.prepare('SELECT entries_json, theme FROM app_state WHERE id = 1').get()
  backup.close()
  assert.equal(row.theme, 'dark')
  assert.match(row.entries_json, /feed-1/)
})

test('restore validates and installs a portable backup file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-restore-'))
  const sourcePath = path.join(tmp, 'source.db')
  const targetPath = path.join(tmp, 'data', 'feeding-tracker.db')
  makeDb(sourcePath)

  const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'restore-db.mjs'), sourcePath], {
    cwd: rootDir,
    env: { ...process.env, DB_PATH: targetPath },
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  const restored = new Database(targetPath, { readonly: true })
  const row = restored.prepare('SELECT entries_json, theme FROM app_state WHERE id = 1').get()
  restored.close()
  assert.equal(row.theme, 'dark')
  assert.match(row.entries_json, /feed-1/)
})

test('restore rejects invalid backup files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-invalid-'))
  const badPath = path.join(tmp, 'bad.db')
  fs.writeFileSync(badPath, 'not sqlite')

  const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'restore-db.mjs'), badPath], {
    cwd: rootDir,
    env: { ...process.env, DB_PATH: path.join(tmp, 'data', 'feeding-tracker.db') },
    encoding: 'utf8',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Invalid feeding tracker backup/)
})

test('event log replay recreates latest app state', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-replay-'))
  const logPath = path.join(tmp, 'feeding-tracker-events.jsonl')
  const targetPath = path.join(tmp, 'data', 'feeding-tracker.db')
  const older = { at: '2026-01-01T00:00:00.000Z', event: 'state_replace', theme: 'light', entries: [{ id: 'old-feed' }], session: null }
  const settings = { at: '2026-01-01T00:01:00.000Z', event: 'settings_update', key: 'gotify_reminders_enabled', value: '1' }
  const latest = { at: '2026-01-01T00:02:00.000Z', event: 'state_replace', theme: 'dark', entries: [{ id: 'new-feed', type: 'bottle', bottleOunces: 3 }], diapers: [{ id: 'diaper-1', kinds: ['wet'], at: 100 }], medicines: [{ id: 'med-1', kind: 'vitamin_d', at: 150 }], tummyTimes: [{ id: 'tummy-1', startedAt: 200, endedAt: 500 }], growthMeasurements: [{ id: 'growth-1', at: 250, weightKg: 4.4 }], babyDob: '2026-06-04', session: { startedAt: 123, activeSide: null, segmentStart: null, segments: [], bottleOunces: 0, note: '' } }
  fs.writeFileSync(logPath, [older, settings, latest].map((record) => JSON.stringify(record)).join('\n'))

  const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'replay-event-log.mjs'), logPath], {
    cwd: rootDir,
    env: { ...process.env, DB_PATH: targetPath },
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  const restored = new Database(targetPath, { readonly: true })
  const row = restored.prepare('SELECT entries_json, session_json, theme, diapers_json, medicines_json, tummy_times_json, growth_measurements_json, baby_dob FROM app_state WHERE id = 1').get()
  const setting = restored.prepare('SELECT value FROM app_settings WHERE key = ?').get('gotify_reminders_enabled')
  restored.close()
  assert.equal(row.theme, 'dark')
  assert.match(row.entries_json, /new-feed/)
  assert.doesNotMatch(row.entries_json, /old-feed/)
  assert.match(row.session_json, /startedAt/)
  assert.match(row.diapers_json, /diaper-1/)
  assert.match(row.medicines_json, /med-1/)
  assert.match(row.tummy_times_json, /tummy-1/)
  assert.match(row.growth_measurements_json, /growth-1/)
  assert.equal(row.baby_dob, '2026-06-04')
  assert.equal(setting.value, '1')
})
