import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

export const STORAGE_SESSION_KEY = 'baby-feeding-tracker:v1:session'
export const STORAGE_KEY = 'baby-feeding-tracker:v1:entries'
export const STORAGE_DIAPERS_KEY = 'baby-feeding-tracker:v1:diapers'
export const STORAGE_MEDICINES_KEY = 'baby-feeding-tracker:v1:medicines'

export function setupAppTestEnvironment() {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
}
