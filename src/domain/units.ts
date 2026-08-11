// Display units. Stored data stays canonical — volumes in fluid ounces, mass in
// pounds, lengths in centimetres — so switching units is a pure presentation
// change that never rewrites or migrates a single logged event.

export type VolumeUnit = 'oz' | 'ml'
export type MassUnit = 'lb' | 'kg'
export type LengthUnit = 'cm' | 'in'

export type UnitPreferences = { volume: VolumeUnit; mass: MassUnit; length: LengthUnit }

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = { volume: 'oz', mass: 'lb', length: 'cm' }

const ML_PER_OZ = 29.5735295625
const KG_PER_LB = 0.45359237
const CM_PER_IN = 2.54

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

// ---------------------------------------------------------------------------
// Volume (canonical: fluid ounces)

export const ozToDisplayVolume = (ounces: number, unit: VolumeUnit) =>
  unit === 'ml' ? round(ounces * ML_PER_OZ, 0) : round(ounces, 1)

export const displayVolumeToOz = (value: number, unit: VolumeUnit) =>
  unit === 'ml' ? value / ML_PER_OZ : value

export const volumeUnitLabel = (unit: VolumeUnit) => unit

// Spelled-out form for preset buttons, where the number carries the emphasis.
export const volumeUnitName = (unit: VolumeUnit) => (unit === 'ml' ? 'ml' : 'ounces')

// Nudge size for the bottle stepper: half an ounce, or a round 10 ml.
export const volumeStep = (unit: VolumeUnit) => (unit === 'ml' ? 10 : 0.5)

// Presets are authored per unit rather than converted, so the ml user gets
// round numbers (60, 75, 90…) instead of 59.1, 73.9, 88.7.
const VOLUME_PRESETS: Record<VolumeUnit, number[]> = {
  oz: [2, 2.5, 3, 3.5, 4],
  ml: [60, 75, 90, 105, 120],
}

export const volumePresets = (unit: VolumeUnit) => VOLUME_PRESETS[unit]

export const formatVolumeValue = (ounces: number, unit: VolumeUnit) => {
  const display = ozToDisplayVolume(ounces, unit)
  return unit === 'ml' ? String(display) : display.toFixed(1)
}

export const formatVolume = (ounces: number, unit: VolumeUnit) => `${formatVolumeValue(ounces, unit)} ${unit}`

// ---------------------------------------------------------------------------
// Mass (canonical: pounds)

export const lbToKg = (pounds: number) => pounds * KG_PER_LB
export const kgToLb = (kilograms: number) => kilograms / KG_PER_LB

// Imperial baby weights are spoken as "12 lb 4 oz", metric ones as "5.56 kg".
export const formatMass = (pounds: number | null | undefined, unit: MassUnit) => {
  if (!Number.isFinite(pounds)) return null
  const value = pounds as number
  if (unit === 'kg') return `${round(lbToKg(value), 2).toFixed(2)} kg`
  const totalOunces = Math.round(value * 16)
  const whole = Math.floor(totalOunces / 16)
  const ounces = totalOunces % 16
  return ounces === 0 ? `${whole} lb` : `${whole} lb ${ounces} oz`
}

export const lbToDisplayMass = (pounds: number, unit: MassUnit) =>
  unit === 'kg' ? round(lbToKg(pounds), 2) : round(pounds, 2)

export const displayMassToLb = (value: number, unit: MassUnit) => (unit === 'kg' ? kgToLb(value) : value)

// ---------------------------------------------------------------------------
// Length (canonical: centimetres)

export const cmToIn = (centimetres: number) => centimetres / CM_PER_IN
export const inToCm = (inches: number) => inches * CM_PER_IN

export const cmToDisplayLength = (centimetres: number, unit: LengthUnit) =>
  unit === 'in' ? round(cmToIn(centimetres), 1) : round(centimetres, 1)

export const displayLengthToCm = (value: number, unit: LengthUnit) => (unit === 'in' ? inToCm(value) : value)

export const lengthUnitLabel = (unit: LengthUnit) => unit

export const formatLength = (centimetres: number | null | undefined, unit: LengthUnit) => {
  if (!Number.isFinite(centimetres)) return null
  return `${cmToDisplayLength(centimetres as number, unit).toFixed(1)} ${unit}`
}

// ---------------------------------------------------------------------------

const isVolumeUnit = (value: unknown): value is VolumeUnit => value === 'oz' || value === 'ml'
const isMassUnit = (value: unknown): value is MassUnit => value === 'lb' || value === 'kg'
const isLengthUnit = (value: unknown): value is LengthUnit => value === 'cm' || value === 'in'

export const normalizeUnitPreferences = (value?: Partial<UnitPreferences> | null): UnitPreferences => ({
  volume: isVolumeUnit(value?.volume) ? value.volume : DEFAULT_UNIT_PREFERENCES.volume,
  mass: isMassUnit(value?.mass) ? value.mass : DEFAULT_UNIT_PREFERENCES.mass,
  length: isLengthUnit(value?.length) ? value.length : DEFAULT_UNIT_PREFERENCES.length,
})
