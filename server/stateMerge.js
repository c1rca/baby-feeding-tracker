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

export function mergeByIdPreservingExisting(existingItems, incomingItems) {
  const merged = byId(existingItems)
  for (const item of Array.isArray(incomingItems) ? incomingItems : []) {
    if (item?.id) merged.set(item.id, item)
  }
  return [...merged.values()]
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
export function resolveIncomingState(existingRow, incoming) {
  const stale = isStaleStateWrite(existingRow?.updated_at, incoming.updatedAt)
  if (!stale || !existingRow) return { ...incoming, stale }

  return {
    ...incoming,
    entries: mergeByIdPreservingExisting(parseJsonArray(existingRow.entries_json), incoming.entries),
    diapers: mergeByIdPreservingExisting(parseJsonArray(existingRow.diapers_json), incoming.diapers),
    medicines: mergeByIdPreservingExisting(parseJsonArray(existingRow.medicines_json), incoming.medicines),
    session: parseJsonValue(existingRow.session_json, null),
    stale,
  }
}
