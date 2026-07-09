import { useCallback, useEffect, useState } from 'react'
import { fetchAuthSession, loginWithPassword, logoutSession, type AuthUser } from './authApi'
import { AUTH_UNAUTHORIZED_EVENT, clearAuthToken, consumeAuthCodeFromUrl, hasPendingAuth, storeAuthToken } from './authSession'

type AuthGateStatus = 'checking' | 'ready' | 'login'

export function useAuthGate() {
  // When a token is stored or a Google handoff code is arriving, hold rendering
  // until /api/auth/me resolves so the tracker never fires an unauthenticated
  // request (whose 401 would wipe the token we are about to establish).
  const [status, setStatus] = useState<AuthGateStatus>(() => (hasPendingAuth() ? 'checking' : 'ready'))
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [epoch, setEpoch] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requireLogin = useCallback(() => {
    clearAuthToken()
    setAuthUser(null)
    setStatus('login')
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Exchange a Google handoff code (if present in the URL fragment) for a
      // stored session token before asking the server who we are.
      await consumeAuthCodeFromUrl()
      const result = await fetchAuthSession()
      if (cancelled) return
      if (result.kind === 'unauthorized') requireLogin()
      else {
        if (result.kind === 'ok') setAuthUser(result.user)
        setStatus('ready')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [requireLogin])

  useEffect(() => {
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, requireLogin)
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, requireLogin)
  }, [requireLogin])

  const login = useCallback(async (email: string, password: string) => {
    setPending(true)
    setError(null)
    const result = await loginWithPassword(email, password)
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    storeAuthToken(result.token)
    const session = await fetchAuthSession()
    if (session.kind === 'unauthorized') {
      clearAuthToken()
      setError('Sign in failed')
      setPending(false)
      return
    }
    setAuthUser(session.kind === 'ok' ? session.user : null)
    setPending(false)
    setError(null)
    setStatus('ready')
    setEpoch((value) => value + 1)
  }, [])

  const logout = useCallback(async () => {
    await logoutSession()
    requireLogin()
  }, [requireLogin])

  return { status, authUser, epoch, pending, error, login, logout }
}
