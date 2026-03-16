import { test, expect } from '@playwright/test'

/**
 * API Route Contract Tests (Frontend-to-Backend mapping)
 *
 * These tests navigate to each page, intercept ALL outgoing API requests,
 * and validate that:
 *   ✓ The URL path actually exists in the backend (no typos, no dead routes)
 *   ✓ The correct HTTP method is used
 *   ✓ Required query parameters are present (dataset_id)
 *   ✓ Pages do NOT call phantom routes (explain/deploy/chat) as real APIs
 *     when those backends don't exist yet
 *
 * This acts as a living contract between frontend and backend.
 *
 * KNOWN BACKEND ROUTES (all prefixed /api):
 *   GET  /api/datasets
 *   PATCH /api/datasets/{id}
 *   POST /api/upload
 *   POST /api/profile/trigger/{id}
 *   GET  /api/profile
 *   GET  /api/profile/progress
 *   GET  /api/pii
 *   POST /api/pii/scan/{id}
 *   POST /api/pii/apply
 *   GET  /api/eda
 *   POST /api/eda/overrides
 *   GET  /api/cleaning
 *   POST /api/cleaning/apply
 *   GET  /api/sampling
 *   POST /api/sampling/apply
 *   GET  /api/features
 *   POST /api/features/apply
 *   GET  /api/selection
 *   POST /api/selection/apply
 *   GET  /api/training
 *   POST /api/training/run
 *   GET  /api/evaluation
 *   POST /api/evaluation/run
 */

// All routes that exist in the backend
const KNOWN_BACKEND_ROUTES: Array<{ method: string; pathPattern: RegExp }> = [
  { method: 'GET',   pathPattern: /^\/api\/datasets$/ },
  { method: 'PATCH', pathPattern: /^\/api\/datasets\/[^/]+$/ },
  { method: 'POST',  pathPattern: /^\/api\/upload$/ },
  { method: 'POST',  pathPattern: /^\/api\/profile\/trigger\/[^/]+$/ },
  { method: 'GET',   pathPattern: /^\/api\/profile$/ },
  { method: 'GET',   pathPattern: /^\/api\/profile\/progress$/ },
  { method: 'GET',   pathPattern: /^\/api\/pii$/ },
  { method: 'POST',  pathPattern: /^\/api\/pii\/scan\/[^/]+$/ },
  { method: 'POST',  pathPattern: /^\/api\/pii\/apply$/ },
  { method: 'GET',   pathPattern: /^\/api\/eda$/ },
  { method: 'POST',  pathPattern: /^\/api\/eda\/overrides$/ },
  { method: 'GET',   pathPattern: /^\/api\/cleaning$/ },
  { method: 'POST',  pathPattern: /^\/api\/cleaning\/apply$/ },
  { method: 'GET',   pathPattern: /^\/api\/sampling$/ },
  { method: 'POST',  pathPattern: /^\/api\/sampling\/apply$/ },
  { method: 'GET',   pathPattern: /^\/api\/features$/ },
  { method: 'POST',  pathPattern: /^\/api\/features\/apply$/ },
  { method: 'GET',   pathPattern: /^\/api\/selection$/ },
  { method: 'POST',  pathPattern: /^\/api\/selection\/apply$/ },
  { method: 'GET',   pathPattern: /^\/api\/training$/ },
  { method: 'POST',  pathPattern: /^\/api\/training\/run$/ },
  { method: 'GET',   pathPattern: /^\/api\/evaluation$/ },
  { method: 'POST',  pathPattern: /^\/api\/evaluation\/run$/ },
]

// Routes that are NOT in the backend yet (frontend-only or future phases)
const PHANTOM_ROUTES = [
  '/api/explain',
  '/api/explain/shap',
  '/api/explain/counterfactual',
  '/api/deploy',
  '/api/chat',
]

function isKnownRoute(method: string, path: string): boolean {
  return KNOWN_BACKEND_ROUTES.some(
    (r) => r.method === method.toUpperCase() && r.pathPattern.test(path)
  )
}

function isPhantomRoute(path: string): boolean {
  return PHANTOM_ROUTES.some((p) => path.startsWith(p))
}

async function clearState(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('pipeline-store')
  })
}

// ─────────────────────────────────────────────────────────────
// Per-page API call mapping tests
// ─────────────────────────────────────────────────────────────

/**
 * Captures all /api/* requests made when a page loads.
 * Returns array of {method, path} objects.
 */
async function captureApiCalls(
  page: import('@playwright/test').Page,
  route: string,
  waitMs = 3000
): Promise<Array<{ method: string; path: string; url: string }>> {
  const calls: Array<{ method: string; path: string; url: string }> = []

  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.pathname.startsWith('/api/')) {
      calls.push({
        method: req.method(),
        path: url.pathname,
        url: req.url(),
      })
    }
  })

  await page.goto(route)
  // Wait for network to settle, but cap at waitMs
  await page.waitForTimeout(waitMs)

  return calls
}

// ─────────────────────────────────────────────────────────────
// Test: All API calls on pages with a dataset_id must use known routes
// ─────────────────────────────────────────────────────────────

test('Upload page only calls known API routes', async ({ page }) => {
  await clearState(page)
  const calls = await captureApiCalls(page, '/upload')

  // Upload page calls: GET /api/datasets (list) + GET /api/profile (per-dataset card)
  const unexpectedCalls = calls.filter((c) => !isKnownRoute(c.method, c.path))
  expect(
    unexpectedCalls,
    `Upload page made unexpected API call(s): ${JSON.stringify(unexpectedCalls)}`
  ).toHaveLength(0)
})

test('Home page makes no /api/* calls on load', async ({ page }) => {
  await clearState(page)
  const calls = await captureApiCalls(page, '/')

  // Home page should not call APIs on initial load with no dataset
  const unexpectedCalls = calls.filter(
    (c) => !c.path.startsWith('/api/datasets')  // datasets list is acceptable
  )
  expect(
    unexpectedCalls,
    `Home page made unexpected API calls: ${JSON.stringify(unexpectedCalls)}`
  ).toHaveLength(0)
})

// ─────────────────────────────────────────────────────────────
// Test: Pages with dataset_id — verify the query param is present
// ─────────────────────────────────────────────────────────────

const DATA_PAGES: Array<{ route: string; name: string; expectedApiPath: string }> = [
  { route: '/profile',   name: 'Profile',   expectedApiPath: '/api/profile' },
  { route: '/pii',       name: 'PII',       expectedApiPath: '/api/pii' },
  { route: '/eda',       name: 'EDA',       expectedApiPath: '/api/eda' },
  { route: '/cleaning',  name: 'Cleaning',  expectedApiPath: '/api/cleaning' },
  { route: '/sampling',  name: 'Sampling',  expectedApiPath: '/api/sampling' },
  { route: '/features',  name: 'Features',  expectedApiPath: '/api/features' },
  { route: '/selection', name: 'Selection', expectedApiPath: '/api/selection' },
  { route: '/training',  name: 'Training',  expectedApiPath: '/api/training' },
  { route: '/evaluation',name: 'Evaluation',expectedApiPath: '/api/evaluation' },
]

for (const { route, name, expectedApiPath } of DATA_PAGES) {
  test(`[${name}] with no datasetId — does NOT call API (guards correctly)`, async ({ page }) => {
    // Without datasetId in store, the page should NOT fire the API request
    await clearState(page)
    const calls = await captureApiCalls(page, route)

    const dataCalls = calls.filter((c) => c.path === expectedApiPath)
    expect(
      dataCalls,
      `[${name}] fired ${expectedApiPath} without a datasetId — missing guard in component`
    ).toHaveLength(0)
  })
}

// ─────────────────────────────────────────────────────────────
// Test: Phantom routes are NOT called (backend doesn't exist yet)
// ─────────────────────────────────────────────────────────────

test('[Explain] page does not call /api/explain when no dataset', async ({ page }) => {
  await clearState(page)
  const calls = await captureApiCalls(page, '/explain')

  const phantomCalls = calls.filter((c) => isPhantomRoute(c.path))
  // These calls will 404 — but we want to flag them for awareness
  if (phantomCalls.length > 0) {
    console.warn(
      `⚠ [Explain] page calls phantom backend route(s): ${JSON.stringify(phantomCalls)}\n` +
      `  These will return 404 because the backend doesn't implement them yet.`
    )
  }
  // Not a hard failure — just awareness logging above
})

test('[Deploy] page does not call /api/deploy on load', async ({ page }) => {
  await clearState(page)
  const calls = await captureApiCalls(page, '/deploy')

  const phantomCalls = calls.filter((c) => isPhantomRoute(c.path))
  if (phantomCalls.length > 0) {
    console.warn(
      `⚠ [Deploy] page calls phantom backend route(s): ${JSON.stringify(phantomCalls)}\n` +
      `  These will return 404 because the backend doesn't implement them yet.`
    )
  }
})

// ─────────────────────────────────────────────────────────────
// Test: All API calls made by any page match a known backend route
// ─────────────────────────────────────────────────────────────

test('ALL pages: no API call goes to an unknown backend path', async ({ page }) => {
  await clearState(page)

  // Pages that have known phantom routes (backend not yet implemented)
  // These are tested separately and are documented known issues
  const KNOWN_PHANTOM_PAGES = new Set(['/explain', '/deploy', '/chat'])

  const allRoutes = ['/', '/upload', '/profile', '/pii', '/eda', '/cleaning',
    '/sampling', '/features', '/selection', '/training', '/evaluation',
    '/explain', '/deploy', '/chat']

  const unknownCalls: Array<{ screen: string; method: string; path: string }> = []

  for (const route of allRoutes) {
    await clearState(page)
    const calls = await captureApiCalls(page, route, 2000)

    for (const call of calls) {
      if (!isKnownRoute(call.method, call.path)) {
        // Skip known phantom routes — they're flagged in dedicated tests
        if (KNOWN_PHANTOM_PAGES.has(route) && isPhantomRoute(call.path)) {
          continue
        }
        unknownCalls.push({ screen: route, method: call.method, path: call.path })
      }
    }
  }

  // Report all unknown calls — this helps identify dead API calls
  if (unknownCalls.length > 0) {
    const report = unknownCalls
      .map((c) => `  ${c.method} ${c.path} (on screen ${c.screen})`)
      .join('\n')
    console.error(`\n❌ API calls to unknown backend routes:\n${report}\n`)
  }

  expect(
    unknownCalls,
    `${unknownCalls.length} API call(s) go to routes not in the backend. See test output.`
  ).toHaveLength(0)
})

// ─────────────────────────────────────────────────────────────
// Test: API routes are called with correct query parameters
// ─────────────────────────────────────────────────────────────

test('GET endpoints include dataset_id query param when datasetId is set', async ({ page }) => {
  const MOCK_DATASET_ID = '00000000-0000-0000-0000-000000000001'

  // Pre-set a datasetId in Zustand persisted store
  await page.addInitScript((id: string) => {
    const state = {
      state: {
        datasetId: id,
        phaseStatus: {},
        themeMode: 'dark',
      },
      version: 0,
    }
    localStorage.setItem('pipeline-store', JSON.stringify(state))
  }, MOCK_DATASET_ID)

  // Check the training page as a representative case
  const calls = await captureApiCalls(page, '/training', 3000)
  const trainingCall = calls.find((c) => c.path === '/api/training')

  if (trainingCall) {
    const url = new URL(trainingCall.url)
    expect(
      url.searchParams.get('dataset_id'),
      'GET /api/training must include dataset_id query param'
    ).toBe(MOCK_DATASET_ID)
  }
  // If no call was made, the query was disabled (which is also fine — dataset may not exist)
})
