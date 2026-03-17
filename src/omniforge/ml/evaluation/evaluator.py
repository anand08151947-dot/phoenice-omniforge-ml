"""Evaluation engine — Phase 8 (overfitting) + Phase 9 (metrics, CM, ROC)."""
from __future__ import annotations

import pickle
import time
import warnings
import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    confusion_matrix,
    roc_curve,
    auc,
    f1_score,
    accuracy_score,
    r2_score,
    mean_squared_error,
    precision_recall_curve,
    precision_recall_fscore_support,
)
from sklearn.preprocessing import label_binarize
from sklearn.model_selection import (
    StratifiedKFold, KFold, cross_val_predict, learning_curve as sk_learning_curve,
)

from ..training.trainer import (
    _build_models,
    _preprocess,
    _get_selected_features,
    _extract_params,
)

warnings.filterwarnings("ignore")

OVERFIT_THRESHOLD = 0.10  # train_score - cv_score > this → overfit warning


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mcnemar_test(y_true: np.ndarray, pred_a: np.ndarray, pred_b: np.ndarray) -> dict:
    """Asymptotic McNemar test — is model A significantly better than B?"""
    ab = np.sum((pred_a == y_true) & (pred_b != y_true))  # A right, B wrong
    ba = np.sum((pred_a != y_true) & (pred_b == y_true))  # A wrong, B right
    n = ab + ba
    if n == 0:
        return {"statistic": 0.0, "p_value": 1.0, "significant": False}
    # McNemar statistic with continuity correction
    stat = ((abs(ab - ba) - 1) ** 2) / max(n, 1)
    from scipy.stats import chi2  # type: ignore
    p_value = float(chi2.sf(stat, df=1))
    return {
        "statistic": round(float(stat), 4),
        "p_value": round(p_value, 4),
        "significant": p_value < 0.05,
        "ab": int(ab),
        "ba": int(ba),
    }


def _model_complexity(model, X: np.ndarray) -> dict:
    """Estimate model size and inference latency."""
    try:
        size_kb = round(len(pickle.dumps(model)) / 1024, 1)
    except Exception:
        size_kb = None

    try:
        single = X[:1]
        t0 = time.perf_counter()
        for _ in range(100):
            model.predict(single)
        inference_ms = round((time.perf_counter() - t0) / 100 * 1000, 3)
        batch_thr = round(1000 / max(inference_ms, 0.001))
    except Exception:
        inference_ms = None
        batch_thr = None

    params = {}
    try:
        p = model.get_params()
        if "n_estimators" in p:
            params["n_estimators"] = p["n_estimators"]
        if "max_depth" in p:
            params["max_depth"] = p["max_depth"]
    except Exception:
        pass

    return {
        "model_size_kb": size_kb,
        "inference_ms_per_row": inference_ms,
        "batch_throughput_per_sec": batch_thr,
        **params,
    }


def _threshold_analysis(y_true: np.ndarray, y_prob: np.ndarray) -> list[dict]:
    """Sweep decision threshold 0.05–0.95, return metrics at each point."""
    thresholds = np.round(np.arange(0.05, 0.96, 0.05), 2)
    results = []
    for t in thresholds:
        y_pred_t = (y_prob >= t).astype(int)
        tp = int(np.sum((y_pred_t == 1) & (y_true == 1)))
        fp = int(np.sum((y_pred_t == 1) & (y_true == 0)))
        fn = int(np.sum((y_pred_t == 0) & (y_true == 1)))
        tn = int(np.sum((y_pred_t == 0) & (y_true == 0)))
        denom_p = tp + fp or 1
        denom_r = tp + fn or 1
        prec = tp / denom_p
        rec = tp / denom_r
        f1 = 2 * prec * rec / max(prec + rec, 1e-9)
        fpr = fp / max(fp + tn, 1)
        results.append({
            "threshold": float(t),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "fpr": round(fpr, 4),
            "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        })
    return results


def _prediction_distribution(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 20) -> list[dict]:
    """Histogram of prediction scores split by true class."""
    bins = np.linspace(0, 1, n_bins + 1)
    result = []
    for i in range(n_bins):
        lo, hi = bins[i], bins[i + 1]
        mask = (y_prob >= lo) & (y_prob < hi)
        result.append({
            "bin": round(float((lo + hi) / 2), 3),
            "count_positive": int(np.sum(mask & (y_true == 1))),
            "count_negative": int(np.sum(mask & (y_true == 0))),
        })
    return result


def _learning_curves(model, X: np.ndarray, y: np.ndarray, cv_splitter, is_classifier: bool) -> list[dict]:
    """Compute train/val score at 5 training size checkpoints."""
    scoring = "f1_weighted" if is_classifier else "r2"
    n = X.shape[0]
    train_sizes_abs = np.unique(np.linspace(max(50, int(n * 0.1)), n, 5, dtype=int))
    try:
        train_sizes_out, train_scores, val_scores = sk_learning_curve(
            model, X, y,
            train_sizes=train_sizes_abs,
            cv=cv_splitter,
            scoring=scoring,
            n_jobs=1,
            error_score=np.nan,  # Don't raise on rare-class splits; use NaN instead
        )
        results = []
        for sz, tr, val in zip(train_sizes_out, train_scores, val_scores):
            # Filter out NaN folds (rare-class stratification failure at small sizes)
            tr_clean = tr[~np.isnan(tr)]
            val_clean = val[~np.isnan(val)]
            if len(tr_clean) == 0 or len(val_clean) == 0:
                continue
            tr_mean = float(np.mean(tr_clean))
            val_mean = float(np.mean(val_clean))
            results.append({
                "training_size": int(sz),
                "training_fraction": round(int(sz) / n, 3),
                "train_score": round(tr_mean, 4),
                "val_score": round(val_mean, 4),
                "gap": round(tr_mean - val_mean, 4),
            })
        return results
    except Exception:
        return []


# ── Main Entry Point ──────────────────────────────────────────────────────────

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
    if is_classifier:
        y = y.astype(int)  # StratifiedKFold requires integer labels, not floats
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

    # Sort candidates by cv_score descending for ranking
    sorted_candidates = sorted(done_candidates, key=lambda c: c["cv_score"], reverse=True)

    # Build leaderboard with overfitting flag
    leaderboard = []
    for rank, cand in enumerate(sorted_candidates, 1):
        gap = cand.get("train_score", 0) - cand.get("cv_score", 0)
        overfit = gap > OVERFIT_THRESHOLD
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

    # ── Champion model deep evaluation ────────────────────────────────────────
    confusion_matrix_data: dict = {"labels": [], "values": []}
    roc_curve_data: list = []
    pr_curve_data: list = []
    per_class_metrics: list = []
    threshold_analysis: list = []
    prediction_distribution: list = []
    calibration_data: list = []
    learning_curve_data: list = []
    feature_importances: list = []
    model_complexity: dict = {}
    mcnemar_result: dict | None = None
    optimal_threshold: float = 0.5
    eval_error: str | None = None

    champion_model = model_map.get(champion_name)
    if champion_model is None:
        eval_error = f"Champion model '{champion_name}' not found in model_map (keys: {list(model_map.keys())})"
    else:
        try:
            y_pred = cross_val_predict(champion_model, X, y, cv=cv_splitter, method="predict")

            if is_classifier:
                # ── Confusion Matrix ──────────────────────────────────────────
                labels_unique = sorted(np.unique(y).tolist())
                cm = confusion_matrix(y, y_pred, labels=labels_unique)
                confusion_matrix_data = {
                    "labels": [str(l) for l in labels_unique],
                    "values": cm.tolist(),
                }

                # ── Per-class metrics ─────────────────────────────────────────
                p_arr, r_arr, f1_arr, sup_arr = precision_recall_fscore_support(
                    y, y_pred, labels=labels_unique, zero_division=0
                )
                per_class_metrics = [
                    {
                        "class": str(labels_unique[i]),
                        "precision": round(float(p_arr[i]), 4),
                        "recall": round(float(r_arr[i]), 4),
                        "f1": round(float(f1_arr[i]), 4),
                        "support": int(sup_arr[i]),
                    }
                    for i in range(len(labels_unique))
                ]

                # ── Probability-based analyses (binary or multiclass OVR) ─────
                n_classes = len(labels_unique)
                try:
                    y_prob_all = cross_val_predict(
                        champion_model, X, y, cv=cv_splitter, method="predict_proba"
                    )

                    if n_classes == 2:
                        y_prob = y_prob_all[:, 1]

                        # ROC curve
                        fpr_arr, tpr_arr, _ = roc_curve(y, y_prob)
                        roc_curve_data = [
                            {"fpr": round(float(f), 4), "tpr": round(float(t), 4)}
                            for f, t in zip(fpr_arr, tpr_arr)
                        ][::max(1, len(fpr_arr) // 100)]

                        # PR curve
                        prec_arr, rec_arr, _ = precision_recall_curve(y, y_prob)
                        pr_curve_data = [
                            {"recall": round(float(r), 4), "precision": round(float(p), 4)}
                            for p, r in zip(prec_arr, rec_arr)
                        ][::max(1, len(prec_arr) // 100)]

                        # Threshold analysis
                        threshold_analysis = _threshold_analysis(y, y_prob)
                        best = max(threshold_analysis, key=lambda x: x["f1"])
                        optimal_threshold = best["threshold"]

                        # Prediction score distribution
                        prediction_distribution = _prediction_distribution(y, y_prob)

                        # Calibration curve
                        try:
                            frac_pos, mean_pred = calibration_curve(
                                y, y_prob, n_bins=10, strategy="uniform"
                            )
                            calibration_data = [
                                {
                                    "mean_predicted": round(float(mp), 4),
                                    "fraction_positive": round(float(fp), 4),
                                }
                                for mp, fp in zip(mean_pred, frac_pos)
                            ]
                        except Exception:
                            pass

                    else:
                        # Multiclass: one-vs-rest ROC per class
                        y_bin = label_binarize(y, classes=labels_unique)
                        roc_curves_ovr = []
                        for i, cls in enumerate(labels_unique):
                            try:
                                fpr_arr, tpr_arr, _ = roc_curve(y_bin[:, i], y_prob_all[:, i])
                                roc_auc = round(float(auc(fpr_arr, tpr_arr)), 4)
                                pts = [
                                    {"fpr": round(float(f), 4), "tpr": round(float(t), 4)}
                                    for f, t in zip(fpr_arr, tpr_arr)
                                ][::max(1, len(fpr_arr) // 50)]
                                roc_curves_ovr.append({
                                    "class": str(cls),
                                    "auc": roc_auc,
                                    "points": pts,
                                })
                            except Exception:
                                pass
                        if roc_curves_ovr:
                            # Primary ROC = best-AUC class; pr_curve carries per-class AUC summary
                            best_cls_entry = max(roc_curves_ovr, key=lambda x: x["auc"])
                            roc_curve_data = best_cls_entry["points"]
                            pr_curve_data = [
                                {"recall": e["auc"], "precision": 0.0, "class": e["class"]}
                                for e in roc_curves_ovr
                            ]

                except Exception as _prob_exc:  # noqa: BLE001
                    import logging
                    logging.getLogger(__name__).error(
                        "predict_proba / threshold / curves failed: %s", _prob_exc, exc_info=True
                    )
                    eval_error = (eval_error or "") + f" | predict_proba: {_prob_exc}"

                # ── McNemar vs second-best challenger ─────────────────────────
                if len(sorted_candidates) >= 2:
                    challenger_name = sorted_candidates[1]["model_name"]
                    challenger_model = model_map.get(challenger_name)
                    if challenger_model is not None:
                        try:
                            y_pred_b = cross_val_predict(
                                challenger_model, X, y, cv=cv_splitter, method="predict"
                            )
                            mcnemar_result = _mcnemar_test(y, y_pred, y_pred_b)
                            mcnemar_result["champion"] = champion_name
                            mcnemar_result["challenger"] = challenger_name
                        except Exception:
                            pass

        except Exception as _exc:  # noqa: BLE001
            import logging
            logging.getLogger(__name__).error("Evaluation cross_val_predict failed: %s", _exc, exc_info=True)
            eval_error = str(_exc)

        # ── Feature Importances (fit on full data) ────────────────────────────
        try:
            champion_model.fit(X, y)
            if hasattr(champion_model, "feature_importances_"):
                imps = champion_model.feature_importances_
            elif hasattr(champion_model, "coef_"):
                coef = champion_model.coef_
                imps = np.abs(coef[0] if coef.ndim > 1 else coef)
            else:
                imps = np.ones(len(feature_cols))
            total = imps.sum() or 1.0
            feature_importances = [
                {"feature": feat, "importance": round(float(imp / total), 6)}
                for feat, imp in sorted(
                    zip(feature_cols, imps), key=lambda x: x[1], reverse=True
                )
            ]
        except Exception:
            feature_importances = [{"feature": f, "importance": 0.0} for f in feature_cols]

        # ── Model Complexity ──────────────────────────────────────────────────
        try:
            model_complexity = _model_complexity(champion_model, X)
        except Exception:
            pass

        # ── Learning Curves ───────────────────────────────────────────────────
        try:
            learning_curve_data = _learning_curves(
                model_map.get(champion_name) or champion_model,
                X, y, cv_splitter, is_classifier,
            )
        except Exception:
            pass

    overfit_warnings = [
        f"{e['model_name']} (Rank {e['rank']} — {e['status']}): train={e['train_score']:.3f} vs CV={e['cv_score']:.3f} (gap {e['overfit_gap']:.3f})"
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
        "n_classes": len(confusion_matrix_data.get("labels", [])) if is_classifier else None,
        "sampling_strategy": strategy,
        "leaderboard": leaderboard,
        # Classification charts
        "confusion_matrix": confusion_matrix_data,
        "roc_curve": roc_curve_data,
        "pr_curve": pr_curve_data,
        # Per-class + threshold
        "per_class_metrics": per_class_metrics,
        "threshold_analysis": threshold_analysis,
        "optimal_threshold": optimal_threshold,
        # Distribution + calibration
        "prediction_distribution": prediction_distribution,
        "calibration_data": calibration_data,
        # Learning + complexity
        "learning_curve": learning_curve_data,
        "model_complexity": model_complexity,
        # Statistical test
        "mcnemar": mcnemar_result,
        # Feature importances
        "feature_importances": feature_importances[:30],
        "overfit_warnings": overfit_warnings,
        "eval_error": eval_error,
    }
