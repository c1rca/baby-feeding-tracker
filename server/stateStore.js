import { DEFAULT_BABY_DOB, DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID } from './database.js'

// A corrupt JSON blob (partial write, disk fault) must not 500 GET /api/state
// or crash the scheduler; fall back to an empty collection/null, matching the
// notification path's guards. DB backups are the recovery path for real data.
const safeParseArray = (value) => {
  try {
    const parsed = JSON.parse(value ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
const safeParseObject = (value) => {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const serializeState = (row) => {
  if (!row) return { householdId: DEFAULT_HOUSEHOLD_ID, babyId: DEFAULT_BABY_ID, entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [], pumpSession: null, growthMeasurements: [], babyDob: DEFAULT_BABY_DOB, tummyGoalMinutes: 20, session: null, tummySession: null, theme: 'dark', updatedAt: null }
  return {
    householdId: row.household_id || DEFAULT_HOUSEHOLD_ID,
    babyId: row.baby_id || DEFAULT_BABY_ID,
    entries: safeParseArray(row.entries_json),
    diapers: safeParseArray(row.diapers_json),
    medicines: safeParseArray(row.medicines_json),
    tummyTimes: safeParseArray(row.tummy_times_json),
    pumpEvents: safeParseArray(row.pump_events_json),
    pumpSession: safeParseObject(row.pump_session_json),
    growthMeasurements: safeParseArray(row.growth_measurements_json),
    babyDob: row.baby_dob || DEFAULT_BABY_DOB,
    tummyGoalMinutes: Number.isFinite(Number(row.tummy_goal_minutes)) ? Math.min(240, Math.max(1, Math.round(Number(row.tummy_goal_minutes)))) : 20,
    session: safeParseObject(row.session_json),
    tummySession: safeParseObject(row.tummy_session_json),
    theme: row.theme || 'light',
    updatedAt: row.updated_at,
  }
}

export const summarizeState = (entries, session, theme, diapers = [], medicines = [], growthMeasurements = [], babyDob = '2026-06-03', tummyTimes = [], tummySession = null, pumpEvents = []) => ({
  entryCount: entries.length,
  diaperCount: diapers.length,
  medicineCount: medicines.length,
  tummyTimeCount: tummyTimes.length,
  pumpEventCount: pumpEvents.length,
  growthMeasurementCount: growthMeasurements.length,
  babyDob,
  latestEntryId: entries[0]?.id ?? null,
  latestEndedAt: entries[0]?.endedAt ?? null,
  hasSession: Boolean(session),
  sessionStartedAt: session?.startedAt ?? null,
  hasTummySession: Boolean(tummySession),
  tummySessionStartedAt: tummySession?.startedAt ?? null,
  theme,
})

export const createDeletedItemOptionsReader = (selectDeletedItems) => (scope = {}) => {
  const householdId = scope.householdId || DEFAULT_HOUSEHOLD_ID
  const babyId = scope.babyId || DEFAULT_BABY_ID
  const deletedEntryIds = []
  const deletedDiaperIds = []
  const deletedMedicineIds = []
  const deletedTummyTimeIds = []
  const deletedPumpEventIds = []
  const deletedGrowthMeasurementIds = []
  for (const row of selectDeletedItems.all(householdId, babyId)) {
    if (row.collection === 'entries') deletedEntryIds.push(row.item_id)
    if (row.collection === 'diapers') deletedDiaperIds.push(row.item_id)
    if (row.collection === 'medicines') deletedMedicineIds.push(row.item_id)
    if (row.collection === 'tummyTimes') deletedTummyTimeIds.push(row.item_id)
    if (row.collection === 'pumpEvents') deletedPumpEventIds.push(row.item_id)
    if (row.collection === 'growthMeasurements') deletedGrowthMeasurementIds.push(row.item_id)
  }
  return { deletedEntryIds, deletedDiaperIds, deletedMedicineIds, deletedTummyTimeIds, deletedPumpEventIds, deletedGrowthMeasurementIds }
}

export const createDeletedItemRecorder = (upsertDeletedItem) => (audit, deletedAt, scope = {}) => {
  const household_id = scope.householdId || DEFAULT_HOUSEHOLD_ID
  const baby_id = scope.babyId || DEFAULT_BABY_ID
  const record = (id, collection) => upsertDeletedItem.run({ item_id: id, collection, household_id, baby_id, deleted_at: deletedAt })
  for (const entry of audit.entries?.removed || []) record(entry.id, 'entries')
  for (const diaper of audit.diapers?.removed || []) record(diaper.id, 'diapers')
  for (const medicine of audit.medicines?.removed || []) record(medicine.id, 'medicines')
  for (const tummyTime of audit.tummyTimes?.removed || []) record(tummyTime.id, 'tummyTimes')
  for (const pumpEvent of audit.pumpEvents?.removed || []) record(pumpEvent.id, 'pumpEvents')
  for (const measurement of audit.growthMeasurements?.removed || []) record(measurement.id, 'growthMeasurements')
}
