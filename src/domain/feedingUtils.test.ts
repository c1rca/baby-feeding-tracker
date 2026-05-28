import { describe, expect, it } from 'vitest'
import { formatDuration, sumSideDurations } from './feedingUtils'

describe('feedingUtils', () => {
  it('formats short durations', () => {
    expect(formatDuration(125)).toBe('2m 05s')
  })

  it('formats hour durations', () => {
    expect(formatDuration(3900)).toBe('1h 05m')
  })

  it('sums left and right side durations', () => {
    const res = sumSideDurations([
      { side: 'left', startedAt: 0, endedAt: 30000 },
      { side: 'right', startedAt: 0, endedAt: 45000 },
    ])
    expect(res).toEqual({ left: 30, right: 45 })
  })
})
