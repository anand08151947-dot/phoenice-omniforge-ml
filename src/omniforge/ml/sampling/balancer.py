"""Compute class imbalance report from profile data."""
from __future__ import annotations


def apply_sampling(X_train, y_train, strategy: str, random_state: int = 42):
    """Apply sampling strategy to training data only.

    Args:
        X_train: numpy array or DataFrame of training features
        y_train: training labels
        strategy: one of 'oversample_smote', 'adasyn', 'undersample_random', 'class_weights', 'none'
        random_state: for reproducibility

    Returns:
        X_resampled, y_resampled (same type as input)
    """
    import logging
    logger = logging.getLogger(__name__)

    if strategy in (None, "none", "class_weights"):
        return X_train, y_train

    try:
        from imblearn.over_sampling import SMOTE, ADASYN
        from imblearn.under_sampling import RandomUnderSampler

        if strategy == "oversample_smote":
            # k_neighbors must be <= minority class count - 1
            from collections import Counter
            min_count = min(Counter(y_train).values())
            k_neighbors = min(5, min_count - 1) if min_count > 1 else 1
            sampler = SMOTE(random_state=random_state, k_neighbors=k_neighbors)
        elif strategy == "adasyn":
            sampler = ADASYN(random_state=random_state)
        elif strategy == "undersample_random":
            sampler = RandomUnderSampler(random_state=random_state)
        else:
            logger.warning(f"Unknown sampling strategy '{strategy}', skipping")
            return X_train, y_train

        X_res, y_res = sampler.fit_resample(X_train, y_train)
        logger.info(f"Applied {strategy}: {len(y_train)} → {len(y_res)} training samples")
        return X_res, y_res

    except ImportError:
        logger.warning("imbalanced-learn not installed; skipping sampling. Run: pip install imbalanced-learn")
        return X_train, y_train
    except Exception as e:
        logger.warning(f"Sampling failed ({e}); using original data")
        return X_train, y_train


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
