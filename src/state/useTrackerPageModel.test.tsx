import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DiaperEvent, Entry, MedicineEvent, Session } from '../types'
import { useTrackerPageModel } from './useTrackerPageModel'

const now = new Date('2026-01-03T12:00:00Z').getTime()

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: overrides.id ?? 'feed-1',
  type: overrides.type ?? 'breast',
  startedAt: overrides.startedAt ?? now - 3 * 60 * 60 * 1000,
  endedAt: overrides.endedAt ?? now - 2 * 60 * 60 * 1000,
  leftSeconds: overrides.leftSeconds ?? 300,
  rightSeconds: overrides.rightSeconds ?? 0,
  bottleOunces: overrides.bottleOunces ?? 0,
  note: overrides.note,
  diaperKinds: overrides.diaperKinds,
})

const diaper = (overrides: Partial<DiaperEvent> = {}): DiaperEvent => ({
  id: overrides.id ?? 'diaper-1',
  at: overrides.at ?? now - 30 * 60 * 1000,
  kind: overrides.kind ?? 'wet',
  context: overrides.context ?? 'standalone',
})

const medicine = (overrides: Partial<MedicineEvent> = {}): MedicineEvent => ({
  id: overrides.id ?? 'medicine-1',
  at: overrides.at ?? now - 7 * 60 * 60 * 1000,
  kind: overrides.kind ?? 'tylenol',
})

const activeSession = (overrides: Partial<Session> = {}): Session => ({
  id: overrides.id ?? 'session-1',
  startedAt: overrides.startedAt ?? now - 30 * 60 * 1000,
  activeSide: overrides.activeSide ?? 'left',
  segmentStart: overrides.segmentStart ?? now - 30 * 60 * 1000,
  segments: overrides.segments ?? [],
  bottleOunces: overrides.bottleOunces ?? 0,
  note: overrides.note ?? '',
  diaperKinds: overrides.diaperKinds ?? [],
})

describe('useTrackerPageModel', () => {
  it('derives track hero, overview, trend, and stats values from persisted state', () => {
    const entries = [entry({ id: 'latest', endedAt: now - 45 * 60 * 1000, leftSeconds: 60, rightSeconds: 120 })]
    const diapers = [diaper()]

    const { result } = renderHook(() => useTrackerPageModel({ entries, diapers, medicines: [], session: null, now, dismissedMedicineReminderId: null }))

    expect(result.current.lastFeed?.id).toBe('latest')
    expect(result.current.lastFeedMetaText).toBe('45m ago')
    expect(result.current.avgGapShortText).toBeNull()
    expect(result.current.nextFeedWindowText).toContain('–')
    expect(result.current.nextFeedSideText).toMatch(/[LR]/)
    expect(result.current.today.count).toBe(1)
    expect(result.current.trend.days).toHaveLength(7)
    expect(result.current.stats.recentEntries).toHaveLength(1)
  })

  it('calculates the next feed window from the last session start even when the session spans pauses', () => {
    const sessionStartedAt = new Date('2026-01-03T14:00:00').getTime()
    const sessionEndedAt = new Date('2026-01-03T17:00:00').getTime()
    const entries = [entry({ id: 'paused-feed', startedAt: sessionStartedAt, endedAt: sessionEndedAt, leftSeconds: 3600, rightSeconds: 3600 })]

    const { result } = renderHook(() => useTrackerPageModel({ entries, diapers: [], medicines: [], session: null, now: sessionEndedAt, dismissedMedicineReminderId: null }))

    expect(result.current.nextFeedWindowText).toMatch(/4:00.*5:00.*PM/i)
  })

  it('uses an active session start and opposite side for the next feed cue before the session is saved', () => {
    const sessionStartedAt = new Date('2026-01-03T09:15:00').getTime()
    const lastSavedFeed = entry({ id: 'older-saved-feed', startedAt: new Date('2026-01-03T05:00:00').getTime(), endedAt: new Date('2026-01-03T05:30:00').getTime() })

    const { result } = renderHook(() => useTrackerPageModel({
      entries: [lastSavedFeed],
      diapers: [],
      medicines: [],
      session: activeSession({ startedAt: sessionStartedAt, activeSide: 'right' }),
      now: sessionStartedAt + 5 * 60 * 1000,
      dismissedMedicineReminderId: null,
    }))

    expect(result.current.nextFeedWindowText).toMatch(/11:15.*12:15.*PM/i)
    expect(result.current.nextFeedSideText).toBe('L')
  })

  it('returns the oldest due per-kind medicine reminder unless dismissed', () => {
    const medicines = [
      medicine({ id: 'recent-tylenol', kind: 'tylenol', at: now - 6.5 * 60 * 60 * 1000 }),
      medicine({ id: 'older-motrin', kind: 'motrin', at: now - 7 * 60 * 60 * 1000 }),
    ]

    const { result: visible } = renderHook(() => useTrackerPageModel({ entries: [], diapers: [], medicines, session: null, now, dismissedMedicineReminderId: null }))
    expect(visible.current.medicineReminder).toEqual({
      id: 'older-motrin',
      label: 'Motrin',
      recommendedKind: 'motrin',
      recommendedLabel: 'Motrin',
      at: medicines[1].at,
      type: 'medicine',
      elapsedHours: 6,
    })
    expect(visible.current.showMedicineReminder).toBe(true)

    const { result: dismissed } = renderHook(() => useTrackerPageModel({ entries: [], diapers: [], medicines, session: null, now, dismissedMedicineReminderId: 'older-motrin' }))
    expect(dismissed.current.medicineReminder?.id).toBe('older-motrin')
    expect(dismissed.current.showMedicineReminder).toBe(false)
  })
})
