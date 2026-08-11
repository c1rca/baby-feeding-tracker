/* eslint-disable react-hooks/refs -- the ref intentionally keeps the latest reload-safety predicate without rerunning service-worker setup. */
import { useCallback, useEffect, useRef, useState } from 'react'

// Chromium fires this so a site can offer installation at a moment of its own
// choosing rather than through the browser's own mini-infobar.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'baby-feeding-tracker:v1:install-prompt-dismissed'

// How often to re-check whether it has become safe to swap the worker in.
const RELOAD_RETRY_MS = 2000

const alreadyInstalled = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Install affordance, plus silent background updates.
 *
 * Updates apply themselves — there is no banner and nothing to tap. The catch
 * is that activating a worker reloads the page, and on this branch local
 * changes reach the server through a debounced whole-state PUT rather than a
 * durable queue. Reloading mid-debounce would discard a feed the caregiver has
 * already been told was logged, so the swap waits until `isSafeToReload` says
 * nothing is outstanding, re-checking until it is. An update that never
 * becomes safe simply stays pending — stale code is recoverable, lost care
 * data is not.
 */
export function usePwaLifecycle({ isSafeToReload }: { isSafeToReload?: () => boolean } = {}) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === '1' } catch { return false }
  })
  // Held in a ref, not state: nothing renders from it, and re-rendering the
  // whole app because a background update landed would be its own bug.
  const safeToReloadRef = useRef(isSafeToReload)
  safeToReloadRef.current = isSafeToReload

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Suppress the browser's own banner so the offer appears in context.
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    let cancelled = false
    let activationArmed = false
    let retryTimer: ReturnType<typeof setInterval> | undefined

    const activate = (worker: ServiceWorker) => {
      if (cancelled) return
      // No controller means this is a first install, not an update.
      if (!navigator.serviceWorker.controller) return
      const safe = safeToReloadRef.current
      if (safe && !safe()) {
        if (retryTimer === undefined) retryTimer = setInterval(() => activate(worker), RELOAD_RETRY_MS)
        return
      }
      if (retryTimer !== undefined) { clearInterval(retryTimer); retryTimer = undefined }
      if (activationArmed) return
      activationArmed = true
      // Activating the worker makes the new bundle available for the next
      // ordinary navigation. Never reload a page the caregiver is using.
      worker.postMessage({ type: 'SKIP_WAITING' })
    }

    const track = (registration: ServiceWorkerRegistration) => {
      if (cancelled) return
      if (registration.waiting) activate(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          // A worker that reaches `installed` while one is already controlling
          // the page is a pending update, not a first install.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) activate(installing)
        })
      })
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) track(registration)
    }).catch(() => {
      // No registration yet; main.tsx registers on load and we pick it up then.
    })
    navigator.serviceWorker.ready.then(track).catch(() => {})

    return () => {
      cancelled = true
      if (retryTimer !== undefined) clearInterval(retryTimer)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }, [installPrompt])

  const dismissInstall = useCallback(() => {
    setInstallDismissed(true)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* best effort */ }
  }, [])

  return {
    canInstall: Boolean(installPrompt) && !installDismissed && !alreadyInstalled(),
    promptInstall,
    dismissInstall,
  }
}
