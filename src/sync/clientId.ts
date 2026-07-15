// A stable id for THIS browser tab/session. Sent on every write (X-Client-Id)
// and echoed back on the live stream so a tab can ignore its own broadcasts
// while still receiving updates from other tabs/devices on the same baby.
function makeClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // fall through to the non-crypto id below
  }
  return `c-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export const CLIENT_ID = makeClientId()
