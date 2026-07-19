import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { DayRibbon } from './DayRibbon'

const hour = 60 * 60 * 1000
afterEach(() => cleanup())
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
  it('dismisses a pinned detail when the caregiver taps outside the rhythm card', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<><DayRibbon rhythm={rhythm} /><button type="button">Outside</button></>)

    await user.click(screen.getByRole('button', { name: /Nursing at/i }))
    expect(screen.getByRole('tooltip')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
    unmount()
  })

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

  it('opens an immersive rhythm dialog from the timeline and closes it with Escape', async () => {
    const user = userEvent.setup()
    render(<DayRibbon rhythm={rhythm} />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const dialog = screen.getByRole('dialog', { name: "Today's rhythm" })
    expect(within(dialog).getByRole('heading', { name: 'Your day, in motion' })).toBeTruthy()
    expect(within(dialog).getByText('1 feed')).toBeTruthy()
    expect(within(dialog).getByText('1 diaper')).toBeTruthy()
    expect(within(dialog).getByText('1 hr 30 min')).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: "Today's rhythm" })).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps event inspection inside the expanded rhythm and restores focus after closing', async () => {
    const user = userEvent.setup()
    render(<DayRibbon rhythm={rhythm} />)

    expect(screen.queryByRole('button', { name: "Enlarge today's rhythm" })).toBeNull()
    const timeline = screen.getByRole('group', { name: /Today's rhythm:/i })
    await user.click(timeline)
    const dialog = screen.getByRole('dialog', { name: "Today's rhythm" })
    await user.click(within(dialog).getByRole('button', { name: /Nursing at/i }))
    expect(within(dialog).getByRole('status').textContent).toMatch(/Nursing/)
    expect(within(dialog).getByRole('status').textContent).toMatch(/25 min/)

    await user.click(within(dialog).getByRole('button', { name: 'Close expanded rhythm' }))
    expect(document.activeElement).toBe(timeline)
  })
})
