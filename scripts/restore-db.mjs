#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { restoreBackupSafely } from '../server/recovery.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const replace = args[0] === '--replace'
const source = args.find((arg) => arg !== '--replace')
const dbPath = process.env.DB_PATH || path.join(rootDir, 'data', 'feeding-tracker.db')
const backupDir = process.env.BACKUP_DIR || path.join(rootDir, 'backups')

if (!replace || !source) {
  console.error('Usage: npm run restore:db -- --replace /path/to/feeding-tracker-backup.db')
  process.exitCode = 1
} else {
  try {
    const result = await restoreBackupSafely({ sourcePath: path.resolve(source), dbPath, backupDir, replace })
    console.log(JSON.stringify({ restored: true, verified: true, preRestoreArtifact: result.preRestorePath ? path.basename(result.preRestorePath) : null }))
  } catch (error) {
    console.error(`Restore failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    process.exitCode = 1
  }
}
