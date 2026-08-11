import { useState } from 'react'
import { SettingsRow, SettingsSection } from './SettingsPrimitives'

// No save button: the greeting name is one field, so it persists as you type and
// only falls back to the default once you leave an empty box.
export function ProfileSetting({ profileName, setProfileName }: { profileName: string; setProfileName: (name: string) => void }) {
  const [draft, setDraft] = useState(profileName)
  const commit = (value: string) => {
    setDraft(value)
    if (value.trim()) setProfileName(value)
  }
  const normalize = () => {
    const next = draft.trim() || 'Mom'
    setDraft(next)
    setProfileName(next)
  }
  return (
    <SettingsSection label="You" lead="The name used in your greeting and profile avatar.">
      <div className="settings-card">
        <SettingsRow
          title="Your name"
          hint="Saved as you type. Shown in the greeting on the tracker."
          control={<input aria-label="Your profile name" value={draft} onChange={(event) => commit(event.target.value)} onBlur={normalize} placeholder="Mom" />}
        />
      </div>
    </SettingsSection>
  )
}
