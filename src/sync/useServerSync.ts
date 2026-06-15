import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeSession } from '../domain/trackerDomain'
import type { Entry, ServerState, Session, Theme } from '../types'
import { loadServerState, saveServerState } from './serverSyncApi'
import { buildApiStatePayload, buildPendingSyncPayload, sortDiapers, sortEntries, sortMedicines } from './serverSyncModels'
import { KEY_PENDING_SYNC, type ServerSyncPayload, type SyncStatus, type UseServerSyncOptions } from './serverSyncTypes'

export const useServerSync = ({
  entries,
  diapers,
  medicines,
  session,
  theme,
  setEntries,
  setDiapers,
  setMedicines,
  setSession,
  setTheme,
}: UseServerSyncOptions) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (localStorage.getItem(KEY_PENDING_SYNC) === '1' ? 'offline' : 'synced'))
  const [hasHydrated, setHasHydrated] = useState(false)
  const latestPayloadRef = useRef<ServerSyncPayload>({ entries, diapers, medicines, session, theme })
  const serverUpdatedAtRef = useRef<string | null>(null)
  const applyingServerStateRef = useRef(false)
  const skipNextSyncRef = useRef(false)

  const applyServerState = useCallback((data: ServerState) => {
    applyingServerStateRef.current = true
    skipNextSyncRef.current = true
    if (Array.isArray(data.entries)) setEntries(sortEntries(data.entries))
    if (Array.isArray(data.diapers)) setDiapers(sortDiapers(data.diapers))
    if (Array.isArray(data.medicines)) setMedicines(sortMedicines(data.medicines))
    if (data.session !== undefined) setSession(normalizeSession(data.session))
    if (data.theme === 'light' || data.theme === 'dark') setTheme(data.theme)
    if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
    window.setTimeout(() => { applyingServerStateRef.current = false }, 0)
  }, [setDiapers, setEntries, setMedicines, setSession, setTheme])

  const syncToApi = useCallback(async (nextEntries?: Entry[], nextSession?: Session | null, nextTheme?: Theme, nextDiapers?: ServerSyncPayload['diapers'], nextMedicines?: ServerSyncPayload['medicines']) => {
    const payload = latestPayloadRef.current
    setSyncStatus('syncing')
    try {
      const data = await saveServerState(buildApiStatePayload(payload, serverUpdatedAtRef.current, {
        entries: nextEntries,
        diapers: nextDiapers,
        medicines: nextMedicines,
        session: nextSession,
        theme: nextTheme,
      }))
      if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
      if (data.state) applyServerState(data.state)
      localStorage.removeItem(KEY_PENDING_SYNC)
      setSyncStatus('synced')
    } catch {
      localStorage.setItem(KEY_PENDING_SYNC, '1')
      setSyncStatus('offline')
    }
  }, [applyServerState])

  useEffect(() => { latestPayloadRef.current = { entries, diapers, medicines, session, theme } }, [entries, diapers, medicines, session, theme])

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
          await syncToApi(mergedPayload.entries, mergedPayload.session, mergedPayload.theme, mergedPayload.diapers, mergedPayload.medicines)
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
  }, [applyServerState, syncToApi])

  useEffect(() => {
    if (!hasHydrated || applyingServerStateRef.current) return
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }
    localStorage.setItem(KEY_PENDING_SYNC, '1')
    window.setTimeout(() => void syncToApi(), 0)
  }, [entries, diapers, medicines, session, theme, hasHydrated, syncToApi])

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

  return { syncStatus, hasHydrated }
}
