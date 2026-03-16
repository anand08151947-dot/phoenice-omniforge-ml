"""Evaluation engine — Phase 8 (overfitting) + Phase 9 (metrics, CM, ROC)."""
from __future__ import annotations

import warnings
import numpy as np
import pandas as pd
from sklearn.metrics import (
    confusion_matrix,
    roc_curve,
    auc,
    f1_score,
    accuracy_score,
    r2_score,
    mean_squared_error,
)
from sklearn.model_selection import StratifiedKFold, KFold, cross_val_predict

from ..training.trainer import (
    _build_models,
    _preprocess,
    _get_selected_features,
    _extract_params,
)

warnings.filterwarnings("ignore")

OVERFIT_THRESHOLD = 0.10  # train_score - cv_score > this → overfit warning


def run_evaluation(
    dataset_id: str,
    df: pd.DataFrame,
    target_column: str,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
    training_results: dict,
) -> dict:
    """Compute full evaluation report for champion + leaderboard."""
    strategy = (sampling_config or {}).get("config", {}).get("strategy", "none")
    is_classifier = task_type in ("classification", "anomaly_detection")

    # Feature columns
    candidates_tr = training_results.get("candidates", [])
    if selection_plan and selection_plan.get("importances"):
        feature_cols = _get_selected_features(selection_plan)
    else:
        feature_cols = [c for c in df.columns if c != target_column]
    feature_cols = [f for f in feature_cols if f in df.columns and f != target_column]

    X, y = _preprocess(df, feature_cols, target_column)
    n_splits = 5
    cv_splitter = (
        StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        if is_classifier
        else KFold(n_splits=n_splits, shuffle=True, random_state=42)
    )

    # Build all models (same configs as training)
    models_cfg = _build_models(task_type, strategy)
    model_map = {m["model_name"]: m["model"] for m in models_cfg}

    # Champion = best cv_score from training
    done_candidates = [c for c in candidates_tr if c.get("status") == "done"]
    if not done_candidates:
        raise ValueError("No successfully trained candidates found")
    champion_tr = max(done_candidates, key=lambda c: c["cv_score"])
    champion_name = champion_tr["model_name"]

    # Build leaderboard with overfitting flag
    leaderboard = []
    for rank, cand in enumerate(candidates_tr, 1):
        gap = cand.get("train_score", 0) - cand.get("cv_score", 0)
        overfit = gap > OVERFIT_THRESHOLD and cand.get("status") == "done"
        if rank == 1:
            status = "champion"
        elif rank <= 3:
            status = "challenger"
        else:
            status = "dropped"
        leaderboard.append({
            "rank": rank,
            "model_id": cand["id"],
            "model_name": cand["model_name"],
            "cv_score": cand.get("cv_score", 0.0),
            "train_score": cand.get("train_score", 0.0),
            "f1": cand.get("f1", 0.0),
            "auc_roc": cand.get("auc_roc", 0.0),
            "rmse": cand.get("rmse"),
            "train_time_s": cand.get("train_time_s", 0.0),
            "status": status,
            "overfit": overfit,
            "overfit_gap": round(gap, 4),
        })

    # Compute confusion matrix + ROC for champion using CV predictions
    confusion_matrix_data: dict = {"labels": [], "values": []}
    roc_curve_data: list = []
    feature_importances: list = []

    champion_model = model_map.get(champion_name)
    if champion_model is not None:
        try:
            y_pred = cross_val_predict(champion_model, X, y, cv=cv_splitter, method="predict")

            if is_classifier:
                # Confusion matrix
                labels_unique = sorted(np.unique(y).tolist())
                cm = confusion_matrix(y, y_pred, labels=labels_unique)
                confusion_matrix_data = {
                    "labels": [str(l) for l in labels_unique],
                    "values": cm.tolist(),
                }

                # ROC curve (binary only)
                n_classes = len(labels_unique)
                if n_classes == 2:
                    try:
                        y_prob = cross_val_predict(
                            champion_model, X, y, cv=cv_splitter, method="predict_proba"
                        )
                        fpr_arr, tpr_arr, _ = roc_curve(y, y_prob[:, 1])
                        roc_curve_data = [
                            {"fpr": round(float(f), 4), "tpr": round(float(t), 4)}
                            for f, t in zip(fpr_arr, tpr_arr)
                        ][::max(1, len(fpr_arr) // 100)]  # downsample to ≤100 pts
                    except Exception:
                        pass
        except Exception:
            pass

        # Feature importances from champion fit on full data
        try:
            champion_model.fit(X, y)
            if hasattr(champion_model, "feature_importances_"):
                imps = champion_model.feature_importances_
            elif hasattr(champion_model, "coef_"):
                coef = champion_model.coef_
                imps = np.abs(coef[0] if coef.ndim > 1 else coef)
            else:
                imps = np.ones(len(feature_cols))
            # Normalise
            total = imps.sum() or 1.0
            feature_importances = [
                {"feature": feat, "importance": round(float(imp / total), 6)}
                for feat, imp in sorted(
                    zip(feature_cols, imps), key=lambda x: x[1], reverse=True
                )
            ]
        except Exception:
            feature_importances = [{"feature": f, "importance": 0.0} for f in feature_cols]

    overfit_warnings = [
        f"{e['model_name']}: train={e['train_score']:.3f} vs CV={e['cv_score']:.3f} (gap {e['overfit_gap']:.3f})"
        for e in leaderboard
        if e.get("overfit")
    ]

    return {
        "dataset_id": dataset_id,
        "champion_model_id": champion_tr["id"],
        "champion_model_name": champion_name,
        "task_type": task_type,
        "target_column": target_column,
        "n_features": len(feature_cols),
        "sampling_strategy": strategy,
        "leaderboard": leaderboard,
        "confusion_matrix": confusion_matrix_data,
        "roc_curve": roc_curve_data,
        "feature_importances": feature_importances[:30],  # top 30
        "overfit_warnings": overfit_warnings,
    }
