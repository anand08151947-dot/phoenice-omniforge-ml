"""Tests for dataset profiling."""
from __future__ import annotations

import pytest
import pandas as pd
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_profile_missing_dataset(client: AsyncClient):
    response = await client.get("/api/profile?dataset_id=nonexistent-id")
    assert response.status_code == 404


def test_profiler_basic():
    """Test profiler with a small DataFrame."""
    from omniforge.ml.profiling.profiler import profile_dataframe

    df = pd.DataFrame({
        "age": [25, 30, 35, None, 40],
        "city": ["NY", "LA", "NY", "SF", "LA"],
        "score": [1.1, 2.2, 3.3, 4.4, 5.5],
    })

    result = profile_dataframe("test-dataset-id", df)

    assert result["dataset_id"] == "test-dataset-id"
    assert result["row_count"] == 5
    assert result["col_count"] == 3
    assert len(result["columns"]) == 3

    col_names = {c["name"] for c in result["columns"]}
    assert "age" in col_names
    assert "city" in col_names
    assert "score" in col_names


def test_profiler_numeric_stats():
    from omniforge.ml.profiling.profiler import profile_dataframe

    df = pd.DataFrame({"val": [1.0, 2.0, 3.0, 4.0, 5.0]})
    result = profile_dataframe("x", df)
    col = result["columns"][0]

    assert col["inferred_type"] == "numeric"
    assert col["mean"] == pytest.approx(3.0)
    assert col["min"] == 1.0
    assert col["max"] == 5.0


def test_profiler_categorical():
    from omniforge.ml.profiling.profiler import profile_dataframe

    df = pd.DataFrame({"cat": ["a", "b", "a", "c", "b", "a"]})
    result = profile_dataframe("x", df)
    col = result["columns"][0]

    assert col["inferred_type"] == "categorical"
    assert col["unique_count"] == 3
    assert "top_values" in col


def test_profiler_missing_warning():
    from omniforge.ml.profiling.profiler import profile_dataframe

    df = pd.DataFrame({"col": [None, None, None, None, 1.0]})
    result = profile_dataframe("x", df)
    col = result["columns"][0]

    assert "High missing values" in col["warnings"]


def test_profiler_handles_weird_column():
    """Profiler must not crash on a mixed/weird column."""
    from omniforge.ml.profiling.profiler import profile_dataframe

    df = pd.DataFrame({"weird": [1, "two", None, 3.0, "four"]})
    result = profile_dataframe("x", df)
    assert len(result["columns"]) == 1
