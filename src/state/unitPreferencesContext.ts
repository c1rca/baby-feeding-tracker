import { createContext, useContext } from 'react'
import { DEFAULT_UNIT_PREFERENCES, type UnitPreferences } from '../domain/units'

export type UnitPreferencesValue = {
  units: UnitPreferences
  setUnits: (next: Partial<UnitPreferences>) => void
}

// Formatting preferences are read by leaf components several layers down
// (bottle modal, timeline rows, growth cards, stat tiles). Threading them as
// props would touch every intermediate component for a value none of them use,
// so this is the one shared read-only concern kept in context.
//
// The default is the imperial baseline the app already shipped, which means a
// component rendered without a provider — as unit tests do — behaves exactly as
// it did before units existed.
export const UnitPreferencesContext = createContext<UnitPreferencesValue>({
  units: DEFAULT_UNIT_PREFERENCES,
  setUnits: () => {},
})

export const useUnits = () => useContext(UnitPreferencesContext)
