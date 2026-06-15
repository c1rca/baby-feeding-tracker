export const serializeState = (row) => {
  if (!row) return { entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: null }
  return {
    entries: JSON.parse(row.entries_json),
    diapers: JSON.parse(row.diapers_json || '[]'),
    medicines: JSON.parse(row.medicines_json || '[]'),
    session: row.session_json ? JSON.parse(row.session_json) : null,
    theme: row.theme || 'light',
    updatedAt: row.updated_at,
  }
}

export const summarizeState = (entries, session, theme, diapers = [], medicines = []) => ({
  entryCount: entries.length,
  diaperCount: diapers.length,
  medicineCount: medicines.length,
  latestEntryId: entries[0]?.id ?? null,
  latestEndedAt: entries[0]?.endedAt ?? null,
  hasSession: Boolean(session),
  sessionStartedAt: session?.startedAt ?? null,
  theme,
})

export const createDeletedItemOptionsReader = (selectDeletedItems) => () => {
  const deletedEntryIds = []
  const deletedDiaperIds = []
  const deletedMedicineIds = []
  for (const row of selectDeletedItems.all()) {
    if (row.collection === 'entries') deletedEntryIds.push(row.item_id)
    if (row.collection === 'diapers') deletedDiaperIds.push(row.item_id)
    if (row.collection === 'medicines') deletedMedicineIds.push(row.item_id)
  }
  return { deletedEntryIds, deletedDiaperIds, deletedMedicineIds }
}

export const createDeletedItemRecorder = (upsertDeletedItem) => (audit, deletedAt) => {
  for (const entry of audit.entries?.removed || []) upsertDeletedItem.run({ item_id: entry.id, collection: 'entries', deleted_at: deletedAt })
  for (const diaper of audit.diapers?.removed || []) upsertDeletedItem.run({ item_id: diaper.id, collection: 'diapers', deleted_at: deletedAt })
  for (const medicine of audit.medicines?.removed || []) upsertDeletedItem.run({ item_id: medicine.id, collection: 'medicines', deleted_at: deletedAt })
}
