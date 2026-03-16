.PHONY: dev test migrate build lint up down

dev:
	docker compose up -d postgres redis minio
	uvicorn omniforge.api.main:app --reload --port 8000

migrate:
	alembic upgrade head

test:
	pytest tests/ -v --cov=src/omniforge --cov-report=term-missing

lint:
	ruff check src/ tests/
	mypy src/

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down
