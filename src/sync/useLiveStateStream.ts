import { useEffect, useRef } from 'react'
import type { ServerState } from '../types'
import { CLIENT_ID } from './clientId'
import { API_STATE } from './serverSyncTypes'

// After this many consecutive connection errors with no successful frame we
// stop reconnecting. This keeps auth-mode (where EventSource cannot send the
// bearer token and every connect 401s) from hammering the server forever;
// pull-on-open + push-on-change still work in that case.
const MAX_CONSECUTIVE_ERRORS = 6

type LiveState = ServerState & { origin?: string }

type UseLiveStateStreamOptions = {
  enabled: boolean
  babyId?: string | null
  // Called for every remote snapshot that did NOT originate from this tab.
  onState: (state: ServerState) => void
  onOpen?: () => void
  onClose?: () => void
}

// Subscribes to the server's Server-Sent-Events state stream and forwards each
// remote snapshot. It never mutates state itself and never writes to the
// server — receiving is strictly read-only. Self-originated broadcasts (same
// X-Client-Id) are dropped so a writer does not react to its own echo.
export function useLiveStateStream({ enabled, babyId, onState, onOpen, onClose }: UseLiveStateStreamOptions) {
  const onStateRef = useRef(onState)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onStateRef.current = onState }, [onState])
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

    const scoped = String(babyId || '').trim()
    const url = scoped ? `${API_STATE}/events?babyId=${encodeURIComponent(scoped)}` : `${API_STATE}/events`
    let stopped = false
    let errorCount = 0
    const source = new EventSource(url)

    source.addEventListener('open', () => {
      errorCount = 0
      onOpenRef.current?.()
    })
    source.addEventListener('state', (event) => {
      errorCount = 0
      try {
        const data = JSON.parse((event as MessageEvent).data) as LiveState
        if (data?.origin && data.origin === CLIENT_ID) return // our own echo
        onStateRef.current(data)
      } catch {
        // Ignore a malformed frame; the next frame carries full state anyway.
      }
    })
    source.addEventListener('ping', () => { errorCount = 0 })
    source.onerror = () => {
      if (stopped) return
      errorCount += 1
      if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
        stopped = true
        source.close()
        onCloseRef.current?.()
      }
      // Otherwise EventSource auto-reconnects with its own backoff.
    }

    return () => {
      stopped = true
      source.close()
      onCloseRef.current?.()
    }
  }, [enabled, babyId])
}
