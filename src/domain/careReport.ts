// A care report is the thing you hand a pediatrician: a day-by-day table of
// everything logged over a window, plus growth and medicine detail. It is a
// pure projection of tracker state so it can be serialised to CSV, rendered to
// a printable page, or asserted in tests without touching the DOM.
import { localDayWindows } from './time'
import { diaperKinds, entryDiaperKinds, medicineEventLabel } from './labels'
import { isTummyTimeEvent, tummyTimeDurationSeconds } from './tummyTime'
import { calculateAgeMonths } from './growth'
import type { DiaperEvent, Entry, HealthRecord, MedicineEvent, PumpEvent, TummyTimeEvent } from '../types'
import type { GrowthMeasurement } from './growthTypes'

export type CareReportDay = {
  date: string
  label: string
  startMs: number
  endMs: number
  feeds: number
  nursingSeconds: number
  bottleOunces: number
  wet: number
  stool: number
  sleepMinutes: number
  tummyMinutes: number
  pumpOunces: number
  medicines: number
}

export type CareReportInput = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  tummyTimes: TummyTimeEvent[]
  pumpEvents: PumpEvent[]
  growthMeasurements: GrowthMeasurement[]
  healthRecords?: HealthRecord[]
  babyDob: string
  babyName?: string
  babyProfile?: { sex?: string | null; birthWeightLb?: number | null; birthLengthCm?: number | null; pediatricianName?: string | null; pediatricianPhone?: string | null }
  now: number
  rangeDays?: number
}

const roundTenth = (value: number) => Math.round(value * 10) / 10
const isoDate = (ms: number) => {
  const date = new Date(ms)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const inWindow = (at: number, startMs: number, endMs: number) => at >= startMs && at < endMs

export function buildCareReport({
  entries,
  diapers,
  medicines,
  tummyTimes,
  pumpEvents,
  growthMeasurements,
  healthRecords = [],
  babyDob,
  babyName,
  babyProfile = {},
  now,
  rangeDays = 30,
}: CareReportInput) {
  const windows = localDayWindows(now, rangeDays)
  const rangeStartMs = windows[0]?.startMs ?? now
  const rangeEndMs = windows.at(-1)?.endMs ?? now

  const days: CareReportDay[] = windows.map(({ startMs, endMs, label }) => {
    // Feeds are attributed to the day they finished, matching the stats windows.
    const dayEntries = entries.filter((entry) => inWindow(entry.endedAt, startMs, endMs))
    const dayDiapers = diapers.filter((diaper) => inWindow(diaper.at, startMs, endMs))
    const dayCareTimers = tummyTimes.filter((event) => inWindow(event.startedAt, startMs, endMs))
    const daySleepSeconds = tummyTimes
      .filter((event) => !isTummyTimeEvent(event))
      .reduce((sum, event) => sum + Math.max(0, Math.min(event.endedAt, endMs) - Math.max(event.startedAt, startMs)) / 1000, 0)
    const countDiaper = (kind: 'wet' | 'stool') =>
      dayDiapers.filter((diaper) => diaperKinds(diaper).includes(kind)).length +
      dayEntries.filter((entry) => entryDiaperKinds(entry).includes(kind)).length
    const minutesOf = (events: TummyTimeEvent[]) =>
      Math.round(events.reduce((sum, event) => sum + tummyTimeDurationSeconds(event), 0) / 60)

    return {
      date: isoDate(startMs),
      label,
      startMs,
      endMs,
      feeds: dayEntries.length,
      nursingSeconds: dayEntries.reduce((sum, entry) => sum + entry.leftSeconds + entry.rightSeconds, 0),
      bottleOunces: roundTenth(dayEntries.reduce((sum, entry) => sum + (entry.bottleOunces ?? 0), 0)),
      wet: countDiaper('wet'),
      stool: countDiaper('stool'),
      sleepMinutes: Math.round(daySleepSeconds / 60),
      tummyMinutes: minutesOf(dayCareTimers.filter((event) => isTummyTimeEvent(event))),
      pumpOunces: roundTenth(pumpEvents
        .filter((event) => inWindow(event.startedAt, startMs, endMs))
        .reduce((sum, event) => sum + (event.leftOunces ?? 0) + (event.rightOunces ?? 0), 0)),
      medicines: medicines.filter((medicine) => inWindow(medicine.at, startMs, endMs)).length,
    }
  })

  const sum = (pick: (day: CareReportDay) => number) => days.reduce((total, day) => total + pick(day), 0)
  const perDay = (total: number) => roundTenth(total / Math.max(1, rangeDays))

  const totals = {
    feeds: sum((day) => day.feeds),
    nursingSeconds: sum((day) => day.nursingSeconds),
    bottleOunces: roundTenth(sum((day) => day.bottleOunces)),
    wet: sum((day) => day.wet),
    stool: sum((day) => day.stool),
    sleepMinutes: sum((day) => day.sleepMinutes),
    tummyMinutes: sum((day) => day.tummyMinutes),
    pumpOunces: roundTenth(sum((day) => day.pumpOunces)),
    medicines: sum((day) => day.medicines),
  }

  const averages = {
    feeds: perDay(totals.feeds),
    nursingMinutes: perDay(Math.round(totals.nursingSeconds / 60)),
    bottleOunces: perDay(totals.bottleOunces),
    wet: perDay(totals.wet),
    stool: perDay(totals.stool),
    sleepMinutes: perDay(totals.sleepMinutes),
    tummyMinutes: perDay(totals.tummyMinutes),
    pumpOunces: perDay(totals.pumpOunces),
  }

  const medicineDoses = medicines
    .filter((medicine) => inWindow(medicine.at, rangeStartMs, rangeEndMs))
    .sort((a, b) => b.at - a.at)
    .map((medicine) => ({ at: medicine.at, kind: medicine.kind, label: medicineEventLabel(medicine) }))

  const medicineTotals = medicineDoses.reduce<Record<string, number>>((counts, dose) => {
    counts[dose.label] = (counts[dose.label] ?? 0) + 1
    return counts
  }, {})

  const growth = [...growthMeasurements]
    .sort((a, b) => b.measuredAt - a.measuredAt)
    .map((measurement) => ({
      ...measurement,
      date: isoDate(measurement.measuredAt),
      ageMonths: measurement.ageMonths ?? calculateAgeMonths(babyDob, measurement.measuredAt),
    }))

  // Vaccines and milestones are cumulative history a clinician wants in full,
  // not just what happened inside the reporting window.
  const health = [...healthRecords].sort((a, b) => b.at - a.at)

  return {
    health,
    upcomingAppointments: health.filter((record) => record.kind === 'appointment' && record.at >= now && !record.completed).sort((a, b) => a.at - b.at),
    babyName: babyName?.trim() || 'Baby',
    babyProfile,
    babyDob,
    generatedAt: now,
    rangeDays,
    rangeStartMs,
    rangeEndMs,
    rangeStartDate: isoDate(rangeStartMs),
    rangeEndDate: isoDate(rangeEndMs - 1),
    days,
    totals,
    averages,
    medicineDoses,
    medicineTotals,
    growth,
  }
}

export type CareReport = ReturnType<typeof buildCareReport>
