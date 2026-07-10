import { useEffect, useState, type FormEvent } from 'react'
import { LoginScreen } from './auth/LoginScreen'
import { useAuthGate } from './auth/useAuthGate'
import { createHouseholdForOnboarding, type AuthUser } from './auth/authApi'
import { archiveBaby, createBaby, fetchBabies, type BabySummary } from './babies/babyApi'
import { AppHeader } from './components/AppHeader'
import { AppToast } from './components/AppToast'
import { MedicineReminderBanner } from './components/MedicineReminderBanner'
import { TummyTimeReminderBanner } from './components/TummyTimeReminderBanner'
import { StatsDashboard } from './components/StatsDashboard'
import { TrackerModals } from './components/TrackerModals'
import { TrackView } from './components/TrackView'
import { useTrackerAppController } from './state/useTrackerAppController'

const SELECTED_BABY_STORAGE_KEY = 'baby-feeding-tracker:v1:selected-baby-id'

const readSelectedBabyId = (fallback?: string | null) => {
  if (typeof window === 'undefined') return fallback || ''
  return window.localStorage.getItem(SELECTED_BABY_STORAGE_KEY) || fallback || ''
}

type TrackerAppProps = {
  authUser: AuthUser | null
  onLogout: () => void
  babies: BabySummary[]
  selectedBabyId: string
  onSelectedBabyIdChange: (babyId: string) => void
  onCreateBaby: (input: { name: string; dob?: string }) => Promise<boolean>
  onArchiveBaby: (babyId: string) => Promise<boolean>
}

function TrackerApp({ authUser, onLogout, babies, selectedBabyId, onSelectedBabyIdChange, onCreateBaby, onArchiveBaby }: TrackerAppProps) {
  const { view, headerProps, medicineReminderProps, tummyTimeReminderProps, trackViewProps, statsProps, modalsProps, toastProps } = useTrackerAppController({ selectedBabyId })

  return (
    <main className="app">
      <div className="bg-scene" aria-hidden="true">
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
        <div className="stars" />
        <div className="stars stars-2" />
      </div>
      <AppHeader {...headerProps} authUser={authUser} onLogout={onLogout} babies={babies} selectedBabyId={selectedBabyId} onSelectedBabyIdChange={onSelectedBabyIdChange} />
      <MedicineReminderBanner {...medicineReminderProps} />
      <TummyTimeReminderBanner {...tummyTimeReminderProps} />
      {view === 'track' ? <TrackView {...trackViewProps} /> : <StatsDashboard {...statsProps} />}
      <TrackerModals {...modalsProps} babies={babies} selectedBabyId={selectedBabyId} authUser={authUser} onCreateBaby={onCreateBaby} onArchiveBaby={onArchiveBaby} />
      <AppToast {...toastProps} />
    </main>
  )
}

function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [householdName, setHouseholdName] = useState('')
  const [babyName, setBabyName] = useState('')
  const [babyDob, setBabyDob] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await createHouseholdForOnboarding({ householdName, babyName, babyDob })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onComplete()
  }
  return (
    <main className="app auth-screen">
      <div className="bg-scene" aria-hidden="true"><div className="aurora aurora-1" /><div className="aurora aurora-2" /><div className="aurora aurora-3" /><div className="stars" /><div className="stars stars-2" /></div>
      <section className="card login-card">
        <h1>Baby Feeding Tracker</h1>
        <h2>Set up your household</h2>
        <p className="login-meta">Create the first baby profile for this account.</p>
        <form onSubmit={handleSubmit}>
          <label>Household name<input type="text" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} required /></label>
          <label>Baby name<input type="text" value={babyName} onChange={(event) => setBabyName(event.target.value)} required /></label>
          <label>Baby date of birth<input type="date" value={babyDob} onChange={(event) => setBabyDob(event.target.value)} required /></label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={pending}>{pending ? 'Creating household…' : 'Create household'}</button>
        </form>
      </section>
    </main>
  )
}

function App() {
  const { status, authUser, epoch, pending, error, login, signup, logout, refreshAuth } = useAuthGate()
  const [babies, setBabies] = useState<BabySummary[]>([])
  const [selectedBabyId, setSelectedBabyId] = useState(() => readSelectedBabyId(authUser?.babyId))

  const refreshBabies = async () => {
    const nextBabies = await fetchBabies()
    setBabies(nextBabies)
    setSelectedBabyId((current) => {
      const fallback = authUser?.babyId || nextBabies[0]?.id || ''
      const next = nextBabies.some((baby) => baby.id === current) ? current : fallback
      if (next) window.localStorage.setItem(SELECTED_BABY_STORAGE_KEY, next)
      return next
    })
    return nextBabies
  }

  useEffect(() => {
    if (!authUser) return
    let cancelled = false
    const loadBabies = async () => {
      const nextBabies = await fetchBabies()
      if (cancelled) return
      setBabies(nextBabies)
      setSelectedBabyId((current) => {
        const fallback = authUser.babyId || nextBabies[0]?.id || ''
        const next = nextBabies.some((baby) => baby.id === current) ? current : fallback
        if (next) window.localStorage.setItem(SELECTED_BABY_STORAGE_KEY, next)
        return next
      })
    }
    void loadBabies()
    return () => { cancelled = true }
  }, [authUser])

  const handleSelectedBabyIdChange = (babyId: string) => {
    setSelectedBabyId(babyId)
    window.localStorage.setItem(SELECTED_BABY_STORAGE_KEY, babyId)
  }

  const handleCreateBaby = async (input: { name: string; dob?: string }) => {
    const baby = await createBaby(input)
    if (!baby) return false
    await refreshBabies()
    handleSelectedBabyIdChange(baby.id)
    return true
  }

  const handleArchiveBaby = async (babyId: string) => {
    const ok = await archiveBaby(babyId)
    if (!ok) return false
    await refreshBabies()
    return true
  }

  if (status === 'checking') return null
  if (status === 'login') return <LoginScreen pending={pending} error={error} onLogin={login} onSignup={signup} />
  if (authUser?.needsOnboarding) return <OnboardingScreen onComplete={refreshAuth} />
  // Resolve the transient empty id to the session's baby so the key does not
  // churn (and remount) when selectedBabyId settles from '' to that same baby
  // after /api/babies loads. A genuine baby switch still changes the key.
  const keyBabyId = selectedBabyId || authUser?.babyId || 'default'
  return <TrackerApp key={`${epoch}:${keyBabyId}`} authUser={authUser} onLogout={logout} babies={babies} selectedBabyId={keyBabyId === 'default' ? selectedBabyId : keyBabyId} onSelectedBabyIdChange={handleSelectedBabyIdChange} onCreateBaby={handleCreateBaby} onArchiveBaby={handleArchiveBaby} />
}

export default App
