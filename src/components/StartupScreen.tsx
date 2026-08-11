import { Baby } from 'lucide-react'

/**
 * Session resolution is normal on every launch. Keep it recognisable to screen
 * readers without flashing a white login-style card or repeating status copy
 * for a fraction of a second on every routine reload.
 */
export function StartupScreen() {
  return (
    <main className="app startup-screen" aria-busy="true">
      <div className="bg-scene" aria-hidden="true"><div className="aurora aurora-1" /><div className="aurora aurora-2" /><div className="aurora aurora-3" /><div className="stars" /><div className="stars stars-2" /></div>
      <div className="startup-indicator" role="status" aria-label="Opening Baby Feeding Tracker">
        <span className="startup-mark" aria-hidden="true"><Baby size={22} /></span>
        <span className="startup-spinner" aria-hidden="true" />
      </div>
    </main>
  )
}
