import type { Dispatch, SetStateAction } from 'react'
import { sortEntriesLatestFirst } from '../domain/trackerDomain'
import type { Entry, Session } from '../types'
import { addBottleToSession, createBottleEntry, createDefaultManualDraft, parseManualFeedDraft } from './auxiliaryEventModels'
import type { ManualDraft } from './auxiliaryEventModels'

type BottleManualActionsOptions = {
  now: number
  session: Session | null
  setSession: Dispatch<SetStateAction<Session | null>>
  setEntries: Dispatch<SetStateAction<Entry[]>>
  bottleQuickOz: number
  manualDraft: ManualDraft
  setManualDraft: Dispatch<SetStateAction<ManualDraft>>
  setManualOpen: Dispatch<SetStateAction<boolean>>
  showToast: (message: string) => void
}

export function useBottleManualActions({ now, session, setSession, setEntries, bottleQuickOz, manualDraft, setManualDraft, setManualOpen, showToast }: BottleManualActionsOptions) {
  const logBottle = (oz?: number) => {
    const amount = oz ?? bottleQuickOz
    if (session) {
      setSession(addBottleToSession(session, amount))
      showToast('Bottle added to active feed')
      return
    }
    setEntries((prev) => [createBottleEntry(amount, now || new Date().getTime()), ...prev])
    showToast('Bottle feed saved')
  }

  const saveManualFeed = () => {
    const result = parseManualFeedDraft(manualDraft)
    if (!result.ok) {
      return showToast(result.reason === 'empty' ? 'Add nursing time or bottle ounces' : 'Enter a valid feed date and time')
    }

    setEntries((prev) => sortEntriesLatestFirst([result.entry, ...prev]))
    setManualDraft(createDefaultManualDraft(new Date().getTime()))
    setManualOpen(false)
    showToast('Missed feed saved')
  }

  return { logBottle, saveManualFeed }
}
