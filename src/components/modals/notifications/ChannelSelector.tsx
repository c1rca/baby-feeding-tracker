import { Bell, Smartphone, Server } from 'lucide-react'
import type { ChannelPrefs } from '../../../state/notificationPreferences'

type ChannelSelectorProps = {
  prefs: ChannelPrefs
  onChange: (prefs: ChannelPrefs) => void
  label: string
  disabled?: boolean
  gotifyAvailable?: boolean
  /**
   * Why a channel cannot be used right now, keyed by channel. A switch that
   * silently does nothing is worse than one that says why it is unavailable —
   * per-type "Browser" was exactly that whenever this device had reminders off.
   */
  unavailable?: Partial<Record<keyof ChannelPrefs, string>>
  /**
   * Channels this notification type can actually use. Gotify is scheduled
   * server-side and knows nothing about caregiver-defined trackers, so that
   * card omits it rather than showing a switch that could never do anything.
   */
  channels?: ReadonlyArray<keyof ChannelPrefs>
}

const channels = [
  { key: 'inApp', label: 'In-app', icon: Bell, description: 'Notification appears in the app' },
  { key: 'browser', label: 'Browser', icon: Smartphone, description: 'Browser notification on this device' },
  { key: 'gotify', label: 'Gotify', icon: Server, description: 'Push notification via server' },
] as const

export function ChannelSelector({ prefs, onChange, label, disabled = false, gotifyAvailable = true, unavailable = {}, channels: allowed }: ChannelSelectorProps) {
  const toggle = (channel: keyof ChannelPrefs) => {
    if (!disabled && !unavailable[channel] && (channel !== 'gotify' || gotifyAvailable)) {
      onChange({ ...prefs, [channel]: !prefs[channel] })
    }
  }

  return (
    <div className="notif-channel-selector" role="group" aria-label={label}>
      {channels.filter(({ key }) => !allowed || allowed.includes(key)).map(({ key, label: channelLabel, icon: Icon, description }) => (
        <button
          key={key}
          type="button"
          role="switch"
          aria-checked={prefs[key]}
          aria-label={`${label} via ${channelLabel}: ${unavailable[key] ?? description}. ${prefs[key] ? 'Currently enabled' : 'Currently disabled'}`}
          disabled={disabled || Boolean(unavailable[key]) || (key === 'gotify' && !gotifyAvailable)}
          className={`notif-channel-toggle${prefs[key] ? ' is-on' : ''}${unavailable[key] ? ' is-unavailable' : ''}`}
          onClick={() => toggle(key)}
          title={unavailable[key] ?? description}
        >
          <Icon size={16} aria-hidden="true" />
          <span className="notif-channel-label">{channelLabel}</span>
        </button>
      ))}
    </div>
  )
}
