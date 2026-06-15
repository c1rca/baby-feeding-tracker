import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { diaperLabel, formatClockInput, medicineLabel, parseClockTimeToday, sortEntriesLatestFirst } from '../domain/trackerDomain'
import type { DiaperEvent, DiaperKind, EditingDiaperState, EditingMedicineState, Entry, MedicineEvent, MedicineKind, Session, UndoState } from '../types'
import { addBottleToSession, createBottleEntry, createDefaultManualDraft, createMedicineDose, createStandaloneDiaper, parseManualFeedDraft, toggleDiaperKind } from './auxiliaryEventModels'
import type { ManualDraft } from './auxiliaryEventModels'

type AuxiliaryEventActionsOptions = {
  now: number
  session: Session | null
  setSession: Dispatch<SetStateAction<Session | null>>
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setDiapers: Dispatch<SetStateAction<DiaperEvent[]>>
  setMedicines: Dispatch<SetStateAction<MedicineEvent[]>>
  selectedDiapers: DiaperKind[]
  setSelectedDiapers: Dispatch<SetStateAction<DiaperKind[]>>
  bottleQuickOz: number
  manualDraft: ManualDraft
  setManualDraft: Dispatch<SetStateAction<ManualDraft>>
  setManualOpen: Dispatch<SetStateAction<boolean>>
  setAdditionalOptionsOpen: Dispatch<SetStateAction<boolean>>
  editingDiaper: EditingDiaperState
  setEditingDiaper: Dispatch<SetStateAction<EditingDiaperState>>
  editingMedicine: EditingMedicineState
  setEditingMedicine: Dispatch<SetStateAction<EditingMedicineState>>
  setDismissedMedicineReminderId: Dispatch<SetStateAction<string | null>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
  undoState: UndoState | null
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  showToast: (message: string) => void
}

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
  setDismissedMedicineReminderId,
  setOpenEntryMenuId,
  setConfirmingDeleteEntryId,
  undoState,
  setUndoState,
  showToast,
}: AuxiliaryEventActionsOptions) {
  const loggedActiveDiaperKinds = useMemo(() => new Set<DiaperKind>(session?.diaperKinds ?? []), [session])
  const availableSelectedDiapers = selectedDiapers

  const clearUndoTimeout = () => {
    if (undoState) window.clearTimeout(undoState.timeoutId)
  }

  const logBottle = (oz?: number) => {
    const amount = oz ?? bottleQuickOz
    if (session) {
      setSession(addBottleToSession(session, amount))
      showToast('Bottle added to active feed')
      return
    }
    setEntries((prev) => [createBottleEntry(amount, now || new Date().getTime()), ...prev])
    showToast('Bottle feed saved')
  }

  const toggleDiaperSelection = (kind: DiaperKind) => {
    setSelectedDiapers((prev) => toggleDiaperKind(prev, kind))
  }

  const logSelectedDiapers = () => {
    const kinds = availableSelectedDiapers
    if (kinds.length === 0) return showToast(session ? 'Select an unlogged diaper' : 'Select wet, stool, or both')
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

  const logMedicine = (kind: MedicineKind) => {
    const medicine = createMedicineDose(kind, new Date().getTime())
    setMedicines((prev) => [medicine, ...prev].sort((a, b) => b.at - a.at))
    setDismissedMedicineReminderId(null)
    setAdditionalOptionsOpen(false)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ medicine, timeoutId, kind: 'medicine-log' })
    showToast(`${medicineLabel(kind)} logged`)
  }

  const saveMedicineEdit = (medicine: MedicineEvent) => {
    if (!editingMedicine) return
    const nextAt = parseClockTimeToday(editingMedicine.time, editingMedicine.originalAt)
    if (nextAt === null) return showToast('Enter a valid medicine time')
    setMedicines((prev) => prev.map((item) => item.id === medicine.id ? { ...item, kind: editingMedicine.kind, at: nextAt } : item).sort((a, b) => b.at - a.at))
    setDismissedMedicineReminderId(null)
    setEditingMedicine(null)
    showToast('Medicine updated')
  }

  const startMedicineEdit = (medicine: MedicineEvent) => {
    setEditingMedicine({ id: medicine.id, kind: medicine.kind, time: formatClockInput(medicine.at), originalAt: medicine.at })
    setOpenEntryMenuId(null)
  }

  const deleteMedicine = (medicine: MedicineEvent) => {
    setMedicines((prev) => prev.filter((item) => item.id !== medicine.id))
    setEditingMedicine(null)
    setOpenEntryMenuId(null)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ medicine, timeoutId, kind: 'medicine-delete' })
    showToast('Medicine deleted')
  }

  const saveManualFeed = () => {
    const result = parseManualFeedDraft(manualDraft)
    if (!result.ok) {
      return showToast(result.reason === 'empty' ? 'Add nursing time or bottle ounces' : 'Enter a valid feed date and time')
    }

    setEntries((prev) => sortEntriesLatestFirst([result.entry, ...prev]))
    setManualDraft(createDefaultManualDraft(new Date().getTime()))
    setManualOpen(false)
    showToast('Missed feed saved')
  }

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
