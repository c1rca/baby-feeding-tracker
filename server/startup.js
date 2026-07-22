import { createVerifiedBackup } from './recovery.js'

// Restart-driven backups are intentionally opt-in. When enabled they use the
// same verification, permissions, naming and retention path as scheduled ones.
export const createStartupBackup = ({ dbPath, backupDir }) => async () => {
  if (process.env.BACKUP_ON_START !== '1') return null
  try {
    const result = await createVerifiedBackup({ dbPath, backupDir })
    console.log('startup backup verified')
    return result.path
  } catch {
    console.warn('startup backup failed')
    return null
  }
}
