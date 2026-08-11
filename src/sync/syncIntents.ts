export const SYNC_INTENTS_KEY = 'baby-feeding-tracker:v1:sync-intents'

export const ID_COLLECTIONS = ['entries', 'diapers', 'medicines', 'tummyTimes', 'pumpEvents', 'growthMeasurements', 'healthRecords', 'customTrackers', 'customEvents'] as const
type Collection = typeof ID_COLLECTIONS[number]
type Item = { id: string }
type State = Partial<Record<Collection, Item[]>>
export type SyncIntents = { deletes: Record<Collection, string[]>; restores: Record<Collection, string[]> }
type ScopedIntents = Record<string, SyncIntents>

const empty = (): SyncIntents => {
  const deletes = {} as SyncIntents['deletes']
  const restores = {} as SyncIntents['restores']
  for (const collection of ID_COLLECTIONS) { deletes[collection] = []; restores[collection] = [] }
  return { deletes, restores }
}
const scope = (babyId?: string | null) => babyId || 'default'

const readAll = (): ScopedIntents => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_INTENTS_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch { return {} }
}
const writeAll = (all: ScopedIntents) => localStorage.setItem(SYNC_INTENTS_KEY, JSON.stringify(all))
export const readSyncIntents = (babyId?: string | null): SyncIntents => ({ ...empty(), ...(readAll()[scope(babyId)] || {}) })

// A local removal becomes an explicit delete intent. Reappearance (undo) changes
// that intent into a restore so the server can remove its scoped tombstone.
export const collectSyncIntents = (babyId: string | null | undefined, before: State, after: State): SyncIntents => {
  const all = readAll()
  const intents = readSyncIntents(babyId)
  for (const collection of ID_COLLECTIONS) {
    const prior = new Set((before[collection] || []).map((item) => item.id))
    const next = new Set((after[collection] || []).map((item) => item.id))
    for (const id of prior) if (!next.has(id) && !intents.deletes[collection].includes(id)) intents.deletes[collection].push(id)
    for (const id of next) {
      // Anything already queued for deletion has come back; cancel that intent.
      if (intents.deletes[collection].includes(id)) {
        intents.deletes[collection] = intents.deletes[collection].filter((candidate) => candidate !== id)
      } else if (prior.has(id)) {
        continue // unchanged — neither deleted nor re-added
      }
      // Every id that appears where the previous snapshot had none is reported
      // as a restore, whether it is brand new or brought back by Undo.
      //
      // Once a delete has been acknowledged the local intent ledger is cleared,
      // so by the time Undo re-adds the record there is nothing left to tell a
      // restore apart from a creation. Over-reporting costs nothing: a restore
      // intent for an id the server has no tombstone for is a no-op. Under-
      // reporting silently loses data — the server keeps its tombstone, strips
      // the record from the very next response, and the row disappears again
      // with no error shown to the caregiver.
      if (!intents.restores[collection].includes(id)) intents.restores[collection].push(id)
    }
  }
  all[scope(babyId)] = intents
  writeAll(all)
  return intents
}

export const clearSyncIntents = (babyId?: string | null) => {
  const all = readAll()
  delete all[scope(babyId)]
  writeAll(all)
}
