import { useCallback, useEffect, useState } from 'react'
import { fetchAuthSession, loginWithPassword, logoutSession, type AuthUser } from './authApi'
import { AUTH_UNAUTHORIZED_EVENT, clearAuthToken, storeAuthToken } from './authSession'

type AuthGateStatus = 'ready' | 'login'

export function useAuthGate() {
  const [status, setStatus] = useState<AuthGateStatus>('ready')
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
    void fetchAuthSession().then((result) => {
      if (cancelled) return
      if (result.kind === 'unauthorized') requireLogin()
      else if (result.kind === 'ok') setAuthUser(result.user)
    })
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
