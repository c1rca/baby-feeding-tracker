import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)

test('recovery supports portable SQLite backups only, not JSONL event-log replay', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))

  assert.equal(packageJson.scripts['replay:event-log'], undefined)
  assert.equal(fs.existsSync(path.join(rootDir, 'scripts', 'replay-event-log.mjs')), false)
})

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
  const backupPath = fs.readdirSync(backupDir).map((name) => path.join(backupDir, name)).find((file) => /^feeding-tracker-\d{8}T\d{6}Z-[a-f0-9]+\.db$/.test(path.basename(file)))
  assert.ok(backupPath)
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

  const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'restore-db.mjs'), '--replace', sourcePath], {
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

  const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'restore-db.mjs'), '--replace', badPath], {
    cwd: rootDir,
    env: { ...process.env, DB_PATH: path.join(tmp, 'data', 'feeding-tracker.db') },
    encoding: 'utf8',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Restore failed: invalid backup/)
})
