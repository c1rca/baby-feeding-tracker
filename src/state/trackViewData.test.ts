import { describe, expect, it } from 'vitest'
import { buildBriefMedicineData, selectStatVisibility, summarizePumpingToday } from './trackViewData'
import type { Entry, MedicineEvent, PumpEvent } from '../types'
import type { MedicineReminderModel } from './medicineReminderModel'

const NOON = new Date('2026-07-18T12:00:00').getTime()
const HOUR = 60 * 60 * 1000

const reminder = (over: Partial<MedicineReminderModel>): MedicineReminderModel => ({
  id: 'r1', label: 'Tylenol', recommendedKind: 'tylenol', recommendedLabel: 'Tylenol', at: NOON - HOUR, type: 'medicine', elapsedHours: 6, ...over,
})

describe('buildBriefMedicineData', () => {
  it('lists medicine-type reminders as due and reshapes them for the brief', () => {
    const { dueMedicines } = buildBriefMedicineData({
      medicineReminders: [reminder({ id: 'r-tyl', recommendedKind: 'tylenol', recommendedLabel: 'Tylenol', at: 111 })],
      medicines: [],
      now: NOON,
    })
    expect(dueMedicines).toEqual([{ id: 'r-tyl', kind: 'tylenol', label: 'Tylenol', at: 111 }])
  })

  it('excludes vitamin_d reminders from the due list', () => {
    const { dueMedicines } = buildBriefMedicineData({
      medicineReminders: [reminder({ recommendedKind: 'vitamin_d', type: 'vitamin_d' })],
      medicines: [],
      now: NOON,
    })
    expect(dueMedicines).toEqual([])
  })

  it('reports the latest dose given today for kinds with no outstanding reminder', () => {
    const medicines: MedicineEvent[] = [
      { id: 'm1', kind: 'tylenol', at: NOON - 5 * HOUR },
      { id: 'm2', kind: 'tylenol', at: NOON - 2 * HOUR }, // latest today
      { id: 'm3', kind: 'motrin', at: NOON - 30 * HOUR }, // yesterday, ignored
    ]
    const { givenMedicines } = buildBriefMedicineData({ medicineReminders: [], medicines, now: NOON })
    expect(givenMedicines).toEqual([{ id: 'm2', kind: 'tylenol', label: 'Tylenol', at: NOON - 2 * HOUR }])
  })

  it('does not mark a kind as given while it still has a due reminder', () => {
    const { givenMedicines } = buildBriefMedicineData({
      medicineReminders: [reminder({ recommendedKind: 'tylenol' })],
      medicines: [{ id: 'm1', kind: 'tylenol', at: NOON - HOUR }],
      now: NOON,
    })
    expect(givenMedicines).toEqual([])
  })
})

describe('selectStatVisibility', () => {
  const entry = (over: Partial<Entry>): Entry => ({ id: 'e', type: 'breast', startedAt: NOON, endedAt: NOON, leftSeconds: 0, rightSeconds: 0, bottleOunces: null, ...over })
  const pump = (over: Partial<PumpEvent>): PumpEvent => ({ id: 'p', startedAt: NOON, endedAt: NOON, leftOunces: null, rightOunces: null, ...over })

  it('shows the bottle stat only for a bottle feed within the last 72h', () => {
    expect(selectStatVisibility({ entries: [entry({ bottleOunces: 3, endedAt: NOON - HOUR })], pumpEvents: [], pumpSession: null, now: NOON }).showBottleStat).toBe(true)
    expect(selectStatVisibility({ entries: [entry({ bottleOunces: 3, endedAt: NOON - 80 * HOUR })], pumpEvents: [], pumpSession: null, now: NOON }).showBottleStat).toBe(false)
    expect(selectStatVisibility({ entries: [entry({ bottleOunces: null })], pumpEvents: [], pumpSession: null, now: NOON }).showBottleStat).toBe(false)
  })

  it('shows the pump stat for an active session or recent pump event', () => {
    expect(selectStatVisibility({ entries: [], pumpEvents: [], pumpSession: { id: 's', startedAt: NOON, side: 'both' }, now: NOON }).showPumpStat).toBe(true)
    expect(selectStatVisibility({ entries: [], pumpEvents: [pump({ endedAt: NOON - HOUR })], pumpSession: null, now: NOON }).showPumpStat).toBe(true)
    expect(selectStatVisibility({ entries: [], pumpEvents: [pump({ endedAt: NOON - 80 * HOUR })], pumpSession: null, now: NOON }).showPumpStat).toBe(false)
  })
})

describe('summarizePumpingToday', () => {
  it('counts and sums both breasts for today only', () => {
    const pumpEvents: PumpEvent[] = [
      { id: 'p1', startedAt: NOON - HOUR, endedAt: NOON, leftOunces: 2, rightOunces: 1.5 },
      { id: 'p2', startedAt: NOON - 30 * HOUR, endedAt: NOON - 29 * HOUR, leftOunces: 5, rightOunces: 5 }, // yesterday
    ]
    expect(summarizePumpingToday({ pumpEvents, now: NOON })).toEqual({ pumpCountToday: 1, pumpedOzToday: 3.5 })
  })
})
