#!/usr/bin/env node
import path from 'node:path'
import { verifyBackupArtifact } from '../server/recovery.js'

const source = process.argv[2]
if (!source) {
  console.error('Usage: npm run verify:backup -- /path/to/feeding-tracker-backup.db')
  process.exitCode = 1
} else {
  const target = path.resolve(source)
  // Refuse the live database outright. `verifyBackupArtifact` no longer damages
  // it, but verifying a file a server is actively writing to cannot give a
  // meaningful answer anyway — the bytes move underneath the check. The command
  // reads as though it is safe to point anywhere, so name the mistake rather
  // than return a result that means nothing.
  const livePath = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.resolve(process.env.DB_DIR || 'data', 'feeding-tracker.db')

  if (target === livePath) {
    console.error(`Refusing to verify the live database at ${target}.`)
    console.error('Verify a backup artifact instead, or take one first: npm run backup:db')
    process.exitCode = 1
  } else {
    const result = verifyBackupArtifact(target)
    if (!result.ok) {
      console.error(`Backup verification failed: ${result.error}`)
      process.exitCode = 1
    } else console.log(JSON.stringify({ artifact: path.basename(source), bytes: result.bytes, sha256: result.sha256, verified: true }))
  }
}
