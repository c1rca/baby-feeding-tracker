import { useEffect, useRef } from 'react'
import { hasPendingSyncForBaby, markPendingSync, type ServerSyncPayload, type SyncToApiOverrides } from './serverSyncTypes'
import { collectSyncIntents } from './syncIntents'

// Trailing debounce so a burst of edits (e.g. typing a note, rapid taps)
// coalesces into one whole-state PUT instead of one PUT per mutation.
export const SYNC_DEBOUNCE_MS = 600

type PersistLocalChangesOptions = {
  hasHydrated: boolean
  isApplyingServerState: () => boolean
  consumeSkipNextSync: () => boolean
  syncToApi: (overrides?: SyncToApiOverrides) => Promise<void>
  selectedBabyId?: string | null
  entries: ServerSyncPayload['entries']
  diapers: ServerSyncPayload['diapers']
  medicines: ServerSyncPayload['medicines']
  tummyTimes: ServerSyncPayload['tummyTimes']
  pumpEvents: ServerSyncPayload['pumpEvents']
  pumpSession: ServerSyncPayload['pumpSession']
  tummySession: ServerSyncPayload['tummySession']
  tummyGoalMinutes: ServerSyncPayload['tummyGoalMinutes']
  // The pump goals have no writer of their own — this debounced full-state PUT
  // is the only thing that persists them. Leaving them out of the deps below
  // means editing a goal produces no PUT at all and the change is lost on
  // reload, which is exactly how they shipped broken upstream.
  pumpGoalOunces: ServerSyncPayload['pumpGoalOunces']
  pumpGoalSessions: ServerSyncPayload['pumpGoalSessions']
  // Health records have no writer of their own on this branch either. Upstream
  // they are persisted by durable entity operations, so adding them here would
  // double-write; here the debounced whole-state PUT is all there is, and
  // without them an immunisation or milestone stays on the device until some
  // unrelated change happens to carry it.
  healthRecords: ServerSyncPayload['healthRecords']
  customTrackers: ServerSyncPayload['customTrackers']
  customEvents: ServerSyncPayload['customEvents']
  growthMeasurements: ServerSyncPayload['growthMeasurements']
  babyDob: ServerSyncPayload['babyDob']
  session: ServerSyncPayload['session']
  theme: ServerSyncPayload['theme']
}

export function usePersistLocalChanges({
  hasHydrated,
  isApplyingServerState,
  consumeSkipNextSync,
  syncToApi,
  selectedBabyId,
  entries,
  diapers,
  medicines,
  tummyTimes,
  pumpEvents,
  pumpSession,
  tummySession,
  tummyGoalMinutes,
  pumpGoalOunces,
  pumpGoalSessions,
  healthRecords,
  customTrackers,
  customEvents,
  growthMeasurements,
  babyDob,
  session,
  theme,
}: PersistLocalChangesOptions) {
  const debounceRef = useRef<number | undefined>(undefined)
  const previousCollectionsRef = useRef({ entries, diapers, medicines, tummyTimes, pumpEvents, growthMeasurements, healthRecords, customTrackers, customEvents })
  useEffect(() => {
    if (!hasHydrated) return
    const currentCollections = { entries, diapers, medicines, tummyTimes, pumpEvents, growthMeasurements, healthRecords, customTrackers, customEvents }
    if (isApplyingServerState()) {
      previousCollectionsRef.current = currentCollections
      consumeSkipNextSync()
      return
    }
    collectSyncIntents(selectedBabyId, previousCollectionsRef.current, currentCollections)
    previousCollectionsRef.current = currentCollections
    if (consumeSkipNextSync()) return

    // Record the pending marker immediately (so an offline state is captured
    // even before the debounce fires), then debounce the actual PUT.
    markPendingSync(selectedBabyId)
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = undefined
      void syncToApi()
    }, SYNC_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current)
    }
  }, [hasHydrated, isApplyingServerState, consumeSkipNextSync, syncToApi, selectedBabyId, entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, healthRecords, customTrackers, customEvents, growthMeasurements, babyDob, session, theme])
}

export function usePendingSyncRetry(syncToApi: (overrides?: SyncToApiOverrides) => Promise<void>, selectedBabyId?: string | null) {
  useEffect(() => {
    const retrySync = () => {
      if (hasPendingSyncForBaby(selectedBabyId)) void syncToApi()
    }

    window.addEventListener('online', retrySync)
    window.addEventListener('focus', retrySync)
    return () => {
      window.removeEventListener('online', retrySync)
      window.removeEventListener('focus', retrySync)
    }
  }, [syncToApi, selectedBabyId])
}
