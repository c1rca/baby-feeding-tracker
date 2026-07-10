import fs from 'node:fs'
import path from 'node:path'

export const redactError = (error) => ({
  name: error?.name ?? 'Error',
  message: error?.message ?? String(error),
})

export function createEventLogger(eventLogPath) {
  // The event log can contain health records (startup snapshots are the
  // replay-based recovery path) and contact details, so keep it owner-only.
  // Create it up front with 0600 and re-assert perms in case an older run left
  // a world-readable file behind.
  try {
    fs.mkdirSync(path.dirname(eventLogPath), { recursive: true })
    fs.closeSync(fs.openSync(eventLogPath, 'a', 0o600))
    fs.chmodSync(eventLogPath, 0o600)
  } catch (error) {
    console.warn('event log init failed', redactError(error))
  }
  return (event, payload = {}) => {
    const record = { at: new Date().toISOString(), event, ...payload }
    try {
      fs.appendFileSync(eventLogPath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 })
    } catch (error) {
      console.warn('event log write failed', redactError(error))
    }
  }
}
