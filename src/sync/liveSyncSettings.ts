// Per-device kill switch for the live (real-time) sync stream. Default ON.
// When OFF, the app behaves exactly as before: state loads on open and pushes
// on change (with the offline queue) — no live EventSource is opened.
const KEY = 'baby-feeding-tracker:v1:live-sync-enabled'

export const readLiveSyncEnabled = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export const persistLiveSyncEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off')
  } catch {
    // Best-effort; the in-memory toggle still applies for this visit.
  }
}
