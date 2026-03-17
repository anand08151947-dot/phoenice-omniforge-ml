# run-tests.ps1
# ─────────────────────────────────────────────────────────────────────────────
# Phoenice OmniForge ML — Full Test Suite Runner (Windows)
#
# Usage:
#   .\scripts\run-tests.ps1               # Build + Backend + Sanity (if servers up)
#   .\scripts\run-tests.ps1 -Backend      # Backend unit/contract tests (pytest, in-memory DB)
#   .\scripts\run-tests.ps1 -Build        # TypeScript build check + Python import check
#   .\scripts\run-tests.ps1 -Sanity       # Live-server smoke tests (requires running backend)
#   .\scripts\run-tests.ps1 -Integration  # Integration tests requiring live PostgreSQL + MinIO
#   .\scripts\run-tests.ps1 -E2E          # Playwright E2E tests (requires both servers up)
#   .\scripts\run-tests.ps1 -E2EHeaded    # Playwright with browser visible
#   .\scripts\run-tests.ps1 -All          # All phases
#
# Prerequisites for Sanity/E2E tests:
#   1. API server running:  uvicorn omniforge.api.main:app --reload --port 8000
#   2. Dev server running:  cd client; npm run dev
#
# Run from project root:  .\scripts\run-tests.ps1
# ─────────────────────────────────────────────────────────────────────────────

param(
    [switch]$Backend,
    [switch]$Build,
    [switch]$Sanity,
    [switch]$Integration,
    [switch]$E2E,
    [switch]$E2EHeaded,
    [switch]$All
)

$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root ".venv\Scripts\python.exe"
$clientDir = Join-Path $root "client"
$e2eDir = Join-Path $root "tests\e2e"
$apiBase = "http://localhost:8000"
$frontendBase = "http://localhost:5173"

# No flags = default run (Build + Backend + auto-Sanity if servers up)
$runAll = -not ($Backend -or $Build -or $Sanity -or $Integration -or $E2E -or $E2EHeaded -or $All)

$buildPassed      = $null   # $null = skipped
$backendPassed    = $null
$sanityPassed     = $null
$integrationPassed = $null
$e2ePassed        = $null

# ─────────────────────────────────────────────────────────────────────────────

function Write-Header([string]$title) {
    $line = "─" * 64
    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host $line -ForegroundColor Cyan
}

function Write-Step([string]$msg) {
    Write-Host "  » $msg" -ForegroundColor DarkGray
}

function Write-Pass([string]$msg) {
    Write-Host "  ✅ $msg" -ForegroundColor Green
}

function Write-Fail([string]$msg) {
    Write-Host "  ❌ $msg" -ForegroundColor Red
}

function Write-Skip([string]$msg) {
    Write-Host "  ⏭  $msg" -ForegroundColor Yellow
}

function Test-ServerReachable([string]$url) {
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
        return $r.StatusCode -lt 500
    } catch { return $false }
}

function Invoke-SanityCheck([string]$label, [string]$url, [int[]]$okCodes = @(200)) {
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($okCodes -contains $r.StatusCode) {
            Write-Host "    ✓ $label ($($r.StatusCode))" -ForegroundColor Green
            return $true
        } else {
            Write-Host "    ✗ $label — unexpected status $($r.StatusCode)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "    ✗ $label — $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ── BUILD CHECK ───────────────────────────────────────────────────────────────
if ($runAll -or $Build -or $All) {
    Write-Header "BUILD CHECK"
    $buildPassed = $true

    # 1. Python import check
    Write-Step "Checking Python backend imports..."
    if (-not (Test-Path $venv)) {
        Write-Fail "Python venv not found at $venv"
        Write-Host "      Run: python -m venv .venv && .venv\Scripts\pip install -e .[dev]" -ForegroundColor Yellow
        $buildPassed = $false
    } else {
        & $venv -c "from omniforge.api.main import app; print('    imports OK')" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Backend import failed — fix import errors above"
            $buildPassed = $false
        } else {
            Write-Pass "Backend imports OK"
        }
    }

    # 2. TypeScript build check
    Write-Step "Checking TypeScript build..."
    if (-not (Test-Path $clientDir)) {
        Write-Fail "client/ directory not found"
        $buildPassed = $false
    } else {
        Push-Location $clientDir
        & npm run build 2>&1 | Tee-Object -Variable npmOut | Out-Null
        $tsBuildOk = ($LASTEXITCODE -eq 0)
        Pop-Location

        if ($tsBuildOk) {
            Write-Pass "TypeScript build OK"
        } else {
            Write-Fail "TypeScript build FAILED"
            $npmOut | Select-Object -Last 30 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
            $buildPassed = $false
        }
    }
}

# ── BACKEND UNIT / CONTRACT TESTS (pytest, in-memory SQLite) ─────────────────
if ($runAll -or $Backend -or $All) {
    Write-Header "BACKEND TESTS (pytest — in-memory SQLite)"

    if (-not (Test-Path $venv)) {
        Write-Fail "Python venv not found at $venv"
        $backendPassed = $false
    } else {
        Push-Location $root
        & $venv -m pytest tests/ `
            -v --tb=short --no-header `
            --ignore=tests/e2e `
            -m "not integration" `
            -q
        $backendPassed = ($LASTEXITCODE -eq 0)
        Pop-Location

        if ($backendPassed) {
            Write-Pass "All backend tests PASSED"
        } else {
            Write-Fail "Backend tests FAILED — see output above"
        }
    }
}

# ── SANITY CHECKS (live-server smoke tests) ───────────────────────────────────
$apiUp = Test-ServerReachable "$apiBase/api/datasets"
$devUp = Test-ServerReachable $frontendBase

if ($Sanity -or $All) {
    Write-Header "SANITY CHECKS (live-server smoke)"

    if (-not $apiUp) {
        Write-Skip "API server not reachable at $apiBase"
        Write-Host "    Start: uvicorn omniforge.api.main:app --reload --port 8000" -ForegroundColor Yellow
        $sanityPassed = $false
    } else {
        $checks = @(
            @{ label = "GET /api/datasets";        url = "$apiBase/api/datasets" },
            @{ label = "GET /api/session";         url = "$apiBase/api/session" },
            @{ label = "GET /api/projects";        url = "$apiBase/api/projects" },
            @{ label = "GET /api/admin/overview";  url = "$apiBase/api/admin/overview" },
            @{ label = "GET /api/admin/activity";  url = "$apiBase/api/admin/activity" },
            @{ label = "GET /api/deploy/list";     url = "$apiBase/api/deploy/list" },
            @{ label = "GET /api/chat/status";     url = "$apiBase/api/chat/status" },
            @{ label = "GET /api/deploy/monitoring"; url = "$apiBase/api/deploy/monitoring" }
        )
        $allOk = $true
        foreach ($c in $checks) {
            $ok = Invoke-SanityCheck $c.label $c.url
            if (-not $ok) { $allOk = $false }
        }

        # Frontend reachable?
        if ($devUp) {
            Write-Host "    ✓ Frontend reachable at $frontendBase" -ForegroundColor Green
        } else {
            Write-Host "    ⚠  Frontend not reachable at $frontendBase (start: cd client && npm run dev)" -ForegroundColor Yellow
        }

        $sanityPassed = $allOk
        if ($sanityPassed) { Write-Pass "All sanity checks PASSED" }
        else                { Write-Fail "Some sanity checks FAILED — see above" }
    }
} elseif ($runAll -and $apiUp) {
    # In default run, auto-run sanity if backend is already up (non-blocking)
    Write-Header "SANITY CHECKS (live-server — auto-detected)"
    $checks = @(
        @{ label = "GET /api/datasets";       url = "$apiBase/api/datasets" },
        @{ label = "GET /api/session";        url = "$apiBase/api/session" },
        @{ label = "GET /api/projects";       url = "$apiBase/api/projects" },
        @{ label = "GET /api/admin/overview"; url = "$apiBase/api/admin/overview" },
        @{ label = "GET /api/chat/status";    url = "$apiBase/api/chat/status" }
    )
    $allOk = $true
    foreach ($c in $checks) {
        $ok = Invoke-SanityCheck $c.label $c.url
        if (-not $ok) { $allOk = $false }
    }
    $sanityPassed = $allOk
    if ($sanityPassed) { Write-Pass "Auto-sanity checks PASSED" }
    else               { Write-Fail "Some auto-sanity checks FAILED" }
} elseif ($runAll -and -not $apiUp) {
    Write-Header "SANITY CHECKS"
    Write-Skip "Backend not running — sanity skipped (start: uvicorn omniforge.api.main:app --reload --port 8000)"
}

# ── INTEGRATION TESTS (requires live PostgreSQL + MinIO) ─────────────────────
if ($Integration -or $All) {
    Write-Header "INTEGRATION TESTS (live PostgreSQL + MinIO)"

    if (-not $apiUp) {
        Write-Skip "Backend not reachable — integration tests require live services"
        Write-Host "    Ensure PostgreSQL and MinIO are running (docker compose up -d)" -ForegroundColor Yellow
        $integrationPassed = $false
    } else {
        Push-Location $root
        & $venv -m pytest tests/ `
            -v --tb=short --no-header `
            -m "integration" `
            -q
        $integrationPassed = ($LASTEXITCODE -eq 0)
        Pop-Location

        if ($integrationPassed) { Write-Pass "Integration tests PASSED" }
        else                    { Write-Fail "Integration tests FAILED — see output above" }
    }
}

# ── FRONTEND E2E TESTS (Playwright) ───────────────────────────────────────────
if ($E2E -or $E2EHeaded -or $All) {
    Write-Header "FRONTEND E2E TESTS (Playwright)"

    if (-not $apiUp) {
        Write-Skip "API not reachable — start: uvicorn omniforge.api.main:app --reload --port 8000"
        $e2ePassed = $false
    } elseif (-not $devUp) {
        Write-Skip "Frontend not reachable — start: cd client && npm run dev"
        $e2ePassed = $false
    } elseif (-not (Test-Path $e2eDir)) {
        Write-Skip "E2E test directory not found at tests\e2e — Playwright tests not yet written"
        $e2ePassed = $null  # not a failure, just missing
    } else {
        $nodeModules = Join-Path $e2eDir "node_modules"
        if (-not (Test-Path $nodeModules)) {
            Write-Step "Installing Playwright dependencies..."
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
            Write-Pass "E2E tests PASSED"
        } else {
            Write-Fail "E2E tests FAILED"
            Write-Host "    HTML report: tests\e2e\playwright-report\index.html" -ForegroundColor Gray
            Write-Host "    View with:   cd tests\e2e && npx playwright show-report" -ForegroundColor Gray
        }
    }
}

# ── SUMMARY ───────────────────────────────────────────────────────────────────
Write-Header "SUMMARY"

function Write-SummaryLine([string]$label, $passed) {
    if ($null -eq $passed) {
        Write-Host "  ⏭  $label — SKIPPED" -ForegroundColor Yellow
    } elseif ($passed) {
        Write-Host "  ✅ $label — PASSED" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $label — FAILED" -ForegroundColor Red
    }
}

Write-SummaryLine "Build Check (TS + Python imports)" $buildPassed
Write-SummaryLine "Backend Tests (pytest)"            $backendPassed
Write-SummaryLine "Sanity Checks (live smoke)"        $sanityPassed
Write-SummaryLine "Integration Tests"                 $integrationPassed
Write-SummaryLine "E2E Tests (Playwright)"            $e2ePassed

Write-Host ""

# Exit non-zero if any ran and failed (skipped = OK)
$anyFailed = ($buildPassed -eq $false) -or ($backendPassed -eq $false) -or
             ($sanityPassed -eq $false) -or ($integrationPassed -eq $false) -or
             ($e2ePassed -eq $false)

if ($anyFailed) { exit 1 }
