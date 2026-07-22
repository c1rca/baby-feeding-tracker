import { expect, test } from '@playwright/test'

const minute = 60_000
const dayStart = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() }

function fixture() {
  const start = dayStart()
  const at = (hour: number, minutes = 0) => start + (hour * 60 + minutes) * minute
  return {
    entries: [
      // Omit optional `diaperKinds`: strict persisted-state validation treats an
      // explicitly supplied list as a recorded diaper event, which cannot be empty.
      { id: 'fixture-nursing', type: 'breast', startedAt: at(7, 45), endedAt: at(8, 10), leftSeconds: 15 * 60, rightSeconds: 10 * 60, bottleOunces: null, note: 'fixture' },
      { id: 'fixture-bottle', type: 'bottle', startedAt: at(8, 5), endedAt: at(8, 25), leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note: 'fixture' },
    ],
    diapers: [
      { id: 'fixture-wet', kinds: ['wet'], at: at(8, 18), context: 'standalone' },
      { id: 'fixture-mixed', kinds: ['wet', 'stool'], at: at(8, 34), context: 'standalone' },
    ],
    tummyTimes: [
      { id: 'fixture-sleep', startedAt: at(10), endedAt: at(11, 30), note: 'fixture', kind: 'sleep' },
      { id: 'fixture-tummy', startedAt: at(13), endedAt: at(13, 25), note: 'fixture', kind: 'tummy' },
    ],
    medicines: [], pumpEvents: [], pumpSession: null, tummySession: null,
    tummyGoalMinutes: 20, growthMeasurements: [], babyDob: '2026-01-01', session: null, theme: 'light',
  }
}

test.beforeEach(async ({ request, page }) => {
  const response = await request.put('/api/state', { data: fixture() })
  expect(response.ok()).toBeTruthy()
  await page.addInitScript(() => localStorage.setItem('baby-feeding-tracker:v1:live-sync-enabled', 'off'))
  await page.goto('/')
  await expect(page.getByRole('group', { name: /today's rhythm:/i })).toBeVisible()
})

test('DayRibbon keeps the viewport clean and closes back to its trigger', async ({ page }) => {
  const ribbon = page.getByRole('group', { name: /today's rhythm:/i })
  await ribbon.click()
  const dialog = page.getByRole('dialog', { name: "Today's rhythm" })
  await expect(dialog).toBeVisible()
  const geometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, scrollWidth: document.documentElement.scrollWidth }
  })
  expect(geometry.left).toBeGreaterThanOrEqual(-1)
  expect(geometry.top).toBeGreaterThanOrEqual(-1)
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1)
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)
  await expect(dialog.getByRole('button', { name: /nursing at/i })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /bottle at/i })).toBeVisible()
  await dialog.getByRole('button', { name: 'Wet diaper at 8:18 AM' }).click()
  await expect(dialog.getByRole('status')).toContainText(/wet.*diaper/i)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(ribbon).toBeFocused()
})

test('DayRibbon supports dense timeline selection and close-button focus return', async ({ page }) => {
  const ribbon = page.getByRole('group', { name: /today's rhythm:/i })
  await ribbon.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: "Today's rhythm" })
  const events = dialog.locator('.rhythm-stage-event, .rhythm-stage-diaper')
  await expect(events).toHaveCount(4)
  const rows = await events.evaluateAll((items) => items.map((item) => getComputedStyle(item).getPropertyValue('--rhythm-event-row')))
  expect(new Set(rows).size).toBeGreaterThanOrEqual(3)
  await dialog.getByRole('button', { name: /bottle at/i }).click()
  await expect(dialog.getByRole('status')).toContainText(/bottle/i)
  await dialog.getByRole('button', { name: 'Close expanded rhythm' }).click()
  await expect(dialog).toBeHidden()
  await expect(ribbon).toBeFocused()
})
