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
export const createRateLimiter = ({ max, windowMs, now = () => Date.now() } = {}) => {
  const hits = new Map()

  const current = (key) => {
    const record = hits.get(key)
    if (record && now() - record.firstAt > windowMs) {
      hits.delete(key)
      return null
    }
    return record ?? null
  }

  return {
    // true once the key has reached `max` hits inside the window.
    isLimited: (key) => (current(key)?.count ?? 0) >= max,
    record: (key) => {
      const record = current(key)
      if (record) record.count += 1
      else hits.set(key, { count: 1, firstAt: now() })
    },
    reset: (key) => hits.delete(key),
  }
}

export const clientIp = (req) => req?.ip || req?.socket?.remoteAddress || 'unknown'
