import { describe, expect, it } from 'vitest'
import { activeTimerEventRange } from './careTimer'

it('ends a paused care timer at the real stop time while preserving active duration', () => {
  const stoppedAt = new Date('2026-07-18T11:10:00').getTime()
  const session = {
    startedAt: new Date('2026-07-18T10:00:00').getTime(),
    runningStartedAt: new Date('2026-07-18T11:00:00').getTime(),
    elapsedSeconds: 10 * 60,
  }
  const range = activeTimerEventRange(session, stoppedAt)
  expect(range.endedAt).toBe(stoppedAt)
  expect(range.endedAt - range.startedAt).toBe(20 * 60 * 1000)
})

describe('activeTimerEventRange legacy sessions', () => {
  it('preserves an uninterrupted legacy start time', () => {
    const session = { startedAt: 1000 }
    expect(activeTimerEventRange(session, 11_000)).toEqual({ startedAt: 1000, endedAt: 11_000 })
  })
})
