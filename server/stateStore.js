export const serializeState = (row) => {
  if (!row) return { entries: [], diapers: [], medicines: [], tummyTimes: [], growthMeasurements: [], babyDob: '2026-06-03', tummyGoalMinutes: 20, session: null, tummySession: null, theme: 'light', updatedAt: null }
  return {
    entries: JSON.parse(row.entries_json),
    diapers: JSON.parse(row.diapers_json || '[]'),
    medicines: JSON.parse(row.medicines_json || '[]'),
    tummyTimes: JSON.parse(row.tummy_times_json || '[]'),
    growthMeasurements: JSON.parse(row.growth_measurements_json || '[]'),
    babyDob: row.baby_dob || '2026-06-03',
    tummyGoalMinutes: Number.isFinite(Number(row.tummy_goal_minutes)) ? Math.min(240, Math.max(1, Math.round(Number(row.tummy_goal_minutes)))) : 20,
    session: row.session_json ? JSON.parse(row.session_json) : null,
    tummySession: row.tummy_session_json ? JSON.parse(row.tummy_session_json) : null,
    theme: row.theme || 'light',
    updatedAt: row.updated_at,
  }
}

export const summarizeState = (entries, session, theme, diapers = [], medicines = [], growthMeasurements = [], babyDob = '2026-06-03', tummyTimes = [], tummySession = null) => ({
  entryCount: entries.length,
  diaperCount: diapers.length,
  medicineCount: medicines.length,
  tummyTimeCount: tummyTimes.length,
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

export const createDeletedItemOptionsReader = (selectDeletedItems) => () => {
  const deletedEntryIds = []
  const deletedDiaperIds = []
  const deletedMedicineIds = []
  const deletedTummyTimeIds = []
  const deletedGrowthMeasurementIds = []
  for (const row of selectDeletedItems.all()) {
    if (row.collection === 'entries') deletedEntryIds.push(row.item_id)
    if (row.collection === 'diapers') deletedDiaperIds.push(row.item_id)
    if (row.collection === 'medicines') deletedMedicineIds.push(row.item_id)
    if (row.collection === 'tummyTimes') deletedTummyTimeIds.push(row.item_id)
    if (row.collection === 'growthMeasurements') deletedGrowthMeasurementIds.push(row.item_id)
  }
  return { deletedEntryIds, deletedDiaperIds, deletedMedicineIds, deletedTummyTimeIds, deletedGrowthMeasurementIds }
}

export const createDeletedItemRecorder = (upsertDeletedItem) => (audit, deletedAt) => {
  for (const entry of audit.entries?.removed || []) upsertDeletedItem.run({ item_id: entry.id, collection: 'entries', deleted_at: deletedAt })
  for (const diaper of audit.diapers?.removed || []) upsertDeletedItem.run({ item_id: diaper.id, collection: 'diapers', deleted_at: deletedAt })
  for (const medicine of audit.medicines?.removed || []) upsertDeletedItem.run({ item_id: medicine.id, collection: 'medicines', deleted_at: deletedAt })
  for (const tummyTime of audit.tummyTimes?.removed || []) upsertDeletedItem.run({ item_id: tummyTime.id, collection: 'tummyTimes', deleted_at: deletedAt })
  for (const measurement of audit.growthMeasurements?.removed || []) upsertDeletedItem.run({ item_id: measurement.id, collection: 'growthMeasurements', deleted_at: deletedAt })
}
