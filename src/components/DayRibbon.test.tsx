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
  feeds: [{ id: 'feed-1', atMs: 8 * hour, endMs: 8 * hour + 25 * 60_000, type: 'breast' as const, leftSeconds: 15 * 60, rightSeconds: 10 * 60 }],
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
    expect(within(dialog).getByLabelText('Feeds: 1 feed, 25 min feeding, 15 minutes left, 10 minutes right')).toBeTruthy()
    expect(within(dialog).getByLabelText('Changes: 1 diaper, 1 wet, 0 stool, 0 mixed')).toBeTruthy()
    expect(within(dialog).getByText('1 hr 30 min')).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: "Today's rhythm" })).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  it('shows today’s nursing split under the feed total', async () => {
    const user = userEvent.setup()
    const splitRhythm = {
      ...rhythm,
      feeds: [{ ...rhythm.feeds[0], leftSeconds: 15 * 60, rightSeconds: 10 * 60 }],
    }
    render(<DayRibbon rhythm={splitRhythm} />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const feeds = within(screen.getByRole('dialog', { name: "Today's rhythm" })).getByLabelText('Feeds: 1 feed, 25 min feeding, 15 minutes left, 10 minutes right')
    expect(within(feeds).getByText('1')).toBeTruthy()
    expect(within(feeds).getByText('25 min feeding')).toBeTruthy()
    expect(feeds.querySelector('.rhythm-feed-count--left')?.textContent).toBe('Left 15m')
    expect(feeds.querySelector('.rhythm-feed-count--right')?.textContent).toBe('Right 10m')
  })

  it('breaks today’s changes into wet, stool, and mixed counts', async () => {
    const user = userEvent.setup()
    const diaperBreakdownRhythm = {
      ...rhythm,
      diapers: [
        { id: 'diaper-wet', atMs: 8 * hour, kind: 'wet' as const },
        { id: 'diaper-stool', atMs: 9 * hour, kind: 'stool' as const },
        { id: 'diaper-mixed', atMs: 10 * hour, kind: 'mixed' as const },
      ],
      summary: '1 feed, 3 diapers, 1 sleep',
    }
    render(<DayRibbon rhythm={diaperBreakdownRhythm} />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const changes = within(screen.getByRole('dialog', { name: "Today's rhythm" })).getByLabelText('Changes: 3 diapers, 1 wet, 1 stool, 1 mixed')
    expect(within(changes).getByText('3')).toBeTruthy()
    expect(changes.querySelector('.rhythm-diaper-count--wet')?.textContent).toBe('Wet 1')
    expect(changes.querySelector('.rhythm-diaper-count--stool')?.textContent).toBe('Stool 1')
    expect(changes.querySelector('.rhythm-diaper-count--mixed')?.textContent).toBe('Mixed 1')
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

  it('keeps dense event timestamps in the selected detail instead of overlapping the stage', async () => {
    const user = userEvent.setup()
    render(<DayRibbon rhythm={rhythm} />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const dialog = screen.getByRole('dialog', { name: "Today's rhythm" })
    expect(dialog.querySelectorAll('.rhythm-stage-event > span, .rhythm-stage-diaper > span')).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: /Wet diaper at/i }))
    expect(within(dialog).getByRole('status').textContent).toMatch(/Wet diaper/)
    expect(within(dialog).getByRole('status').textContent).toMatch(/4:00 AM/)
  })

  it('stacks nearby point events into touch-safe rows so mobile does not need a wide timeline', async () => {
    const denseRhythm = {
      ...rhythm,
      feeds: [
        { id: 'feed-1', atMs: 8 * hour, endMs: 8 * hour + 25 * 60_000, type: 'breast' as const },
        { id: 'feed-2', atMs: 8 * hour + 20 * 60_000, endMs: 8 * hour + 45 * 60_000, type: 'bottle' as const },
      ],
      diapers: [{ id: 'diaper-1', atMs: 8 * hour + 35 * 60_000, kind: 'wet' as const }],
      summary: '2 feeds, 1 diaper, 1 sleep',
    }
    const user = userEvent.setup()
    render(<DayRibbon rhythm={denseRhythm} />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const dialog = screen.getByRole('dialog', { name: "Today's rhythm" })
    const rows = [
      within(dialog).getByRole('button', { name: /Nursing at 3:00 AM/i }),
      within(dialog).getByRole('button', { name: /Bottle at 3:20 AM/i }),
      within(dialog).getByRole('button', { name: /Wet diaper at 3:35 AM/i }),
    ].map((event) => event.style.getPropertyValue('--rhythm-event-row'))
    expect(new Set(rows).size).toBe(3)
  })
})
