import { useEffect } from 'react'
import { KEY_PENDING_SYNC, type ServerSyncPayload } from './serverSyncTypes'

type PersistLocalChangesOptions = {
  hasHydrated: boolean
  isApplyingServerState: () => boolean
  consumeSkipNextSync: () => boolean
  syncToApi: () => Promise<void>
  entries: ServerSyncPayload['entries']
  diapers: ServerSyncPayload['diapers']
  medicines: ServerSyncPayload['medicines']
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
  }, [hasHydrated, isApplyingServerState, consumeSkipNextSync, syncToApi, entries, diapers, medicines, growthMeasurements, babyDob, session, theme])
}

export function usePendingSyncRetry(syncToApi: () => Promise<void>) {
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
