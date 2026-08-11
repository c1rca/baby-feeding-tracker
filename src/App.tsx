import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react'
import { LoginScreen } from './auth/LoginScreen'
import { useAuthGate } from './auth/useAuthGate'
import { createHouseholdForOnboarding, type AuthUser } from './auth/authApi'
import { archiveBaby, createBaby, fetchBabies, fetchBabiesResult, renameBaby, updateBabyProfile, type BabyProfilePatch, type BabySummary } from './babies/babyApi'
import { StartupScreen } from './components/StartupScreen'
import { StartupNotice } from './components/StartupNotice'
import { PremiumSidebar } from './components/PremiumSidebar'
import { AppToast } from './components/AppToast'
import { WorkspaceTopbar } from './components/WorkspaceTopbar'
import { PwaBanners } from './components/PwaBanners'
import { usePwaLifecycle } from './pwa/usePwaLifecycle'
import { hasPendingSyncForBaby } from './sync/serverSyncTypes'
import { pendingActionLogCount } from './logging/actionLog'
import { LiveSyncConflictBanner } from './components/LiveSyncConflictBanner'
import { buildCareNotifications } from './components/notifications/notificationModel'
const StatsDashboard = lazy(() => import('./components/StatsDashboard').then(({ StatsDashboard }) => ({ default: StatsDashboard })))
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
  onRenameBaby: (babyId: string, name: string) => Promise<boolean>
  onUpdateBabyProfile: (babyId: string, patch: BabyProfilePatch) => Promise<boolean>
  onArchiveBaby: (babyId: string) => Promise<boolean>
}

function TrackerApp({ authUser, onLogout, babies, selectedBabyId, onSelectedBabyIdChange, onCreateBaby, onRenameBaby, onUpdateBabyProfile, onArchiveBaby }: TrackerAppProps) {
  const selectedBaby = babies.find((baby) => baby.id === selectedBabyId)
  const { view, headerProps, medicineReminderProps, tummyTimeReminderProps, trackViewProps, statsProps, modalsProps, toastProps, liveSyncProps } = useTrackerAppController({ selectedBabyId, babySex: selectedBaby?.sex ?? null })
  const careNotifications = buildCareNotifications({ ...medicineReminderProps, tummyTimeReminder: tummyTimeReminderProps.reminder, startTummyTime: tummyTimeReminderProps.startTummyTime, customTrackerReminders: tummyTimeReminderProps.customTrackerReminders, logCustomEvent: trackViewProps.brief.logCustomEvent, preferences: modalsProps.notificationPreferences, now: trackViewProps.timeline.now })
  const [profileName, setProfileName] = useState(() => window.localStorage.getItem('baby-feeding-tracker:v1:profile-name') || 'Mom')
  // Set when Settings is opened from somewhere specific — the photo menu sends
  // you to the Baby tab rather than dropping you on whatever opens by default.
  const [settingsInitialTab, setSettingsInitialTab] = useState<'baby' | undefined>(undefined)
  const photoMenu = {
    babyId: selectedBaby?.id,
    canEdit: authUser?.role === 'owner' || authUser?.role === 'caregiver',
    onUpdatePhoto: (babyId: string, photo: string) => onUpdateBabyProfile(babyId, { name: selectedBaby?.name ?? '', photo }),
    onOpenBabySettings: () => { setSettingsInitialTab('baby'); modalsProps.setSettingsOpen(true) },
    showToast: modalsProps.showToast,
  }
  const saveProfileName = (name: string) => { const next = name.trim() || 'Mom'; setProfileName(next); window.localStorage.setItem('baby-feeding-tracker:v1:profile-name', next) }
  // A background update reloads the page, so it must not fire while anything is
  // still on its way to the server. The pending marker is set the moment state
  // changes and cleared only on a successful write, so it covers both the
  // debounce window and an in-flight PUT; the action-log outbox covers the
  // backup copy. Either being non-empty defers the swap.
  const isSafeToReload = useCallback(
    () => !hasPendingSyncForBaby(selectedBabyId) && pendingActionLogCount() === 0,
    [selectedBabyId],
  )
  const pwa = usePwaLifecycle({ isSafeToReload })
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
        <WorkspaceTopbar activeWorkspace={activeWorkspace} navigateWorkspace={navigateWorkspace} syncStatus={headerProps.syncStatus} setSettingsOpen={headerProps.setSettingsOpen} careNotifications={careNotifications} babies={babies} selectedBabyId={selectedBabyId} onSelectedBabyIdChange={onSelectedBabyIdChange} />
        <div id="care-brief-slot" />
        <LiveSyncConflictBanner conflict={liveSyncProps.conflict} onResolve={liveSyncProps.onResolve} />
        <PwaBanners {...pwa} />
        {activeWorkspace === 'track' ? <TrackView {...trackViewProps} babyName={selectedBaby?.name} babyPhoto={selectedBaby?.photo ?? undefined} photoMenu={photoMenu} profileName={profileName} /> : <Suspense fallback={<div role="status" aria-live="polite">Loading insights…</div>}><StatsDashboard {...statsProps} /></Suspense>}
      </div>
      <TrackerModals {...modalsProps} settingsInitialTab={settingsInitialTab} profileName={profileName} setProfileName={saveProfileName} babies={babies} selectedBabyId={selectedBabyId} authUser={authUser} onLogout={onLogout} onCreateBaby={onCreateBaby} onRenameBaby={onRenameBaby} onUpdateBabyProfile={onUpdateBabyProfile} onArchiveBaby={onArchiveBaby} />
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
  const { status, authUser, epoch, pending, error, sessionUnavailable, inviteToken, retrySession, login, signup, acceptInvite, loginPasskey, loginWithTextCode, logout, refreshAuth } = useAuthGate()
  const [babies, setBabies] = useState<BabySummary[]>([])
  const [babiesFailed, setBabiesFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)
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
      const result = await fetchBabiesResult()
      if (cancelled) return
      setBabiesFailed(!result.ok)
      const nextBabies = result.ok ? result.babies : []
      if (!result.ok) return
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

  const handleRenameBaby = async (babyId: string, name: string) => {
    const baby = await renameBaby(babyId, name)
    if (!baby) return false
    setBabies((current) => current.map((item) => item.id === baby.id ? { ...item, name: baby.name } : item))
    return true
  }

  const handleUpdateBabyProfile = async (babyId: string, patch: BabyProfilePatch) => {
    const baby = await updateBabyProfile(babyId, patch)
    if (!baby) return false
    setBabies((current) => current.map((item) => item.id === baby.id ? { ...item, ...baby } : item))
    return true
  }

  const handleArchiveBaby = async (babyId: string) => {
    const ok = await archiveBaby(babyId)
    if (!ok) return false
    await refreshBabies()
    return true
  }

  const retryStartup = async () => {
    setRetrying(true)
    const result = await fetchBabiesResult()
    setBabiesFailed(!result.ok)
    if (result.ok) setBabies(result.babies)
    setRetrying(false)
    if (sessionUnavailable) retrySession()
  }

  if (status === 'checking') return <StartupScreen />
  if (status === 'login') return <LoginScreen pending={pending} error={error} inviteToken={inviteToken} onLogin={login} onSignup={signup} onAcceptInvite={acceptInvite} onTextLogin={loginWithTextCode} onPasskeyLogin={loginPasskey} />
  if (authUser?.needsOnboarding) return <OnboardingScreen onComplete={refreshAuth} />
  // Resolve the transient empty id to the session's baby so the key does not
  // churn (and remount) when selectedBabyId settles from '' to that same baby
  // after /api/babies loads. A genuine baby switch still changes the key.
  const selectedBabyExists = selectedBabyId ? babies.some((baby) => baby.id === selectedBabyId) : false
  const effectiveBabyId = selectedBabyExists ? selectedBabyId : (authUser?.babyId || selectedBabyId)
  const keyBabyId = effectiveBabyId || 'default'
  return <>
    <StartupNotice sessionUnavailable={sessionUnavailable} babiesFailed={babiesFailed} onRetry={() => void retryStartup()} retrying={retrying} />
    <TrackerApp key={`${epoch}:${keyBabyId}`} authUser={authUser} onLogout={logout} babies={babies} selectedBabyId={keyBabyId === 'default' ? '' : effectiveBabyId} onSelectedBabyIdChange={handleSelectedBabyIdChange} onCreateBaby={handleCreateBaby} onRenameBaby={handleRenameBaby} onUpdateBabyProfile={handleUpdateBabyProfile} onArchiveBaby={handleArchiveBaby} />
  </>
}

export default App
