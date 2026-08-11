import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { UnitPreferencesProvider } from './UnitPreferencesProvider'
import { readUnitPreferences, persistUnitPreferences } from './unitPreferences'
import { TrackOverview } from '../components/TrackOverview'

const emptyRhythm = { dayStartMs: 0, dayEndMs: 86_400_000, nowMs: 43_200_000, feeds: [], diapers: [], spans: [], summary: '0 feeds, 0 diapers', recap: { tummyMinutes: 0, tummyGoalMinutes: 20, tummyGoalMet: false, sleepMinutes: 0, vitaminDAtMs: null, wet: 0, stool: 0, customs: [], showSleep: true } }

const renderOverview = () => render(
  <UnitPreferencesProvider>
    <TrackOverview
      today={{ count: 1, nursing: 0, oz: 4, left: 0, right: 0, wet: 0, stool: 0 }}
      pumpedOzToday={3.5}
      pumpCountToday={1}
      showBottleStat
      showPumpStat
      rhythm={emptyRhythm}
    />
  </UnitPreferencesProvider>,
)

describe('unit preference persistence', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to the imperial units the app already shipped', () => {
    expect(readUnitPreferences()).toEqual({ volume: 'oz', mass: 'lb', length: 'cm' })
  })

  it('round-trips through localStorage and ignores corrupt values', () => {
    persistUnitPreferences({ volume: 'ml', mass: 'kg', length: 'in' })
    expect(readUnitPreferences()).toEqual({ volume: 'ml', mass: 'kg', length: 'in' })

    localStorage.setItem('baby-feeding-tracker:v1:unit-preferences', 'not json')
    expect(readUnitPreferences()).toEqual({ volume: 'oz', mass: 'lb', length: 'cm' })
  })
})

describe('unit preferences applied to rendered volumes', () => {
  beforeEach(() => localStorage.clear())

  it('renders canonical ounces by default', () => {
    renderOverview()
    expect(screen.getByText('4.0 oz')).toBeTruthy()
    expect(screen.getByText('3.5 oz')).toBeTruthy()
  })

  it('renders the same stored ounces as millilitres once the preference is metric', () => {
    persistUnitPreferences({ volume: 'ml', mass: 'kg', length: 'in' })
    renderOverview()
    expect(screen.getByText('118 ml')).toBeTruthy()
    expect(screen.getByText('104 ml')).toBeTruthy()
  })
})
