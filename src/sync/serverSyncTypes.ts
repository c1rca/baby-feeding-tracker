import type { Dispatch, SetStateAction } from 'react'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, MedicineEvent, Session, Theme, TummyTimeEvent, TummyTimeSession } from '../types'

export const KEY_PENDING_SYNC = 'baby-feeding-tracker:v1:pending-sync'
export const API_STATE = '/api/state'

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'issue'

export type ServerSyncPayload = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  tummyTimes: TummyTimeEvent[]
  tummySession: TummyTimeSession | null
  growthMeasurements: GrowthMeasurement[]
  babyDob: string
  session: Session | null
  theme: Theme
}

export type UseServerSyncOptions = ServerSyncPayload & {
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setDiapers: Dispatch<SetStateAction<DiaperEvent[]>>
  setMedicines: Dispatch<SetStateAction<MedicineEvent[]>>
  setTummyTimes: Dispatch<SetStateAction<TummyTimeEvent[]>>
  setTummySession: Dispatch<SetStateAction<TummyTimeSession | null>>
  setGrowthMeasurements: Dispatch<SetStateAction<GrowthMeasurement[]>>
  setBabyDob: Dispatch<SetStateAction<string>>
  setSession: Dispatch<SetStateAction<Session | null>>
  setTheme: Dispatch<SetStateAction<Theme>>
}
