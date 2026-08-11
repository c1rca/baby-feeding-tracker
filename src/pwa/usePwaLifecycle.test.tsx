import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePwaLifecycle } from './usePwaLifecycle'
import { PwaBanners } from '../components/PwaBanners'

function Harness() {
  const pwa = usePwaLifecycle()
  return <PwaBanners {...pwa} />
}

const fireInstallPrompt = () => {
  const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'accepted' as const })
  window.dispatchEvent(event)
  return event
}

describe('install prompt', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('offers nothing until the browser says the app is installable', () => {
    render(<Harness />)
    expect(screen.queryByRole('status', { name: /Install app/i })).toBeNull()
  })

  it('offers installation once the browser signals it, and installs on tap', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const event = fireInstallPrompt()

    expect(await screen.findByRole('status', { name: /Install app/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^Install app$/i }))
    expect(event.prompt).toHaveBeenCalled()
  })

  it('stays dismissed on this device once waved away', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness />)
    fireInstallPrompt()

    await user.click(await screen.findByRole('button', { name: /Dismiss install prompt/i }))
    expect(screen.queryByRole('status', { name: /Install app/i })).toBeNull()

    unmount()
    render(<Harness />)
    fireInstallPrompt()
    expect(screen.queryByRole('status', { name: /Install app/i })).toBeNull()
  })

  it('does not pester an already-installed app', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    render(<Harness />)
    fireInstallPrompt()
    expect(screen.queryByRole('status', { name: /Install app/i })).toBeNull()
  })
})

describe('update prompt', () => {
  const waitingWorker = { postMessage: vi.fn() }

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    waitingWorker.postMessage.mockClear()
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  // The banner is gone on purpose: updates apply themselves in the background
  // once nothing is unsaved (covered in backgroundUpdate.test.tsx). A caregiver
  // must never be asked to approve a reload.
  it('shows no update banner even when a worker is waiting', async () => {
    const registration = { waiting: waitingWorker, addEventListener: vi.fn() }
    vi.stubGlobal('navigator', {
      ...window.navigator,
      serviceWorker: {
        getRegistration: () => Promise.resolve(registration),
        ready: Promise.resolve(registration),
        controller: {},
        addEventListener: vi.fn(),
      },
    })

    render(<Harness />)
    await new Promise((resolve) => setTimeout(resolve, 60))

    expect(screen.queryByRole('status', { name: /Update available/i })).toBeNull()
    expect(screen.queryByText(/Update ready/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /Reload to update/i })).toBeNull()
  })

  it('says nothing when there is no pending update', async () => {
    const registration = { waiting: null, addEventListener: vi.fn() }
    vi.stubGlobal('navigator', {
      ...window.navigator,
      serviceWorker: { getRegistration: () => Promise.resolve(registration), ready: Promise.resolve(registration), controller: {}, addEventListener: vi.fn() },
    })

    render(<Harness />)
    await Promise.resolve()
    expect(screen.queryByRole('status', { name: /Update available/i })).toBeNull()
  })
})
