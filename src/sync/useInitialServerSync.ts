import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { ServerState } from '../types'
import { loadServerState } from './serverSyncApi'
import { buildPendingSyncPayload } from './serverSyncModels'
import { hasPendingSyncForBaby, type ServerSyncPayload, type SyncStatus, type SyncToApiOverrides } from './serverSyncTypes'

type InitialServerSyncOptions = {
  latestPayloadRef: MutableRefObject<ServerSyncPayload>
  serverUpdatedAtRef: MutableRefObject<string | null>
  applyServerState: (data: ServerState) => void
  syncToApi: (overrides?: SyncToApiOverrides) => Promise<void>
  selectedBabyId?: string | null
  setHasHydrated: (hasHydrated: boolean) => void
  setSyncStatus: (status: SyncStatus) => void
}

export function useInitialServerSync({
  latestPayloadRef,
  serverUpdatedAtRef,
  applyServerState,
  syncToApi,
  selectedBabyId,
  setHasHydrated,
  setSyncStatus,
}: InitialServerSyncOptions) {
  useEffect(() => {
    const loadFromApi = async () => {
      // Only replay a pending change if it belongs to the baby we are loading;
      // a change queued for another baby must not be pushed into this scope.
      const pendingForThisBaby = hasPendingSyncForBaby(selectedBabyId)
      const localPayloadAtStart = latestPayloadRef.current
      try {
        const serverState = await loadServerState({ babyId: selectedBabyId })
        // A local edit made while the initial GET was outstanding (e.g. starting
        // a sleep timer the instant the app opens) is not yet marked pending —
        // the persist effect is gated on hydration. Blindly applying the server
        // snapshot here would silently discard that in-flight work. Detect the
        // divergence (the payload ref is replaced whenever tracked state changes)
        // and route through the same merge-and-push path as a pending replay so
        // the local edit survives instead of vanishing a few seconds after load.
        const localChangedDuringLoad = latestPayloadRef.current !== localPayloadAtStart
        if (pendingForThisBaby || localChangedDuringLoad) {
          const mergedPayload = buildPendingSyncPayload(serverState, latestPayloadRef.current)
          if (serverState.updatedAt) serverUpdatedAtRef.current = serverState.updatedAt
          setHasHydrated(true)
          await syncToApi(mergedPayload)
          return
        }
        applyServerState(serverState)
        setSyncStatus('synced')
      } catch {
        if (pendingForThisBaby) {
          setHasHydrated(true)
          await syncToApi()
          return
        }
        setSyncStatus(pendingForThisBaby ? 'offline' : 'issue')
      } finally {
        setHasHydrated(true)
      }
    }

    void loadFromApi()
  }, [applyServerState, latestPayloadRef, selectedBabyId, serverUpdatedAtRef, setHasHydrated, setSyncStatus, syncToApi])
}
