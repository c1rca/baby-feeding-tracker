import { describe, expect, it } from 'vitest'
import { isWithinWindow, isQuietHour } from './notificationWindows'

describe('isWithinWindow', () => {
  it('checks hour within non-wrapping window (8:00–20:00)', () => {
    const window = { startHour: 8, endHour: 20 }

    // Create dates with specific hours in local time
    const d1 = new Date()
    d1.setHours(7, 59, 0, 0)
    expect(isWithinWindow(d1.getTime(), window)).toBe(false)

    const d2 = new Date()
    d2.setHours(8, 0, 0, 0)
    expect(isWithinWindow(d2.getTime(), window)).toBe(true)

    const d3 = new Date()
    d3.setHours(14, 0, 0, 0)
    expect(isWithinWindow(d3.getTime(), window)).toBe(true)

    const d4 = new Date()
    d4.setHours(19, 59, 0, 0)
    expect(isWithinWindow(d4.getTime(), window)).toBe(true)

    const d5 = new Date()
    d5.setHours(20, 0, 0, 0)
    expect(isWithinWindow(d5.getTime(), window)).toBe(false)

    const d6 = new Date()
    d6.setHours(23, 0, 0, 0)
    expect(isWithinWindow(d6.getTime(), window)).toBe(false)
  })

  it('checks hour within midnight-wrapping window (22:00–7:00)', () => {
    const window = { startHour: 22, endHour: 7 }

    const d1 = new Date()
    d1.setHours(21, 59, 0, 0)
    expect(isWithinWindow(d1.getTime(), window)).toBe(false)

    const d2 = new Date()
    d2.setHours(22, 0, 0, 0)
    expect(isWithinWindow(d2.getTime(), window)).toBe(true)

    const d3 = new Date()
    d3.setHours(23, 0, 0, 0)
    expect(isWithinWindow(d3.getTime(), window)).toBe(true)

    const d4 = new Date()
    d4.setHours(0, 0, 0, 0)
    expect(isWithinWindow(d4.getTime(), window)).toBe(true)

    const d5 = new Date()
    d5.setHours(6, 59, 0, 0)
    expect(isWithinWindow(d5.getTime(), window)).toBe(true)

    const d6 = new Date()
    d6.setHours(7, 0, 0, 0)
    expect(isWithinWindow(d6.getTime(), window)).toBe(false)
  })

  it('handles edge case window (same hour)', () => {
    const window = { startHour: 12, endHour: 12 }

    const d1 = new Date()
    d1.setHours(12, 0, 0, 0)
    expect(isWithinWindow(d1.getTime(), window)).toBe(false)

    const d2 = new Date()
    d2.setHours(11, 59, 0, 0)
    expect(isWithinWindow(d2.getTime(), window)).toBe(false)
  })
})

describe('isQuietHour', () => {
  it('returns false when quiet hours disabled', () => {
    const quietHours = { enabled: false, startHour: 22, endHour: 7 }

    const d1 = new Date()
    d1.setHours(23, 0, 0, 0)
    expect(isQuietHour(d1.getTime(), quietHours)).toBe(false)

    const d2 = new Date()
    d2.setHours(5, 0, 0, 0)
    expect(isQuietHour(d2.getTime(), quietHours)).toBe(false)
  })

  it('respects quiet hours when enabled and within window', () => {
    const quietHours = { enabled: true, startHour: 22, endHour: 7 }

    const d1 = new Date()
    d1.setHours(21, 59, 0, 0)
    expect(isQuietHour(d1.getTime(), quietHours)).toBe(false)

    const d2 = new Date()
    d2.setHours(22, 0, 0, 0)
    expect(isQuietHour(d2.getTime(), quietHours)).toBe(true)

    const d3 = new Date()
    d3.setHours(6, 0, 0, 0)
    expect(isQuietHour(d3.getTime(), quietHours)).toBe(true)

    const d4 = new Date()
    d4.setHours(7, 0, 0, 0)
    expect(isQuietHour(d4.getTime(), quietHours)).toBe(false)
  })

  it('respects quiet hours with non-wrapping window', () => {
    const quietHours = { enabled: true, startHour: 21, endHour: 8 }

    const d1 = new Date()
    d1.setHours(20, 59, 0, 0)
    expect(isQuietHour(d1.getTime(), quietHours)).toBe(false)

    const d2 = new Date()
    d2.setHours(21, 0, 0, 0)
    expect(isQuietHour(d2.getTime(), quietHours)).toBe(true)

    const d3 = new Date()
    d3.setHours(7, 59, 0, 0)
    expect(isQuietHour(d3.getTime(), quietHours)).toBe(true)

    const d4 = new Date()
    d4.setHours(8, 0, 0, 0)
    expect(isQuietHour(d4.getTime(), quietHours)).toBe(false)
  })
})
