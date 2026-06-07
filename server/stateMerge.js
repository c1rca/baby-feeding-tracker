export function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
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

export function resolveIncomingState(existingRow, incoming) {
  const stale = isStaleStateWrite(existingRow?.updated_at, incoming.updatedAt)
  if (!stale || !existingRow) return { ...incoming, stale }

  return {
    ...incoming,
    entries: mergeByIdPreservingExisting(parseJsonArray(existingRow.entries_json), incoming.entries),
    diapers: mergeByIdPreservingExisting(parseJsonArray(existingRow.diapers_json), incoming.diapers),
    medicines: mergeByIdPreservingExisting(parseJsonArray(existingRow.medicines_json), incoming.medicines),
    stale,
  }
}
