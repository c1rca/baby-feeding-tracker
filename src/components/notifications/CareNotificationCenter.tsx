import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Dumbbell, Pill, Sun, X } from 'lucide-react'
import type { CareNotification } from './notificationModel'

type Props = { notifications: CareNotification[] }

const iconFor = (kind: CareNotification['kind']) => kind === 'tummy_time' ? <Dumbbell size={17} /> : kind === 'vitamin_d' ? <Sun size={17} /> : <Pill size={17} />

export function CareNotificationCenter({ notifications }: Props) {
  const [open, setOpen] = useState(false)
  const [briefVisible, setBriefVisible] = useState(true)
  const [briefHost, setBriefHost] = useState<HTMLElement | null>(null)
  const [isNudging, setIsNudging] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)
  const close = () => { setOpen(false); window.setTimeout(() => openerRef.current?.focus(), 0) }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setBriefHost(document.getElementById('care-brief-slot')))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!notifications.length || open) return
    let settle: number | undefined
    const nudge = () => {
      setIsNudging(true)
      settle = window.setTimeout(() => setIsNudging(false), 1400)
    }
    const initial = window.setTimeout(nudge, 12000)
    const interval = window.setInterval(nudge, 60000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval); if (settle) window.clearTimeout(settle) }
  }, [notifications.length, open])

  useEffect(() => {
    if (!notifications.length || open) return
    const hide = window.setTimeout(() => setBriefVisible(false), 9000)
    const onVisibility = () => { if (document.visibilityState === 'visible') { setBriefVisible(true); window.setTimeout(() => setBriefVisible(false), 9000) } }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.clearTimeout(hide); document.removeEventListener('visibilitychange', onVisibility) }
  }, [notifications.length, open])

  if (notifications.length === 0) return null
  const primary = notifications[0]
  return <section className="care-notification-center" aria-label="Care notifications">
    <button ref={openerRef} type="button" className={`care-notification-opener${isNudging ? ' is-nudging' : ''}`} aria-label={`Open care notifications, ${notifications.length} unresolved`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)}>
      <Bell size={18} /><span className="care-notification-count" aria-hidden="true">{notifications.length}</span>
    </button>
    {briefVisible && !open && briefHost ? createPortal(<aside className="care-brief" role={primary.announcedRole} aria-label="Care reminder preview"><span className="care-brief-icon">{iconFor(primary.kind)}</span><div><strong>{primary.title}</strong><p>{primary.summary}</p></div><button type="button" className="care-brief-action" onClick={primary.action}>{primary.actionLabel}</button><button type="button" className="icon-plain" aria-label="View care notifications" onClick={() => setOpen(true)}>View all <span>{notifications.length}</span></button></aside>, briefHost) : null}
    {open ? createPortal(<><button type="button" className="care-notification-backdrop" aria-label="Close care notifications" onClick={close} /><div className="care-notification-panel" role="dialog" aria-label="Care notifications" aria-modal="true">
      <header className="care-notification-panel-header"><div><span>Care notifications</span><small>{notifications.length} {notifications.length === 1 ? 'needs' : 'need'} attention</small></div><button type="button" className="icon-plain" aria-label="Close care notifications" onClick={close}><X size={18} /></button></header>
      <div className="care-notification-list">
        {notifications.map((notification) => <article key={notification.id} className={`care-notification-item care-notification-item--${notification.kind}`} role={notification.announcedRole}>
          <span className="care-notification-item-icon">{iconFor(notification.kind)}</span>
          <div className="care-notification-item-copy"><strong>{notification.title}</strong><p>{notification.summary}</p></div>
          <div className="care-notification-item-actions"><button type="button" className="care-notification-item-action" aria-label={notification.ariaActionLabel} onClick={notification.action}>{notification.actionLabel}</button>{notification.dismissible && notification.dismiss ? <button type="button" className="icon-plain" aria-label={`Dismiss ${notification.actionLabel.replace('Log ', '')} reminder`} onClick={notification.dismiss}><X size={17} /></button> : null}</div>
        </article>)}
      </div>
    </div></>, document.body) : null}
  </section>
}
