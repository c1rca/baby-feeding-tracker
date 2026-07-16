import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { STORAGE_KEY, STORAGE_MEDICINES_KEY, setupAppTestEnvironment } from './appTestSetup'

const TUMMY_STORAGE_KEY = 'baby-feeding-tracker:v1:tummy-times'

describe('caregiver today brief', () => {
  setupAppTestEnvironment()

  it('leads the idle page with the caregiver brief instead of the timer', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-05T14:00:00'))
    render(<App />)

    const brief = document.querySelector('.today-brief') as HTMLElement
    expect(brief).toBeTruthy()
    expect(brief.textContent).toMatch(/Good afternoon, Mom/i)
    expect(brief.textContent).toMatch(/Friday, June 5/i)
    expect(brief.textContent).toMatch(/Next feed/i)
    expect(brief.textContent).not.toMatch(/Today's needs/i)
    const needsCard = document.querySelector('.care-needs-card') as HTMLElement
    expect(needsCard).toBeTruthy()
    expect(needsCard.textContent).toMatch(/Today's needs/i)
    expect(screen.getByRole('group', { name: /Care action launcher/i }).compareDocumentPosition(needsCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // the feed timer stays out of the way until something is being timed
    expect(document.querySelector('.timer-shell')).toBeNull()
    expect(brief.textContent).not.toMatch(/0m 00s/)
    // quick care stays reachable from the brief
    expect(screen.getByRole('group', { name: /Care action launcher/i })).toBeTruthy()
  })

  it('pulls up the live feed timer from the start button and returns to the brief after saving', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))

    expect(document.querySelector('.today-brief')).toBeNull()
    expect(document.querySelector('.timer-shell.is-live')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Pause feed timer/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /End feed/i }))

    expect(document.querySelector('.timer-shell')).toBeNull()
    expect(document.querySelector('.today-brief')).toBeTruthy()
    expect(screen.getByText(/Feed saved/i)).toBeTruthy()
  })

  it('tracks vitamin D as a need and completes it from the one-tap log', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText(/Not given yet/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Log Vitamin D dose/i }))

    expect(screen.getByText(/Given at/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Log Vitamin D dose/i })).toBeNull()
    const saved = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]')
    expect(saved[0]).toMatchObject({ kind: 'vitamin_d' })
  })

  it('shows tummy time progress toward the goal and celebrates when the goal is met', () => {
    const now = Date.now()
    localStorage.setItem(TUMMY_STORAGE_KEY, JSON.stringify([
      { id: 'tt-1', startedAt: now - 3_600_000, endedAt: now - 3_600_000 + 8 * 60_000, kind: 'tummy' },
    ]))
    const { unmount } = render(<App />)

    expect(screen.getByText(/8 of 20 min/i)).toBeTruthy()
    const progress = screen.getByRole('progressbar', { name: /Tummy time progress/i })
    expect(progress.getAttribute('aria-valuenow')).toBe('8')
    unmount()

    localStorage.setItem(TUMMY_STORAGE_KEY, JSON.stringify([
      { id: 'tt-2', startedAt: now - 3_600_000, endedAt: now - 3_600_000 + 22 * 60_000, kind: 'tummy' },
    ]))
    render(<App />)
    expect(screen.getByText(/Goal met with 22 min/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Start Tummy Time timer/i })).toBeNull()
  })

  it('starts a live tummy timer from the needs list and hands the page to the timer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start Tummy Time timer/i }))

    expect(document.querySelector('.today-brief')).toBeNull()
    expect(screen.getByText(/^Tummy Time$/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Stop & Save Tummy Time/i })).toBeTruthy()
  })

  it('reads the clock for the caregiver: upcoming, open, and late feed cues', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const feedStart = new Date('2026-06-05T08:00:00').getTime()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'cue-feed', type: 'breast', startedAt: feedStart, endedAt: feedStart + 20 * 60_000, leftSeconds: 600, rightSeconds: 600, bottleOunces: null, note: '' },
    ]))

    vi.setSystemTime(new Date('2026-06-05T08:45:00'))
    const first = render(<App />)
    let focal = document.querySelector('.today-brief-focal') as HTMLElement
    expect(focal.getAttribute('data-state')).toBe('upcoming')
    expect(focal.textContent).toMatch(/in 1h 15m/i)
    first.unmount()

    vi.setSystemTime(new Date('2026-06-05T10:30:00'))
    const second = render(<App />)
    focal = document.querySelector('.today-brief-focal') as HTMLElement
    expect(focal.getAttribute('data-state')).toBe('open')
    expect(focal.textContent).toMatch(/Window open/i)
    second.unmount()

    vi.setSystemTime(new Date('2026-06-05T12:00:00'))
    render(<App />)
    focal = document.querySelector('.today-brief-focal') as HTMLElement
    expect(focal.getAttribute('data-state')).toBe('late')
    expect(focal.textContent).toMatch(/Running late/i)
    // the raw window stays available as supporting detail
    expect(focal.textContent).toMatch(/10:00/)
  })

  it('draws the day rhythm ribbon from today\'s events with an accessible summary', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-05T14:00:00'))
    const at = (h: number, m = 0) => new Date(2026, 5, 5, h, m).getTime()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'r-f1', type: 'breast', startedAt: at(6), endedAt: at(6, 25), leftSeconds: 700, rightSeconds: 700, bottleOunces: null, note: '' },
      { id: 'r-f2', type: 'bottle', startedAt: at(9, 30), endedAt: at(9, 45), leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note: '' },
    ]))
    localStorage.setItem('baby-feeding-tracker:v1:diapers', JSON.stringify([
      { id: 'r-d1', kinds: ['wet'], at: at(7), context: 'standalone' },
    ]))
    localStorage.setItem('baby-feeding-tracker:v1:tummy-times', JSON.stringify([
      { id: 'r-t1', startedAt: at(11), endedAt: at(11, 10), kind: 'tummy' },
      { id: 'r-s1', startedAt: at(12), endedAt: at(13), kind: 'sleep' },
    ]))
    render(<App />)

    const ribbon = screen.getByRole('group', { name: /Today's rhythm: 2 feeds, 1 diaper, 1 sleep, 1 tummy session/i })
    expect(ribbon).toBeTruthy()
    expect(document.querySelectorAll('.day-ribbon-feed')).toHaveLength(2)
    expect(document.querySelectorAll('.day-ribbon-tick')).toHaveLength(1)
    expect(document.querySelectorAll('.day-ribbon-span--sleep')).toHaveLength(1)
    expect(document.querySelector('.day-ribbon-now')).toBeTruthy()
  })

  it('stands the reminder banner down while the brief lists the same needs', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'med-banner', kind: 'tylenol', at: Date.now() - 7 * 3_600_000 }]))
    render(<App />)

    // the needs list owns the reminder on the idle page; no duplicate floating banner
    expect(await screen.findByText(/Tylenol due/i)).toBeTruthy()
    expect(document.querySelector('#care-brief-slot .care-brief')).toBeNull()

    // once a timer takes over the panel, the banner earns its slot back
    await user.click(screen.getByRole('button', { name: /Start suggested side/i }))
    expect(document.querySelector('#care-brief-slot .care-brief')).toBeTruthy()
  })

  it('hides bottle and pump stat cards after 72 quiet hours', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-05T14:00:00'))
    const now = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'nurse-only', type: 'breast', startedAt: now - 2 * 3_600_000, endedAt: now - 2 * 3_600_000 + 20 * 60_000, leftSeconds: 600, rightSeconds: 600, bottleOunces: null, note: '' },
      { id: 'old-bottle', type: 'bottle', startedAt: now - 80 * 3_600_000, endedAt: now - 80 * 3_600_000 + 10 * 60_000, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note: '' },
    ]))
    const { unmount } = render(<App />)

    expect(document.querySelector('.stat-bottle')).toBeNull()
    expect(document.querySelector('.pump-stat')).toBeNull()
    expect(document.querySelector('.stat-feeds')).toBeNull()
    unmount()

    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'recent-bottle', type: 'bottle', startedAt: now - 5 * 3_600_000, endedAt: now - 5 * 3_600_000 + 10 * 60_000, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note: '' },
    ]))
    render(<App />)
    expect(document.querySelector('.stat-bottle')).toBeTruthy()
    expect(document.querySelector('.pump-stat')).toBeNull()
  })

  it('surfaces a due medicine as an actionable need', async () => {
    const user = userEvent.setup()
    const sevenHoursAgo = Date.now() - 7 * 3_600_000
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'med-1', kind: 'tylenol', at: sevenHoursAgo }]))
    render(<App />)

    expect(await screen.findByText(/Tylenol due/i)).toBeTruthy()
    expect(screen.getByText(/0 of 3 done/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Log Tylenol dose/i }))

    // the row flips to a completed state instead of disappearing
    expect(screen.queryByText(/Tylenol due/i)).toBeNull()
    const needsList = document.querySelector('.care-needs-list') as HTMLElement
    const doneRow = within(needsList).getByText(/^Tylenol$/i).closest('.care-need') as HTMLElement
    expect(doneRow.className).toContain('is-done')
    expect(doneRow.textContent).toMatch(/Given at/i)
    expect(screen.getByText(/1 of 3 done/i)).toBeTruthy()
    const saved = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]')
    expect(saved).toHaveLength(2)
  })
})
