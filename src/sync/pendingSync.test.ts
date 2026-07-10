import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KEY_PENDING_SYNC, KEY_PENDING_SYNC_BABY, clearPendingSync, hasAnyPendingSync, hasPendingSyncForBaby, markPendingSync } from './serverSyncTypes'

describe('per-baby pending sync tracking', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('tracks pending changes independently per baby', () => {
    markPendingSync('baby-A')
    markPendingSync('baby-B')
    expect(hasPendingSyncForBaby('baby-A')).toBe(true)
    expect(hasPendingSyncForBaby('baby-B')).toBe(true)
    expect(hasAnyPendingSync()).toBe(true)
  })

  it('clearing one baby does not drop another baby pending marker (B1 regression)', () => {
    markPendingSync('baby-A')
    markPendingSync('baby-B')
    // Baby B syncs successfully...
    clearPendingSync('baby-B')
    // ...baby A's unsynced offline change must survive.
    expect(hasPendingSyncForBaby('baby-A')).toBe(true)
    expect(hasPendingSyncForBaby('baby-B')).toBe(false)
  })

  it('falsy baby ids share the default scope', () => {
    markPendingSync(undefined)
    expect(hasPendingSyncForBaby(null)).toBe(true)
    clearPendingSync(null)
    expect(hasPendingSyncForBaby(undefined)).toBe(false)
    expect(hasAnyPendingSync()).toBe(false)
  })

  it('migrates a legacy untagged flag to the default scope', () => {
    localStorage.setItem(KEY_PENDING_SYNC, '1')
    expect(hasPendingSyncForBaby(undefined)).toBe(true)
  })

  it('migrates a legacy tagged flag to its owning baby only', () => {
    localStorage.setItem(KEY_PENDING_SYNC, '1')
    localStorage.setItem(KEY_PENDING_SYNC_BABY, 'baby-A')
    expect(hasPendingSyncForBaby('baby-A')).toBe(true)
    expect(hasPendingSyncForBaby('baby-B')).toBe(false)
  })

  it('drops the legacy tag key once the set is rewritten', () => {
    localStorage.setItem(KEY_PENDING_SYNC, '1')
    localStorage.setItem(KEY_PENDING_SYNC_BABY, 'baby-A')
    markPendingSync('baby-B')
    expect(localStorage.getItem(KEY_PENDING_SYNC_BABY)).toBeNull()
    expect(hasPendingSyncForBaby('baby-A')).toBe(true)
    expect(hasPendingSyncForBaby('baby-B')).toBe(true)
  })
})
