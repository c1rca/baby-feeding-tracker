import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServerState } from '../types'
import { loadServerState, saveServerState } from './serverSyncApi'
import { buildApiStatePayload, mergeQueuedSyncOverrides } from './serverSyncModels'
import { clearPendingSync, hasPendingSyncForBaby, markPendingSync, type SyncStatus, type SyncToApiOverrides, type UseServerSyncOptions } from './serverSyncTypes'
import { useInitialServerSync } from './useInitialServerSync'
import { useLatestServerPayload, useServerStateApplier } from './useServerStateApplier'
import { usePendingSyncRetry, usePersistLocalChanges } from './useServerSyncEffects'
import { useLiveStateStream } from './useLiveStateStream'
import { useBackgroundResync } from './useBackgroundResync'

// Coalesce a focus+visibilitychange burst (they fire together on tab return)
// into a single fetch, while still letting the periodic poll through.
const RESYNC_MIN_GAP_MS = 4000

export type LiveSyncConflictChoice = 'theirs' | 'mine'

export const useServerSync = (options: UseServerSyncOptions & { liveSyncEnabled?: boolean }) => {
  // Default OFF: the live subscription is an explicit opt-in (the app passes the
  // per-device setting). Callers that don't opt in keep pure pull/push sync.
  const { entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme, selectedBabyId, liveSyncEnabled = false } = options
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (hasPendingSyncForBaby(selectedBabyId) ? 'offline' : 'synced'))
  const [hasHydrated, setHasHydrated] = useState(false)
  const [liveConflict, setLiveConflict] = useState<ServerState | null>(null)
  const [liveConnected, setLiveConnected] = useState(false)
  const latestPayloadRef = useLatestServerPayload(options)
  const { applyServerState, applyingServerStateRef, serverUpdatedAtRef, skipNextSyncRef } = useServerStateApplier(options)
  // Single-flight: never overlap PUTs. Concurrent writes could return out of
  // order, letting a stale updatedAt regress serverUpdatedAtRef so the next
  // write is treated as a stale replay and its deletes are dropped. A request
  // made while one is in flight schedules exactly one trailing rerun, which
  // reads the latest payload — so the newest state still lands.
  const inFlightRef = useRef(false)
  const rerunRef = useRef(false)
  const rerunOverridesRef = useRef<SyncToApiOverrides | null>(null)
  const pullingRef = useRef(false)
  const lastPullAtRef = useRef(0)
  const syncToApiRef = useRef<(overrides?: SyncToApiOverrides) => Promise<void>>(async () => {})

  const syncToApi = useCallback(async (overrides: SyncToApiOverrides = {}) => {
    if (inFlightRef.current) {
      // An override sync (the initial merge) must not be dropped; run it as a
      // trailing rerun with its overrides once the in-flight sync settles.
      rerunRef.current = true
      if (Object.keys(overrides).length > 0) rerunOverridesRef.current = { ...(rerunOverridesRef.current ?? {}), ...overrides }
      return
    }
    inFlightRef.current = true
    const payload = latestPayloadRef.current
    setSyncStatus('syncing')
    try {
      const data = await saveServerState(buildApiStatePayload(payload, serverUpdatedAtRef.current, overrides), { babyId: selectedBabyId })
      if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
      if (data.state) applyServerState(data.state)
      clearPendingSync(selectedBabyId)
      // Our write adopted the server's merged truth, so any held remote update
      // is now reconciled — drop the conflict prompt.
      setLiveConflict(null)
      setSyncStatus('synced')
    } catch {
      markPendingSync(selectedBabyId)
      setSyncStatus('offline')
    } finally {
      inFlightRef.current = false
      if (rerunRef.current) {
        rerunRef.current = false
        const rerunOverrides = rerunOverridesRef.current ? mergeQueuedSyncOverrides(rerunOverridesRef.current, latestPayloadRef.current) : undefined
        rerunOverridesRef.current = null
        void syncToApiRef.current(rerunOverrides)
      }
    }
  }, [applyServerState, latestPayloadRef, selectedBabyId, serverUpdatedAtRef])
  // Keep the ref pointing at the latest syncToApi so the in-flight rerun calls
  // the current closure (setting a ref during render is disallowed).
  useEffect(() => {
    syncToApiRef.current = syncToApi
  }, [syncToApi])

  const isApplyingServerState = useCallback(() => applyingServerStateRef.current, [applyingServerStateRef])
  const consumeSkipNextSync = useCallback(() => {
    if (!skipNextSyncRef.current) return false
    skipNextSyncRef.current = false
    return true
  }, [skipNextSyncRef])

  // Live receive. Safety invariant: serverUpdatedAtRef is only ever advanced by
  // applyServerState adopting that same snapshot. So if we decline to apply an
  // incoming update (because this device has unsaved local work), we stay
  // "stale" and our next write goes through the server's merge contract — which
  // preserves the active feed session and never deletes by omission. A viewer
  // with nothing pending applies every update instantly.
  const handleRemoteState = useCallback((incoming: ServerState) => {
    if (!incoming?.updatedAt) return
    const known = serverUpdatedAtRef.current
    if (known && incoming.updatedAt <= known) return // echo or older snapshot — never regress
    const hasUnsavedLocalWork = hasPendingSyncForBaby(selectedBabyId) || inFlightRef.current
    if (!hasUnsavedLocalWork) {
      applyServerState(incoming)
      setLiveConflict(null)
      return
    }
    // Genuine conflict: hold the incoming snapshot and let the user choose,
    // rather than silently overwriting their in-progress edit.
    setLiveConflict(incoming)
  }, [applyServerState, selectedBabyId, serverUpdatedAtRef])

  const resolveLiveConflict = useCallback((choice: LiveSyncConflictChoice) => {
    setLiveConflict((current) => {
      if (current && choice === 'theirs') {
        applyServerState(current) // adopt the latest, discarding local unsaved work
        clearPendingSync(selectedBabyId)
        setSyncStatus('synced')
      }
      // 'mine' → keep local edits; their pending sync PUTs stale and the server
      // merges both sides, then we adopt the merged truth on the write response.
      return null
    })
  }, [applyServerState, selectedBabyId])

  // Background resync (visibility/focus/online + a periodic fallback). This is
  // read-only and strictly additive: it only ever fast-forwards a quiet viewer
  // to a newer server snapshot. It bails whenever this device has unsaved work
  // in flight or queued, whenever it is mid-apply, and whenever the fetched
  // snapshot is not strictly newer than what we already hold — so it can never
  // regress serverUpdatedAtRef, echo a write, or overwrite an in-progress edit.
  // Anything pending is left to the push path, which merges via the server.
  const pullLatest = useCallback(() => {
    if (pullingRef.current || inFlightRef.current || applyingServerStateRef.current) return
    if (hasPendingSyncForBaby(selectedBabyId)) return
    const startedAt = Date.now()
    if (startedAt - lastPullAtRef.current < RESYNC_MIN_GAP_MS) return
    lastPullAtRef.current = startedAt
    pullingRef.current = true
    void (async () => {
      try {
        const incoming = await loadServerState({ babyId: selectedBabyId })
        if (!incoming?.updatedAt) return
        const known = serverUpdatedAtRef.current
        if (known && incoming.updatedAt <= known) return // same or older snapshot — nothing to do
        // Re-check after the await: a local edit or push may have begun while
        // the fetch was outstanding, so defer to the push path if so.
        if (inFlightRef.current || hasPendingSyncForBaby(selectedBabyId)) return
        applyServerState(incoming)
        setLiveConflict(null)
      } catch {
        // Transient network/offline errors are non-fatal — the next trigger retries.
      } finally {
        pullingRef.current = false
      }
    })()
  }, [applyServerState, applyingServerStateRef, selectedBabyId, serverUpdatedAtRef])

  useBackgroundResync({ pullLatest, liveConnected })

  useLiveStateStream({
    enabled: liveSyncEnabled,
    babyId: selectedBabyId,
    onState: handleRemoteState,
    onOpen: useCallback(() => setLiveConnected(true), []),
    onClose: useCallback(() => setLiveConnected(false), []),
  })

  useInitialServerSync({ latestPayloadRef, serverUpdatedAtRef, applyServerState, syncToApi, selectedBabyId, setHasHydrated, setSyncStatus })
  usePersistLocalChanges({ hasHydrated, isApplyingServerState, consumeSkipNextSync, syncToApi, selectedBabyId, entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme })
  usePendingSyncRetry(syncToApi, selectedBabyId)

  return { syncStatus, hasHydrated, liveConflict, resolveLiveConflict, liveConnected }
}
