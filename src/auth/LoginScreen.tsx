import { Baby } from 'lucide-react'
import { useState, type FormEvent } from 'react'

type LoginScreenProps = {
  pending: boolean
  error: string | null
  onLogin: (email: string, password: string) => void
}

export function LoginScreen({ pending, error, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
        <form onSubmit={handleSubmit}>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  )
}
