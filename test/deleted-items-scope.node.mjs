import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { openTrackerDatabase, prepareTrackerStatements, DEFAULT_HOUSEHOLD_ID, DEFAULT_BABY_ID } from '../server/database.js'
import { createDeletedItemOptionsReader, createDeletedItemRecorder } from '../server/stateStore.js'

const openScratchDb = (dbPath) => openTrackerDatabase({
  dbDir: path.dirname(dbPath),
  backupDir: path.join(path.dirname(dbPath), 'backups'),
  logDir: path.join(path.dirname(dbPath), 'logs'),
  dbPath,
})

test('a tombstone in one household never suppresses an id in another household', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-deleted-scope-'))
  const db = openScratchDb(path.join(tmp, 'data', 'feeding-tracker.db'))
  const { selectDeletedItems, upsertDeletedItem } = prepareTrackerStatements(db)
  const readOptions = createDeletedItemOptionsReader(selectDeletedItems)
  const record = createDeletedItemRecorder(upsertDeletedItem)

  record({ entries: { removed: [{ id: 'entry-A' }] } }, 'ts-1', { householdId: 'household-A', babyId: 'baby-A' })

  const scopeA = readOptions({ householdId: 'household-A', babyId: 'baby-A' })
  const scopeB = readOptions({ householdId: 'household-B', babyId: 'baby-B' })
  db.close()

  assert.deepEqual(scopeA.deletedEntryIds, ['entry-A'])
  // The other household must not see household A's tombstone.
  assert.deepEqual(scopeB.deletedEntryIds, [])
})

test('two babies in the same household keep separate tombstone scopes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-deleted-baby-'))
  const db = openScratchDb(path.join(tmp, 'data', 'feeding-tracker.db'))
  const { selectDeletedItems, upsertDeletedItem } = prepareTrackerStatements(db)
  const readOptions = createDeletedItemOptionsReader(selectDeletedItems)
  const record = createDeletedItemRecorder(upsertDeletedItem)

  record({ diapers: { removed: [{ id: 'diaper-1' }] } }, 'ts-1', { householdId: 'household-1', babyId: 'baby-1' })

  assert.deepEqual(readOptions({ householdId: 'household-1', babyId: 'baby-1' }).deletedDiaperIds, ['diaper-1'])
  assert.deepEqual(readOptions({ householdId: 'household-1', babyId: 'baby-2' }).deletedDiaperIds, [])
  db.close()
})

test('legacy unscoped tombstones migrate to the default scope without loss', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-deleted-legacy-'))
  const dbPath = path.join(tmp, 'data', 'feeding-tracker.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  // Build a pre-scoping deleted_items table (no household_id/baby_id columns).
  const legacy = new Database(dbPath)
  legacy.exec(`
    CREATE TABLE deleted_items (
      item_id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      deleted_at TEXT NOT NULL
    );
  `)
  legacy.prepare('INSERT INTO deleted_items (item_id, collection, deleted_at) VALUES (?, ?, ?)').run('legacy-entry', 'entries', 'ts-legacy')
  legacy.close()

  const db = openScratchDb(dbPath)
  const { selectDeletedItems } = prepareTrackerStatements(db)
  const options = createDeletedItemOptionsReader(selectDeletedItems)({ householdId: DEFAULT_HOUSEHOLD_ID, babyId: DEFAULT_BABY_ID })
  const row = db.prepare('SELECT household_id, baby_id FROM deleted_items WHERE item_id = ?').get('legacy-entry')
  db.close()

  assert.deepEqual(options.deletedEntryIds, ['legacy-entry'])
  assert.equal(row.household_id, DEFAULT_HOUSEHOLD_ID)
  assert.equal(row.baby_id, DEFAULT_BABY_ID)
})
