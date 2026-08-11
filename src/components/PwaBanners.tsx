import { Download, X } from 'lucide-react'

// No update banner: updates apply themselves in the background once there is no
// unsaved work (see usePwaLifecycle). A caregiver holding a sleeping baby should
// never be asked to approve a reload.
type PwaBannersProps = {
  canInstall: boolean
  promptInstall: () => void
  dismissInstall: () => void
}

export function PwaBanners({ canInstall, promptInstall, dismissInstall }: PwaBannersProps) {
  if (!canInstall) return null
  return (
    <div className="pwa-banners">
      <div className="pwa-banner" role="status" aria-label="Install app">
        <div><strong>Add to your home screen</strong><span>Opens full screen and keeps working offline.</span></div>
        <button type="button" className="primary" aria-label="Install app" onClick={promptInstall}><Download size={14} /> Install</button>
        <button type="button" className="icon-plain" aria-label="Dismiss install prompt" onClick={dismissInstall}><X size={14} /></button>
      </div>
    </div>
  )
}
