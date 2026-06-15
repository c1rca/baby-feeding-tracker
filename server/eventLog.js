import fs from 'node:fs'

export const redactError = (error) => ({
  name: error?.name ?? 'Error',
  message: error?.message ?? String(error),
})

export function createEventLogger(eventLogPath) {
  return (event, payload = {}) => {
    const record = { at: new Date().toISOString(), event, ...payload }
    try {
      fs.appendFileSync(eventLogPath, `${JSON.stringify(record)}\n`, { encoding: 'utf8' })
    } catch (error) {
      console.warn('event log write failed', redactError(error))
    }
  }
}
