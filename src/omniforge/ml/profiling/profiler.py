"""
Fast custom dataset profiler using pandas.
Returns a dict matching the DatasetProfile TypeScript interface.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd


def _safe(val: Any) -> Any:
    """Convert numpy scalars / NaN to JSON-serializable Python types."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    if isinstance(val, (np.bool_,)):
        return bool(val)
    return val


def _infer_type(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    # Try datetime parse heuristic on object columns
    if series.dtype == object:
        sample = series.dropna().head(50)
        if len(sample) > 0:
            try:
                pd.to_datetime(sample, format="mixed")
                return "datetime"
            except Exception:
                pass
        # Text vs categorical heuristic
        avg_len = sample.astype(str).str.len().mean() if len(sample) > 0 else 0
        if avg_len > 50:
            return "text"
    return "categorical"


def _profile_column(series: pd.Series, n_rows: int) -> dict:
    col_name = series.name
    n_missing = int(series.isna().sum())
    missing_pct = _safe(n_missing / n_rows) if n_rows > 0 else 0.0
    unique_count = int(series.nunique(dropna=True))
    inferred = _infer_type(series)

    profile: dict[str, Any] = {
        "name": col_name,
        "dtype": str(series.dtype),
        "inferred_type": inferred,
        "missing_pct": missing_pct,
        "unique_count": unique_count,
        "is_target": False,
        "warnings": [],
    }

    warnings: list[str] = []
    if missing_pct is not None and missing_pct > 0.3:
        warnings.append("High missing values")

    non_null = series.dropna()

    if inferred == "numeric":
        try:
            profile["mean"] = _safe(non_null.mean())
            profile["std"] = _safe(non_null.std())
            profile["min"] = _safe(non_null.min())
            profile["max"] = _safe(non_null.max())
            profile["skewness"] = _safe(non_null.skew())
            profile["kurtosis"] = _safe(non_null.kurtosis())

            std_val = profile.get("std")
            if std_val is not None and std_val < 0.01 and unique_count > 1:
                warnings.append("Near-zero variance")

            # Histogram
            try:
                counts, bin_edges = np.histogram(non_null.astype(float).dropna(), bins=10)
                profile["histogram"] = [
                    {
                        "bin": f"{_safe(bin_edges[i]):.4g}–{_safe(bin_edges[i+1]):.4g}",
                        "count": int(counts[i]),
                    }
                    for i in range(len(counts))
                ]
            except Exception:
                profile["histogram"] = []
        except Exception:
            pass

    elif inferred in ("categorical", "boolean", "text"):
        try:
            top = non_null.value_counts().head(5)
            profile["top_values"] = [
                {"value": str(v), "count": int(c)} for v, c in top.items()
            ]
        except Exception:
            profile["top_values"] = []

    elif inferred == "datetime":
        try:
            dt_series = pd.to_datetime(non_null, format="mixed", errors="coerce")
            profile["min"] = str(dt_series.min()) if not dt_series.empty else None
            profile["max"] = str(dt_series.max()) if not dt_series.empty else None
        except Exception:
            pass

    # High cardinality warning
    if n_rows > 0 and (unique_count / n_rows) > 0.95 and inferred not in ("numeric",):
        warnings.append("High cardinality")

    profile["warnings"] = warnings
    return profile


def profile_dataframe(dataset_id: str, df: pd.DataFrame) -> dict:
    n_rows, n_cols = df.shape
    duplicate_rows = int(df.duplicated().sum())
    missing_cells = int(df.isna().sum().sum())
    missing_pct = _safe(missing_cells / (n_rows * n_cols)) if (n_rows * n_cols) > 0 else 0.0
    memory_mb = _safe(df.memory_usage(deep=True).sum() / 1024 / 1024)

    columns = []
    for col in df.columns:
        try:
            col_profile = _profile_column(df[col], n_rows)
        except Exception as exc:
            col_profile = {
                "name": col,
                "dtype": str(df[col].dtype),
                "inferred_type": "categorical",
                "missing_pct": None,
                "unique_count": 0,
                "is_target": False,
                "warnings": [f"Profiling error: {exc}"],
            }
        columns.append(col_profile)

    return {
        "dataset_id": dataset_id,
        "row_count": n_rows,
        "col_count": n_cols,
        "duplicate_rows": duplicate_rows,
        "missing_cells": missing_cells,
        "missing_pct": missing_pct,
        "memory_usage_mb": memory_mb,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "columns": columns,
    }
