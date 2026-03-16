"""Tests for PII scanning."""
from __future__ import annotations

import pytest
import pandas as pd
from httpx import AsyncClient


def test_scanner_detects_email():
    from omniforge.ml.pii.scanner import scan_dataframe

    df = pd.DataFrame({
        "email": ["alice@example.com", "bob@test.org", "carol@domain.co.uk"],
        "age": [25, 30, 35],
    })
    report = scan_dataframe(df)
    report["dataset_id"] = "test-id"

    pii_cols = {c["column"] for c in report["pii_columns"]}
    assert "email" in pii_cols

    email_finding = next(c for c in report["pii_columns"] if c["column"] == "email")
    assert email_finding["entity_type"] == "EMAIL"
    assert email_finding["sensitivity"] == "high"
    assert email_finding["match_count"] == 3


def test_scanner_detects_phone():
    from omniforge.ml.pii.scanner import scan_dataframe

    df = pd.DataFrame({
        "phone": ["555-123-4567", "800-555-1234", "123-456-7890"],
    })
    report = scan_dataframe(df)
    pii_cols = {c["column"] for c in report["pii_columns"]}
    assert "phone" in pii_cols


def test_scanner_detects_ssn():
    from omniforge.ml.pii.scanner import scan_dataframe

    df = pd.DataFrame({
        "ssn": ["123-45-6789", "987-65-4321", "111-22-3333"],
    })
    report = scan_dataframe(df)
    # Should match by column name heuristic (NATIONAL_ID) or SSN regex
    pii_cols = {c["column"]: c for c in report["pii_columns"]}
    assert "ssn" in pii_cols


def test_scanner_no_pii():
    from omniforge.ml.pii.scanner import scan_dataframe

    df = pd.DataFrame({
        "value": [1, 2, 3],
        "label": ["cat", "dog", "bird"],
    })
    report = scan_dataframe(df)
    assert report["risk_score"] == 0
    assert len(report["pii_columns"]) == 0


def test_scanner_risk_score_high():
    from omniforge.ml.pii.scanner import scan_dataframe

    df = pd.DataFrame({
        "email": ["a@b.com", "c@d.com", "e@f.com"],
        "ssn": ["123-45-6789", "987-65-4321", "111-22-3333"],
        "full_name": ["Alice Smith", "Bob Jones", "Carol White"],
    })
    report = scan_dataframe(df)
    assert report["risk_score"] > 0


@pytest.mark.asyncio
async def test_pii_endpoint_missing_dataset(client: AsyncClient):
    response = await client.get("/api/pii?dataset_id=nonexistent-id")
    assert response.status_code == 404
