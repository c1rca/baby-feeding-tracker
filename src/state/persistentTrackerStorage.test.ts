import { afterEach, describe, expect, it } from 'vitest'
import {
  TRACKER_STORAGE_KEYS,
  readSortedDiapers,
  readSortedEntries,
  readSortedMedicines,
  readSortedPumpEvents,
  readSortedTummyTimes,
} from './persistentTrackerStorage'

afterEach(() => localStorage.clear())

describe('persistentTrackerStorage corrupt-data resilience', () => {
  const readers = [
    { name: 'entries', key: TRACKER_STORAGE_KEYS.entries, read: readSortedEntries },
    { name: 'diapers', key: TRACKER_STORAGE_KEYS.diapers, read: readSortedDiapers },
    { name: 'medicines', key: TRACKER_STORAGE_KEYS.medicines, read: readSortedMedicines },
    { name: 'tummyTimes', key: TRACKER_STORAGE_KEYS.tummyTimes, read: readSortedTummyTimes },
    { name: 'pumpEvents', key: TRACKER_STORAGE_KEYS.pumpEvents, read: readSortedPumpEvents },
  ]

  // Valid JSON that is not an array previously reached `.sort()` and threw
  // inside initial state hydration, crashing the app for that baby.
  const corruptValues = ['{}', '"a string"', '123', 'true', 'null']

  for (const { name, key, read } of readers) {
    for (const corrupt of corruptValues) {
      it(`returns [] for ${name} when storage holds non-array JSON (${corrupt})`, () => {
        localStorage.setItem(key, corrupt)
        expect(() => read()).not.toThrow()
        expect(read()).toEqual([])
      })
    }

    it(`returns [] for ${name} when storage holds invalid JSON`, () => {
      localStorage.setItem(key, '{not json')
      expect(read()).toEqual([])
    })

    it(`still reads and sorts a valid ${name} array`, () => {
      const rows = [{ id: 'b', at: 1, startedAt: 1, endedAt: 1 }, { id: 'a', at: 2, startedAt: 2, endedAt: 2 }]
      localStorage.setItem(key, JSON.stringify(rows))
      const result = read()
      expect(result).toHaveLength(2)
      // All readers sort most-recent first regardless of the timestamp field.
      expect(result[0].id).toBe('a')
    })
  }
})
