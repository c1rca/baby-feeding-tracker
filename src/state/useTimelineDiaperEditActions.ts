import type { DiaperKind } from '../types'
import type { TimelineEntryActionsOptions } from './timelineEntryActionTypes'

export function useTimelineDiaperEditActions({ editing, setEditing, editingDiaper, setEditingDiaper }: TimelineEntryActionsOptions) {
  const toggleEditingDiaperKind = (kind: DiaperKind) => {
    if (!editingDiaper) return
    const kinds = editingDiaper.kinds.includes(kind) ? editingDiaper.kinds.filter((item) => item !== kind) : [...editingDiaper.kinds, kind]
    setEditingDiaper({ ...editingDiaper, kinds })
  }

  const toggleEditingEntryDiaperKind = (kind: DiaperKind) => {
    if (!editing) return
    const diaperKinds = editing.diaperKinds.includes(kind) ? editing.diaperKinds.filter((item) => item !== kind) : [...editing.diaperKinds, kind]
    setEditing({ ...editing, diaperKinds })
  }

  return { toggleEditingDiaperKind, toggleEditingEntryDiaperKind }
}
