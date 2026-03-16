import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for OmniForge ML E2E tests.
 *
 * Prerequisites before running:
 *   1. API server:   cd src && uvicorn omniforge.api.main:app --port 8000
 *   2. Dev server:   cd client && npm run dev
 *
 * Then run from tests/e2e/:
 *   npm test                    — headless, all tests
 *   npm run test:headed         — with browser visible
 *   npm run test:ui             — interactive Playwright UI
 *   npm run test:screens        — screens only
 *   npm run test:api-routes     — API route validation only
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,           // run sequentially so servers aren't overwhelmed
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
