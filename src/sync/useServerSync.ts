import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { normalizeSession } from '../domain/trackerDomain'
import type { DiaperEvent, Entry, MedicineEvent, ServerState, Session, Theme } from '../types'

const KEY_PENDING_SYNC = 'baby-feeding-tracker:v1:pending-sync'
const API_STATE = '/api/state'
const API_STATE_EVENTS = '/api/state/events'

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
  const applyingRemoteStateRef = useRef(false)
  const skipNextSyncRef = useRef(false)

  const applyServerState = useCallback((data: ServerState) => {
    applyingRemoteStateRef.current = true
    skipNextSyncRef.current = true
    if (Array.isArray(data.entries)) setEntries([...data.entries].sort((a, b) => b.endedAt - a.endedAt))
    if (Array.isArray(data.diapers)) setDiapers([...data.diapers].sort((a, b) => b.at - a.at))
    if (Array.isArray(data.medicines)) setMedicines([...data.medicines].sort((a, b) => b.at - a.at))
    if (data.session !== undefined) setSession(normalizeSession(data.session))
    if (data.theme === 'light' || data.theme === 'dark') setTheme(data.theme)
    if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
    window.setTimeout(() => { applyingRemoteStateRef.current = false }, 0)
  }, [setDiapers, setEntries, setMedicines, setSession, setTheme])

  const syncToApi = useCallback(async (nextEntries?: Entry[], nextSession?: Session | null, nextTheme?: Theme, nextDiapers?: DiaperEvent[], nextMedicines?: MedicineEvent[]) => {
    const payload = latestPayloadRef.current
    const entriesToSync = nextEntries ?? payload.entries
    const diapersToSync = nextDiapers ?? payload.diapers
    const medicinesToSync = nextMedicines ?? payload.medicines
    const sessionToSync = nextSession ?? payload.session
    const themeToSync = nextTheme ?? payload.theme
    setSyncStatus('syncing')
    try {
      const response = await fetch(API_STATE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entriesToSync, diapers: diapersToSync, medicines: medicinesToSync, session: sessionToSync, theme: themeToSync, updatedAt: serverUpdatedAtRef.current }),
      })
      if (!response.ok) throw new Error('sync failed')
      const data = (await response.json()) as { updatedAt?: string; staleWriteMerged?: boolean; state?: ServerState }
      if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
      if (data.staleWriteMerged && data.state) applyServerState(data.state)
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
      if (localStorage.getItem(KEY_PENDING_SYNC) === '1') {
        setHasHydrated(true)
        await syncToApi()
        return
      }
      try {
        const response = await fetch(API_STATE)
        if (!response.ok) throw new Error('load failed')
        const data = (await response.json()) as ServerState
        applyServerState(data)
        setSyncStatus('synced')
      } catch {
        setSyncStatus(localStorage.getItem(KEY_PENDING_SYNC) === '1' ? 'offline' : 'issue')
      } finally {
        setHasHydrated(true)
      }
    }

    void loadFromApi()
  }, [syncToApi, applyServerState])

  useEffect(() => {
    if (!hasHydrated || typeof EventSource === 'undefined') return
    const events = new EventSource(API_STATE_EVENTS)
    events.onopen = () => {
      if (localStorage.getItem(KEY_PENDING_SYNC) !== '1') setSyncStatus('synced')
    }
    events.addEventListener('state', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as ServerState
        if (data.updatedAt && data.updatedAt === serverUpdatedAtRef.current) return
        applyServerState(data)
        localStorage.removeItem(KEY_PENDING_SYNC)
        setSyncStatus('synced')
      } catch {
        setSyncStatus('offline')
      }
    })
    events.onerror = () => setSyncStatus(localStorage.getItem(KEY_PENDING_SYNC) === '1' ? 'offline' : 'issue')
    return () => events.close()
  }, [hasHydrated, applyServerState])

  useEffect(() => {
    if (!hasHydrated || applyingRemoteStateRef.current) return
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
