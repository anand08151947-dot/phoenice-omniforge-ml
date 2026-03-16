#!/usr/bin/env pwsh
# start-dev.ps1 — One-command startup for all OmniForge dev services after a reboot.
#
# Docker  : postgres, redis, minio, mlflow, flower  (infrastructure)
# Local   : uvicorn API + celery worker  (via .venv — hot-reload friendly)
# Local   : Vite frontend  (npm run dev)
#
# Usage: .\scripts\start-dev.ps1

$Root = Split-Path $PSScriptRoot -Parent
$Venv = "$Root\.venv\Scripts"

Set-Location $Root

# ── 0. Kill any processes on dev ports (clean start) ─────────────────────────
function Stop-Port {
    param([int]$Port)
    $pids = netstat -ano | Select-String ":$Port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }
    foreach ($p in $pids) {
        try {
            Stop-Process -Id $p -Force -ErrorAction Stop
            Write-Host "  Killed PID $p on port $Port" -ForegroundColor DarkGray
        } catch { }
    }
}

Write-Host "==> Cleaning up ports 8000, 5173, 5001, 9001, 5555..." -ForegroundColor Cyan
foreach ($port in @(8000, 5173, 5001, 9001, 5555)) { Stop-Port $port }
Start-Sleep 1

# ── 1. Ensure Docker Desktop is running ───────────────────────────────────────
Write-Host "==> Checking Docker Desktop..." -ForegroundColor Cyan
$dockerReady = $false
for ($i = 0; $i -lt 3; $i++) {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
    Start-Sleep 2
}

if (-not $dockerReady) {
    Write-Host "  Docker not running — starting Docker Desktop..." -ForegroundColor Yellow
    $dockerDesktop = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerDesktop) {
        Start-Process $dockerDesktop
    } else {
        Write-Error "Docker Desktop not found at '$dockerDesktop'. Please start it manually."; exit 1
    }
    Write-Host "  Waiting for Docker engine (up to 60s)..." -ForegroundColor Yellow
    $retries = 20
    while ($retries -gt 0) {
        Start-Sleep 3
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
        $retries--
    }
    if (-not $dockerReady) { Write-Error "Docker Desktop did not start in time. Please start it manually and re-run."; exit 1 }
    Write-Host "  Docker is ready." -ForegroundColor Green
}

# ── 2. Docker infrastructure ──────────────────────────────────────────────────
Write-Host "==> Starting Docker infrastructure (postgres, redis, minio, mlflow, flower)..." -ForegroundColor Cyan
docker compose up -d postgres redis minio mlflow flower
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose up failed"; exit 1 }

# ── 3. Wait for postgres ──────────────────────────────────────────────────────
Write-Host "==> Waiting for postgres to be healthy..." -ForegroundColor Cyan
$retries = 20
while ($retries -gt 0) {
    $status = docker inspect --format "{{.State.Health.Status}}" phoenice-omniforge-ml-postgres-1 2>$null
    if ($status -eq "healthy") { break }
    Start-Sleep 3; $retries--
}
if ($retries -eq 0) { Write-Warning "Postgres did not become healthy in time — migrations may fail." }

# ── 4. DB migrations ──────────────────────────────────────────────────────────
Write-Host "==> Running DB migrations..." -ForegroundColor Cyan
& "$Venv\alembic.exe" upgrade head

# ── 5. Celery worker (new terminal) ───────────────────────────────────────────
Write-Host "==> Starting Celery worker..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$Root'; & '$Venv\celery.exe' -A omniforge.tasks.celery_app worker --loglevel=info --pool=solo"

# ── 6. API server (new terminal) ──────────────────────────────────────────────
Write-Host "==> Starting API server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$Root'; & '$Venv\uvicorn.exe' omniforge.api.main:app --reload --port 8000"

# ── 7. Frontend (new terminal) ────────────────────────────────────────────────
Write-Host "==> Starting frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$Root\client'; npm run dev"

Write-Host ""
Write-Host "All services started:" -ForegroundColor Green
Write-Host "  API        -> http://localhost:8000"
Write-Host "  Frontend   -> http://localhost:5173"
Write-Host "  MLflow     -> http://localhost:5001"
Write-Host "  MinIO      -> http://localhost:9001"
Write-Host "  Flower     -> http://localhost:5555"
