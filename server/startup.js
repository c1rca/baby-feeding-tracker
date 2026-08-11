import { createVerifiedBackup } from './recovery.js'

// Restart-driven backups are intentionally opt-in. When enabled they use the
// same verification, permissions, naming and retention path as scheduled ones.
export const createStartupBackup = ({ dbPath, backupDir, transport }) => async () => {
  if (process.env.BACKUP_ON_START !== '1') return null
  try {
    const result = await createVerifiedBackup({ dbPath, backupDir, transport })
    // Say which of the two copies exist. "startup backup verified" alone read
    // the same whether or not anything left this disk, which is precisely the
    // distinction that matters when the disk is what you lose.
    if (result.offHost?.shipped) console.log('startup backup verified and shipped off-host')
    else if (result.offHost?.reason && result.offHost.reason !== 'disabled') console.warn(`startup backup verified; off-host copy FAILED: ${result.offHost.reason}`)
    else console.log('startup backup verified (local only; no off-host transport configured)')
    return result.path
  } catch {
    console.warn('startup backup failed')
    return null
  }
}
