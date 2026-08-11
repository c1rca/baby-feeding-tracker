import { useEffect, useRef } from 'react'
import { actionLogEnabled, installActionLogLifecycle, recordAction } from './actionLog'
import { recordSendFailure } from './failureJournal'

type Snapshot = Record<string, unknown>

const COLLECTIONS = ['entries', 'diapers', 'medicines', 'tummyTimes', 'pumpEvents', 'growthMeasurements'] as const

const countOf = (value: unknown) => (Array.isArray(value) ? value.length : 0)

const countsFor = (state: Snapshot): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const key of COLLECTIONS) counts[key] = countOf(state[key])
  return counts
}

const idsOf = (value: unknown): Set<string> => {
  if (!Array.isArray(value)) return new Set()
  const ids = new Set<string>()
  for (const item of value) {
    const id = (item as { id?: unknown } | null)?.id
    if (typeof id === 'string') ids.add(id)
  }
  return ids
}

/**
 * Name the action by diffing consecutive snapshots rather than by having each
 * mutation site announce itself.
 *
 * This is the same reasoning the sync layer uses for its delta fingerprints: a
 * derived description cannot be forgotten. Every new logging path — including
 * ones added long after this code — is covered by construction, whereas an
 * explicit call at each mutation site is one `recordAction` away from a silent
 * hole in the backup. The label is a convenience for reading the log; the full
 * state travels with it either way, so a label this misses costs nothing.
 */
const describe = (previous: Snapshot | null, next: Snapshot): string => {
  if (previous === null) return 'state.hydrated'

  for (const key of COLLECTIONS) {
    const before = idsOf(previous[key])
    const after = idsOf(next[key])
    const added = [...after].filter((id) => !before.has(id))
    const removed = [...before].filter((id) => !after.has(id))
    if (added.length > 0) return `${key}.added`
    if (removed.length > 0) return `${key}.removed`
    // Same ids, different contents: an edit in place.
    if (before.size === after.size && JSON.stringify(previous[key]) !== JSON.stringify(next[key])) return `${key}.edited`
  }

  if (JSON.stringify(previous.session) !== JSON.stringify(next.session)) return 'session.changed'
  if (JSON.stringify(previous.tummySession) !== JSON.stringify(next.tummySession)) return 'tummySession.changed'
  if (JSON.stringify(previous.pumpSession) !== JSON.stringify(next.pumpSession)) return 'pumpSession.changed'
  if (previous.theme !== next.theme) return 'theme.changed'
  if (previous.babyDob !== next.babyDob) return 'babyDob.changed'
  if (previous.tummyGoalMinutes !== next.tummyGoalMinutes) return 'tummyGoal.changed'
  return 'state.changed'
}

/**
 * Post a full state snapshot to the backup log on every state change.
 *
 * Deliberately hung off the same values the sync payload is built from, so
 * "everything that syncs" and "everything that is backed up" are the same set
 * by construction and cannot drift apart.
 */
export function useActionLog(state: Snapshot, context: { householdId?: string | null; babyId?: string | null }): void {
  const previousRef = useRef<Snapshot | null>(null)
  const serialisedRef = useRef<string>('')

  useEffect(() => installActionLogLifecycle(), [])

  useEffect(() => {
    // This append-only local ledger is the recovery source of truth. Mirroring
    // to the optional remote action log is best-effort and never controls it.
    const serialised = JSON.stringify(state)
    if (serialised === serialisedRef.current) return
    const previous = previousRef.current
    serialisedRef.current = serialised
    previousRef.current = state

    const action = describe(previous, state)
    void recordSendFailure({
      at: new Date().toISOString(),
      kind: 'state-snapshot',
      reason: action,
      status: null,
      babyId: context.babyId ?? null,
      clientId: 'action-log',
      counts: countsFor(state),
      payload: state,
    })
    if (actionLogEnabled()) recordAction({
      action,
      householdId: context.householdId ?? null,
      babyId: context.babyId ?? null,
      counts: countsFor(state),
      state,
    })
  }, [state, context.householdId, context.babyId])
}
