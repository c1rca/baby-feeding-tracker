import { authFetch } from './authSession'

export type AuthUser = {
  id: string
  householdId?: string
  babyId?: string
  role?: string
  mode?: 'local' | 'session' | 'auth-bypass'
  email?: string
  displayName?: string
  needsOnboarding?: boolean
}

export type AuthSessionResult =
  | { kind: 'ok'; user: AuthUser | null }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }

export async function fetchAuthSession(): Promise<AuthSessionResult> {
  try {
    const response = await authFetch('/api/auth/me', { cache: 'no-store' })
    if (response.status === 401) return { kind: 'unauthorized' }
    if (!response.ok) return { kind: 'unavailable' }
    const data = await response.json() as { user?: AuthUser }
    return { kind: 'ok', user: data.user ?? null }
  } catch {
    return { kind: 'unavailable' }
  }
}

export type LoginResult = { ok: true; token: string } | { ok: false; error: string }
export type TextLoginRequestResult = { ok: true; maskedPhone: string } | { ok: false; error: string }
export type EmailLoginRequestResult = { ok: true; maskedEmail: string } | { ok: false; error: string }
export type SignupInput = { email: string }

export async function signupWithPassword(input: SignupInput): Promise<LoginResult> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await response.json().catch(() => null) as { token?: string; error?: string } | null
    if (!response.ok || !data?.token) return { ok: false, error: data?.error || 'Could not create account' }
    return { ok: true, token: data.token }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

export type OnboardingInput = { householdName: string; babyName: string; babyDob: string }
export type OnboardingResult = { ok: true } | { ok: false; error: string }

export async function createHouseholdForOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  try {
    const response = await authFetch('/api/households', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) return { ok: false, error: data?.error || 'Could not create household' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

export async function requestPasswordReset(email: string): Promise<{ ok: true; resetToken?: string } | { ok: false; error: string }> {
  const response = await fetch('/api/auth/password-reset/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) return { ok: false, error: data.error || 'Unable to request password reset' }
  return { ok: true, resetToken: data.resetToken }
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch('/api/auth/password-reset/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword }) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) return { ok: false, error: data.error || 'Unable to reset password' }
  return { ok: true }
}

export async function requestEmailLogin(email: string): Promise<EmailLoginRequestResult> {
  try {
    const response = await fetch('/api/auth/email/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await response.json().catch(() => null) as { ok?: boolean; maskedEmail?: string; error?: string } | null
    if (!response.ok || !data?.ok) return { ok: false, error: data?.error || 'Could not send your sign-in email' }
    return { ok: true, maskedEmail: data.maskedEmail || 'your email' }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

export async function requestTextLogin(phone: string): Promise<TextLoginRequestResult> {
  try {
    const response = await fetch('/api/auth/text/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await response.json().catch(() => null) as { ok?: boolean; maskedPhone?: string; error?: string } | null
    if (!response.ok || !data?.ok) return { ok: false, error: data?.error || 'Could not send your login text' }
    return { ok: true, maskedPhone: data.maskedPhone || 'your phone' }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

export async function confirmTextLogin(code: string): Promise<LoginResult> {
  try {
    const response = await fetch('/api/auth/text/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await response.json().catch(() => null) as { token?: string; error?: string } | null
    if (!response.ok || !data?.token) return { ok: false, error: data?.error || 'That code expired. Send a fresh one.' }
    return { ok: true, token: data.token }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json().catch(() => null) as { token?: string; error?: string } | null
    if (!response.ok || !data?.token) return { ok: false, error: data?.error || 'Sign in failed' }
    return { ok: true, token: data.token }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

export type PasswordChangeResult = { ok: true } | { ok: false; error: string }

export async function changePassword(currentPassword: string, newPassword: string): Promise<PasswordChangeResult> {
  try {
    const response = await authFetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) return { ok: false, error: data?.error || 'Could not update password' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

export async function logoutSession() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // The local token is cleared regardless, so a network failure only delays server-side revocation.
  }
}

export async function fetchGoogleAuthStatus(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/google/status', { cache: 'no-store' })
    if (!response.ok) return false
    const data = await response.json() as { available?: boolean }
    return data.available === true
  } catch {
    return false
  }
}
