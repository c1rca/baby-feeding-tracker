// A tiny in-memory sliding-window limiter shared across credential endpoints.
//
// It counts "hits" per key inside a rolling window. Two usage shapes:
//   - Failure lockout (login, code confirm): record() only on failure, reset()
//     on success — so a legitimate user is never locked out by their own wins.
//   - Attempt throttle (SMS/email send): record() on every accepted request to
//     cap outbound volume (anti-bombing / cost abuse), never reset.
//
// State is per-process and lost on restart; that is acceptable for a
// single-container deploy and is a deliberate simplicity trade-off. If the app
// grows to multiple instances this must move to a shared store.
export const createRateLimiter = ({ max, windowMs, now = () => Date.now(), sweepThreshold = 1024 } = {}) => {
  const hits = new Map()

  const current = (key) => {
    const record = hits.get(key)
    if (record && now() - record.firstAt > windowMs) {
      hits.delete(key)
      return null
    }
    return record ?? null
  }

  // Entries expire lazily on access, so spamming distinct keys (a fresh email or
  // phone each request) would otherwise grow the Map without bound for the process
  // lifetime. When the Map crosses the threshold, drop every expired entry in one
  // pass — bounding memory to roughly the count of keys active within the window.
  const sweepExpired = () => {
    if (hits.size < sweepThreshold) return
    const cutoff = now() - windowMs
    for (const [key, record] of hits) {
      if (record.firstAt <= cutoff) hits.delete(key)
    }
  }

  return {
    // true once the key has reached `max` hits inside the window.
    isLimited: (key) => (current(key)?.count ?? 0) >= max,
    record: (key) => {
      sweepExpired()
      const record = current(key)
      if (record) record.count += 1
      else hits.set(key, { count: 1, firstAt: now() })
    },
    reset: (key) => hits.delete(key),
  }
}

export const clientIp = (req) => req?.ip || req?.socket?.remoteAddress || 'unknown'
