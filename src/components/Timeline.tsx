import { useMemo, useState } from 'react'
import { DiaperTimelineItem } from './timeline/DiaperTimelineItem'
import { EntryTimelineItem } from './timeline/EntryTimelineItem'
import { MedicineTimelineItem } from './timeline/MedicineTimelineItem'
import { TummyTimeTimelineItem } from './timeline/TummyTimeTimelineItem'
import type { TimelineActions, TimelineItem, TimelineProps } from './timeline/timelineTypes'
import { timelineItems } from './timeline/timelineUtils'

const DAY_MS = 24 * 60 * 60 * 1000
type Filter = 'all' | 'feed' | 'diaper' | 'sleep' | 'medicine'
const filters: Array<{ id: Filter; label: string }> = [{ id: 'all', label: 'All events' }, { id: 'feed', label: 'Feeds' }, { id: 'diaper', label: 'Diapers' }, { id: 'sleep', label: 'Sleep' }, { id: 'medicine', label: 'Medicines' }]

function matches(item: TimelineItem, filter: Filter) {
  return filter === 'all' || item.kind === filter || (filter === 'sleep' && item.kind === 'tummy' && item.tummyTime.kind === 'sleep')
}
function dayLabel(time: number, now: number) {
  const date = new Date(time); const today = new Date(now); const yesterday = new Date(now - 86400000)
  const key = date.toDateString()
  return key === today.toDateString() ? 'Today' : key === yesterday.toDateString() ? 'Yesterday' : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
function itemId(item: TimelineItem) {
  if (item.kind === 'feed') return item.entry.id
  if (item.kind === 'diaper') return item.diaper.id
  if (item.kind === 'medicine') return item.medicine.id
  return item.tummyTime.id
}
function TimelineList({ items, actions }: { items: TimelineItem[]; actions: TimelineActions }) {
  return <ul className="timeline">{items.map((item, index) => {
    if (item.kind === 'medicine') return <MedicineTimelineItem key={item.medicine.id} medicine={item.medicine} actions={actions} />
    if (item.kind === 'diaper') return <DiaperTimelineItem key={item.diaper.id} diaper={item.diaper} actions={actions} />
    if (item.kind === 'tummy') return <TummyTimeTimelineItem key={item.tummyTime.id} tummyTime={item.tummyTime} actions={actions} />
    return <EntryTimelineItem key={item.entry.id} entry={item.entry} index={index} actions={actions} />
  })}</ul>
}

export function Timeline({ now, entries, diapers, medicines, tummyTimes, editing, editingDiaper, editingMedicine, editingTummyTime, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setEditingTummyTime, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, deleteTummyTime, startMedicineEdit, startTummyTimeEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, saveTummyTimeEdit, showToast }: TimelineProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [visibleDays, setVisibleDays] = useState(1)
  const items = timelineItems(entries, diapers, medicines, tummyTimes)
  const filtered = useMemo(() => items.filter((item) => matches(item, filter)), [items, filter])
  const visible = filtered.filter((item) => item.time >= now - visibleDays * DAY_MS)
  const actions: TimelineActions = { editing, editingDiaper, editingMedicine, editingTummyTime, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setEditingTummyTime, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, deleteTummyTime, startMedicineEdit, startTummyTimeEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, saveTummyTimeEdit, showToast }
  const groups = visible.reduce<Array<{ label: string; items: TimelineItem[] }>>((all, item) => { const label = dayLabel(item.time, now); const group = all.at(-1); if (!group || group.label !== label) all.push({ label, items: [item] }); else group.items.push(item); return all }, [])
  return <section className="card timeline-card">
    <div className="section-heading"><div><h2>Timeline</h2><span className="muted">A clearer view of your day</span></div><span className="timeline-total">{items.length} events</span></div>
    {items.length === 0 ? <p className="muted">No feeds yet. Start with left/right, quick bottle, diaper, or medicine log.</p> : <>
      <div className="timeline-filters" role="group" aria-label="Timeline filters">{filters.map(({ id, label }) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); setVisibleDays(1) }}>{label} <span>{items.filter((item) => matches(item, id)).length}</span></button>)}</div>
      {groups.length ? groups.map((group) => <div className={`timeline-day${group.items.some((item) => itemId(item) === openEntryMenuId) ? ' menu-open' : ''}`} key={group.label}><div className="timeline-day-header"><strong>{group.label}</strong><span>{group.items.length} event{group.items.length === 1 ? '' : 's'}</span></div><TimelineList items={group.items} actions={actions} /></div>) : <p className="timeline-empty">No {filter === 'all' ? '' : `${filter} `}events logged yet.</p>}
      {visible.length < filtered.length ? <div className="timeline-load"><button type="button" onClick={() => setVisibleDays((days) => days + 1)}>Load older events</button></div> : null}
    </>}
  </section>
}
