import { describe, expect, it } from 'vitest'
import { buildPendingSyncPayload, mergeQueuedSyncOverrides } from './serverSyncModels'
import type { ServerSyncPayload } from './serverSyncTypes'
import type { CustomTracker } from '../types'

const payload = (id: string, theme: 'light' | 'dark'): ServerSyncPayload => ({
  entries: [{ id, type: 'breast', startedAt: id === 'new-local' ? 3 : 1, endedAt: id === 'new-local' ? 4 : 2, leftSeconds: 1, rightSeconds: 0, bottleOunces: null, note: '' }],
  diapers: [], medicines: [], tummyTimes: [], pumpEvents: [], pumpSession: null, tummySession: null,
  tummyGoalMinutes: 20, pumpGoalOunces: 0, pumpGoalSessions: 0, growthMeasurements: [], healthRecords: [], customTrackers: [], customEvents: [], babyDob: '2026-06-03', session: null, theme,
})

describe('mergeQueuedSyncOverrides', () => {
  it('rebases an older queued merge onto the newest local state', () => {
    const olderMerged = payload('server', 'light')
    const newerLocal = payload('new-local', 'dark')
    const result = mergeQueuedSyncOverrides(olderMerged, newerLocal)
    expect(result.entries?.map((entry) => entry.id)).toEqual(['new-local'])
    expect(result.theme).toBe('dark')
  })

  it('does not resurrect an item deleted after the override was queued', () => {
    const olderMerged = payload('server', 'light')
    const newerLocal = { ...payload('new-local', 'dark'), entries: [] }
    expect(mergeQueuedSyncOverrides(olderMerged, newerLocal).entries).toEqual([])
  })
})

// The initial-load window: a change made before hydration finishes is not yet
// marked pending, so it is merged with the server snapshot rather than being
// overwritten by it. If the server copy won here, archiving a tracker just
// after opening the app would silently undo itself a second later.
describe('custom trackers through the pending-replay merge', () => {
  const tracker = (over: Partial<CustomTracker> = {}): CustomTracker => ({
    id: 't1', name: 'Vitamin C', icon: 'pill', hue: 'vitamin', goal: { kind: 'once' }, createdAt: 1000, archivedAt: null, ...over,
  })
  const merged = (server: CustomTracker[], local: CustomTracker[]) =>
    buildPendingSyncPayload({ customTrackers: server, updatedAt: 'v1' }, { ...payload('local', 'light'), customTrackers: local })
      .customTrackers.map((item) => `${item.name}:${item.archivedAt ? 'archived' : 'active'}`)

  it('keeps a local archive made during the load window', () => {
    expect(merged([tracker()], [tracker({ archivedAt: 5000 })])).toEqual(['Vitamin C:archived'])
  })

  it('keeps a local restore made during the load window', () => {
    expect(merged([tracker({ archivedAt: 5000 })], [tracker({ archivedAt: null })])).toEqual(['Vitamin C:active'])
  })

  it('keeps a tracker added during the load window without dropping the server’s', () => {
    const added = tracker({ id: 't2', name: 'Physio', createdAt: 2000 })
    expect(merged([tracker()], [tracker(), added]).sort()).toEqual(['Physio:active', 'Vitamin C:active'])
  })

  it('does not drop a tracker this device has never seen', () => {
    const remote = tracker({ id: 't2', name: 'Physio', createdAt: 2000 })
    expect(merged([tracker(), remote], [tracker({ archivedAt: 5000 })]).sort()).toEqual(['Physio:active', 'Vitamin C:archived'])
  })
})
