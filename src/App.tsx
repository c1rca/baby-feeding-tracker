import { AppHeader } from './components/AppHeader'
import { AppToast } from './components/AppToast'
import { MedicineReminderBanner } from './components/MedicineReminderBanner'
import { TummyTimeReminderBanner } from './components/TummyTimeReminderBanner'
import { StatsDashboard } from './components/StatsDashboard'
import { TrackerModals } from './components/TrackerModals'
import { TrackView } from './components/TrackView'
import { useTrackerAppController } from './state/useTrackerAppController'

function App() {
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
      <AppHeader {...headerProps} />
      <MedicineReminderBanner {...medicineReminderProps} />
      <TummyTimeReminderBanner {...tummyTimeReminderProps} />
      {view === 'track' ? <TrackView {...trackViewProps} /> : <StatsDashboard {...statsProps} />}
      <TrackerModals {...modalsProps} />
      <AppToast {...toastProps} />
    </main>
  )
}

export default App
