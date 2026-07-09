import type { Dispatch, SetStateAction } from 'react'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, MedicineEvent, Session, Theme, TummyTimeEvent, TummyTimeSession } from '../types'

export const KEY_PENDING_SYNC = 'baby-feeding-tracker:v1:pending-sync'
export const KEY_PENDING_SYNC_BABY = 'baby-feeding-tracker:v1:pending-sync-baby'
export const PENDING_SYNC_DEFAULT_BABY = 'default'
export const API_STATE = '/api/state'

// The pending-sync flag is tagged with the baby it belongs to so a queued
// offline change for one baby is never replayed into another baby's scope
// after a switch.
export const markPendingSync = (babyId?: string | null) => {
  try {
    localStorage.setItem(KEY_PENDING_SYNC, '1')
    localStorage.setItem(KEY_PENDING_SYNC_BABY, babyId || PENDING_SYNC_DEFAULT_BABY)
  } catch {
    // Persistence is best-effort; the retry-on-focus path still covers this visit.
  }
}

export const clearPendingSync = () => {
  try {
    localStorage.removeItem(KEY_PENDING_SYNC)
    localStorage.removeItem(KEY_PENDING_SYNC_BABY)
  } catch {
    // Nothing stored means nothing to clear.
  }
}

export const hasPendingSync = (): boolean => {
  try {
    return localStorage.getItem(KEY_PENDING_SYNC) === '1'
  } catch {
    return false
  }
}

// A legacy flag written before tagging has no owner; treat it as the current
// baby so a genuine pre-upgrade offline change is not silently dropped.
export const pendingSyncMatchesBaby = (babyId?: string | null): boolean => {
  let owner: string | null
  try {
    owner = localStorage.getItem(KEY_PENDING_SYNC_BABY)
  } catch {
    return true
  }
  if (owner === null) return true
  return owner === (babyId || PENDING_SYNC_DEFAULT_BABY)
}

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'issue'

export type ServerSyncPayload = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  tummyTimes: TummyTimeEvent[]
  tummySession: TummyTimeSession | null
  tummyGoalMinutes: number
  growthMeasurements: GrowthMeasurement[]
  babyDob: string
  session: Session | null
  theme: Theme
}

export type SyncToApiOverrides = Partial<ServerSyncPayload>

export type UseServerSyncOptions = ServerSyncPayload & {
  selectedBabyId?: string | null
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setDiapers: Dispatch<SetStateAction<DiaperEvent[]>>
  setMedicines: Dispatch<SetStateAction<MedicineEvent[]>>
  setTummyTimes: Dispatch<SetStateAction<TummyTimeEvent[]>>
  setTummySession: Dispatch<SetStateAction<TummyTimeSession | null>>
  setTummyGoalMinutes: Dispatch<SetStateAction<number>>
  setGrowthMeasurements: Dispatch<SetStateAction<GrowthMeasurement[]>>
  setBabyDob: Dispatch<SetStateAction<string>>
  setSession: Dispatch<SetStateAction<Session | null>>
  setTheme: Dispatch<SetStateAction<Theme>>
}
