import { Bell, Smartphone, Server } from 'lucide-react'
import type { ChannelPrefs } from '../../../state/notificationPreferences'

type ChannelSelectorProps = {
  prefs: ChannelPrefs
  onChange: (prefs: ChannelPrefs) => void
  label: string
  disabled?: boolean
}

const channels = [
  { key: 'inApp', label: 'In-app', icon: Bell },
  { key: 'browser', label: 'Browser', icon: Smartphone },
  { key: 'gotify', label: 'Gotify', icon: Server },
] as const

export function ChannelSelector({ prefs, onChange, label, disabled = false }: ChannelSelectorProps) {
  const toggle = (channel: keyof ChannelPrefs) => {
    if (!disabled) {
      onChange({ ...prefs, [channel]: !prefs[channel] })
    }
  }

  return (
    <div className="notif-channel-selector" role="group" aria-label={label}>
      {channels.map(({ key, label: channelLabel, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="switch"
          aria-checked={prefs[key]}
          aria-label={`${label} via ${channelLabel}`}
          disabled={disabled}
          className={`notif-channel-toggle${prefs[key] ? ' is-on' : ''}`}
          onClick={() => toggle(key)}
        >
          <Icon size={16} aria-hidden="true" />
          <span className="notif-channel-label">{channelLabel}</span>
        </button>
      ))}
    </div>
  )
}
