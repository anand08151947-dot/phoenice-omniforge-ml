.PHONY: dev test test-backend test-e2e test-e2e-headed test-all migrate build lint up down

dev:
	docker compose up -d postgres redis minio
	uvicorn omniforge.api.main:app --reload --port 8000

migrate:
	alembic upgrade head

# ── Tests ─────────────────────────────────────────────────────────────────────

## Backend API contract tests (no live servers needed)
test-backend:
	pytest tests/ -v --tb=short --cov=src/omniforge --cov-report=term-missing

## Alias: same as test-backend (keeps backward compat)
test: test-backend

## Frontend E2E tests — requires: API at :8000 + dev server at :5173
test-e2e:
	cd tests/e2e && npx playwright test --reporter=list

## E2E tests with browser visible (useful for debugging)
test-e2e-headed:
	cd tests/e2e && npx playwright test --headed --reporter=list

## Full suite: backend + E2E
test-all:
	powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1

## Install E2E test dependencies (run once)
test-e2e-install:
	cd tests/e2e && npm install && npx playwright install chromium --with-deps

## View last Playwright HTML report
test-e2e-report:
	cd tests/e2e && npx playwright show-report

# ── Other ─────────────────────────────────────────────────────────────────────

lint:
	ruff check src/ tests/
	mypy src/

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down
