import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Dumbbell, Pill, Sun, X } from 'lucide-react'
import type { CareNotification } from './notificationModel'

type Props = { notifications: CareNotification[]; showBrief?: boolean }

const iconFor = (kind: CareNotification['kind']) => kind === 'tummy_time' ? <Dumbbell size={17} /> : kind === 'vitamin_d' ? <Sun size={17} /> : <Pill size={17} />

export function CareNotificationCenter({ notifications, showBrief = true }: Props) {
  const [open, setOpen] = useState(false)
  const [briefIndex, setBriefIndex] = useState(() => Math.floor(Math.random() * Math.max(notifications.length, 1)))
  const [isSliding, setIsSliding] = useState(false)
  const [briefHost, setBriefHost] = useState<HTMLElement | null>(null)
  const [isNudging, setIsNudging] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)
  const touchStartX = useRef<number | null>(null)
  const close = () => { setOpen(false); window.setTimeout(() => openerRef.current?.focus(), 0) }
  const cycleBrief = useCallback((direction: -1 | 1 = 1) => { if (notifications.length < 2) return; setIsSliding(true); window.setTimeout(() => { setBriefIndex((current) => (current + direction + notifications.length) % notifications.length); setIsSliding(false) }, 130) }, [notifications.length])

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
    if (notifications.length < 2 || open) return
    const rotate = () => cycleBrief(1)
    const interval = window.setInterval(rotate, 5 * 60 * 1000)
    const onVisibility = () => { if (document.visibilityState === 'visible') rotate() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility) }
  }, [cycleBrief, notifications.length, open])

  const brief = notifications[briefIndex % Math.max(notifications.length, 1)]
  return <section className="care-notification-center" aria-label="Care notifications">
    <button ref={openerRef} type="button" className={`care-notification-opener${isNudging ? ' is-nudging' : ''}`} aria-label={`Open care notifications, ${notifications.length} unresolved`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)}>
      <Bell size={18} />{notifications.length ? <span className="care-notification-count" aria-hidden="true">{notifications.length}</span> : null}
    </button>
    {showBrief && !open && briefHost && brief ? createPortal(<aside className={`care-brief care-brief--${brief.kind}${isSliding ? ' is-sliding' : ''}`} role={brief.announcedRole} aria-label="Care reminder carousel" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }} onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (touchStartX.current !== null && end !== undefined && Math.abs(end - touchStartX.current) > 36) cycleBrief(end < touchStartX.current ? 1 : -1); touchStartX.current = null }}><span className="care-brief-icon">{iconFor(brief.kind)}</span><div><strong>{brief.title}</strong><p>{brief.summary}</p></div><button type="button" className="care-brief-action" onClick={brief.action}>{brief.actionLabel}</button>{notifications.length > 1 ? <span className="care-brief-progress" aria-label={`Reminder ${briefIndex + 1} of ${notifications.length}`}>{notifications.map((notification, index) => <i key={notification.id} className={index === briefIndex ? 'is-active' : ''} />)}</span> : null}</aside>, briefHost) : null}
    {open ? createPortal(<><button type="button" className="care-notification-backdrop" aria-label="Close care notifications" onClick={close} /><div className="care-notification-panel" role="dialog" aria-label="Care notifications" aria-modal="true">
      <header className="care-notification-panel-header"><div><span>Care notifications</span><small>{notifications.length ? `${notifications.length} ${notifications.length === 1 ? 'needs' : 'need'} attention` : 'All caught up'}</small></div><button type="button" className="icon-plain" aria-label="Close care notifications" onClick={close}><X size={18} /></button></header>
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
