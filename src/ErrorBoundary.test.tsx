import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { setupAppTestEnvironment } from './appTestSetup'

function CrashingChild(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  setupAppTestEnvironment()

  it('shows a safe refresh fallback when the app crashes', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true })

    render(
      <ErrorBoundary>
        <CrashingChild />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /refresh app/i }))
    expect(reload).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
  })
})
