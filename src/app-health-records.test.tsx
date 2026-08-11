import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { setupAppTestEnvironment } from './appTestSetup'

const HEALTH_KEY = 'baby-feeding-tracker:v1:health-records'

describe('health records', () => {
  setupAppTestEnvironment()

  it('shows the immunisation schedule and logs a dose from it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Insights$/i }))

    const immunisations = await screen.findByRole('article', { name: /Immunisations/i })
    expect(within(immunisations).getAllByText(/Hepatitis B/i).length).toBeGreaterThan(0)

    await user.click(within(immunisations).getAllByRole('button', { name: /^Mark Hepatitis B done$/i })[0])

    const stored = JSON.parse(localStorage.getItem(HEALTH_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ kind: 'vaccine', name: 'Hepatitis B', completed: true })
    expect(within(immunisations).getAllByText(/Done/i).length).toBeGreaterThan(0)
  })

  it('adds an appointment and lists it as upcoming', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Insights$/i }))
    await user.click(screen.getByRole('button', { name: /Add record/i }))

    const form = screen.getByRole('form', { name: /Add health record/i })
    await user.type(within(form).getByLabelText(/^Name$/i), '6-month checkup')
    const dateField = within(form).getByLabelText(/^Date$/i)
    await user.clear(dateField)
    // Comfortably in the future so it lands in the upcoming list.
    await user.type(dateField, '2030-01-15')
    await user.click(within(form).getByRole('button', { name: /Save record/i }))

    const appointments = screen.getByRole('article', { name: /Appointments/i })
    expect(within(appointments).getByText(/6-month checkup/i)).toBeTruthy()

    const stored = JSON.parse(localStorage.getItem(HEALTH_KEY) ?? '[]')
    expect(stored[0]).toMatchObject({ kind: 'appointment', name: '6-month checkup' })
  })

  it('undoes a logged vaccine back to due', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Insights$/i }))

    const immunisations = await screen.findByRole('article', { name: /Immunisations/i })
    await user.click(within(immunisations).getAllByRole('button', { name: /^Mark Hepatitis B done$/i })[0])
    expect(JSON.parse(localStorage.getItem(HEALTH_KEY) ?? '[]')).toHaveLength(1)

    await user.click(within(immunisations).getAllByRole('button', { name: /^Undo Hepatitis B$/i })[0])
    expect(JSON.parse(localStorage.getItem(HEALTH_KEY) ?? '[]')).toHaveLength(0)
  })
})
