import { useCallback, useMemo } from 'react'
import type { DiaperKind } from '../types'
import type { AuxiliaryEventActionsOptions } from './auxiliaryEventActionTypes'
import { useBottleManualActions } from './useBottleManualActions'
import { useDiaperActions } from './useDiaperActions'
import { useMedicineActions } from './useMedicineActions'

export function useAuxiliaryEventActions({
  now,
  session,
  setSession,
  setEntries,
  setDiapers,
  setMedicines,
  selectedDiapers,
  setSelectedDiapers,
  bottleQuickOz,
  manualDraft,
  setManualDraft,
  setManualOpen,
  setAdditionalOptionsOpen,
  editingDiaper,
  setEditingDiaper,
  editingMedicine,
  setEditingMedicine,
  setDismissedMedicineReminderIds,
  setOpenEntryMenuId,
  setConfirmingDeleteEntryId,
  undoState,
  setUndoState,
  showToast,
}: AuxiliaryEventActionsOptions) {
  const loggedActiveDiaperKinds = useMemo(() => new Set<DiaperKind>(session?.diaperKinds ?? []), [session])
  const clearUndoTimeout = useCallback(() => {
    if (undoState) window.clearTimeout(undoState.timeoutId)
  }, [undoState])

  const { logBottle, saveManualFeed } = useBottleManualActions({ now, session, setSession, setEntries, bottleQuickOz, manualDraft, setManualDraft, setManualOpen, showToast })
  const { availableSelectedDiapers, toggleDiaperSelection, logSelectedDiapers, deleteDiaper, saveDiaperEdit } = useDiaperActions({
    sessionHasActiveFeed: Boolean(session),
    selectedDiapers,
    setSelectedDiapers,
    editingDiaper,
    setEditingDiaper,
    setDiapers,
    setOpenEntryMenuId,
    setConfirmingDeleteEntryId,
    clearUndoTimeout,
    setUndoState,
    showToast,
  })
  const { logMedicine, saveMedicineEdit, startMedicineEdit, deleteMedicine } = useMedicineActions({
    editingMedicine,
    setEditingMedicine,
    setMedicines,
    setDismissedMedicineReminderIds,
    setAdditionalOptionsOpen,
    setOpenEntryMenuId,
    clearUndoTimeout,
    setUndoState,
    showToast,
  })

  return {
    loggedActiveDiaperKinds,
    availableSelectedDiapers,
    logBottle,
    toggleDiaperSelection,
    logSelectedDiapers,
    deleteDiaper,
    saveDiaperEdit,
    logMedicine,
    saveMedicineEdit,
    startMedicineEdit,
    deleteMedicine,
    saveManualFeed,
  }
}
