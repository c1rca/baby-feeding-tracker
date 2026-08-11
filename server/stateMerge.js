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
  const deleted = new Set(Array.isArray(deletedIds) ? deletedIds : [])
  const merged = byId(existingItems)
  for (const id of deleted) merged.delete(id)
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
  const deleted = new Set(Array.isArray(deletedIds) ? deletedIds : [])
  const merged = byId(existingEntries)
  for (const id of deleted) merged.delete(id)
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

function staleSessionMutation(existingSession, incomingSession, incomingEntries) {
  if (!existingSession?.id) return false
  const knownAt = existingSession.activeSide && Number.isFinite(existingSession.segmentStart)
    ? existingSession.segmentStart
    : Math.max(existingSession.startedAt || 0, ...(existingSession.segments || []).map((segment) => segment.endedAt || 0))
  if (incomingSession?.id === existingSession.id && incomingSession.activeSide === null) {
    return Math.max(0, ...(incomingSession.segments || []).map((segment) => segment.endedAt || 0)) >= knownAt
  }
  return incomingSession === null && Array.isArray(incomingEntries) && incomingEntries.some((entry) => entry?.sourceSessionId === existingSession.id && entry.endedAt >= knownAt)
}

// Sync safety contract:
// - Full-state writes may add/update ID-based entities, never delete by omission.
// - A deletion requires a separately persisted, scoped delete intent.
// - Stale clients must not replace active server session state; session conflict handling stays server-authoritative until sessions have IDs/revisions.
export function resolveIncomingState(existingRow, incoming, options = {}) {
  const stale = isStaleStateWrite(existingRow?.updated_at, incoming.updatedAt)
  if (!existingRow) return { ...incoming, entries: dedupeFeedEntries(incoming.entries), stale }
  const intents = options.deleteIntents || {}
  const restores = options.restoreIntents || {}
  const existingSession = parseJsonValue(existingRow.session_json, null)
  const acceptStaleSessionMutation = staleSessionMutation(existingSession, incoming.session, incoming.entries)
  const deleted = (collection, legacyKey) => [...new Set([...(options[legacyKey] || []), ...(intents[collection] || [])].filter((id) => !(restores[collection] || []).includes(id)))]

  return {
    ...incoming,
    entries: mergeEntriesPreservingExisting(parseJsonArray(existingRow.entries_json), incoming.entries, deleted('entries', 'deletedEntryIds')),
    diapers: mergeByIdPreservingExisting(parseJsonArray(existingRow.diapers_json), incoming.diapers, deleted('diapers', 'deletedDiaperIds')),
    medicines: mergeByIdPreservingExisting(parseJsonArray(existingRow.medicines_json), incoming.medicines, deleted('medicines', 'deletedMedicineIds')),
    tummyTimes: mergeByIdPreservingExisting(parseJsonArray(existingRow.tummy_times_json), incoming.tummyTimes, deleted('tummyTimes', 'deletedTummyTimeIds')),
    pumpEvents: mergeByIdPreservingExisting(parseJsonArray(existingRow.pump_events_json), incoming.pumpEvents, deleted('pumpEvents', 'deletedPumpEventIds')),
    growthMeasurements: mergeByIdPreservingExisting(parseJsonArray(existingRow.growth_measurements_json), incoming.growthMeasurements, deleted('growthMeasurements', 'deletedGrowthMeasurementIds')),
    healthRecords: mergeByIdPreservingExisting(parseJsonArray(existingRow.health_records_json), incoming.healthRecords, deleted('healthRecords', 'deletedHealthRecordIds')),
    customTrackers: mergeByIdPreservingExisting(parseJsonArray(existingRow.custom_trackers_json), incoming.customTrackers, deleted('customTrackers', 'deletedCustomTrackerIds')),
    customEvents: mergeByIdPreservingExisting(parseJsonArray(existingRow.custom_events_json), incoming.customEvents, deleted('customEvents', 'deletedCustomEventIds')),
    pumpSession: stale ? parseJsonValue(existingRow.pump_session_json, null) : incoming.pumpSession,
    tummySession: stale ? parseJsonValue(existingRow.tummy_session_json, null) : incoming.tummySession,
    tummyGoalMinutes: stale && Number.isFinite(Number(existingRow.tummy_goal_minutes)) ? Math.min(240, Math.max(1, Math.round(Number(existingRow.tummy_goal_minutes)))) : incoming.tummyGoalMinutes,
    pumpGoalOunces: stale && Number.isFinite(Number(existingRow.pump_goal_ounces)) ? Math.min(500, Math.max(0, Math.round(Number(existingRow.pump_goal_ounces)))) : incoming.pumpGoalOunces,
    pumpGoalSessions: stale && Number.isFinite(Number(existingRow.pump_goal_sessions)) ? Math.min(50, Math.max(0, Math.round(Number(existingRow.pump_goal_sessions)))) : incoming.pumpGoalSessions,
    babyDob: stale ? existingRow.baby_dob || incoming.babyDob || '2026-06-03' : incoming.babyDob,
    session: stale && !acceptStaleSessionMutation ? existingSession : incoming.session,
    stale,
  }
}
