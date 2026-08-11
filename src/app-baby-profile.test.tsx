import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GrowthDashboard } from './components/GrowthDashboard'
import { buildCareReportHtml } from './state/careReportDocument'
import { buildCareReport } from './domain/careReport'
import { DEFAULT_UNIT_PREFERENCES } from './domain/units'
import type { GrowthMeasurement } from './domain/growthTypes'

const measurement: GrowthMeasurement = { id: 'g1', measuredAt: Date.now(), ageMonths: 2.5, weightLb: 12, lengthCm: 58, headCm: 39 }

const renderGrowth = (babySex: 'female' | 'male' | null) =>
  render(<GrowthDashboard growthMeasurements={[measurement]} setGrowthMeasurements={() => {}} babyDob="2026-01-01" babySex={babySex} />)

describe('growth percentiles use the matching WHO reference', () => {
  afterEach(cleanup)

  it('reads a girl against the girls standards', () => {
    renderGrowth('female')
    const section = screen.getByRole('region', { name: /Growth percentile tracker/i })
    expect(within(section).getByText(/WHO girls 0–24 month standards/i)).toBeTruthy()
    expect(within(section).getAllByText(/percentile/i).length).toBeGreaterThan(0)
    expect(within(section).queryByText(/n\/a/i)).toBeNull()
  })

  it('reads a boy against the boys standards', () => {
    renderGrowth('male')
    const section = screen.getByRole('region', { name: /Growth percentile tracker/i })
    expect(within(section).getByText(/WHO boys 0–24 month standards/i)).toBeTruthy()
    expect(within(section).getAllByText(/percentile/i).length).toBeGreaterThan(0)
  })

  it('gives the same measurement a different percentile for each sex', () => {
    renderGrowth('female')
    const asGirl = screen.getByRole('region', { name: /Growth percentile tracker/i }).textContent
    cleanup()
    renderGrowth('male')
    const asBoy = screen.getByRole('region', { name: /Growth percentile tracker/i }).textContent
    expect(asGirl).not.toBe(asBoy)
  })

  it('withholds percentiles entirely until a sex is recorded', () => {
    renderGrowth(null)
    const section = screen.getByRole('region', { name: /Growth percentile tracker/i })
    expect(within(section).getByText(/Set the baby’s sex in Settings/i)).toBeTruthy()
    expect(within(section).getAllByText(/n\/a/i).length).toBeGreaterThan(0)
    // The measurement is still tracked and plotted.
    expect(within(section).getAllByText(/12 lb/i).length).toBeGreaterThan(0)
  })
})

describe('care summary profile block', () => {
  const report = buildCareReport({
    entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [], growthMeasurements: [], healthRecords: [],
    babyDob: '2026-01-01',
    babyName: 'Robin',
    babyProfile: { sex: 'female', birthWeightLb: 7.5, birthLengthCm: 50, pediatricianName: 'Dr Chen', pediatricianPhone: '555-0100' },
    now: Date.now(),
    rangeDays: 7,
  })

  it('prints the profile a clinician would ask for', () => {
    const html = buildCareReportHtml(report, DEFAULT_UNIT_PREFERENCES)
    expect(html).toContain('Sex female')
    expect(html).toContain('Birth weight 7 lb 8 oz')
    expect(html).toContain('Dr Chen')
    expect(html).toContain('555-0100')
  })

  it('omits the line entirely when no profile has been filled in', () => {
    const bare = buildCareReport({
      entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [], growthMeasurements: [], healthRecords: [],
      babyDob: '2026-01-01', now: Date.now(), rangeDays: 7,
    })
    expect(buildCareReportHtml(bare, DEFAULT_UNIT_PREFERENCES)).not.toContain('Pediatrician')
  })
})
