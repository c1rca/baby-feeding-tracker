import { DiaperTimelineItem } from './timeline/DiaperTimelineItem'
import { EntryTimelineItem } from './timeline/EntryTimelineItem'
import { MedicineTimelineItem } from './timeline/MedicineTimelineItem'
import type { TimelineActions, TimelineItem, TimelineProps } from './timeline/timelineTypes'
import { timelineItems } from './timeline/timelineUtils'

function TimelineList({ items, actions }: { items: TimelineItem[]; actions: TimelineActions }) {
  return (
    <ul className="timeline">
      {items.map((item, index) => {
        if (item.kind === 'medicine') return <MedicineTimelineItem key={item.medicine.id} medicine={item.medicine} actions={actions} />
        if (item.kind === 'diaper') return <DiaperTimelineItem key={item.diaper.id} diaper={item.diaper} actions={actions} />
        return <EntryTimelineItem key={item.entry.id} entry={item.entry} index={index} actions={actions} />
      })}
    </ul>
  )
}

export function Timeline({ entries, diapers, medicines, editing, editingDiaper, editingMedicine, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, startMedicineEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, showToast }: TimelineProps) {
  const items = timelineItems(entries, diapers, medicines)
  const actions: TimelineActions = { editing, editingDiaper, editingMedicine, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, startMedicineEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, showToast }

  return (
    <section className="card timeline-card">
      <div className="section-heading"><h2>Timeline</h2><span className="muted">Latest first</span></div>
      {items.length === 0 ? <p className="muted">No feeds yet. Start with left/right, quick bottle, diaper, or medicine log.</p> : <TimelineList items={items} actions={actions} />}
    </section>
  )
}
