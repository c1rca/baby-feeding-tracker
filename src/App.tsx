import { AppHeader } from './components/AppHeader'
import { AppToast } from './components/AppToast'
import { MedicineReminderBanner } from './components/MedicineReminderBanner'
import { StatsDashboard } from './components/StatsDashboard'
import { TrackerModals } from './components/TrackerModals'
import { TrackView } from './components/TrackView'
import { useTrackerAppController } from './state/useTrackerAppController'
import './styles.css'

function App() {
  const { view, headerProps, medicineReminderProps, trackViewProps, statsProps, modalsProps, toastProps } = useTrackerAppController()

  return (
    <main className="app">
      <AppHeader {...headerProps} />
      <MedicineReminderBanner {...medicineReminderProps} />
      {view === 'track' ? <TrackView {...trackViewProps} /> : <StatsDashboard {...statsProps} />}
      <TrackerModals {...modalsProps} />
      <AppToast {...toastProps} />
    </main>
  )
}

export default App
