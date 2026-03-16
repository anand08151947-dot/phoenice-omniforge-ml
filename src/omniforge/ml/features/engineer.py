"""Auto-generate feature engineering plan from profile data."""
from __future__ import annotations

import uuid


def generate_feature_plan(dataset_id: str, profile: dict, target_column: str | None = None, pii_report: dict | None = None) -> dict:
    """Generate a FeatureEngineeringPlan from profile_data."""
    
    # Build set of PII-dropped columns to exclude
    dropped_pii = set()
    if pii_report and "pii_columns" in pii_report:
        for col in pii_report["pii_columns"]:
            if col.get("applied_action") in ("drop", "mask", "hash", "pseudonymize", "encrypt"):
                # Only truly dropped columns should be excluded
                if col.get("status") == "dropped":
                    dropped_pii.add(col["column"])

    specs = []
    columns = profile.get("columns", [])

    for col_prof in columns:
        col_name = col_prof["name"]
        inferred = col_prof.get("inferred_type", "categorical")
        unique_count = col_prof.get("unique_count", 0) or 0
        n_rows = profile.get("row_count", 1) or 1
        skewness = col_prof.get("skewness")
        dtype = col_prof.get("dtype", "object")
        warnings = col_prof.get("warnings") or []

        # Skip target
        if col_name == target_column:
            continue

        # Skip high-cardinality non-numeric (ID-like columns)
        if inferred in ("categorical", "text") and unique_count / max(n_rows, 1) > 0.9:
            # Auto-suggest drop
            specs.append({
                "id": str(uuid.uuid4()),
                "source_columns": [col_name],
                "output_name": col_name,
                "transform": "none",
                "dtype_in": dtype,
                "dtype_out": dtype,
                "enabled": False,  # disabled by default for ID-like cols
                "note": "High cardinality — likely an ID column. Disabled by default.",
            })
            continue

        if inferred == "numeric":
            # Recommend log transform for highly skewed numerics
            if skewness is not None:
                try:
                    sk = float(skewness)
                    if abs(sk) > 2.0:
                        specs.append({
                            "id": str(uuid.uuid4()),
                            "source_columns": [col_name],
                            "output_name": f"{col_name}_log",
                            "transform": "log",
                            "dtype_in": dtype,
                            "dtype_out": "float64",
                            "enabled": True,
                            "note": f"Skewness={sk:.2f} → log transform recommended",
                        })
                        continue
                except (TypeError, ValueError):
                    pass
            # Normal numeric → standard scale
            specs.append({
                "id": str(uuid.uuid4()),
                "source_columns": [col_name],
                "output_name": col_name,
                "transform": "standard_scale",
                "dtype_in": dtype,
                "dtype_out": "float64",
                "enabled": True,
                "note": "Numeric — standard scaling",
            })

        elif inferred == "categorical":
            cardinality = unique_count
            if cardinality <= 15:
                transform = "one_hot_encode"
                note = f"Low cardinality ({cardinality}) → one-hot encode"
            elif cardinality <= 50:
                transform = "label_encode"
                note = f"Medium cardinality ({cardinality}) → label encode"
            else:
                transform = "label_encode"
                note = f"High cardinality ({cardinality}) → label encode (consider target encode)"

            specs.append({
                "id": str(uuid.uuid4()),
                "source_columns": [col_name],
                "output_name": col_name,
                "transform": transform,
                "dtype_in": dtype,
                "dtype_out": "int64",
                "enabled": True,
                "note": note,
            })

        elif inferred == "datetime":
            specs.append({
                "id": str(uuid.uuid4()),
                "source_columns": [col_name],
                "output_name": f"{col_name}_parts",
                "transform": "date_parts",
                "dtype_in": dtype,
                "dtype_out": "int64",
                "enabled": True,
                "note": "Datetime → extract year/month/day/dayofweek",
            })

        elif inferred == "boolean":
            specs.append({
                "id": str(uuid.uuid4()),
                "source_columns": [col_name],
                "output_name": col_name,
                "transform": "none",
                "dtype_in": dtype,
                "dtype_out": "int64",
                "enabled": True,
                "note": "Boolean — keep as-is",
            })

    total_in = len(specs)
    total_out = sum(1 for s in specs if s["enabled"])

    return {
        "dataset_id": dataset_id,
        "specs": specs,
        "total_features_in": total_in,
        "total_features_out": total_out,
    }
