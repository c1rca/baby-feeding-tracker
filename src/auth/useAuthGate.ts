import { useCallback, useEffect, useState } from 'react'
import { fetchAuthSession, loginWithPassword, loginWithPasskey, logoutSession, signupWithPassword, confirmTextLogin, redeemHouseholdInvite, type AuthUser, type SignupInput } from './authApi'
import { AUTH_UNAUTHORIZED_EVENT, clearAuthToken, consumeAuthCodeFromUrl, consumeAuthErrorFromUrl, consumeInviteTokenFromUrl, hasPendingAuth, storeAuthToken } from './authSession'

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
  const [sessionUnavailable, setSessionUnavailable] = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  const [inviteToken, setInviteToken] = useState<string | null>(() => consumeInviteTokenFromUrl())

  const requireLogin = useCallback(() => {
    clearAuthToken()
    setAuthUser(null)
    setStatus('login')
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setSessionUnavailable(false)
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
        // The server being unreachable must not block entry — local data and
        // the offline queue are the point of this app. It is surfaced instead
        // so the state is visible rather than silently anonymous.
        setSessionUnavailable(result.kind === 'unavailable')
        setStatus('ready')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [requireLogin, retryTick])

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

  const acceptInvite = useCallback(async (email: string, password: string, displayName: string) => {
    if (!inviteToken) return
    setPending(true)
    setError(null)
    const result = await redeemHouseholdInvite({ token: inviteToken, email, password, displayName })
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    setInviteToken(null)
    await completeTokenLogin(result.token, 'Invite accepted, but sign in failed')
  }, [completeTokenLogin, inviteToken])

  const loginPasskey = useCallback(async (staySignedIn: boolean) => {
    setPending(true); setError(null)
    const result = await loginWithPasskey(staySignedIn)
    if (!result.ok) { setError(result.error); setPending(false); return }
    await completeTokenLogin(result.token, 'Passkey sign-in failed')
  }, [completeTokenLogin])

  const loginWithTextCode = useCallback(async (code: string) => {
    setPending(true)
    setError(null)
    const result = await confirmTextLogin(code)
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    await completeTokenLogin(result.token, 'Text sign-in failed')
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

  const retrySession = useCallback(() => {
    setStatus('checking')
    setRetryTick((value) => value + 1)
  }, [])

  return { status, authUser, epoch, pending, error, sessionUnavailable, inviteToken, retrySession, login, acceptInvite, loginPasskey, loginWithTextCode, signup, logout, refreshAuth }
}
