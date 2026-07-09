import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { setupAppTestEnvironment } from './appTestSetup'

const AUTH_TOKEN_KEY = 'baby-feeding-tracker:v1:auth-token'

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const bearerOf = (init?: RequestInit) => new Headers(init?.headers).get('authorization')

const localModeUser = { id: 'default-user', householdId: 'default-household', babyId: 'default-baby', role: 'owner', mode: 'local' }
const sessionModeUser = { id: 'default-user', householdId: 'default-household', babyId: 'default-baby', role: 'owner', mode: 'session' }
const emptyServerState = { entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-1' }

describe('App auth shell', () => {
  setupAppTestEnvironment()

  it('keeps local no-auth mode working without login prompts or logout button', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/me') return jsonResponse({ ok: true, user: localModeUser })
      if (url === '/api/notification-settings') return jsonResponse({ available: false, gotifyRemindersEnabled: false })
      if (url === '/api/state' && !init?.method) return jsonResponse(emptyServerState)
      return jsonResponse({ ok: true, updatedAt: 'server-2' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(screen.getByText(/Baby Feeding Tracker/i)).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' })))
    expect(screen.queryByLabelText(/Email/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /Sign out/i })).toBeNull()
    const stateCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/state')
    expect(bearerOf(stateCall?.[1])).toBeNull()
  })

  it('shows login when the API requires auth, then stores the token and hydrates with it', async () => {
    const user = userEvent.setup()
    const issuedToken = 'token-123'
    const authorized = (init?: RequestInit) => bearerOf(init) === `Bearer ${issuedToken}`
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/login' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { email?: string; password?: string }
        if (body.email === 'mom' && body.password === 'hunter22') {
          return jsonResponse({ ok: true, token: issuedToken, user: { id: 'default-user', email: body.email, displayName: 'Mom' } })
        }
        return jsonResponse({ ok: false, error: 'Invalid email or password' }, 401)
      }
      if (url === '/api/auth/me') return authorized(init) ? jsonResponse({ ok: true, user: sessionModeUser }) : jsonResponse({ ok: false, error: 'Authentication required' }, 401)
      if (url === '/api/notification-settings') return authorized(init) ? jsonResponse({ available: false, gotifyRemindersEnabled: false }) : jsonResponse({ ok: false }, 401)
      if (url === '/api/state' && !init?.method) return authorized(init) ? jsonResponse(emptyServerState) : jsonResponse({ ok: false }, 401)
      return authorized(init) ? jsonResponse({ ok: true, updatedAt: 'server-2' }) : jsonResponse({ ok: false }, 401)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { name: /Sign in/i })).toBeTruthy())
    expect(screen.getByText(/Forgot password/i)).toBeTruthy()
    expect(screen.getByText(/Use username mom or data in dev/i)).toBeTruthy()

    await user.type(screen.getByLabelText(/Username or email/i), 'mom')
    await user.type(screen.getByLabelText(/Password/i), 'hunter22')
    await user.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => expect(screen.getByText(/Baby Feeding Tracker/i)).toBeTruthy())
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe(issuedToken)

    await waitFor(() => {
      const authedStateCall = fetchMock.mock.calls.find(([input, callInit]) => String(input) === '/api/state' && !callInit?.method && authorized(callInit))
      expect(authedStateCall).toBeTruthy()
    })
    expect(screen.queryByLabelText(/Email/i)).toBeNull()
  })

  it('keeps the login form up with an error message after a failed login', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/login' && init?.method === 'POST') return jsonResponse({ ok: false, error: 'Invalid email or password' }, 401)
      return jsonResponse({ ok: false, error: 'Authentication required' }, 401)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { name: /Sign in/i })).toBeTruthy())
    await user.type(screen.getByLabelText(/Email/i), 'parent@example.com')
    await user.type(screen.getByLabelText(/Password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Invalid email or password/i))
    expect(screen.getByRole('heading', { name: /Sign in/i })).toBeTruthy()
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('lets a signed-in caregiver change password from polished account settings', async () => {
    const user = userEvent.setup()
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-123')
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/me') return jsonResponse({ ok: true, user: { ...sessionModeUser, email: 'mom', displayName: 'Mom' } })
      if (url === '/api/auth/password' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { currentPassword?: string; newPassword?: string }
        if (body.currentPassword === '1' && body.newPassword === 'new-secure-password') return jsonResponse({ ok: true })
        return jsonResponse({ ok: false, error: 'Current password is incorrect' }, 401)
      }
      if (url === '/api/babies') return jsonResponse({ babies: [{ id: 'default-baby', name: 'Ryan' }] })
      if (url === '/api/notification-settings') return jsonResponse({ available: false, gotifyRemindersEnabled: false })
      if (url === '/api/state' && !init?.method) return jsonResponse(emptyServerState)
      return jsonResponse({ ok: true, updatedAt: 'server-2' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await user.click(await screen.findByLabelText(/Show settings/i))
    expect(screen.getByText(/Account security/i)).toBeTruthy()
    expect(screen.getByText(/Signed in as mom/i)).toBeTruthy()
    await user.type(screen.getByLabelText(/Current password/i), '1')
    await user.type(screen.getByLabelText(/New password/i), 'new-secure-password')
    await user.click(screen.getByRole('button', { name: /Update password/i }))

    await waitFor(() => expect(screen.getAllByRole('status').some((node) => /Password updated/i.test(node.textContent || ''))).toBe(true))
    const passwordCall = fetchMock.mock.calls.find(([input, callInit]) => String(input) === '/api/auth/password' && callInit?.method === 'POST')
    expect(passwordCall).toBeTruthy()
    expect(bearerOf(passwordCall?.[1])).toBe('Bearer token-123')
  })

  it('signs out of an authenticated session, revokes it, and returns to login', async () => {
    const user = userEvent.setup()
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-123')
    let revoked = false
    const authorized = (init?: RequestInit) => !revoked && bearerOf(init) === 'Bearer token-123'
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/logout' && init?.method === 'POST') {
        revoked = true
        return jsonResponse({ ok: true })
      }
      if (url === '/api/auth/me') return authorized(init) ? jsonResponse({ ok: true, user: sessionModeUser }) : jsonResponse({ ok: false }, 401)
      if (url === '/api/notification-settings') return jsonResponse({ available: false, gotifyRemindersEnabled: false })
      if (url === '/api/state' && !init?.method) return authorized(init) ? jsonResponse(emptyServerState) : jsonResponse({ ok: false }, 401)
      return jsonResponse({ ok: true, updatedAt: 'server-2' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const signOutButton = await screen.findByRole('button', { name: /Sign out/i })
    await user.click(signOutButton)

    await waitFor(() => expect(screen.getByRole('heading', { name: /Sign in/i })).toBeTruthy())
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    const logoutCall = fetchMock.mock.calls.find(([input, callInit]) => String(input) === '/api/auth/logout' && callInit?.method === 'POST')
    expect(logoutCall).toBeTruthy()
    expect(bearerOf(logoutCall?.[1])).toBe('Bearer token-123')
  })

  it('returns to login when a protected API call is rejected mid-session', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-123')
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/me') return jsonResponse({ ok: true, user: sessionModeUser })
      if (url === '/api/notification-settings') return jsonResponse({ available: false, gotifyRemindersEnabled: false })
      if (url === '/api/state' && !init?.method) return jsonResponse({ ok: false, error: 'Invalid or expired session' }, 401)
      return jsonResponse({ ok: true, updatedAt: 'server-2' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { name: /Sign in/i })).toBeTruthy())
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })
})
