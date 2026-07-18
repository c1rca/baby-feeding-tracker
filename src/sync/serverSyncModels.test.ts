import { describe, expect, it } from 'vitest'
import { mergeQueuedSyncOverrides } from './serverSyncModels'
import type { ServerSyncPayload } from './serverSyncTypes'

const payload = (id: string, theme: 'light' | 'dark'): ServerSyncPayload => ({
  entries: [{ id, type: 'breast', startedAt: id === 'new-local' ? 3 : 1, endedAt: id === 'new-local' ? 4 : 2, leftSeconds: 1, rightSeconds: 0, bottleOunces: null, note: '' }],
  diapers: [], medicines: [], tummyTimes: [], pumpEvents: [], pumpSession: null, tummySession: null,
  tummyGoalMinutes: 20, growthMeasurements: [], babyDob: '2026-06-03', session: null, theme,
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
