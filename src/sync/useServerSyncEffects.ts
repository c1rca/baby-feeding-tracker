import { useEffect } from 'react'
import { KEY_PENDING_SYNC, type ServerSyncPayload, type SyncToApiOverrides } from './serverSyncTypes'

type PersistLocalChangesOptions = {
  hasHydrated: boolean
  isApplyingServerState: () => boolean
  consumeSkipNextSync: () => boolean
  syncToApi: (overrides?: SyncToApiOverrides) => Promise<void>
  entries: ServerSyncPayload['entries']
  diapers: ServerSyncPayload['diapers']
  medicines: ServerSyncPayload['medicines']
  tummyTimes: ServerSyncPayload['tummyTimes']
  tummySession: ServerSyncPayload['tummySession']
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
  entries,
  diapers,
  medicines,
  tummyTimes,
  tummySession,
  growthMeasurements,
  babyDob,
  session,
  theme,
}: PersistLocalChangesOptions) {
  useEffect(() => {
    if (!hasHydrated) return
    if (isApplyingServerState()) {
      consumeSkipNextSync()
      return
    }
    if (consumeSkipNextSync()) return

    localStorage.setItem(KEY_PENDING_SYNC, '1')
    window.setTimeout(() => void syncToApi(), 0)
  }, [hasHydrated, isApplyingServerState, consumeSkipNextSync, syncToApi, entries, diapers, medicines, tummyTimes, tummySession, growthMeasurements, babyDob, session, theme])
}

export function usePendingSyncRetry(syncToApi: (overrides?: SyncToApiOverrides) => Promise<void>) {
  useEffect(() => {
    const retrySync = () => {
      if (localStorage.getItem(KEY_PENDING_SYNC) === '1') void syncToApi()
    }

    window.addEventListener('online', retrySync)
    window.addEventListener('focus', retrySync)
    return () => {
      window.removeEventListener('online', retrySync)
      window.removeEventListener('focus', retrySync)
    }
  }, [syncToApi])
}
