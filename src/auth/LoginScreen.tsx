import { Baby } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { confirmPasswordReset, fetchGoogleAuthStatus, requestPasswordReset } from './authApi'

type LoginScreenProps = {
  pending: boolean
  error: string | null
  onLogin: (email: string, password: string) => void
  onSignup: (input: { email: string; password: string; displayName: string; householdName: string; babyName: string; babyDob: string }) => void
}

export function LoginScreen({ pending, error, onLogin, onSignup }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetStatus, setResetStatus] = useState<string | null>(null)
  const [resetPending, setResetPending] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [babyName, setBabyName] = useState('')
  const [babyDob, setBabyDob] = useState('')
  const [googleAvailable, setGoogleAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchGoogleAuthStatus().then((available) => {
      if (!cancelled) setGoogleAvailable(available)
    })
    return () => { cancelled = true }
  }, [])

  const handleResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setResetPending(true)
    setResetStatus(null)
    const result = await requestPasswordReset(email)
    setResetPending(false)
    if (!result.ok) {
      setResetStatus(result.error)
      return
    }
    if (result.resetToken) setResetStatus(`Reset token ready: ${result.resetToken}`)
    else setResetStatus('If that email has an account, a reset link is on the way.')
  }

  const handleResetConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setResetPending(true)
    setResetStatus(null)
    const result = await confirmPasswordReset(resetToken, newPassword)
    setResetPending(false)
    if (!result.ok) {
      setResetStatus(result.error)
      return
    }
    setResetStatus('Password reset complete. You can sign in now.')
    setPassword('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mode === 'signup') onSignup({ email, password, displayName, householdName, babyName, babyDob })
    else onLogin(email, password)
  }

  return (
    <main className="app auth-screen">
      <div className="bg-scene" aria-hidden="true">
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
        <div className="stars" />
        <div className="stars stars-2" />
      </div>
      <section className="card login-card">
        <h1><span className="brand-mark"><Baby size={22} /></span> Baby Feeding Tracker</h1>
        <h2>{mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in'}</h2>
        <p className="login-meta">Private, synced care notes for your household.</p>
        {googleAvailable ? (
          <a className="google-sign-in-button" href="/api/auth/google/start" aria-label="Sign in with Google">
            <span className="google-g-mark" aria-hidden="true">G</span>
            <span>Sign in with Google</span>
          </a>
        ) : null}
        {googleAvailable ? <div className="login-divider"><span>or use password</span></div> : null}
        {mode === 'reset' ? (
          <>
            <form onSubmit={handleResetRequest}>
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <button type="submit" disabled={resetPending}>{resetPending ? 'Sending…' : 'Send reset link'}</button>
            </form>
            <form onSubmit={handleResetConfirm}>
              <label>Reset token<input type="text" value={resetToken} onChange={(event) => setResetToken(event.target.value)} required /></label>
              <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
              <button type="submit" disabled={resetPending}>{resetPending ? 'Resetting…' : 'Reset password'}</button>
            </form>
            {resetStatus ? <p className="login-meta" role="status">{resetStatus}</p> : null}
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>{mode === 'signup' ? 'Email' : 'Username or email'}<input type="text" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {mode === 'signup' ? (
              <>
                <label>Your name<input type="text" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
                <label>Household name<input type="text" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} required /></label>
                <label>Baby name<input type="text" value={babyName} onChange={(event) => setBabyName(event.target.value)} required /></label>
                <label>Baby date of birth<input type="date" value={babyDob} onChange={(event) => setBabyDob(event.target.value)} required /></label>
              </>
            ) : null}
            {error ? <p className="login-error" role="alert">{error}</p> : null}
            <button type="submit" disabled={pending}>{pending ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : (mode === 'signup' ? 'Start tracking' : 'Sign in')}</button>
          </form>
        )}
        <button className="auth-mode-toggle" type="button" onClick={() => setMode(mode === 'signup' || mode === 'reset' ? 'login' : 'signup')}>{mode === 'signup' || mode === 'reset' ? 'I already have an account' : 'Create account'}</button>
        {mode === 'login' ? <button className="auth-mode-toggle" type="button" onClick={() => setMode('reset')}>Forgot password</button> : null}
        <div className="login-help">
          <strong>Need help signing in?</strong>
          <span>Create a reset token, then set a new password.</span>
        </div>
      </section>
    </main>
  )
}
