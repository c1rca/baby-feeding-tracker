import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createBackupTransport } from '../server/backupTransport.js'
import { createVerifiedBackup, restoreBackupSafely, verifyBackupArtifact, applyBackupRetention } from '../server/recovery.js'
import { openTrackerDatabase, DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID } from '../server/database.js'

// Build the REAL tracker schema via openTrackerDatabase rather than a synthetic
// app_state-only table. A fixture that invents its own schema cannot catch a
// verifier that disagrees with production — which is exactly how the backup
// path came to reject every database whose data lives in baby_state.
const makeDb = (filePath, marker = 'feed-1') => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = openTrackerDatabase({ dbDir: path.dirname(filePath), backupDir: path.join(path.dirname(filePath), '.fixture-backups'), dbPath: filePath })
  db.prepare(`INSERT INTO app_state (id, household_id, baby_id, entries_json, session_json, theme, updated_at)
    VALUES (1, @household_id, @baby_id, @entries_json, NULL, 'dark', 'now')
    ON CONFLICT(id) DO UPDATE SET entries_json = excluded.entries_json`)
    .run({ household_id: DEFAULT_HOUSEHOLD_ID, baby_id: DEFAULT_BABY_ID, entries_json: JSON.stringify([{ id: marker }]) })
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()
  // The verifier rejects a artifact carrying SQLite sidecars; WAL mode leaves them.
  fs.rmSync(`${filePath}-wal`, { force: true })
  fs.rmSync(`${filePath}-shm`, { force: true })
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

test('a database whose data lives only in baby_state is still backed up and restorable', async () => {
  // A household created through signup writes baby_state and never touches the
  // legacy app_state mirror. Requiring an app_state ROW made createVerifiedBackup
  // throw for those deployments, so BACKUP_ON_START and backup:db silently
  // protected nothing.
  const dir = temp()
  const dbPath = path.join(dir, 'data', 'tracker.db')
  const backupDir = path.join(dir, 'backups')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = openTrackerDatabase({ dbDir: path.dirname(dbPath), backupDir: path.join(dir, '.fixture'), dbPath })
  const now = new Date().toISOString()
  db.prepare('INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)').run('hh-signup', 'Signup household', now)
  db.prepare('INSERT INTO babies (id, household_id, name, dob, created_at) VALUES (?, ?, ?, ?, ?)').run('baby-signup', 'hh-signup', 'Baby', '2026-06-03', now)
  db.prepare("INSERT INTO baby_state (household_id, baby_id, entries_json, updated_at) VALUES ('hh-signup', 'baby-signup', ?, ?)").run(JSON.stringify([{ id: 'scoped-feed' }]), now)
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()
  fs.rmSync(`${dbPath}-wal`, { force: true }); fs.rmSync(`${dbPath}-shm`, { force: true })

  const result = await createVerifiedBackup({ dbPath, backupDir })
  assert.equal(verifyBackupArtifact(result.path).ok, true)
  const restored = new Database(result.path, { readonly: true })
  assert.match(restored.prepare("SELECT entries_json FROM baby_state WHERE baby_id = 'baby-signup'").get().entries_json, /scoped-feed/)
  restored.close()
  fs.rmSync(`${result.path}-wal`, { force: true }); fs.rmSync(`${result.path}-shm`, { force: true })
})

test('verifying a backup does not make it unrestorable', async () => {
  // Opening a WAL-mode artifact read-only leaves empty -wal/-shm behind, and a
  // read-only connection cannot remove them. Treating that residue as corruption
  // meant `verify:backup` poisoned the artifact it was asked to check, and any
  // later restore of it failed.
  const dir = temp()
  const dbPath = path.join(dir, 'data', 'tracker.db')
  const backupDir = path.join(dir, 'backups')
  makeDb(dbPath, 'restore-me')

  const artifact = await createVerifiedBackup({ dbPath, backupDir })
  assert.equal(verifyBackupArtifact(artifact.path).ok, true)
  assert.equal(verifyBackupArtifact(artifact.path).ok, true, 'a second verification must still pass')
  assert.equal(fs.existsSync(`${artifact.path}-wal`), false, 'verification must leave no sidecars behind')

  // The restore must succeed on an artifact that has already been verified.
  const restored = await restoreBackupSafely({ sourcePath: artifact.path, dbPath, backupDir, replace: true })
  assert.equal(restored.ok, true)
  const target = new Database(dbPath, { readonly: true })
  assert.match(target.prepare('SELECT entries_json FROM app_state WHERE id = 1').get().entries_json, /restore-me/)
  target.close()
  fs.rmSync(`${dbPath}-wal`, { force: true }); fs.rmSync(`${dbPath}-shm`, { force: true })
})

test('verifying a live database never removes the WAL out from under the running server', async () => {
  // `verify:backup` takes any path, and an operator pointing it at the live
  // database is an easy mistake to make — the two files look alike and sit one
  // directory apart. The non-empty-WAL guard does not catch it: a database that
  // has just checkpointed has an EMPTY -wal, sails past the guard, and the
  // cleanup then deletes the sidecars belonging to a process that is still
  // running. Anything the server commits between the check and the delete goes
  // with them.
  //
  // The rule is the one the cleanup comment already claims: remove only the
  // sidecars this call created, and leave anything that was already there.
  const dir = temp()
  const dbPath = path.join(dir, 'data', 'tracker.db')
  makeDb(dbPath, 'live-data')

  // A live WAL-mode database, held open by a "server", freshly checkpointed so
  // its -wal is present but empty.
  const live = new Database(dbPath)
  live.pragma('journal_mode = WAL')
  live.prepare('UPDATE app_state SET theme = ? WHERE id = 1').run('light')
  live.pragma('wal_checkpoint(TRUNCATE)')
  assert.equal(fs.existsSync(`${dbPath}-wal`), true, 'fixture should have an empty -wal present')
  assert.equal(fs.statSync(`${dbPath}-wal`).size, 0, 'fixture -wal should be empty after a truncate checkpoint')

  verifyBackupArtifact(dbPath)

  assert.equal(fs.existsSync(`${dbPath}-wal`), true, 'the live -wal must survive verification')
  assert.equal(fs.existsSync(`${dbPath}-shm`), true, 'the live -shm must survive verification')

  // The still-open server connection must remain usable and its data intact.
  live.prepare('UPDATE app_state SET theme = ? WHERE id = 1').run('dark')
  assert.equal(live.prepare('SELECT theme FROM app_state WHERE id = 1').get().theme, 'dark')
  assert.match(live.prepare('SELECT entries_json FROM app_state WHERE id = 1').get().entries_json, /live-data/)
  live.close()
  fs.rmSync(`${dbPath}-wal`, { force: true }); fs.rmSync(`${dbPath}-shm`, { force: true })
})

test('off-host shipping runs the configured encrypt and upload commands', async () => {
  // The transport has always parsed its configuration and then done nothing —
  // status literally reported 'configured-not-executed'. Every backup this
  // household has lives on the same disk as the database it protects, so the
  // one failure a backup exists for (losing that disk) takes the backups too.
  const dir = temp()
  const dbPath = path.join(dir, 'data', 'tracker.db')
  const backupDir = path.join(dir, 'backups')
  const offHost = path.join(dir, 'off-host')
  fs.mkdirSync(offHost, { recursive: true })
  makeDb(dbPath, 'ship-me')

  // `cp` stands in for real encrypt/upload commands: it proves the argv is
  // executed and the placeholders substituted, without needing a key or a host.
  const transport = createBackupTransport({
    encryptionArgs: JSON.stringify(['cp', '{{artifact}}', '{{output}}']),
    uploadArgs: JSON.stringify(['cp', '{{output}}', path.join(offHost, 'shipped.db.enc')]),
  })
  assert.equal(transport.status().enabled, true)

  const artifact = await createVerifiedBackup({ dbPath, backupDir, transport })

  assert.equal(artifact.offHost.shipped, true, 'the artifact should have been shipped')
  assert.equal(fs.existsSync(path.join(offHost, 'shipped.db.enc')), true, 'the off-host copy must exist')
  // What landed off-host has to be the artifact, not an empty or partial file.
  assert.equal(
    fs.readFileSync(path.join(offHost, 'shipped.db.enc')).length,
    fs.statSync(artifact.path).size,
    'the shipped copy must match the artifact byte length',
  )
  // The encrypted intermediate is scratch space, not something to leave lying
  // around next to the plaintext backup.
  assert.equal(fs.readdirSync(backupDir).some((name) => name.endsWith('.enc')), false, 'no encrypted scratch file may be left in the backup dir')
})

test('a failed off-host upload never costs us the local backup', async () => {
  // The local copy is the one that already succeeded and the one a restore
  // actually uses. A broken remote must degrade to "we still have it here",
  // never to "the backup run failed".
  const dir = temp()
  const dbPath = path.join(dir, 'data', 'tracker.db')
  const backupDir = path.join(dir, 'backups')
  makeDb(dbPath, 'keep-me')

  const transport = createBackupTransport({
    encryptionArgs: JSON.stringify(['cp', '{{artifact}}', '{{output}}']),
    uploadArgs: JSON.stringify(['false']),
  })

  const artifact = await createVerifiedBackup({ dbPath, backupDir, transport })

  assert.equal(artifact.offHost.shipped, false)
  assert.match(artifact.offHost.reason, /upload/i)
  assert.equal(fs.existsSync(artifact.path), true, 'the local artifact must survive an upload failure')
  assert.equal(verifyBackupArtifact(artifact.path).ok, true, 'and must still verify')
})

test('backups still work with no off-host transport configured', async () => {
  const dir = temp()
  const dbPath = path.join(dir, 'data', 'tracker.db')
  const backupDir = path.join(dir, 'backups')
  makeDb(dbPath, 'local-only')

  const artifact = await createVerifiedBackup({ dbPath, backupDir, transport: createBackupTransport({}) })
  assert.equal(artifact.offHost.shipped, false)
  assert.equal(artifact.offHost.reason, 'disabled')
  assert.equal(verifyBackupArtifact(artifact.path).ok, true)
})

test('a restart burst cannot evict the daily backup history', async () => {
  // BACKUP_ON_START=1 plus `restart: unless-stopped` means a crashlooping
  // container takes one backup per restart. Retention kept the newest N by
  // count, so a few minutes of crashlooping evicted every artifact from before
  // the crash — deleting the backups precisely when they were about to matter.
  const dir = temp()
  const dbPath = path.join(dir, 'data', 'tracker.db')
  const backupDir = path.join(dir, 'backups')
  makeDb(dbPath, 'history')

  const at = (iso) => new Date(iso)
  const older = []
  for (const day of ['2026-07-20T09:00:00Z', '2026-07-21T09:00:00Z', '2026-07-22T09:00:00Z']) {
    older.push((await createVerifiedBackup({ dbPath, backupDir, now: at(day) })).name)
  }

  // Now the crashloop: thirty restarts inside one day.
  for (let restart = 0; restart < 30; restart++) {
    await createVerifiedBackup({ dbPath, backupDir, now: at(`2026-07-23T10:${String(restart).padStart(2, '0')}:00Z`) })
  }

  for (const name of older) {
    assert.equal(fs.existsSync(path.join(backupDir, name)), true, `${name} must survive a restart burst`)
  }
  // And the burst itself must not be hoarded — one day should not keep thirty.
  const sameDay = fs.readdirSync(backupDir).filter((name) => name.includes('20260723T'))
  assert.ok(sameDay.length < 30, `the burst should be collapsed, kept ${sameDay.length}`)
  assert.ok(sameDay.length >= 1, 'at least one artifact from the burst day must remain')
})
