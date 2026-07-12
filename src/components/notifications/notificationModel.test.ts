import { describe, expect, it, vi } from 'vitest'
import { buildCareNotifications } from './notificationModel'

describe('buildCareNotifications', () => {
  it('orders due medicine before Vitamin D and advisory tummy time while retaining every action', () => {
    const actions = { log: vi.fn(), dismiss: vi.fn(), tummy: vi.fn() }
    const notifications = buildCareNotifications({
      medicineReminders: [
        { id: 'vitamin', label: 'Vitamin D', recommendedKind: 'vitamin_d', recommendedLabel: 'Vitamin D', at: 30, type: 'vitamin_d', elapsedHours: 19 },
        { id: 'motrin', label: 'Motrin', recommendedKind: 'motrin', recommendedLabel: 'Motrin', at: 20, type: 'medicine', elapsedHours: 7 },
        { id: 'tylenol', label: 'Tylenol', recommendedKind: 'tylenol', recommendedLabel: 'Tylenol', at: 10, type: 'medicine', elapsedHours: 6 },
      ],
      showMedicineReminder: true,
      dismissMedicineReminder: actions.dismiss,
      logMedicine: actions.log,
      tummyTimeReminder: { copy: 'A little floor time helps build strength.' },
      startTummyTime: actions.tummy,
    })

    expect(notifications.map((item) => item.id)).toEqual(['tylenol', 'motrin', 'vitamin', 'tummy-time'])
    expect(notifications.map((item) => item.actionLabel)).toEqual(['Log Tylenol', 'Log Motrin', 'Log Vitamin D', 'Start Tummy Time'])
    expect(notifications[0].dismissible).toBe(true)
    expect(notifications[3].dismissible).toBe(false)
    notifications[0].action()
    notifications[0].dismiss?.()
    notifications[3].action()
    expect(actions.log).toHaveBeenCalledWith('tylenol')
    expect(actions.dismiss).toHaveBeenCalledWith('tylenol')
    expect(actions.tummy).toHaveBeenCalledOnce()
  })
})
