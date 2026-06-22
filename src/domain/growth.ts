import { BOY_GROWTH_STANDARDS } from './growthStandards'
import type { GrowthMeasurement, GrowthMetric, GrowthMetricKey, GrowthStandardPoint } from './growthTypes'

export const GROWTH_PERCENTILE_LINES = ['p3', 'p10', 'p25', 'p50', 'p75', 'p90', 'p97'] as const
export const GROWTH_REFERENCE_SOURCE = 'WHO Child Growth Standards for boys 0–24 months via CDC LMS tables'

const valueForMetric = (measurement: GrowthMeasurement, key: GrowthMetricKey) => {
  if (key === 'weight') return measurement.weightLb
  if (key === 'length') return measurement.lengthCm
  return measurement.headCm
}

const interpolate = (points: GrowthStandardPoint[], ageMonths: number, percentile: keyof Omit<GrowthStandardPoint, 'month'>) => {
  const sorted = [...points].sort((a, b) => a.month - b.month)
  const first = sorted[0]
  const last = sorted.at(-1) ?? first
  if (ageMonths <= first.month) return first[percentile]
  if (ageMonths >= last.month) return last[percentile]
  const upperIndex = sorted.findIndex((point) => point.month >= ageMonths)
  const upper = sorted[upperIndex]
  const lower = sorted[upperIndex - 1]
  const ratio = (ageMonths - lower.month) / (upper.month - lower.month)
  return lower[percentile] + (upper[percentile] - lower[percentile]) * ratio
}

export function estimatePercentile(metric: GrowthMetric, ageMonths: number, value: number) {
  const bands = ['p3', 'p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95', 'p97'] as const
  const values = bands.map((band) => ({ band, numeric: Number(band.slice(1)), value: interpolate(metric.standards, ageMonths, band) }))
  if (value <= values[0].value) return Math.max(1, Math.round((value / values[0].value) * 3))
  const last = values.at(-1)!
  if (value >= last.value) return Math.min(99, Math.round(97 + ((value - last.value) / last.value) * 3))
  const upperIndex = values.findIndex((point) => point.value >= value)
  const upper = values[upperIndex]
  const lower = values[upperIndex - 1]
  const ratio = (value - lower.value) / (upper.value - lower.value)
  return Math.round(lower.numeric + (upper.numeric - lower.numeric) * ratio)
}

export function buildGrowthMetricModels(measurements: GrowthMeasurement[]) {
  const sortedMeasurements = [...measurements].sort((a, b) => a.measuredAt - b.measuredAt)
  return BOY_GROWTH_STANDARDS.map((metric) => {
    const babyPoints = sortedMeasurements
      .map((measurement) => {
        const value = valueForMetric(measurement, metric.key)
        if (!Number.isFinite(value)) return null
        return {
          measurement,
          ageMonths: measurement.ageMonths,
          value: value as number,
          percentile: estimatePercentile(metric, measurement.ageMonths, value as number),
        }
      })
      .filter((point): point is NonNullable<typeof point> => Boolean(point))
    return { metric, babyPoints, latest: babyPoints.at(-1) ?? null }
  })
}

export function normalizeGrowthMeasurements(value: unknown): GrowthMeasurement[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): GrowthMeasurement | null => {
      if (!item || typeof item !== 'object') return null
      const raw = item as Partial<GrowthMeasurement>
      const measuredAt = Number(raw.measuredAt)
      const ageMonths = Number(raw.ageMonths)
      if (!raw.id || !Number.isFinite(measuredAt) || !Number.isFinite(ageMonths)) return null
      return {
        id: String(raw.id),
        measuredAt,
        ageMonths,
        weightLb: raw.weightLb !== null && raw.weightLb !== undefined && Number.isFinite(Number(raw.weightLb)) ? Number(raw.weightLb) : null,
        lengthCm: raw.lengthCm !== null && raw.lengthCm !== undefined && Number.isFinite(Number(raw.lengthCm)) ? Number(raw.lengthCm) : null,
        headCm: raw.headCm !== null && raw.headCm !== undefined && Number.isFinite(Number(raw.headCm)) ? Number(raw.headCm) : null,
        note: raw.note ? String(raw.note) : undefined,
      }
    })
    .filter((item): item is GrowthMeasurement => Boolean(item))
    .sort((a, b) => b.measuredAt - a.measuredAt)
}
