import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const AUTH_TOKEN_KEY = 'baby-feeding-tracker:v1:auth-token'

// A never-settling fetch keeps the app in its resolving state for assertions.
const pendingForever = () => new Promise<never>(() => {})

describe('startup states', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('EventSource', class { close() {} addEventListener() {} })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps startup visually quiet while the session resolves', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-abc')
    vi.stubGlobal('fetch', vi.fn(pendingForever))

    render(<App />)

    const status = await screen.findByRole('status')
    expect(status.getAttribute('aria-label')).toBe('Opening Baby Feeding Tracker')
    expect(screen.queryByText(/Checking your session/i)).toBeNull()
    expect(screen.queryByRole('heading', { name: /Baby Feeding Tracker/i })).toBeNull()
  })

  it('lets the caregiver keep logging when the server is unreachable, and says so', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-abc')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))

    render(<App />)

    // Non-blocking: the tracker is still there to log into.
    await waitFor(() => expect(screen.getByText(/Working offline/i)).toBeTruthy())
    expect(screen.getByText(/keep logging/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Retry connecting/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Timeline/i })).toBeTruthy()
  })

  it('distinguishes a failed baby load from an empty household', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-abc')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) return { ok: true, status: 200, json: async () => ({ user: { id: 'u1', role: 'owner', mode: 'session' } }) }
      if (url.includes('/api/babies')) return { ok: false, status: 500, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => ({}) }
    }))

    render(<App />)

    await waitFor(() => expect(screen.getByText(/Couldn’t load this household’s babies/i)).toBeTruthy())
  })

  it('retries the failed load on demand and clears the notice on success', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-abc')
    let babiesFail = true
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) return { ok: true, status: 200, json: async () => ({ user: { id: 'u1', role: 'owner', mode: 'session' } }) }
      if (url.includes('/api/babies')) {
        if (babiesFail) return { ok: false, status: 500, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({ babies: [{ id: 'b1', name: 'Robin' }] }) }
      }
      return { ok: true, status: 200, json: async () => ({}) }
    }))

    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText(/Couldn’t load this household’s babies/i)).toBeTruthy())

    babiesFail = false
    await user.click(screen.getByRole('button', { name: /Retry connecting/i }))
    await waitFor(() => expect(screen.queryByText(/Couldn’t load this household’s babies/i)).toBeNull())
  })

  it('says nothing when startup succeeds', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-abc')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) return { ok: true, status: 200, json: async () => ({ user: { id: 'u1', role: 'owner', mode: 'session' } }) }
      if (url.includes('/api/babies')) return { ok: true, status: 200, json: async () => ({ babies: [{ id: 'b1', name: 'Robin' }] }) }
      return { ok: true, status: 200, json: async () => ({}) }
    }))

    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: /Timeline/i })).toBeTruthy())
    expect(screen.queryByText(/Working offline/i)).toBeNull()
  })
})
