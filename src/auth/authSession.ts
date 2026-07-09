export const KEY_AUTH_TOKEN = 'baby-feeding-tracker:v1:auth-token'
export const AUTH_UNAUTHORIZED_EVENT = 'baby-feeding-tracker:auth-unauthorized'

export const readAuthToken = (): string | null => {
  try {
    return localStorage.getItem(KEY_AUTH_TOKEN)
  } catch {
    return null
  }
}

export const storeAuthToken = (token: string) => {
  try {
    localStorage.setItem(KEY_AUTH_TOKEN, token)
  } catch {
    // The session still works for this visit even if persistence fails.
  }
}

export const clearAuthToken = () => {
  try {
    localStorage.removeItem(KEY_AUTH_TOKEN)
  } catch {
    // Nothing stored means nothing to clear.
  }
}

// True when the very first render should wait for the session to resolve: a
// token is already stored, or a Google handoff code is present in the fragment.
export const hasPendingAuth = (): boolean => {
  try {
    if (readAuthToken()) return true
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    return new URLSearchParams(hash).has('auth_code')
  } catch {
    return false
  }
}

const stripAuthParamsFromUrl = () => {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('auth_token')
    url.searchParams.delete('auth_error')
    url.hash = ''
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  } catch {
    // A history failure is cosmetic; the token is already stored.
  }
}

// The Google callback returns a single-use code in the URL fragment (never sent
// to the server). We exchange it for the real session token over POST so the
// token itself never appears in a URL, browser history, or access log.
export const consumeAuthCodeFromUrl = async (): Promise<boolean> => {
  let code: string | null
  try {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    code = new URLSearchParams(hash).get('auth_code')
  } catch {
    return false
  }
  if (!code) return false
  let stored = false
  try {
    const response = await fetch('/api/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await response.json().catch(() => null) as { token?: string } | null
    if (response.ok && data?.token) {
      storeAuthToken(data.token)
      stored = true
    }
  } catch {
    // Leave the user on the login screen; the code is stripped below regardless.
  }
  stripAuthParamsFromUrl()
  return stored
}

// Without a stored token, calls pass through to fetch with identical arguments
// so local no-auth mode behaves exactly as before the auth shell existed.
export async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const token = readAuthToken()
  let response: Response
  if (token) {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    response = await fetch(input, { ...init, headers })
  } else {
    response = init === undefined ? await fetch(input) : await fetch(input, init)
  }
  if (response.status === 401) window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
  return response
}
