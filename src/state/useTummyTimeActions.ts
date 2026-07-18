import type { Dispatch, SetStateAction } from 'react'
import { formatClockInput, formatDateInput, makeId, parseClockTimeAfter, parseClockTimeOnDate, parseDateAndTime } from '../domain/trackerDomain'
import { activeElapsedSeconds, activeTimerEventRange } from '../domain/careTimer'
import type { EditingTummyTimeState, PumpSession, Session, TummyTimeEvent, TummyTimeSession, UndoState } from '../types'

type Options = {
  tummySession: TummyTimeSession | null
  feedSession: Session | null
  pumpSession: PumpSession | null
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

export function useTummyTimeActions({ tummySession, feedSession, pumpSession, setTummySession, setTummyTimes, editingTummyTime, setEditingTummyTime, setAdditionalOptionsOpen, setOpenEntryMenuId, clearUndoTimeout, setUndoState, showToast }: Options) {
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
    if (feedSession || pumpSession) {
      showToast(`Finish or clear the active timer before starting ${label}`)
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
    if (feedSession || tummySession || pumpSession) return showToast('Finish or clear the active timer before resuming another session')
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
    const range = activeTimerEventRange(tummySession, Date.now())
    const tummyTime = { id: tummySession.id, ...range, note: tummySession.note, kind: tummySession.kind }
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
    const label = tummyTime.kind === 'sleep' ? 'Sleep' : 'Tummy Time'
    // Anchor the start time to midnight of the chosen day, then interpret the
    // clock string the same loose way as the end time. The start field is
    // pre-filled by formatClockInput ("9:05 AM" in a 12h locale), which a raw
    // `new Date(`${date}T${time}`)` cannot parse — that produced a spurious
    // "invalid time" error whenever a user in a 12h locale saved an edit.
    const dayStart = parseDateAndTime(editingTummyTime.startDate, '00:00')
    const startedAt = dayStart === null ? null : parseClockTimeOnDate(editingTummyTime.startTime, dayStart)
    const endedAt = startedAt === null ? null : parseClockTimeAfter(editingTummyTime.endTime, startedAt)
    if (startedAt === null || endedAt === null) return showToast(`Enter valid ${label} times`)
    if (endedAt <= startedAt) return showToast('End time must be after start time')
    if (endedAt > Date.now()) return showToast('End time cannot be in the future')
    setTummyTimes((prev) => prev.map((item) => item.id === tummyTime.id ? { ...item, startedAt, endedAt, note: editingTummyTime.note } : item).sort((a, b) => b.startedAt - a.startedAt))
    setEditingTummyTime(null)
    showToast(`${label} updated`)
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
