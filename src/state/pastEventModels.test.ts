import { describe, expect, it } from 'vitest'
import { createDefaultPastEventDraft, parsePastEventDraft } from './pastEventModels'

const now = new Date('2026-07-18T12:00:00').getTime()

function draftAt(date: string, time: string, overrides: Partial<ReturnType<typeof createDefaultPastEventDraft>>) {
  return { ...createDefaultPastEventDraft(now), date, time, ...overrides }
}

describe('parsePastEventDraft', () => {
  it('logs a completed past sleep that ends before now', () => {
    const draft = draftAt('2026-07-18', '08:00', { kind: 'sleep', durationMinutes: '90' })
    const result = parsePastEventDraft(draft, now)
    expect(result.ok).toBe(true)
    if (result.ok && (result.event.kind === 'sleep' || result.event.kind === 'tummy')) {
      expect(result.event.event.startedAt).toBe(new Date('2026-07-18T08:00:00').getTime())
      expect(result.event.event.endedAt).toBe(new Date('2026-07-18T09:30:00').getTime())
    }
  })

  it('rejects a past sleep whose duration pushes the end into the future', () => {
    // Starts 30 min ago, but a 90 min duration would end an hour from now.
    const draft = draftAt('2026-07-18', '11:30', { kind: 'sleep', durationMinutes: '90' })
    const result = parsePastEventDraft(draft, now)
    expect(result).toEqual({ ok: false, reason: 'future-date' })
  })

  it('rejects a past pump whose end is in the future', () => {
    const draft = draftAt('2026-07-18', '11:45', { kind: 'pump', durationMinutes: '30' })
    const result = parsePastEventDraft(draft, now)
    expect(result).toEqual({ ok: false, reason: 'future-date' })
  })

  it('still rejects a start time in the future before checking duration', () => {
    const draft = draftAt('2026-07-18', '13:00', { kind: 'tummy', durationMinutes: '10' })
    const result = parsePastEventDraft(draft, now)
    expect(result).toEqual({ ok: false, reason: 'future-date' })
  })
})
