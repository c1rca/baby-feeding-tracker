import { describe, expect, it } from 'vitest'
import { allTimeDayCount } from './statsUtils'

describe('allTimeDayCount', () => {
  it('counts calendar days across a spring-forward transition', () => {
    const firstDay = new Date(2026, 2, 7)
    firstDay.setHours(0, 0, 0, 0)
    const today = new Date(2026, 2, 9)
    today.setHours(0, 0, 0, 0)

    expect(allTimeDayCount([{ at: firstDay.getTime() }], today.getTime())).toBe(3)
  })
})