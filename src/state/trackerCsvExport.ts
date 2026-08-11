// CSV output for spreadsheets and clinicians. The JSON export exists to restore
// the app; this exists to be read by a human or opened in Excel, so volumes and
// measurements are written in the caregiver's display units with the unit named
// in the column header.
import { bottleContentLabel, diaperKindsLabel, medicineEventLabel } from '../domain/labels'
import { isTummyTimeEvent, tummyTimeDurationSeconds } from '../domain/tummyTime'
import { cmToDisplayLength, formatMass, ozToDisplayVolume, type UnitPreferences } from '../domain/units'
import type { CareReport } from '../domain/careReport'
import type { DiaperEvent, Entry, MedicineEvent, PumpEvent, TummyTimeEvent } from '../types'
import type { GrowthMeasurement } from '../domain/growthTypes'

const escapeCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const toCsv = (rows: Array<Array<string | number | null | undefined>>) =>
  rows.map((row) => row.map(escapeCell).join(',')).join('\n')

const localTimestamp = (ms: number) => {
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const minutes = (seconds: number) => Math.round(seconds / 60)

type EventCsvInput = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  tummyTimes: TummyTimeEvent[]
  pumpEvents: PumpEvent[]
  growthMeasurements: GrowthMeasurement[]
  units: UnitPreferences
}

// One row per logged event, newest first, across every event type. `detail`
// carries the type-specific reading so the sheet stays rectangular.
export function buildEventsCsv({ entries, diapers, medicines, tummyTimes, pumpEvents, growthMeasurements, units }: EventCsvInput) {
  const volume = (ounces: number | null | undefined) => (ounces === null || ounces === undefined ? '' : ozToDisplayVolume(ounces, units.volume))
  const rows: Array<{ at: number; cells: Array<string | number | null | undefined> }> = []

  for (const entry of entries) {
    const nursing = minutes(entry.leftSeconds + entry.rightSeconds)
    rows.push({
      at: entry.startedAt,
      cells: ['feed', localTimestamp(entry.startedAt), localTimestamp(entry.endedAt), nursing, minutes(entry.leftSeconds), minutes(entry.rightSeconds), volume(entry.bottleOunces), entry.bottleContent ? `${entry.type} · ${bottleContentLabel(entry.bottleContent)}` : entry.type, entry.note ?? ''],
    })
  }
  for (const diaper of diapers) {
    rows.push({ at: diaper.at, cells: ['diaper', localTimestamp(diaper.at), '', '', '', '', '', diaperKindsLabel(diaperKindsOf(diaper)), ''] })
  }
  for (const medicine of medicines) {
    rows.push({ at: medicine.at, cells: ['medicine', localTimestamp(medicine.at), '', '', '', '', '', medicineEventLabel(medicine), ''] })
  }
  for (const event of tummyTimes) {
    const kind = isTummyTimeEvent(event) ? 'tummy time' : 'sleep'
    rows.push({ at: event.startedAt, cells: [kind, localTimestamp(event.startedAt), localTimestamp(event.endedAt), minutes(tummyTimeDurationSeconds(event)), '', '', '', kind, event.note ?? ''] })
  }
  for (const event of pumpEvents) {
    rows.push({
      at: event.startedAt,
      cells: ['pumping', localTimestamp(event.startedAt), localTimestamp(event.endedAt), minutes(Math.round((event.endedAt - event.startedAt) / 1000)), volume(event.leftOunces), volume(event.rightOunces), volume((event.leftOunces ?? 0) + (event.rightOunces ?? 0)), 'pumping', event.note ?? ''],
    })
  }
  for (const measurement of growthMeasurements) {
    const detail = [
      formatMass(measurement.weightLb, units.mass),
      measurement.lengthCm === null ? null : `${cmToDisplayLength(measurement.lengthCm, units.length)} ${units.length}`,
      measurement.headCm === null ? null : `${cmToDisplayLength(measurement.headCm, units.length)} ${units.length} head`,
    ].filter(Boolean).join(' · ')
    rows.push({ at: measurement.measuredAt, cells: ['growth', localTimestamp(measurement.measuredAt), '', '', '', '', '', detail, measurement.note ?? ''] })
  }

  const header = ['type', 'started', 'ended', 'duration_min', `left_${units.volume}`, `right_${units.volume}`, `total_${units.volume}`, 'detail', 'note']
  return toCsv([header, ...rows.sort((a, b) => b.at - a.at).map((row) => row.cells)])
}

// Local re-implementation so this module does not depend on the timeline layer.
function diaperKindsOf(diaper: DiaperEvent) {
  return diaper.kinds?.length ? diaper.kinds : diaper.kind ? [diaper.kind] : []
}

// One row per day, matching the pediatrician report table.
export function buildDailySummaryCsv(report: CareReport, units: UnitPreferences) {
  const header = ['date', 'feeds', 'nursing_min', `bottle_${units.volume}`, 'wet', 'stool', 'sleep_min', 'tummy_min', `pumped_${units.volume}`, 'medicine_doses']
  const rows = report.days.map((day) => [
    day.date,
    day.feeds,
    minutes(day.nursingSeconds),
    ozToDisplayVolume(day.bottleOunces, units.volume),
    day.wet,
    day.stool,
    day.sleepMinutes,
    day.tummyMinutes,
    ozToDisplayVolume(day.pumpOunces, units.volume),
    day.medicines,
  ])
  const totals = [
    'total',
    report.totals.feeds,
    minutes(report.totals.nursingSeconds),
    ozToDisplayVolume(report.totals.bottleOunces, units.volume),
    report.totals.wet,
    report.totals.stool,
    report.totals.sleepMinutes,
    report.totals.tummyMinutes,
    ozToDisplayVolume(report.totals.pumpOunces, units.volume),
    report.totals.medicines,
  ]
  return toCsv([header, ...rows, totals])
}
