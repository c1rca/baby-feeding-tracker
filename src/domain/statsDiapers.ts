import type { DiaperEvent, DiaperKind, Entry } from '../types'
import { allTimeDayCount, collectDiaperSignals, roundTenth } from './statsUtils'

type TodayDiaperCounts = { wet: number; stool: number }

export const calculateDiaperAverages = (
  entries: Entry[],
  diapers: DiaperEvent[],
  dayStartMs: number,
  today: TodayDiaperCounts,
  wetCount: number,
  stoolCount: number,
) => {
  const allDiaperSignals = collectDiaperSignals(diapers, entries)
  const allTimeDays = allTimeDayCount(allDiaperSignals, dayStartMs)
  const countAllTime = (kind: DiaperKind) => allDiaperSignals.filter((signal) => signal.kind === kind).length

  return {
    wet: { today: today.wet, weekly: roundTenth(wetCount / 7), allTime: roundTenth(countAllTime('wet') / allTimeDays) },
    stool: { today: today.stool, weekly: roundTenth(stoolCount / 7), allTime: roundTenth(countAllTime('stool') / allTimeDays) },
  }
}
