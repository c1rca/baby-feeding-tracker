#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createVerifiedBackup } from '../server/recovery.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = process.env.DB_PATH || path.join(rootDir, 'data', 'feeding-tracker.db')
const backupDir = process.env.BACKUP_DIR || path.join(rootDir, 'backups')

const backupNow = () => {
  const value = process.env.BACKUP_TIMESTAMP
  if (!value) return undefined
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(value)
  if (!match) throw new Error('BACKUP_TIMESTAMP must use YYYYMMDD-HHMMSS')
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`)
}

try {
  const result = await createVerifiedBackup({
    dbPath,
    backupDir,
    now: backupNow(),
  })
  console.log(JSON.stringify({ artifact: result.name, bytes: result.bytes, sha256: result.sha256, verified: true, retention: result.retention }))
} catch (error) {
  console.error(`Backup failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
}
