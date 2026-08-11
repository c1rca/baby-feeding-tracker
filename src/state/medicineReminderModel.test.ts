import { describe, expect, it } from 'vitest'
import { getMedicineReminders } from './medicineReminderModel'

describe('getMedicineReminders', () => {
  it('surfaces Vitamin D when it has not been logged today, even with no prior dose', () => {
    const now = new Date(2026, 0, 3, 12).getTime()

    expect(getMedicineReminders([], now)).toContainEqual({
      id: `vitamin-d-${new Date(2026, 0, 3).getTime()}`,
      label: 'Not logged today',
      recommendedKind: 'vitamin_d',
      recommendedLabel: 'Vitamin D',
      at: new Date(2026, 0, 3).getTime(),
      type: 'vitamin_d',
      elapsedHours: 0,
    })
  })
})
