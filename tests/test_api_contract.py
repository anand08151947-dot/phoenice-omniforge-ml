"""
API Contract Tests — Phase-by-phase coverage of every backend endpoint.

Tests validate:
  1. Endpoint exists with the correct HTTP method (wrong method → 405)
  2. Required query parameters are enforced (missing → 422)
  3. Non-existent dataset_id returns 404 (not 500)
  4. POST body field validation returns 422 for missing required fields
  5. Response content-type is application/json

Run: pytest tests/test_api_contract.py -v

No live servers, MinIO, or Celery required — uses ASGI test client with
in-memory SQLite (provided by conftest.py).
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

FAKE_ID = "00000000-0000-0000-0000-000000000000"

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

async def _get(client: AsyncClient, path: str, **params) -> int:
    r = await client.get(path, params=params)
    return r.status_code


async def _post(client: AsyncClient, path: str, body: dict) -> int:
    r = await client.post(path, json=body)
    return r.status_code


# ─────────────────────────────────────────────────────────────
# Phase 0: Dataset management  (/api/datasets, /api/upload)
# ─────────────────────────────────────────────────────────────

class TestDatasetEndpoints:
    @pytest.mark.asyncio
    async def test_list_datasets_exists(self, client: AsyncClient):
        """GET /api/datasets returns 200 with a list."""
        r = await client.get("/api/datasets")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert "application/json" in r.headers["content-type"]

    @pytest.mark.asyncio
    async def test_list_datasets_wrong_method(self, client: AsyncClient):
        """POST /api/datasets should not be a valid route."""
        r = await client.post("/api/datasets", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_patch_dataset_not_found(self, client: AsyncClient):
        """PATCH /api/datasets/{id} returns 404 for non-existent dataset."""
        r = await client.patch(f"/api/datasets/{FAKE_ID}", json={"name": "renamed"})
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_upload_wrong_method(self, client: AsyncClient):
        """GET /api/upload should not exist."""
        r = await client.get("/api/upload")
        assert r.status_code in (404, 405)

    @pytest.mark.asyncio
    async def test_upload_missing_file(self, client: AsyncClient):
        """POST /api/upload without a file returns 422."""
        r = await client.post("/api/upload")
        assert r.status_code == 422


# ─────────────────────────────────────────────────────────────
# Phase A: Profile  (/api/profile, /api/profile/trigger)
# ─────────────────────────────────────────────────────────────

class TestProfileEndpoints:
    @pytest.mark.asyncio
    async def test_get_profile_missing_param(self, client: AsyncClient):
        """GET /api/profile without dataset_id returns 422."""
        r = await client.get("/api/profile")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_profile_not_found(self, client: AsyncClient):
        """GET /api/profile?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/profile", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_get_profile_wrong_method(self, client: AsyncClient):
        """POST /api/profile should not be a valid route."""
        r = await client.post("/api/profile", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_get_profile_progress_missing_param(self, client: AsyncClient):
        """GET /api/profile/progress without dataset_id returns 422."""
        r = await client.get("/api/profile/progress")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_profile_progress_not_found(self, client: AsyncClient):
        """GET /api/profile/progress?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/profile/progress", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_trigger_profile_not_found(self, client: AsyncClient):
        """POST /api/profile/trigger/{id} returns 404 for unknown dataset."""
        r = await client.post(f"/api/profile/trigger/{FAKE_ID}")
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_trigger_profile_wrong_method(self, client: AsyncClient):
        """GET /api/profile/trigger/{id} should not be valid."""
        r = await client.get(f"/api/profile/trigger/{FAKE_ID}")
        assert r.status_code == 405


# ─────────────────────────────────────────────────────────────
# Phase A: PII  (/api/pii, /api/pii/scan, /api/pii/apply)
# ─────────────────────────────────────────────────────────────

class TestPIIEndpoints:
    @pytest.mark.asyncio
    async def test_get_pii_missing_param(self, client: AsyncClient):
        """GET /api/pii without dataset_id returns 422."""
        r = await client.get("/api/pii")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_pii_not_found(self, client: AsyncClient):
        """GET /api/pii?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/pii", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_get_pii_wrong_method(self, client: AsyncClient):
        """POST /api/pii should not be a valid route."""
        r = await client.post("/api/pii", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_pii_scan_not_found(self, client: AsyncClient):
        """POST /api/pii/scan/{id} returns 404 for unknown dataset."""
        r = await client.post(f"/api/pii/scan/{FAKE_ID}")
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_pii_scan_wrong_method(self, client: AsyncClient):
        """GET /api/pii/scan/{id} should not be valid."""
        r = await client.get(f"/api/pii/scan/{FAKE_ID}")
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_pii_apply_missing_body(self, client: AsyncClient):
        """POST /api/pii/apply without body returns 422."""
        r = await client.post("/api/pii/apply")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_pii_apply_missing_dataset_id(self, client: AsyncClient):
        """POST /api/pii/apply with empty body returns 422 (missing dataset_id)."""
        assert await _post(client, "/api/pii/apply", {}) == 422

    @pytest.mark.asyncio
    async def test_pii_apply_not_found(self, client: AsyncClient):
        """POST /api/pii/apply with non-existent dataset_id returns 404 or 422.
        422 is acceptable if the body is missing other required fields."""
        status = await _post(client, "/api/pii/apply", {"dataset_id": FAKE_ID})
        assert status in (404, 422)


# ─────────────────────────────────────────────────────────────
# Phase 1: EDA  (/api/eda, /api/eda/overrides)
# ─────────────────────────────────────────────────────────────

class TestEDAEndpoints:
    @pytest.mark.asyncio
    async def test_get_eda_missing_param(self, client: AsyncClient):
        """GET /api/eda without dataset_id returns 422."""
        r = await client.get("/api/eda")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_eda_not_found(self, client: AsyncClient):
        """GET /api/eda?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/eda", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_get_eda_wrong_method(self, client: AsyncClient):
        """POST /api/eda should not be a route (overrides is at /eda/overrides)."""
        r = await client.post("/api/eda", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_eda_overrides_missing_body(self, client: AsyncClient):
        """POST /api/eda/overrides without body returns 422."""
        r = await client.post("/api/eda/overrides")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_eda_overrides_missing_dataset_id(self, client: AsyncClient):
        """POST /api/eda/overrides with empty body returns 422."""
        assert await _post(client, "/api/eda/overrides", {}) == 422

    @pytest.mark.asyncio
    async def test_eda_overrides_not_found(self, client: AsyncClient):
        """POST /api/eda/overrides with non-existent dataset_id returns 404 or 422.
        422 is acceptable if the body is missing other required fields."""
        status = await _post(client, "/api/eda/overrides", {"dataset_id": FAKE_ID})
        assert status in (404, 422)

    @pytest.mark.asyncio
    async def test_eda_overrides_wrong_method(self, client: AsyncClient):
        """GET /api/eda/overrides should not be a valid route."""
        r = await client.get("/api/eda/overrides")
        assert r.status_code == 405


# ─────────────────────────────────────────────────────────────
# Phase 2: Cleaning  (/api/cleaning, /api/cleaning/apply)
# ─────────────────────────────────────────────────────────────

class TestCleaningEndpoints:
    @pytest.mark.asyncio
    async def test_get_cleaning_missing_param(self, client: AsyncClient):
        """GET /api/cleaning without dataset_id returns 422."""
        r = await client.get("/api/cleaning")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_cleaning_not_found(self, client: AsyncClient):
        """GET /api/cleaning?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/cleaning", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_get_cleaning_wrong_method(self, client: AsyncClient):
        """POST /api/cleaning should not be a valid route."""
        r = await client.post("/api/cleaning", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_cleaning_apply_missing_body(self, client: AsyncClient):
        """POST /api/cleaning/apply without body returns 422."""
        r = await client.post("/api/cleaning/apply")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_cleaning_apply_missing_dataset_id(self, client: AsyncClient):
        """POST /api/cleaning/apply with empty body returns 422."""
        assert await _post(client, "/api/cleaning/apply", {}) == 422

    @pytest.mark.asyncio
    async def test_cleaning_apply_not_found(self, client: AsyncClient):
        """POST /api/cleaning/apply with non-existent dataset_id returns 404 or 422.
        422 is acceptable if the body is missing other required fields."""
        status = await _post(client, "/api/cleaning/apply", {"dataset_id": FAKE_ID})
        assert status in (404, 422)

    @pytest.mark.asyncio
    async def test_cleaning_apply_wrong_method(self, client: AsyncClient):
        """GET /api/cleaning/apply should not be a valid route."""
        r = await client.get("/api/cleaning/apply")
        assert r.status_code == 405


# ─────────────────────────────────────────────────────────────
# Phase 3: Sampling  (/api/sampling, /api/sampling/apply)
# ─────────────────────────────────────────────────────────────

class TestSamplingEndpoints:
    @pytest.mark.asyncio
    async def test_get_sampling_missing_param(self, client: AsyncClient):
        """GET /api/sampling without dataset_id returns 422."""
        r = await client.get("/api/sampling")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_sampling_not_found(self, client: AsyncClient):
        """GET /api/sampling?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/sampling", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_get_sampling_wrong_method(self, client: AsyncClient):
        """POST /api/sampling should not be a valid route."""
        r = await client.post("/api/sampling", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_sampling_apply_missing_body(self, client: AsyncClient):
        """POST /api/sampling/apply without body returns 422."""
        r = await client.post("/api/sampling/apply")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_sampling_apply_missing_dataset_id(self, client: AsyncClient):
        """POST /api/sampling/apply with empty body returns 422."""
        assert await _post(client, "/api/sampling/apply", {}) == 422

    @pytest.mark.asyncio
    async def test_sampling_apply_not_found(self, client: AsyncClient):
        """POST /api/sampling/apply with non-existent dataset_id returns 404 or 422.
        422 is acceptable if the body is missing other required fields."""
        status = await _post(client, "/api/sampling/apply", {"dataset_id": FAKE_ID})
        assert status in (404, 422)

    @pytest.mark.asyncio
    async def test_sampling_apply_wrong_method(self, client: AsyncClient):
        """GET /api/sampling/apply should not be a valid route."""
        r = await client.get("/api/sampling/apply")
        assert r.status_code == 405


# ─────────────────────────────────────────────────────────────
# Phase 4: Feature Engineering  (/api/features, /api/features/apply)
# ─────────────────────────────────────────────────────────────

class TestFeaturesEndpoints:
    @pytest.mark.asyncio
    async def test_get_features_missing_param(self, client: AsyncClient):
        """GET /api/features without dataset_id returns 422."""
        r = await client.get("/api/features")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_features_not_found(self, client: AsyncClient):
        """GET /api/features?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/features", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_get_features_wrong_method(self, client: AsyncClient):
        """POST /api/features should not be a valid route."""
        r = await client.post("/api/features", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_features_apply_missing_body(self, client: AsyncClient):
        """POST /api/features/apply without body returns 422."""
        r = await client.post("/api/features/apply")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_features_apply_missing_dataset_id(self, client: AsyncClient):
        """POST /api/features/apply with empty body returns 422."""
        assert await _post(client, "/api/features/apply", {}) == 422

    @pytest.mark.asyncio
    async def test_features_apply_not_found(self, client: AsyncClient):
        """POST /api/features/apply with non-existent dataset_id returns 404 or 422.
        422 is acceptable if the body is missing other required fields."""
        status = await _post(client, "/api/features/apply", {"dataset_id": FAKE_ID})
        assert status in (404, 422)

    @pytest.mark.asyncio
    async def test_features_apply_wrong_method(self, client: AsyncClient):
        """GET /api/features/apply should not be a valid route."""
        r = await client.get("/api/features/apply")
        assert r.status_code == 405


# ─────────────────────────────────────────────────────────────
# Phase 5: Feature Selection  (/api/selection, /api/selection/apply)
# ─────────────────────────────────────────────────────────────

class TestSelectionEndpoints:
    @pytest.mark.asyncio
    async def test_get_selection_missing_param(self, client: AsyncClient):
        """GET /api/selection without dataset_id returns 422."""
        r = await client.get("/api/selection")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_selection_not_found(self, client: AsyncClient):
        """GET /api/selection?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/selection", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_get_selection_wrong_method(self, client: AsyncClient):
        """POST /api/selection should not be a valid route."""
        r = await client.post("/api/selection", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_selection_apply_missing_body(self, client: AsyncClient):
        """POST /api/selection/apply without body returns 422."""
        r = await client.post("/api/selection/apply")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_selection_apply_missing_dataset_id(self, client: AsyncClient):
        """POST /api/selection/apply with empty body returns 422."""
        assert await _post(client, "/api/selection/apply", {}) == 422

    @pytest.mark.asyncio
    async def test_selection_apply_not_found(self, client: AsyncClient):
        """POST /api/selection/apply with non-existent dataset_id returns 404 or 422.
        422 is acceptable if the body is missing other required fields."""
        status = await _post(client, "/api/selection/apply", {"dataset_id": FAKE_ID})
        assert status in (404, 422)

    @pytest.mark.asyncio
    async def test_selection_apply_wrong_method(self, client: AsyncClient):
        """GET /api/selection/apply should not be a valid route."""
        r = await client.get("/api/selection/apply")
        assert r.status_code == 405


# ─────────────────────────────────────────────────────────────
# Phase 6: AutoML Training  (/api/training, /api/training/run)
# ─────────────────────────────────────────────────────────────

class TestTrainingEndpoints:
    @pytest.mark.asyncio
    async def test_get_training_missing_param(self, client: AsyncClient):
        """GET /api/training without dataset_id returns 422."""
        r = await client.get("/api/training")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_training_not_found(self, client: AsyncClient):
        """GET /api/training?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/training", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_get_training_wrong_method(self, client: AsyncClient):
        """POST /api/training should not be a valid route."""
        r = await client.post("/api/training", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_training_run_missing_body(self, client: AsyncClient):
        """POST /api/training/run without body returns 422."""
        r = await client.post("/api/training/run")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_training_run_missing_dataset_id(self, client: AsyncClient):
        """POST /api/training/run with empty body returns 422."""
        assert await _post(client, "/api/training/run", {}) == 422

    @pytest.mark.asyncio
    async def test_training_run_not_found(self, client: AsyncClient):
        """POST /api/training/run with non-existent dataset_id returns 404."""
        assert await _post(client, "/api/training/run", {"dataset_id": FAKE_ID}) == 404

    @pytest.mark.asyncio
    async def test_training_run_wrong_method(self, client: AsyncClient):
        """GET /api/training/run should not be a valid route."""
        r = await client.get("/api/training/run")
        assert r.status_code == 405


# ─────────────────────────────────────────────────────────────
# Phase 7: Evaluation  (/api/evaluation, /api/evaluation/run)
# ─────────────────────────────────────────────────────────────

class TestEvaluationEndpoints:
    @pytest.mark.asyncio
    async def test_get_evaluation_missing_param(self, client: AsyncClient):
        """GET /api/evaluation without dataset_id returns 422."""
        r = await client.get("/api/evaluation")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_evaluation_not_found(self, client: AsyncClient):
        """GET /api/evaluation?dataset_id=<fake> returns 404."""
        assert await _get(client, "/api/evaluation", dataset_id=FAKE_ID) == 404

    @pytest.mark.asyncio
    async def test_get_evaluation_wrong_method(self, client: AsyncClient):
        """POST /api/evaluation should not be a valid route."""
        r = await client.post("/api/evaluation", json={})
        assert r.status_code == 405

    @pytest.mark.asyncio
    async def test_evaluation_run_missing_body(self, client: AsyncClient):
        """POST /api/evaluation/run without body returns 422."""
        r = await client.post("/api/evaluation/run")
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_evaluation_run_missing_dataset_id(self, client: AsyncClient):
        """POST /api/evaluation/run with empty body returns 422."""
        assert await _post(client, "/api/evaluation/run", {}) == 422

    @pytest.mark.asyncio
    async def test_evaluation_run_not_found(self, client: AsyncClient):
        """POST /api/evaluation/run with non-existent dataset_id returns 404."""
        assert await _post(client, "/api/evaluation/run", {"dataset_id": FAKE_ID}) == 404

    @pytest.mark.asyncio
    async def test_evaluation_run_wrong_method(self, client: AsyncClient):
        """GET /api/evaluation/run should not be a valid route."""
        r = await client.get("/api/evaluation/run")
        assert r.status_code == 405


# ─────────────────────────────────────────────────────────────
# Cross-cutting: Response format checks
# ─────────────────────────────────────────────────────────────

class TestResponseFormats:
    @pytest.mark.asyncio
    async def test_datasets_returns_json(self, client: AsyncClient):
        """GET /api/datasets always returns application/json."""
        r = await client.get("/api/datasets")
        assert "application/json" in r.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_404_returns_json(self, client: AsyncClient):
        """404 error responses are JSON (not HTML)."""
        r = await client.get("/api/training", params={"dataset_id": FAKE_ID})
        assert r.status_code == 404
        body = r.json()
        assert "detail" in body

    @pytest.mark.asyncio
    async def test_422_returns_json(self, client: AsyncClient):
        """422 validation error responses are JSON with 'detail' field."""
        r = await client.get("/api/training")
        assert r.status_code == 422
        body = r.json()
        assert "detail" in body

    @pytest.mark.asyncio
    async def test_no_phantom_routes(self, client: AsyncClient):
        """Routes that don't exist in the backend return 404 — not 200."""
        # These pages exist in the frontend but NOT in the backend yet
        phantom_routes = [
            "/api/explain/shap",
            "/api/explain/counterfactual",
            "/api/deploy",
            "/api/chat",
        ]
        for route in phantom_routes:
            r = await client.get(route)
            assert r.status_code in (404, 405), (
                f"Route {route} unexpectedly returned {r.status_code}. "
                "If this route was added to the backend, remove it from this test."
            )
