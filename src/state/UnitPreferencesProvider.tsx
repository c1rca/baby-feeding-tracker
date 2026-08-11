import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { UnitPreferences } from '../domain/units'
import { UnitPreferencesContext } from './unitPreferencesContext'
import { persistUnitPreferences, readUnitPreferences } from './unitPreferences'

export function UnitPreferencesProvider({ children }: { children: ReactNode }) {
  const [units, setUnitsState] = useState<UnitPreferences>(readUnitPreferences)

  const setUnits = useCallback((next: Partial<UnitPreferences>) => {
    setUnitsState((current) => {
      const merged = { ...current, ...next }
      persistUnitPreferences(merged)
      return merged
    })
  }, [])

  const value = useMemo(() => ({ units, setUnits }), [units, setUnits])
  return <UnitPreferencesContext.Provider value={value}>{children}</UnitPreferencesContext.Provider>
}
