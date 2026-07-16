// Shared pause-aware elapsed time for the care timers (tummy time, sleep,
// pumping) that mirror the breast-feed timer's pause/resume. A session tracks
// accumulated `elapsedSeconds` plus, while running, a `runningStartedAt` mark;
// pausing folds the running span into elapsedSeconds and clears the mark.
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
