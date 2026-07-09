import { useCallback, useEffect, useState } from 'react'
import { fetchAuthSession, loginWithPassword, logoutSession, signupWithPassword, type AuthUser, type SignupInput } from './authApi'
import { AUTH_UNAUTHORIZED_EVENT, clearAuthToken, consumeAuthCodeFromUrl, consumeAuthErrorFromUrl, hasPendingAuth, storeAuthToken } from './authSession'

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
      // A Google sign-in that bounced back with an error goes straight to the
      // login screen with a human-readable reason.
      const authError = consumeAuthErrorFromUrl()
      if (authError) {
        setError(authError)
        requireLogin()
        return
      }
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

  const completeTokenLogin = useCallback(async (token: string, fallbackError: string) => {
    storeAuthToken(token)
    const session = await fetchAuthSession()
    if (session.kind === 'unauthorized') {
      clearAuthToken()
      setError(fallbackError)
      setPending(false)
      return
    }
    setAuthUser(session.kind === 'ok' ? session.user : null)
    setPending(false)
    setError(null)
    setStatus('ready')
    setEpoch((value) => value + 1)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setPending(true)
    setError(null)
    const result = await loginWithPassword(email, password)
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    await completeTokenLogin(result.token, 'Sign in failed')
  }, [completeTokenLogin])

  const signup = useCallback(async (input: SignupInput) => {
    setPending(true)
    setError(null)
    const result = await signupWithPassword(input)
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    await completeTokenLogin(result.token, 'Account created, but sign in failed')
  }, [completeTokenLogin])

  const refreshAuth = useCallback(async () => {
    const session = await fetchAuthSession()
    if (session.kind === 'unauthorized') requireLogin()
    else if (session.kind === 'ok') setAuthUser(session.user)
    setEpoch((value) => value + 1)
  }, [requireLogin])

  const logout = useCallback(async () => {
    await logoutSession()
    requireLogin()
  }, [requireLogin])

  return { status, authUser, epoch, pending, error, login, signup, logout, refreshAuth }
}
