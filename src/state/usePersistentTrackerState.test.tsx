import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { usePersistentTrackerState } from './usePersistentTrackerState'
import type { DiaperEvent, Entry, MedicineEvent, Session } from '../types'

const entry: Entry = {
  id: 'entry-1',
  type: 'breast',
  startedAt: 1000,
  endedAt: 2000,
  leftSeconds: 1,
  rightSeconds: 0,
  bottleOunces: 0,
  note: '',
}

const diaper: DiaperEvent = { id: 'diaper-1', at: 3000, kind: 'wet', context: 'standalone' }
const medicine: MedicineEvent = { id: 'medicine-1', at: 4000, kind: 'tylenol' }
const session: Session = { startedAt: 5000, activeSide: 'left', segmentStart: 5000, segments: [], bottleOunces: 0, note: '', diaperKinds: [] }

describe('usePersistentTrackerState', () => {
  beforeEach(() => {
    localStorage.clear()
    document.cookie = 'baby_feeding_theme=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.documentElement.removeAttribute('data-theme')
  })

  it('hydrates tracker state from local storage and normalizes ordering', () => {
    const olderEntry = { ...entry, id: 'entry-older', endedAt: 1500 }
    localStorage.setItem('baby-feeding-tracker:v1:entries', JSON.stringify([olderEntry, entry]))
    localStorage.setItem('baby-feeding-tracker:v1:diapers', JSON.stringify([{ ...diaper, id: 'diaper-older', at: 2500 }, diaper]))
    localStorage.setItem('baby-feeding-tracker:v1:medicines', JSON.stringify([{ ...medicine, id: 'medicine-older', at: 3500 }, medicine]))
    localStorage.setItem('baby-feeding-tracker:v1:session', JSON.stringify(session))
    localStorage.setItem('baby-feeding-tracker:v1:theme', 'dark')
    localStorage.setItem('baby-feeding-tracker:v1:feeding-notifications', '1')

    const { result } = renderHook(() => usePersistentTrackerState())

    expect(result.current.entries.map((item) => item.id)).toEqual(['entry-1', 'entry-older'])
    expect(result.current.diapers.map((item) => item.id)).toEqual(['diaper-1', 'diaper-older'])
    expect(result.current.medicines.map((item) => item.id)).toEqual(['medicine-1', 'medicine-older'])
    expect(result.current.session).toEqual(session)
    expect(result.current.theme).toBe('dark')
    expect(result.current.feedingNotificationsEnabled).toBe(true)
  })

  it('persists state updates and applies theme side effects', () => {
    const { result } = renderHook(() => usePersistentTrackerState())

    act(() => {
      result.current.setEntries([entry])
      result.current.setDiapers([diaper])
      result.current.setMedicines([medicine])
      result.current.setSession(session)
      result.current.setTheme('dark')
      result.current.setSettingsOpen(true)
      result.current.setFeedingNotificationsEnabled(true)
    })

    expect(JSON.parse(localStorage.getItem('baby-feeding-tracker:v1:entries') ?? '[]')).toEqual([entry])
    expect(JSON.parse(localStorage.getItem('baby-feeding-tracker:v1:diapers') ?? '[]')).toEqual([diaper])
    expect(JSON.parse(localStorage.getItem('baby-feeding-tracker:v1:medicines') ?? '[]')).toEqual([medicine])
    expect(JSON.parse(localStorage.getItem('baby-feeding-tracker:v1:session') ?? 'null')).toEqual(session)
    expect(localStorage.getItem('baby-feeding-tracker:v1:theme')).toBe('dark')
    expect(localStorage.getItem('baby-feeding-tracker:v1:settings-open')).toBe('1')
    expect(localStorage.getItem('baby-feeding-tracker:v1:feeding-notifications')).toBe('1')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.cookie).toContain('baby_feeding_theme=dark')
  })

  it('prefers a valid theme cookie over local storage', () => {
    localStorage.setItem('baby-feeding-tracker:v1:theme', 'light')
    document.cookie = 'baby_feeding_theme=dark; path=/'

    const { result } = renderHook(() => usePersistentTrackerState())

    expect(result.current.theme).toBe('dark')
  })
})
