import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { STORAGE_MEDICINES_KEY, setupAppTestEnvironment } from './appTestSetup'
import { knownCustomMedicineNames, medicineEventLabel } from './domain/labels'
import type { MedicineEvent } from './types'

const openMedicineSheet = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /^Medicine$/i }))
  return screen.getByRole('dialog', { name: /Log medicine/i })
}

describe('custom medicines', () => {
  setupAppTestEnvironment()

  it('logs a medicine outside the three built-ins under its own name', async () => {
    const user = userEvent.setup()
    render(<App />)

    const sheet = await openMedicineSheet(user)
    await user.type(within(sheet).getByLabelText(/Other medicine name/i), 'Iron drops')
    await user.click(within(sheet).getByRole('button', { name: /Log other medicine/i }))

    const stored = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]')
    expect(stored[0]).toMatchObject({ kind: 'custom', name: 'Iron drops' })
    expect(screen.getAllByText(/Iron drops/i).length).toBeGreaterThan(0)
  })

  it('will not log an unnamed custom dose', async () => {
    const user = userEvent.setup()
    render(<App />)

    const sheet = await openMedicineSheet(user)
    expect(within(sheet).getByRole('button', { name: /Log other medicine/i })).toHaveProperty('disabled', true)
  })

  it('offers previously used names for reuse', async () => {
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([
      { id: 'm1', kind: 'custom', name: 'Probiotic', at: Date.now() - 3_600_000 },
    ]))
    const user = userEvent.setup()
    render(<App />)

    const sheet = await openMedicineSheet(user)
    expect(within(sheet).getByRole('option', { hidden: true, name: '' })).toHaveProperty('value', 'Probiotic')
  })

  it('leaves the built-in three logging exactly as before', async () => {
    const user = userEvent.setup()
    render(<App />)

    const sheet = await openMedicineSheet(user)
    await user.click(within(sheet).getByRole('button', { name: /^Vitamin D$/i }))

    const stored = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]')
    expect(stored[0]).toMatchObject({ kind: 'vitamin_d' })
    expect(stored[0].name).toBeUndefined()
  })
})

describe('medicine labelling', () => {
  const custom: MedicineEvent = { id: 'c', kind: 'custom', at: 1, name: 'Iron drops' }

  it('names a custom dose by its name and a built-in by its kind', () => {
    expect(medicineEventLabel(custom)).toBe('Iron drops')
    expect(medicineEventLabel({ id: 'v', kind: 'vitamin_d', at: 1 })).toBe('Vitamin D')
  })

  it('falls back rather than rendering a blank label', () => {
    expect(medicineEventLabel({ id: 'c2', kind: 'custom', at: 1 })).toBe('Other medicine')
  })

  it('lists distinct custom names newest first', () => {
    expect(knownCustomMedicineNames([
      { id: 'a', kind: 'custom', at: 10, name: 'Iron drops' },
      { id: 'b', kind: 'custom', at: 30, name: 'Probiotic' },
      { id: 'c', kind: 'custom', at: 20, name: 'Iron drops' },
      { id: 'd', kind: 'vitamin_d', at: 40 },
    ])).toEqual(['Probiotic', 'Iron drops'])
  })
})
