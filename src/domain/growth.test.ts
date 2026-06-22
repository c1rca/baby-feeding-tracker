import { describe, expect, it } from 'vitest'
import { buildGrowthMetricModels, calculateAgeMonths, estimatePercentile, normalizeGrowthMeasurements } from './growth'
import { BOY_GROWTH_STANDARDS } from './growthStandards'

describe('growth percentile modeling', () => {
  it('calculates age in months from date of birth and measurement date', () => {
    expect(calculateAgeMonths('2026-06-03', new Date('2026-07-03T12:00:00').getTime())).toBe(1)
  })

  it('estimates a baby measurement against WHO percentile curves', () => {
    const weight = BOY_GROWTH_STANDARDS.find((metric) => metric.key === 'weight')!
    const monthTwo = weight.standards.find((point) => point.month === 1.5)!

    expect(estimatePercentile(weight, 1.5, monthTwo.p50)).toBe(50)
    expect(estimatePercentile(weight, 1.5, monthTwo.p90)).toBe(90)
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
