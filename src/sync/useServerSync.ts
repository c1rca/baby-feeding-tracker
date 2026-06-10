import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { normalizeSession } from '../domain/trackerDomain'
import type { DiaperEvent, Entry, MedicineEvent, ServerState, Session, Theme } from '../types'

const KEY_PENDING_SYNC = 'baby-feeding-tracker:v1:pending-sync'
const API_STATE = '/api/state'

type SyncStatus = 'syncing' | 'synced' | 'offline' | 'issue'

type UseServerSyncOptions = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  session: Session | null
  theme: Theme
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setDiapers: Dispatch<SetStateAction<DiaperEvent[]>>
  setMedicines: Dispatch<SetStateAction<MedicineEvent[]>>
  setSession: Dispatch<SetStateAction<Session | null>>
  setTheme: Dispatch<SetStateAction<Theme>>
}

export const useServerSync = ({ entries, diapers, medicines, session, theme, setEntries, setDiapers, setMedicines, setSession, setTheme }: UseServerSyncOptions) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (localStorage.getItem(KEY_PENDING_SYNC) === '1' ? 'offline' : 'synced'))
  const [hasHydrated, setHasHydrated] = useState(false)
  const latestPayloadRef = useRef({ entries, diapers, medicines, session, theme })
  const serverUpdatedAtRef = useRef<string | null>(null)
  const applyingServerStateRef = useRef(false)
  const skipNextSyncRef = useRef(false)

  const applyServerState = useCallback((data: ServerState) => {
    applyingServerStateRef.current = true
    skipNextSyncRef.current = true
    if (Array.isArray(data.entries)) setEntries([...data.entries].sort((a, b) => b.endedAt - a.endedAt))
    if (Array.isArray(data.diapers)) setDiapers([...data.diapers].sort((a, b) => b.at - a.at))
    if (Array.isArray(data.medicines)) setMedicines([...data.medicines].sort((a, b) => b.at - a.at))
    if (data.session !== undefined) setSession(normalizeSession(data.session))
    if (data.theme === 'light' || data.theme === 'dark') setTheme(data.theme)
    if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
    window.setTimeout(() => { applyingServerStateRef.current = false }, 0)
  }, [setDiapers, setEntries, setMedicines, setSession, setTheme])

  const loadServerState = useCallback(async () => {
    const response = await fetch(API_STATE, { cache: 'no-store' })
    if (!response.ok) throw new Error('load failed')
    return await response.json() as ServerState
  }, [])

  const mergeById = <T extends { id: string }>(serverItems: T[] | undefined, localItems: T[] | undefined) => {
    const merged = new Map<string, T>()
    for (const item of Array.isArray(serverItems) ? serverItems : []) merged.set(item.id, item)
    for (const item of Array.isArray(localItems) ? localItems : []) merged.set(item.id, item)
    return [...merged.values()]
  }

  const syncToApi = useCallback(async (nextEntries?: Entry[], nextSession?: Session | null, nextTheme?: Theme, nextDiapers?: DiaperEvent[], nextMedicines?: MedicineEvent[]) => {
    const payload = latestPayloadRef.current
    setSyncStatus('syncing')
    try {
      const response = await fetch(API_STATE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: nextEntries ?? payload.entries,
          diapers: nextDiapers ?? payload.diapers,
          medicines: nextMedicines ?? payload.medicines,
          session: nextSession ?? payload.session,
          theme: nextTheme ?? payload.theme,
          updatedAt: serverUpdatedAtRef.current,
        }),
      })
      if (!response.ok) throw new Error('sync failed')
      const data = (await response.json()) as { updatedAt?: string; staleWriteMerged?: boolean; state?: ServerState }
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
          const mergedEntries = mergeById(serverState.entries, localPayload.entries).sort((a, b) => b.endedAt - a.endedAt)
          const mergedDiapers = mergeById(serverState.diapers, localPayload.diapers).sort((a, b) => b.at - a.at)
          const mergedMedicines = mergeById(serverState.medicines, localPayload.medicines).sort((a, b) => b.at - a.at)
          const mergedSession = localPayload.session ?? normalizeSession(serverState.session ?? null)
          const mergedTheme = localPayload.theme ?? serverState.theme ?? 'light'
          if (serverState.updatedAt) serverUpdatedAtRef.current = serverState.updatedAt
          setHasHydrated(true)
          await syncToApi(mergedEntries, mergedSession, mergedTheme, mergedDiapers, mergedMedicines)
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
  }, [applyServerState, loadServerState, syncToApi])

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

  return { syncStatus }
}
