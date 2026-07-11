import type { Dispatch, SetStateAction } from 'react'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, MedicineEvent, PumpEvent, Session, Theme, TummyTimeEvent, TummyTimeSession } from '../types'

export const KEY_PENDING_SYNC = 'baby-feeding-tracker:v1:pending-sync'
export const KEY_PENDING_SYNC_BABY = 'baby-feeding-tracker:v1:pending-sync-baby'
export const PENDING_SYNC_DEFAULT_BABY = 'default'
export const API_STATE = '/api/state'

const pendingBabyKey = (babyId?: string | null) => babyId || PENDING_SYNC_DEFAULT_BABY

// Pending offline changes are tracked as a *set* of baby ids. A single shared
// flag (the previous design) let sync activity on baby B clobber baby A's
// marker — B's success cleared it, B's failure re-tagged it — so switching back
// to A took the non-pending branch and applyServerState silently dropped A's
// unsynced edits. A per-baby set keeps each baby's pending state independent.
const readPendingSet = (): Set<string> => {
  try {
    const raw = localStorage.getItem(KEY_PENDING_SYNC)
    if (raw === null) return new Set()
    // Legacy formats: a bare '1' flag, optionally tagged with one owning baby.
    if (raw === '1') {
      const owner = localStorage.getItem(KEY_PENDING_SYNC_BABY)
      return new Set([owner || PENDING_SYNC_DEFAULT_BABY])
    }
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

const writePendingSet = (pending: Set<string>) => {
  try {
    // The tag key is legacy; ownership now lives in the set itself.
    localStorage.removeItem(KEY_PENDING_SYNC_BABY)
    if (pending.size === 0) {
      localStorage.removeItem(KEY_PENDING_SYNC)
      return
    }
    localStorage.setItem(KEY_PENDING_SYNC, JSON.stringify([...pending]))
  } catch {
    // Persistence is best-effort; the retry-on-focus path still covers this visit.
  }
}

export const markPendingSync = (babyId?: string | null) => {
  const pending = readPendingSet()
  pending.add(pendingBabyKey(babyId))
  writePendingSet(pending)
}

export const clearPendingSync = (babyId?: string | null) => {
  const pending = readPendingSet()
  pending.delete(pendingBabyKey(babyId))
  writePendingSet(pending)
}

// True when *this* baby has an unsynced offline change waiting.
export const hasPendingSyncForBaby = (babyId?: string | null): boolean => readPendingSet().has(pendingBabyKey(babyId))

// True when any baby has an unsynced offline change (used for global status).
export const hasAnyPendingSync = (): boolean => readPendingSet().size > 0

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'issue'

export type ServerSyncPayload = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  tummyTimes: TummyTimeEvent[]
  pumpEvents?: PumpEvent[]
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
  setPumpEvents?: Dispatch<SetStateAction<PumpEvent[]>>
  setTummySession: Dispatch<SetStateAction<TummyTimeSession | null>>
  setTummyGoalMinutes: Dispatch<SetStateAction<number>>
  setGrowthMeasurements: Dispatch<SetStateAction<GrowthMeasurement[]>>
  setBabyDob: Dispatch<SetStateAction<string>>
  setSession: Dispatch<SetStateAction<Session | null>>
  setTheme: Dispatch<SetStateAction<Theme>>
}
