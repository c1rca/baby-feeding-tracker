import { authFetch } from './authSession'

export type AuthUser = {
  id: string
  householdId?: string
  babyId?: string
  role?: string
  mode?: 'local' | 'session'
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

export async function logoutSession() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // The local token is cleared regardless, so a network failure only delays server-side revocation.
  }
}
