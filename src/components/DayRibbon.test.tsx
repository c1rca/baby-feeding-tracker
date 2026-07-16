import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DayRibbon } from './DayRibbon'

const hour = 60 * 60 * 1000
const rhythm = {
  dayStartMs: 0,
  dayEndMs: 24 * hour,
  nowMs: 12 * hour,
  feeds: [{ id: 'feed-1', atMs: 8 * hour, endMs: 8 * hour + 25 * 60_000, type: 'breast' as const }],
  diapers: [{ id: 'diaper-1', atMs: 9 * hour, kind: 'wet' as const }],
  spans: [{ id: 'sleep-1', startMs: 10 * hour, endMs: 11.5 * hour, kind: 'sleep' as const }],
  summary: '1 feed, 1 diaper, 1 sleep',
}

describe('DayRibbon details', () => {
  it('opens polished event data on click and switches between rhythm items', async () => {
    const user = userEvent.setup()
    render(<DayRibbon rhythm={rhythm} />)

    await user.click(screen.getByRole('button', { name: /Nursing at/i }))
    expect(document.querySelector('.day-ribbon-card')?.className).not.toContain('is-inspecting')
    const feedTip = screen.getByRole('tooltip')
    expect(feedTip.textContent).toMatch(/Nursing/i)
    expect(feedTip.textContent).toMatch(/25 min/i)

    await user.click(screen.getByRole('button', { name: /Sleep from/i }))
    expect(screen.getByRole('tooltip').textContent).toMatch(/1 hr 30 min/i)
    expect(screen.queryAllByRole('tooltip')).toHaveLength(1)
  })
})
