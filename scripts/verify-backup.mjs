#!/usr/bin/env node
import path from 'node:path'
import { verifyBackupArtifact } from '../server/recovery.js'

const source = process.argv[2]
if (!source) {
  console.error('Usage: npm run verify:backup -- /path/to/feeding-tracker-backup.db')
  process.exitCode = 1
} else {
  const result = verifyBackupArtifact(path.resolve(source))
  if (!result.ok) {
    console.error(`Backup verification failed: ${result.error}`)
    process.exitCode = 1
  } else console.log(JSON.stringify({ artifact: path.basename(source), bytes: result.bytes, sha256: result.sha256, verified: true }))
}
