/* eslint-disable react-refresh/only-export-components -- shared pure descriptor builders intentionally live beside their renderer. */
import { Check, Dumbbell, Milk, Pill, Sun, TimerReset, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { activeCustomTrackers, customTrackerHueToken, customTrackerProgress } from '../domain/customTrackers'
import { customTrackerIcon } from './customTrackerIcons'
import type { CustomEvent, CustomTracker, MedicineKind } from '../types'

export type DueMedicine = { id: string; kind: MedicineKind; label: string; at: number }
export type GivenMedicine = { kind: MedicineKind; label: string; at: number }

/**
 * One row of Today's needs, whatever produced it.
 *
 * Built-in needs and caregiver-defined ones both reduce to this, so there is a
 * single rendering path and a single place that decides what "done" looks like.
 * A custom row that a caregiver can pick out of the list as second-class has
 * failed, and the surest way to prevent that is to leave no second code path
 * for it to drift down.
 */
export type NeedDescriptor = {
  key: string
  /** Modifier class supplying `--need-hue` for the built-in rows. */
  tone?: string
  /** Explicit hue for caregiver-defined rows, which have no modifier class. */
  hue?: string
  title: string
  detail: string
  icon: LucideIcon
  done: boolean
  progress?: { label: string; value: number; max: number }
  action?: { label: string; ariaLabel: string; onClick: () => void }
}

const clockTime = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export type CareNeedsInput = {
  now: number
  hasHydrated: boolean
  vitaminDTakenToday: boolean
  latestVitaminDAt: number | null
  dueMedicines: DueMedicine[]
  givenMedicines: GivenMedicine[]
  tummyMinutesToday: number
  tummyGoalMinutes: number
  pumpGoalOunces: number
  pumpGoalSessions: number
  pumpedOzToday: number
  pumpCountToday: number
  customTrackers: CustomTracker[]
  customEvents: CustomEvent[]
  /** The tracker whose timer is running, if the shared care-timer slot holds one. */
  runningTrackerId: string | null
  logMedicine: (kind: MedicineKind) => void
  startTummyTime: () => void
  logCustomEvent: (trackerId: string) => void
  startCustomTimer: (trackerId: string) => void
  stopCustomTimer: () => void
}

type CustomNeedHandlers = Pick<CareNeedsInput, 'runningTrackerId' | 'logCustomEvent' | 'startCustomTimer' | 'stopCustomTimer'>

const customNeed = (tracker: CustomTracker, events: CustomEvent[], now: number, handlers: CustomNeedHandlers): NeedDescriptor => {
  const { runningTrackerId, logCustomEvent, startCustomTimer, stopCustomTimer } = handlers
  const progress = customTrackerProgress(tracker, events, now)
  const latest = events.find((event) => event.trackerId === tracker.id)
  const base = {
    key: `custom-${tracker.id}`,
    hue: customTrackerHueToken(tracker.hue),
    title: tracker.name,
    icon: customTrackerIcon(tracker.icon),
    done: progress.done,
  }

  if (progress.goal.kind === 'once') {
    return {
      ...base,
      detail: progress.done ? (latest ? `Logged at ${clockTime(latest.at)}` : 'Done for today') : 'Not logged yet',
      action: { label: 'Log', ariaLabel: `Log ${tracker.name}`, onClick: () => logCustomEvent(tracker.id) },
    }
  }

  if (progress.goal.kind === 'count') {
    return {
      ...base,
      detail: progress.done ? `Goal met with ${progress.count}` : `${progress.count} of ${progress.target}`,
      progress: { label: `${tracker.name} progress`, value: progress.count, max: progress.target },
      action: { label: 'Log', ariaLabel: `Log ${tracker.name}`, onClick: () => logCustomEvent(tracker.id) },
    }
  }

  // A minutes goal is filled by a timer rather than a tap. The row is where it
  // starts and stops, so a caregiver never has to go looking for the control
  // for the thing they are already reading.
  const running = runningTrackerId === tracker.id
  return {
    ...base,
    done: progress.done && !running,
    detail: running
      ? 'Timer running'
      : progress.done ? `Goal met with ${progress.minutes} min` : `${progress.minutes} of ${progress.target} min`,
    progress: { label: `${tracker.name} progress`, value: progress.minutes, max: progress.target },
    action: running
      ? { label: 'Stop', ariaLabel: `Stop ${tracker.name} timer`, onClick: stopCustomTimer }
      : { label: 'Start', ariaLabel: `Start ${tracker.name} timer`, onClick: () => startCustomTimer(tracker.id) },
  }
}

/**
 * How a tracker would look in Today's needs, with nothing logged yet.
 *
 * Settings previews a draft through this so the preview cannot drift from the
 * real row: same descriptor, same renderer. A preview that lies about the
 * result is worse than no preview.
 */
export const previewCustomNeed = (tracker: CustomTracker): NeedDescriptor => ({
  ...customNeed(tracker, [], Date.now(), { runningTrackerId: null, logCustomEvent: noop, startCustomTimer: noop, stopCustomTimer: noop }),
  key: 'preview',
})

const noop = () => {}

export function buildCareNeeds(input: CareNeedsInput): NeedDescriptor[] {
  const {
    now, hasHydrated, vitaminDTakenToday, latestVitaminDAt, tummyMinutesToday, tummyGoalMinutes,
    pumpGoalOunces, pumpGoalSessions, pumpedOzToday, pumpCountToday, logMedicine, startTummyTime,
  } = input
  // Medicine rows are withheld until local state has hydrated, or a reminder
  // flashes up and disappears on the very first render.
  const due = hasHydrated ? input.dueMedicines : []
  const given = hasHydrated ? input.givenMedicines : []
  const tummyDone = tummyGoalMinutes > 0 && tummyMinutesToday >= tummyGoalMinutes

  const needs: NeedDescriptor[] = [
    {
      key: 'vitamin-d',
      tone: 'vitamin',
      title: 'Vitamin D',
      detail: vitaminDTakenToday ? (latestVitaminDAt ? `Given at ${clockTime(latestVitaminDAt)}` : 'Done for today') : 'Not given yet',
      icon: Sun,
      done: vitaminDTakenToday,
      action: { label: 'Log dose', ariaLabel: 'Log Vitamin D dose', onClick: () => logMedicine('vitamin_d') },
    },
    {
      key: 'tummy-time',
      tone: 'tummy',
      title: 'Tummy time',
      detail: tummyDone ? `Goal met with ${tummyMinutesToday} min` : `${tummyMinutesToday} of ${tummyGoalMinutes} min`,
      icon: Dumbbell,
      done: tummyDone,
      progress: { label: 'Tummy time progress', value: tummyMinutesToday, max: tummyGoalMinutes },
      action: { label: 'Start', ariaLabel: 'Start Tummy Time timer', onClick: startTummyTime },
    },
  ]

  if (pumpGoalOunces > 0) {
    const done = pumpedOzToday >= pumpGoalOunces
    needs.push({
      key: 'pump-ounces',
      tone: 'pumping',
      title: 'Pumping',
      detail: done ? `Goal met with ${pumpedOzToday} oz` : `${pumpedOzToday} of ${pumpGoalOunces} oz`,
      icon: Milk,
      done,
      progress: { label: 'Pumping ounces progress', value: pumpedOzToday, max: pumpGoalOunces },
    })
  }

  if (pumpGoalSessions > 0) {
    const done = pumpCountToday >= pumpGoalSessions
    needs.push({
      key: 'pump-sessions',
      tone: 'pumping',
      title: 'Pumping sessions',
      detail: done ? `Goal met with ${pumpCountToday}` : `${pumpCountToday} of ${pumpGoalSessions} sessions`,
      icon: TimerReset,
      done,
      progress: { label: 'Pumping sessions progress', value: pumpCountToday, max: pumpGoalSessions },
    })
  }

  for (const tracker of activeCustomTrackers(input.customTrackers)) {
    needs.push(customNeed(tracker, input.customEvents, now, input))
  }

  for (const medicine of due) {
    needs.push({
      key: `due-${medicine.id}`,
      tone: medicine.kind,
      title: `${medicine.label} due`,
      detail: `Last dose at ${clockTime(medicine.at)}`,
      icon: Pill,
      done: false,
      action: { label: 'Log dose', ariaLabel: `Log ${medicine.label} dose`, onClick: () => logMedicine(medicine.kind) },
    })
  }

  for (const medicine of given) {
    needs.push({
      key: `given-${medicine.kind}`,
      tone: medicine.kind,
      title: medicine.label,
      detail: `Given at ${clockTime(medicine.at)}`,
      icon: Pill,
      done: true,
    })
  }

  return needs
}

export function CareNeedRow({ need }: { need: NeedDescriptor }) {
  const Icon = need.done ? Check : need.icon
  const percent = need.progress ? Math.min(100, Math.round((need.progress.value / Math.max(1, need.progress.max)) * 100)) : 0
  return (
    <div
      className={`care-need${need.tone ? ` care-need--${need.tone}` : ''}${need.done ? ' is-done' : ''}`}
      style={need.hue ? ({ '--need-hue': need.hue } as CSSProperties) : undefined}
    >
      <span className="care-need-icon" aria-hidden="true"><Icon size={17} /></span>
      <div className="care-need-copy">
        <strong>{need.title}</strong>
        <small>{need.detail}</small>
        {need.done || !need.progress ? null : (
          <div className="care-need-progress" role="progressbar" aria-label={need.progress.label} aria-valuemin={0} aria-valuemax={need.progress.max} aria-valuenow={Math.min(need.progress.value, need.progress.max)}>
            <div style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
      {need.done || !need.action ? null : (
        <button type="button" className="care-need-action" aria-label={need.action.ariaLabel} onClick={need.action.onClick}>{need.action.label}</button>
      )}
    </div>
  )
}
