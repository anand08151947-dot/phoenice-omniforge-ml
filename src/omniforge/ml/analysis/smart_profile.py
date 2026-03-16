"""Smart profile analysis — derives ML-expert insights from raw profile_data.

All logic operates on the profile_data JSON already stored in the DB.
No new DB columns or migrations required.
"""
from __future__ import annotations

import math
import re
from typing import Any


# ── Helpers ───────────────────────────────────────────────────────────────────

_ID_PATTERNS = re.compile(r"\b(id|uuid|key|code|num|no|number|ref|index)\b", re.I)
_DATE_PATTERNS = re.compile(r"\b(date|time|at|created|updated|timestamp|dt|day|month|year)\b", re.I)


def _is_id_like(col: dict) -> bool:
    name = col.get("name", "")
    dtype = col.get("dtype", "")
    inferred = col.get("inferred_type", "")
    unique_count = col.get("unique_count", 0)
    row_count = col.get("_row_count", 1)
    uniqueness = unique_count / max(row_count, 1)
    return bool(_ID_PATTERNS.search(name)) or (uniqueness > 0.95 and inferred in ("numeric", "categorical"))


def _is_datetime_like(col: dict) -> bool:
    inferred = col.get("inferred_type", "")
    name = col.get("name", "")
    return inferred == "datetime" or bool(_DATE_PATTERNS.search(name))


def _is_constant(col: dict, row_count: int) -> bool:
    unique_count = col.get("unique_count", 0)
    missing_pct = col.get("missing_pct", 0)
    if unique_count <= 1:
        return True
    non_missing = row_count * (1 - missing_pct / 100)
    top_vals = col.get("top_values", [])
    if top_vals:
        top_count = top_vals[0].get("count", 0)
        return (top_count / max(non_missing, 1)) > 0.97
    return False


def _is_high_cardinality(col: dict, row_count: int) -> bool:
    unique_count = col.get("unique_count", 0)
    inferred = col.get("inferred_type", "")
    if inferred not in ("categorical", "text"):
        return False
    return (unique_count / max(row_count, 1)) > 0.5


def _missing_pct(col: dict) -> float:
    return float(col.get("missing_pct", 0))


# ── Target Advisor ────────────────────────────────────────────────────────────

def _score_target_candidate(col: dict, row_count: int) -> tuple[float, str, list[str], list[str]]:
    """Return (score 0-1, inferred_task, reasons_good, warnings)."""
    name = col.get("name", "")
    inferred = col.get("inferred_type", "")
    unique_count = col.get("unique_count", 0)
    missing = _missing_pct(col)
    score = 0.5
    reasons: list[str] = []
    warnings: list[str] = []
    task = "classification"

    # Penalise bad candidates
    if _is_id_like(col):
        score -= 0.4
        warnings.append(f"'{name}' looks like an identifier — models cannot predict IDs meaningfully")
    if _is_datetime_like(col):
        score -= 0.35
        warnings.append(f"'{name}' appears time-based — did you mean Time Series Forecasting?")
    if _is_constant(col, row_count):
        score -= 0.5
        warnings.append(f"'{name}' is near-constant — model would learn trivial predictions")
    if missing > 30:
        score -= 0.2
        warnings.append(f"'{name}' has {missing:.0f}% missing values")
    if inferred == "text":
        score -= 0.3
        warnings.append(f"'{name}' is free text — not suitable as a classification target without preprocessing")

    # Infer task and score positively
    if unique_count == 2:
        task = "classification"
        score += 0.4
        reasons.append("Binary target — ideal for classification")
    elif 3 <= unique_count <= 20 and inferred == "categorical":
        task = "classification"
        score += 0.3
        reasons.append(f"Multiclass target ({unique_count} classes)")
    elif inferred == "numeric":
        task = "regression"
        score += 0.25
        reasons.append("Continuous numeric — regression candidate")
    elif unique_count > 20 and inferred == "categorical":
        task = "classification"
        score -= 0.1
        warnings.append(f"High cardinality ({unique_count} classes) — may be difficult to predict")

    if missing < 5:
        score += 0.1
        reasons.append("Low missing values")
    if not _is_id_like(col) and not _is_datetime_like(col):
        reasons.append("Not ID-like or time-based")

    return max(0.0, min(1.0, score)), task, reasons, warnings


def _rank_target_candidates(columns: list[dict], row_count: int) -> list[dict]:
    results = []
    for col in columns:
        col_aug = {**col, "_row_count": row_count}
        score, task, reasons, warnings = _score_target_candidate(col_aug, row_count)
        results.append({
            "name": col["name"],
            "score": round(score, 3),
            "inferred_task": task,
            "reasons": reasons,
            "warnings": warnings,
            "is_recommended": False,
        })
    results.sort(key=lambda x: x["score"], reverse=True)
    if results and results[0]["score"] > 0.4:
        results[0]["is_recommended"] = True
    return results


# ── Task Recommendation ───────────────────────────────────────────────────────

def _recommend_task(col: dict, row_count: int) -> dict:
    name = col.get("name", "")
    inferred = col.get("inferred_type", "")
    unique_count = col.get("unique_count", 0)
    top_vals = col.get("top_values", [])

    if _is_datetime_like(col):
        return {
            "task": "forecasting",
            "confidence": 85,
            "why": ["Target appears time-based", "Time ordering detected"],
            "alternatives": ["classification", "regression"],
        }
    if unique_count == 2:
        vals = [str(v.get("value", "")) for v in top_vals]
        balanced = len(top_vals) >= 2 and min(v.get("count", 0) for v in top_vals[:2]) / max(row_count, 1) > 0.1
        why = [
            f"Target has exactly 2 unique values",
            "Values are categorical (binary)",
            "No ordering detected",
        ]
        if balanced:
            why.append("Classes appear reasonably balanced")
        return {"task": "classification", "confidence": 95, "why": why, "alternatives": []}
    if 3 <= unique_count <= 20 and inferred == "categorical":
        return {
            "task": "classification",
            "confidence": 88,
            "why": [
                f"Target has {unique_count} unique values",
                "Values are categorical",
                "Suitable for multiclass classification",
            ],
            "alternatives": [],
        }
    if inferred == "numeric" and unique_count > 20:
        return {
            "task": "regression",
            "confidence": 90,
            "why": [
                "Target is continuous numeric",
                f"High cardinality ({unique_count} unique values)",
                "No natural class boundaries detected",
            ],
            "alternatives": ["classification (if discretized)"],
        }
    return {
        "task": "classification",
        "confidence": 55,
        "why": ["Could not clearly infer task — defaulting to classification"],
        "alternatives": ["regression"],
    }


# ── Target Distribution ───────────────────────────────────────────────────────

def _target_distribution(col: dict, task: str) -> dict:
    top_vals = col.get("top_values", []) or []
    unique_count = col.get("unique_count", 0)
    missing_pct = _missing_pct(col)

    if task in ("classification", "anomaly_detection"):
        total = sum(v.get("count", 0) for v in top_vals)
        classes = [
            {"label": str(v.get("value", "")), "count": v.get("count", 0),
             "pct": round(v["count"] / max(total, 1) * 100, 1)}
            for v in top_vals[:20]
        ]
        # Imbalance
        if len(classes) >= 2:
            minority_pct = min(c["pct"] for c in classes)
            if minority_pct < 10:
                imbalance = "severe"
            elif minority_pct < 25:
                imbalance = "moderate"
            elif minority_pct < 40:
                imbalance = "mild"
            else:
                imbalance = "none"
        else:
            imbalance = "none"
            minority_pct = 50.0
        return {
            "type": "classification",
            "classes": classes,
            "imbalance": imbalance,
            "minority_pct": round(minority_pct, 1),
            "unique_count": unique_count,
            "missing_pct": missing_pct,
        }
    else:
        # Regression — use histogram + stats from profile
        mean = col.get("mean")
        std = col.get("std")
        mn = col.get("min")
        mx = col.get("max")
        skewness = col.get("skewness")
        histogram = col.get("histogram", [])
        outliers = abs(skewness or 0) > 1.5
        return {
            "type": "regression",
            "mean": mean,
            "std": std,
            "min": mn,
            "max": mx,
            "skewness": skewness,
            "outliers_likely": outliers,
            "histogram": histogram[:20],
            "missing_pct": missing_pct,
        }


# ── Imbalance Severity ────────────────────────────────────────────────────────

def _imbalance_severity(dist: dict) -> dict:
    if dist.get("type") != "classification":
        return {"severity": "n/a", "techniques": []}
    severity = dist.get("imbalance", "none")
    minority = dist.get("minority_pct", 50)
    techniques: list[str] = []
    if severity in ("moderate", "severe"):
        techniques = ["Class weights", "SMOTE oversampling", "Random undersampling"]
    elif severity == "mild":
        techniques = ["Class weights", "Stratified split"]
    metric = "F1 Score" if severity in ("moderate", "severe") else "Accuracy"
    metric_reason = "Imbalanced dataset — accuracy is misleading" if severity in ("moderate", "severe") else "Balanced classes"
    return {
        "severity": severity,
        "minority_pct": minority,
        "techniques": techniques,
        "recommended_metric": metric,
        "metric_reason": metric_reason,
    }


# ── Data Quality Warnings ─────────────────────────────────────────────────────

def _data_quality_warnings(columns: list[dict], row_count: int, target_col: str | None) -> list[dict]:
    warnings: list[str] = []
    result = []

    for col in columns:
        name = col.get("name", "")
        missing = _missing_pct(col)
        if missing > 20:
            result.append({
                "type": "missing_values",
                "severity": "high" if missing > 40 else "medium",
                "message": f"High missing values in '{name}' ({missing:.0f}%)",
                "column": name,
            })
        if _is_constant(col, row_count):
            result.append({
                "type": "constant_column",
                "severity": "medium",
                "message": f"'{name}' is near-constant — likely uninformative",
                "column": name,
            })

    # Duplicate check from profile-level field
    return result


def _leakage_warnings(columns: list[dict], target_col: str | None, corr_matrix: dict | None) -> list[dict]:
    """Flag columns with very high correlation to target."""
    if not target_col or not corr_matrix:
        return []
    cols = corr_matrix.get("columns", [])
    vals = corr_matrix.get("values", [])
    if target_col not in cols:
        return []
    ti = cols.index(target_col)
    warnings = []
    for i, col_name in enumerate(cols):
        if col_name == target_col:
            continue
        try:
            corr = abs(vals[i][ti])
        except (IndexError, TypeError):
            continue
        if corr > 0.85:
            warnings.append({
                "type": "leakage",
                "severity": "high",
                "message": f"'{col_name}' is highly correlated with target ({corr:.2f}) — possible data leakage",
                "column": col_name,
                "correlation": round(corr, 3),
            })
    return warnings


# ── Top Correlated Features ───────────────────────────────────────────────────

def _top_features(columns: list[dict], target_col: str | None, corr_matrix: dict | None) -> list[dict]:
    if not target_col or not corr_matrix:
        return []
    cols = corr_matrix.get("columns", [])
    vals = corr_matrix.get("values", [])
    if target_col not in cols:
        return []
    ti = cols.index(target_col)
    ranked = []
    for i, col_name in enumerate(cols):
        if col_name == target_col:
            continue
        try:
            corr = abs(vals[i][ti])
        except (IndexError, TypeError):
            continue
        if not math.isnan(corr):
            ranked.append({"feature": col_name, "correlation": round(corr, 3)})
    ranked.sort(key=lambda x: x["correlation"], reverse=True)
    return ranked[:10]


# ── Problem Difficulty ────────────────────────────────────────────────────────

def _problem_difficulty(
    n_features: int,
    row_count: int,
    task: str,
    target_dist: dict,
    top_features: list[dict],
) -> dict:
    score = 50  # start medium
    reasons: list[str] = []

    if row_count < 500:
        score += 25
        reasons.append("Very small dataset")
    elif row_count < 5000:
        score += 10
        reasons.append("Small dataset")
    elif row_count > 50000:
        score -= 10
        reasons.append("Large dataset — good for training")

    if n_features < 5:
        score += 15
        reasons.append("Few features available")
    elif n_features > 50:
        score += 5
        reasons.append("Many features — selection important")

    if target_dist.get("imbalance") in ("moderate", "severe"):
        score += 15
        reasons.append("Class imbalance present")

    if top_features and top_features[0].get("correlation", 0) > 0.7:
        score -= 10
        reasons.append("Strong predictive signals found")
    elif not top_features or (top_features and top_features[0].get("correlation", 0) < 0.2):
        score += 10
        reasons.append("Weak predictive signals")

    score = max(0, min(100, score))
    if score < 35:
        level = "Easy"
        baseline = 90
    elif score < 60:
        level = "Medium"
        baseline = 78
    else:
        level = "Hard"
        baseline = 62

    return {
        "level": level,
        "score": score,
        "baseline_accuracy": baseline,
        "reasons": reasons,
    }


# ── Column Type Summary ───────────────────────────────────────────────────────

def _column_type_summary(columns: list[dict], row_count: int) -> dict:
    counts: dict[str, int] = {"numeric": 0, "categorical": 0, "datetime": 0, "text": 0, "boolean": 0, "other": 0}
    high_cardinality = []
    constant_cols = []

    for col in columns:
        t = col.get("inferred_type", "other")
        counts[t] = counts.get(t, 0) + 1
        if _is_high_cardinality(col, row_count):
            high_cardinality.append(col["name"])
        if _is_constant(col, row_count):
            constant_cols.append(col["name"])

    return {
        "numeric": counts.get("numeric", 0),
        "categorical": counts.get("categorical", 0),
        "datetime": counts.get("datetime", 0),
        "text": counts.get("text", 0),
        "boolean": counts.get("boolean", 0),
        "high_cardinality": high_cardinality,
        "constant_columns": constant_cols,
    }


# ── Feature Preview ───────────────────────────────────────────────────────────

def _feature_preview(columns: list[dict], row_count: int) -> list[dict]:
    result = []
    for col in columns:
        name = col.get("name", "")
        inferred = col.get("inferred_type", "")
        missing = _missing_pct(col)
        mn = col.get("min")
        mx = col.get("max")
        skewness = col.get("skewness")
        unique_count = col.get("unique_count", 0)
        top_vals = col.get("top_values", [])

        preview: dict[str, Any] = {
            "name": name,
            "type": inferred,
            "missing_pct": round(missing, 1),
            "unique_count": unique_count,
            "is_constant": _is_constant(col, row_count),
            "is_id_like": _is_id_like(col),
            "is_datetime": _is_datetime_like(col),
        }
        if inferred == "numeric":
            preview["min"] = mn
            preview["max"] = mx
            preview["skewed"] = abs(skewness or 0) > 1.0
            preview["outliers_likely"] = abs(skewness or 0) > 2.0
            outlier = _outlier_info(col)
            if outlier:
                preview["outlier_pct_est"] = outlier["outlier_pct_est"]
                preview["suggested_transform"] = outlier["suggested_transform"]
        elif inferred in ("categorical", "text"):
            preview["top_values"] = [str(v.get("value", "")) for v in (top_vals or [])[:5]]
            cardinality = _cardinality_health(col, row_count)
            if cardinality:
                preview["cardinality_health"] = cardinality["health"]
                preview["suggested_encoding"] = cardinality["suggested_encoding"]
                preview["rare_category_pct"] = cardinality["rare_category_pct"]
        result.append(preview)
    return result


# ── Feature Quality Score ─────────────────────────────────────────────────────

def _feature_quality_score(col: dict, row_count: int, top_feature_names: set[str]) -> dict:
    """Composite 0-100 quality score for a column. Returns grade + reasons."""
    name = col.get("name", "")
    inferred = col.get("inferred_type", "")
    missing = _missing_pct(col)
    unique_count = col.get("unique_count", 0)
    std = col.get("std")
    skewness = col.get("skewness")

    score = 100
    issues: list[str] = []

    # Missing data penalty
    if missing > 40:
        score -= 35
        issues.append(f"Very high missing ({missing:.0f}%)")
    elif missing > 20:
        score -= 20
        issues.append(f"High missing ({missing:.0f}%)")
    elif missing > 5:
        score -= 8
        issues.append(f"Moderate missing ({missing:.0f}%)")

    # Variance / constant
    if _is_constant(col, row_count):
        score -= 40
        issues.append("Near-constant — no predictive value")
    elif inferred == "numeric" and std is not None and std < 1e-8:
        score -= 30
        issues.append("Zero variance")

    # ID-like / leakage risk
    if _is_id_like(col):
        score -= 25
        issues.append("Likely identifier column")

    # High cardinality (categorical)
    if _is_high_cardinality(col, row_count):
        score -= 15
        issues.append("Very high cardinality")

    # Extreme skew for numeric
    if inferred == "numeric" and abs(skewness or 0) > 3:
        score -= 10
        issues.append("Extreme skew — transform recommended")

    # Bonus: in top predictive features
    if name in top_feature_names:
        score = min(100, score + 10)

    score = max(0, score)
    if score >= 75:
        grade = "Good"
    elif score >= 45:
        grade = "Review"
    else:
        grade = "Problematic"

    return {"score": score, "grade": grade, "issues": issues}


# ── Outlier Summary ───────────────────────────────────────────────────────────

def _outlier_info(col: dict) -> dict | None:
    """Return IQR-based outlier estimate and transformation suggestion for numeric cols."""
    inferred = col.get("inferred_type", "")
    if inferred != "numeric":
        return None
    skewness = col.get("skewness") or 0
    mn = col.get("min")
    mx = col.get("max")
    mean = col.get("mean")
    std = col.get("std")
    if std is None or std < 1e-8:
        return None

    # Estimate outlier % via skewness heuristic (no raw data available)
    outlier_pct = 0.0
    if abs(skewness) > 3:
        outlier_pct = 8.0
    elif abs(skewness) > 2:
        outlier_pct = 4.0
    elif abs(skewness) > 1:
        outlier_pct = 1.5

    # Suggested transform
    if mn is not None and mn > 0 and skewness > 1.5:
        suggested = "log"
    elif skewness > 2.5:
        suggested = "clip"
    elif abs(skewness) > 1:
        suggested = "sqrt"
    else:
        suggested = None

    return {
        "outlier_pct_est": round(outlier_pct, 1),
        "skewness": round(skewness, 2),
        "suggested_transform": suggested,
    }


# ── Complexity Indicators ─────────────────────────────────────────────────────

def _complexity_indicators(col_count: int, row_count: int, type_summary: dict) -> dict:
    """Flags about dataset size, dimensionality, sample sufficiency."""
    n_features = col_count  # target not yet excluded but close enough
    ratio = n_features / max(row_count, 1)

    warnings: list[str] = []
    suggestions: list[str] = []

    if ratio > 0.1:
        warnings.append(f"High feature-to-sample ratio ({n_features}/{row_count}) — risk of overfitting")
        suggestions.append("Consider feature selection or regularisation")
    if row_count < 500:
        warnings.append("Very small dataset — model reliability may be low")
        suggestions.append("Consider data augmentation or simpler models")
    elif row_count < 2000:
        warnings.append("Small dataset — prefer cross-validation over simple split")
    if n_features > 100:
        warnings.append(f"High dimensionality ({n_features} features) — curse of dimensionality risk")
        suggestions.append("Apply PCA or feature importance selection first")

    high_card = type_summary.get("high_cardinality", [])
    if len(high_card) > 3:
        warnings.append(f"{len(high_card)} high-cardinality categorical columns may blow up feature space")

    # Minimum recommended rows by rule of thumb: 50× features
    min_recommended = n_features * 50
    if row_count < min_recommended:
        pct = int(row_count / max(min_recommended, 1) * 100)
        sufficiency = f"{pct}% of recommended minimum ({min_recommended:,} rows for {n_features} features)"
    else:
        sufficiency = "Sufficient"

    return {
        "feature_count": n_features,
        "row_count": row_count,
        "feature_row_ratio": round(ratio, 4),
        "sample_sufficiency": sufficiency,
        "warnings": warnings,
        "suggestions": suggestions,
    }


# ── Data Type Issues ──────────────────────────────────────────────────────────

_CURRENCY_RE = re.compile(r"[$€£¥₹]|\b(usd|eur|gbp|amount|price|cost|fee|salary)\b", re.I)
_NUMERIC_AS_TEXT_RE = re.compile(r"^\s*-?\d+[\.,]?\d*\s*$")


def _data_type_issues(columns: list[dict]) -> list[dict]:
    """Detect type mismatches and inconsistencies."""
    issues: list[dict] = []
    for col in columns:
        name = col.get("name", "")
        dtype = col.get("dtype", "")
        inferred = col.get("inferred_type", "")
        top_vals = col.get("top_values", [])

        # Numeric data stored as object/string
        if dtype in ("object", "string") and inferred in ("categorical", "text"):
            sample_vals = [str(v.get("value", "")) for v in (top_vals or [])[:5]]
            numeric_like = sum(1 for v in sample_vals if _NUMERIC_AS_TEXT_RE.match(v))
            if len(sample_vals) > 0 and numeric_like / len(sample_vals) >= 0.8:
                issues.append({
                    "column": name,
                    "issue": "numeric_as_text",
                    "severity": "medium",
                    "message": f"'{name}' appears numeric but stored as text — cast to float/int",
                })

        # Currency in name but stored as object
        if _CURRENCY_RE.search(name) and dtype in ("object", "string"):
            issues.append({
                "column": name,
                "issue": "currency_as_text",
                "severity": "medium",
                "message": f"'{name}' looks like a currency column stored as text — strip symbols and cast",
            })

        # Boolean encoded as int with only 0/1 but typed as int64/float
        unique_count = col.get("unique_count", 0)
        if dtype in ("int64", "float64") and inferred == "numeric" and unique_count == 2:
            top_values = [v.get("value") for v in (top_vals or [])[:2]]
            if set(top_values) <= {0, 1, 0.0, 1.0}:
                issues.append({
                    "column": name,
                    "issue": "boolean_as_numeric",
                    "severity": "low",
                    "message": f"'{name}' has only 0/1 values — consider casting to boolean",
                })

    return issues


# ── Cardinality Health ────────────────────────────────────────────────────────

def _cardinality_health(col: dict, row_count: int) -> dict | None:
    """For categorical columns: encoding suggestion and rare-category info."""
    inferred = col.get("inferred_type", "")
    if inferred not in ("categorical", "text"):
        return None
    unique_count = col.get("unique_count", 0)
    top_vals = col.get("top_values", [])
    name = col.get("name", "")

    # Estimate rare categories (< 1% of rows)
    threshold = max(row_count * 0.01, 1)
    rare_count = sum(1 for v in (top_vals or []) if v.get("count", 0) < threshold)
    rare_pct = round(rare_count / max(unique_count, 1) * 100, 1)

    if unique_count <= 2:
        encoding = "binary"
    elif unique_count <= 10:
        encoding = "one-hot"
    elif unique_count <= 50:
        encoding = "target encoding (recommended) or label encoding"
    else:
        encoding = "target encoding or hashing (high cardinality)"

    health: str
    if _is_id_like({"name": name, "inferred_type": inferred, "unique_count": unique_count, "_row_count": row_count}):
        health = "drop"
    elif unique_count > row_count * 0.5:
        health = "problematic"
    elif rare_pct > 50:
        health = "review"
    else:
        health = "ok"

    return {
        "unique_count": unique_count,
        "rare_category_pct": rare_pct,
        "suggested_encoding": encoding,
        "health": health,
    }


# ── Time Awareness ────────────────────────────────────────────────────────────

def _time_awareness(columns: list[dict]) -> dict:
    datetime_cols = [c["name"] for c in columns if _is_datetime_like(c)]
    if not datetime_cols:
        return {"has_datetime": False, "datetime_columns": []}
    return {
        "has_datetime": True,
        "datetime_columns": datetime_cols,
        "options": [
            {"id": "standard", "label": "Standard ML (random split)"},
            {"id": "time_aware", "label": "Time-aware validation (recommended)"},
            {"id": "forecasting", "label": "Forecasting task"},
        ],
        "recommended": "time_aware",
    }


# ── Main Entry Point ──────────────────────────────────────────────────────────

def compute_smart_profile(
    profile_data: dict,
    target_col: str | None = None,
    task_type: str | None = None,
) -> dict:
    """
    Derive ML-expert insights from raw profile_data.
    Returns a structured SmartProfile dict for the frontend.
    """
    row_count: int = profile_data.get("row_count", 0) or 0
    col_count: int = profile_data.get("col_count", 0) or 0
    columns: list[dict] = profile_data.get("columns", [])
    duplicate_rows: int = profile_data.get("duplicate_rows", 0) or 0
    missing_cells: int = profile_data.get("missing_cells", 0) or 0
    memory_mb: float = profile_data.get("memory_usage_mb", 0) or 0

    total_cells = max(row_count * col_count, 1)
    missing_pct = round(missing_cells / total_cells * 100, 1)
    duplicate_pct = round(duplicate_rows / max(row_count, 1) * 100, 1)

    # Column type summary
    type_summary = _column_type_summary(columns, row_count)

    # Corr matrix from profile (may be absent)
    corr_matrix: dict | None = profile_data.get("correlation_matrix")

    # Target advisor
    target_candidates = _rank_target_candidates(columns, row_count)

    # Resolve target column
    resolved_target = target_col
    if not resolved_target and target_candidates:
        best = target_candidates[0]
        if best["score"] > 0.4:
            resolved_target = best["name"]

    target_col_data = next((c for c in columns if c.get("name") == resolved_target), None)

    # Task recommendation
    if target_col_data:
        task_rec = _recommend_task(target_col_data, row_count)
        resolved_task = task_type or task_rec["task"]
    else:
        task_rec = None
        resolved_task = task_type or "classification"

    # Target distribution
    target_dist = _target_distribution(target_col_data, resolved_task) if target_col_data else None

    # Imbalance severity
    imbalance = _imbalance_severity(target_dist) if target_dist else {"severity": "n/a", "techniques": []}

    # Quality warnings + leakage
    quality_warnings = _data_quality_warnings(columns, row_count, resolved_target)
    leakage = _leakage_warnings(columns, resolved_target, corr_matrix)
    all_warnings = quality_warnings + leakage

    # Top features
    top_features = _top_features(columns, resolved_target, corr_matrix)
    top_feature_names = {f["feature"] for f in top_features[:5]}

    # Feature preview (now includes outlier + cardinality health)
    feature_preview = _feature_preview(columns, row_count)

    # Feature quality scores (per column)
    feature_quality_scores = {
        col.get("name", ""): _feature_quality_score(col, row_count, top_feature_names)
        for col in columns
    }

    # Complexity indicators
    complexity = _complexity_indicators(col_count, row_count, type_summary)

    # Data type issues
    dtype_issues = _data_type_issues(columns)

    # Time awareness
    time_awareness = _time_awareness(columns)

    # Problem difficulty
    difficulty = _problem_difficulty(
        n_features=col_count - (1 if resolved_target else 0),
        row_count=row_count,
        task=resolved_task,
        target_dist=target_dist or {},
        top_features=top_features,
    )

    return {
        "overview": {
            "row_count": row_count,
            "col_count": col_count,
            "memory_mb": round(memory_mb, 1),
            "duplicate_rows": duplicate_rows,
            "duplicate_pct": duplicate_pct,
            "missing_cells": missing_cells,
            "missing_pct": missing_pct,
        },
        "column_type_summary": type_summary,
        "target_candidates": target_candidates,
        "recommended_target": resolved_target,
        "task_recommendation": task_rec,
        "resolved_task": resolved_task,
        "target_distribution": target_dist,
        "imbalance_severity": imbalance,
        "time_awareness": time_awareness,
        "data_quality_warnings": all_warnings,
        "feature_preview": feature_preview,
        "top_features": top_features,
        "problem_difficulty": difficulty,
        "feature_quality_scores": feature_quality_scores,
        "complexity_indicators": complexity,
        "data_type_issues": dtype_issues,
    }
