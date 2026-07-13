import { Baby, Settings2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { LoginScreen } from './auth/LoginScreen'
import { useAuthGate } from './auth/useAuthGate'
import { createHouseholdForOnboarding, type AuthUser } from './auth/authApi'
import { archiveBaby, createBaby, fetchBabies, type BabySummary } from './babies/babyApi'
import { PremiumSidebar } from './components/PremiumSidebar'
import { AppToast } from './components/AppToast'
import { CareNotificationCenter } from './components/notifications/CareNotificationCenter'
import { buildCareNotifications } from './components/notifications/notificationModel'
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

const syncLabel = { syncing: 'Syncing', synced: 'Online', offline: 'Offline changes saved', issue: 'Sync issue' } as const

function TrackerApp({ authUser, onLogout, babies, selectedBabyId, onSelectedBabyIdChange, onCreateBaby, onArchiveBaby }: TrackerAppProps) {
  const { view, headerProps, medicineReminderProps, tummyTimeReminderProps, trackViewProps, statsProps, modalsProps, toastProps } = useTrackerAppController({ selectedBabyId })
  const careNotifications = buildCareNotifications({ ...medicineReminderProps, tummyTimeReminder: tummyTimeReminderProps.reminder, startTummyTime: tummyTimeReminderProps.startTummyTime })
  const [profileName, setProfileName] = useState(() => window.localStorage.getItem('baby-feeding-tracker:v1:profile-name') || 'Mom')
  const saveProfileName = (name: string) => { const next = name.trim() || 'Mom'; setProfileName(next); window.localStorage.setItem('baby-feeding-tracker:v1:profile-name', next) }
  const [workspace, setWorkspace] = useState<'track' | 'care' | 'stats'>(view)
  const activeWorkspace: 'track' | 'care' | 'stats' = workspace === 'stats' ? 'stats' : 'track'
  const navigateWorkspace = (next: 'track' | 'care' | 'stats') => { setWorkspace(next); if (next === 'track' || next === 'stats') headerProps.setView(next) }

  return (
    <main className="app app-shell">
      <div className="bg-scene" aria-hidden="true">
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
        <div className="stars" />
        <div className="stars stars-2" />
      </div>
      <PremiumSidebar view={activeWorkspace} setView={navigateWorkspace} settingsOpen={headerProps.settingsOpen} setSettingsOpen={headerProps.setSettingsOpen} />
      <div className="app-shell-content">
        <header className="workspace-topbar"><div className="workspace-brand"><span className="workspace-brand-mark"><Baby size={18} /></span><h1>Baby Tracker</h1></div><nav className="desktop-workspace-nav" aria-label="Workspace"><button type="button" className={activeWorkspace === 'track' ? 'is-active' : ''} aria-current={activeWorkspace === 'track' ? 'page' : undefined} onClick={() => navigateWorkspace('track')}>Track</button><button type="button" className={activeWorkspace === 'stats' ? 'is-active' : ''} aria-current={activeWorkspace === 'stats' ? 'page' : undefined} onClick={() => navigateWorkspace('stats')}>Insights</button></nav><div className="workspace-topbar-actions">{headerProps.syncStatus !== 'synced' ? <span className={`sync-pill sync-${headerProps.syncStatus}`} aria-label={`Sync status: ${syncLabel[headerProps.syncStatus]}`}>{syncLabel[headerProps.syncStatus]}</span> : null}<button type="button" className="desktop-settings" aria-label="Open settings" onClick={() => headerProps.setSettingsOpen(true)}><Settings2 size={18} /><span>Settings</span></button><CareNotificationCenter notifications={careNotifications} />{babies.length > 1 ? <select aria-label="Active baby" value={selectedBabyId} onChange={(event) => onSelectedBabyIdChange(event.target.value)}>{babies.map((baby) => <option key={baby.id} value={baby.id}>{baby.name}</option>)}</select> : null}</div></header>
        <div id="care-brief-slot" />
        {activeWorkspace === 'track' ? <TrackView {...trackViewProps} /> : <StatsDashboard {...statsProps} />}
      </div>
      <TrackerModals {...modalsProps} profileName={profileName} setProfileName={saveProfileName} babies={babies} selectedBabyId={selectedBabyId} authUser={authUser} onLogout={onLogout} onCreateBaby={onCreateBaby} onArchiveBaby={onArchiveBaby} />
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
  const { status, authUser, epoch, pending, error, login, loginWithTextCode, logout, refreshAuth } = useAuthGate()
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
  if (status === 'login') return <LoginScreen pending={pending} error={error} onLogin={login} onTextLogin={loginWithTextCode} />
  if (authUser?.needsOnboarding) return <OnboardingScreen onComplete={refreshAuth} />
  // Resolve the transient empty id to the session's baby so the key does not
  // churn (and remount) when selectedBabyId settles from '' to that same baby
  // after /api/babies loads. A genuine baby switch still changes the key.
  const selectedBabyExists = selectedBabyId ? babies.some((baby) => baby.id === selectedBabyId) : false
  const effectiveBabyId = selectedBabyExists ? selectedBabyId : (authUser?.babyId || selectedBabyId)
  const keyBabyId = effectiveBabyId || 'default'
  return <TrackerApp key={`${epoch}:${keyBabyId}`} authUser={authUser} onLogout={logout} babies={babies} selectedBabyId={keyBabyId === 'default' ? '' : effectiveBabyId} onSelectedBabyIdChange={handleSelectedBabyIdChange} onCreateBaby={handleCreateBaby} onArchiveBaby={handleArchiveBaby} />
}

export default App
