import type { Dispatch, SetStateAction } from 'react'
import type { DiaperKind, Entry, Session, UndoState } from '../types'
import { buildFinishedEntry } from './activeFeedModels'

type ActiveSessionCompletionOptions = {
  session: Session | null
  selectedDiapers: DiaperKind[]
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setSelectedDiapers: Dispatch<SetStateAction<DiaperKind[]>>
  undoState: UndoState | null
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  setSession: Dispatch<SetStateAction<Session | null>>
  setToast: Dispatch<SetStateAction<string>>
  showToast: (message: string) => void
  setBottleOpen: Dispatch<SetStateAction<boolean>>
}

export function useActiveSessionCompletion({
  session,
  selectedDiapers,
  setEntries,
  setSelectedDiapers,
  undoState,
  setUndoState,
  setSession,
  setToast,
  showToast,
  setBottleOpen,
}: ActiveSessionCompletionOptions) {
  const clearSession = () => {
    if (!session) return showToast('No active feed to clear')
    if (undoState) window.clearTimeout(undoState.timeoutId)
    setSession(null)
    setBottleOpen(false)
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ session, timeoutId, kind: 'clear-session' })
    setToast('Active feed cleared')
  }

  const endSession = () => {
    if (!session) return showToast('No active feed to end')
    const { entry, selectedKinds } = buildFinishedEntry(session, new Date().getTime(), selectedDiapers)
    setEntries((prev) => [entry, ...prev])
    setSelectedDiapers((prev) => prev.filter((kind) => !selectedKinds.includes(kind)))
    setSession(null)
    showToast('Feed saved')
  }

  return { clearSession, endSession }
}
