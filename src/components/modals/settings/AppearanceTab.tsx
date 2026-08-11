import { useState } from 'react'

import { applySkin, readSkin } from '../../../skin'
import { SettingToggle } from '../SettingToggle'
import { useUnits } from '../../../state/unitPreferencesContext'
import { SettingsRow, SettingsSection } from './SettingsPrimitives'

export function AppearanceSetting({ theme, setTheme, liveSyncEnabled = true, setLiveSyncEnabled }: { theme: 'light' | 'dark'; setTheme: (theme: 'light' | 'dark') => void; liveSyncEnabled?: boolean; setLiveSyncEnabled?: (enabled: boolean) => void }) {
  const [skin, setSkin] = useState(readSkin)

  return (
    <SettingsSection label="This device" lead="Remembered on this device only — not shared with the household.">
      <div className="settings-card">
        <SettingsRow
          title="Dark mode"
          hint="Switch between the light and dark palette."
          control={<SettingToggle checked={theme === 'dark'} onChange={(next) => setTheme(next ? 'dark' : 'light')} label="Dark mode" />}
        />
        <SettingsRow
          title="Live sync"
          hint="Show other devices' changes as they happen. Off falls back to syncing when the app opens."
          control={<SettingToggle checked={liveSyncEnabled} onChange={(next) => setLiveSyncEnabled?.(next)} label="Live sync" disabled={!setLiveSyncEnabled} />}
        />
        <SettingsRow
          title="Classic design"
          hint="Use the simpler classic look instead of Lullaby."
          control={(
            <SettingToggle
              checked={skin === 'classic'}
              onChange={(next) => {
                const target = next ? 'classic' : 'lullaby'
                applySkin(target)
                setSkin(target)
              }}
              label="Classic design"
            />
          )}
        />
      </div>
    </SettingsSection>
  )
}

const UNIT_CHOICES = [
  { key: 'volume', label: 'Bottle & pumping', blurb: 'Bottle amounts, pumping output, and feeding totals.', options: [['oz', 'Ounces'], ['ml', 'Millilitres']] },
  { key: 'mass', label: 'Weight', blurb: 'Growth weights and the percentile readouts.', options: [['lb', 'Pounds'], ['kg', 'Kilograms']] },
  { key: 'length', label: 'Length & head', blurb: 'Length and head-circumference measurements.', options: [['cm', 'Centimetres'], ['in', 'Inches']] },
] as const

export function UnitsSetting() {
  const { units, setUnits } = useUnits()
  return (
    <SettingsSection label="Units" lead="How amounts are shown and entered everywhere in the app.">
      <div className="settings-card">
        {UNIT_CHOICES.map(({ key, label, blurb, options }) => (
          <SettingsRow
            key={key}
            title={label}
            hint={blurb}
            control={(
              <div className="care-segmented settings-segmented" role="group" aria-label={`${label} units`}>
                {options.map(([value, optionLabel]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={units[key] === value}
                    className={units[key] === value ? 'is-active' : ''}
                    onClick={() => setUnits({ [key]: value })}
                  >
                    {optionLabel}
                  </button>
                ))}
              </div>
            )}
          />
        ))}
      </div>
    </SettingsSection>
  )
}
