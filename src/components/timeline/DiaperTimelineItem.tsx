import { MoreHorizontal, Pencil, Save, Trash2 } from 'lucide-react'
import { diaperEventLabel, diaperKinds, diaperLabel, formatTimelineTimestamp } from '../../domain/trackerDomain'
import type { DiaperEvent } from '../../types'
import { DeleteConfirmation } from './DeleteConfirmation'
import type { TimelineActions } from './timelineTypes'
import { DIAPER_KINDS, formatTimelineAge, openMenu } from './timelineUtils'

export function DiaperTimelineItem({ diaper, actions }: { diaper: DiaperEvent; actions: TimelineActions }) {
  const kinds = diaperKinds(diaper)
  const isEditing = actions.editingDiaper?.id === diaper.id
  const menuOpen = actions.openEntryMenuId === diaper.id
  const confirmingDelete = actions.confirmingDeleteEntryId === diaper.id
  const timestamp = formatTimelineTimestamp(diaper.at)

  return (
    <li className={`timeline-item timeline-diaper timeline-diaper-${kinds.includes('stool') ? 'stool' : 'wet'} ${menuOpen ? 'menu-open' : ''}`}>
      <div className="timeline-row">
        <div className="timeline-main">
          <div className="timeline-head"><strong>{timestamp.primary}</strong><span className={`badge badge-diaper ${kinds.includes('stool') ? 'badge-diaper-stool' : ''}`}>{diaperEventLabel(diaper)}</span></div>
          <span className="timeline-age">{formatTimelineAge(diaper.at)}</span>
        </div>
        {!isEditing ? (
          <div className="entry-action-wrap">
            <button type="button" className="entry-action-trigger" aria-label="Diaper actions" aria-expanded={menuOpen} onClick={() => openMenu(diaper.id, menuOpen, actions)}><MoreHorizontal size={17} /></button>
            {menuOpen ? (
              <div className="entry-menu" role="menu">
                <button type="button" role="menuitem" aria-label="Edit diaper" onClick={() => { actions.setEditingDiaper({ id: diaper.id, kinds }); actions.setOpenEntryMenuId(null) }}><Pencil size={15} /> Edit</button>
                <button type="button" role="menuitem" aria-label="Delete diaper" className="danger-menu" onClick={() => actions.setConfirmingDeleteEntryId(diaper.id)}><Trash2 size={15} /> Delete</button>
                {confirmingDelete ? <DeleteConfirmation label="Confirm delete diaper" onConfirm={() => actions.deleteDiaper(diaper)} /> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <div className="edit-panel diaper-edit-panel" role="group" aria-label="Edit diaper">
          {DIAPER_KINDS.map((kind) => {
            const selected = Boolean(actions.editingDiaper?.kinds.includes(kind))
            return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={`Select ${kind} diaper`} aria-pressed={selected} onClick={() => actions.toggleEditingDiaperKind(kind)}>{diaperLabel(kind)}</button>
          })}
          <div className="row"><button type="button" className="primary" aria-label="Save diaper" onClick={() => actions.saveDiaperEdit(diaper)}><Save size={15} /> Save</button><button type="button" onClick={() => actions.setEditingDiaper(null)}>Cancel</button></div>
        </div>
      ) : null}
    </li>
  )
}
