"""Cleaning plan generator and applier."""
from __future__ import annotations

import uuid

import numpy as np
import pandas as pd


def generate_cleaning_plan(dataset_id: str, profile: dict) -> dict:
    """Generate a cleaning plan from profile_data (no MinIO download needed)."""
    actions: list[dict] = []
    n_rows = profile.get("row_count", 0) or 0
    duplicate_rows = profile.get("duplicate_rows", 0) or 0

    # Duplicate rows
    if duplicate_rows > 0:
        actions.append({
            "id": str(uuid.uuid4()),
            "column": "__all__",
            "issue_type": "duplicates",
            "issue_detail": f"{duplicate_rows:,} duplicate rows detected",
            "severity": "medium" if duplicate_rows / max(n_rows, 1) > 0.02 else "low",
            "strategy": "drop_rows",
            "affected_rows": duplicate_rows,
            "estimated_impact": f"Remove {duplicate_rows:,} exact duplicate rows"
        })

    for col_prof in profile.get("columns", []):
        col_name = col_prof["name"]
        mp = col_prof.get("missing_pct", 0) or 0
        inf_type = col_prof.get("inferred_type", "categorical")
        warnings = col_prof.get("warnings", []) or []
        unique_count = col_prof.get("unique_count", 0) or 0

        # High missing: suggest drop column
        if mp > 0.5:
            actions.append({
                "id": str(uuid.uuid4()),
                "column": col_name,
                "issue_type": "missing_values",
                "issue_detail": f"{mp*100:.1f}% missing — too high for imputation",
                "severity": "high",
                "strategy": "drop_column",
                "affected_rows": int(round(mp * n_rows)),
                "estimated_impact": f"Drop column '{col_name}' ({mp*100:.1f}% missing)"
            })
        elif mp > 0.05:
            strategy = "median_impute" if inf_type == "numeric" else "mode_impute"
            actions.append({
                "id": str(uuid.uuid4()),
                "column": col_name,
                "issue_type": "missing_values",
                "issue_detail": f"{mp*100:.1f}% missing values",
                "severity": "high" if mp > 0.3 else "medium",
                "strategy": strategy,
                "affected_rows": int(round(mp * n_rows)),
                "estimated_impact": f"Impute {int(round(mp*n_rows)):,} missing values with {'median' if inf_type=='numeric' else 'mode'}"
            })

        # Near-zero variance
        if "Near-zero variance" in warnings:
            actions.append({
                "id": str(uuid.uuid4()),
                "column": col_name,
                "issue_type": "low_variance",
                "issue_detail": "Near-constant column — low predictive value",
                "severity": "low",
                "strategy": "drop_column",
                "affected_rows": 0,
                "estimated_impact": f"Drop low-variance column '{col_name}'"
            })

        # High cardinality categorical
        if "High cardinality" in warnings and inf_type in ("categorical", "text"):
            actions.append({
                "id": str(uuid.uuid4()),
                "column": col_name,
                "issue_type": "high_cardinality",
                "issue_detail": f"{unique_count:,} unique values — may cause overfitting",
                "severity": "medium",
                "strategy": "drop_column",
                "affected_rows": 0,
                "estimated_impact": f"Drop high-cardinality column '{col_name}' ({unique_count:,} unique values)"
            })

        # Outlier detection (skewness)
        skewness = col_prof.get("skewness")
        if inf_type == "numeric" and skewness is not None:
            try:
                sk = float(skewness)
                if abs(sk) > 3.0:
                    actions.append({
                        "id": str(uuid.uuid4()),
                        "column": col_name,
                        "issue_type": "outliers",
                        "issue_detail": f"Skewness = {sk:.2f} — likely outliers present",
                        "severity": "medium" if abs(sk) > 5 else "low",
                        "strategy": "clip_outliers",
                        "affected_rows": int(n_rows * 0.01),
                        "estimated_impact": f"Clip extreme values in '{col_name}' (skew={sk:.2f}) to IQR bounds"
                    })
            except (TypeError, ValueError):
                pass

    rows_affected = sum(a["affected_rows"] for a in actions)
    cols_to_drop = sum(1 for a in actions if a["strategy"] == "drop_column")

    return {
        "dataset_id": dataset_id,
        "actions": actions,
        "estimated_rows_affected": rows_affected,
        "estimated_cols_removed": cols_to_drop,
    }


def apply_cleaning_plan(
    df: pd.DataFrame,
    actions: list[dict],
    strategy_overrides: dict[str, str],  # {action_id: strategy}
) -> pd.DataFrame:
    """Apply cleaning strategies to a DataFrame. Returns cleaned DataFrame."""
    result = df.copy()

    for action in actions:
        action_id = action["id"]
        col = action["column"]
        strategy = strategy_overrides.get(action_id, action["strategy"])

        if col == "__all__":
            if strategy == "drop_rows":
                result = result.drop_duplicates()
            continue

        if col not in result.columns:
            continue

        try:
            if strategy == "drop_column":
                result = result.drop(columns=[col], errors="ignore")
            elif strategy == "mean_impute":
                result[col] = result[col].fillna(result[col].mean())
            elif strategy == "median_impute":
                result[col] = result[col].fillna(result[col].median())
            elif strategy == "mode_impute":
                mode_val = result[col].mode()
                if len(mode_val) > 0:
                    result[col] = result[col].fillna(mode_val.iloc[0])
            elif strategy == "forward_fill":
                result[col] = result[col].ffill()
            elif strategy == "backward_fill":
                result[col] = result[col].bfill()
            elif strategy == "constant_fill":
                result[col] = result[col].fillna(0)
            elif strategy == "clip_outliers":
                q1 = result[col].quantile(0.25)
                q3 = result[col].quantile(0.75)
                iqr = q3 - q1
                result[col] = result[col].clip(lower=q1 - 1.5 * iqr, upper=q3 + 1.5 * iqr)
            elif strategy == "remove_outliers":
                q1 = result[col].quantile(0.25)
                q3 = result[col].quantile(0.75)
                iqr = q3 - q1
                mask = (result[col] >= q1 - 1.5 * iqr) & (result[col] <= q3 + 1.5 * iqr)
                result = result[mask]
            elif strategy == "drop_rows":
                result = result.dropna(subset=[col])
            elif strategy == "none":
                pass
        except Exception:
            pass  # Skip failed strategies silently

    return result
