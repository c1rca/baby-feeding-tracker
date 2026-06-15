import { entryToResumedSession } from '../domain/trackerDomain'
import type { Entry } from '../types'
import type { TimelineEntryActionsOptions, TimelineUndoHelpers } from './timelineEntryActionTypes'

export function useTimelineEntryMutationActions({
  session,
  setNow,
  setSession,
  setEntries,
  setEditing,
  setOpenEntryMenuId,
  setConfirmingDeleteEntryId,
  setResumeFocusTick,
  setUndoState,
  setToast,
  showToast,
}: TimelineEntryActionsOptions, { clearUndoTimeout }: TimelineUndoHelpers) {
  const deleteEntry = (entry: Entry) => {
    clearUndoTimeout()
    setOpenEntryMenuId(null)
    setConfirmingDeleteEntryId(null)
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ entry, timeoutId, kind: 'delete' })
    setToast('Entry deleted')
  }

  const resumeEntry = (entry: Entry) => {
    if (session) return showToast('Finish or clear the active feed before resuming another entry')
    clearUndoTimeout()
    const previousSession = session
    const t = new Date().getTime()
    setNow(t)
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
    setSession(entryToResumedSession(entry, t))
    setResumeFocusTick((tick) => tick + 1)
    setEditing(null)
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ entry, timeoutId, kind: 'resume', previousSession })
    setToast('Session resumed')
  }

  return { deleteEntry, resumeEntry }
}
