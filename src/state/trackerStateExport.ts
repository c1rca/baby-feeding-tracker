import type { DiaperEvent, Entry, MedicineEvent, PumpEvent, PumpSession, Session, Theme, TummyTimeEvent, TummyTimeSession } from '../types'
import type { GrowthMeasurement } from '../domain/growthTypes'

export type TrackerExportState = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  tummyTimes: TummyTimeEvent[]
  pumpEvents: PumpEvent[]
  pumpSession: PumpSession | null
  tummySession: TummyTimeSession | null
  tummyGoalMinutes: number
  growthMeasurements: GrowthMeasurement[]
  babyDob: string
  session: Session | null
  theme: Theme
}

export type TrackerExport = { format: 'baby-feeding-tracker-export'; version: 1; exportedAt: string; state: TrackerExportState }
export type DecodeResult = { ok: true; value: TrackerExport } | { ok: false; error: string }

const byNewest = <T extends { id: string }>(at: (item: T) => number) => (a: T, b: T) => at(b) - at(a) || a.id.localeCompare(b.id)
const defaults = (): Omit<TrackerExportState, 'entries' | 'diapers'> => ({ medicines: [], tummyTimes: [], pumpEvents: [], pumpSession: null, tummySession: null, tummyGoalMinutes: 20, growthMeasurements: [], babyDob: '', session: null, theme: 'light' })

function normalize(state: TrackerExportState): TrackerExportState {
  return {
    ...state,
    entries: [...state.entries].sort(byNewest((item) => item.endedAt)),
    diapers: [...state.diapers].sort(byNewest((item) => item.at)),
    medicines: [...state.medicines].sort(byNewest((item) => item.at)),
    tummyTimes: [...state.tummyTimes].sort(byNewest((item) => item.endedAt)),
    pumpEvents: [...state.pumpEvents].sort(byNewest((item) => item.endedAt)),
    growthMeasurements: [...state.growthMeasurements].sort(byNewest((item) => item.measuredAt)),
  }
}

function isObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function validRecord(value: unknown) { return isObject(value) && typeof value.id === 'string' && value.id.trim().length > 0 }
function validNullableRecord(value: unknown) { return value === null || validRecord(value) }
function arrays(value: Record<string, unknown>, keys: Array<keyof Pick<TrackerExportState, 'entries' | 'diapers' | 'medicines' | 'tummyTimes' | 'pumpEvents' | 'growthMeasurements'>>) { return keys.every((key) => Array.isArray(value[key]) && value[key].every(validRecord)) }

export function makeTrackerExport(state: TrackerExportState, exportedAt = new Date().toISOString()): TrackerExport {
  return { format: 'baby-feeding-tracker-export', version: 1, exportedAt, state: normalize(state) }
}

export function decodeTrackerExport(text: string): DecodeResult {
  let input: unknown
  try { input = JSON.parse(text) } catch { return { ok: false, error: 'The file is not valid JSON.' } }
  if (!isObject(input)) return { ok: false, error: 'The export must be an object.' }
  if (!('version' in input) || (input.version === 1 && !('format' in input) && !('state' in input))) {
    if (!Array.isArray(input.entries) || !Array.isArray(input.diapers) || !input.entries.every(validRecord) || !input.diapers.every(validRecord)) return { ok: false, error: 'The legacy export is missing valid entries or diapers.' }
    return { ok: true, value: makeTrackerExport({ entries: input.entries as Entry[], diapers: input.diapers as DiaperEvent[], ...defaults() }, typeof input.exportedAt === 'string' ? input.exportedAt : new Date(0).toISOString()) }
  }
  if (input.version !== 1) return { ok: false, error: typeof input.version === 'number' && input.version > 1 ? `Export version ${input.version} is newer than this app.` : 'Unsupported export version.' }
  if (input.format !== 'baby-feeding-tracker-export' || !isObject(input.state) || typeof input.exportedAt !== 'string') return { ok: false, error: 'The export envelope is invalid.' }
  const state = input.state
  if (!arrays(state, ['entries', 'diapers', 'medicines', 'tummyTimes', 'pumpEvents', 'growthMeasurements']) || !Number.isFinite(state.tummyGoalMinutes) || typeof state.babyDob !== 'string' || (state.theme !== 'light' && state.theme !== 'dark') || !validNullableRecord(state.session) || !validNullableRecord(state.pumpSession) || !validNullableRecord(state.tummySession)) return { ok: false, error: 'The export state is incomplete or invalid.' }
  return { ok: true, value: makeTrackerExport(state as unknown as TrackerExportState, input.exportedAt) }
}
