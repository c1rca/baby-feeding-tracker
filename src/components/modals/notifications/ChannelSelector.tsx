import { Bell, Smartphone, Server } from 'lucide-react'
import type { ChannelPrefs } from '../../../state/notificationPreferences'

type ChannelSelectorProps = {
  prefs: ChannelPrefs
  onChange: (prefs: ChannelPrefs) => void
  label: string
  disabled?: boolean
  gotifyAvailable?: boolean
}

const channels = [
  { key: 'inApp', label: 'In-app', icon: Bell, description: 'Notification appears in the app' },
  { key: 'browser', label: 'Browser', icon: Smartphone, description: 'Browser notification on this device' },
  { key: 'gotify', label: 'Gotify', icon: Server, description: 'Push notification via server' },
] as const

export function ChannelSelector({ prefs, onChange, label, disabled = false, gotifyAvailable = true }: ChannelSelectorProps) {
  const toggle = (channel: keyof ChannelPrefs) => {
    if (!disabled && (channel !== 'gotify' || gotifyAvailable)) {
      onChange({ ...prefs, [channel]: !prefs[channel] })
    }
  }

  return (
    <div className="notif-channel-selector" role="group" aria-label={label}>
      {channels.map(({ key, label: channelLabel, icon: Icon, description }) => (
        <button
          key={key}
          type="button"
          role="switch"
          aria-checked={prefs[key]}
          aria-label={`${label} via ${channelLabel}: ${description}. ${prefs[key] ? 'Currently enabled' : 'Currently disabled'}`}
          disabled={disabled || (key === 'gotify' && !gotifyAvailable)}
          className={`notif-channel-toggle${prefs[key] ? ' is-on' : ''}`}
          onClick={() => toggle(key)}
          title={description}
        >
          <Icon size={16} aria-hidden="true" />
          <span className="notif-channel-label">{channelLabel}</span>
        </button>
      ))}
    </div>
  )
}
