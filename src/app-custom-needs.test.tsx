import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { setupAppTestEnvironment } from './appTestSetup'
import type { CustomEvent, CustomTracker } from './types'

const TRACKERS_KEY = 'baby-feeding-tracker:v1:custom-trackers'
const EVENTS_KEY = 'baby-feeding-tracker:v1:custom-events'

const seed = (trackers: CustomTracker[], events: CustomEvent[] = []) => {
  localStorage.setItem(TRACKERS_KEY, JSON.stringify(trackers))
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
}

const tracker = (over: Partial<CustomTracker> = {}): CustomTracker => ({
  id: 't1', name: 'Vitamin C', icon: 'pill', hue: 'vitamin', goal: { kind: 'once' }, createdAt: 1000, archivedAt: null, ...over,
})

const needsCard = () => screen.getByRole('region', { name: /Today's needs/i })
const rowFor = (title: string) => {
  const heading = within(needsCard()).getByText(title, { selector: '.care-need-copy strong' })
  return heading.closest('.care-need') as HTMLElement
}

/**
 * The shape of a row, ignoring its words and its glyph — what a caregiver's eye
 * compares. The icon differs by design; everything holding it does not.
 */
const skeleton = (row: HTMLElement) =>
  Array.from(row.querySelectorAll('*'))
    .filter((node) => !node.closest('svg'))
    .map((node) => `${node.tagName.toLowerCase()}.${Array.from(node.classList).filter((name) => name !== 'is-done' && !name.startsWith('care-need--')).join('.')}`)
    .concat(row.querySelector('.care-need-icon svg') ? 'svg' : '')
    .join(' > ')

describe("caregiver-defined needs in Today's needs", () => {
  setupAppTestEnvironment()

  // If a caregiver can pick the custom rows out of the list, the feature has
  // failed — so each custom goal shape is held against the built-in row that
  // does the same job, and must render through to the same markup.
  it('renders a once-a-day custom row exactly like the built-in Vitamin D row', () => {
    seed([tracker({ name: 'Vitamin C' })])
    render(<App />)

    expect(skeleton(rowFor('Vitamin C'))).toBe(skeleton(rowFor('Vitamin D')))
  })

  it('renders a repeating custom row exactly like the built-in tummy-time row', () => {
    seed([tracker({ name: 'Drops', goal: { kind: 'count', target: 3 } })])
    render(<App />)

    expect(skeleton(rowFor('Drops'))).toBe(skeleton(rowFor('Tummy time')))
  })

  it('completes a custom row into the same done state as a built-in one', async () => {
    const user = userEvent.setup()
    seed([tracker({ name: 'Vitamin C' })])
    render(<App />)

    await user.click(within(rowFor('Vitamin C')).getByRole('button', { name: 'Log Vitamin C' }))
    await user.click(within(rowFor('Vitamin D')).getByRole('button', { name: /Log Vitamin D dose/i }))

    expect(skeleton(rowFor('Vitamin C'))).toBe(skeleton(rowFor('Vitamin D')))
    expect(rowFor('Vitamin C').className).toBe(rowFor('Vitamin D').className.replace(' care-need--vitamin', ''))
  })

  // A minutes goal is filled by a timer rather than a tap, so its row offers
  // the timer instead of a log button.
  it('offers a timer on a minutes-goal row', () => {
    seed([tracker({ name: 'Physio', goal: { kind: 'duration', targetMinutes: 15 } })])
    render(<App />)

    expect(within(rowFor('Physio')).getByText('0 of 15 min')).toBeTruthy()
    expect(within(rowFor('Physio')).getByRole('progressbar')).toBeTruthy()
    expect(within(rowFor('Physio')).getByRole('button', { name: 'Start Physio timer' })).toBeTruthy()
  })

  it('logs from the row and counts toward the heading', async () => {
    const user = userEvent.setup()
    seed([tracker()])
    render(<App />)

    const before = within(needsCard()).getByText(/of \d+ done|All caught up/i).textContent ?? ''
    const [beforeDone, beforeTotal] = before.match(/\d+/g)?.map(Number) ?? []
    expect(beforeTotal).toBeGreaterThan(0)

    expect(within(rowFor('Vitamin C')).getByText('Not logged yet')).toBeTruthy()
    await user.click(within(rowFor('Vitamin C')).getByRole('button', { name: 'Log Vitamin C' }))

    expect(rowFor('Vitamin C').classList.contains('is-done')).toBe(true)
    expect(within(rowFor('Vitamin C')).getByText(/Logged at/i)).toBeTruthy()
    expect(within(rowFor('Vitamin C')).queryByRole('button', { name: 'Log Vitamin C' })).toBeNull()

    const after = within(needsCard()).getByText(/of \d+ done|All caught up/i).textContent ?? ''
    const [afterDone] = after.match(/\d+/g)?.map(Number) ?? []
    expect(afterDone).toBe((beforeDone ?? 0) + 1)

    const stored: CustomEvent[] = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ trackerId: 't1', goalAtLog: { kind: 'once' } })
  })

  it('counts a repeating tracker up to its target before calling it done', async () => {
    const user = userEvent.setup()
    seed([tracker({ name: 'Drops', goal: { kind: 'count', target: 2 } })])
    render(<App />)

    expect(within(rowFor('Drops')).getByText('0 of 2')).toBeTruthy()
    await user.click(within(rowFor('Drops')).getByRole('button', { name: 'Log Drops' }))
    expect(within(rowFor('Drops')).getByText('1 of 2')).toBeTruthy()
    expect(rowFor('Drops').classList.contains('is-done')).toBe(false)

    await user.click(within(rowFor('Drops')).getByRole('button', { name: 'Log Drops' }))
    expect(within(rowFor('Drops')).getByText('Goal met with 2')).toBeTruthy()
    expect(rowFor('Drops').classList.contains('is-done')).toBe(true)
  })

  it('keeps an archived tracker out of the list without touching its history', () => {
    seed([tracker({ archivedAt: 2000 })], [{ id: 'e1', trackerId: 't1', at: Date.now() }])
    render(<App />)

    expect(within(needsCard()).queryByText('Vitamin C')).toBeNull()
    expect(JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]')).toHaveLength(1)
  })

  it('measures the day against the goal that applied when it was logged', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-05T14:00:00'))
    // Logged once under a goal of one a day; the caregiver has since raised the
    // target. A day that was met stays met.
    seed(
      [tracker({ goal: { kind: 'count', target: 4 } })],
      [{ id: 'e1', trackerId: 't1', at: new Date('2026-06-05T09:00:00').getTime(), goalAtLog: { kind: 'count', target: 1 } }],
    )
    render(<App />)

    expect(rowFor('Vitamin C').classList.contains('is-done')).toBe(true)
    vi.useRealTimers()
  })
})

const TUMMY_SESSION_KEY = 'baby-feeding-tracker:v1:tummy-session'
const timed = (over: Partial<CustomTracker> = {}) =>
  tracker({ name: 'Physio', goal: { kind: 'duration', targetMinutes: 15 }, timer: true, ...over })

describe('caregiver-defined timers', () => {
  setupAppTestEnvironment()

  it('runs in the shared care-timer slot, naming itself in the hero', async () => {
    const user = userEvent.setup()
    seed([timed()])
    render(<App />)

    await user.click(within(rowFor('Physio')).getByRole('button', { name: 'Start Physio timer' }))

    // The hero names the tracker rather than falling back to "Tummy Time",
    // which is what the slot it borrows is otherwise used for.
    expect(document.querySelector('.timer-mode-pill')?.textContent).toBe('Physio')
    expect(screen.getByRole('button', { name: /Stop & save Physio/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Pause Physio timer/i })).toBeTruthy()

    const session = JSON.parse(localStorage.getItem(TUMMY_SESSION_KEY) ?? 'null')
    expect(session).toMatchObject({ kind: 'custom', trackerId: 't1' })
  })

  it('resumes after a reload, because the slot is persisted like any other timer', () => {
    seed([timed()])
    localStorage.setItem(TUMMY_SESSION_KEY, JSON.stringify({
      id: 's1', startedAt: Date.now() - 120_000, runningStartedAt: Date.now() - 120_000, elapsedSeconds: 0, note: '', kind: 'custom', trackerId: 't1',
    }))
    render(<App />)

    expect(document.querySelector('.timer-mode-pill')?.textContent).toBe('Physio')
    expect(within(rowFor('Physio')).getByText('Timer running')).toBeTruthy()
    expect(within(rowFor('Physio')).getByRole('button', { name: 'Stop Physio timer' })).toBeTruthy()
  })

  it('saves elapsed minutes onto the tracker, not into tummy-time history', async () => {
    const user = userEvent.setup()
    seed([timed()])
    const startedAt = Date.now() - 16 * 60_000
    localStorage.setItem(TUMMY_SESSION_KEY, JSON.stringify({ id: 's1', startedAt, runningStartedAt: startedAt, elapsedSeconds: 0, note: '', kind: 'custom', trackerId: 't1' }))
    render(<App />)

    await user.click(within(rowFor('Physio')).getByRole('button', { name: 'Stop Physio timer' }))

    const events: CustomEvent[] = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]')
    expect(events).toHaveLength(1)
    expect(events[0].trackerId).toBe('t1')
    expect(events[0].durationSeconds).toBeGreaterThanOrEqual(15 * 60)
    expect(events[0].goalAtLog).toEqual({ kind: 'duration', targetMinutes: 15 })
    // It must not land in tummy-time history, which would inflate a goal it
    // has nothing to do with.
    expect(JSON.parse(localStorage.getItem('baby-feeding-tracker:v1:tummy-times') ?? '[]')).toHaveLength(0)
    expect(within(rowFor('Physio')).getByText(/Goal met with 16 min/)).toBeTruthy()
    expect(rowFor('Physio').classList.contains('is-done')).toBe(true)
  })

  it('refuses to start alongside another timer', async () => {
    const user = userEvent.setup()
    seed([timed()])
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    // The needs card stays on the page during an active feed, so the row's
    // control is reachable and must decline rather than double-book the slot.
    await user.click(within(rowFor('Physio')).getByRole('button', { name: 'Start Physio timer' }))

    expect(screen.getByText(/Finish or clear the active timer before starting Physio/i)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(TUMMY_SESSION_KEY) ?? 'null')).toBeNull()
  })

  it('only puts timed trackers in the care launcher', () => {
    seed([timed(), tracker({ id: 't2', name: 'Vitamin C', goal: { kind: 'once' } })])
    render(<App />)

    const launcher = screen.getByRole('group', { name: /Care action launcher/i })
    expect(within(launcher).getByRole('button', { name: 'Physio' })).toBeTruthy()
    expect(within(launcher).queryByRole('button', { name: 'Vitamin C' })).toBeNull()
  })
})

describe('caregiver-defined history', () => {
  setupAppTestEnvironment()

  const at = (hour: number) => { const date = new Date(); date.setHours(hour, 0, 0, 0); return date.getTime() }

  it('shows a log in the timeline, named and timed like every other event', () => {
    seed([tracker({ name: 'Vitamin C' })], [{ id: 'e1', trackerId: 't1', at: at(9) }])
    render(<App />)

    const item = document.querySelector('.timeline-custom') as HTMLElement
    expect(item).toBeTruthy()
    expect(within(item).getByText('Vitamin C')).toBeTruthy()
    expect(item.textContent).toMatch(/9:00/)
  })

  it('shows a timed log with its duration', () => {
    seed([timed()], [{ id: 'e1', trackerId: 't1', at: at(9), durationSeconds: 16 * 60 }])
    render(<App />)

    expect(within(document.querySelector('.timeline-custom') as HTMLElement).getByText(/16m/)).toBeTruthy()
  })

  it('deletes a log from the timeline and offers undo', async () => {
    const user = userEvent.setup()
    seed([tracker({ name: 'Vitamin C' })], [{ id: 'e1', trackerId: 't1', at: at(9) }])
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Vitamin C actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete Vitamin C log' }))
    await user.click(screen.getByRole('menuitem', { name: 'Confirm delete Vitamin C log' }))

    expect(document.querySelector('.timeline-custom')).toBeNull()
    expect(JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: /Undo log delete/i }))
    expect(JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]')).toHaveLength(1)
  })

  it('keeps an archived tracker’s logs readable rather than orphaning them', () => {
    seed([tracker({ name: 'Vitamin C', archivedAt: 5000 })], [{ id: 'e1', trackerId: 't1', at: at(9) }])
    render(<App />)

    // Out of Today's needs, still named in history.
    expect(within(needsCard()).queryByText('Vitamin C')).toBeNull()
    expect(within(document.querySelector('.timeline-custom') as HTMLElement).getByText('Vitamin C')).toBeTruthy()
  })

  it('finds a log by the tracker’s name, which is the only name it has', async () => {
    const user = userEvent.setup()
    seed([tracker({ name: 'Vitamin C' })], [{ id: 'e1', trackerId: 't1', at: at(9) }])
    render(<App />)

    // Search and jump-to-date live behind the magnifier now.
    await user.click(screen.getByRole('button', { name: /Search and jump to a date/i }))
    await user.type(screen.getByRole('searchbox', { name: /Search timeline/i }), 'vitamin c')
    expect(document.querySelector('.timeline-custom')).toBeTruthy()

    await user.clear(screen.getByRole('searchbox', { name: /Search timeline/i }))
    await user.type(screen.getByRole('searchbox', { name: /Search timeline/i }), 'zzz')
    expect(document.querySelector('.timeline-custom')).toBeNull()
  })

  it('puts the day’s trackers in the recap, only once something is logged', async () => {
    const user = userEvent.setup()
    seed([tracker({ name: 'Vitamin C', goal: { kind: 'count', target: 3 } })], [{ id: 'e1', trackerId: 't1', at: at(9) }])
    render(<App />)

    await user.click(screen.getByRole('group', { name: /Today's rhythm:/i }))
    const recap = within(screen.getByRole('dialog', { name: "Today's rhythm" })).getByLabelText(/Today so far/i)
    expect(within(recap).getByText('Vitamin C')).toBeTruthy()
    expect(within(recap).getByText('1 of 3')).toBeTruthy()
  })

  it('gives each tracker its own Insights card', async () => {
    seed([tracker({ name: 'Vitamin C', goal: { kind: 'count', target: 2 } })], [{ id: 'e1', trackerId: 't1', at: at(9) }])
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /^Insights$/i }))
    const card = await screen.findByRole('region', { name: 'Vitamin C stats' })
    expect(within(card).getByText(/1\/2 today/)).toBeTruthy()
    expect(within(card).getByLabelText(/Today Vitamin C progress 50%/i)).toBeTruthy()
  })
})
