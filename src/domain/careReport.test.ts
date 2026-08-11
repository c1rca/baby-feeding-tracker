import { describe, expect, it } from 'vitest'
import { buildCareReport } from './careReport'
import { buildDailySummaryCsv, buildEventsCsv, toCsv } from '../state/trackerCsvExport'
import { buildCareReportHtml } from '../state/careReportDocument'
import { DEFAULT_UNIT_PREFERENCES } from './units'
import type { CareReportInput } from './careReport'

const day = new Date(2026, 6, 20)
day.setHours(0, 0, 0, 0)
const DAY_MS = 24 * 60 * 60 * 1000
const now = day.getTime() + 12 * 3_600_000
const at = (daysAgo: number, hour: number) => day.getTime() - daysAgo * DAY_MS + hour * 3_600_000

const input: CareReportInput = {
  entries: [
    { id: 'feed-today', type: 'mixed', startedAt: at(0, 8), endedAt: at(0, 8) + 20 * 60_000, leftSeconds: 600, rightSeconds: 300, bottleOunces: 2, diaperKinds: ['wet'] },
    { id: 'feed-yesterday', type: 'breast', startedAt: at(1, 9), endedAt: at(1, 9) + 15 * 60_000, leftSeconds: 900, rightSeconds: 0, bottleOunces: null },
  ],
  diapers: [
    { id: 'diaper-today', kinds: ['wet', 'stool'], at: at(0, 10), context: 'standalone' },
    { id: 'diaper-old', kinds: ['wet'], at: at(40, 10), context: 'standalone' },
  ],
  medicines: [{ id: 'vit-today', kind: 'vitamin_d', at: at(0, 7) }, { id: 'tyl-today', kind: 'tylenol', at: at(0, 20) }],
  tummyTimes: [
    { id: 'nap', startedAt: at(0, 13), endedAt: at(0, 14), kind: 'sleep' },
    { id: 'tummy', startedAt: at(0, 15), endedAt: at(0, 15) + 10 * 60_000, kind: 'tummy' },
  ],
  pumpEvents: [{ id: 'pump-today', startedAt: at(0, 11), endedAt: at(0, 11) + 15 * 60_000, leftOunces: 2, rightOunces: 1.5 }],
  growthMeasurements: [{ id: 'growth-1', measuredAt: at(2, 12), ageMonths: 1.5, weightLb: 10.5, lengthCm: 55, headCm: 38, note: 'well visit' }],
  babyDob: '2026-06-01',
  babyName: 'Robin',
  now,
  rangeDays: 30,
}

const report = buildCareReport(input)
const today = report.days.at(-1)!

describe('buildCareReport', () => {
  it('covers the requested window and puts today last', () => {
    expect(report.days).toHaveLength(30)
    expect(today.date).toBe('2026-07-20')
    expect(report.rangeEndDate).toBe('2026-07-20')
  })

  it('rolls each event type into the day it belongs to', () => {
    expect(today.feeds).toBe(1)
    expect(today.nursingSeconds).toBe(900)
    expect(today.bottleOunces).toBe(2)
    // One standalone wet+stool diaper plus the wet recorded against the feed.
    expect(today.wet).toBe(2)
    expect(today.stool).toBe(1)
    expect(today.sleepMinutes).toBe(60)
    expect(today.tummyMinutes).toBe(10)
    expect(today.pumpOunces).toBe(3.5)
    expect(today.medicines).toBe(2)
  })

  it('separates sleep from tummy time rather than merging the shared array', () => {
    expect(today.sleepMinutes).not.toBe(today.tummyMinutes)
    expect(report.totals.sleepMinutes).toBe(60)
    expect(report.totals.tummyMinutes).toBe(10)
  })

  it('splits overnight sleep across the calendar days it overlaps', () => {
    const overnight = buildCareReport({
      ...input,
      entries: [], diapers: [], medicines: [], pumpEvents: [], growthMeasurements: [], rangeDays: 2,
      tummyTimes: [{ id: 'overnight', kind: 'sleep', startedAt: at(1, 21), endedAt: at(0, 7) }],
    })

    expect(overnight.days.map((day) => day.sleepMinutes)).toEqual([180, 420])
    expect(overnight.totals.sleepMinutes).toBe(600)
  })

  it('excludes events older than the window', () => {
    expect(report.totals.wet).toBe(2)
    expect(report.medicineDoses).toHaveLength(2)
    expect(report.medicineTotals).toEqual({ 'Vitamin D': 1, Tylenol: 1 })
  })

  it('averages across the full window, not just days with data', () => {
    expect(report.totals.feeds).toBe(2)
    expect(report.averages.feeds).toBe(0.1)
  })
})

describe('csv output', () => {
  it('quotes cells containing separators or quotes', () => {
    expect(toCsv([['plain', 'has,comma', 'has"quote', 'has\nnewline']])).toBe('plain,"has,comma","has""quote","has\nnewline"')
  })

  it('writes one row per event across every type, newest first', () => {
    const csv = buildEventsCsv({ ...input, units: DEFAULT_UNIT_PREFERENCES })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('type,started,ended,duration_min,left_oz,right_oz,total_oz,detail,note')
    const types = lines.slice(1).map((line) => line.split(',')[0])
    expect(types).toContain('feed')
    expect(types).toContain('diaper')
    expect(types).toContain('medicine')
    expect(types).toContain('sleep')
    expect(types).toContain('tummy time')
    expect(types).toContain('pumping')
    expect(types).toContain('growth')
  })

  it('names volume columns after the selected unit and converts the values', () => {
    const csv = buildDailySummaryCsv(report, { volume: 'ml', mass: 'kg', length: 'in' })
    expect(csv.split('\n')[0]).toBe('date,feeds,nursing_min,bottle_ml,wet,stool,sleep_min,tummy_min,pumped_ml,medicine_doses')
    // 2 oz stored, rendered as 59 ml.
    expect(csv).toContain(',59,')
  })

  it('ends the daily summary with a totals row', () => {
    const lines = buildDailySummaryCsv(report, DEFAULT_UNIT_PREFERENCES).split('\n')
    expect(lines.at(-1)?.startsWith('total,2,')).toBe(true)
  })
})

describe('printable care summary', () => {
  const html = buildCareReportHtml(report, DEFAULT_UNIT_PREFERENCES)

  it('is a self-contained document naming the baby and the window', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('Care summary — Robin')
    expect(html).toContain('2026-07-20')
    expect(html).toContain('(30 days)')
    expect(html).not.toMatch(/<script/i)
  })

  it('includes the daily, growth, and medicine sections', () => {
    expect(html).toContain('Daily log')
    expect(html).toContain('well visit')
    expect(html).toContain('10 lb 8 oz')
    expect(html).toContain('Vitamin D')
  })

  it('escapes caregiver-entered text rather than injecting it as markup', () => {
    const risky = buildCareReportHtml(buildCareReport({ ...input, babyName: '<img src=x onerror=alert(1)>' }), DEFAULT_UNIT_PREFERENCES)
    expect(risky).not.toContain('<img src=x')
    expect(risky).toContain('&lt;img src=x')
  })
})
