"""Tests for upload and dataset listing endpoints."""
from __future__ import annotations

import io

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_datasets_empty(client: AsyncClient):
    response = await client.get("/api/datasets")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_upload_csv(client: AsyncClient, monkeypatch):
    """Upload a small CSV; expect 201 with status processing or uploading."""

    # Mock MinIO and Celery so they don't fail in test
    import omniforge.api.routers.upload as upload_module

    def fake_put_object(**kwargs):
        return None

    def fake_bucket_exists(bucket):
        return True

    class FakeMinio:
        def bucket_exists(self, b):
            return True
        def make_bucket(self, b):
            pass
        def put_object(self, **kwargs):
            pass

    monkeypatch.setattr(upload_module, "get_minio_client", lambda: FakeMinio())

    # Also mock Celery task
    import omniforge.tasks.profile as profile_task
    monkeypatch.setattr(profile_task.run_profile, "delay", lambda *a, **kw: type("T", (), {"id": "fake-task-id"})())

    csv_content = b"col1,col2,col3\n1,a,x\n2,b,y\n3,c,z\n"
    files = {"file": ("test_data.csv", io.BytesIO(csv_content), "text/csv")}

    response = await client.post("/api/upload", files=files)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["name"] == "test_data"
    assert data["file_size"] == len(csv_content)
    assert data["status"] in ("processing", "uploading")


@pytest.mark.asyncio
async def test_list_datasets_after_upload(client: AsyncClient, monkeypatch):
    """After uploading, list endpoint should return at least one dataset."""
    import omniforge.api.routers.upload as upload_module
    import omniforge.tasks.profile as profile_task

    class FakeMinio:
        def bucket_exists(self, b): return True
        def make_bucket(self, b): pass
        def put_object(self, **kwargs): pass

    monkeypatch.setattr(upload_module, "get_minio_client", lambda: FakeMinio())
    monkeypatch.setattr(profile_task.run_profile, "delay", lambda *a, **kw: type("T", (), {"id": "x"})())

    csv_content = b"a,b\n1,2\n"
    files = {"file": ("listing_test.csv", io.BytesIO(csv_content), "text/csv")}
    await client.post("/api/upload", files=files)

    response = await client.get("/api/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert len(datasets) >= 1
