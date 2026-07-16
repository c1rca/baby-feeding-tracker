import { useEffect } from 'react'

// A foreground tab left open for a long stretch (overnight, all day) would
// otherwise drift: nothing re-fetches after the initial load unless the live
// stream is on. This periodic pull is the fallback that keeps it fresh.
export const BACKGROUND_RESYNC_INTERVAL_MS = 2 * 60 * 1000

type BackgroundResyncOptions = {
  // Read-only pull that fast-forwards a quiet viewer to the newest server
  // truth. It is a no-op when this device has unsaved local work, so wiring it
  // to noisy triggers (focus bursts, intervals) can never clobber edits.
  pullLatest: () => void
  // The live stream already pushes updates, so skip the polling fallback while
  // it is connected — visibility/focus pulls still run as a cheap safety net.
  liveConnected: boolean
}

export function useBackgroundResync({ pullLatest, liveConnected }: BackgroundResyncOptions) {
  useEffect(() => {
    const resyncIfVisible = () => {
      if (document.visibilityState === 'visible') pullLatest()
    }
    // Coming back to a backgrounded tab is the main case the user hit: the tab
    // was hidden for hours, then re-shown showing stale data.
    document.addEventListener('visibilitychange', resyncIfVisible)
    window.addEventListener('focus', pullLatest)
    window.addEventListener('online', pullLatest)

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (liveConnected) return
      pullLatest()
    }, BACKGROUND_RESYNC_INTERVAL_MS)

    return () => {
      document.removeEventListener('visibilitychange', resyncIfVisible)
      window.removeEventListener('focus', pullLatest)
      window.removeEventListener('online', pullLatest)
      window.clearInterval(interval)
    }
  }, [pullLatest, liveConnected])
}
