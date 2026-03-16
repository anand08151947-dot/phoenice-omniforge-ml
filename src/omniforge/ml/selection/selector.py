"""Compute feature importance and selection plan from the current dataset."""
from __future__ import annotations

import math
import uuid
from typing import Any

import numpy as np
import pandas as pd


def _safe(val: Any) -> float:
    if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))):
        return 0.0
    if isinstance(val, (np.integer,)):
        return float(int(val))
    if isinstance(val, (np.floating,)):
        return float(val)
    return float(val)


def compute_selection(dataset_id: str, df: pd.DataFrame, target_column: str, method: str = "mutual_info") -> dict:
    """Compute feature importances and recommend keep/drop."""
    # Include ALL non-target columns, encoding categoricals
    feat_cols = [c for c in df.columns if c != target_column]

    if not feat_cols or target_column not in df.columns:
        return {
            "dataset_id": dataset_id,
            "importances": [],
            "selected_count": 0,
            "dropped_count": 0,
            "method": method,
        }

    from sklearn.preprocessing import LabelEncoder

    # Build X: numeric as-is, categoricals label-encoded
    X_parts = {}
    discrete_mask = []
    for col in feat_cols:
        series = df[col]
        if series.dtype == "object" or str(series.dtype) == "category":
            le = LabelEncoder()
            encoded = le.fit_transform(series.fillna("__missing__").astype(str))
            X_parts[col] = encoded
            discrete_mask.append(True)
        else:
            filled = pd.to_numeric(series, errors="coerce")
            X_parts[col] = filled.fillna(filled.median()).values
            discrete_mask.append(False)

    X = pd.DataFrame(X_parts)

    y = df[target_column].dropna()
    X = X.loc[y.index]

    importances_raw: list[float] = []

    try:
        from sklearn.feature_selection import mutual_info_classif, mutual_info_regression

        n_unique = y.nunique()
        if n_unique <= 20:
            le = LabelEncoder()
            y_enc = le.fit_transform(y.astype(str))
            scores = mutual_info_classif(X, y_enc, discrete_features=discrete_mask, random_state=42, n_neighbors=3)
        else:
            scores = mutual_info_regression(X, y.values, discrete_features=discrete_mask, random_state=42, n_neighbors=3)
        importances_raw = [_safe(s) for s in scores]
        method = "mutual_info"
    except Exception:
        # Fallback: absolute Pearson correlation
        importances_raw = []
        for col in feat_cols:
            try:
                v = abs(_safe(pd.to_numeric(df[col], errors="coerce").corr(pd.to_numeric(df[target_column], errors="coerce"))))
                importances_raw.append(0.0 if (v != v) else v)  # NaN → 0
            except Exception:
                importances_raw.append(0.0)
        method = "pearson_abs"

    # Normalize to 0-1
    max_imp = max(importances_raw) if importances_raw else 1.0
    if max_imp == 0:
        max_imp = 1.0
    normalized = [v / max_imp for v in importances_raw]

    # Threshold: keep if importance > 1% of max (i.e., normalized > 0.01)
    threshold = 0.01
    pairs = sorted(zip(feat_cols, normalized), key=lambda x: x[1], reverse=True)

    importances = []
    for rank, (feat, imp) in enumerate(pairs, start=1):
        importances.append({
            "feature": feat,
            "importance": round(imp, 6),
            "rank": rank,
            "method": method,
            "keep": imp >= threshold,
        })

    selected = sum(1 for i in importances if i["keep"])
    dropped = len(importances) - selected

    return {
        "dataset_id": dataset_id,
        "importances": importances,
        "selected_count": selected,
        "dropped_count": dropped,
        "method": method,
    }
