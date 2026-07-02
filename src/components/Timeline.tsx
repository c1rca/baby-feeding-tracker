import { useMemo, useState } from 'react'
import { DiaperTimelineItem } from './timeline/DiaperTimelineItem'
import { EntryTimelineItem } from './timeline/EntryTimelineItem'
import { MedicineTimelineItem } from './timeline/MedicineTimelineItem'
import { TummyTimeTimelineItem } from './timeline/TummyTimeTimelineItem'
import type { TimelineActions, TimelineItem, TimelineProps } from './timeline/timelineTypes'
import { timelineItems } from './timeline/timelineUtils'

const RECENT_TIMELINE_WINDOW_MS = 48 * 60 * 60 * 1000
const TIMELINE_PAGE_SIZE = 25

function TimelineList({ items, actions }: { items: TimelineItem[]; actions: TimelineActions }) {
  return (
    <ul className="timeline">
      {items.map((item, index) => {
        if (item.kind === 'medicine') return <MedicineTimelineItem key={item.medicine.id} medicine={item.medicine} actions={actions} />
        if (item.kind === 'diaper') return <DiaperTimelineItem key={item.diaper.id} diaper={item.diaper} actions={actions} />
        if (item.kind === 'tummy') return <TummyTimeTimelineItem key={item.tummyTime.id} tummyTime={item.tummyTime} actions={actions} />
        return <EntryTimelineItem key={item.entry.id} entry={item.entry} index={index} actions={actions} />
      })}
    </ul>
  )
}

export function Timeline({ now, entries, diapers, medicines, tummyTimes, editing, editingDiaper, editingMedicine, editingTummyTime, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setEditingTummyTime, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, deleteTummyTime, startMedicineEdit, startTummyTimeEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, saveTummyTimeEdit, showToast }: TimelineProps) {
  const [olderPage, setOlderPage] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const items = timelineItems(entries, diapers, medicines, tummyTimes)
  const cutoff = now - RECENT_TIMELINE_WINDOW_MS
  const recentItems = items.filter((item) => item.time >= cutoff)
  const olderItems = items.filter((item) => item.time < cutoff)
  const visibleOlderItems = showAll ? olderItems : olderItems.slice(olderPage * TIMELINE_PAGE_SIZE, (olderPage + 1) * TIMELINE_PAGE_SIZE)
  const visibleItems = useMemo(() => [...recentItems, ...visibleOlderItems], [recentItems, visibleOlderItems])
  const totalOlderPages = Math.max(1, Math.ceil(olderItems.length / TIMELINE_PAGE_SIZE))
  const actions: TimelineActions = { editing, editingDiaper, editingMedicine, editingTummyTime, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setEditingTummyTime, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, deleteTummyTime, startMedicineEdit, startTummyTimeEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, saveTummyTimeEdit, showToast }

  return (
    <section className="card timeline-card">
      <div className="section-heading"><h2>Timeline</h2><span className="muted">Latest first · past 48 hours</span></div>
      {items.length === 0 ? <p className="muted">No feeds yet. Start with left/right, quick bottle, diaper, or medicine log.</p> : <>
        <TimelineList items={visibleItems} actions={actions} />
        {olderItems.length > 0 ? (
          <div className="timeline-pagination" aria-label="Timeline pagination">
            <span>{showAll ? `Showing all ${items.length} events` : `Showing ${recentItems.length} recent + older page ${olderPage + 1} of ${totalOlderPages}`}</span>
            {!showAll ? <button type="button" disabled={olderPage === 0} onClick={() => setOlderPage((page) => Math.max(0, page - 1))}>Newer</button> : null}
            {!showAll ? <button type="button" disabled={olderPage >= totalOlderPages - 1} onClick={() => setOlderPage((page) => Math.min(totalOlderPages - 1, page + 1))}>Older</button> : null}
            <button type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show pages' : 'Show all'}</button>
          </div>
        ) : null}
      </>}
    </section>
  )
}
