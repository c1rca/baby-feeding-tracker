export type GrowthMeasurement = {
  id: string
  measuredAt: number
  ageMonths: number
  weightLb: number | null
  lengthCm: number | null
  headCm: number | null
  note?: string
}

export type GrowthPercentile = 'p3' | 'p5' | 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'p95' | 'p97'

export type GrowthStandardPoint = { month: number } & Record<GrowthPercentile, number>

export type GrowthMetricKey = 'weight' | 'length' | 'head'

export type GrowthMetric = {
  key: GrowthMetricKey
  label: string
  unit: string
  standards: GrowthStandardPoint[]
}
