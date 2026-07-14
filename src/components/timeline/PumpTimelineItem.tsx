import { MoreHorizontal, Pencil, Save, Trash2 } from 'lucide-react'
import type { PumpEvent } from '../../types'
import type { TimelineActions } from './timelineTypes'
import { DeleteConfirmation } from './DeleteConfirmation'
import { formatTimelineTimestamp } from '../../domain/trackerDomain'
import { formatTimelineAge, openMenu } from './timelineUtils'

const total = (event: PumpEvent) => (event.leftOunces ?? 0) + (event.rightOunces ?? 0)

export function PumpTimelineItem({ pumpEvent, actions }: { pumpEvent: PumpEvent; actions: TimelineActions }) {
  const isEditing = actions.editingPump?.id === pumpEvent.id
  const menuOpen = actions.openEntryMenuId === pumpEvent.id
  const confirmingDelete = actions.confirmingDeleteEntryId === pumpEvent.id
  const outputTotal = total(pumpEvent)
  return <li className={`timeline-item timeline-pump ${menuOpen ? 'menu-open' : ''}`}>
    <div className="timeline-row">
      <div className="timeline-main">
        <div className="timeline-head"><strong>{formatTimelineTimestamp(pumpEvent.startedAt).primary}</strong><span className="badge badge-pump">Pumping</span></div>
        <span className="timeline-age">{formatTimelineAge(pumpEvent.startedAt)}</span>
        <div className="timeline-metrics">
          {pumpEvent.leftOunces !== null ? <span className="metric-chip">Left {pumpEvent.leftOunces} oz</span> : null}
          {pumpEvent.rightOunces !== null ? <span className="metric-chip">Right {pumpEvent.rightOunces} oz</span> : null}
          <span className="metric-chip primary-metric">Total {outputTotal} oz</span>
        </div>
        {pumpEvent.note ? <p className="entry-note">{pumpEvent.note}</p> : null}
      </div>
      <div className="entry-action-wrap">
        <button type="button" className="entry-action-trigger" aria-label="Pumping actions" aria-expanded={menuOpen} onClick={() => openMenu(pumpEvent.id, menuOpen, actions)}><MoreHorizontal size={17} /></button>
        {menuOpen ? <div className="entry-menu" role="menu">
          <button type="button" role="menuitem" aria-label="Edit pumping" onClick={() => actions.startPumpEdit(pumpEvent)}><Pencil size={15} /> Edit</button>
          <button type="button" role="menuitem" className="danger-menu" aria-label="Delete pumping" onClick={() => actions.setConfirmingDeleteEntryId(pumpEvent.id)}><Trash2 size={15} /> Delete</button>
          {confirmingDelete ? <DeleteConfirmation label="Confirm delete pumping" onConfirm={() => actions.deletePump(pumpEvent)} /> : null}
        </div> : null}
      </div>
    </div>
    {isEditing && actions.editingPump ? <div className="edit-panel pump-edit-panel">
      <label>Left output<input type="number" min="0" step="0.1" aria-label="Left output ounces" value={actions.editingPump.leftOunces} onChange={(event) => actions.setEditingPump({ ...actions.editingPump!, leftOunces: event.target.value })} /></label>
      <label>Right output<input type="number" min="0" step="0.1" aria-label="Right output ounces" value={actions.editingPump.rightOunces} onChange={(event) => actions.setEditingPump({ ...actions.editingPump!, rightOunces: event.target.value })} /></label>
      <label>Note<input aria-label="Pumping note" value={actions.editingPump.note} onChange={(event) => actions.setEditingPump({ ...actions.editingPump!, note: event.target.value })} /></label>
      <button type="button" className="primary" aria-label="Save pumping" onClick={() => actions.savePumpEdit(pumpEvent)}><Save size={15} /> Save</button>
    </div> : null}
  </li>
}
