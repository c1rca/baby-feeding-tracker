import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.BROWSER_BASE_URL
if (!baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1):8081\/?$/.test(baseURL)) {
  throw new Error('BROWSER_BASE_URL must be exactly http://localhost:8081 or http://127.0.0.1:8081; refusing any other target.')
}

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/browser-report' }]],
  outputDir: 'test-results/browser-artifacts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 375, height: 812 } } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
})
