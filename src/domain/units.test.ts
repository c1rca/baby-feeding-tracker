import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UNIT_PREFERENCES,
  cmToDisplayLength,
  displayLengthToCm,
  displayVolumeToOz,
  formatLength,
  formatMass,
  formatVolume,
  normalizeUnitPreferences,
  ozToDisplayVolume,
  volumePresets,
  volumeStep,
} from './units'

describe('volume', () => {
  it('keeps ounces untouched and converts to whole millilitres', () => {
    expect(ozToDisplayVolume(3.5, 'oz')).toBe(3.5)
    expect(ozToDisplayVolume(3.5, 'ml')).toBe(104)
    expect(formatVolume(3.5, 'oz')).toBe('3.5 oz')
    expect(formatVolume(3.5, 'ml')).toBe('104 ml')
  })

  it('round-trips a display value back to canonical ounces within the millilitre rounding', () => {
    expect(displayVolumeToOz(3.5, 'oz')).toBe(3.5)
    // Whole-millilitre display costs at most half a ml (~0.017 oz) on the way back.
    expect(displayVolumeToOz(ozToDisplayVolume(4, 'ml'), 'ml')).toBeCloseTo(4, 1)
  })

  it('offers round presets and steps per unit rather than converted ones', () => {
    expect(volumePresets('oz')).toEqual([2, 2.5, 3, 3.5, 4])
    expect(volumePresets('ml')).toEqual([60, 75, 90, 105, 120])
    expect(volumeStep('oz')).toBe(0.5)
    expect(volumeStep('ml')).toBe(10)
  })
})

describe('mass', () => {
  it('speaks imperial baby weights as pounds and ounces', () => {
    expect(formatMass(12.25, 'lb')).toBe('12 lb 4 oz')
    expect(formatMass(12, 'lb')).toBe('12 lb')
  })

  it('renders metric weights to two decimals', () => {
    expect(formatMass(12.25, 'kg')).toBe('5.56 kg')
  })

  it('returns null for a missing measurement', () => {
    expect(formatMass(null, 'lb')).toBeNull()
    expect(formatMass(undefined, 'kg')).toBeNull()
  })
})

describe('length', () => {
  it('converts centimetres to inches for display and back', () => {
    expect(cmToDisplayLength(60.5, 'cm')).toBe(60.5)
    expect(cmToDisplayLength(60.96, 'in')).toBe(24)
    expect(displayLengthToCm(24, 'in')).toBeCloseTo(60.96, 2)
    expect(formatLength(60.5, 'cm')).toBe('60.5 cm')
    expect(formatLength(60.96, 'in')).toBe('24.0 in')
  })

  it('returns null for a missing measurement', () => {
    expect(formatLength(null, 'cm')).toBeNull()
  })
})

describe('normalizeUnitPreferences', () => {
  it('falls back to the imperial-volume defaults for missing or unknown units', () => {
    expect(normalizeUnitPreferences(undefined)).toEqual(DEFAULT_UNIT_PREFERENCES)
    expect(normalizeUnitPreferences({ volume: 'pints' as never, mass: 'kg', length: 'in' })).toEqual({ volume: 'oz', mass: 'kg', length: 'in' })
  })
})
