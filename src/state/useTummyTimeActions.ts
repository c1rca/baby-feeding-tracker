import type { Dispatch, SetStateAction } from 'react'
import { formatClockInput, formatDateInput, makeId, parseClockTimeAfter } from '../domain/trackerDomain'
import { activeElapsedSeconds } from '../domain/careTimer'
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
    const now = Date.now()
    setTummySession({ id: makeId(), startedAt: now, runningStartedAt: now, elapsedSeconds: 0, note: '', kind })
    setAdditionalOptionsOpen(true)
    showToast(`${label} started`)
  }

  const startTummyTime = () => startCareTimer('tummy')
  const startSleep = () => startCareTimer('sleep')
  const pauseCareTimer = () => setTummySession((current) => current?.runningStartedAt ? { ...current, elapsedSeconds: activeElapsedSeconds(current, Date.now()), runningStartedAt: null } : current)
  const resumeCareTimer = () => setTummySession((current) => current && !current.runningStartedAt ? { ...current, runningStartedAt: Date.now() } : current)

  const resumeTummyTime = (tummyTime: TummyTimeEvent) => {
    if (feedSession || tummySession) return showToast('Finish or clear the active timer before resuming another session')
    const now = Date.now()
    const elapsedSeconds = Math.max(0, Math.round((tummyTime.endedAt - tummyTime.startedAt) / 1000))
    setTummyTimes((current) => current.filter((item) => item.id !== tummyTime.id))
    setTummySession({ id: makeId(), startedAt: now, runningStartedAt: now, elapsedSeconds, note: tummyTime.note ?? '', kind: tummyTime.kind ?? 'tummy' })
    setOpenEntryMenuId(null)
    setAdditionalOptionsOpen(false)
    showToast(`${tummyTime.kind === 'sleep' ? 'Sleep' : 'Tummy Time'} resumed`)
  }

  const stopCareTimer = () => {
    if (!tummySession) return
    const label = tummySession.kind === 'sleep' ? 'Sleep' : 'Tummy Time'
    const elapsedSeconds = activeElapsedSeconds(tummySession, Date.now())
    const tummyTime = { id: tummySession.id, startedAt: tummySession.startedAt, endedAt: tummySession.startedAt + elapsedSeconds * 1000, note: tummySession.note, kind: tummySession.kind }
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
    setEditingTummyTime({ id: tummyTime.id, startDate: formatDateInput(tummyTime.startedAt), startTime: formatClockInput(tummyTime.startedAt), endTime: formatClockInput(tummyTime.endedAt), note: tummyTime.note ?? '', originalStartedAt: tummyTime.startedAt, originalEndedAt: tummyTime.endedAt })
    setOpenEntryMenuId(null)
  }

  const saveTummyTimeEdit = (tummyTime: TummyTimeEvent) => {
    if (!editingTummyTime) return
    const startedAt = new Date(`${editingTummyTime.startDate}T${editingTummyTime.startTime}`).getTime()
    const endedAt = parseClockTimeAfter(editingTummyTime.endTime, startedAt)
    if (!Number.isFinite(startedAt) || endedAt === null) return showToast('Enter valid Tummy Time times')
    if (endedAt <= startedAt) return showToast('End time must be after start time')
    if (endedAt > Date.now()) return showToast('End time cannot be in the future')
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

  return { logTummyTimeMinutes, startTummyTime, pauseCareTimer, resumeCareTimer, resumeTummyTime, stopTummyTime, startSleep, stopSleep, startTummyTimeEdit, saveTummyTimeEdit, deleteTummyTime }
}
