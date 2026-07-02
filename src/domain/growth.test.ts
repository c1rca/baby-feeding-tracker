import { describe, expect, it } from 'vitest'
import { buildGrowthMetricModels, calculateAgeMonths, estimatePercentile, normalizeGrowthMeasurements } from './growth'
import { BOY_GROWTH_STANDARDS } from './growthStandards'

describe('growth percentile modeling', () => {
  it('calculates CDC/WHO infant age buckets from date of birth and measurement date', () => {
    expect(calculateAgeMonths('2026-06-03', new Date('2026-06-03T12:00:00').getTime())).toBe(0)
    expect(calculateAgeMonths('2026-06-03', new Date('2026-06-22T12:00:00').getTime())).toBe(0.5)
    expect(calculateAgeMonths('2026-06-03', new Date('2026-07-18T12:00:00').getTime())).toBe(1.5)
  })

  it('estimates a baby measurement against WHO percentile curves', () => {
    const weight = BOY_GROWTH_STANDARDS.find((metric) => metric.key === 'weight')!
    const monthTwo = weight.standards.find((point) => point.month === 1.5)!

    expect(estimatePercentile(weight, 1.5, monthTwo.p50)).toEqual({ kind: 'percentile', percentile: 50, label: '50th' })
    expect(estimatePercentile(weight, 1.5, monthTwo.p90)).toEqual({ kind: 'percentile', percentile: 90, label: '90th' })
  })

  it('does not invent numeric percentiles outside the p3-p97 reference band', () => {
    const weight = BOY_GROWTH_STANDARDS.find((metric) => metric.key === 'weight')!
    const monthTwo = weight.standards.find((point) => point.month === 1.5)!

    expect(estimatePercentile(weight, 1.5, monthTwo.p3 - 0.1)).toEqual({ kind: 'below-range', percentile: null, label: '<3rd', reason: 'below-p3' })
    expect(estimatePercentile(weight, 1.5, monthTwo.p97 + 0.1)).toEqual({ kind: 'above-range', percentile: null, label: '>97th', reason: 'above-p97' })
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
