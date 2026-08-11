import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { DayRibbon } from './DayRibbon'

const hour = 60 * 60 * 1000
// Render the same clock label the component shows for a timestamp, so these
// assertions are timezone-independent (the fixture times are epoch-relative).
const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
afterEach(() => cleanup())
const rhythm = {
  dayStartMs: 0,
  dayEndMs: 24 * hour,
  nowMs: 12 * hour,
  feeds: [{ id: 'feed-1', atMs: 8 * hour, endMs: 8 * hour + 25 * 60_000, type: 'breast' as const, leftSeconds: 15 * 60, rightSeconds: 10 * 60 }],
  diapers: [{ id: 'diaper-1', atMs: 9 * hour, kind: 'wet' as const }],
  spans: [{ id: 'sleep-1', startMs: 10 * hour, endMs: 11.5 * hour, kind: 'sleep' as const }],
  summary: '1 feed, 1 diaper, 1 sleep',
  recap: { tummyMinutes: 0, tummyGoalMinutes: 20, tummyGoalMet: false, sleepMinutes: 90, vitaminDAtMs: null, wet: 1, stool: 0, customs: [], showSleep: true },
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
    expect(within(dialog).getByLabelText('Feeding: 1 feed, 25 min total, 15 minutes left, 10 minutes right')).toBeTruthy()
    expect(within(dialog).getByLabelText('Changes: 1 total, 1 wet, 0 stool, 0 mixed')).toBeTruthy()
    expect(within(dialog).getByText('1 hr 30 min')).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: "Today's rhythm" })).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  // Rest used to be a tile of its own beside a separate "Today so far" strip.
  // Both said how the day went; they are one card now.
  it('carries rest inside the day recap rather than a card of its own', async () => {
    const user = userEvent.setup()
    render(<DayRibbon rhythm={rhythm} />)
    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))

    const recap = screen.getByRole('region', { name: 'Today so far' })
    const items = within(recap).getAllByRole('listitem').map((item) => item.textContent)
    expect(items[0]).toMatch(/Rest/)
    expect(items[0]).toMatch(/1 hr 30 min/)
    expect(items.some((item) => item?.includes('Tummy time'))).toBe(true)
    expect(items.some((item) => item?.includes('Vitamin D'))).toBe(true)

    // Changes has its own card right beside it; repeating it here was noise.
    expect(items.some((item) => item?.match(/changes?$/i))).toBe(false)
    // And there is exactly one card describing the day, not two.
    expect(screen.getAllByText(/Today so far/i)).toHaveLength(1)
  })

  it('reads an empty rest slot honestly', async () => {
    const user = userEvent.setup()
    render(<DayRibbon rhythm={{ ...rhythm, spans: [], recap: { ...rhythm.recap, sleepMinutes: 0 } }} />)
    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))

    const rest = within(screen.getByRole('region', { name: 'Today so far' })).getAllByRole('listitem')[0]
    expect(rest.textContent).toMatch(/No sleep yet/i)
    expect(rest.className).not.toMatch(/is-done/)
  })

  it('shows today’s nursing split under the feed total', async () => {
    const user = userEvent.setup()
    const splitRhythm = {
      ...rhythm,
      feeds: [{ ...rhythm.feeds[0], leftSeconds: 15 * 60, rightSeconds: 10 * 60 }],
    }
    render(<DayRibbon rhythm={splitRhythm} />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const feeding = within(screen.getByRole('dialog', { name: "Today's rhythm" })).getByLabelText('Feeding: 1 feed, 25 min total, 15 minutes left, 10 minutes right')
    expect(within(feeding).getByText('25 min')).toBeTruthy()
    expect(within(feeding).getByText('Feeding time')).toBeTruthy()
    expect(feeding.querySelector('.rhythm-side-stat--left')?.textContent).toBe('Left15m')
    expect(feeding.querySelector('.rhythm-side-stat--right')?.textContent).toBe('Right10m')
    expect(feeding.querySelector('.rhythm-side-balance')).toBeTruthy()
    expect((feeding.querySelector('.rhythm-side-balance') as HTMLElement).style.getPropertyValue('--rhythm-left-share')).toBe('60%')
  })

  it('shows a truthful empty feeding state without inventing a side balance', async () => {
    const user = userEvent.setup()
    render(<DayRibbon rhythm={{ ...rhythm, feeds: [], summary: '0 feeds, 1 diaper, 1 sleep' }} />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const feeding = within(screen.getByRole('dialog', { name: "Today's rhythm" })).getByLabelText('Feeding: 0 feeds, 0 min total, 0 minutes left, 0 minutes right')
    expect(within(feeding).getByText('0 min')).toBeTruthy()
    expect(feeding.querySelector('.rhythm-side-balance')?.classList.contains('is-empty')).toBe(true)
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
    const changes = within(screen.getByRole('dialog', { name: "Today's rhythm" })).getByLabelText('Changes: 3 total, 1 wet, 1 stool, 1 mixed')
    expect(within(changes).queryByText('3 total')).toBeNull()
    expect(changes.querySelector('.rhythm-insight-head b')).toBeNull()
    expect(within(changes).getByText('Total changes')).toBeTruthy()
    expect(changes.querySelector('.rhythm-change-total')?.textContent).toContain('3')
    expect(changes.querySelector('.rhythm-change-stats')).toBeTruthy()
    expect(changes.querySelector('.rhythm-change-stat--wet')?.textContent).toBe('Wet1')
    expect(changes.querySelector('.rhythm-change-stat--stool')?.textContent).toBe('Stool1')
    expect(changes.querySelector('.rhythm-change-stat--mixed')?.textContent).toBe('Mixed1')
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
    expect(within(dialog).getByRole('status').textContent).toContain(timeLabel(9 * hour))
  })

  it('steps the expanded rhythm back a day and returns to today from the picker', async () => {
    const user = userEvent.setup()
    // A real-clock "today" so the picker's day arithmetic matches the fixture.
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    const dayStart = (offsetDays: number) => { const day = new Date(todayStart); day.setDate(day.getDate() + offsetDays); return day.getTime() }
    const dayRhythm = (offsetDays: number) => ({
      ...rhythm,
      dayStartMs: dayStart(offsetDays),
      dayEndMs: dayStart(offsetDays + 1),
      nowMs: dayStart(offsetDays) + 12 * hour,
      feeds: offsetDays === 0 ? rhythm.feeds : [],
      diapers: offsetDays === 0 ? rhythm.diapers : [{ id: 'diaper-past', atMs: dayStart(offsetDays) + 9 * hour, kind: 'stool' as const }],
      spans: offsetDays === 0 ? rhythm.spans : [],
    })
    const rhythmForDay = (dayAnchorMs: number) => dayRhythm(Math.round((dayAnchorMs - todayStart) / (24 * hour)))
    render(<DayRibbon rhythm={dayRhythm(0)} rhythmForDay={rhythmForDay} earliestDayMs={dayStart(-6)} />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const dialog = screen.getByRole('dialog', { name: "Today's rhythm" })
    expect(within(dialog).getByRole('group', { name: 'Choose a day' }).textContent).toContain('Today')
    expect((within(dialog).getByRole('button', { name: 'Next day' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(dialog).queryByRole('button', { name: 'Today' })).toBeNull()

    await user.click(within(dialog).getByRole('button', { name: 'Previous day' }))
    const pastDialog = screen.getByRole('dialog', { name: /Rhythm for/i })
    expect(within(pastDialog).getByRole('group', { name: 'Choose a day' }).textContent).toContain('Yesterday')
    // Yesterday's own events replace today's, and the live "Now" line is gone.
    expect(within(pastDialog).getByLabelText('Changes: 1 total, 0 wet, 1 stool, 0 mixed')).toBeTruthy()
    expect(within(pastDialog).queryByRole('button', { name: /Nursing at/i })).toBeNull()
    expect(pastDialog.querySelector('.rhythm-stage-now')).toBeNull()

    await user.click(within(pastDialog).getByRole('button', { name: 'Today' }))
    const backDialog = screen.getByRole('dialog', { name: "Today's rhythm" })
    expect(within(backDialog).getByRole('button', { name: /Nursing at/i })).toBeTruthy()
    expect(backDialog.querySelector('.rhythm-stage-now')).toBeTruthy()
  })

  it('stops the picker at the oldest logged day and hides it without a day source', async () => {
    const user = userEvent.setup()
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    const today = { ...rhythm, dayStartMs: todayStart, dayEndMs: todayStart + 24 * hour, nowMs: todayStart + 12 * hour }
    const { unmount } = render(<DayRibbon rhythm={today} rhythmForDay={() => today} earliestDayMs={todayStart} />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const dialog = screen.getByRole('dialog', { name: "Today's rhythm" })
    expect((within(dialog).getByRole('button', { name: 'Previous day' }) as HTMLButtonElement).disabled).toBe(true)
    const input = within(dialog).getByLabelText(/Choose a different day/i) as HTMLInputElement
    expect(input.min).toBe(input.max)
    unmount()

    render(<DayRibbon rhythm={today} />)
    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    expect(screen.queryByRole('group', { name: 'Choose a day' })).toBeNull()
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
      within(dialog).getByRole('button', { name: new RegExp(`Nursing at ${timeLabel(8 * hour)}`, 'i') }),
      within(dialog).getByRole('button', { name: new RegExp(`Bottle at ${timeLabel(8 * hour + 20 * 60_000)}`, 'i') }),
      within(dialog).getByRole('button', { name: new RegExp(`Wet diaper at ${timeLabel(8 * hour + 35 * 60_000)}`, 'i') }),
    ].map((event) => event.style.getPropertyValue('--rhythm-event-row'))
    expect(new Set(rows).size).toBe(3)
  })
})

// A household that never logs sleep does not want a permanent "No sleep yet"
// row; one that usually logs it wants to see the gap on a day it forgot.
describe('rest only appears when it is relevant', () => {
  const recapItems = () => within(screen.getByRole('region', { name: 'Today so far' })).getAllByRole('listitem').map((n) => n.textContent)

  it('is hidden when sleep has never been logged', async () => {
    const user = userEvent.setup()
    render(<DayRibbon rhythm={{ ...rhythm, spans: [], recap: { ...rhythm.recap, sleepMinutes: 0, showSleep: false } }} />)
    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    expect(recapItems().some((item) => item?.includes('Rest'))).toBe(false)
  })

  it('is shown, even empty, once sleep is something this household tracks', async () => {
    const user = userEvent.setup()
    render(<DayRibbon rhythm={{ ...rhythm, spans: [], recap: { ...rhythm.recap, sleepMinutes: 0, showSleep: true } }} />)
    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    expect(recapItems()[0]).toMatch(/Rest/)
    expect(recapItems()[0]).toMatch(/No sleep yet/)
  })
})
