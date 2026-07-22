import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createBackupTransport } from '../server/backupTransport.js'
import { createVerifiedBackup, restoreBackupSafely, verifyBackupArtifact, applyBackupRetention } from '../server/recovery.js'

const makeDb = (filePath, marker = 'feed-1') => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new Database(filePath)
  db.exec(`CREATE TABLE app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    entries_json TEXT NOT NULL,
    session_json TEXT,
    theme TEXT NOT NULL DEFAULT 'light',
    updated_at TEXT NOT NULL
  )`)
  db.prepare("INSERT INTO app_state (id, entries_json, session_json, theme, updated_at) VALUES (1, ?, NULL, 'dark', 'now')").run(JSON.stringify([{ id: marker }]))
  db.close()
}

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-recovery-'))

test('off-host transport remains disabled unless encryption and upload argv are both configured', () => {
  assert.deepEqual(createBackupTransport({}).status(), { enabled: false, reason: 'disabled' })
  assert.throws(() => createBackupTransport({ encryptionArgs: '["age", "-r"]' }), /both/i)
  assert.throws(() => createBackupTransport({ encryptionArgs: 'not-json', uploadArgs: '["rclone"]' }), /JSON array/)
})


test('verified backup is private, portable, and has no SQLite sidecars', async () => {
  const dir = temp()
  const dbPath = path.join(dir, 'data', 'tracker.db')
  const backupDir = path.join(dir, 'backups')
  makeDb(dbPath)

  const result = await createVerifiedBackup({ dbPath, backupDir, now: new Date('2026-01-02T03:04:05Z') })
  const verification = verifyBackupArtifact(result.path)

  assert.equal(fs.statSync(result.path).mode & 0o777, 0o600)
  assert.equal(fs.statSync(backupDir).mode & 0o777, 0o700)
  assert.equal(fs.existsSync(`${result.path}-wal`), false)
  assert.equal(fs.existsSync(`${result.path}-shm`), false)
  assert.equal(verification.ok, true)
  assert.match(verification.sha256, /^[a-f0-9]{64}$/)
})

test('retention never deletes manually placed artifacts that merely use canonical-looking names', () => {
  const backupDir = path.join(temp(), 'backups')
  fs.mkdirSync(backupDir, { recursive: true })
  const historical = path.join(backupDir, 'feeding-tracker-20200101T000000Z-aabbccdd.db')
  const recent = path.join(backupDir, 'feeding-tracker-20260101T000000Z-aabbccdd.db')
  fs.writeFileSync(historical, 'manually retained historical artifact')
  fs.writeFileSync(recent, 'manually placed canonical-looking artifact')

  const result = applyBackupRetention({ backupDir, policy: { daily: 1 } })

  assert.deepEqual(result.deleted, [])
  assert.equal(fs.existsSync(historical), true)
  assert.equal(fs.existsSync(recent), true)
})

test('retention removes only older artifacts recorded by this runtime', async () => {
  const dir = temp()
  const dbPath = path.join(dir, 'data', 'tracker.db')
  const backupDir = path.join(dir, 'backups')
  makeDb(dbPath)

  const first = await createVerifiedBackup({ dbPath, backupDir, now: new Date('2026-01-01T00:00:00Z'), retentionPolicy: { daily: 1 } })
  const second = await createVerifiedBackup({ dbPath, backupDir, now: new Date('2026-01-02T00:00:00Z'), retentionPolicy: { daily: 1 } })
  const manifest = path.join(backupDir, '.managed-artifacts.json')

  assert.equal(fs.existsSync(first.path), false)
  assert.equal(fs.existsSync(second.path), true)
  assert.equal(fs.statSync(manifest).mode & 0o777, 0o600)
})

test('restore requires explicit replacement and preserves a verified recovery copy of the target', async () => {
  const dir = temp()
  const source = path.join(dir, 'source.db')
  const target = path.join(dir, 'data', 'tracker.db')
  const backupDir = path.join(dir, 'backups')
  makeDb(source, 'new')
  makeDb(target, 'old')

  await assert.rejects(() => restoreBackupSafely({ sourcePath: source, dbPath: target, backupDir }), /--replace/)
  const result = await restoreBackupSafely({ sourcePath: source, dbPath: target, backupDir, replace: true })
  const restored = new Database(target, { readonly: true })
  const preRestore = new Database(result.preRestorePath, { readonly: true })
  assert.match(restored.prepare('SELECT entries_json FROM app_state WHERE id = 1').get().entries_json, /new/)
  assert.match(preRestore.prepare('SELECT entries_json FROM app_state WHERE id = 1').get().entries_json, /old/)
  restored.close()
  preRestore.close()
  assert.equal(verifyBackupArtifact(result.preRestorePath).ok, true)
})

test('restore preflight failure leaves the existing target untouched', async () => {
  const dir = temp()
  const source = path.join(dir, 'bad.db')
  const target = path.join(dir, 'data', 'tracker.db')
  fs.writeFileSync(source, 'not sqlite')
  makeDb(target, 'old')

  await assert.rejects(() => restoreBackupSafely({ sourcePath: source, dbPath: target, backupDir: path.join(dir, 'backups'), replace: true }), /invalid/i)
  const db = new Database(target, { readonly: true })
  assert.match(db.prepare('SELECT entries_json FROM app_state WHERE id = 1').get().entries_json, /old/)
  db.close()
})
