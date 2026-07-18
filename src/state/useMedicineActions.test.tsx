import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EditingMedicineState, MedicineEvent } from '../types'
import { useMedicineActions } from './useMedicineActions'

const noop = () => {}

function saveEdit(editingMedicine: EditingMedicineState, existing: MedicineEvent) {
  const setMedicines = vi.fn()
  const showToast = vi.fn()
  const { result } = renderHook(() =>
    useMedicineActions({
      editingMedicine,
      setEditingMedicine: noop,
      setMedicines,
      setDismissedMedicineReminderIds: noop,
      setAdditionalOptionsOpen: noop,
      setOpenEntryMenuId: noop,
      clearUndoTimeout: noop,
      setUndoState: noop,
      showToast,
    }),
  )
  act(() => result.current.saveMedicineEdit(existing))
  const updater = setMedicines.mock.calls.at(-1)?.[0] as ((prev: MedicineEvent[]) => MedicineEvent[]) | undefined
  const next = updater ? updater([existing]) : null
  return { showToast, saved: next?.find((item) => item.id === existing.id) ?? null }
}

describe('saveMedicineEdit', () => {
  const original: MedicineEvent = { id: 'dose-1', kind: 'vitamin_d', at: new Date('2026-07-18T08:00:00').getTime() }

  it('keeps a forward time correction on the same day (regression: edits jumped to the previous day)', () => {
    const editing: EditingMedicineState = { id: 'dose-1', kind: 'vitamin_d', time: '10:00 AM', originalAt: original.at }
    const { saved, showToast } = saveEdit(editing, original)
    expect(showToast).toHaveBeenCalledWith('Medicine updated')
    expect(saved?.at).toBe(new Date('2026-07-18T10:00:00').getTime())
  })

  it('keeps even a small forward nudge on the same day', () => {
    const editing: EditingMedicineState = { id: 'dose-1', kind: 'vitamin_d', time: '8:15 AM', originalAt: original.at }
    const { saved } = saveEdit(editing, original)
    expect(saved?.at).toBe(new Date('2026-07-18T08:15:00').getTime())
  })

  it('applies an earlier time on the same day and can change the kind', () => {
    const editing: EditingMedicineState = { id: 'dose-1', kind: 'tylenol', time: '6:30 AM', originalAt: original.at }
    const { saved } = saveEdit(editing, original)
    expect(saved?.at).toBe(new Date('2026-07-18T06:30:00').getTime())
    expect(saved?.kind).toBe('tylenol')
  })

  it('rejects an unparseable time without mutating the dose', () => {
    const editing: EditingMedicineState = { id: 'dose-1', kind: 'vitamin_d', time: 'noon-ish', originalAt: original.at }
    const setMedicines = vi.fn()
    const showToast = vi.fn()
    const { result } = renderHook(() =>
      useMedicineActions({ editingMedicine: editing, setEditingMedicine: noop, setMedicines, setDismissedMedicineReminderIds: noop, setAdditionalOptionsOpen: noop, setOpenEntryMenuId: noop, clearUndoTimeout: noop, setUndoState: noop, showToast }),
    )
    act(() => result.current.saveMedicineEdit(original))
    expect(showToast).toHaveBeenCalledWith('Enter a valid medicine time')
    expect(setMedicines).not.toHaveBeenCalled()
  })
})
