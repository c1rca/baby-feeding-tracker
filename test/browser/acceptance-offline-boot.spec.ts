/**
 * Release acceptance matrix — offline boot.
 *
 * A caregiver logging a feed at 3am may well have no signal. The app is a PWA,
 * so opening it offline is meant to work; what matters is that it works on the
 * *first* visit, because a household that installs the app and immediately
 * walks into a basement never gets the second navigation.
 */
import { expect, test } from '@playwright/test'
import {
  cachedPaths, isIsolatedTarget, NOT_ISOLATED_REASON, waitForAppReady,
  waitForServiceWorkerControl,
} from './helpers/acceptance'

test.describe.configure({ mode: 'serial' })

test.describe('acceptance: offline boot', () => {
  test.skip(({ baseURL }) => !isIsolatedTarget(baseURL), NOT_ISOLATED_REASON)

  test('a first visit boots offline without ever having navigated twice', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL! })
    const page = await context.newPage()
    try {
      await page.goto('/')
      await waitForAppReady(page)
      // The worker installs on `load`. Once it controls the page it must
      // already hold everything the app needs to start — not merely the shell.
      await waitForServiceWorkerControl(page)

      const cached = await cachedPaths(page)
      expect(cached, 'the shell itself must be precached').toContain('/')
      expect(
        cached.filter((path) => /^\/assets\/.*\.js$/.test(path)),
        'the script bundle must be precached, or an offline first visit renders a blank page',
      ).not.toHaveLength(0)
      expect(
        cached.filter((path) => /^\/assets\/.*\.css$/.test(path)),
        'the stylesheet must be precached',
      ).not.toHaveLength(0)

      // No priming navigation: straight offline, then reload.
      await context.setOffline(true)
      await page.reload()
      await waitForAppReady(page)
    } finally {
      await context.setOffline(false)
      await context.close()
    }
  })

  test('a failed response is never kept as the offline fallback', async ({ browser, baseURL }) => {
    // A gateway error served mid-deploy used to be cached like any other
    // response, so the app kept handing back a 502 offline long after the
    // deploy had finished.
    const context = await browser.newContext({ baseURL: baseURL! })
    const page = await context.newPage()
    try {
      await page.goto('/')
      await waitForAppReady(page)
      await waitForServiceWorkerControl(page)

      // Routed on the *context*, not the page: the worker controls this client,
      // so the request it makes on the app's behalf originates from the worker
      // and page-level routing never sees it.
      const probe = '/deploy-window-probe.js'
      await context.route(`**${probe}`, (route) => route.fulfill({ status: 502, body: 'bad gateway' }))
      const status = await page.evaluate(async (path) => {
        const response = await fetch(path)
        return response.status
      }, probe)
      expect(status, 'the probe should have been served the failure').toBe(502)

      await expect.poll(async () => (await cachedPaths(page)).includes(probe), {
        message: 'a 502 was written into the cache and would be served offline',
      }).toBe(false)
    } finally {
      await context.close()
    }
  })

  test('the precached bundle matches the bundle the served page actually asks for', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL! })
    const page = await context.newPage()
    try {
      await page.goto('/')
      await waitForAppReady(page)
      await waitForServiceWorkerControl(page)

      // A stale precache list is worse than none: it would pin an old bundle
      // and quietly serve it offline forever.
      const referenced = await page.evaluate(() => [
        ...[...document.querySelectorAll('script[src]')].map((el) => new URL((el as HTMLScriptElement).src).pathname),
        ...[...document.querySelectorAll('link[rel="stylesheet"][href]')].map((el) => new URL((el as HTMLLinkElement).href).pathname),
      ].filter((path) => path.startsWith('/assets/')))

      expect(referenced.length, 'the page should reference hashed assets').toBeGreaterThan(0)
      const cached = await cachedPaths(page)
      for (const path of referenced) {
        expect(cached, `the page asks for ${path} but the worker never cached it`).toContain(path)
      }
    } finally {
      await context.close()
    }
  })
})
