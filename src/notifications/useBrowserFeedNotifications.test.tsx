import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBrowserFeedNotifications } from './useBrowserFeedNotifications'
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '../state/notificationPreferences'
import type { MedicineReminder } from '../components/MedicineReminderBanner'
import type { Entry } from '../types'

class MockNotification {
  static instances: MockNotification[] = []
  onclick: (() => void) | null = null
  title: string
  options: NotificationOptions
  constructor(title: string, options: NotificationOptions) {
    this.title = title
    this.options = options
    MockNotification.instances.push(this)
  }
  close() {}
}

const now = new Date('2026-07-18T10:00:00').getTime()

const reminder = (overrides: Partial<MedicineReminder> = {}): MedicineReminder => ({
  id: 'dose-1',
  label: 'Tylenol',
  recommendedKind: 'tylenol',
  recommendedLabel: 'Tylenol',
  at: now - 6 * 60 * 60 * 1000,
  type: 'medicine',
  elapsedHours: 6,
  ...overrides,
})

const prefsWith = (overrides: Partial<NotificationPreferences>): NotificationPreferences => ({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...overrides,
})

type HookOptions = Parameters<typeof useBrowserFeedNotifications>[0]
function mount(opts: Partial<HookOptions>) {
  return renderHook(() =>
    useBrowserFeedNotifications({
      browserRemindersEnabled: true,
      notificationPermission: 'granted',
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      now,
      medicineReminders: [],
      ...opts,
    }),
  )
}

beforeEach(() => {
  MockNotification.instances = []
  vi.stubGlobal('Notification', MockNotification)
  vi.useFakeTimers()
  vi.setSystemTime(now)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useBrowserFeedNotifications medicine channel', () => {
  it('fires a browser notification for a due Tylenol dose when its browser channel is on', () => {
    mount({ preferences: prefsWith({ tylenol: { inApp: true, browser: true, gotify: false } }), medicineReminders: [reminder()] })
    vi.advanceTimersByTime(1)
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe('Tylenol reminder')
    expect(MockNotification.instances[0].options.tag).toBe('medicine-dose-1-tylenol')
  })

  it('does not fire when the medicine browser channel is off (default)', () => {
    mount({ medicineReminders: [reminder()] })
    vi.advanceTimersByTime(1)
    expect(MockNotification.instances).toHaveLength(0)
  })

  it('maps Vitamin D reminders to the vitaminD preference key', () => {
    mount({
      preferences: prefsWith({ vitaminD: { inApp: true, browser: true, gotify: false } }),
      medicineReminders: [reminder({ id: 'vd-1', recommendedKind: 'vitamin_d', recommendedLabel: 'Vitamin D', type: 'vitamin_d', elapsedHours: 18 })],
    })
    vi.advanceTimersByTime(1)
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].options.tag).toBe('medicine-vd-1-vitamin_d')
  })

  it('respects the Motrin channel independently of Tylenol', () => {
    mount({
      preferences: prefsWith({ motrin: { inApp: true, browser: true, gotify: false } }),
      medicineReminders: [reminder({ id: 'm-1', recommendedKind: 'motrin', recommendedLabel: 'Motrin' })],
    })
    vi.advanceTimersByTime(1)
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].options.tag).toBe('medicine-m-1-motrin')
  })

  it('suppresses medicine notifications during quiet hours', () => {
    mount({
      preferences: prefsWith({
        tylenol: { inApp: true, browser: true, gotify: false },
        quietHours: { enabled: true, startHour: 9, endHour: 11, startMinute: 0, endMinute: 0 },
      }),
      medicineReminders: [reminder()],
    })
    vi.advanceTimersByTime(1)
    expect(MockNotification.instances).toHaveLength(0)
  })
})

describe('useBrowserFeedNotifications feeding channel', () => {
  const feed = (): Entry => ({ id: 'feed-1', type: 'breast', startedAt: now, endedAt: now, leftSeconds: 60, rightSeconds: 0, bottleOunces: null, note: '' })

  it('still schedules a feeding reminder at the next-feed interval', () => {
    mount({ lastFeed: feed() }) // default feeding.browser = true, interval 2h
    expect(MockNotification.instances).toHaveLength(0)
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe('Feeding reminder')
  })
})
