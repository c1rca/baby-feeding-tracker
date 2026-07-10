import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { openTrackerDatabase } from '../server/database.js'

const openTempDb = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-pragmas-'))
  const dbPath = path.join(tmp, 'data', 'feeding-tracker.db')
  const db = openTrackerDatabase({
    dbDir: path.dirname(dbPath),
    backupDir: path.join(tmp, 'backups'),
    logDir: path.join(tmp, 'logs'),
    dbPath,
  })
  return { db, cleanup: () => { db.close(); fs.rmSync(tmp, { recursive: true, force: true }) } }
}

test('foreign key enforcement and a busy timeout are enabled on the connection', () => {
  const { db, cleanup } = openTempDb()
  try {
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1)
    assert.ok(db.pragma('busy_timeout', { simple: true }) >= 5000)
  } finally {
    cleanup()
  }
})

test('an orphan baby_state row is rejected once foreign keys are enforced', () => {
  const { db, cleanup } = openTempDb()
  try {
    assert.throws(
      () => db.prepare(`
        INSERT INTO baby_state (household_id, baby_id, entries_json, updated_at)
        VALUES ('default-household', 'ghost-baby', '[]', 'now')
      `).run(),
      /FOREIGN KEY/i,
    )
  } finally {
    cleanup()
  }
})

test('the default seed rows satisfy foreign keys (no startup violation)', () => {
  const { db, cleanup } = openTempDb()
  try {
    const violations = db.pragma('foreign_key_check')
    assert.deepEqual(violations, [])
  } finally {
    cleanup()
  }
})
