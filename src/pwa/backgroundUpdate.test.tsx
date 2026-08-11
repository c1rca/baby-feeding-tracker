import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePwaLifecycle } from './usePwaLifecycle'

// A waiting worker that records whether it was told to take over.
function makeWorker() {
  return { postMessage: vi.fn() } as unknown as ServiceWorker & { postMessage: ReturnType<typeof vi.fn> }
}

function stubServiceWorker(waiting: ServiceWorker, { controlled = true } = {}) {
  const registration = {
    waiting,
    installing: null,
    addEventListener: vi.fn(),
  } as unknown as ServiceWorkerRegistration
  const container = {
    controller: controlled ? {} : null,
    getRegistration: vi.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
    addEventListener: vi.fn(),
  }
  vi.stubGlobal('navigator', { ...window.navigator, serviceWorker: container })
  return container
}

function Harness({ isSafeToReload }: { isSafeToReload: () => boolean }) {
  usePwaLifecycle({ isSafeToReload })
  return null
}

describe('background updates', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

  it('activates a waiting update without scheduling a current-page reload', async () => {
    const worker = makeWorker()
    const container = stubServiceWorker(worker)

    render(<Harness isSafeToReload={() => true} />)

    await waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))
    expect(container.addEventListener).not.toHaveBeenCalledWith('controllerchange', expect.any(Function), expect.anything())
  })

  // A current page stays on its loaded bundle. The activated worker serves the
  // update on the caregiver's next ordinary navigation instead of flashing the
  // tracker several seconds after startup.
  // The reload that previously followed SKIP_WAITING could discard anything still sitting in
  // the sync debounce, so an update must never be applied while work is pending.
  it('never takes over while local work is still unsaved', async () => {
    const worker = makeWorker()
    stubServiceWorker(worker)

    render(<Harness isSafeToReload={() => false} />)

    // Give the registration promises and a couple of retry ticks time to run.
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(worker.postMessage).not.toHaveBeenCalled()
  })

  it('applies the deferred update as soon as the work drains', async () => {
    const worker = makeWorker()
    stubServiceWorker(worker)
    let safe = false

    render(<Harness isSafeToReload={() => safe} />)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(worker.postMessage).not.toHaveBeenCalled()

    safe = true
    await waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }), { timeout: 6000 })
  })

  it('does not reload on a first install, when no worker controls the page yet', async () => {
    const worker = makeWorker()
    stubServiceWorker(worker, { controlled: false })

    render(<Harness isSafeToReload={() => true} />)

    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(worker.postMessage).not.toHaveBeenCalled()
  })
})
