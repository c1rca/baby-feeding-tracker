import { MoreHorizontal, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { formatTimelineTimestamp } from '../../domain/trackerDomain'
import { formatDuration } from '../../domain/feedingUtils'
import { customTrackerHueToken } from '../../domain/customTrackers'
import { CustomTrackerIcon } from '../customTrackerIcons'
import type { CustomEvent, CustomTracker } from '../../types'
import { DeleteConfirmation } from './DeleteConfirmation'
import type { TimelineActions } from './timelineTypes'
import { formatTimelineAge, openMenu } from './timelineUtils'

/**
 * A log against a caregiver-defined tracker, in the same timeline as everything
 * else. It borrows the medicine badge's shape and takes its colour from the
 * tracker, so it reads as one of the family rather than a bolt-on.
 *
 * A definition that has since been archived still has events in history; those
 * keep the tracker's name, because a row reading "Unknown" would be worse than
 * useless to a caregiver looking back.
 */
export function CustomEventTimelineItem({ customEvent, tracker, actions }: { customEvent: CustomEvent; tracker: CustomTracker | undefined; actions: TimelineActions }) {
  const menuOpen = actions.openEntryMenuId === customEvent.id
  const confirmingDelete = actions.confirmingDeleteEntryId === customEvent.id
  const timestamp = formatTimelineTimestamp(customEvent.at)
  const name = tracker?.name ?? 'Tracked'

  return (
    <li className={`timeline-item timeline-custom ${menuOpen ? 'menu-open' : ''}`} style={{ '--need-hue': customTrackerHueToken(tracker?.hue ?? '') } as CSSProperties}>
      <div className="timeline-row">
        <div className="timeline-main">
          <div className="timeline-head">
            <strong>{timestamp.primary}</strong>
            <span className="badge badge-medicine badge-custom"><CustomTrackerIcon icon={tracker?.icon ?? ''} size={13} /> {name}</span>
            {customEvent.durationSeconds ? <span className="metric-chip">{formatDuration(customEvent.durationSeconds)}</span> : null}
          </div>
          <span className="timeline-age">{formatTimelineAge(customEvent.at)}</span>
          {customEvent.note ? <p className="entry-note">{customEvent.note}</p> : null}
        </div>
        <div className="entry-action-wrap">
          <button type="button" className="entry-action-trigger" aria-label={`${name} actions`} aria-expanded={menuOpen} onClick={() => openMenu(customEvent.id, menuOpen, actions)}><MoreHorizontal size={17} /></button>
          {menuOpen ? (
            <div className="entry-menu" role="menu">
              <button type="button" role="menuitem" aria-label={`Delete ${name} log`} className="danger-menu" onClick={() => actions.setConfirmingDeleteEntryId(customEvent.id)}><Trash2 size={15} /> Delete</button>
              {confirmingDelete ? <DeleteConfirmation label={`Confirm delete ${name} log`} onConfirm={() => actions.deleteCustomEvent(customEvent)} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}
