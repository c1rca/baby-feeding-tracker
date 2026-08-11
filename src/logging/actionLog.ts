import { CLIENT_ID } from '../sync/clientId'

// The backup log is opt-in per build. An unset URL disables it entirely rather
// than falling back to an origin-relative path, so a build that was never
// configured for logging cannot start posting full state at the app itself.
const ENDPOINT: string = import.meta.env.VITE_ACTION_LOG_URL || ''

export const actionLogEnabled = () => ENDPOINT !== ''

const OUTBOX_KEY = 'tracker.actionLog.outbox.v1'
// Full-state snapshots are large and the outbox only exists to survive a
// server that is briefly down. Keeping the newest slice bounds localStorage
// growth; anything older than this has long since been superseded by a newer
// snapshot of the same state anyway.
const MAX_OUTBOX = 40
const RETRY_MS = 15000
// Browsers allow 64KB of keepalive request bodies in total; stay well under it
// so a snapshot never trips the limit. sendBeacon shares the same budget, which
// is why the pagehide handoff checks its return value and falls back.
const KEEPALIVE_LIMIT = 48 * 1024

export type ActionLogRecord = {
  action: string
  at: string
  clientId: string
  householdId?: string | null
  babyId?: string | null
  counts?: Record<string, number>
  state: unknown
}

let outbox: ActionLogRecord[] = []
let flushing = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let loaded = false

const readOutbox = (): ActionLogRecord[] => {
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeOutbox = () => {
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox))
  } catch {
    // A full quota must not break logging: drop the oldest half and retry once.
    // Losing the oldest superseded snapshots is strictly better than throwing
    // inside a state effect and taking the app down with it.
    outbox = outbox.slice(Math.floor(outbox.length / 2))
    try {
      window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox))
    } catch {
      // Give up on persistence; the in-memory outbox still flushes.
    }
  }
}

const scheduleRetry = () => {
  if (retryTimer !== null || outbox.length === 0) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushActionLog()
  }, RETRY_MS)
}

export async function flushActionLog(): Promise<void> {
  if (!actionLogEnabled() || flushing) return
  if (!loaded) {
    outbox = readOutbox()
    loaded = true
  }
  if (outbox.length === 0) return

  flushing = true
  const batch = outbox.slice()
  const body = JSON.stringify({ actions: batch })
  let delivered = false
  try {
    const response = await fetch(`${ENDPOINT}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      // The spec caps keepalive request bodies at 64KB across all in-flight
      // keepalive requests, and a full-state snapshot blows past that on its
      // own — a real household's state was 441KB. Setting it by record count
      // made the browser refuse the request and the post hang forever, which
      // looked exactly like a healthy client with a dead server. Decide on the
      // encoded size, and leave a margin for the other in-flight requests.
      keepalive: body.length < KEEPALIVE_LIMIT,
    })
    if (!response.ok) throw new Error(`action log responded ${response.status}`)
    // Only drop what this flush actually carried; anything queued while the
    // request was in flight stays for the next one.
    outbox = outbox.slice(batch.length)
    writeOutbox()
    delivered = true
  } catch {
    // Leave the batch queued and back off; the server is down or unreachable.
  } finally {
    flushing = false
  }

  if (outbox.length === 0) return
  // An action recorded while this flush was in flight was refused by the
  // single-flight guard, so nothing else will send it. Waiting for the retry
  // timer would leave the newest action — the one most likely to matter for
  // recovery — sitting on the device for the whole backoff. Send it now, and
  // reserve the delay for the case where the server actually failed.
  if (delivered) void flushActionLog()
  else scheduleRetry()
}

/**
 * How many actions are still waiting to reach the backup log.
 *
 * Reads localStorage rather than the in-memory outbox so it is honest in a tab
 * that has not recorded anything yet but is resuming another tab's backlog.
 */
export function pendingActionLogCount(): number {
  if (!actionLogEnabled()) return 0
  if (loaded) return outbox.length
  return readOutbox().length
}

export function recordAction(record: Omit<ActionLogRecord, 'clientId' | 'at'> & { at?: string }): void {
  if (!actionLogEnabled()) return
  if (!loaded) {
    outbox = readOutbox()
    loaded = true
  }
  outbox.push({ ...record, at: record.at ?? new Date().toISOString(), clientId: CLIENT_ID })
  if (outbox.length > MAX_OUTBOX) outbox = outbox.slice(outbox.length - MAX_OUTBOX)
  writeOutbox()
  void flushActionLog()
}

// A tab being closed or backgrounded is exactly when an unflushed action would
// otherwise be lost, so make a final best-effort handoff to the browser.
export function installActionLogLifecycle(): () => void {
  if (!actionLogEnabled() || typeof window === 'undefined') return () => {}
  const handoff = () => {
    if (outbox.length === 0) return
    try {
      const blob = new Blob([JSON.stringify({ actions: outbox })], { type: 'application/json' })
      if (navigator.sendBeacon(`${ENDPOINT}/log`, blob)) {
        outbox = []
        writeOutbox()
        return
      }
    } catch {
      // fall through to the ordinary flush
    }
    void flushActionLog()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') handoff()
    else void flushActionLog()
  }
  window.addEventListener('pagehide', handoff)
  window.addEventListener('online', () => void flushActionLog())
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.removeEventListener('pagehide', handoff)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
