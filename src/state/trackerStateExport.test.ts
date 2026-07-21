import { describe, expect, it } from 'vitest'
import { decodeTrackerExport, makeTrackerExport, type TrackerExportState } from './trackerStateExport'

const state: TrackerExportState = {
  entries: [{ id: 'feed-older', type: 'bottle', startedAt: 10, endedAt: 20, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3 }, { id: 'feed-newer', type: 'breast', startedAt: 30, endedAt: 40, leftSeconds: 10, rightSeconds: 0, bottleOunces: null }],
  diapers: [{ id: 'diaper-older', at: 10, context: 'standalone', kinds: ['wet'] }, { id: 'diaper-newer', at: 30, context: 'feed', kinds: ['stool'] }],
  medicines: [{ id: 'medicine-1', kind: 'vitamin_d', at: 25 }],
  tummyTimes: [{ id: 'tummy-1', startedAt: 20, endedAt: 30, note: 'floor' }],
  pumpEvents: [{ id: 'pump-1', startedAt: 20, endedAt: 30, leftOunces: 2, rightOunces: 1 }],
  pumpSession: { id: 'pump-active', startedAt: 50, side: 'both', runningStartedAt: 50, elapsedSeconds: 0 },
  tummySession: { id: 'tummy-active', startedAt: 50, note: '', kind: 'tummy', runningStartedAt: 50, elapsedSeconds: 0 },
  tummyGoalMinutes: 35,
  growthMeasurements: [{ id: 'growth-1', measuredAt: 20, ageMonths: 2, weightLb: 10, lengthCm: null, headCm: null }],
  babyDob: '2026-01-02',
  session: { id: 'feed-active', startedAt: 50, activeSide: 'left', segmentStart: 50, segments: [], bottleOunces: 0, note: '', diaperKinds: [] },
  theme: 'dark',
}

describe('tracker state exports', () => {
  it('round trips every tracker field in deterministic collection order without metadata', () => {
    const exported = makeTrackerExport(state, '2026-02-03T04:05:06.000Z')
    expect(exported).toEqual({
      format: 'baby-feeding-tracker-export',
      version: 1,
      exportedAt: '2026-02-03T04:05:06.000Z',
      state: expect.objectContaining({ ...state, entries: [state.entries[1], state.entries[0]], diapers: [state.diapers[1], state.diapers[0]] }),
    })
    expect(JSON.stringify(exported)).not.toContain('token')
    expect(decodeTrackerExport(JSON.stringify(exported))).toEqual({ ok: true, value: exported })
  })

  it('migrates documented unversioned v0 entries and diapers with safe defaults', () => {
    const decoded = decodeTrackerExport(JSON.stringify({ entries: state.entries, diapers: state.diapers }))
    expect(decoded).toEqual({ ok: true, value: expect.objectContaining({ version: 1, state: expect.objectContaining({ entries: [state.entries[1], state.entries[0]], diapers: [state.diapers[1], state.diapers[0]], medicines: [], tummyTimes: [], pumpEvents: [], pumpSession: null, tummySession: null, tummyGoalMinutes: 20, growthMeasurements: [], babyDob: '', session: null, theme: 'light' }) }) })
  })

  it('migrates the prior flat version-one export format', () => {
    const decoded = decodeTrackerExport(JSON.stringify({ version: 1, exportedAt: '2026-02-03T04:05:06.000Z', entries: state.entries, diapers: state.diapers }))
    expect(decoded).toEqual({ ok: true, value: expect.objectContaining({ state: expect.objectContaining({ entries: [state.entries[1], state.entries[0]], diapers: [state.diapers[1], state.diapers[0]], medicines: [] }) }) })
  })

  it.each(['{', JSON.stringify({ format: 'baby-feeding-tracker-export', version: 2, state }), JSON.stringify({ format: 'baby-feeding-tracker-export', version: 1, exportedAt: '2026-02-03T04:05:06.000Z', state: { ...state, entries: [{}] } }), JSON.stringify({ format: 'baby-feeding-tracker-export', version: 1, exportedAt: '2026-02-03T04:05:06.000Z', state: { ...state, session: 1 } })])('rejects malformed or newer exports', (input) => {
    expect(decodeTrackerExport(input)).toEqual({ ok: false, error: expect.any(String) })
  })
})
