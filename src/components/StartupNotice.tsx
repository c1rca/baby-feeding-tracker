import { CloudOff, RefreshCw } from 'lucide-react'

type StartupNoticeProps = {
  sessionUnavailable: boolean
  babiesFailed: boolean
  onRetry: () => void
  retrying: boolean
}

/**
 * A non-blocking banner for the two startup failures that used to be invisible:
 * the session endpoint being unreachable (which silently made the user
 * anonymous) and the baby list failing to load (which was indistinguishable
 * from having no babies).
 *
 * Deliberately not a blocking screen — local data and the offline queue are the
 * point of this app, so a caregiver must still be able to log a feed.
 */
export function StartupNotice({ sessionUnavailable, babiesFailed, onRetry, retrying }: StartupNoticeProps) {
  if (!sessionUnavailable && !babiesFailed) return null
  const message = sessionUnavailable
    ? 'Can’t reach the server. You can keep logging — everything saves on this device and syncs when the connection returns.'
    : 'Couldn’t load this household’s babies. Showing what’s stored on this device.'
  return (
    <div className="startup-notice" role="status">
      <span className="startup-notice-icon" aria-hidden="true"><CloudOff size={17} /></span>
      <div><strong>Working offline</strong><span>{message}</span></div>
      <button type="button" aria-label="Retry connecting" disabled={retrying} onClick={onRetry}><RefreshCw size={14} /> {retrying ? 'Retrying…' : 'Retry'}</button>
    </div>
  )
}
