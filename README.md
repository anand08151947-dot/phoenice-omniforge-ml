# 🔮 Phoenice OmniForge ML

> **End-to-end AutoML workbench** — from raw data to deployed models, with built-in PII detection, explainability, and LLM-assisted analysis.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-green)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev)

---

## ✨ Features

| Phase | Capability |
|-------|------------|
| **Phase 0** | Dataset upload (CSV, Excel, JSON, Parquet) — MinIO storage |
| **Phase A** | PII detection & masking — column-level actions (mask / hash / drop / pseudonymize / encrypt) |
| **Phase 1** | Statistical profiling — distributions, missingness, skew, outliers |
| **Phase 2** | Exploratory Data Analysis — correlations, target distribution, model-readiness score |
| **Phase 3** | Automated data cleaning — imputation, outlier handling, duplicate removal |
| **Phase 4** | Class balancing — SMOTE, random over/under-sampling, class weights |
| **Phase 5** | Feature engineering — transforms, encoding, date parts, interactions |
| **Phase 6** | Feature selection — importance ranking, recursive elimination |
| **Phase 7** | AutoML training — XGBoost / LightGBM / CatBoost / RF / MLP with Optuna HPO |
| **Phase 8** | Model evaluation — leaderboard, confusion matrix, ROC/PR curves |
| **Phase 9** | Explainability — SHAP waterfall, beeswarm, counterfactuals |
| **Phase 10** | Deployment — REST API packaging, replica scaling, monitoring |
| **Phase 11** | LLM Chat — LM Studio integration for data & model Q&A |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React 19 + Vite + MUI v7 + TanStack Query + Zustand   │
│                    (client/)                            │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API (proxied via Vite)
┌─────────────────────▼───────────────────────────────────┐
│        FastAPI 0.115  (src/omniforge/api/)              │
│   Routers: upload · pii · profile · eda · training …   │
└──────┬──────────────┬───────────────┬───────────────────┘
       │              │               │
  PostgreSQL      MinIO S3       Redis + Celery
  (SQLAlchemy    (file store)   (async tasks)
   + asyncpg)
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose

### 1. Clone & configure
```bash
git clone https://github.com/<your-org>/phoenice-omniforge-ml.git
cd phoenice-omniforge-ml
cp .env.example .env   # edit credentials as needed
```

### 2. Start infrastructure
```bash
docker compose up -d postgres redis minio
```

### 3. Backend
```bash
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn omniforge.api.main:app --reload
```

### 4. Frontend
```bash
cd client
npm install
# Create client/.env.development.local:
echo "VITE_API_URL=http://localhost:8000" > .env.development.local
npm run dev
```

Open **http://localhost:5173**

---

## 🧪 Test Dataset

A realistic synthetic financial risk dataset is included for development:

```bash
python data/generate_dataset.py
# → data/finrisk_credit_default_25k.csv  (25,500 rows × 45 cols)
```

Features: loan amounts, credit scores, income, employment, demographics, 9 intentional PII columns, 500 duplicates, mixed missingness, binary target `loan_default` (16.9% positive rate).

See [`docs/TEST_DATASET_PLAN.md`](docs/TEST_DATASET_PLAN.md) for full specification.

---

## 🛠️ Tech Stack

See [`TECH_STACK.md`](TECH_STACK.md) for the full rationale.

| Layer | Technology |
|-------|-----------|
| API | FastAPI + SQLAlchemy (asyncpg) |
| Task queue | Celery + Redis |
| Object storage | MinIO (S3-compatible) |
| ML | scikit-learn, XGBoost, LightGBM, CatBoost |
| Experiment tracking | MLflow |
| Frontend | React 19, Vite, MUI v7, Recharts, AG Grid |
| State | Zustand + TanStack Query |
| LLM | LM Studio (local, OpenAI-compatible) |

---

## 🧪 Testing

The project ships a two-tier reusable test suite that can be run at any time to validate the full stack.

### Backend — API Contract Tests (pytest)

Covers all 20 backend endpoints: correct HTTP methods, missing-param validation (422), non-existent dataset (404), wrong-method rejection (405), and response shape checks.

```bash
# Run backend tests only
.venv\Scripts\python.exe -m pytest tests/ --ignore=tests/e2e -q

# Or via Make
make test-backend
```

**Current baseline: 88 tests, 0 failures (~5 s)**

### Frontend — E2E Browser Tests (Playwright)

Covers all 14 UI screens and validates every outgoing API call against the known backend route list.

```bash
# Install Playwright browsers (first time only)
make test-e2e-install

# Run E2E tests headless (requires dev server + backend running)
make test-e2e

# Run with visible browser (useful for debugging)
make test-e2e-headed

# View last test report in browser
make test-e2e-report
```

**Current baseline: 31 tests, 0 failures**

What each E2E test validates:

| Category | What is checked |
|----------|-----------------|
| **Screen loading** | Every route renders without a React crash (`Route Error`) |
| **Page heading** | Main content area shows the expected page heading or a "no dataset" guard alert |
| **No JS errors** | Zero unhandled console errors on page load |
| **API route contract** | Every `/api/*` call from the frontend maps to a real backend endpoint |
| **Dataset ID guard** | Pages with data dependencies do **not** call APIs when no dataset is selected |
| **No phantom routes** | No calls to unimplemented endpoints (e.g. `/api/explain` before backend is ready) |

### Run Everything

```bash
# Both suites in one command (requires backend + frontend dev servers running)
make test-all

# Windows PowerShell runner with server pre-flight checks
.\scripts\run-tests.ps1 -Backend -E2E
.\scripts\run-tests.ps1 -E2EHeaded   # headed browser
```

### Test File Locations

```
tests/
├── test_api_contract.py      # 73 backend API contract tests
├── test_upload.py            # Upload endpoint tests
├── test_profile.py           # Profile / SSE endpoint tests
├── test_pii.py               # PII scanner tests
└── e2e/
    ├── playwright.config.ts  # Playwright config (Chromium, localhost:5173)
    └── tests/
        ├── screens.spec.ts   # 16 screen-loading tests (14 routes + extras)
        └── api-routes.spec.ts # 15 API call validation tests
```

---

## 📁 Project Structure

```
phoenice-omniforge-ml/
├── src/omniforge/
│   ├── api/           # FastAPI routers
│   ├── ml/            # PII scanner, profiler, training
│   ├── models/        # SQLAlchemy ORM models
│   ├── storage/       # MinIO client
│   └── tasks/         # Celery task definitions
├── client/            # React/Vite frontend
├── alembic/           # DB migrations
├── data/              # Dataset generator scripts
├── docs/              # Design docs & test plans
├── scripts/           # run-tests.ps1 and other utilities
├── tests/             # pytest + Playwright test suites
└── docker/            # Dockerfiles
```

---

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE)
