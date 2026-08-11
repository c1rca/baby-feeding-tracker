// Shared pause-aware elapsed time for the care timers (tummy time, sleep,
// pumping) that mirror the breast-feed timer's pause/resume. A session tracks
// accumulated `elapsedSeconds` plus, while running, a `runningStartedAt` mark;
// pausing folds the running span into elapsedSeconds and clears the mark.
import type { CareTimerKind, CustomTracker } from '../types'

/**
 * What to call the timer that is running.
 *
 * A caregiver-defined timer borrows the same session slot as tummy time and
 * sleep, so every surface that shows the running timer — the hero pill, the
 * stop button, the care sheet — has to ask rather than assume. A tracker that
 * has since been archived still has a name to show, so the lookup spans all
 * definitions, not just the active ones.
 */
export const careTimerLabel = (session: { kind?: CareTimerKind; trackerId?: string } | null | undefined, customTrackers: CustomTracker[] = []) => {
  if (!session) return ''
  if (session.kind === 'custom') return customTrackers.find((tracker) => tracker.id === session.trackerId)?.name ?? 'Timer'
  return session.kind === 'sleep' ? 'Sleep' : 'Tummy Time'
}

export type PausableSession = { startedAt: number; runningStartedAt?: number | null; elapsedSeconds?: number }

// Elapsed active seconds, excluding paused spans. A legacy session that predates
// pause tracking (neither field present) falls back to wall-clock since start.
export function activeElapsedSeconds(session: PausableSession, now: number): number {
  if (session.runningStartedAt === undefined && session.elapsedSeconds === undefined) {
    return Math.max(0, Math.floor((now - session.startedAt) / 1000))
  }
  const base = session.elapsedSeconds ?? 0
  const running = session.runningStartedAt ? Math.max(0, Math.floor((now - session.runningStartedAt) / 1000)) : 0
  return base + running
}

export function activeTimerEventRange(session: PausableSession, stoppedAt: number) {
  if (session.runningStartedAt === undefined && session.elapsedSeconds === undefined) {
    return { startedAt: session.startedAt, endedAt: stoppedAt }
  }
  const elapsedSeconds = activeElapsedSeconds(session, stoppedAt)
  return { startedAt: stoppedAt - elapsedSeconds * 1000, endedAt: stoppedAt }
}
