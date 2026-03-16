# Phoenice OmniForge ML — Tech Stack Reference

> **Status:** Confirmed decisions. All implementation work must reference this document.  
> See [BACKLOG.md](./BACKLOG.md) for phase sequencing and feature dependencies.

---

## Confirmed Decisions

| # | Decision | Choice | Migration Path |
|---|----------|--------|---------------|
| 1 | Database | **SQLite** (dev/local) | → PostgreSQL 16 (production) |
| 2 | Experiment Tracking | **MLflow 2.x** (self-hosted) | — |
| 3 | Package Manager | **uv** | — |
| 4 | Object Store | **MinIO** (S3-compatible) | → AWS S3 / GCS (same client code) |
| 5 | ML Runtime | **PyTorch 2.3 + scikit-learn 1.5+** | — (no TensorFlow) |

---

## Full Stack

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                   │
│  React 18 · Vite 5 · TypeScript 5.5 · MUI v6           │
│  TanStack Query v5 · Zustand · React Router v6          │
│  Recharts · Plotly.js · AG Grid Community               │
│  React Hook Form + Zod · openapi-typescript (codegen)   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / SSE / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                    BACKEND (Python 3.12)                │
│  FastAPI 0.115+ · Uvicorn · Pydantic v2                 │
├────────────────────────┬────────────────────────────────┤
│   ASYNC JOBS           │   ML / DATA SCIENCE            │
│   Celery 5             │   scikit-learn 1.5+            │
│   Redis 7 (broker)     │   PyTorch 2.3                  │
│   Flower (dev monitor) │   XGBoost · LightGBM · CatBoost│
│                        │   Optuna 3 (HPO)               │
│                        │   pandas 2 · numpy 2 · scipy   │
│                        │   SHAP · LIME · DiCE-ml        │
│                        │   imbalanced-learn             │
│                        │   ydata-profiling              │
│                        │   statsmodels · umap-learn     │
│                        │   SDV · CTGAN (Phase A)        │
├────────────────────────┼────────────────────────────────┤
│   EXPERIMENT TRACKING  │   AI / LLM                     │
│   MLflow 2.x           │   openai SDK → LM Studio       │
│   MLflow Model Registry│   (local, OpenAI-compatible)   │
├────────────────────────┴────────────────────────────────┤
│                    DATA LAYER                           │
│  SQLite (dev)  ──►  PostgreSQL 16 (prod)               │
│  SQLAlchemy 2 (async) · Alembic (migrations)            │
│  MinIO (S3-compatible object store)                     │
│  Redis 7 (Celery broker + result cache)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Layer Detail

### 1 — API Runtime

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | FastAPI 0.115+ | Async-native; auto OpenAPI 3.1; SSE streaming |
| ASGI server | Uvicorn + Gunicorn | Gunicorn manages Uvicorn workers in production |
| Validation | Pydantic v2 | API schemas double as ML config objects |
| Python | **3.12** | Best performance; all ML libs fully support it |
| Package manager | **uv** | 10–100× faster than pip; deterministic lockfile (`uv.lock`) |
| Env config | python-dotenv + `.env` files | Per-environment; never committed |

### 2 — Async Job Processing

| Concern | Choice | Notes |
|---------|--------|-------|
| Task queue | Celery 5 | Retries, ETA, chords, chains; replaces ad-hoc job-ID polling |
| Broker | Redis 7 | Also used as Celery result backend and API cache |
| Progress streaming | FastAPI SSE | Celery publishes progress events; API streams to browser |
| Task monitor | Flower | Real-time worker/task dashboard (dev environment only) |
| Scheduled jobs | Celery Beat | Cron-based retraining (Phase 13) |

### 3 — Data Storage

| Concern | Dev (local) | Prod | Notes |
|---------|-------------|------|-------|
| Metadata DB | **SQLite** | PostgreSQL 16 | `DATABASE_URL` env var switches backend |
| ORM | SQLAlchemy 2 (async) | ← same | Async sessions match FastAPI model |
| Migrations | Alembic | ← same | Schema versioning across both backends |
| Object store | **MinIO** | MinIO / AWS S3 | Same boto3/MinIO client; endpoint URL swapped |
| Cache | Redis 7 | ← same | Celery results, API response cache |

> **SQLite → PostgreSQL migration path:**  
> All queries written via SQLAlchemy ORM (no raw SQL dialect-specific syntax).  
> Switch is one env-var change: `DATABASE_URL=postgresql+asyncpg://...`  
> Alembic migration scripts work against both backends.  
> Concurrency note: SQLite write-lock is acceptable for single-user local dev; Celery workers  
> should run with `--concurrency=1` in SQLite mode to avoid contention.

### 4 — ML & Data Science

| Category | Library | Phase Introduced |
|----------|---------|-----------------|
| Core data | pandas 2, numpy 2, scipy | Phase 0 |
| ML pipelines | **scikit-learn 1.5+** | Phase 0 |
| Gradient boosting | XGBoost 2, LightGBM 4, CatBoost 1.2 | Phase 0 |
| Deep learning | **PyTorch 2.3** (CPU + CUDA; no TensorFlow) | Phase 0 |
| HPO | Optuna 3 | Phase 0 |
| Statistical tests | statsmodels | Phase 1, 2 |
| EDA report | ydata-profiling 4 | Phase 2 |
| Imbalanced data | imbalanced-learn 0.12 | Phase 4 |
| Explainability | SHAP 0.45, LIME, DiCE-ml | Phase 0, 10 |
| Dimensionality | umap-learn, scikit-learn PCA | Phase 6 |
| Feature encoding | category-encoders | Phase 5 |
| Text features | scikit-learn TF-IDF, nltk | Phase 5 |
| Synthetic data | SDV 1.x, CTGAN | Phase A |
| Time-series | statsforecast, Prophet | Phase 7 |
| Survival | lifelines | Phase 7 |
| ONNX serving | onnx, skl2onnx, onnxruntime | Phase 11 |
| Fuzzy matching | jellyfish, recordlinkage | Phase 3 |
| Feature selection | boruta-py | Phase 6 |

> **No TensorFlow.** PyTorch covers all deep learning needs. TF would add ~2 GB to the Docker image
> with no unique capability. scikit-learn MLP covers lightweight neural nets.

### 5 — Experiment Tracking (MLflow)

| Concern | Choice | Notes |
|---------|--------|-------|
| Tracking server | **MLflow 2.x** (self-hosted) | Tracks params, metrics, artifacts, tags per run |
| Backend store | SQLite (dev) → PostgreSQL (prod) | Shares the same DB as the main app |
| Artifact store | **MinIO** (S3-compatible) | Model `.pkl` / ONNX files, EDA HTML reports |
| Model Registry | MLflow Model Registry | Versioning, staging (None → Staging → Production) |
| UI | MLflow built-in UI | Available at `http://localhost:5000` in dev |

> The React frontend calls MLflow's REST API directly for run/experiment data.
> Custom leaderboard UI wraps MLflow API responses — no duplicate storage.

### 6 — AI / LM Studio Integration

| Concern | Choice | Notes |
|---------|--------|-------|
| LLM client | openai Python SDK 1.x | LM Studio exposes OpenAI-compatible `/v1` endpoint |
| Provider abstraction | `LLM_BASE_URL` + `LLM_MODEL` env vars | Swap LM Studio → Ollama → OpenAI by changing `.env` |
| Prompt management | `PromptRegistry` class | Versioned, testable prompt templates per use case |
| Embeddings | openai SDK `/embeddings` → LM Studio | Text column semantic embeddings (Phase 5.3) |
| Graceful degradation | All AI calls in `try/except` | LM Studio offline → rule-based fallback; platform still works |

### 7 — Frontend

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | React 18 + Vite 5 | Fast HMR; excellent TypeScript support |
| Language | TypeScript 5.5 (strict) | Interface types generated from OpenAPI spec |
| UI components | MUI v6 (Material UI) | Consistent, accessible component library |
| Server state | TanStack Query v5 | Cache, refetch, pagination, SSE streaming hooks |
| Client state | Zustand | Pipeline wizard state, chat session, user prefs |
| Standard charts | Recharts | Responsive bar, line, histogram, pie |
| Scientific charts | Plotly.js (react-plotly.js) | SHAP beeswarm, correlation heatmaps, 3D plots |
| Data grids | AG Grid Community | Leaderboard, feature tables, run comparison |
| Forms | React Hook Form + Zod | Validation mirrors backend Pydantic schemas |
| Routing | React Router v6 | SPA routing |
| API client | openapi-typescript (codegen) | Type-safe; regenerated on every backend schema change |
| Streaming | EventSource (native browser API) | Training progress, chat token streaming |

### 8 — Testing

| Layer | Tool | Scope |
|-------|------|-------|
| Backend unit | pytest + pytest-asyncio | Pure functions, ML logic, deterministic (fixed seed) |
| Backend integration | httpx.AsyncClient (FastAPI test client) | API endpoint tests |
| Backend fixtures | factory-boy + faker | Test data generation |
| Frontend unit | Vitest + React Testing Library | Component tests |
| Frontend API mock | MSW (Mock Service Worker) | Frontend dev without backend running |
| E2E | Playwright | Full pipeline smoke tests |
| Coverage | pytest-cov (Python) + c8 (Vite) | Target ≥ 80 % |

### 9 — Code Quality & DevOps

| Concern | Choice | Notes |
|---------|--------|-------|
| Python lint/format | **Ruff** | Replaces black + flake8 + isort; ~100× faster |
| Python type check | mypy (strict) | Pre-commit gate |
| Pre-commit hooks | pre-commit | Ruff + mypy + trailing whitespace on commit |
| TS lint/format | ESLint + Prettier | Standard React/TS config |
| Containerization | Docker + Docker Compose | `docker compose up` → full stack |
| CI/CD | GitHub Actions | Build, test, lint on every PR |
| Task runner | Makefile | `make dev`, `make test`, `make build`, `make migrate` |

---

## Docker Compose Services

```yaml
services:
  api:        # FastAPI + Uvicorn (port 8000)
  worker:     # Celery ML job worker
  flower:     # Celery task monitor — dev only (port 5555)
  redis:      # Broker + cache (port 6379)
  minio:      # Object store (port 9000 API, 9001 console)
  mlflow:     # Experiment tracking server (port 5000)
  frontend:   # Vite dev server (port 3000) / nginx (prod)
  # postgres: # Uncomment when migrating from SQLite to PostgreSQL
```

**Single command to start everything:**
```bash
docker compose up
```

**SQLite mode (no Docker needed for dev):**
```bash
make dev   # starts api + worker + mlflow locally; uses SQLite + local MinIO
```

---

## Project Directory Layout

```
phoenice-omniforge-ml/
├── src/
│   └── omniforge/
│       ├── api/
│       │   ├── routers/          # One router per domain (upload, profile, eda, ...)
│       │   ├── main.py           # FastAPI app factory
│       │   └── deps.py           # Shared FastAPI dependencies
│       ├── core/                 # Config (pydantic-settings), logging, exceptions
│       ├── db/                   # SQLAlchemy models + Alembic migrations
│       ├── storage/              # MinIO client wrapper
│       ├── tasks/                # Celery task definitions (one module per phase)
│       ├── ml/                   # Phase-aligned ML modules
│       │   ├── profiling/        # Phase 1
│       │   ├── eda/              # Phase 2
│       │   ├── cleaning/         # Phase 3
│       │   ├── sampling/         # Phase 4
│       │   ├── features/         # Phase 5
│       │   ├── selection/        # Phase 6
│       │   ├── training/         # Phase 7
│       │   ├── robustness/       # Phase 8
│       │   ├── evaluation/       # Phase 9
│       │   ├── explain/          # Phase 10
│       │   └── deploy/           # Phase 11
│       ├── ai/                   # LM Studio client + PromptRegistry (Phase 14)
│       └── pii/                  # PII detection + anonymization (Phase A)
├── client/                       # React + Vite frontend
│   ├── src/
│   │   ├── api/                  # Auto-generated OpenAPI client
│   │   ├── components/           # Reusable UI components
│   │   ├── pages/                # One folder per phase/feature
│   │   ├── hooks/                # TanStack Query + custom hooks
│   │   └── stores/               # Zustand stores
│   └── vite.config.ts
├── tests/                        # pytest — mirrors src/omniforge/ structure
├── docker/                       # Per-service Dockerfiles
├── docker-compose.yml
├── docker-compose.prod.yml       # PostgreSQL variant
├── Makefile
├── pyproject.toml                # uv project file (replaces requirements.txt)
├── uv.lock                       # Lockfile — committed to repo
├── alembic.ini
├── .env.example                  # Template — never commit .env
├── BACKLOG.md                    # Phase sequencing & feature backlog
└── TECH_STACK.md                 # ← this file
```

---

## Environment Variables Reference

```bash
# ── Database ──────────────────────────────────────────────
DATABASE_URL=sqlite+aiosqlite:///./omniforge.db      # dev default
# DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/omniforge  # prod

# ── Redis ─────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0

# ── MinIO / S3 ────────────────────────────────────────────
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=omniforge
MINIO_SECURE=false

# ── MLflow ────────────────────────────────────────────────
MLFLOW_TRACKING_URI=http://localhost:5000
MLFLOW_S3_ENDPOINT_URL=http://localhost:9000   # MinIO as artifact store

# ── LM Studio / LLM ───────────────────────────────────────
LLM_BASE_URL=http://localhost:1234/v1          # LM Studio default
LLM_MODEL=local-model                          # model name loaded in LM Studio
LLM_ENABLED=true                               # false = skip all AI calls gracefully

# ── App ───────────────────────────────────────────────────
APP_ENV=development                            # development | production
SECRET_KEY=change-me-in-production
```

---

## Phase-to-Dependency Mapping

> Libraries are added to `pyproject.toml` only when their phase begins — not upfront.

| Phase | New `pip` Dependencies Added |
|-------|------------------------------|
| 0 — Foundation | `fastapi uvicorn[standard] pydantic[email] sqlalchemy[asyncio] aiosqlite alembic celery redis flower python-dotenv mlflow boto3 minio` |
| 0 — ML baseline | `scikit-learn pandas numpy scipy xgboost lightgbm catboost torch optuna shap lime` |
| A — PII & Privacy | `sdv ctgan faker` |
| 1 — Profiling | `statsmodels ydata-profiling` |
| 3 — Cleaning | `jellyfish recordlinkage` |
| 4 — Imbalanced Data | `imbalanced-learn` |
| 5 — Feature Eng. | `category-encoders nltk holidays` |
| 6 — Feature Selection | `umap-learn boruta` |
| 10 — XAI | `dice-ml` |
| 11 — MLOps | `onnx skl2onnx onnxruntime` |
| 13 — Orchestration | `celery[beat]` (already installed; enable Beat scheduler) |
| 14 — AI Layer | `openai tiktoken` |
| 16 — Data Sources | `sqlalchemy[all] kafka-python` |
| 17 — Collaboration | `fastapi-users[sqlalchemy]` |

---

*Last updated: 2026-03-15*  
*Project: Phoenice OmniForge ML*
