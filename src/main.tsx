import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito/index.css'
import '@fontsource-variable/inter/index.css'
import { applySkin, readSkin } from './skin'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary'
import { UnitPreferencesProvider } from './state/UnitPreferencesProvider'
import { installErrorCapture } from './logging/errorLog'

applySkin(readSkin())

// Start capturing before the app renders, so a failure during startup — the
// hardest kind to reproduce afterwards — is in the report too.
installErrorCapture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <UnitPreferencesProvider>
        <App />
      </UnitPreferencesProvider>
    </ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app still works with localStorage if service worker registration fails.
    })
  })
}
