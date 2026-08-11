// Per-device display units. These are a presentation preference, not baby data:
// one caregiver can read millilitres while another reads ounces off the same
// synced record, so they live in localStorage rather than the synced state.
import { DEFAULT_UNIT_PREFERENCES, normalizeUnitPreferences, type UnitPreferences } from '../domain/units'

const KEY = 'baby-feeding-tracker:v1:unit-preferences'

export const readUnitPreferences = (): UnitPreferences => {
  try {
    const stored = localStorage.getItem(KEY)
    if (!stored) return DEFAULT_UNIT_PREFERENCES
    return normalizeUnitPreferences(JSON.parse(stored) as Partial<UnitPreferences>)
  } catch {
    return DEFAULT_UNIT_PREFERENCES
  }
}

export const persistUnitPreferences = (preferences: UnitPreferences) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalizeUnitPreferences(preferences)))
  } catch {
    // Best-effort; the in-memory preference still applies for this visit.
  }
}
