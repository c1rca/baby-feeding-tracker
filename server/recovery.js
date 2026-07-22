import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { openTrackerDatabase, prepareTrackerStatements } from './database.js'
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
  if (fs.existsSync(`${filePath}-wal`) || fs.existsSync(`${filePath}-shm`)) return { ok: false, error: 'backup artifact has SQLite sidecars' }
  let db
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true })
    const integrity = db.pragma('integrity_check', { simple: true })
    if (integrity !== 'ok') throw new Error('SQLite integrity check failed')
    if (db.pragma('foreign_key_check').length) throw new Error('SQLite foreign key check failed')
    const appState = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_state'").get()
    if (!appState || !db.prepare('SELECT 1 FROM app_state WHERE id = 1').get()) throw new Error('tracker app_state row is missing')
    return { ok: true, sha256: sha256(filePath), bytes: fs.statSync(filePath).size, userVersion: db.pragma('user_version', { simple: true }) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'invalid SQLite backup' }
  } finally {
    db?.close()
  }
}

const stamp = (now) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const randomPart = () => crypto.randomBytes(8).toString('hex')

export function applyBackupRetention({ backupDir, policy = {} }) {
  const daily = Number.isInteger(policy.daily) ? policy.daily : 28
  const manifest = readManagedArtifacts(backupDir)
  // Missing or malformed provenance fails closed: neither canonical-looking nor
  // historical/operator-managed files are eligible for deletion.
  if (manifest === null) return { kept: [], deleted: [] }
  const managed = manifest.filter((artifact) => matchesManagedArtifact(artifact, backupDir)).sort((a, b) => a.name.localeCompare(b.name))
  const keep = new Set(managed.slice(Math.max(0, managed.length - Math.max(1, daily))).map(({ name }) => name))
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

export async function createVerifiedBackup({ dbPath, backupDir, now = new Date(), retentionPolicy } = {}) {
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
    return { path: destination, name, ...verification, retention }
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
