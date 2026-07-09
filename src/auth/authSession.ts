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

export const consumeAuthTokenFromUrl = (): boolean => {
  try {
    const url = new URL(window.location.href)
    const token = url.searchParams.get('auth_token')
    if (!token) return false
    storeAuthToken(token)
    url.searchParams.delete('auth_token')
    url.searchParams.delete('auth_error')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    return true
  } catch {
    return false
  }
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
