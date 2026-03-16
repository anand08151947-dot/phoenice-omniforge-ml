import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

/**
 * Screen Loading Tests — validates every frontend page:
 *   ✓ Page loads without a JS crash / React error boundary
 *   ✓ Page title / main heading is visible
 *   ✓ "No dataset selected" guard renders correctly when no datasetId in store
 *   ✓ No unhandled console errors (excluding known non-fatal warnings)
 *
 * These tests run WITHOUT requiring a loaded dataset. Each page must handle
 * the "empty state" gracefully.
 */

// Known non-fatal console messages to ignore (3rd-party libs, dev-mode warnings)
const IGNORED_CONSOLE_PATTERNS = [
  /Download the React DevTools/,
  /react-query/i,
  /Warning: ReactDOM.render/,
  /msw/i,
  /[Ff]ailed to fetch/,      // expected — no dataset in state
  /no_results/,              // expected query error for missing data
  /Network request failed/,  // expected when API not available
]

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      const ignored = IGNORED_CONSOLE_PATTERNS.some((p) => p.test(text))
      if (!ignored) errors.push(text)
    }
  })
  page.on('pageerror', (err) => {
    errors.push(`PAGE ERROR: ${err.message}`)
  })
  return errors
}

async function clearState(page: Page) {
  // Clear Zustand persisted state so each test starts fresh
  await page.addInitScript(() => {
    localStorage.removeItem('pipeline-store')
  })
}

// ─────────────────────────────────────────────────────────────
// Screen definitions: [route, expectedHeading, descriptionText]
// ─────────────────────────────────────────────────────────────
const SCREENS: Array<{
  route: string
  name: string
  headingPattern: RegExp
  expectEmptyAlert?: boolean
}> = [
  {
    route: '/',
    name: 'Home',
    headingPattern: /OmniForge|Welcome|Home|Pipeline/i,
    expectEmptyAlert: false,
  },
  {
    route: '/upload',
    name: 'Upload',
    headingPattern: /Upload|Dataset/i,
    expectEmptyAlert: false,
  },
  {
    route: '/profile',
    name: 'Profile',
    headingPattern: /Profile|Dataset Profile/i,
    expectEmptyAlert: true,
  },
  {
    route: '/pii',
    name: 'PII Scanner',
    headingPattern: /PII|Privacy|Sensitive/i,
    expectEmptyAlert: true,
  },
  {
    route: '/eda',
    name: 'EDA',
    headingPattern: /EDA|Exploratory|Analysis/i,
    expectEmptyAlert: true,
  },
  {
    route: '/cleaning',
    name: 'Cleaning',
    headingPattern: /Clean|Data Clean/i,
    expectEmptyAlert: true,
  },
  {
    route: '/sampling',
    name: 'Sampling',
    headingPattern: /Sampl|Imbalance|Class Balancing/i,
    expectEmptyAlert: true,
  },
  {
    route: '/features',
    name: 'Feature Engineering',
    headingPattern: /Feature|Engineering/i,
    expectEmptyAlert: true,
  },
  {
    route: '/selection',
    name: 'Feature Selection',
    headingPattern: /Selection|Feature Select/i,
    expectEmptyAlert: true,
  },
  {
    route: '/training',
    name: 'Training',
    headingPattern: /Training|AutoML/i,
    expectEmptyAlert: true,
  },
  {
    route: '/evaluation',
    name: 'Evaluation',
    headingPattern: /Evaluation|Evaluate/i,
    expectEmptyAlert: true,
  },
  {
    route: '/explain',
    name: 'Explain / XAI',
    headingPattern: /Explain|SHAP|XAI|Interpret|Explainab/i,
    expectEmptyAlert: true,
  },
  {
    route: '/deploy',
    name: 'Deploy',
    headingPattern: /Deploy|Deployment/i,
    expectEmptyAlert: false,
  },
  {
    route: '/chat',
    name: 'Chat',
    headingPattern: /Chat|Assistant|AI|LM Studio/i,
    expectEmptyAlert: false,
  },
]

for (const screen of SCREENS) {
  test(`[${screen.name}] page loads at ${screen.route}`, async ({ page }) => {
    const errors = collectErrors(page)
    await clearState(page)

    await page.goto(screen.route)

    // Wait for the main content to stabilise (Suspense + lazy load)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
      // networkidle can time out on pages with polling — that's OK
    })

    // 1. No React crash: the page should not show the red route error boundary
    const routeError = page.locator('text=Route Error')
    await expect(routeError).not.toBeVisible({ timeout: 5_000 })

    // 2. Main heading matches expected pattern — search inside <main> only
    //    to avoid matching the AppShell's "OmniForge ML" top-bar title
    const mainContent = page.locator('main').first()
    const headings = mainContent.locator('[class*="MuiTypography-h4"], [class*="MuiTypography-h5"], [class*="MuiTypography-h3"], h1, h2, h3, h4, h5')
    const headingCount = await headings.count()
    let headingText = ''
    if (headingCount > 0) {
      headingText = await headings.first().textContent() ?? ''
    }
    // If no heading found in main, check any heading on the full page that isn't "OmniForge ML"
    if (!headingText || headingText.trim() === '') {
      const anyHeading = page.locator('[class*="MuiTypography-h4"], [class*="MuiTypography-h5"]')
      for (let i = 0; i < await anyHeading.count(); i++) {
        const text = await anyHeading.nth(i).textContent() ?? ''
        if (text.trim() && text !== 'OmniForge ML') {
          headingText = text
          break
        }
      }
    }

    // If still no heading, check if this is an expected empty-state page (no dataset guard)
    const headingFound = screen.headingPattern.test(headingText)
    if (!headingFound && screen.expectEmptyAlert) {
      // Acceptable: page shows "no dataset" alert instead of heading — guard is working correctly
      const alertText = await mainContent.locator('[role="alert"], .MuiAlert-root').first().textContent().catch(() => '')
      const hasEmptyAlert = !!alertText && alertText.length > 0
      expect(
        hasEmptyAlert,
        `${screen.name}: No heading found and no empty-state alert either. Heading was: "${headingText}"`
      ).toBe(true)
    } else {
      expect(
        headingFound,
        `Heading "${headingText}" does not match pattern ${screen.headingPattern} on ${screen.route}`
      ).toBe(true)
    }

    // 3. No unhandled JS errors
    expect(
      errors.filter((e) => !IGNORED_CONSOLE_PATTERNS.some((p) => p.test(e))),
      `Console errors on ${screen.route}: ${errors.join(', ')}`
    ).toHaveLength(0)

    // 4. For pages that guard against missing dataset — check the alert is shown
    if (screen.expectEmptyAlert) {
      const alert = page.locator('[role="alert"], .MuiAlert-root').first()
      // Either shows an alert or is loading — both are acceptable empty states
      const alertVisible = await alert.isVisible().catch(() => false)
      const loading = page.locator('[role="progressbar"]')
      const loadingVisible = await loading.isVisible().catch(() => false)
      expect(
        alertVisible || loadingVisible,
        `${screen.name}: expected an empty-state alert or loading indicator`
      ).toBe(true)
    }
  })
}

// ─────────────────────────────────────────────────────────────
// Special: Upload page — drag-drop zone is visible
// ─────────────────────────────────────────────────────────────
test('[Upload] drop zone is rendered', async ({ page }) => {
  await clearState(page)
  await page.goto('/upload')
  await page.waitForLoadState('networkidle').catch(() => {})

  // react-dropzone renders an element with role="presentation" or input[type=file]
  const dropzone = page.locator('input[type="file"]')
  await expect(dropzone).toBeAttached({ timeout: 10_000 })
})

// ─────────────────────────────────────────────────────────────
// Special: Home page — pipeline phase steps are visible
// ─────────────────────────────────────────────────────────────
test('[Home] pipeline steps are rendered', async ({ page }) => {
  await clearState(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle').catch(() => {})

  // Home page should show multiple pipeline phase cards/steps
  const cards = page.locator('[class*="MuiCard"], [class*="MuiPaper"]')
  const count = await cards.count()
  expect(count, 'Home page should show at least 3 pipeline step cards').toBeGreaterThanOrEqual(3)
})
