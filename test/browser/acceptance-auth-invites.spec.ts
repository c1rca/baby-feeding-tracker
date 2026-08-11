import { expect, test } from '@playwright/test'
import { isIsolatedTarget, NOT_ISOLATED_REASON } from './helpers/acceptance'

test.describe.configure({ mode: 'serial' })

test.describe('acceptance: authenticated household invite', () => {
  test.skip(({ baseURL }) => !isIsolatedTarget(baseURL) || process.env.BROWSER_AUTH_REQUIRED !== '1', `${NOT_ISOLATED_REASON}; set BROWSER_AUTH_REQUIRED=1`)

  test('owner signs up, sends an invite, and a separate caregiver browser redeems it', async ({ browser, baseURL }, testInfo) => {
    const ownerContext = await browser.newContext()
    const owner = await ownerContext.newPage()
    const suffix = testInfo.project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const ownerEmail = `owner-${suffix}@example.com`
    const caregiverEmail = `caregiver-${suffix}@example.com`
    try {
      await owner.goto(baseURL!)
      await owner.getByRole('button', { name: 'Create account with email' }).click()
      await owner.getByLabel('Email', { exact: true }).fill(ownerEmail)
      await owner.getByLabel('Display name').fill('Owner')
      await owner.getByLabel('Password', { exact: true }).fill('owner-acceptance-password')
      await owner.getByLabel('Household name').fill('Acceptance Home')
      await owner.getByLabel('Baby name').fill('Baby')
      await owner.getByLabel('Baby date of birth').fill('2026-06-03')
      await owner.getByRole('button', { name: 'Create account', exact: true }).click()
      await owner.getByRole('button', { name: /Settings|Open settings/i }).click()
      await owner.getByRole('tab', { name: /Household/i }).click()
      await owner.getByLabel(/Invite email/i).fill(caregiverEmail)
      await owner.getByRole('button', { name: /Send invite/i }).click()
      const token = await owner.locator('text=/^[a-f0-9]{32}$/i').textContent()
      expect(token).toMatch(/^[a-f0-9]{32}$/i)

      const caregiverContext = await browser.newContext()
      try {
        const caregiver = await caregiverContext.newPage()
        await caregiver.goto(`${baseURL}/#invite=${token}`)
        await expect(caregiver.getByRole('heading', { name: 'Join your household' })).toBeVisible()
        await caregiver.getByLabel('Email', { exact: true }).fill(caregiverEmail)
        await caregiver.getByLabel('Display name').fill('Caregiver')
        await caregiver.getByLabel('Password', { exact: true }).fill('caregiver-acceptance-password')
        await caregiver.getByRole('button', { name: 'Join household' }).click()
        await expect(caregiver.getByRole('button', { name: /Track/i })).toBeVisible()
        expect(caregiver.url()).not.toContain('invite=')
      } finally {
        await caregiverContext.close()
      }
    } finally {
      await ownerContext.close()
    }
  })
})
