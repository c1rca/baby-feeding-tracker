import { useEffect, useRef } from 'react'
import type { ServerState } from '../types'
import { authFetch } from '../auth/authSession'
import { CLIENT_ID } from './clientId'
import { API_STATE } from './serverSyncTypes'

// Stop retrying after repeated failed connection attempts (for example an auth
// rejection), while leaving pull-on-open + push-on-change available.
const MAX_CONSECUTIVE_ERRORS = 6
const RECONNECT_DELAY_MS = 1000

type LiveState = ServerState & { origin?: string }

type UseLiveStateStreamOptions = {
  enabled: boolean
  babyId?: string | null
  // Called for every remote snapshot that did NOT originate from this tab.
  onState: (state: ServerState) => void
  onOpen?: () => void
  onClose?: () => void
}

const waitForReconnect = (signal: AbortSignal) => new Promise<void>((resolve) => {
  const timer = window.setTimeout(resolve, RECONNECT_DELAY_MS)
  signal.addEventListener('abort', () => {
    window.clearTimeout(timer)
    resolve()
  }, { once: true })
})

const parseEvent = (frame: string) => {
  let event = 'message'
  const data: string[] = []
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  return { event, data: data.join('\n') }
}

// Subscribes to the server's Server-Sent-Events state stream using authFetch so
// bearer-authenticated deployments can send Authorization. It never mutates
// state itself and drops self-originated broadcasts from this tab.
export function useLiveStateStream({ enabled, babyId, onState, onOpen, onClose }: UseLiveStateStreamOptions) {
  const onStateRef = useRef(onState)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onStateRef.current = onState }, [onState])
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof fetch === 'undefined') return

    const scoped = String(babyId || '').trim()
    const url = scoped ? `${API_STATE}/events?babyId=${encodeURIComponent(scoped)}` : `${API_STATE}/events`
    const controller = new AbortController()
    let stopped = false
    let errorCount = 0

    const receive = async () => {
      while (!stopped) {
        try {
          const response = await authFetch(url, { cache: 'no-store', signal: controller.signal })
          if (!response.ok || !response.body) throw new Error(`SSE connection failed: ${response.status}`)

          errorCount = 0
          onOpenRef.current?.()
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          while (!stopped) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const frames = buffer.split(/\r?\n\r?\n/)
            buffer = frames.pop() ?? ''
            for (const frame of frames) {
              const parsed = parseEvent(frame)
              if (parsed.event === 'ping') { errorCount = 0; continue }
              if (parsed.event !== 'state') continue
              errorCount = 0
              try {
                const data = JSON.parse(parsed.data) as LiveState
                if (data?.origin !== CLIENT_ID) onStateRef.current(data)
              } catch {
                // Ignore malformed frames; each valid state frame is complete.
              }
            }
          }
          try { await reader.cancel() } catch { /* already closed */ }
        } catch {
          if (stopped || controller.signal.aborted) break
          errorCount += 1
          if (errorCount >= MAX_CONSECUTIVE_ERRORS) break
        }
        if (!stopped) await waitForReconnect(controller.signal)
      }
      if (!stopped) onCloseRef.current?.()
    }

    void receive()
    return () => {
      stopped = true
      controller.abort()
      onCloseRef.current?.()
    }
  }, [enabled, babyId])
}
