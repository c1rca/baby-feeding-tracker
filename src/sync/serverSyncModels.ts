import { normalizeSession } from '../domain/trackerDomain'
import { normalizeTummyTimeGoalMinutes } from '../domain/tummyTime'
import { normalizeGrowthMeasurements } from '../domain/growth'
import { normalizeHealthRecords } from '../domain/healthRecords'
import { normalizeCustomEvents, normalizeCustomTrackers } from '../domain/customTrackers'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, HealthRecord, MedicineEvent, PumpEvent, ServerState, TummyTimeEvent, CustomTracker, CustomEvent } from '../types'
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

export function sortTummyTimes(tummyTimes: TummyTimeEvent[]) {
  return [...tummyTimes].sort((a, b) => b.startedAt - a.startedAt)
}

export function sortPumpEvents(pumpEvents: PumpEvent[]) {
  return [...pumpEvents].sort((a, b) => b.startedAt - a.startedAt)
}

export function sortHealthRecords(healthRecords: HealthRecord[]) {
  return normalizeHealthRecords(healthRecords)
}

export function sortCustomTrackers(customTrackers: CustomTracker[]) {
  return normalizeCustomTrackers(customTrackers)
}

export function sortCustomEvents(customEvents: CustomEvent[]) {
  return normalizeCustomEvents(customEvents)
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
    tummyTimes: sortTummyTimes(mergeById(serverState.tummyTimes, localPayload.tummyTimes)),
    pumpEvents: sortPumpEvents(mergeById(serverState.pumpEvents, localPayload.pumpEvents)),
    pumpSession: serverState.pumpSession ?? localPayload.pumpSession,
    tummySession: serverState.tummySession ?? localPayload.tummySession,
    tummyGoalMinutes: normalizeTummyTimeGoalMinutes(serverState.tummyGoalMinutes ?? localPayload.tummyGoalMinutes),
    pumpGoalOunces: serverState.pumpGoalOunces ?? localPayload.pumpGoalOunces,
    pumpGoalSessions: serverState.pumpGoalSessions ?? localPayload.pumpGoalSessions,
    growthMeasurements: sortGrowthMeasurements(mergeById(serverState.growthMeasurements, localPayload.growthMeasurements)),
    healthRecords: sortHealthRecords(mergeById(serverState.healthRecords, localPayload.healthRecords)),
    customTrackers: sortCustomTrackers(mergeById(serverState.customTrackers, localPayload.customTrackers)),
    customEvents: sortCustomEvents(mergeById(serverState.customEvents, localPayload.customEvents)),
    babyDob: serverState.babyDob || localPayload.babyDob || '2026-06-03',
    session: serverSession ?? localPayload.session,
    theme: localPayload.theme ?? serverState.theme ?? 'light',
  }
}

export function mergeQueuedSyncOverrides(older: Partial<ServerSyncPayload>, current: ServerSyncPayload): Partial<ServerSyncPayload> {
  const next: Partial<ServerSyncPayload> = {}
  for (const key of Object.keys(older) as (keyof ServerSyncPayload)[]) {
    Object.assign(next, { [key]: current[key] })
  }
  return next
}

export function buildApiStatePayload(
  currentPayload: ServerSyncPayload,
  serverUpdatedAt: string | null,
  overrides: Partial<ServerSyncPayload> = {},
  syncIntents?: unknown,
) {
  return {
    entries: overrides.entries ?? currentPayload.entries,
    diapers: overrides.diapers ?? currentPayload.diapers,
    medicines: overrides.medicines ?? currentPayload.medicines,
    tummyTimes: overrides.tummyTimes ?? currentPayload.tummyTimes,
    pumpEvents: overrides.pumpEvents ?? currentPayload.pumpEvents,
    pumpSession: overrides.pumpSession ?? currentPayload.pumpSession,
    tummySession: overrides.tummySession ?? currentPayload.tummySession,
    tummyGoalMinutes: normalizeTummyTimeGoalMinutes(overrides.tummyGoalMinutes ?? currentPayload.tummyGoalMinutes),
    pumpGoalOunces: overrides.pumpGoalOunces ?? currentPayload.pumpGoalOunces,
    pumpGoalSessions: overrides.pumpGoalSessions ?? currentPayload.pumpGoalSessions,
    growthMeasurements: overrides.growthMeasurements ?? currentPayload.growthMeasurements,
    healthRecords: overrides.healthRecords ?? currentPayload.healthRecords,
    customTrackers: overrides.customTrackers ?? currentPayload.customTrackers,
    customEvents: overrides.customEvents ?? currentPayload.customEvents,
    babyDob: overrides.babyDob ?? currentPayload.babyDob,
    session: overrides.session ?? currentPayload.session,
    theme: overrides.theme ?? currentPayload.theme,
    syncIntents,
    updatedAt: serverUpdatedAt,
  }
}
