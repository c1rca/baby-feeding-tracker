import { Baby, Mail, MessageCircle, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { confirmPasswordReset, fetchGoogleAuthStatus, requestMagicLogin, requestPasswordReset } from './authApi'

type LoginScreenProps = {
  pending: boolean
  error: string | null
  onLogin: (email: string, password: string) => void
  onTextLogin: (code: string) => void
}

type AuthMode = 'magic' | 'code' | 'password' | 'reset'

export function LoginScreen({ pending, error, onLogin, onTextLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>('magic')
  const [destination, setDestination] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [textCode, setTextCode] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [localPending, setLocalPending] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [googleAvailable, setGoogleAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchGoogleAuthStatus().then((available) => { if (!cancelled) setGoogleAvailable(available) })
    return () => { cancelled = true }
  }, [])

  const sendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalPending(true)
    setStatus(null)
    const result = await requestMagicLogin(destination)
    setLocalPending(false)
    if (!result.ok) return setStatus(result.error)
    setMode('code')
    setStatus(`${result.channel === 'email' ? 'Email' : 'Text'} sent to ${result.maskedDestination}. Tap the link or enter the code below.`)
  }

  const confirmCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onTextLogin(textCode)
  }

  const passwordLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onLogin(email, password)
  }

  const handleResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalPending(true)
    setStatus(null)
    const result = await requestPasswordReset(email)
    setLocalPending(false)
    if (!result.ok) return setStatus(result.error)
    setStatus(result.resetToken ? `Reset token ready: ${result.resetToken}` : 'If that email has an account, a reset link is on the way.')
  }

  const handleResetConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalPending(true)
    setStatus(null)
    const result = await confirmPasswordReset(resetToken, newPassword)
    setLocalPending(false)
    if (!result.ok) return setStatus(result.error)
    setStatus('Password reset complete. You can sign in now.')
    setMode('password')
  }

  return (
    <main className="app auth-screen">
      <div className="bg-scene" aria-hidden="true"><div className="aurora aurora-1" /><div className="aurora aurora-2" /><div className="aurora aurora-3" /><div className="stars" /><div className="stars stars-2" /></div>
      <section className="card login-card">
        <h1><span className="brand-mark"><Baby size={24} /></span> Baby Feeding Tracker</h1>
        <h2>Sign in fast</h2>
        <p className="login-meta">Enter your mobile number or email. We’ll send a secure link and a 6-digit code.</p>
        <div className="login-benefits" aria-hidden="true"><span><MessageCircle size={15} /> Text link</span><span><Mail size={15} /> Email link</span><span><ShieldCheck size={15} /> Remembered</span></div>
        {error && mode !== 'code' && mode !== 'password' ? <p className="login-error" role="alert">{error}</p> : null}

        {googleAvailable ? <a className="google-sign-in-button" href="/api/auth/google/start" aria-label="Sign in with Google"><span className="google-g-mark" aria-hidden="true">G</span><span>Continue with Google</span></a> : null}

        {mode === 'magic' ? (
          <form onSubmit={sendMagicLink} className="text-login-flow">
            <label>Mobile number or email<input type="text" inputMode="email" autoComplete="username" placeholder="(555) 123-4567 or you@example.com" value={destination} onChange={(event) => setDestination(event.target.value)} required /></label>
            <button className="primary-magic-button" type="submit" disabled={localPending}>{localPending ? 'Sending…' : 'Send my sign-in link'}</button>
          </form>
        ) : null}

        {mode === 'code' ? (
          <form onSubmit={confirmCode} className="code-card code-card-premium">
            <label>6-digit code<input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} value={textCode} onChange={(event) => setTextCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /></label>
            {error ? <p className="login-error" role="alert">{error}</p> : null}
            <button type="submit" disabled={pending || textCode.length < 6}>{pending ? 'Opening…' : 'Open tracker'}</button>
          </form>
        ) : null}

        {mode === 'password' ? (
          <form onSubmit={passwordLogin} className="text-login-flow">
            <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {error ? <p className="login-error" role="alert">{error}</p> : null}
            <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in with password'}</button>
          </form>
        ) : null}

        {mode === 'reset' ? (
          <div className="text-login-flow">
            <form onSubmit={handleResetRequest}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button type="submit" disabled={localPending}>Send reset link</button></form>
            <form onSubmit={handleResetConfirm}><label>Reset token<input value={resetToken} onChange={(event) => setResetToken(event.target.value)} required /></label><label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><button type="submit" disabled={localPending}>Set password</button></form>
          </div>
        ) : null}

        {status ? <p className="login-meta magic-status" role="status">{status}</p> : null}
        <div className="auth-secondary-actions">
          {mode !== 'magic' ? <button className="auth-mode-toggle" type="button" onClick={() => setMode('magic')}>Use link instead</button> : null}
          {mode === 'magic' ? <button className="auth-mode-toggle" type="button" onClick={() => setMode('magic')}>Create account with email</button> : null}
          {mode !== 'password' ? <button className="auth-mode-toggle" type="button" onClick={() => setMode('password')}>Use password instead</button> : null}
          {mode === 'password' ? <button className="auth-mode-toggle" type="button" onClick={() => setMode('reset')}>Forgot password?</button> : null}
        </div>
      </section>
    </main>
  )
}
