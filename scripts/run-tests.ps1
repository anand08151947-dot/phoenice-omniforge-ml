# run-tests.ps1
# ─────────────────────────────────────────────────────────────────────────────
# Phoenice OmniForge ML — Full Test Suite Runner (Windows)
#
# Usage:
#   .\scripts\run-tests.ps1               # Run everything
#   .\scripts\run-tests.ps1 -Backend      # Backend API contract tests only
#   .\scripts\run-tests.ps1 -E2E          # Playwright E2E tests only
#   .\scripts\run-tests.ps1 -E2EHeaded    # Playwright with browser visible
#
# Prerequisites for E2E tests:
#   1. API server running:  cd src; uvicorn omniforge.api.main:app --port 8000
#   2. Dev server running:  cd client; npm run dev
#
# Run from project root:  .\scripts\run-tests.ps1
# ─────────────────────────────────────────────────────────────────────────────

param(
    [switch]$Backend,
    [switch]$E2E,
    [switch]$E2EHeaded
)

$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root ".venv\Scripts\python.exe"
$e2eDir = Join-Path $root "tests\e2e"

$runAll = -not ($Backend -or $E2E -or $E2EHeaded)

function Write-Header([string]$title) {
    $line = "─" * 60
    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host $line -ForegroundColor Cyan
}

function Test-ServerReachable([string]$url) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        return $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

$backendPassed = $true
$e2ePassed = $true

# ── Backend API Contract Tests (pytest) ──────────────────────────────────────
if ($runAll -or $Backend) {
    Write-Header "BACKEND API CONTRACT TESTS (pytest)"

    if (-not (Test-Path $venv)) {
        Write-Host "ERROR: Python venv not found at $venv" -ForegroundColor Red
        Write-Host "Run: python -m venv .venv && .venv\Scripts\pip install -e .[dev]" -ForegroundColor Yellow
        $backendPassed = $false
    } else {
        $pytestArgs = @(
            "-m", "pytest",
            "tests/",
            "-v",
            "--tb=short",
            "--no-header",
            "--cov=src/omniforge",
            "--cov-report=term-missing",
            "--cov-report=html:coverage-report",
            "-q"
        )

        Push-Location $root
        & $venv @pytestArgs
        $backendPassed = ($LASTEXITCODE -eq 0)
        Pop-Location

        if ($backendPassed) {
            Write-Host ""
            Write-Host "✅ Backend tests PASSED" -ForegroundColor Green
            Write-Host "   Coverage report: coverage-report/index.html" -ForegroundColor Gray
        } else {
            Write-Host ""
            Write-Host "❌ Backend tests FAILED" -ForegroundColor Red
        }
    }
}

# ── Frontend E2E Tests (Playwright) ──────────────────────────────────────────
if ($runAll -or $E2E -or $E2EHeaded) {
    Write-Header "FRONTEND E2E TESTS (Playwright)"

    # Pre-flight: check servers are running
    $apiUp = Test-ServerReachable "http://localhost:8000/api/datasets"
    $devUp = Test-ServerReachable "http://localhost:5173"

    if (-not $apiUp) {
        Write-Host "  API server not reachable at http://localhost:8000" -ForegroundColor Yellow
        Write-Host "  Start it with: cd src; uvicorn omniforge.api.main:app --port 8000" -ForegroundColor Yellow
    }
    if (-not $devUp) {
        Write-Host "  Dev server not reachable at http://localhost:5173" -ForegroundColor Yellow
        Write-Host "  Start it with: cd client; npm run dev" -ForegroundColor Yellow
    }

    if (-not $apiUp -or -not $devUp) {
        Write-Host ""
        Write-Host "❌ E2E tests SKIPPED — servers must be running first" -ForegroundColor Red
        $e2ePassed = $false
    } else {
        # Install Playwright deps if not yet installed
        $nodeModules = Join-Path $e2eDir "node_modules"
        if (-not (Test-Path $nodeModules)) {
            Write-Host "Installing Playwright dependencies..." -ForegroundColor Gray
            Push-Location $e2eDir
            & npm install
            & npx playwright install chromium --with-deps
            Pop-Location
        }

        Push-Location $e2eDir

        if ($E2EHeaded) {
            & npx playwright test --headed --reporter=list
        } else {
            & npx playwright test --reporter=list
        }

        $e2ePassed = ($LASTEXITCODE -eq 0)
        Pop-Location

        if ($e2ePassed) {
            Write-Host ""
            Write-Host "✅ E2E tests PASSED" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ E2E tests FAILED" -ForegroundColor Red
            Write-Host "   HTML report: tests\e2e\playwright-report\index.html" -ForegroundColor Gray
            Write-Host "   To view:     cd tests\e2e && npx playwright show-report" -ForegroundColor Gray
        }
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Header "SUMMARY"

if ($runAll -or $Backend) {
    $icon = if ($backendPassed) { "✅" } else { "❌" }
    $color = if ($backendPassed) { "Green" } else { "Red" }
    Write-Host "  $icon Backend API Contract Tests (pytest)" -ForegroundColor $color
}
if ($runAll -or $E2E -or $E2EHeaded) {
    $icon = if ($e2ePassed) { "✅" } else { "❌" }
    $color = if ($e2ePassed) { "Green" } else { "Red" }
    Write-Host "  $icon Frontend E2E Tests (Playwright)" -ForegroundColor $color
}

Write-Host ""

$allPassed = $backendPassed -and $e2ePassed
if (-not $allPassed) { exit 1 }
