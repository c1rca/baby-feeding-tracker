import { describe, expect, it } from 'vitest'
import { buildHealthOverview, buildVaccineSchedule, normalizeHealthRecords, ageMonthsAt } from './healthRecords'
import type { HealthRecord } from '../types'

const dob = '2026-01-01'
// Roughly five months old.
const now = new Date('2026-06-05T12:00:00').getTime()

const record = (overrides: Partial<HealthRecord> & Pick<HealthRecord, 'kind' | 'name'>): HealthRecord => ({
  id: `${overrides.kind}-${overrides.name}`,
  at: now,
  ...overrides,
})

describe('age maths', () => {
  it('reports months elapsed since the date of birth', () => {
    expect(ageMonthsAt(dob, now)).toBeCloseTo(5.1, 1)
    expect(ageMonthsAt('', now)).toBeNull()
  })
})

describe('vaccine schedule', () => {
  it('marks reached ages due and later ones upcoming', () => {
    const rows = buildVaccineSchedule([], dob, now)
    const birthDose = rows.find((row) => row.name === 'Hepatitis B' && row.detail === 'Dose 1 — birth')!
    const twelveMonth = rows.find((row) => row.name === 'MMR')!

    expect(birthDose.status).toBe('due')
    expect(twelveMonth.status).toBe('upcoming')
  })

  it('marks a dose done once a matching record exists', () => {
    const rows = buildVaccineSchedule([record({ kind: 'vaccine', name: 'DTaP', note: 'Dose 1' })], dob, now)
    expect(rows.find((row) => row.name === 'DTaP' && row.detail === 'Dose 1')?.status).toBe('done')
    // A later dose of the same vaccine is a separate row and stays outstanding.
    expect(rows.find((row) => row.name === 'DTaP' && row.detail === 'Dose 2')?.status).toBe('due')
  })

  it('never reports anything as overdue', () => {
    const statuses = new Set(buildVaccineSchedule([], dob, now).map((row) => row.status))
    expect([...statuses].sort()).toEqual(['due', 'upcoming'])
  })
})

describe('health overview', () => {
  const future = now + 7 * 86_400_000
  const past = now - 7 * 86_400_000
  const records: HealthRecord[] = [
    record({ kind: 'appointment', name: '6-month checkup', at: future, id: 'appt-future' }),
    record({ kind: 'appointment', name: '4-month checkup', at: past, id: 'appt-past' }),
    record({ kind: 'vaccine', name: 'DTaP', note: 'Dose 1', id: 'v1' }),
    record({ kind: 'milestone', name: 'Custom first giggle', id: 'm-custom' }),
  ]

  it('splits appointments into upcoming and past', () => {
    const overview = buildHealthOverview(records, dob, now)
    expect(overview.upcomingAppointments.map((item) => item.id)).toEqual(['appt-future'])
    expect(overview.pastAppointments.map((item) => item.id)).toEqual(['appt-past'])
  })

  it('separates caregiver-invented records from the reference schedules', () => {
    const overview = buildHealthOverview(records, dob, now)
    expect(overview.customRecords.map((item) => item.id)).toEqual(['m-custom'])
  })

  it('counts what is currently due', () => {
    const overview = buildHealthOverview(records, dob, now)
    expect(overview.vaccinesDue.length).toBeGreaterThan(0)
    expect(overview.vaccinesDue.some((row) => row.name === 'DTaP' && row.detail === 'Dose 1')).toBe(false)
  })
})

describe('normalizeHealthRecords', () => {
  it('drops records missing a kind, name, or timestamp', () => {
    expect(normalizeHealthRecords([
      { id: 'ok', kind: 'vaccine', name: 'DTaP', at: now },
      { id: 'bad-kind', kind: 'dentist', name: 'x', at: now },
      { id: 'no-name', kind: 'vaccine', name: '   ', at: now },
      { id: 'no-time', kind: 'vaccine', name: 'DTaP' },
      'not an object',
    ])).toEqual([{ id: 'ok', kind: 'vaccine', name: 'DTaP', at: now, completed: false, note: undefined }])
  })

  it('returns an empty list for a non-array', () => {
    expect(normalizeHealthRecords(null)).toEqual([])
    expect(normalizeHealthRecords({ nope: true })).toEqual([])
  })
})
