import { describe, expect, it, vi } from 'vitest'
import { buildCareNotifications } from './notificationModel'
import type { NotificationPreferences } from '../../state/notificationPreferences'
import type { MedicineReminder } from '../MedicineReminderBanner'

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

  it('filters medicine reminders by inApp preference', () => {
    const actions = { log: vi.fn(), dismiss: vi.fn(), tummy: vi.fn() }
    const preferences: NotificationPreferences = {
      feeding: { inApp: true, browser: true, gotify: true },
      tylenol: { inApp: false, browser: true, gotify: true },
      motrin: { inApp: true, browser: true, gotify: true },
      vitaminD: { inApp: true, browser: true, gotify: true },
      tummyTime: { inApp: true, browser: true, gotify: true },
      tummyActiveHours: { startHour: 8, endHour: 20 },
      quietHours: { enabled: false, startHour: 22, endHour: 7 },
      medicineIntervals: { tylenol: 6, motrin: 6 },
    }
    const reminders: MedicineReminder[] = [
      { id: 'tylenol', label: 'Tylenol', recommendedKind: 'tylenol', recommendedLabel: 'Tylenol', at: 10, type: 'medicine', elapsedHours: 6 },
      { id: 'motrin', label: 'Motrin', recommendedKind: 'motrin', recommendedLabel: 'Motrin', at: 20, type: 'medicine', elapsedHours: 7 },
    ]
    const notifications = buildCareNotifications({
      medicineReminders: reminders,
      showMedicineReminder: true,
      dismissMedicineReminder: actions.dismiss,
      logMedicine: actions.log,
      tummyTimeReminder: null,
      startTummyTime: actions.tummy,
      preferences,
      now: Date.now(),
    })

    expect(notifications.map((item) => item.id)).toEqual(['motrin'])
    expect(notifications[0].actionLabel).toBe('Log Motrin')
  })

  it('filters tummy time by quiet hours', () => {
    const actions = { log: vi.fn(), dismiss: vi.fn(), tummy: vi.fn() }
    const preferences: NotificationPreferences = {
      feeding: { inApp: true, browser: true, gotify: true },
      tylenol: { inApp: true, browser: true, gotify: true },
      motrin: { inApp: true, browser: true, gotify: true },
      vitaminD: { inApp: true, browser: true, gotify: true },
      tummyTime: { inApp: true, browser: true, gotify: true },
      tummyActiveHours: { startHour: 8, endHour: 20 },
      quietHours: { enabled: true, startHour: 22, endHour: 7 },
      medicineIntervals: { tylenol: 6, motrin: 6 },
    }

    // During quiet hours (23:00)
    const quietDate = new Date()
    quietDate.setHours(23, 0, 0, 0)
    const quietNow = quietDate.getTime()

    // Outside quiet hours (14:00)
    const activeDate = new Date()
    activeDate.setHours(14, 0, 0, 0)
    const activeNow = activeDate.getTime()

    const quietNotifications = buildCareNotifications({
      medicineReminders: [],
      showMedicineReminder: false,
      dismissMedicineReminder: actions.dismiss,
      logMedicine: actions.log,
      tummyTimeReminder: { copy: 'Tummy time!' },
      startTummyTime: actions.tummy,
      preferences,
      now: quietNow,
    })
    expect(quietNotifications.map((item) => item.id)).toEqual([])

    const activeNotifications = buildCareNotifications({
      medicineReminders: [],
      showMedicineReminder: false,
      dismissMedicineReminder: actions.dismiss,
      logMedicine: actions.log,
      tummyTimeReminder: { copy: 'Tummy time!' },
      startTummyTime: actions.tummy,
      preferences,
      now: activeNow,
    })
    expect(activeNotifications.map((item) => item.id)).toEqual(['tummy-time'])
  })

  it('filters tummy time by active hours window', () => {
    const actions = { log: vi.fn(), dismiss: vi.fn(), tummy: vi.fn() }
    const preferences: NotificationPreferences = {
      feeding: { inApp: true, browser: true, gotify: true },
      tylenol: { inApp: true, browser: true, gotify: true },
      motrin: { inApp: true, browser: true, gotify: true },
      vitaminD: { inApp: true, browser: true, gotify: true },
      tummyTime: { inApp: true, browser: true, gotify: true },
      tummyActiveHours: { startHour: 9, endHour: 18 },
      quietHours: { enabled: false, startHour: 22, endHour: 7 },
      medicineIntervals: { tylenol: 6, motrin: 6 },
    }

    // Outside window (08:00)
    const outsideDate = new Date()
    outsideDate.setHours(8, 0, 0, 0)
    const outsideWindow = outsideDate.getTime()

    // Inside window (14:00)
    const insideDate = new Date()
    insideDate.setHours(14, 0, 0, 0)
    const insideWindow = insideDate.getTime()

    const outsideNotifications = buildCareNotifications({
      medicineReminders: [],
      showMedicineReminder: false,
      dismissMedicineReminder: actions.dismiss,
      logMedicine: actions.log,
      tummyTimeReminder: { copy: 'Tummy time!' },
      startTummyTime: actions.tummy,
      preferences,
      now: outsideWindow,
    })
    expect(outsideNotifications.map((item) => item.id)).toEqual([])

    const insideNotifications = buildCareNotifications({
      medicineReminders: [],
      showMedicineReminder: false,
      dismissMedicineReminder: actions.dismiss,
      logMedicine: actions.log,
      tummyTimeReminder: { copy: 'Tummy time!' },
      startTummyTime: actions.tummy,
      preferences,
      now: insideWindow,
    })
    expect(insideNotifications.map((item) => item.id)).toEqual(['tummy-time'])
  })
})
