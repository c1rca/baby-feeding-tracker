// Wake windows: how long a baby of a given age can comfortably stay awake
// between sleeps. Overshooting is the usual cause of a hard-to-settle baby, so
// the value of tracking sleep is knowing when the next one is due.
import { isTummyTimeEvent } from './tummyTime'
import type { TummyTimeEvent, TummyTimeSession } from '../types'

const MINUTE_MS = 60_000
const AVERAGE_DAYS_PER_MONTH = 365.2425 / 12

// Typical ranges by age. Deliberately broad — this is a nudge, not a rule.
const WAKE_WINDOWS: Array<{ upToMonths: number; minMinutes: number; maxMinutes: number }> = [
  { upToMonths: 1, minMinutes: 45, maxMinutes: 60 },
  { upToMonths: 3, minMinutes: 60, maxMinutes: 90 },
  { upToMonths: 6, minMinutes: 90, maxMinutes: 120 },
  { upToMonths: 9, minMinutes: 120, maxMinutes: 180 },
  { upToMonths: 12, minMinutes: 150, maxMinutes: 210 },
  { upToMonths: 18, minMinutes: 210, maxMinutes: 270 },
  { upToMonths: Infinity, minMinutes: 300, maxMinutes: 360 },
]

export const ageMonthsFromDob = (babyDob: string, now: number) => {
  const dobMs = new Date(`${babyDob}T12:00:00`).getTime()
  if (!Number.isFinite(dobMs)) return null
  return Math.max(0, (now - dobMs) / (AVERAGE_DAYS_PER_MONTH * 86_400_000))
}

export const wakeWindowForAge = (ageMonths: number | null) => {
  // With no date of birth we cannot personalise, so fall back to the widest
  // newborn-through-infant band rather than inventing a precise number.
  if (ageMonths === null) return { minMinutes: 60, maxMinutes: 120 }
  const band = WAKE_WINDOWS.find((entry) => ageMonths < entry.upToMonths) ?? WAKE_WINDOWS.at(-1)!
  return { minMinutes: band.minMinutes, maxMinutes: band.maxMinutes }
}

export const sleepEvents = (tummyTimes: TummyTimeEvent[]) => tummyTimes.filter((event) => !isTummyTimeEvent(event))

export type WakeWindowModel = {
  asleep: boolean
  lastSleepEndedAt: number | null
  awakeMinutes: number | null
  minMinutes: number
  maxMinutes: number
  windowStartMs: number | null
  windowEndMs: number | null
  status: 'asleep' | 'no-data' | 'settling' | 'approaching' | 'overdue'
  copy: string
}

const formatMinutes = (minutes: number) => {
  const whole = Math.max(0, Math.round(minutes))
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  return hours ? `${hours}h ${rest}m` : `${rest}m`
}

const formatClock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function buildWakeWindow(
  tummyTimes: TummyTimeEvent[],
  tummySession: TummyTimeSession | null,
  babyDob: string,
  now: number,
): WakeWindowModel {
  const { minMinutes, maxMinutes } = wakeWindowForAge(ageMonthsFromDob(babyDob, now))
  const base = { minMinutes, maxMinutes }

  // A running sleep timer means the question is moot until it stops.
  if (tummySession && tummySession.kind === 'sleep') {
    return { ...base, asleep: true, lastSleepEndedAt: null, awakeMinutes: null, windowStartMs: null, windowEndMs: null, status: 'asleep', copy: 'Asleep now.' }
  }

  const naps = sleepEvents(tummyTimes).filter((event) => event.endedAt <= now)
  const lastSleepEndedAt = naps.length ? Math.max(...naps.map((event) => event.endedAt)) : null
  if (lastSleepEndedAt === null) {
    return { ...base, asleep: false, lastSleepEndedAt: null, awakeMinutes: null, windowStartMs: null, windowEndMs: null, status: 'no-data', copy: `Log a sleep to see the next window. At this age it is usually ${formatMinutes(minMinutes)}–${formatMinutes(maxMinutes)} awake.` }
  }

  const awakeMinutes = Math.max(0, (now - lastSleepEndedAt) / MINUTE_MS)
  const windowStartMs = lastSleepEndedAt + minMinutes * MINUTE_MS
  const windowEndMs = lastSleepEndedAt + maxMinutes * MINUTE_MS
  const status: WakeWindowModel['status'] = awakeMinutes >= maxMinutes ? 'overdue' : awakeMinutes >= minMinutes ? 'approaching' : 'settling'
  const copy = status === 'overdue'
    ? `Awake ${formatMinutes(awakeMinutes)} — past the usual ${formatMinutes(maxMinutes)} window.`
    : status === 'approaching'
      ? `Awake ${formatMinutes(awakeMinutes)} — in the usual nap window now.`
      : `Awake ${formatMinutes(awakeMinutes)} — next nap around ${formatClock(windowStartMs)}.`

  return { ...base, asleep: false, lastSleepEndedAt, awakeMinutes, windowStartMs, windowEndMs, status, copy }
}

// ---------------------------------------------------------------------------
// Diaper watch
//
// A newborn who has not produced a wet diaper for many hours is the classic
// early dehydration signal, and it is exactly the thing a tired caregiver stops
// noticing. This surfaces the gap; it deliberately states a fact and suggests
// asking a clinician rather than diagnosing anything.

export const DEFAULT_WET_DIAPER_ALERT_HOURS = 6

export type DiaperWatchModel = {
  lastWetAt: number | null
  hoursSinceWet: number | null
  alert: boolean
  copy: string
}

export function buildDiaperWatch(
  wetSignals: Array<{ at: number }>,
  now: number,
  alertHours = DEFAULT_WET_DIAPER_ALERT_HOURS,
): DiaperWatchModel {
  const past = wetSignals.filter((signal) => signal.at <= now)
  const lastWetAt = past.length ? Math.max(...past.map((signal) => signal.at)) : null
  if (lastWetAt === null) {
    return { lastWetAt: null, hoursSinceWet: null, alert: false, copy: 'No wet diaper logged yet.' }
  }
  const hoursSinceWet = (now - lastWetAt) / 3_600_000
  const alert = hoursSinceWet >= alertHours
  return {
    lastWetAt,
    hoursSinceWet,
    alert,
    copy: alert
      ? `No wet diaper logged for ${formatMinutes(hoursSinceWet * 60)}. If that is accurate, it is worth checking with your pediatrician.`
      : `Last wet diaper ${formatMinutes(hoursSinceWet * 60)} ago.`,
  }
}
