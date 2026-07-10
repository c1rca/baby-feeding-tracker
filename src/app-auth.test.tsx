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
      if (url === '/api/auth/google/status') return jsonResponse({ ok: true, available: true })
      if (url === '/api/auth/login' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { email?: string; password?: string }
        if (body.email === 'mom@example.com' && body.password === 'hunter22') {
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
    await waitFor(() => expect(screen.getByRole('link', { name: /Sign in with Google/i }).getAttribute('href')).toBe('/api/auth/google/start'))
    expect(screen.getByText(/Use password instead/i)).toBeTruthy()
    expect(screen.queryByText(/Use username mom or data in dev/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /use password instead/i }))
    await user.type(screen.getByLabelText(/Email/i), 'mom@example.com')
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

  it('exchanges a Google callback code from the URL fragment and hydrates the authenticated app', async () => {
    window.history.replaceState({}, '', '/#auth_code=handoff-code')
    const authorized = (init?: RequestInit) => bearerOf(init) === 'Bearer google-token'
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/google/exchange' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { code?: string }
        if (body.code === 'handoff-code') return jsonResponse({ ok: true, token: 'google-token', user: { id: 'default-user' } })
        return jsonResponse({ ok: false, error: 'Invalid or expired code' }, 401)
      }
      if (url === '/api/auth/me') return authorized(init) ? jsonResponse({ ok: true, user: sessionModeUser }) : jsonResponse({ ok: false }, 401)
      if (url === '/api/notification-settings') return jsonResponse({ available: false, gotifyRemindersEnabled: false })
      if (url === '/api/state' && !init?.method) return authorized(init) ? jsonResponse(emptyServerState) : jsonResponse({ ok: false }, 401)
      return jsonResponse({ ok: true, updatedAt: 'server-2' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('google-token'))
    expect(window.location.hash).not.toContain('auth_code')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store', headers: expect.any(Headers) })))
  })

  it('surfaces a Google sign-in error from the URL on the login screen', async () => {
    window.history.replaceState({}, '', '/?auth_error=not_invited')
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/auth/google/status') return jsonResponse({ ok: true, available: true })
      return jsonResponse({ ok: false, error: 'Authentication required' }, 401)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not on the invite list/i))
    expect(screen.getByRole('heading', { name: /Sign in/i })).toBeTruthy()
    expect(window.location.search).not.toContain('auth_error')
  })

  it('requests a text magic link, confirms a code, and celebrates instant login', async () => {
    const user = userEvent.setup()
    const issuedToken = 'text-token'
    const authorized = (init?: RequestInit) => bearerOf(init) === `Bearer ${issuedToken}`
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/google/status') return jsonResponse({ ok: true, available: false })
      if (url === '/api/auth/text/request' && init?.method === 'POST') return jsonResponse({ ok: true, maskedPhone: '••• ••• 4567' })
      if (url === '/api/auth/text/confirm' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { code?: string }
        return body.code === '123456' ? jsonResponse({ ok: true, token: issuedToken, user: { id: 'phone-user' } }) : jsonResponse({ ok: false, error: 'Invalid or expired code' }, 401)
      }
      if (url === '/api/auth/me') return authorized(init) ? jsonResponse({ ok: true, user: sessionModeUser }) : jsonResponse({ ok: false }, 401)
      if (url === '/api/babies') return authorized(init) ? jsonResponse({ babies: [{ id: 'default-baby', name: 'Ryan' }] }) : jsonResponse({ ok: false }, 401)
      if (url === '/api/notification-settings') return authorized(init) ? jsonResponse({ available: false, gotifyRemindersEnabled: false }) : jsonResponse({ ok: false }, 401)
      if (url === '/api/state' && !init?.method) return authorized(init) ? jsonResponse(emptyServerState) : jsonResponse({ ok: false }, 401)
      return authorized(init) ? jsonResponse({ ok: true, updatedAt: 'server-2' }) : jsonResponse({ ok: false }, 401)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { name: /Sign in/i })).toBeTruthy())
    expect(screen.getByText(/Send my sign-in link/i)).toBeTruthy()
    expect(screen.queryByLabelText(/Password/i)).toBeNull()
    await user.type(screen.getByLabelText(/Mobile number or email/i), '5551234567')
    await user.click(screen.getByRole('button', { name: /Send my sign-in link/i }))
    expect(await screen.findByText(/sent to ••• ••• 4567/i)).toBeTruthy()
    await user.type(screen.getByLabelText(/6-digit code/i), '123456')
    await user.click(screen.getByRole('button', { name: /Open tracker/i }))

    await waitFor(() => expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe(issuedToken))
    await waitFor(() => expect(screen.getByText(/Baby Feeding Tracker/i)).toBeTruthy())
  })

  it('exchanges a text magic-link code from the URL fragment with polished return copy', async () => {
    window.location.hash = '#text_code=654321'
    const authorized = (init?: RequestInit) => bearerOf(init) === 'Bearer text-token-from-link'
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/text/confirm' && init?.method === 'POST') return jsonResponse({ ok: true, token: 'text-token-from-link', user: { id: 'phone-user' } })
      if (url === '/api/auth/me') return authorized(init) ? jsonResponse({ ok: true, user: sessionModeUser }) : jsonResponse({ ok: false }, 401)
      if (url === '/api/babies') return jsonResponse({ babies: [{ id: 'default-baby', name: 'Ryan' }] })
      if (url === '/api/notification-settings') return jsonResponse({ available: false, gotifyRemindersEnabled: false })
      if (url === '/api/state' && !init?.method) return authorized(init) ? jsonResponse(emptyServerState) : jsonResponse({ ok: false }, 401)
      return jsonResponse({ ok: true, updatedAt: 'server-2' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('text-token-from-link'))
    expect(window.location.hash).not.toContain('text_code')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store', headers: expect.any(Headers) })))
  })

  it('creates a new household from the sign-up form and hydrates the signed-in app', async () => {
    const user = userEvent.setup()
    const issuedToken = 'signup-token'
    const authorized = (init?: RequestInit) => bearerOf(init) === `Bearer ${issuedToken}`
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/google/status') return jsonResponse({ ok: true, available: false })
      if (url === '/api/auth/me') return authorized(init) ? jsonResponse({ ok: true, user: sessionModeUser }) : jsonResponse({ ok: false }, 401)
      if (url === '/api/auth/email/request' && init?.method === 'POST') return jsonResponse({ ok: true, maskedEmail: 'ne•••@example.com' })
      if (url === '/api/auth/text/confirm' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { code?: string }
        return body.code === '222333' ? jsonResponse({ ok: true, token: issuedToken, user: { id: 'new-user' } }) : jsonResponse({ ok: false }, 401)
      }
      if (url === '/api/babies') return authorized(init) ? jsonResponse({ babies: [{ id: 'baby-new', name: 'Ryan' }] }) : jsonResponse({ ok: false }, 401)
      if (url === '/api/notification-settings') return jsonResponse({ available: false, gotifyRemindersEnabled: false })
      if (url === '/api/state' && !init?.method) return authorized(init) ? jsonResponse(emptyServerState) : jsonResponse({ ok: false }, 401)
      return jsonResponse({ ok: true, updatedAt: 'server-2' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await user.click(await screen.findByRole('button', { name: /Create account/i }))
    await user.type(screen.getByLabelText(/Mobile number or email/i), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /Send my sign-in link/i }))
    expect(await screen.findByText(/sent to ne•••@example.com/i)).toBeTruthy()
    await user.type(screen.getByLabelText(/6-digit code/i), '222333')
    await user.click(screen.getByRole('button', { name: /Open tracker/i }))

    await waitFor(() => expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe(issuedToken))
    const signupCall = fetchMock.mock.calls.find(([input, callInit]) => String(input) === '/api/auth/email/request' && callInit?.method === 'POST')
    expect(signupCall).toBeTruthy()
    expect(JSON.parse(String(signupCall?.[1]?.body))).toEqual({ email: 'new@example.com' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store', headers: expect.any(Headers) })))
  })

  it('onboards an authenticated householdless user before loading tracker state', async () => {
    const user = userEvent.setup()
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-123')
    localStorage.setItem('baby-feeding-tracker:v1:selected-baby-id', 'stale-baby')
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync', '1')
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync-baby', 'stale-baby')
    let onboarded = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/me') return jsonResponse({ ok: true, user: onboarded ? { ...sessionModeUser, householdId: 'hh-new', babyId: 'baby-new' } : { id: 'new-user', mode: 'session', email: 'new@example.com', needsOnboarding: true } })
      if (url === '/api/households' && init?.method === 'POST') { onboarded = true; return jsonResponse({ ok: true, household: { id: 'hh-new', name: 'Home' }, baby: { id: 'baby-new', name: 'Ryan', dob: '2026-06-03' } }, 201) }
      if (url === '/api/babies') return jsonResponse({ babies: [{ id: 'baby-new', name: 'Ryan' }] })
      if (url === '/api/notification-settings') return jsonResponse({ available: false, gotifyRemindersEnabled: false })
      if (url === '/api/state' && !init?.method) {
        if (!onboarded) return jsonResponse({ ok: false, error: 'needs_household' }, 403)
        return new Headers(init?.headers).get('x-baby-id') === 'stale-baby' ? jsonResponse({ ok: false, error: 'Baby not found' }, 404) : jsonResponse(emptyServerState)
      }
      return jsonResponse({ ok: true, updatedAt: 'server-2' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { name: /Set up your household/i })).toBeTruthy())
    await user.type(screen.getByLabelText(/Household name/i), 'Home')
    await user.type(screen.getByLabelText(/Baby name/i), 'Ryan')
    await user.type(screen.getByLabelText(/Baby date of birth/i), '2026-06-03')
    await user.click(screen.getByRole('button', { name: /Create household/i }))

    await waitFor(() => expect(onboarded).toBe(true))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store', headers: expect.any(Headers) })))
    const stateCall = fetchMock.mock.calls.find(([input, init]) => String(input) === '/api/state' && !init?.method)
    expect(new Headers(stateCall?.[1]?.headers).get('x-baby-id')).toBe('baby-new')
    expect(screen.queryByText(/Offline changes saved/i)).toBeNull()
    expect(screen.getByLabelText(/Sync status: Online/i)).toBeTruthy()
  })

  it('requests and confirms a password reset from the login screen', async () => {
    const user = userEvent.setup()
    const requests: Array<{ url: string; body: unknown }> = []
    const authorized = () => false
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : null
      if (url === '/api/auth/me') return jsonResponse({ ok: false }, 401)
      if (url === '/api/auth/google/status') return jsonResponse({ ok: true, available: false })
      if (url === '/api/auth/password-reset/request') {
        requests.push({ url, body })
        return jsonResponse({ ok: true, resetToken: 'reset-dev-token' })
      }
      if (url === '/api/auth/password-reset/confirm') {
        requests.push({ url, body })
        return jsonResponse({ ok: true })
      }
      if (url === '/api/state') return authorized() ? jsonResponse(emptyServerState) : jsonResponse({ ok: false }, 401)
      return jsonResponse({ ok: false }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await screen.findByRole('heading', { name: /sign in/i })
    await user.click(screen.getByRole('button', { name: /use password instead/i }))
    await user.click(screen.getByRole('button', { name: /forgot password/i }))
    await user.type(screen.getByLabelText(/^Email$/i), 'parent@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(await screen.findByText(/reset token ready/i)).toBeTruthy()
    await user.type(screen.getByLabelText(/reset token/i), 'reset-dev-token')
    await user.type(screen.getByLabelText(/new password/i), 'new-reset-password')
    await user.click(screen.getByRole('button', { name: /set password/i }))
    expect(await screen.findByText(/password reset complete/i)).toBeTruthy()
    expect(requests).toEqual([
      { url: '/api/auth/password-reset/request', body: { email: 'parent@example.com' } },
      { url: '/api/auth/password-reset/confirm', body: { token: 'reset-dev-token', newPassword: 'new-reset-password' } },
    ])
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
    await user.click(screen.getByRole('button', { name: /use password instead/i }))
    await user.type(screen.getByLabelText(/Email/i), 'parent@example.com')
    await user.type(screen.getByLabelText(/Password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Invalid email or password/i))
    expect(screen.getByRole('heading', { name: /Sign in/i })).toBeTruthy()
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('lets an owner invite caregivers, revoke pending invites, and demote members from settings', async () => {
    const user = userEvent.setup()
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-123')
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/me') return jsonResponse({ ok: true, user: { ...sessionModeUser, email: 'owner@example.com', displayName: 'Owner' } })
      if (url === '/api/babies') return jsonResponse({ babies: [{ id: 'default-baby', name: 'Ryan' }] })
      if (url === '/api/household-members') return jsonResponse({ members: [
        { userId: 'owner', email: 'owner@example.com', displayName: 'Owner', role: 'owner', createdAt: '2026-01-01T00:00:00.000Z' },
        { userId: 'helper', email: 'helper@example.com', displayName: 'Helper', role: 'caregiver', createdAt: '2026-01-02T00:00:00.000Z' },
      ] })
      if (url === '/api/household-invites' && !init?.method) return jsonResponse({ invites: [{ id: 'invite-1', email: 'old@example.com', role: 'viewer', expiresAt: '2026-12-01T00:00:00.000Z' }] })
      if (url === '/api/household-invites' && init?.method === 'POST') return jsonResponse({ ok: true, invite: { id: 'invite-2', email: 'new@example.com', role: 'caregiver', token: 'invite-token', expiresAt: '2026-12-02T00:00:00.000Z' } }, 201)
      if (url === '/api/household-invites/invite-1' && init?.method === 'DELETE') return jsonResponse({ ok: true })
      if (url === '/api/household-members/helper' && init?.method === 'PATCH') return jsonResponse({ ok: true })
      if (url === '/api/notification-settings') return jsonResponse({ available: false, gotifyRemindersEnabled: false })
      if (url === '/api/state' && !init?.method) return jsonResponse(emptyServerState)
      return jsonResponse({ ok: true, updatedAt: 'server-2' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await user.click(await screen.findByLabelText(/Show settings/i))
    await user.click(screen.getByRole('tab', { name: /Household/i }))
    expect(await screen.findByText(/Household access/i)).toBeTruthy()
    expect(screen.getByText(/old@example.com/i)).toBeTruthy()
    await user.type(screen.getByLabelText(/Invite email/i), 'new@example.com')
    await user.selectOptions(screen.getByLabelText(/Invite role/i), 'caregiver')
    await user.click(screen.getByRole('button', { name: /Send invite/i }))
    await waitFor(() => expect(screen.getByText(/invite-token/i)).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /Revoke invite for old@example.com/i }))
    await user.selectOptions(screen.getByLabelText(/Role for helper@example.com/i), 'viewer')

    expect(fetchMock.mock.calls.some(([input, init]) => String(input) === '/api/household-invites' && init?.method === 'POST' && bearerOf(init) === 'Bearer token-123')).toBe(true)
    expect(fetchMock.mock.calls.some(([input, init]) => String(input) === '/api/household-invites/invite-1' && init?.method === 'DELETE')).toBe(true)
    const roleCall = fetchMock.mock.calls.find(([input, init]) => String(input) === '/api/household-members/helper' && init?.method === 'PATCH')
    expect(roleCall).toBeTruthy()
    expect(JSON.parse(String(roleCall?.[1]?.body))).toEqual({ role: 'viewer' })
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
    await user.click(screen.getByRole('tab', { name: /Account/i }))
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

    await user.click(await screen.findByLabelText(/Show settings/i))
    await user.click(await screen.findByRole('tab', { name: /Account/i }))
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
