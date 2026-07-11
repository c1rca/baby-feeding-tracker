import type { Dispatch, SetStateAction } from 'react'
import { formatClockInput, makeId, parseClockTimeToday } from '../domain/trackerDomain'
import type { EditingTummyTimeState, Session, TummyTimeEvent, TummyTimeSession, UndoState } from '../types'

type Options = {
  tummySession: TummyTimeSession | null
  feedSession: Session | null
  setTummySession: Dispatch<SetStateAction<TummyTimeSession | null>>
  setTummyTimes: Dispatch<SetStateAction<TummyTimeEvent[]>>
  editingTummyTime: EditingTummyTimeState
  setEditingTummyTime: Dispatch<SetStateAction<EditingTummyTimeState>>
  setAdditionalOptionsOpen: Dispatch<SetStateAction<boolean>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  clearUndoTimeout: () => void
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  showToast: (message: string) => void
}

export function useTummyTimeActions({ tummySession, feedSession, setTummySession, setTummyTimes, editingTummyTime, setEditingTummyTime, setAdditionalOptionsOpen, setOpenEntryMenuId, clearUndoTimeout, setUndoState, showToast }: Options) {
  const logTummyTimeMinutes = (minutes: number) => {
    const endedAt = new Date().getTime()
    const tummyTime = { id: makeId(), startedAt: endedAt - minutes * 60_000, endedAt, note: '' }
    setTummyTimes((prev) => [tummyTime, ...prev].sort((a, b) => b.startedAt - a.startedAt))
    setAdditionalOptionsOpen(false)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ tummyTime, timeoutId, kind: 'tummy-log' })
    showToast(`${minutes} min Tummy Time saved`)
  }

  const startCareTimer = (kind: 'tummy' | 'sleep') => {
    const label = kind === 'sleep' ? 'Sleep' : 'Tummy Time'
    if (feedSession) {
      showToast(`Save or clear the active feed before starting ${label}`)
      return
    }
    if (tummySession) return
    setTummySession({ id: makeId(), startedAt: new Date().getTime(), note: '', kind })
    setAdditionalOptionsOpen(true)
    showToast(`${label} started`)
  }

  const startTummyTime = () => startCareTimer('tummy')
  const startSleep = () => startCareTimer('sleep')

  const stopCareTimer = () => {
    if (!tummySession) return
    const label = tummySession.kind === 'sleep' ? 'Sleep' : 'Tummy Time'
    const tummyTime = { id: tummySession.id, startedAt: tummySession.startedAt, endedAt: new Date().getTime(), note: tummySession.note, kind: tummySession.kind }
    setTummyTimes((prev) => [tummyTime, ...prev].sort((a, b) => b.startedAt - a.startedAt))
    setTummySession(null)
    setAdditionalOptionsOpen(false)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ tummyTime, timeoutId, kind: 'tummy-log' })
    showToast(`${label} saved`)
  }

  const stopTummyTime = stopCareTimer
  const stopSleep = stopCareTimer

  const startTummyTimeEdit = (tummyTime: TummyTimeEvent) => {
    setEditingTummyTime({ id: tummyTime.id, startTime: formatClockInput(tummyTime.startedAt), endTime: formatClockInput(tummyTime.endedAt), note: tummyTime.note ?? '', originalStartedAt: tummyTime.startedAt, originalEndedAt: tummyTime.endedAt })
    setOpenEntryMenuId(null)
  }

  const saveTummyTimeEdit = (tummyTime: TummyTimeEvent) => {
    if (!editingTummyTime) return
    const startedAt = parseClockTimeToday(editingTummyTime.startTime, editingTummyTime.originalStartedAt)
    const endedAt = parseClockTimeToday(editingTummyTime.endTime, editingTummyTime.originalEndedAt)
    if (startedAt === null || endedAt === null) return showToast('Enter valid Tummy Time times')
    if (endedAt <= startedAt) return showToast('End time must be after start time')
    setTummyTimes((prev) => prev.map((item) => item.id === tummyTime.id ? { ...item, startedAt, endedAt, note: editingTummyTime.note } : item).sort((a, b) => b.startedAt - a.startedAt))
    setEditingTummyTime(null)
    showToast('Tummy Time updated')
  }

  const deleteTummyTime = (tummyTime: TummyTimeEvent) => {
    setTummyTimes((prev) => prev.filter((item) => item.id !== tummyTime.id))
    setEditingTummyTime(null)
    setOpenEntryMenuId(null)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ tummyTime, timeoutId, kind: 'tummy-delete' })
    showToast('Tummy Time deleted')
  }

  return { logTummyTimeMinutes, startTummyTime, stopTummyTime, startSleep, stopSleep, startTummyTimeEdit, saveTummyTimeEdit, deleteTummyTime }
}
