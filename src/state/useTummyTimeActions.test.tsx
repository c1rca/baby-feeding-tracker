import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EditingTummyTimeState, TummyTimeEvent } from '../types'
import { useTummyTimeActions } from './useTummyTimeActions'

const noop = () => {}

function setup(editingTummyTime: EditingTummyTimeState, existing: TummyTimeEvent) {
  const setTummyTimes = vi.fn()
  const setEditingTummyTime = vi.fn()
  const showToast = vi.fn()
  const { result } = renderHook(() =>
    useTummyTimeActions({
      tummySession: null,
      feedSession: null,
      setTummySession: noop,
      setTummyTimes,
      editingTummyTime,
      setEditingTummyTime,
      setAdditionalOptionsOpen: noop,
      setOpenEntryMenuId: noop,
      clearUndoTimeout: noop,
      setUndoState: noop,
      showToast,
    }),
  )
  act(() => result.current.saveTummyTimeEdit(existing))
  // setTummyTimes is called with an updater; run it against the prior list.
  const updater = setTummyTimes.mock.calls.at(-1)?.[0] as ((prev: TummyTimeEvent[]) => TummyTimeEvent[]) | undefined
  const next = updater ? updater([existing]) : null
  return { setTummyTimes, showToast, saved: next?.find((item) => item.id === existing.id) ?? null }
}

describe('saveTummyTimeEdit', () => {
  const base: TummyTimeEvent = { id: 'nap-1', startedAt: new Date('2026-07-17T14:00:00').getTime(), endedAt: new Date('2026-07-17T14:20:00').getTime(), note: '', kind: 'tummy' }

  it('saves a same-day nap whose end is later than the start (regression: edits used to always fail)', () => {
    const editing: EditingTummyTimeState = { id: 'nap-1', startDate: '2026-07-17', startTime: '14:00', endTime: '2:45 PM', note: 'wiggly', originalStartedAt: base.startedAt, originalEndedAt: base.endedAt }
    const { saved, showToast } = setup(editing, base)
    expect(showToast).toHaveBeenCalledWith('Tummy Time updated')
    expect(saved?.startedAt).toBe(new Date('2026-07-17T14:00:00').getTime())
    expect(saved?.endedAt).toBe(new Date('2026-07-17T14:45:00').getTime())
    expect(saved?.note).toBe('wiggly')
  })

  it('rolls an overnight sleep end past midnight into the next morning', () => {
    const sleep: TummyTimeEvent = { id: 'sleep-1', startedAt: new Date('2026-07-17T23:00:00').getTime(), endedAt: new Date('2026-07-18T05:00:00').getTime(), note: '', kind: 'sleep' }
    const editing: EditingTummyTimeState = { id: 'sleep-1', startDate: '2026-07-17', startTime: '23:00', endTime: '6:00 AM', note: '', originalStartedAt: sleep.startedAt, originalEndedAt: sleep.endedAt }
    const { saved, showToast } = setup(editing, sleep)
    expect(showToast).toHaveBeenCalledWith('Tummy Time updated')
    expect(saved?.endedAt).toBe(new Date('2026-07-18T06:00:00').getTime())
    expect(saved!.endedAt).toBeGreaterThan(saved!.startedAt)
  })

  it('rejects an edit whose resolved end is in the future', () => {
    const now = Date.now()
    const recent: TummyTimeEvent = { id: 'nap-2', startedAt: now - 60 * 60_000, endedAt: now - 30 * 60_000, note: '', kind: 'tummy' }
    const startDate = new Date(recent.startedAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    const editing: EditingTummyTimeState = {
      id: 'nap-2',
      startDate: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
      startTime: `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`,
      // An end clock time earlier than the start rolls to tomorrow → future.
      endTime: `${pad((startDate.getHours() + 23) % 24)}:00`,
      note: '',
      originalStartedAt: recent.startedAt,
      originalEndedAt: recent.endedAt,
    }
    const { setTummyTimes, showToast } = setup(editing, recent)
    expect(showToast).toHaveBeenCalledWith('End time cannot be in the future')
    expect(setTummyTimes).not.toHaveBeenCalled()
  })
})
