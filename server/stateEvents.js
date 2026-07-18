import { DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID } from './database.js'

export const sendStateEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

// EventSource cannot send custom headers (no X-Baby-Id), so the live stream
// accepts the baby scope via query param and falls back to the auth/default
// scope. The client sends the SAME babyId it uses for its PUT/GET header, so
// an SSE subscriber and a writer resolve to the same scope key and pair up.
const scopeFromRequest = (req) => {
  const queryBabyId = typeof req.query?.babyId === 'string' ? req.query.babyId.trim() : ''
  return {
    householdId: req.auth?.householdId || DEFAULT_HOUSEHOLD_ID,
    babyId: queryBabyId || req.auth?.babyId || DEFAULT_BABY_ID,
  }
}

const scopeKey = (scope) => `${scope.householdId}:${scope.babyId}`

export const createStateEventHub = ({ selectState, selectStateForBaby = null, serializeState, selectBabyForHousehold = null, maxClientsPerUser = 12 }) => {
  const clients = new Map()

  // A single user opening tab after tab (or a malicious client looping EventSource
  // opens) would otherwise hold unbounded server-side connections. Cap per user and
  // evict their oldest stream when a new one would exceed the cap.
  const userKey = (req) => req.auth?.userId || `anon:${req.auth?.householdId || DEFAULT_HOUSEHOLD_ID}`
  const enforceUserCap = (key) => {
    const owned = [...clients.entries()].filter(([, client]) => client.userKey === key)
    if (owned.length < maxClientsPerUser) return
    for (const [id, client] of owned.slice(0, owned.length - maxClientsPerUser + 1)) {
      try { client.res.end() } catch { /* already closed */ }
      clients.delete(id)
    }
  }

  const selectInitialState = (scope) => {
    if (selectStateForBaby) return selectStateForBaby.get(scope.householdId, scope.babyId)
    return selectState.get()
  }

  // `origin` is the writer's X-Client-Id; it is echoed in the event so the
  // originating tab can drop its own broadcast while other subscribers apply it.
  const broadcastStateChange = (payload, scope = null, origin = null) => {
    const data = origin ? { ...payload, origin } : payload
    for (const client of clients.values()) {
      if (scope && client.scopeKey !== scopeKey(scope)) continue
      sendStateEvent(client.res, 'state', data)
    }
  }

  const handleStateEvents = (req, res) => {
    const scope = scopeFromRequest(req)
    // The auth middleware validates the X-Baby-Id header, but EventSource sends the
    // scope as ?babyId= which it never sees — so validate it here exactly like the
    // /api/state routes, before it can select or subscribe to a foreign scope.
    if (selectBabyForHousehold && !selectBabyForHousehold.get(scope.babyId, scope.householdId)) {
      res.status(404).json({ ok: false, error: 'Baby not found' })
      return
    }
    const clientId = Symbol('state-event-client')
    enforceUserCap(userKey(req))
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Tell nginx/OpenResty-family reverse proxies NOT to buffer this response.
      // Without it, proxy_buffering (on by default) holds back the small live
      // frames — the large initial snapshot flushes so data loads on open, but
      // subsequent pushes/heartbeats never reach the browser and live sync
      // silently appears broken behind the proxy while working same-origin.
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders?.()
    clients.set(clientId, { res, scope, scopeKey: scopeKey(scope), userKey: userKey(req) })
    sendStateEvent(res, 'state', serializeState(selectInitialState(scope)))
    const heartbeat = setInterval(() => sendStateEvent(res, 'ping', { at: new Date().toISOString() }), 25000)
    req.on('close', () => {
      clearInterval(heartbeat)
      clients.delete(clientId)
      res.end()
    })
  }

  return { broadcastStateChange, handleStateEvents }
}
