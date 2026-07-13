import type { Dispatch, SetStateAction } from 'react'
import { sortEntriesLatestFirst } from '../domain/trackerDomain'
import type { DiaperEvent, Entry, MedicineEvent, PumpEvent, TummyTimeEvent } from '../types'
import { createDefaultPastEventDraft, parsePastEventDraft, type PastEventDraft } from './pastEventModels'

type Options = { now: number; draft: PastEventDraft; setDraft: Dispatch<SetStateAction<PastEventDraft>>; setOpen: Dispatch<SetStateAction<boolean>>; setEntries: Dispatch<SetStateAction<Entry[]>>; setDiapers: Dispatch<SetStateAction<DiaperEvent[]>>; setMedicines: Dispatch<SetStateAction<MedicineEvent[]>>; setTummyTimes: Dispatch<SetStateAction<TummyTimeEvent[]>>; setPumpEvents: Dispatch<SetStateAction<PumpEvent[]>>; showToast: (message: string) => void }
export function usePastEventActions({ now, draft, setDraft, setOpen, setEntries, setDiapers, setMedicines, setTummyTimes, setPumpEvents, showToast }: Options) {
  const savePastEvent = () => {
    const result = parsePastEventDraft(draft, now)
    if (!result.ok) return showToast(result.reason === 'future-date' ? 'Past events cannot be in the future' : result.reason === 'empty' ? 'Add the required event details' : 'Enter a valid date and time')
    const { kind, event } = result.event
    if (kind === 'feed') setEntries((items) => sortEntriesLatestFirst([event, ...items]))
    if (kind === 'diaper') setDiapers((items) => [event, ...items].sort((a, b) => b.at - a.at))
    if (kind === 'medicine') setMedicines((items) => [event, ...items].sort((a, b) => b.at - a.at))
    if (kind === 'tummy' || kind === 'sleep') setTummyTimes((items) => [event, ...items].sort((a, b) => b.startedAt - a.startedAt))
    if (kind === 'pump') setPumpEvents((items) => [event, ...items].sort((a, b) => b.startedAt - a.startedAt))
    setDraft(createDefaultPastEventDraft(now)); setOpen(false); showToast(`Past ${kind === 'tummy' ? 'Tummy Time' : kind} saved`)
  }
  return { savePastEvent }
}
