import { DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID } from './database.js'

export const sendStateEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

const scopeFromRequest = (req) => ({
  householdId: req.auth?.householdId || DEFAULT_HOUSEHOLD_ID,
  babyId: req.auth?.babyId || DEFAULT_BABY_ID,
})

const scopeKey = (scope) => `${scope.householdId}:${scope.babyId}`

export const createStateEventHub = ({ selectState, selectStateForBaby = null, serializeState }) => {
  const clients = new Map()

  const selectInitialState = (scope) => {
    if (selectStateForBaby) return selectStateForBaby.get(scope.householdId, scope.babyId)
    return selectState.get()
  }

  const broadcastStateChange = (payload, scope = null) => {
    for (const client of clients.values()) {
      if (scope && client.scopeKey !== scopeKey(scope)) continue
      sendStateEvent(client.res, 'state', payload)
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
