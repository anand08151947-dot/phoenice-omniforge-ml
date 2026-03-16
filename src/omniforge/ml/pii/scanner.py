"""
Regex-based PII scanner for pandas DataFrames.
Returns a list of PIIColumn findings and an overall risk score.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


# ── Regex patterns ────────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.IGNORECASE)
_PHONE_RE = re.compile(
    r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10,15})", re.IGNORECASE
)
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,19}\b")
_IP_RE = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
)
_CC_RE = re.compile(r"\b(?:\d[ -]?){15,16}\b")

# Column-name heuristics
_NAME_COLS = re.compile(r"\b(full_?name|first_?name|last_?name|name)\b", re.IGNORECASE)
_ADDRESS_COLS = re.compile(r"\b(address|street|city|postal|zip)\b", re.IGNORECASE)
_DOB_COLS = re.compile(r"\b(dob|date_?of_?birth|birth_?date|birthdate)\b", re.IGNORECASE)
_SSN_COLS = re.compile(r"\b(ssn|national_?id|id_?number|sin)\b", re.IGNORECASE)

# Sensitivity mapping
_SENSITIVITY: dict[str, str] = {
    "EMAIL": "high",
    "PHONE": "high",
    "SSN": "high",
    "CREDIT_CARD": "high",
    "IBAN": "high",
    "NATIONAL_ID": "high",
    "DATE_OF_BIRTH": "medium",
    "NAME": "medium",
    "ADDRESS": "medium",
    "IP_ADDRESS": "low",
}

_ACTION: dict[str, str] = {
    "EMAIL": "mask",
    "PHONE": "mask",
    "SSN": "hash",
    "CREDIT_CARD": "encrypt",
    "IBAN": "encrypt",
    "NATIONAL_ID": "hash",
    "DATE_OF_BIRTH": "pseudonymize",
    "NAME": "pseudonymize",
    "ADDRESS": "mask",
    "IP_ADDRESS": "mask",
}

_RISK_WEIGHT = {"high": 3, "medium": 2, "low": 1}


@dataclass
class PIIColumn:
    column: str
    entity_type: str
    sensitivity: str
    sample_values: list[str]
    match_count: int
    match_pct: float
    recommended_action: str
    status: str = "pending"


def _luhn_valid(number: str) -> bool:
    digits = [int(d) for d in number if d.isdigit()]
    if len(digits) < 13:
        return False
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def _mask(value: str) -> str:
    s = str(value)
    if len(s) <= 4:
        return "***"
    return s[:2] + "*" * (len(s) - 4) + s[-2:]


def _scan_column_by_regex(series: "pd.Series", pattern: re.Pattern, entity: str, min_pct: float = 0.05) -> PIIColumn | None:  # noqa: F821
    non_null = series.dropna().astype(str)
    if len(non_null) == 0:
        return None
    matches = non_null[non_null.str.contains(pattern, regex=True, na=False)]
    match_count = len(matches)
    match_pct = match_count / len(non_null)
    if match_pct < min_pct:
        return None
    samples = [_mask(v) for v in matches.head(3).tolist()]
    return PIIColumn(
        column=str(series.name),
        entity_type=entity,
        sensitivity=_SENSITIVITY[entity],
        sample_values=samples,
        match_count=match_count,
        match_pct=round(match_pct, 4),
        recommended_action=_ACTION[entity],
    )


def _scan_column_by_name(series: "pd.Series", entity: str) -> PIIColumn | None:  # noqa: F821
    non_null = series.dropna().astype(str)
    count = len(non_null)
    if count == 0:
        return None
    samples = [_mask(v) for v in non_null.head(3).tolist()]
    return PIIColumn(
        column=str(series.name),
        entity_type=entity,
        sensitivity=_SENSITIVITY[entity],
        sample_values=samples,
        match_count=count,
        match_pct=1.0,
        recommended_action=_ACTION[entity],
    )


def _scan_credit_cards(series: "pd.Series") -> PIIColumn | None:  # noqa: F821
    non_null = series.dropna().astype(str)
    if len(non_null) == 0:
        return None
    cc_matches = []
    for val in non_null:
        found = _CC_RE.findall(val)
        for candidate in found:
            digits_only = re.sub(r"[^\d]", "", candidate)
            if _luhn_valid(digits_only):
                cc_matches.append(val)
                break
    match_count = len(cc_matches)
    match_pct = match_count / len(non_null)
    if match_pct < 0.05:
        return None
    samples = [_mask(v) for v in cc_matches[:3]]
    return PIIColumn(
        column=str(series.name),
        entity_type="CREDIT_CARD",
        sensitivity=_SENSITIVITY["CREDIT_CARD"],
        sample_values=samples,
        match_count=match_count,
        match_pct=round(match_pct, 4),
        recommended_action=_ACTION["CREDIT_CARD"],
    )


def scan_dataframe(df: "pd.DataFrame") -> dict[str, Any]:  # noqa: F821
    findings: list[PIIColumn] = []
    seen_columns: set[str] = set()

    for col in df.columns:
        series = df[col]
        col_lower = str(col).lower()
        result: PIIColumn | None = None

        # Column-name heuristics first (more reliable)
        if _NAME_COLS.search(col_lower):
            result = _scan_column_by_name(series, "NAME")
        elif _DOB_COLS.search(col_lower):
            result = _scan_column_by_name(series, "DATE_OF_BIRTH")
        elif _SSN_COLS.search(col_lower):
            result = _scan_column_by_name(series, "NATIONAL_ID")
        elif _ADDRESS_COLS.search(col_lower):
            result = _scan_column_by_name(series, "ADDRESS")

        if result and col not in seen_columns:
            findings.append(result)
            seen_columns.add(col)
            continue

        # Regex scans on content
        for pattern, entity in [
            (_EMAIL_RE, "EMAIL"),
            (_SSN_RE, "SSN"),
            (_IBAN_RE, "IBAN"),
            (_IP_RE, "IP_ADDRESS"),
            (_PHONE_RE, "PHONE"),
        ]:
            result = _scan_column_by_regex(series, pattern, entity)
            if result and col not in seen_columns:
                findings.append(result)
                seen_columns.add(col)
                break

        # Credit card Luhn check
        if col not in seen_columns:
            result = _scan_credit_cards(series)
            if result:
                findings.append(result)
                seen_columns.add(col)

    # Risk score: weighted sum normalized to 0-100
    if findings:
        raw = sum(_RISK_WEIGHT[f.sensitivity] for f in findings)
        max_possible = 3 * len(df.columns) if len(df.columns) > 0 else 1
        risk_score = min(100, round(raw / max_possible * 100))
    else:
        risk_score = 0

    return {
        "dataset_id": None,  # filled by caller
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "total_columns": len(df.columns),
        "pii_columns": [
            {
                "column": f.column,
                "entity_type": f.entity_type,
                "sensitivity": f.sensitivity,
                "sample_values": f.sample_values,
                "match_count": f.match_count,
                "match_pct": f.match_pct,
                "recommended_action": f.recommended_action,
                "status": f.status,
            }
            for f in findings
        ],
        "risk_score": risk_score,
    }
