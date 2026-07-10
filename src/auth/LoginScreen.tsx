import { Baby } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { confirmPasswordReset, fetchGoogleAuthStatus, requestPasswordReset, requestTextLogin } from './authApi'

type LoginScreenProps = {
  pending: boolean
  error: string | null
  onLogin: (email: string, password: string) => void
  onTextLogin: (code: string) => void
  onSignup: (input: { email: string; password: string; displayName: string; householdName: string; babyName: string; babyDob: string }) => void
}

export function LoginScreen({ pending, error, onLogin, onTextLogin, onSignup }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'password'>('login')
  const [phone, setPhone] = useState('')
  const [textCode, setTextCode] = useState('')
  const [textStatus, setTextStatus] = useState<string | null>(null)
  const [textPending, setTextPending] = useState(false)
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

  const handleTextRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTextPending(true)
    setTextStatus(null)
    const result = await requestTextLogin(phone)
    setTextPending(false)
    if (!result.ok) {
      setTextStatus(result.error)
      return
    }
    setTextStatus(`Magic link sent to ${result.maskedPhone}. Tap the link or paste the 6-digit code.`)
  }

  const handleTextConfirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onTextLogin(textCode)
  }

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
        <h2>{mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : mode === 'password' ? 'Password sign in' : 'Welcome back — Sign in'}</h2>
        <p className="login-meta">Tap once. Text arrives. You’re in — no passwords, no friction.</p>
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
        ) : mode === 'login' ? (
          <div className="text-login-flow">
            <div className="magic-login-glow" aria-hidden="true">✦</div>
            <form onSubmit={handleTextRequest}>
              <label>Mobile number<input type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 123-4567" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
              <button className="primary-magic-button" type="submit" disabled={textPending}>{textPending ? 'Sending the magic…' : 'Text me a magic link'}</button>
            </form>
            {textStatus ? <p className="login-meta magic-status" role="status">{textStatus}</p> : null}
            <form onSubmit={handleTextConfirm} className="code-card">
              <label>6-digit code<input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} value={textCode} onChange={(event) => setTextCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
              {error ? <p className="login-error" role="alert">{error}</p> : null}
              <button type="submit" disabled={pending || textCode.length < 6}>{pending ? 'Opening…' : 'Unlock tracker'}</button>
            </form>
          </div>
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
        <button className="auth-mode-toggle" type="button" onClick={() => setMode(mode === 'signup' || mode === 'reset' || mode === 'password' ? 'login' : 'signup')}>{mode === 'signup' || mode === 'reset' || mode === 'password' ? 'Back to magic link' : 'Create account'}</button>
        {mode === 'login' ? <button className="auth-mode-toggle" type="button" onClick={() => setMode('password')}>Use password instead</button> : null}
        {mode === 'password' ? <button className="auth-mode-toggle" type="button" onClick={() => setMode('reset')}>Forgot password</button> : null}
        <div className="login-help">
          <strong>Instant and remembered</strong>
          <span>Your secure session stays signed in on this device for as long as possible.</span>
        </div>
      </section>
    </main>
  )
}
