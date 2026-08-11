import { CalendarDays, ChevronDown, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DiaperTimelineItem } from './timeline/DiaperTimelineItem'
import { EntryTimelineItem } from './timeline/EntryTimelineItem'
import { MedicineTimelineItem } from './timeline/MedicineTimelineItem'
import { TummyTimeTimelineItem } from './timeline/TummyTimeTimelineItem'
import { CustomEventTimelineItem } from './timeline/CustomEventTimelineItem'
import { PumpTimelineItem } from './timeline/PumpTimelineItem'
import type { TimelineActions, TimelineItem, TimelineProps } from './timeline/timelineTypes'
import { entryDiaperKinds } from '../domain/labels'
import { timelineItems, timelineItemSearchText } from './timeline/timelineUtils'
import { formatDateInput, localDayWindow } from '../domain/time'
import type { CustomTracker } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000
type Filter = 'all' | 'feed' | 'diaper' | 'sleep' | 'medicine' | 'pump'
const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All events' },
  { id: 'feed', label: 'Feeds' },
  { id: 'diaper', label: 'Diapers' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'medicine', label: 'Medicines' },
  ...(import.meta.env.DEV ? [{ id: 'pump' as const, label: 'Pumping' }] : []),
]

function matches(item: TimelineItem, filter: Filter) {
  return filter === 'all' || item.kind === filter || (filter === 'diaper' && item.kind === 'feed' && entryDiaperKinds(item.entry).length > 0) || (filter === 'sleep' && item.kind === 'tummy' && item.tummyTime.kind === 'sleep')
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
  if (item.kind === 'tummy') return item.tummyTime.id
  if (item.kind === 'custom') return item.customEvent.id
  return item.pumpEvent.id
}
function TimelineList({ items, actions, resumeFeedIds, resumeTummyIds, trackersById }: { items: TimelineItem[]; actions: TimelineActions; resumeFeedIds: Set<string>; resumeTummyIds: Set<string>; trackersById: Map<string, CustomTracker> }) {
  return <ul className="timeline">{items.map((item) => {
    if (item.kind === 'medicine') return <MedicineTimelineItem key={item.medicine.id} medicine={item.medicine} actions={actions} />
    if (item.kind === 'diaper') return <DiaperTimelineItem key={item.diaper.id} diaper={item.diaper} actions={actions} />
    if (item.kind === 'tummy') return <TummyTimeTimelineItem key={item.tummyTime.id} tummyTime={item.tummyTime} showInlineResume={resumeTummyIds.has(item.tummyTime.id)} actions={actions} />
    if (item.kind === 'pump') return <PumpTimelineItem key={item.pumpEvent.id} pumpEvent={item.pumpEvent} actions={actions} />
    if (item.kind === 'custom') return <CustomEventTimelineItem key={item.customEvent.id} customEvent={item.customEvent} tracker={trackersById.get(item.customEvent.trackerId)} actions={actions} />
    if (item.kind === 'feed') return <EntryTimelineItem key={item.entry.id} entry={item.entry} showInlineResume={resumeFeedIds.has(item.entry.id)} actions={actions} />
    return null
  })}</ul>
}

export function Timeline({ now, entries, diapers, medicines, tummyTimes, pumpEvents, customTrackers, customEvents, editing, editingDiaper, editingMedicine, editingTummyTime, editingPump, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setEditingTummyTime, setEditingPump, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, resumeTummyTime, resumePumpEvent, deleteEntry, deleteDiaper, deleteMedicine, deleteTummyTime, deletePump, deleteCustomEvent, startMedicineEdit, startTummyTimeEdit, startPumpEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, saveTummyTimeEdit, savePumpEdit, onLogPastEvent, showToast }: TimelineProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [visibleDays, setVisibleDays] = useState(1)
  // A specific day, chosen from the date picker. While set it replaces the
  // rolling "last N days" window entirely, so history older than the load-more
  // chain is reachable in one jump.
  const [selectedDate, setSelectedDate] = useState('')
  const [search, setSearch] = useState('')
  const [findOpen, setFindOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  // Opening puts the cursor where you were about to type anyway.
  useEffect(() => { if (findOpen) searchRef.current?.focus() }, [findOpen])
  const items = timelineItems(entries, diapers, medicines, tummyTimes, pumpEvents, customEvents)
  const trackersById = useMemo(() => new Map(customTrackers.map((tracker) => [tracker.id, tracker])), [customTrackers])
  const trackerNames = useMemo(() => new Map(customTrackers.map((tracker) => [tracker.id, tracker.name])), [customTrackers])
  const query = search.trim().toLowerCase()
  const filtered = useMemo(
    () => items.filter((item) => matches(item, filter) && (!query || timelineItemSearchText(item, trackerNames).includes(query))),
    [items, filter, query, trackerNames],
  )
  const selectedDay = useMemo(() => {
    if (!selectedDate) return null
    const parsed = new Date(`${selectedDate}T12:00:00`).getTime()
    return Number.isFinite(parsed) ? localDayWindow(parsed) : null
  }, [selectedDate])
  // A search is an explicit request to look everywhere, so it ignores the
  // rolling window that otherwise keeps the timeline short.
  // Something is being filtered, so the state must stay visible even collapsed.
  const hasFind = Boolean(query) || Boolean(selectedDay)
  const visible = query
    ? filtered
    : selectedDay
      ? filtered.filter((item) => item.time >= selectedDay.startMs && item.time < selectedDay.endMs)
      : filtered.filter((item) => item.time >= now - visibleDays * DAY_MS)
  const oldestItemTime = filtered.length ? Math.min(...filtered.map((item) => item.time)) : now
  const todayKey = new Date(now).toDateString()
  const resumableItems = visible.filter((item) => (item.kind === 'feed' && new Date(item.time).toDateString() === todayKey && (item.entry.leftSeconds > 0 || item.entry.rightSeconds > 0)) || item.kind === 'tummy').slice(0, 2)
  const resumeFeedIds = new Set(resumableItems.flatMap((item) => item.kind === 'feed' ? [item.entry.id] : []))
  const resumeTummyIds = new Set(resumableItems.flatMap((item) => item.kind === 'tummy' ? [item.tummyTime.id] : []))
  const actions: TimelineActions = { editing, editingDiaper, editingMedicine, editingTummyTime, editingPump, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setEditingTummyTime, setEditingPump, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, resumeTummyTime, resumePumpEvent, deleteEntry, deleteDiaper, deleteMedicine, deleteTummyTime, deletePump, deleteCustomEvent, startMedicineEdit, startTummyTimeEdit, startPumpEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, saveTummyTimeEdit, savePumpEdit, showToast }
  const groups = visible.reduce<Array<{ label: string; items: TimelineItem[] }>>((all, item) => { const label = dayLabel(item.time, now); const group = all.at(-1); if (!group || group.label !== label) all.push({ label, items: [item] }); else group.items.push(item); return all }, [])
  return <section className="card timeline-card">
    <div className="section-heading"><div><h2>Timeline</h2></div>{onLogPastEvent ? <button type="button" className="care-history-link timeline-past-feed" onClick={onLogPastEvent}><Plus size={14} /> Log a past event</button> : null}</div>
    {items.length === 0 ? <p className="muted">No feeds yet. Start with left/right, quick bottle, diaper, or medicine log.</p> : <>
      {/* Search and jump-to-date were two permanent full-width fields for
          something used rarely. They live behind the magnifier now — but an
          active filter is never hidden: collapsing it leaves a chip saying what
          is being filtered, one tap from clearing. */}
      <div className="timeline-toolbar">
        <div className="timeline-filters" role="group" aria-label="Timeline filters">{filters.map(({ id, label }) => <button key={id} type="button" data-filter={id} aria-pressed={filter === id} onClick={() => { setFilter(id); setVisibleDays(1) }}><span className="timeline-filter-label">{label}</span></button>)}</div>
        <button
          type="button"
          className={`timeline-find-toggle${findOpen ? ' is-open' : ''}${hasFind ? ' is-active' : ''}`}
          aria-expanded={findOpen}
          aria-label="Search and jump to a date"
          title="Search and jump to a date"
          onClick={() => setFindOpen((open) => !open)}
        >
          <Search size={16} />
        </button>
      </div>

      {findOpen ? (
        <div className="timeline-find">
          <label className="timeline-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-label="Search timeline"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape' && search) { event.stopPropagation(); setSearch('') } }}
            />
          </label>
          <label className="timeline-date-picker">
            <CalendarDays size={15} aria-hidden="true" />
            <input
              type="date"
              aria-label="Jump to date"
              value={selectedDate}
              min={formatDateInput(oldestItemTime)}
              max={formatDateInput(now)}
              onChange={(event) => { setSelectedDate(event.target.value); setVisibleDays(1) }}
            />
          </label>
          {selectedDay ? <button type="button" className="timeline-date-clear" aria-label="Clear date filter" onClick={() => { setSelectedDate(''); setVisibleDays(1) }}><X size={14} /> Back to recent</button> : null}
        </div>
      ) : hasFind ? (
        <div className="timeline-find-chips" aria-label="Active timeline filters">
          {query ? <button type="button" className="timeline-find-chip" aria-label={`Clear search for ${search.trim()}`} onClick={() => setSearch('')}><Search size={13} /> “{search.trim()}” <X size={13} /></button> : null}
          {selectedDay ? <button type="button" className="timeline-find-chip" aria-label="Clear date filter" onClick={() => { setSelectedDate(''); setVisibleDays(1) }}><CalendarDays size={13} /> {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} <X size={13} /></button> : null}
        </div>
      ) : null}
      {groups.length ? groups.map((group) => <div className={`timeline-day${group.items.some((item) => itemId(item) === openEntryMenuId) ? ' menu-open' : ''}`} key={group.label}><div className="timeline-day-header"><strong>{group.label}</strong><span>{group.items.length} event{group.items.length === 1 ? '' : 's'}</span></div><TimelineList items={group.items} actions={actions} resumeFeedIds={resumeFeedIds} resumeTummyIds={resumeTummyIds} trackersById={trackersById} /></div>) : <p className="timeline-empty">{query ? `No events match “${search.trim()}”.` : selectedDay ? 'No events logged on this day.' : `No ${filter === 'all' ? '' : `${filter} `}events logged yet.`}</p>}
      {!selectedDay && !query && visible.length < filtered.length ? <div className="timeline-load"><button type="button" onClick={() => setVisibleDays((days) => days + 1)}><ChevronDown size={15} aria-hidden="true" />Load older events</button></div> : null}
    </>}
  </section>
}
