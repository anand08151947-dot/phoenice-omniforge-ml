"""Tests for Project and AuditLog functionality."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


FAKE_ID = "00000000-0000-0000-0000-000000000000"


# ─────────────────────────────────────────────────────────────
# Project lifecycle
# ─────────────────────────────────────────────────────────────

class TestProjectLifecycle:

    @pytest.mark.asyncio
    async def test_create_minimal_project(self, client: AsyncClient):
        """Create project with only required field (name)."""
        r = await client.post("/api/projects", json={"name": "Minimal Project"})
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Minimal Project"
        assert data["status"] == "active"
        assert "id" in data
        assert data["team_members"] == []

    @pytest.mark.asyncio
    async def test_create_full_project(self, client: AsyncClient):
        """Create project with all fields populated."""
        payload = {
            "name": "Full Project",
            "description": "A comprehensive project",
            "owner": "alice@company.com",
            "team_members": [
                {"email": "bob@company.com", "role": "analyst"},
                {"email": "carol@company.com", "role": "reviewer"},
            ],
        }
        r = await client.post("/api/projects", json=payload)
        assert r.status_code == 201
        data = r.json()
        assert data["description"] == "A comprehensive project"
        assert data["owner"] == "alice@company.com"
        assert len(data["team_members"]) == 2

    @pytest.mark.asyncio
    async def test_list_projects_empty_initially(self, client: AsyncClient):
        """Fresh DB has no projects."""
        r = await client.get("/api/projects")
        assert r.status_code == 200
        assert r.json()["projects"] == []

    @pytest.mark.asyncio
    async def test_list_projects_after_create(self, client: AsyncClient):
        """After creating projects, list returns them all."""
        await client.post("/api/projects", json={"name": "Project A"})
        await client.post("/api/projects", json={"name": "Project B"})
        r = await client.get("/api/projects")
        projects = r.json()["projects"]
        names = {p["name"] for p in projects}
        assert "Project A" in names
        assert "Project B" in names

    @pytest.mark.asyncio
    async def test_get_project_detail(self, client: AsyncClient):
        """Fetching a project detail includes datasets and activity arrays."""
        create_r = await client.post("/api/projects", json={"name": "Detail Test"})
        project_id = create_r.json()["id"]

        r = await client.get(f"/api/projects/{project_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == project_id
        assert data["name"] == "Detail Test"
        assert isinstance(data["datasets"], list)
        assert isinstance(data["activity"], list)

    @pytest.mark.asyncio
    async def test_update_project_name(self, client: AsyncClient):
        """PATCH updates project name."""
        create_r = await client.post("/api/projects", json={"name": "Old Name"})
        project_id = create_r.json()["id"]

        patch_r = await client.patch(f"/api/projects/{project_id}", json={"name": "New Name"})
        assert patch_r.status_code == 200
        assert patch_r.json()["name"] == "New Name"

        # Verify the change persists via GET
        get_r = await client.get(f"/api/projects/{project_id}")
        assert get_r.json()["name"] == "New Name"

    @pytest.mark.asyncio
    async def test_update_project_team(self, client: AsyncClient):
        """PATCH updates team_members list."""
        create_r = await client.post("/api/projects", json={"name": "Team Update"})
        project_id = create_r.json()["id"]

        new_team = [{"email": "dave@test.com", "role": "engineer"}]
        patch_r = await client.patch(f"/api/projects/{project_id}", json={"team_members": new_team})
        assert patch_r.status_code == 200
        assert len(patch_r.json()["team_members"]) == 1
        assert patch_r.json()["team_members"][0]["email"] == "dave@test.com"

    @pytest.mark.asyncio
    async def test_archive_project(self, client: AsyncClient):
        """DELETE archives project (soft delete — does not remove it)."""
        create_r = await client.post("/api/projects", json={"name": "To Archive"})
        project_id = create_r.json()["id"]

        del_r = await client.delete(f"/api/projects/{project_id}")
        assert del_r.status_code == 200
        assert del_r.json()["status"] == "archived"

        # Project still retrievable but status is archived
        get_r = await client.get(f"/api/projects/{project_id}")
        assert get_r.status_code == 200
        assert get_r.json()["status"] == "archived"

    @pytest.mark.asyncio
    async def test_list_projects_includes_stats(self, client: AsyncClient):
        """List projects response includes dataset_count and best_cv_score fields."""
        await client.post("/api/projects", json={"name": "Stats Project"})
        r = await client.get("/api/projects")
        projects = r.json()["projects"]
        assert len(projects) >= 1
        p = projects[0]
        assert "dataset_count" in p
        assert "last_activity" in p
        assert "best_cv_score" in p


# ─────────────────────────────────────────────────────────────
# Admin Overview
# ─────────────────────────────────────────────────────────────

class TestAdminStats:

    @pytest.mark.asyncio
    async def test_overview_starts_at_zero(self, client: AsyncClient):
        """Fresh DB has 0 projects and 0 datasets."""
        r = await client.get("/api/admin/overview")
        assert r.status_code == 200
        data = r.json()
        assert data["total_projects"] == 0
        assert data["total_datasets"] == 0
        assert data["active_projects"] == 0

    @pytest.mark.asyncio
    async def test_overview_counts_projects(self, client: AsyncClient):
        """After creating projects, overview counts them."""
        await client.post("/api/projects", json={"name": "Count A"})
        await client.post("/api/projects", json={"name": "Count B"})
        r = await client.get("/api/admin/overview")
        data = r.json()
        assert data["total_projects"] == 2
        assert data["active_projects"] == 2

    @pytest.mark.asyncio
    async def test_overview_archived_not_active(self, client: AsyncClient):
        """Archived projects don't count toward active_projects."""
        create_r = await client.post("/api/projects", json={"name": "Archived One"})
        project_id = create_r.json()["id"]
        await client.delete(f"/api/projects/{project_id}")

        r = await client.get("/api/admin/overview")
        data = r.json()
        assert data["total_projects"] == 1
        assert data["active_projects"] == 0

    @pytest.mark.asyncio
    async def test_overview_recent_activity_key(self, client: AsyncClient):
        """Overview response always has recent_activity list."""
        r = await client.get("/api/admin/overview")
        data = r.json()
        assert "recent_activity" in data
        assert isinstance(data["recent_activity"], list)


# ─────────────────────────────────────────────────────────────
# Activity feed
# ─────────────────────────────────────────────────────────────

class TestActivityFeed:

    @pytest.mark.asyncio
    async def test_activity_empty_initially(self, client: AsyncClient):
        """No activity in a fresh DB."""
        r = await client.get("/api/admin/activity")
        assert r.status_code == 200
        assert r.json()["activity"] == []

    @pytest.mark.asyncio
    async def test_activity_project_filter(self, client: AsyncClient):
        """Filter by project_id returns empty list for unknown project."""
        r = await client.get("/api/admin/activity", params={"project_id": FAKE_ID})
        assert r.status_code == 200
        assert r.json()["activity"] == []

    @pytest.mark.asyncio
    async def test_activity_limit_param(self, client: AsyncClient):
        """limit parameter is accepted."""
        r = await client.get("/api/admin/activity", params={"limit": 5})
        assert r.status_code == 200


# ─────────────────────────────────────────────────────────────
# Dataset project_id filter
# ─────────────────────────────────────────────────────────────

class TestDatasetProjectFilter:

    @pytest.mark.asyncio
    async def test_list_datasets_no_project_filter(self, client: AsyncClient):
        """GET /api/datasets without project_id returns all datasets."""
        r = await client.get("/api/datasets")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_list_datasets_with_project_filter(self, client: AsyncClient):
        """GET /api/datasets?project_id=<id> returns only matching datasets (empty for fake)."""
        r = await client.get("/api/datasets", params={"project_id": FAKE_ID})
        assert r.status_code == 200
        datasets = r.json()
        assert isinstance(datasets, list)
        # All returned datasets must belong to the filtered project
        for ds in datasets:
            if "project_id" in ds:
                assert ds["project_id"] == FAKE_ID
