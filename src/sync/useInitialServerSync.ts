import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { ServerState } from '../types'
import { loadServerState } from './serverSyncApi'
import { buildPendingSyncPayload } from './serverSyncModels'
import { KEY_PENDING_SYNC, type ServerSyncPayload, type SyncStatus, type SyncToApiOverrides } from './serverSyncTypes'

type InitialServerSyncOptions = {
  latestPayloadRef: MutableRefObject<ServerSyncPayload>
  serverUpdatedAtRef: MutableRefObject<string | null>
  applyServerState: (data: ServerState) => void
  syncToApi: (overrides?: SyncToApiOverrides) => Promise<void>
  setHasHydrated: (hasHydrated: boolean) => void
  setSyncStatus: (status: SyncStatus) => void
}

export function useInitialServerSync({
  latestPayloadRef,
  serverUpdatedAtRef,
  applyServerState,
  syncToApi,
  setHasHydrated,
  setSyncStatus,
}: InitialServerSyncOptions) {
  useEffect(() => {
    const loadFromApi = async () => {
      const hasPendingSync = localStorage.getItem(KEY_PENDING_SYNC) === '1'
      const localPayload = latestPayloadRef.current
      try {
        const serverState = await loadServerState()
        if (hasPendingSync) {
          const mergedPayload = buildPendingSyncPayload(serverState, localPayload)
          if (serverState.updatedAt) serverUpdatedAtRef.current = serverState.updatedAt
          setHasHydrated(true)
          await syncToApi(mergedPayload)
          return
        }
        applyServerState(serverState)
        setSyncStatus('synced')
      } catch {
        if (hasPendingSync) {
          setHasHydrated(true)
          await syncToApi()
          return
        }
        setSyncStatus(localStorage.getItem(KEY_PENDING_SYNC) === '1' ? 'offline' : 'issue')
      } finally {
        setHasHydrated(true)
      }
    }

    void loadFromApi()
  }, [applyServerState, latestPayloadRef, serverUpdatedAtRef, setHasHydrated, setSyncStatus, syncToApi])
}
