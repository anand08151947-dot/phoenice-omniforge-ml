"""Compute class imbalance report from profile data."""
from __future__ import annotations


def compute_imbalance(dataset_id: str, profile: dict, target_column: str) -> dict:
    """Derive imbalance report from the target_distribution in the EDA report (or profile)."""
    # Find target column in profile
    columns = profile.get("columns", [])
    target_prof = next((c for c in columns if c["name"] == target_column), None)
    
    n_rows = profile.get("row_count", 1) or 1
    
    if target_prof and target_prof.get("top_values"):
        top_values = target_prof["top_values"]
        class_dist = [
            {"label": str(v["value"]), "count": int(v["count"]), "pct": round(v["count"] / n_rows, 4)}
            for v in sorted(top_values, key=lambda x: x["count"], reverse=True)
        ]
    else:
        # fallback: unknown distribution
        class_dist = []
    
    if len(class_dist) >= 2:
        majority = class_dist[0]["count"]
        minority = class_dist[-1]["count"]
        ratio = round(majority / max(minority, 1), 2)
    else:
        ratio = 1.0
    
    # Recommend strategy
    if ratio > 10:
        recommended = "oversample_smote"
    elif ratio > 3:
        recommended = "class_weights"
    else:
        recommended = "none"
    
    return {
        "dataset_id": dataset_id,
        "target_column": target_column,
        "class_distribution": class_dist,
        "imbalance_ratio": ratio,
        "recommended_strategy": recommended,
    }
