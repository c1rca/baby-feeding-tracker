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

test('a migration killed midway does not wedge the next boot or lose tombstones', () => {
  // The deleted_items rebuild ran DROP TABLE and ALTER ... RENAME as separate
  // auto-committed statements. A kill between them left no `deleted_items` at
  // all, and the next boot's `ALTER TABLE deleted_items ADD COLUMN` threw on a
  // missing table — startup wedged permanently, with every tombstone gone.
  // Tombstones are what stop a deleted record being resurrected by any stale
  // client, so losing them silently undoes deletions across the household.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-migration-'))
  const dbPath = path.join(dir, 'tracker.db')

  // Pre-scoping shape, with a tombstone in it, plus the leftover scoped table a
  // crash mid-rebuild would strand.
  const seed = new Database(dbPath)
  seed.exec(`
    CREATE TABLE deleted_items (
      item_id TEXT NOT NULL,
      collection TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (collection, item_id)
    );
    INSERT INTO deleted_items (item_id, collection, deleted_at) VALUES ('entry-gone', 'entries', '2026-07-01T00:00:00Z');
    CREATE TABLE deleted_items_scoped (
      item_id TEXT NOT NULL,
      collection TEXT NOT NULL,
      household_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (household_id, baby_id, collection, item_id)
    );
  `)
  seed.close()

  const result = spawnSync(process.execPath, ['-e', `
    const { openTrackerDatabase } = await import('${path.join(rootDir, 'server', 'database.js')}')
    const db = openTrackerDatabase({ dbDir: '${dir}', backupDir: '${path.join(dir, 'backups')}', dbPath: '${dbPath}' })
    const rows = db.prepare("SELECT item_id FROM deleted_items").all()
    console.log(JSON.stringify(rows.map((r) => r.item_id)))
    db.close()
  `.trim()], { encoding: 'utf8', env: { ...process.env, BACKUP_ON_START: '0' } })

  assert.equal(result.status, 0, `startup must recover from a partial migration, got: ${result.stderr}`)
  assert.match(result.stdout, /entry-gone/, 'the tombstone must survive the rebuild')
})
