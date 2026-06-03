#!/usr/bin/env node
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)
const dbPath = process.env.DB_PATH || path.join(rootDir, 'data', 'feeding-tracker.db')
const backupDir = process.env.BACKUP_DIR || path.join(rootDir, 'backups')
const timestamp = process.env.BACKUP_TIMESTAMP || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-')

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`)
  process.exit(1)
}

fs.mkdirSync(backupDir, { recursive: true })
const backupPath = path.join(backupDir, `feeding-tracker-${timestamp}.db`)

const db = new Database(dbPath, { readonly: true })
try {
  await db.backup(backupPath)
} finally {
  db.close()
}

const size = fs.statSync(backupPath).size
console.log(`Backup created: ${backupPath}`)
console.log(`Size: ${size} bytes`)
