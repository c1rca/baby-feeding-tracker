#!/usr/bin/env node
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)
const source = process.argv[2]
const dbPath = process.env.DB_PATH || path.join(rootDir, 'data', 'feeding-tracker.db')

if (!source) {
  console.error('Usage: npm run restore:db -- /path/to/feeding-tracker-backup.db')
  process.exit(1)
}

const sourcePath = path.resolve(source)
if (!fs.existsSync(sourcePath)) {
  console.error(`Backup not found: ${sourcePath}`)
  process.exit(1)
}

let sourceDb
try {
  sourceDb = new Database(sourcePath, { readonly: true })
  sourceDb.prepare('SELECT entries_json, session_json, theme FROM app_state WHERE id = 1').get()
} catch (error) {
  console.error(`Invalid feeding tracker backup: ${error instanceof Error ? error.message : String(error)}`)
  sourceDb?.close()
  process.exit(1)
}
sourceDb.close()

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
for (const suffix of ['', '-wal', '-shm']) {
  const target = `${dbPath}${suffix}`
  if (fs.existsSync(target)) fs.rmSync(target)
}
fs.copyFileSync(sourcePath, dbPath)

const restored = new Database(dbPath)
try {
  restored.pragma('journal_mode = WAL')
} finally {
  restored.close()
}

console.log(`Restored database: ${dbPath}`)
