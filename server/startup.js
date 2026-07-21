import path from 'node:path'

export const createStartupBackup = ({ db, backupDir }) => async () => {
  if (process.env.BACKUP_ON_START !== '1') return null
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-')
  const backupPath = path.join(backupDir, `feeding-tracker-startup-${timestamp}.db`)
  try {
    await db.backup(backupPath)
    console.log('startup backup created')
    return backupPath
  } catch (error) {
    console.warn('startup backup failed')
    return null
  }
}
