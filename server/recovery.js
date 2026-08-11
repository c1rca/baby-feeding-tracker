import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { openTrackerDatabase, prepareTrackerStatements } from './database.js'
import { NO_BACKUP_TRANSPORT } from './backupTransport.js'
import { serializeState } from './stateStore.js'

const canonicalName = /^feeding-tracker-(\d{8}T\d{6}Z)-([a-f0-9]{8,})\.db$/
const manifestName = '.managed-artifacts.json'
const privateDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dir, 0o700)
}
const privateFile = (file) => fs.chmodSync(file, 0o600)
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const safeUnlink = (file) => { if (fs.existsSync(file)) fs.rmSync(file, { force: true }) }
const manifestPath = (backupDir) => path.join(backupDir, manifestName)

const readManagedArtifacts = (backupDir) => {
  const file = manifestPath(backupDir)
  if (!fs.existsSync(file)) return []
  try {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (manifest.version !== 1 || !Array.isArray(manifest.artifacts)) return null
    return manifest.artifacts.filter(({ name, sha256: digest, bytes }) => canonicalName.test(name) && /^[a-f0-9]{64}$/.test(digest) && Number.isInteger(bytes) && bytes > 0)
  } catch { return null }
}

const writeManagedArtifacts = (backupDir, artifacts) => {
  const file = manifestPath(backupDir)
  const temporary = `${file}.tmp-${randomPart()}`
  try {
    fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, artifacts })}\n`, { mode: 0o600 })
    privateFile(temporary)
    fs.renameSync(temporary, file)
    privateFile(file)
  } finally { safeUnlink(temporary) }
}

const matchesManagedArtifact = ({ name, sha256: digest, bytes }, backupDir) => {
  const file = path.join(backupDir, name)
  return fs.existsSync(file) && fs.statSync(file).size === bytes && sha256(file) === digest
}

export function verifyBackupArtifact(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) return { ok: false, error: 'backup artifact is missing or empty' }
  // A -wal with bytes in it is the real hazard: the artifact was copied out from
  // under a live writer and the .db alone is missing committed transactions. An
  // EMPTY -wal/-shm pair is just the residue of someone opening the artifact
  // read-only (SQLite creates them; a read-only connection cannot remove them),
  // and condemning that turned every inspected backup into an unrestorable one.
  if (fs.existsSync(`${filePath}-wal`) && fs.statSync(`${filePath}-wal`).size > 0) return { ok: false, error: 'backup artifact has an unreplayed SQLite WAL sidecar' }
  // Whether the sidecars were already there decides whether we may remove them
  // afterwards. See the cleanup in `finally`.
  const preexisting = { wal: fs.existsSync(`${filePath}-wal`), shm: fs.existsSync(`${filePath}-shm`) }
  let db
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true })
    const integrity = db.pragma('integrity_check', { simple: true })
    if (integrity !== 'ok') throw new Error('SQLite integrity check failed')
    if (db.pragma('foreign_key_check').length) throw new Error('SQLite foreign key check failed')
    // Identify a tracker database by its schema, NOT by the presence of a legacy
    // app_state ROW. That row is only mirrored for the default household/baby
    // scope, so requiring it rejected every database whose data lives in
    // baby_state — a fresh install, and every household created through signup —
    // making BACKUP_ON_START and backup:db throw on exactly the deployments with
    // no other copy of their data. The table itself has existed in every schema
    // version, so checking for it still refuses a non-tracker file while keeping
    // pre-scoping artifacts restorable.
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_state'").get()) throw new Error('tracker app_state table is missing')
    return { ok: true, sha256: sha256(filePath), bytes: fs.statSync(filePath).size, userVersion: db.pragma('user_version', { simple: true }) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'invalid SQLite backup' }
  } finally {
    db?.close()
    // Every tracker database is WAL-mode, and a READ-ONLY connection cannot
    // checkpoint, so opening the artifact leaves -wal/-shm behind that SQLite
    // never cleans up. Leaving them made verification destructive in its own
    // way: the second verify, and every restore of a previously-verified
    // artifact, failed with "has SQLite sidecars".
    //
    // Remove only what this call created. The earlier version deleted them
    // unconditionally, on the reasoning that an artifact arriving with sidecars
    // is refused above — but that guard only rejects a *non-empty* WAL. A live
    // database that has just checkpointed has an empty one, so pointing
    // `verify:backup` at `data/feeding-tracker.db` (an easy mistake: it looks
    // much like a backup and sits one directory away) sailed straight through
    // and pulled the WAL out from under the running server. Anything committed
    // between the guard and this line went with it.
    if (!preexisting.wal) safeUnlink(`${filePath}-wal`)
    if (!preexisting.shm) safeUnlink(`${filePath}-shm`)
  }
}

const stamp = (now) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const randomPart = () => crypto.randomBytes(8).toString('hex')

/** The UTC date an artifact was taken, read from its canonical name. */
const artifactDay = (name) => canonicalName.exec(name)?.[1]?.slice(0, 8) ?? null

export function applyBackupRetention({ backupDir, policy = {} }) {
  const daily = Number.isInteger(policy.daily) ? policy.daily : 28
  // How many of the most recent artifacts to keep regardless of day, so several
  // copies from today survive a same-day mistake. Capped by `daily`: a caller
  // asking to keep one day must not have that silently widened into four
  // artifacts.
  const recent = Number.isInteger(policy.recent) ? policy.recent : Math.min(4, daily)
  const manifest = readManagedArtifacts(backupDir)
  // Missing or malformed provenance fails closed: neither canonical-looking nor
  // historical/operator-managed files are eligible for deletion.
  if (manifest === null) return { kept: [], deleted: [] }
  const managed = manifest.filter((artifact) => matchesManagedArtifact(artifact, backupDir)).sort((a, b) => a.name.localeCompare(b.name))

  // Retain by *day*, not by count.
  //
  // Counting kept the newest N artifacts, which is fine when backups arrive
  // daily and catastrophic when they arrive in a burst. BACKUP_ON_START=1 with
  // `restart: unless-stopped` means a crashlooping container takes one backup
  // per restart, so N restarts — minutes — evicted every artifact from before
  // the crash. Retention deleted the history at the exact moment something had
  // gone wrong enough to need it.
  //
  // Keeping the newest artifact of each of the last `daily` days makes a burst
  // collapse into one entry for that day and leaves every earlier day intact.
  const newestByDay = new Map()
  for (const artifact of managed) {
    const day = artifactDay(artifact.name)
    if (day) newestByDay.set(day, artifact.name) // ascending order, so last wins
  }
  const keptDays = [...newestByDay.keys()].sort().slice(-Math.max(1, daily))
  const keep = new Set(keptDays.map((day) => newestByDay.get(day)))
  for (const artifact of managed.slice(-Math.max(0, recent))) keep.add(artifact.name)
  const deleted = []
  for (const { name } of managed) {
    if (!keep.has(name)) {
      safeUnlink(path.join(backupDir, name))
      deleted.push(name)
    }
  }
  writeManagedArtifacts(backupDir, managed.filter(({ name }) => keep.has(name)))
  return { kept: [...keep], deleted }
}

export async function createVerifiedBackup({ dbPath, backupDir, now = new Date(), retentionPolicy, transport = NO_BACKUP_TRANSPORT } = {}) {
  if (!dbPath || !fs.existsSync(dbPath)) throw new Error('database not found')
  privateDir(backupDir)
  const name = `feeding-tracker-${stamp(now)}-${randomPart()}.db`
  const destination = path.join(backupDir, name)
  const temporary = `${destination}.tmp-${randomPart()}`
  let db
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true })
    await db.backup(temporary)
    privateFile(temporary)
    const verification = verifyBackupArtifact(temporary)
    if (!verification.ok) throw new Error(`backup verification failed: ${verification.error}`)
    fs.renameSync(temporary, destination)
    privateFile(destination)
    const managedArtifacts = readManagedArtifacts(backupDir)
    if (managedArtifacts === null) throw new Error('managed backup artifact manifest is invalid; refusing retention')
    writeManagedArtifacts(backupDir, [...managedArtifacts.filter((artifact) => artifact.name !== name), { name, sha256: verification.sha256, bytes: verification.bytes }])
    const retention = applyBackupRetention({ backupDir, policy: retentionPolicy })
    // Ship after the local copy is durable and recorded. Every backup this
    // deployment has ever taken sits on the same disk as the database it
    // protects, so losing that disk loses both; this is the only step that
    // changes. It cannot fail the run — see the transport's contract.
    const offHost = await (transport?.ship?.(destination) ?? Promise.resolve({ shipped: false, reason: 'disabled' }))
    return { path: destination, name, ...verification, retention, offHost }
  } catch (error) {
    safeUnlink(temporary)
    throw error
  } finally { db?.close() }
}

const bootDrill = (dbPath, backupDir) => {
  const db = openTrackerDatabase({ dbDir: path.dirname(dbPath), backupDir, dbPath })
  try {
    const state = serializeState(prepareTrackerStatements(db).selectState.get())
    if (!state || !Array.isArray(state.entries)) throw new Error('application migration boot drill failed')
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw new Error('post-migration SQLite verification failed')
  } finally { db.close() }
  safeUnlink(`${dbPath}-wal`)
  safeUnlink(`${dbPath}-shm`)
}

export async function restoreBackupSafely({ sourcePath, dbPath, backupDir, replace = false } = {}) {
  if (!replace) throw new Error('restore requires explicit --replace acknowledgement')
  const sourceVerification = verifyBackupArtifact(sourcePath)
  if (!sourceVerification.ok) throw new Error(`invalid backup: ${sourceVerification.error}`)
  privateDir(backupDir)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  let preRestorePath = null
  if (fs.existsSync(dbPath)) {
    const pre = await createVerifiedBackup({ dbPath, backupDir })
    preRestorePath = pre.path
  }
  const stage = path.join(path.dirname(dbPath), `.restore-${randomPart()}.db`)
  let source
  try {
    source = new Database(sourcePath, { readonly: true, fileMustExist: true })
    await source.backup(stage)
    privateFile(stage)
    if (!verifyBackupArtifact(stage).ok) throw new Error('staged restore verification failed')
    bootDrill(stage, backupDir)
    if (!verifyBackupArtifact(stage).ok) throw new Error('staged migration verification failed')
    safeUnlink(`${dbPath}-wal`); safeUnlink(`${dbPath}-shm`)
    fs.renameSync(stage, dbPath)
    privateFile(dbPath)
    const targetVerification = verifyBackupArtifact(dbPath)
    if (!targetVerification.ok) throw new Error(`restored target verification failed: ${targetVerification.error}`)
    return { preRestorePath, ...targetVerification }
  } finally {
    source?.close()
    safeUnlink(stage); safeUnlink(`${stage}-wal`); safeUnlink(`${stage}-shm`)
  }
}
