import { describe, expect, it } from 'vitest'
import { GIRL_GROWTH_STANDARDS, BOY_GROWTH_STANDARDS, growthStandardsFor } from './growthStandards'
import { buildGrowthMetricModels, estimatePercentile } from './growth'
import type { GrowthMeasurement } from './growthTypes'

const metricOf = (set: typeof BOY_GROWTH_STANDARDS, key: string) => set.find((metric) => metric.key === key)!

describe('CDC infant reference tables', () => {
  it('covers the CDC birth-to-36-month range for both sexes and all three metrics', () => {
    for (const set of [BOY_GROWTH_STANDARDS, GIRL_GROWTH_STANDARDS]) {
      expect(set.map((metric) => metric.key)).toEqual(['weight', 'length', 'head'])
      for (const metric of set) {
        expect(metric.standards.length).toBeGreaterThanOrEqual(37)
        expect(metric.standards[0].month).toBe(0)
        expect(metric.standards.at(-1)!.month).toBeGreaterThanOrEqual(35.5)
      }
    }
  })

  it('matches published CDC birth medians', () => {
    // CDC 2000 birth p50: boys 3.530 kg / 49.989 cm / 35.814 cm; girls 3.399 kg / 49.286 cm / 34.712 cm.
    expect(metricOf(BOY_GROWTH_STANDARDS, 'weight').standards[0].p50).toBeCloseTo(3.530203168 / 0.45359237, 3)
    expect(metricOf(GIRL_GROWTH_STANDARDS, 'weight').standards[0].p50).toBeCloseTo(3.39918645 / 0.45359237, 3)
    expect(metricOf(BOY_GROWTH_STANDARDS, 'length').standards[0].p50).toBeCloseTo(49.98888408, 4)
    expect(metricOf(GIRL_GROWTH_STANDARDS, 'length').standards[0].p50).toBeCloseTo(49.28639612, 4)
    expect(metricOf(BOY_GROWTH_STANDARDS, 'head').standards[0].p50).toBeCloseTo(35.81366835, 4)
    expect(metricOf(GIRL_GROWTH_STANDARDS, 'head').standards[0].p50).toBeCloseTo(34.7115617, 4)
  })

  it('keeps percentile bands monotonic at every age', () => {
    const bands = ['p3', 'p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95', 'p97'] as const
    for (const set of [BOY_GROWTH_STANDARDS, GIRL_GROWTH_STANDARDS]) {
      for (const metric of set) {
        for (const point of metric.standards) {
          for (let index = 1; index < bands.length; index += 1) {
            expect(point[bands[index]]).toBeGreaterThan(point[bands[index - 1]])
          }
        }
      }
    }
  })

  it('grows monotonically with age', () => {
    for (const set of [BOY_GROWTH_STANDARDS, GIRL_GROWTH_STANDARDS]) {
      for (const metric of set) {
        for (let index = 1; index < metric.standards.length; index += 1) {
          expect(metric.standards[index].p50).toBeGreaterThan(metric.standards[index - 1].p50)
        }
      }
    }
  })

  it('places girls below boys at the same age, as the standards do', () => {
    for (const key of ['weight', 'length', 'head']) {
      expect(metricOf(GIRL_GROWTH_STANDARDS, key).standards[12].p50)
        .toBeLessThan(metricOf(BOY_GROWTH_STANDARDS, key).standards[12].p50)
    }
  })
})

describe('sex-specific percentiles', () => {
  // 8.8 kg at 12 months is close to the girls' median and below the boys'.
  const measurement: GrowthMeasurement = { id: 'g', measuredAt: 0, ageMonths: 12, weightLb: 8.8 / 0.45359237, lengthCm: null, headCm: null }

  it('reads the same measurement differently against each reference', () => {
    const asGirl = buildGrowthMetricModels([measurement], 'girls')[0].latest!.percentileEstimate
    const asBoy = buildGrowthMetricModels([measurement], 'boys')[0].latest!.percentileEstimate
    expect(asGirl.percentile).not.toBe(asBoy.percentile)
    expect(asGirl.percentile!).toBeGreaterThan(asBoy.percentile!)
  })

  it('puts a girl at her own median near the 50th', () => {
    const month = 11.5
    const median = metricOf(GIRL_GROWTH_STANDARDS, 'weight').standards.find((point) => point.month === month)!.p50
    const estimate = estimatePercentile(metricOf(growthStandardsFor('girls'), 'weight'), month, median)
    expect(estimate.percentile).toBe(50)
  })
})
