import { afterEach, describe, expect, it } from 'vitest'
import { clearSyncIntents, collectSyncIntents, readSyncIntents, SYNC_INTENTS_KEY } from './syncIntents'

afterEach(() => localStorage.clear())

describe('sync intent ledger', () => {
  it('persists scoped deletions and cancels them when undo restores the ID', () => {
    const before = { entries: [{ id: 'entry-1' }], diapers: [{ id: 'diaper-1' }] }
    const deleted = { entries: [], diapers: [{ id: 'diaper-1' }] }
    expect(collectSyncIntents('baby-a', before, deleted).deletes.entries).toEqual(['entry-1'])
    expect(readSyncIntents('baby-a').deletes.entries).toEqual(['entry-1'])

    expect(collectSyncIntents('baby-a', deleted, before).restores.entries).toEqual(['entry-1'])
    expect(readSyncIntents('baby-a').deletes.entries).toEqual([])
    expect(readSyncIntents('baby-a').restores.entries).toEqual(['entry-1'])
    expect(localStorage.getItem(SYNC_INTENTS_KEY)).toContain('baby-a')
  })

  // Regression: a delete that has already been acknowledged clears the local
  // intent ledger, so a later undo had nothing left to convert into a restore.
  // The server keeps its tombstone, the re-added record is stripped from the
  // very next response, and the caregiver's undo is lost with no error.
  it('restores an ID that reappears after its deletion was already acknowledged', () => {
    const before = { entries: [{ id: 'entry-1' }] }
    const deleted = { entries: [] }
    collectSyncIntents('baby-a', before, deleted)

    // A successful sync clears the ledger, exactly as useServerSync does.
    clearSyncIntents('baby-a')
    expect(readSyncIntents('baby-a').deletes.entries).toEqual([])

    expect(collectSyncIntents('baby-a', deleted, before).restores.entries).toEqual(['entry-1'])
    expect(readSyncIntents('baby-a').restores.entries).toEqual(['entry-1'])
  })

  it('reports a newly created ID as a restore, which is a no-op against an absent tombstone', () => {
    expect(collectSyncIntents('baby-a', { entries: [] }, { entries: [{ id: 'entry-new' }] }).restores.entries).toEqual(['entry-new'])
  })

  it('leaves untouched IDs out of both intent lists', () => {
    const state = { entries: [{ id: 'entry-1' }], diapers: [{ id: 'diaper-1' }] }
    const intents = collectSyncIntents('baby-a', state, state)
    expect(intents.restores.entries).toEqual([])
    expect(intents.deletes.entries).toEqual([])
  })
})
