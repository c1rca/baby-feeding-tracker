import { describe, expect, it } from 'vitest'
import { buildGrowthMetricModels, calculateAgeMonths, estimatePercentile, normalizeGrowthMeasurements } from './growth'
import { BOY_GROWTH_STANDARDS } from './growthStandards'

describe('growth percentile modeling', () => {
  it('calculates CDC infant age buckets from date of birth and measurement date', () => {
    expect(calculateAgeMonths('2026-06-03', new Date('2026-06-03T12:00:00').getTime())).toBe(0)
    expect(calculateAgeMonths('2026-06-03', new Date('2026-06-22T12:00:00').getTime())).toBe(0.5)
    expect(calculateAgeMonths('2026-06-03', new Date('2026-07-18T12:00:00').getTime())).toBe(1.5)
    expect(calculateAgeMonths('2023-01-01', new Date('2026-05-01T12:00:00').getTime())).toBe(36)
  })

  it('estimates a baby measurement against CDC percentile curves', () => {
    const weight = BOY_GROWTH_STANDARDS.find((metric) => metric.key === 'weight')!
    const monthTwo = weight.standards.find((point) => point.month === 2)!

    expect(estimatePercentile(weight, 2, monthTwo.p50)).toEqual({ kind: 'percentile', percentile: 50, label: '50th' })
    expect(estimatePercentile(weight, 2, monthTwo.p90)).toEqual({ kind: 'percentile', percentile: 90, label: '90th' })
  })

  it('does not invent numeric percentiles outside the p3-p97 reference band', () => {
    const weight = BOY_GROWTH_STANDARDS.find((metric) => metric.key === 'weight')!
    const monthTwo = weight.standards.find((point) => point.month === 2)!

    expect(estimatePercentile(weight, 2, monthTwo.p3 - 0.1)).toEqual({ kind: 'below-range', percentile: null, label: '<3rd', reason: 'below-p3' })
    expect(estimatePercentile(weight, 2, monthTwo.p97 + 0.1)).toEqual({ kind: 'above-range', percentile: null, label: '>97th', reason: 'above-p97' })
  })

  it('builds latest chart models from normalized measurements', () => {
    const measurements = normalizeGrowthMeasurements([
      { id: 'b', measuredAt: 2000, ageMonths: 2, weightLb: 12, lengthCm: 58, headCm: 39 },
      { id: 'a', measuredAt: 1000, ageMonths: 1, weightLb: 9, lengthCm: null, headCm: null },
      { id: 'bad', measuredAt: 'nope' },
    ])
    const models = buildGrowthMetricModels(measurements)
    const weight = models.find((model) => model.metric.key === 'weight')!
    const length = models.find((model) => model.metric.key === 'length')!

    expect(measurements.map((item) => item.id)).toEqual(['b', 'a'])
    expect(weight.babyPoints).toHaveLength(2)
    expect(weight.latest?.measurement.id).toBe('b')
    expect(length.babyPoints).toHaveLength(1)
    expect(length.latest?.value).toBe(58)
  })
})

describe('growth percentiles use the real age, not a bucketed one', () => {
  const AVG_DAYS_PER_MONTH = 365.2425 / 12
  const DOB = '2026-01-01'
  const dobMs = new Date(`${DOB}T12:00:00`).getTime()
  const atVisit = (months: number) => dobMs + months * AVG_DAYS_PER_MONTH * 86_400_000
  const weight = BOY_GROWTH_STANDARDS.find((metric) => metric.key === 'weight')!

  // Age was bucketed to floor(months) + 0.5, so a measurement taken *on* a well
  // visit was scored against curves half a month older. Infant growth is steep
  // enough early on that the error is large and always in the same direction:
  // a baby exactly on the median read 30th at his two-month visit, and one
  // exactly on p3 read "<3rd" — off the bottom of the chart, which is the
  // reading most likely to frighten a parent and trigger a workup.
  it.each([2, 4, 6, 9, 12])('scores a p50 baby near the median at the %i-month visit', (visit) => {
    const measuredAt = atVisit(visit)
    const p50 = weight.standards.find((point) => point.month === visit)!.p50
    const [model] = buildGrowthMetricModels(
      [{ id: 'm1', measuredAt, ageMonths: Math.floor(visit) + 0.5, weightLb: p50, lengthCm: null, headCm: null }],
      'boys',
      DOB,
    ).filter((entry) => entry.metric.key === 'weight')

    const estimate = model.latest!.percentileEstimate
    expect(estimate.kind).toBe('percentile')
    expect(Math.abs((estimate.percentile as number) - 50)).toBeLessThanOrEqual(2)
  })

  it('keeps a p3 baby on the chart instead of reporting below-range', () => {
    const measuredAt = atVisit(2)
    const p3 = weight.standards.find((point) => point.month === 2)!.p3
    const [model] = buildGrowthMetricModels(
      [{ id: 'm1', measuredAt, ageMonths: 2.5, weightLb: p3, lengthCm: null, headCm: null }],
      'boys',
      DOB,
    ).filter((entry) => entry.metric.key === 'weight')

    expect(model.latest!.percentileEstimate.kind).toBe('percentile')
    expect(model.latest!.percentileEstimate.percentile).toBeLessThanOrEqual(6)
  })

  it('corrects records already stored with the bucketed age', () => {
    // The bad age was persisted, so fixing only new measurements would leave
    // every historical reading wrong. Recomputing from the birth date repairs
    // history without a migration.
    const measuredAt = atVisit(2)
    const p50 = weight.standards.find((point) => point.month === 2)!.p50
    const stored = { id: 'old', measuredAt, ageMonths: 2.5, weightLb: p50, lengthCm: null, headCm: null }

    const withDob = buildGrowthMetricModels([stored], 'boys', DOB).find((entry) => entry.metric.key === 'weight')!
    expect(withDob.latest!.ageMonths).toBeCloseTo(2, 1)

    // With no birth date there is nothing to recompute from, so the stored
    // value still has to be honoured rather than guessed at.
    const withoutDob = buildGrowthMetricModels([stored], 'boys').find((entry) => entry.metric.key === 'weight')!
    expect(withoutDob.latest!.ageMonths).toBe(2.5)
  })
})
