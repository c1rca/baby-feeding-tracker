import { render, screen, waitFor } from '@testing-library/react'
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
    expect(document.querySelector('.timer-display-row--feed .timer-mode-pill')).toBeNull()
  })

  it('starts Sleep directly from its visible launcher and exposes the same transport', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Sleep$/i }))
    expect(screen.getByRole('button', { name: /Pause Sleep timer/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Pause Sleep timer/i }))
    expect(screen.getByRole('button', { name: /Resume Sleep timer/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^Stop & save Sleep$/i }))
    expect(screen.getByText(/Sleep saved/i)).toBeTruthy()
  })
})
