"""EDA analyzer: computes correlation, missingness, MI scores, and issues from a dataframe."""
from __future__ import annotations

import math
import uuid
from typing import Any

import numpy as np
import pandas as pd


def _safe(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return 0.0
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    return val


def analyze_dataframe(dataset_id: str, df: pd.DataFrame, profile: dict, target_column: str | None = None) -> dict:
    issues: list[dict] = []
    n_rows = len(df)

    # --- Missingness ---
    missingness: list[dict] = []
    for col_prof in profile.get("columns", []):
        mp = col_prof.get("missing_pct", 0) or 0
        if mp > 0:
            mc = int(round(mp * n_rows))
            missingness.append({
                "column": col_prof["name"],
                "missing_count": mc,
                "missing_pct": round(mp, 4),  # 0-1 decimal; frontend multiplies by 100
                "pattern": "MAR" if mp < 0.1 else "MNAR" if mp > 0.5 else "unknown"
            })
            if mp > 0.3:
                issues.append({
                    "id": str(uuid.uuid4()),
                    "severity": "high" if mp > 0.5 else "medium",
                    "type": "missing_values",
                    "title": f"High missing rate: {col_prof['name']}",
                    "detail": f"{mp*100:.1f}% of values missing in {col_prof['name']}",
                    "phase": "cleaning",
                    "metric": round(mp, 4),
                    "affected_columns": [col_prof["name"]]
                })

    # --- Duplicate rows ---
    dup = profile.get("duplicate_rows", 0) or 0
    if dup > 0:
        issues.append({
            "id": str(uuid.uuid4()),
            "severity": "medium" if dup / max(n_rows, 1) > 0.02 else "low",
            "type": "duplicates",
            "title": f"{dup:,} duplicate rows detected",
            "detail": f"Dataset contains {dup} duplicate rows ({dup/max(n_rows,1)*100:.1f}% of data)",
            "phase": "cleaning",
            "metric": round(dup / max(n_rows, 1), 4),
            "affected_columns": []
        })

    # --- Correlation matrix (numeric cols only) ---
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    corr_cols: list[str] = []
    corr_vals: list[list[float]] = []
    high_corr_pairs: list[str] = []

    if len(numeric_cols) >= 2:
        # Limit to 25 numeric cols for display
        display_cols = numeric_cols[:25]
        corr_df = df[display_cols].corr(method="pearson")
        corr_cols = display_cols
        corr_vals = [[_safe(v) or 0.0 for v in row] for row in corr_df.values.tolist()]

        # Detect high correlations (>0.9, excluding diagonal)
        for i in range(len(display_cols)):
            for j in range(i + 1, len(display_cols)):
                v = corr_df.iloc[i, j]
                if not math.isnan(v) and abs(v) > 0.9:
                    high_corr_pairs.append(f"{display_cols[i]} ↔ {display_cols[j]} ({v:.2f})")

        if high_corr_pairs:
            issues.append({
                "id": str(uuid.uuid4()),
                "severity": "high",
                "type": "correlation",
                "title": f"High correlation between {len(high_corr_pairs)} feature pair(s)",
                "detail": "Highly correlated features may cause multicollinearity. Consider dropping one. Pairs: " + ", ".join(high_corr_pairs[:5]),
                "phase": "features",
                "metric": 0.9,
                "affected_columns": list(set([p.split(" ↔ ")[0] for p in high_corr_pairs[:5]]))
            })

    # --- Target distribution ---
    target_distribution: list[dict] = []
    if target_column and target_column in df.columns:
        tgt = df[target_column].dropna()
        vc = tgt.value_counts().head(20)
        target_distribution = [{"label": str(k), "count": int(v)} for k, v in vc.items()]

        # Check class imbalance (for classification targets with few unique values)
        if len(vc) >= 2 and len(vc) <= 20:
            max_c = int(vc.iloc[0])
            min_c = int(vc.iloc[-1])
            ratio = max_c / max(min_c, 1)
            if ratio > 3:
                issues.append({
                    "id": str(uuid.uuid4()),
                    "severity": "high" if ratio > 10 else "medium",
                    "type": "class_imbalance",
                    "title": f"Class imbalance detected in '{target_column}'",
                    "detail": f"Majority class is {ratio:.1f}x larger than minority class. Consider SMOTE or class weighting.",
                    "phase": "sampling",
                    "metric": round(ratio, 2),
                    "affected_columns": [target_column]
                })

    # --- Low variance ---
    for col_prof in profile.get("columns", []):
        if col_prof.get("inferred_type") == "numeric" and "Near-zero variance" in (col_prof.get("warnings") or []):
            issues.append({
                "id": str(uuid.uuid4()),
                "severity": "low",
                "type": "low_variance",
                "title": f"Near-zero variance: {col_prof['name']}",
                "detail": f"Column '{col_prof['name']}' has near-constant values — low predictive power.",
                "phase": "features",
                "metric": 0.0,
                "affected_columns": [col_prof["name"]]
            })

    # --- MI scores ---
    mi_scores: list[dict] = []
    if target_column and target_column in df.columns and numeric_cols:
        try:
            from sklearn.feature_selection import mutual_info_classif, mutual_info_regression
            from sklearn.preprocessing import LabelEncoder

            feat_cols = [c for c in numeric_cols if c != target_column]
            if feat_cols:
                X = df[feat_cols].copy()
                X = X.fillna(X.median(numeric_only=True))
                y = df[target_column].dropna()
                X = X.loc[y.index]

                n_unique_target = y.nunique()
                if n_unique_target <= 20:  # classification
                    le = LabelEncoder()
                    y_enc = le.fit_transform(y.astype(str))
                    scores = mutual_info_classif(X, y_enc, random_state=42, n_neighbors=3)
                else:  # regression
                    scores = mutual_info_regression(X, y.values, random_state=42, n_neighbors=3)

                mi_scores = [{"feature": c, "score": round(_safe(s) or 0.0, 6)} for c, s in zip(feat_cols, scores)]
                mi_scores.sort(key=lambda x: x["score"], reverse=True)
        except Exception:
            # Fall back to absolute Pearson correlation if target is numeric
            if target_column in numeric_cols:
                for c in numeric_cols:
                    if c == target_column:
                        continue
                    try:
                        corr_val = abs(_safe(df[c].corr(df[target_column])) or 0.0)
                        mi_scores.append({"feature": c, "score": round(corr_val, 6)})
                    except Exception:
                        pass
                mi_scores.sort(key=lambda x: x["score"], reverse=True)

    return {
        "dataset_id": dataset_id,
        "issues": issues,
        "missingness": missingness,
        "correlation_matrix": {"columns": corr_cols, "values": corr_vals},
        "target_distribution": target_distribution,
        "mi_scores": mi_scores[:30],
    }
