#!/usr/bin/env pwsh
# start-dev.ps1 — One-command startup for all OmniForge dev services after a reboot.
#
# Docker  : postgres, redis, minio, mlflow, flower  (infrastructure)
# Local   : uvicorn API + celery worker  (via .venv — hot-reload)
# Local   : Vite frontend  (npm run dev)
#
# Usage:
#   .\scripts\start-dev.ps1                # Full start (Docker + migrations + all services)
#   .\scripts\start-dev.ps1 -SkipDocker   # Docker already running; skip compose up
#   .\scripts\start-dev.ps1 -SkipMigrations  # Skip alembic upgrade head
#   .\scripts\start-dev.ps1 -SkipCleanup  # Don't kill existing processes on ports
#   .\scripts\start-dev.ps1 -ApiOnly      # Just start API + frontend (Docker/Celery already up)

param(
    [switch]$SkipDocker,
    [switch]$SkipMigrations,
    [switch]$SkipCleanup,
    [switch]$ApiOnly
)

$Root  = Split-Path $PSScriptRoot -Parent
$Venv  = "$Root\.venv\Scripts"
$Py    = "$Venv\python.exe"

Set-Location $Root

function Write-Step([string]$msg)  { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)    { Write-Host "    ✓ $msg" -ForegroundColor Green }
function Write-Warn([string]$msg)  { Write-Host "    ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail([string]$msg)  { Write-Host "    ✗ $msg" -ForegroundColor Red }
function Write-Info([string]$msg)  { Write-Host "    $msg" -ForegroundColor DarkGray }

# ── 0. Kill any processes on dev ports (clean start) ─────────────────────────
function Stop-Port {
    param([int]$Port)
    $pids = netstat -ano | Select-String ":$Port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }
    foreach ($p in $pids) {
        try {
            Stop-Process -Id ([int]$p) -Force -ErrorAction Stop
            Write-Info "Killed PID $p on port $Port"
        } catch { }
    }
}

if (-not $SkipCleanup) {
    Write-Step "Cleaning up ports 8000, 5173, 9000, 9001, 5001, 5555, 6379..."
    foreach ($port in @(8000, 5173, 9000, 9001, 5001, 5555, 6379)) { Stop-Port $port }
    Start-Sleep 1
}

# ── 1. Ensure Docker Desktop is running ───────────────────────────────────────
if (-not $SkipDocker -and -not $ApiOnly) {
    Write-Step "Checking Docker Desktop..."
    $dockerReady = $false
    for ($i = 0; $i -lt 3; $i++) {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
        Start-Sleep 2
    }

    if (-not $dockerReady) {
        Write-Warn "Docker not running — starting Docker Desktop..."
        $dockerDesktop = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerDesktop) {
            Start-Process $dockerDesktop
        } else {
            Write-Error "Docker Desktop not found at '$dockerDesktop'. Please start it manually."
            exit 1
        }
        Write-Info "Waiting for Docker engine (up to 60s)..."
        $retries = 20
        while ($retries -gt 0) {
            Start-Sleep 3
            docker info 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
            $retries--
        }
        if (-not $dockerReady) {
            Write-Error "Docker Desktop did not start in time. Please start it manually and re-run."
            exit 1
        }
        Write-Ok "Docker is ready."
    } else {
        Write-Ok "Docker is running."
    }
}

# ── 2. Docker infrastructure ──────────────────────────────────────────────────
if (-not $SkipDocker -and -not $ApiOnly) {
    Write-Step "Starting Docker infrastructure (postgres, redis, minio, mlflow, flower)..."
    docker compose up -d postgres redis minio mlflow flower
    if ($LASTEXITCODE -ne 0) { Write-Error "docker compose up failed"; exit 1 }
}

# ── 3. Wait for postgres to be healthy ────────────────────────────────────────
if (-not $ApiOnly) {
    Write-Step "Waiting for postgres to be healthy..."
    # Detect container name dynamically
    $pgId = docker compose ps -q postgres 2>$null
    if (-not $pgId) {
        Write-Warn "Could not detect postgres container — skipping health check."
    } else {
        $retries = 20
        while ($retries -gt 0) {
            $status = docker inspect --format "{{.State.Health.Status}}" $pgId 2>$null
            if ($status -eq "healthy") { Write-Ok "Postgres is healthy."; break }
            Start-Sleep 3; $retries--
            Write-Host -NoNewline "."
        }
        Write-Host ""
        if ($retries -eq 0) { Write-Warn "Postgres did not become healthy in time — migrations may fail." }
    }
}

# ── 4. Wait for MinIO and create required buckets ─────────────────────────────
if (-not $ApiOnly) {
    Write-Step "Ensuring MinIO buckets exist (omniforge, models)..."
    $minioReady = $false
    for ($i = 0; $i -lt 10; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:9000/minio/health/live" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -eq 200) { $minioReady = $true; break }
        } catch { }
        Start-Sleep 3
        Write-Host -NoNewline "."
    }
    Write-Host ""

    if ($minioReady) {
        & $Py -c @"
import sys
try:
    import boto3, botocore
    s3 = boto3.client('s3', endpoint_url='http://localhost:9000',
                      aws_access_key_id='minioadmin', aws_secret_access_key='minioadmin',
                      region_name='us-east-1')
    for bucket in ['omniforge', 'models']:
        try:
            s3.create_bucket(Bucket=bucket)
            print(f'    Created bucket: {bucket}')
        except Exception as e:
            msg = str(e)
            if 'BucketAlreadyOwnedByYou' in msg or 'BucketAlreadyExists' in msg:
                print(f'    Bucket exists:  {bucket}')
            else:
                print(f'    WARNING: {bucket}: {e}')
except ImportError:
    print('    boto3 not installed — skipping bucket creation (pip install boto3)')
"@
    } else {
        Write-Warn "MinIO not reachable — skipping bucket creation. Uploads may fail."
    }
}

# ── 5. DB migrations ──────────────────────────────────────────────────────────
if (-not $SkipMigrations -and -not $ApiOnly) {
    Write-Step "Running DB migrations (alembic upgrade head)..."
    if (Test-Path "$Venv\alembic.exe") {
        & "$Venv\alembic.exe" upgrade head
        if ($LASTEXITCODE -ne 0) { Write-Warn "Alembic migration returned non-zero exit. Check output above." }
        else { Write-Ok "Migrations applied." }
    } else {
        # Fallback: run via python -m alembic
        & $Py -m alembic upgrade head
        if ($LASTEXITCODE -ne 0) { Write-Warn "Alembic migration returned non-zero exit. Check output above." }
        else { Write-Ok "Migrations applied." }
    }
}

# ── 6. Celery worker (new terminal) ───────────────────────────────────────────
if (-not $ApiOnly) {
    Write-Step "Starting Celery worker (new window)..."
    if (Test-Path "$Venv\celery.exe") {
        Start-Process powershell -ArgumentList "-NoExit", "-Command",
            "Set-Location '$Root'; Write-Host 'CELERY WORKER' -ForegroundColor Cyan; & '$Venv\celery.exe' -A omniforge.tasks.celery_app worker --loglevel=info --pool=solo"
        Write-Ok "Celery worker window opened."
    } else {
        Write-Warn "celery.exe not found in venv — skipping. Run: pip install celery"
    }
}

# ── 7. API server (new terminal) ──────────────────────────────────────────────
Write-Step "Starting API server on :8000 (new window)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$Root'; Write-Host 'OMNIFORGE API' -ForegroundColor Cyan; & '$Venv\uvicorn.exe' omniforge.api.main:app --reload --port 8000"
Write-Ok "API window opened."

# ── 8. Frontend dev server (new terminal) ─────────────────────────────────────
Write-Step "Starting frontend on :5173 (new window)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$Root\client'; Write-Host 'OMNIFORGE FRONTEND' -ForegroundColor Cyan; npm run dev"
Write-Ok "Frontend window opened."

# ── 9. Wait for API + Frontend to become reachable ────────────────────────────
Write-Step "Waiting for services to become reachable..."

function Wait-ForUrl {
    param([string]$Name, [string]$Url, [int]$MaxSeconds = 40)
    Write-Host "    Waiting for $Name" -NoNewline -ForegroundColor DarkGray
    for ($i = 0; $i -lt $MaxSeconds; $i += 2) {
        Start-Sleep 2
        try {
            $r = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -lt 500) { Write-Host " ✓" -ForegroundColor Green; return $true }
        } catch { }
        Write-Host -NoNewline "."
    }
    Write-Host " TIMEOUT" -ForegroundColor Yellow
    return $false
}

$apiUp = Wait-ForUrl "API        (http://localhost:8000/api/datasets)" "http://localhost:8000/api/datasets"
$frontUp = Wait-ForUrl "Frontend   (http://localhost:5173)"              "http://localhost:5173"

# ── 10. Summary ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "─────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "  OmniForge Dev Environment" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────────" -ForegroundColor Cyan

$svc = @(
    @{ Name = "Frontend  "; Url = "http://localhost:5173";       Up = $frontUp },
    @{ Name = "API       "; Url = "http://localhost:8000";       Up = $apiUp   },
    @{ Name = "API Docs  "; Url = "http://localhost:8000/docs";  Up = $apiUp   },
    @{ Name = "MLflow    "; Url = "http://localhost:5001";       Up = $null    },
    @{ Name = "MinIO UI  "; Url = "http://localhost:9001";       Up = $null    },
    @{ Name = "Flower    "; Url = "http://localhost:5555";       Up = $null    }
)

foreach ($s in $svc) {
    if ($s.Up -eq $true)  { Write-Host "  ✅ $($s.Name)  $($s.Url)" -ForegroundColor Green }
    elseif ($s.Up -eq $false) { Write-Host "  ⚠  $($s.Name)  $($s.Url)  (check window)" -ForegroundColor Yellow }
    else                  { Write-Host "     $($s.Name)  $($s.Url)" -ForegroundColor DarkGray }
}

Write-Host ""
Write-Host "  Credentials:" -ForegroundColor DarkGray
Write-Host "    MinIO   — minioadmin / minioadmin" -ForegroundColor DarkGray
Write-Host "    Postgres — omniforge / omniforge   (db: omniforge)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To run tests:    .\scripts\run-tests.ps1" -ForegroundColor DarkGray
Write-Host "  To stop Docker:  docker compose down" -ForegroundColor DarkGray
Write-Host "─────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""
