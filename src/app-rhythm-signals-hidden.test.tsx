import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { setupAppTestEnvironment } from './appTestSetup'

// Separate file on purpose: VITE_SHOW_RHYTHM_SIGNALS is read once at module
// load, so the default-off case cannot share a module registry with the
// opt-in tests in app-rhythm-signals.test.tsx.
describe('rest and signals card is hidden by default', () => {
  setupAppTestEnvironment()

  it('does not render the card when the flag is unset', async () => {
    render(<App />)

    // Wait for the tracker itself, so absence is not just "nothing rendered yet".
    expect(await screen.findByRole('button', { name: /^Track$/i })).toBeTruthy()
    expect(screen.queryByRole('region', { name: /Rest and signals/i })).toBeNull()
    expect(screen.queryByText(/Wake window/i)).toBeNull()
    expect(screen.queryByText(/Diaper watch/i)).toBeNull()
  })
})
