import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '../types'
import { useBottleManualActions } from './useBottleManualActions'
import { createDefaultManualDraft, type ManualDraft } from './auxiliaryEventModels'

const noop = () => {}
const now = new Date('2026-07-18T12:00:00').getTime()

function saveWith(draft: ManualDraft) {
  const setEntries = vi.fn()
  const setManualOpen = vi.fn()
  const showToast = vi.fn()
  const { result } = renderHook(() =>
    useBottleManualActions({
      now,
      session: null,
      setSession: noop,
      setEntries,
      bottleQuickOz: 3,
      manualDraft: draft,
      setManualDraft: noop,
      setManualOpen,
      showToast,
    }),
  )
  act(() => result.current.saveManualFeed())
  const updater = setEntries.mock.calls.at(-1)?.[0] as ((prev: Entry[]) => Entry[]) | undefined
  const saved = updater ? updater([]) : null
  return { setEntries, setManualOpen, showToast, saved }
}

describe('saveManualFeed', () => {
  it('saves a valid missed feed in the past', () => {
    const draft: ManualDraft = { ...createDefaultManualDraft(now), date: '2026-07-18', time: '09:00', leftMinutes: '10' }
    const { saved, setManualOpen, showToast } = saveWith(draft)
    expect(saved?.[0]?.startedAt).toBe(new Date('2026-07-18T09:00:00').getTime())
    expect(setManualOpen).toHaveBeenCalledWith(false)
    expect(showToast).toHaveBeenCalledWith('Missed feed saved')
  })

  it('rejects a missed feed dated in the future (regression: no future guard existed)', () => {
    const draft: ManualDraft = { ...createDefaultManualDraft(now), date: '2026-07-18', time: '14:00', leftMinutes: '10' }
    const { setEntries, setManualOpen, showToast } = saveWith(draft)
    expect(showToast).toHaveBeenCalledWith('Feed time cannot be in the future')
    expect(setEntries).not.toHaveBeenCalled()
    expect(setManualOpen).not.toHaveBeenCalled()
  })

  it('still rejects an empty feed with no nursing time or bottle', () => {
    const draft: ManualDraft = { ...createDefaultManualDraft(now), date: '2026-07-18', time: '09:00' }
    const { setEntries, showToast } = saveWith(draft)
    expect(showToast).toHaveBeenCalledWith('Add nursing time or bottle ounces')
    expect(setEntries).not.toHaveBeenCalled()
  })
})
