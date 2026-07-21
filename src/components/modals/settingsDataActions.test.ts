import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSettingsData, importSettingsData } from './settingsDataActions'

const state = {
  entries: [{ id: 'feed', type: 'bottle' as const, startedAt: 1, endedAt: 2, leftSeconds: 0, rightSeconds: 0, bottleOunces: 2 }],
  diapers: [{ id: 'diaper', at: 1, context: 'standalone' as const, kinds: ['wet' as const] }],
  medicines: [{ id: 'medicine', kind: 'vitamin_d' as const, at: 1 }],
  tummyTimes: [{ id: 'tummy', startedAt: 1, endedAt: 2 }],
  pumpEvents: [{ id: 'pump', startedAt: 1, endedAt: 2, leftOunces: 1, rightOunces: null }],
  pumpSession: { id: 'pump-session', startedAt: 1, side: 'left' as const },
  tummySession: { id: 'tummy-session', startedAt: 1, note: '', kind: 'tummy' as const },
  tummyGoalMinutes: 30,
  growthMeasurements: [{ id: 'growth', measuredAt: 1, ageMonths: 1, weightLb: 8, lengthCm: null, headCm: null }],
  babyDob: '2026-01-01',
  session: { id: 'session', startedAt: 1, activeSide: null, segmentStart: null, segments: [], bottleOunces: 0, note: '', diaperKinds: [] },
  theme: 'dark' as const,
}

const setters = {
  setEntries: vi.fn(), setDiapers: vi.fn(), setMedicines: vi.fn(), setTummyTimes: vi.fn(), setPumpEvents: vi.fn(),
  setPumpSession: vi.fn(), setTummySession: vi.fn(), setTummyGoalMinutes: vi.fn(), setGrowthMeasurements: vi.fn(),
  setBabyDob: vi.fn(), setSession: vi.fn(), setTheme: vi.fn(), setUndoState: vi.fn(), showToast: vi.fn(),
}

describe('settings data actions', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('confirm', vi.fn(() => true)) })
  it('imports a complete replacement through every tracker setter', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const target = { files: [{ text: async () => JSON.stringify({ format: 'baby-feeding-tracker-export', version: 1, exportedAt: '2026-02-03T04:05:06.000Z', state }) }], value: 'backup.json' } as unknown as HTMLInputElement
    await importSettingsData({ event: { target } as never, ...setters })
    expect(setters.setEntries).toHaveBeenCalledWith(state.entries)
    expect(setters.setMedicines).toHaveBeenCalledWith(state.medicines)
    expect(setters.setPumpSession).toHaveBeenCalledWith(state.pumpSession)
    expect(setters.setGrowthMeasurements).toHaveBeenCalledWith(state.growthMeasurements)
    expect(setters.setTheme).toHaveBeenCalledWith('dark')
    expect(target.value).toBe('')
  })

  it('leaves live state untouched when import decoding fails', async () => {
    const target = { files: [{ text: async () => '{' }], value: 'broken.json' } as unknown as HTMLInputElement
    await importSettingsData({ event: { target } as never, ...setters })
    expect(setters.setEntries).not.toHaveBeenCalled()
    expect(setters.showToast).toHaveBeenCalledWith('Import failed: invalid or unsupported file')
  })

  it('clears every health collection and active session while retaining health defaults', () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    clearSettingsData(setters)
    expect(setters.setEntries).toHaveBeenCalledWith([])
    expect(setters.setMedicines).toHaveBeenCalledWith([])
    expect(setters.setTummyTimes).toHaveBeenCalledWith([])
    expect(setters.setPumpEvents).toHaveBeenCalledWith([])
    expect(setters.setGrowthMeasurements).toHaveBeenCalledWith([])
    expect(setters.setSession).toHaveBeenCalledWith(null)
    expect(setters.setPumpSession).toHaveBeenCalledWith(null)
    expect(setters.setTummySession).toHaveBeenCalledWith(null)
    expect(setters.setTummyGoalMinutes).not.toHaveBeenCalled()
    expect(setters.setBabyDob).not.toHaveBeenCalled()
    expect(setters.setTheme).not.toHaveBeenCalled()
  })
})
