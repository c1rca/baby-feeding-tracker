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

export const createStateEventHub = ({ selectState, selectStateForBaby = null, serializeState }) => {
  const clients = new Map()

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
    const clientId = Symbol('state-event-client')
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.flushHeaders?.()
    clients.set(clientId, { res, scope, scopeKey: scopeKey(scope) })
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
