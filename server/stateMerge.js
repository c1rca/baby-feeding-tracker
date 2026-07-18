export function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseJsonValue(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function byId(items) {
  const map = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.id) map.set(item.id, item)
  }
  return map
}

export function mergeByIdPreservingExisting(existingItems, incomingItems, deletedIds = []) {
  const merged = byId(existingItems)
  const deleted = new Set(Array.isArray(deletedIds) ? deletedIds : [])
  for (const item of Array.isArray(incomingItems) ? incomingItems : []) {
    if (item?.id && !deleted.has(item.id)) merged.set(item.id, item)
  }
  return [...merged.values()]
}

function isFeedEntry(entry) {
  return entry?.type === 'breast' || entry?.type === 'bottle' || entry?.type === 'mixed'
}

function feedSideSignature(entry) {
  return [Number(entry?.leftSeconds || 0) > 0 ? 'L' : '', Number(entry?.rightSeconds || 0) > 0 ? 'R' : '', Number(entry?.bottleOunces || 0) > 0 ? 'B' : ''].join('')
}

function sameLegacyFeedSave(a, b) {
  if (!isFeedEntry(a) || !isFeedEntry(b)) return false
  if (a.sourceSessionId || b.sourceSessionId) return false
  if (!Number.isFinite(a.startedAt) || a.startedAt !== b.startedAt) return false
  if (a.type !== b.type) return false
  if (feedSideSignature(a) !== feedSideSignature(b)) return false
  const endedDelta = Math.abs(Number(a.endedAt || 0) - Number(b.endedAt || 0))
  const leftDelta = Math.abs(Number(a.leftSeconds || 0) - Number(b.leftSeconds || 0))
  const rightDelta = Math.abs(Number(a.rightSeconds || 0) - Number(b.rightSeconds || 0))
  const bottleDelta = Math.abs(Number(a.bottleOunces || 0) - Number(b.bottleOunces || 0))
  return endedDelta <= 30000 && leftDelta <= 30 && rightDelta <= 30 && bottleDelta < 0.01
}

function sameFeedSave(a, b) {
  if (!isFeedEntry(a) || !isFeedEntry(b)) return false
  if (a.sourceSessionId && b.sourceSessionId && a.sourceSessionId === b.sourceSessionId) return true
  return sameLegacyFeedSave(a, b)
}

export function mergeEntriesPreservingExisting(existingEntries, incomingEntries, deletedIds = []) {
  const merged = byId(existingEntries)
  const deleted = new Set(Array.isArray(deletedIds) ? deletedIds : [])
  for (const item of Array.isArray(incomingEntries) ? incomingEntries : []) {
    if (!item?.id || deleted.has(item.id)) continue
    const duplicateExisting = [...merged.values()].find((existing) => existing.id !== item.id && sameFeedSave(existing, item))
    if (duplicateExisting) continue
    merged.set(item.id, item)
  }
  return [...merged.values()]
}

// Bucket key that partitions feed entries so two entries can only be a duplicate
// pair if they share a key. It encodes the *necessary* conditions for a match in
// sameFeedSave: a sourceSessionId match needs equal ids; a legacy match needs
// equal startedAt+type+side. Non-feed entries return null (never deduped). This
// lets dedupe compare within tiny buckets instead of scanning every prior entry.
function feedDedupeKey(entry) {
  if (!isFeedEntry(entry)) return null
  if (entry.sourceSessionId) return `sid:${entry.sourceSessionId}`
  return `leg:${Number(entry.startedAt)}|${entry.type}|${feedSideSignature(entry)}`
}

// O(1)-amortized duplicate lookup keyed by feedDedupeKey. sameFeedSave is still
// the authority — the bucket only pre-filters candidates — so behaviour is
// identical to a full O(n) scan, just without the O(n^2) cost over long history.
function createFeedDuplicateIndex() {
  const buckets = new Map()
  return {
    findDuplicate(entry) {
      const key = feedDedupeKey(entry)
      if (key === null) return undefined
      return buckets.get(key)?.find((kept) => kept.id !== entry.id && sameFeedSave(kept, entry))
    },
    add(entry) {
      const key = feedDedupeKey(entry)
      if (key === null) return
      const bucket = buckets.get(key)
      if (bucket) bucket.push(entry)
      else buckets.set(key, [entry])
    },
  }
}

export function dedupeFeedEntries(entries) {
  const deduped = []
  const index = createFeedDuplicateIndex()
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry?.id) continue
    if (index.findDuplicate(entry)) continue
    deduped.push(entry)
    index.add(entry)
  }
  return deduped
}

export function isStaleStateWrite(existingUpdatedAt, clientUpdatedAt) {
  if (!existingUpdatedAt) return false
  if (!clientUpdatedAt) return true
  return clientUpdatedAt !== existingUpdatedAt
}

// Sync safety contract:
// - Current clients may replace full state intentionally.
// - Stale clients are treated as offline replays and may only add/update ID-based entities.
// - Stale clients must not delete server-only entities by omission.
// - Stale clients must not replace active server session state; session conflict handling stays server-authoritative until sessions have IDs/revisions.
export function resolveIncomingState(existingRow, incoming, options = {}) {
  const stale = isStaleStateWrite(existingRow?.updated_at, incoming.updatedAt)
  if (!stale || !existingRow) return { ...incoming, entries: dedupeFeedEntries(incoming.entries), stale }

  return {
    ...incoming,
    entries: mergeEntriesPreservingExisting(parseJsonArray(existingRow.entries_json), incoming.entries, options.deletedEntryIds),
    diapers: mergeByIdPreservingExisting(parseJsonArray(existingRow.diapers_json), incoming.diapers, options.deletedDiaperIds),
    medicines: mergeByIdPreservingExisting(parseJsonArray(existingRow.medicines_json), incoming.medicines, options.deletedMedicineIds),
    tummyTimes: mergeByIdPreservingExisting(parseJsonArray(existingRow.tummy_times_json), incoming.tummyTimes, options.deletedTummyTimeIds),
    pumpEvents: mergeByIdPreservingExisting(parseJsonArray(existingRow.pump_events_json), incoming.pumpEvents, options.deletedPumpEventIds),
    pumpSession: parseJsonValue(existingRow.pump_session_json, null),
    tummySession: parseJsonValue(existingRow.tummy_session_json, null),
    tummyGoalMinutes: Number.isFinite(Number(existingRow.tummy_goal_minutes)) ? Math.min(240, Math.max(1, Math.round(Number(existingRow.tummy_goal_minutes)))) : incoming.tummyGoalMinutes,
    growthMeasurements: mergeByIdPreservingExisting(parseJsonArray(existingRow.growth_measurements_json), incoming.growthMeasurements, options.deletedGrowthMeasurementIds),
    babyDob: existingRow.baby_dob || incoming.babyDob || '2026-06-03',
    session: parseJsonValue(existingRow.session_json, null),
    stale,
  }
}
