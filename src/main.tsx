import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito/index.css'
import '@fontsource-variable/inter/index.css'
import { applySkin, readSkin } from './skin'
import App from './App.tsx'

applySkin(readSkin())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app still works with localStorage if service worker registration fails.
    })
  })
}
