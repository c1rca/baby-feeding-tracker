/**
 * Forwards every accepted state write to the append-only Python backup log.
 *
 * Server-side rather than browser-side on purpose. The log speaks plain HTTP on
 * the host, so a phone loading the app over HTTPS could neither reach it nor be
 * allowed to (mixed content), and every such device would queue snapshots it
 * could never deliver. Forwarding from here covers every device equally, and
 * records only what actually reached the database.
 *
 * Two properties keep this from ever harming a caregiver's write:
 *
 *   - It is fire-and-forget. `forward` returns immediately; a slow or dead log
 *     server can never delay or fail the PUT that a caregiver is waiting on.
 *   - A dropped forward is self-healing. Every record carries the *full* state,
 *     so the next successful write re-sends everything the missed one held. A
 *     gap costs history granularity, never the data itself.
 */

const MAX_QUEUE = 200
const RETRY_MS = 10000

export const createActionLogForwarder = ({ url, fetchImpl = globalThis.fetch, log = () => {} } = {}) => {
  const endpoint = (url || '').trim()
  if (!endpoint) return { forward: () => {}, enabled: false, pending: () => 0 }

  const queue = []
  let sending = false
  let retryTimer = null

  const drain = async () => {
    if (sending || queue.length === 0) return
    sending = true
    const batch = queue.splice(0, queue.length)
    try {
      const response = await fetchImpl(`${endpoint}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: batch }),
      })
      if (!response?.ok) throw new Error(`action log responded ${response?.status}`)
    } catch (error) {
      // Put the batch back, newest last, and bound it. Dropping the oldest is
      // safe precisely because each record is a full snapshot: whatever is
      // still queued supersedes anything discarded.
      queue.unshift(...batch)
      if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
      log(`action log forward failed (${queue.length} queued): ${error.message}`)
      if (retryTimer === null) {
        retryTimer = setTimeout(() => { retryTimer = null; void drain() }, RETRY_MS)
        if (typeof retryTimer.unref === 'function') retryTimer.unref()
      }
    } finally {
      sending = false
    }
    if (queue.length > 0 && retryTimer === null) void drain()
  }

  return {
    enabled: true,
    pending: () => queue.length,
    forward: (record) => {
      queue.push(record)
      if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
      // Never await: the caller is inside a request handler.
      void drain()
    },
  }
}
