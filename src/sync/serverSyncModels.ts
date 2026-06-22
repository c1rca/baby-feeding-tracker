import { normalizeSession } from '../domain/trackerDomain'
import { normalizeGrowthMeasurements } from '../domain/growth'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, MedicineEvent, ServerState } from '../types'
import type { ServerSyncPayload } from './serverSyncTypes'

export function sortEntries(entries: Entry[]) {
  return [...entries].sort((a, b) => b.endedAt - a.endedAt)
}

export function sortDiapers(diapers: DiaperEvent[]) {
  return [...diapers].sort((a, b) => b.at - a.at)
}

export function sortMedicines(medicines: MedicineEvent[]) {
  return [...medicines].sort((a, b) => b.at - a.at)
}

export function sortGrowthMeasurements(growthMeasurements: GrowthMeasurement[]) {
  return normalizeGrowthMeasurements(growthMeasurements)
}

export function mergeById<T extends { id: string }>(serverItems: T[] | undefined, localItems: T[] | undefined) {
  const merged = new Map<string, T>()
  for (const item of Array.isArray(serverItems) ? serverItems : []) merged.set(item.id, item)
  for (const item of Array.isArray(localItems) ? localItems : []) merged.set(item.id, item)
  return [...merged.values()]
}

export function buildPendingSyncPayload(serverState: ServerState, localPayload: ServerSyncPayload): ServerSyncPayload {
  const serverSession = normalizeSession(serverState.session ?? null)

  return {
    entries: sortEntries(mergeById(serverState.entries, localPayload.entries)),
    diapers: sortDiapers(mergeById(serverState.diapers, localPayload.diapers)),
    medicines: sortMedicines(mergeById(serverState.medicines, localPayload.medicines)),
    growthMeasurements: sortGrowthMeasurements(mergeById(serverState.growthMeasurements, localPayload.growthMeasurements)),
    babyDob: serverState.babyDob || localPayload.babyDob || '2026-06-03',
    session: serverSession ?? localPayload.session,
    theme: localPayload.theme ?? serverState.theme ?? 'light',
  }
}

export function buildApiStatePayload(
  currentPayload: ServerSyncPayload,
  serverUpdatedAt: string | null,
  overrides: Partial<ServerSyncPayload> = {},
) {
  return {
    entries: overrides.entries ?? currentPayload.entries,
    diapers: overrides.diapers ?? currentPayload.diapers,
    medicines: overrides.medicines ?? currentPayload.medicines,
    growthMeasurements: overrides.growthMeasurements ?? currentPayload.growthMeasurements,
    babyDob: overrides.babyDob ?? currentPayload.babyDob,
    session: overrides.session ?? currentPayload.session,
    theme: overrides.theme ?? currentPayload.theme,
    updatedAt: serverUpdatedAt,
  }
}
