import fs from 'node:fs'
import path from 'node:path'

export const createStartupBackup = ({ db, backupDir, appendEventLog, redactError }) => async () => {
  if (process.env.BACKUP_ON_START !== '1') return null
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-')
  const backupPath = path.join(backupDir, `feeding-tracker-startup-${timestamp}.db`)
  try {
    await db.backup(backupPath)
    const size = fs.statSync(backupPath).size
    appendEventLog('backup_created', { backupPath, size, reason: 'startup' })
    console.log(`startup backup created: ${backupPath} (${size} bytes)`)
    return backupPath
  } catch (error) {
    appendEventLog('backup_failed', { reason: 'startup', error: redactError(error) })
    console.warn('startup backup failed', error)
    return null
  }
}

export const appendStartupStateSnapshot = ({ selectState, appendEventLog, summarizeState, redactError }) => {
  const startupRow = selectState.get()
  if (!startupRow) return

  try {
    const entries = JSON.parse(startupRow.entries_json)
    const diapers = JSON.parse(startupRow.diapers_json || '[]')
    const medicines = JSON.parse(startupRow.medicines_json || '[]')
    const growthMeasurements = JSON.parse(startupRow.growth_measurements_json || '[]')
    const babyDob = startupRow.baby_dob || '2026-06-03'
    const tummyTimes = JSON.parse(startupRow.tummy_times_json || '[]')
    const tummySession = startupRow.tummy_session_json ? JSON.parse(startupRow.tummy_session_json) : null
    const session = startupRow.session_json ? JSON.parse(startupRow.session_json) : null
    appendEventLog('startup_state_snapshot', { ...summarizeState(entries, session, startupRow.theme || 'light', diapers, medicines, growthMeasurements, babyDob, tummyTimes, tummySession), entries, diapers, medicines, growthMeasurements, babyDob, tummyTimes, tummySession, session })
  } catch (error) {
    appendEventLog('startup_state_snapshot_failed', { error: redactError(error) })
  }
}
