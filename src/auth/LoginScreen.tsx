import { Baby } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { fetchGoogleAuthStatus } from './authApi'

type LoginScreenProps = {
  pending: boolean
  error: string | null
  onLogin: (email: string, password: string) => void
}

export function LoginScreen({ pending, error, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [googleAvailable, setGoogleAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchGoogleAuthStatus().then((available) => {
      if (!cancelled) setGoogleAvailable(available)
    })
    return () => { cancelled = true }
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onLogin(email, password)
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
        <h2>Sign in</h2>
        <p className="login-meta">Private, synced care notes for your household.</p>
        {googleAvailable ? (
          <a className="google-sign-in-button" href="/api/auth/google/start" aria-label="Sign in with Google">
            <span className="google-g-mark" aria-hidden="true">G</span>
            <span>Sign in with Google</span>
          </a>
        ) : null}
        {googleAvailable ? <div className="login-divider"><span>or use password</span></div> : null}
        <form onSubmit={handleSubmit}>
          <label>Username or email<input type="text" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="login-help">
          <strong>Forgot password?</strong>
          <span>Ask the server admin to run the documented reset/recovery path.</span>
        </div>
      </section>
    </main>
  )
}
