import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { DiaperEvent, Entry, MedicineEvent, Session, Theme } from '../types'

const KEY_PENDING_SYNC = 'baby-feeding-tracker:v1:pending-sync'

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

// Cross-browser state sync is intentionally disabled for home use. Each browser/window
// keeps its own local active timer so one person's open tracker cannot overwrite another's.
export const useServerSync = (options: UseServerSyncOptions) => {
  void options
  const [syncStatus] = useState<SyncStatus>('synced')

  useEffect(() => {
    localStorage.removeItem(KEY_PENDING_SYNC)
  }, [])

  return { syncStatus }
}
