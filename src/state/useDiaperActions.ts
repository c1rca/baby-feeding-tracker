import type { Dispatch, SetStateAction } from 'react'
import { diaperLabel } from '../domain/trackerDomain'
import type { DiaperEvent, DiaperKind, EditingDiaperState, UndoState } from '../types'
import { createStandaloneDiaper, toggleDiaperKind } from './auxiliaryEventModels'

type DiaperActionsOptions = {
  sessionHasActiveFeed: boolean
  selectedDiapers: DiaperKind[]
  setSelectedDiapers: Dispatch<SetStateAction<DiaperKind[]>>
  editingDiaper: EditingDiaperState
  setEditingDiaper: Dispatch<SetStateAction<EditingDiaperState>>
  setDiapers: Dispatch<SetStateAction<DiaperEvent[]>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
  clearUndoTimeout: () => void
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  showToast: (message: string) => void
}

export function useDiaperActions({ sessionHasActiveFeed, selectedDiapers, setSelectedDiapers, editingDiaper, setEditingDiaper, setDiapers, setOpenEntryMenuId, setConfirmingDeleteEntryId, clearUndoTimeout, setUndoState, showToast }: DiaperActionsOptions) {
  const availableSelectedDiapers = selectedDiapers

  const toggleDiaperSelection = (kind: DiaperKind) => {
    setSelectedDiapers((prev) => toggleDiaperKind(prev, kind))
  }

  const logSelectedDiapers = () => {
    const kinds = availableSelectedDiapers
    if (kinds.length === 0) return showToast(sessionHasActiveFeed ? 'Select an unlogged diaper' : 'Select wet, stool, or both')
    const label = kinds.map(diaperLabel).join(' + ')
    const diaper = createStandaloneDiaper(kinds, new Date().getTime())
    setDiapers((prev) => [diaper, ...prev].sort((a, b) => b.at - a.at))
    setSelectedDiapers((prev) => prev.filter((kind) => !kinds.includes(kind)))
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ diaper, timeoutId, kind: 'diaper-log' })
    showToast(`${label} diaper logged`)
  }

  const deleteDiaper = (diaper: DiaperEvent) => {
    clearUndoTimeout()
    setOpenEntryMenuId(null)
    setConfirmingDeleteEntryId(null)
    setEditingDiaper(null)
    setDiapers((prev) => prev.filter((item) => item.id !== diaper.id))
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ diaper, timeoutId, kind: 'diaper-delete' })
    showToast('Diaper deleted')
  }

  const saveDiaperEdit = (diaper: DiaperEvent) => {
    if (!editingDiaper || editingDiaper.kinds.length === 0) return showToast('Select wet, stool, or both')
    setDiapers((prev) => prev.map((item) => item.id === diaper.id ? { ...item, kind: undefined, kinds: editingDiaper.kinds } : item).sort((a, b) => b.at - a.at))
    setEditingDiaper(null)
    showToast('Diaper updated')
  }

  return { availableSelectedDiapers, toggleDiaperSelection, logSelectedDiapers, deleteDiaper, saveDiaperEdit }
}
