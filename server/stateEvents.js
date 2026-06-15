export const sendStateEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export const createStateEventHub = ({ selectState, serializeState }) => {
  const clients = new Set()

  const broadcastStateChange = (payload) => {
    for (const res of clients) sendStateEvent(res, 'state', payload)
  }

  const handleStateEvents = (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.flushHeaders?.()
    clients.add(res)
    sendStateEvent(res, 'state', serializeState(selectState.get()))
    const heartbeat = setInterval(() => sendStateEvent(res, 'ping', { at: new Date().toISOString() }), 25000)
    req.on('close', () => {
      clearInterval(heartbeat)
      clients.delete(res)
      res.end()
    })
  }

  return { broadcastStateChange, handleStateEvents }
}
