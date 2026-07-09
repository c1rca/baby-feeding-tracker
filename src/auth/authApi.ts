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
export type SignupInput = { email: string; password: string; displayName: string; householdName: string; babyName: string; babyDob: string }

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
