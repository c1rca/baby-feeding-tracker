import { LoginScreen } from './auth/LoginScreen'
import { useAuthGate } from './auth/useAuthGate'
import type { AuthUser } from './auth/authApi'
import { AppHeader } from './components/AppHeader'
import { AppToast } from './components/AppToast'
import { MedicineReminderBanner } from './components/MedicineReminderBanner'
import { TummyTimeReminderBanner } from './components/TummyTimeReminderBanner'
import { StatsDashboard } from './components/StatsDashboard'
import { TrackerModals } from './components/TrackerModals'
import { TrackView } from './components/TrackView'
import { useTrackerAppController } from './state/useTrackerAppController'

type TrackerAppProps = {
  authUser: AuthUser | null
  onLogout: () => void
}

function TrackerApp({ authUser, onLogout }: TrackerAppProps) {
  const { view, headerProps, medicineReminderProps, tummyTimeReminderProps, trackViewProps, statsProps, modalsProps, toastProps } = useTrackerAppController()

  return (
    <main className="app">
      <div className="bg-scene" aria-hidden="true">
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
        <div className="stars" />
        <div className="stars stars-2" />
      </div>
      <AppHeader {...headerProps} authUser={authUser} onLogout={onLogout} />
      <MedicineReminderBanner {...medicineReminderProps} />
      <TummyTimeReminderBanner {...tummyTimeReminderProps} />
      {view === 'track' ? <TrackView {...trackViewProps} /> : <StatsDashboard {...statsProps} />}
      <TrackerModals {...modalsProps} />
      <AppToast {...toastProps} />
    </main>
  )
}

function App() {
  const { status, authUser, epoch, pending, error, login, logout } = useAuthGate()

  if (status === 'login') return <LoginScreen pending={pending} error={error} onLogin={login} />
  return <TrackerApp key={epoch} authUser={authUser} onLogout={logout} />
}

export default App
