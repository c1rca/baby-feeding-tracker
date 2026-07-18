import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { setupAppTestEnvironment } from './appTestSetup'
import type { TummyTimeEvent } from './types'

const TUMMY_STORAGE_KEY = 'baby-feeding-tracker:v1:tummy-times'
const TUMMY_SESSION_STORAGE_KEY = 'baby-feeding-tracker:v1:tummy-session'

describe('care launcher timers', () => {
  setupAppTestEnvironment()

  it('keeps the visible launcher and saves a quick Tummy Time entry', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('group', { name: /Care action launcher/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^Tummy$/i }))
    await user.click(screen.getByRole('button', { name: /^5minutes$/i }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(TUMMY_STORAGE_KEY) ?? '[]')).toHaveLength(1))
    const saved = JSON.parse(localStorage.getItem(TUMMY_STORAGE_KEY) ?? '[]') as TummyTimeEvent[]
    expect(saved[0].endedAt - saved[0].startedAt).toBe(5 * 60_000)
  })

  it('offers compact pause/resume transport and Stop & save for active Tummy Time', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Tummy$/i }))
    await user.click(screen.getByRole('button', { name: /Start live timer/i }))
    expect(JSON.parse(localStorage.getItem(TUMMY_SESSION_STORAGE_KEY) ?? 'null')).toMatchObject({ note: '' })
    expect(screen.getByRole('button', { name: /Pause Tummy Time timer/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Pause Tummy Time timer/i }))
    expect(screen.getByRole('button', { name: /Resume Tummy Time timer/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Resume Tummy Time timer/i }))
    await user.click(screen.getByRole('button', { name: /^Stop & save Tummy Time$/i }))
    await user.click(screen.getByRole('button', { name: /^Confirm save Tummy Time$/i }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(TUMMY_STORAGE_KEY) ?? '[]')).toHaveLength(1))
    expect(JSON.parse(localStorage.getItem(TUMMY_SESSION_STORAGE_KEY) ?? 'null')).toBeNull()
  })

  it('keeps the active timer duration and care mode label in explicit responsive no-wrap elements', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Tummy$/i }))
    await user.click(screen.getByRole('button', { name: /Start live timer/i }))

    expect(document.querySelector('.timer-value')).toBeTruthy()
    expect(document.querySelector('.timer-display-row--balanced')).toBeTruthy()
    expect(document.querySelector('.timer-display-row .timer-mode-pill')).toBeTruthy()
  })

  it('left-aligns a feed timer when there is no care-mode label', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Start suggested side/i }))
    expect(document.querySelector('.timer-display-row--feed')).toBeTruthy()
    expect(document.querySelector('.timer-display-row--feed .timer-shell.is-live + .transport-toggle')).toBeTruthy()
  })

  it('starts Sleep directly from its visible launcher and exposes the same transport', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Sleep$/i }))
    expect(screen.getByRole('button', { name: /Pause Sleep timer/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Pause Sleep timer/i }))
    expect(screen.getByRole('button', { name: /Resume Sleep timer/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Resume Sleep timer/i }))
    expect(screen.getByRole('button', { name: /Pause Sleep timer/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^Stop & save Sleep$/i }))
    expect(screen.getByRole('button', { name: /^Confirm save Sleep$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Pause Sleep timer/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^Confirm save Sleep$/i }))
    expect(screen.getByText(/Sleep saved/i)).toBeTruthy()
  })

  it('edits a saved Sleep entry from the timeline without it vanishing (regression: 12h start-time prefill parsed to NaN)', async () => {
    // Seed a recent completed sleep entry with minute-aligned times so the
    // clock-input round-trip is exact. Opening its editor pre-fills the
    // start-time field with a 12h clock string ("2:05 PM" in this locale);
    // saving that used to parse to NaN, wiping the entry from the timeline and
    // persisting a null-timestamp row. Saving the untouched prefill must keep
    // the entry intact and visible.
    const nowMinute = Math.floor(Date.now() / 60_000) * 60_000
    const startedAt = nowMinute - 60 * 60_000
    const endedAt = nowMinute - 30 * 60_000
    localStorage.setItem(TUMMY_STORAGE_KEY, JSON.stringify([{ id: 'sleep-edit', startedAt, endedAt, note: 'afternoon nap', kind: 'sleep' }]))
    const user = userEvent.setup()
    render(<App />)

    const sleepItem = screen.getAllByRole('listitem')[0]
    await user.click(within(sleepItem).getByRole('button', { name: /Tummy Time actions/i }))
    await user.click(within(sleepItem).getByRole('menuitem', { name: /Edit Tummy Time/i }))

    // Save with the prefilled 12h times untouched — the exact break the user hit.
    await user.click(screen.getByRole('button', { name: /Save Tummy Time/i }))

    expect(screen.getByText(/Sleep updated/i)).toBeTruthy()
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(TUMMY_STORAGE_KEY) ?? '[]') as TummyTimeEvent[]
      expect(saved).toHaveLength(1)
      expect(saved[0].startedAt).toBe(startedAt)
      expect(saved[0].endedAt).toBe(endedAt)
    })
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('resumes a recent saved Sleep session from the timeline', async () => {
    const endedAt = Date.now()
    localStorage.setItem(TUMMY_STORAGE_KEY, JSON.stringify([{ id: 'sleep-resume', startedAt: endedAt - 20 * 60_000, endedAt, note: 'night nap', kind: 'sleep' }]))
    const user = userEvent.setup()
    render(<App />)

    const sleepItem = screen.getAllByRole('listitem')[0]
    await user.click(within(sleepItem).getByRole('button', { name: /Tummy Time actions/i }))
    await user.click(within(sleepItem).getByRole('menuitem', { name: /Resume Sleep session/i }))

    expect(screen.getByText(/Sleep resumed/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Pause Sleep timer/i })).toBeTruthy()
    expect(screen.queryByText('night nap')).toBeNull()
  })
})
