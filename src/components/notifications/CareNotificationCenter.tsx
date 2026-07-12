import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronRight, Dumbbell, Pill, Sun, X } from 'lucide-react'
import type { CareNotification } from './notificationModel'
import { careNotificationSummary } from './notificationModel'

type Props = { notifications: CareNotification[] }

const iconFor = (kind: CareNotification['kind']) => kind === 'tummy_time' ? <Dumbbell size={17} /> : kind === 'vitamin_d' ? <Sun size={17} /> : <Pill size={17} />

export function CareNotificationCenter({ notifications }: Props) {
  const [open, setOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)
  const close = () => { setOpen(false); window.setTimeout(() => openerRef.current?.focus(), 0) }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (notifications.length === 0) return null
  const primary = notifications[0]
  const summary = careNotificationSummary(notifications)

  return <section className="care-notification-center" aria-label="Care notifications">
    <div className="care-notification-dock">
      <button ref={openerRef} type="button" className="care-notification-opener" aria-label="Open care notifications" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className="care-notification-orb"><Bell size={17} /><i /></span>
        <span className="care-notification-copy"><strong>{notifications.length === 1 ? primary.title : `${notifications.length} care reminders`}</strong><span>{summary}</span></span>
        <ChevronRight className="care-notification-chevron" size={18} aria-hidden="true" />
      </button>
      <button type="button" className={`care-notification-primary-action care-notification-primary-action--${primary.kind}`} aria-label={primary.ariaActionLabel} onClick={primary.action}>{iconFor(primary.kind)}<span>{primary.actionLabel}</span></button>
    </div>
    {open ? <div className="care-notification-panel" role="dialog" aria-label="Care notifications" aria-modal="false">
      <header className="care-notification-panel-header"><div><span>Care notifications</span><small>{notifications.length} {notifications.length === 1 ? 'needs' : 'need'} attention</small></div><button type="button" className="icon-plain" aria-label="Close care notifications" onClick={close}><X size={18} /></button></header>
      <div className="care-notification-list">
        {notifications.map((notification) => <article key={notification.id} className={`care-notification-item care-notification-item--${notification.kind}`} role={notification.announcedRole}>
          <span className="care-notification-item-icon">{iconFor(notification.kind)}</span>
          <div className="care-notification-item-copy"><strong>{notification.title}</strong><p>{notification.summary}</p></div>
          <div className="care-notification-item-actions"><button type="button" className="care-notification-item-action" aria-label={notification.ariaActionLabel} onClick={notification.action}>{notification.actionLabel}</button>{notification.dismissible && notification.dismiss ? <button type="button" className="icon-plain" aria-label={`Dismiss ${notification.actionLabel.replace('Log ', '')} reminder`} onClick={notification.dismiss}><X size={17} /></button> : null}</div>
        </article>)}
      </div>
    </div> : null}
  </section>
}
