"""AutoML trainer for Phase 7 — expert diagnostics edition."""
from __future__ import annotations

import io
import pickle
import time
import uuid
import warnings
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.model_selection import StratifiedKFold, KFold
from sklearn.metrics import (
    roc_auc_score, f1_score, accuracy_score, r2_score, mean_squared_error,
    classification_report, roc_curve, precision_recall_curve, confusion_matrix,
)
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")


# ─── feature selection helper ────────────────────────────────────────────────

def _get_selected_features(selection_plan: dict) -> list[str]:
    importances = selection_plan.get("importances", [])
    return [f["feature"] for f in importances if f.get("keep", True)]


# ─── model factory ───────────────────────────────────────────────────────────

def _build_models(task_type: str, strategy: str) -> list[dict]:
    cw = "balanced" if strategy == "class_weights" else None
    if task_type in ("classification", "anomaly_detection"):
        return [
            {"id": str(uuid.uuid4()), "model_name": "LightGBM",
             "library": "lightgbm", "model": _make_lgbm_clf(cw)},
            {"id": str(uuid.uuid4()), "model_name": "XGBoost",
             "library": "xgboost", "model": _make_xgb_clf(cw)},
            {"id": str(uuid.uuid4()), "model_name": "Random Forest",
             "library": "sklearn",
             "model": RandomForestClassifier(n_estimators=200, class_weight=cw,
                                             random_state=42, n_jobs=-1)},
            {"id": str(uuid.uuid4()), "model_name": "Logistic Regression",
             "library": "sklearn",
             "model": LogisticRegression(max_iter=1000, class_weight=cw,
                                         random_state=42, n_jobs=-1)},
        ]
    return [
        {"id": str(uuid.uuid4()), "model_name": "LightGBM",
         "library": "lightgbm", "model": _make_lgbm_reg()},
        {"id": str(uuid.uuid4()), "model_name": "XGBoost",
         "library": "xgboost", "model": _make_xgb_reg()},
        {"id": str(uuid.uuid4()), "model_name": "Random Forest",
         "library": "sklearn",
         "model": RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)},
        {"id": str(uuid.uuid4()), "model_name": "Ridge Regression",
         "library": "sklearn", "model": Ridge(alpha=1.0)},
    ]


def _make_lgbm_clf(cw):
    try:
        import lightgbm as lgb
        return lgb.LGBMClassifier(n_estimators=300, learning_rate=0.05,
                                   num_leaves=63, class_weight=cw,
                                   random_state=42, n_jobs=-1, verbose=-1)
    except ImportError:
        from sklearn.ensemble import GradientBoostingClassifier
        return GradientBoostingClassifier(n_estimators=100, random_state=42)


def _make_xgb_clf(cw):
    try:
        import xgboost as xgb
        return xgb.XGBClassifier(n_estimators=300, learning_rate=0.05,
                                  max_depth=6, eval_metric="logloss",
                                  random_state=42, n_jobs=-1, verbosity=0)
    except ImportError:
        from sklearn.ensemble import GradientBoostingClassifier
        return GradientBoostingClassifier(n_estimators=100, random_state=42)


def _make_lgbm_reg():
    try:
        import lightgbm as lgb
        return lgb.LGBMRegressor(n_estimators=300, learning_rate=0.05,
                                  num_leaves=63, random_state=42, n_jobs=-1, verbose=-1)
    except ImportError:
        from sklearn.ensemble import GradientBoostingRegressor
        return GradientBoostingRegressor(n_estimators=100, random_state=42)


def _make_xgb_reg():
    try:
        import xgboost as xgb
        return xgb.XGBRegressor(n_estimators=300, learning_rate=0.05,
                                 max_depth=6, random_state=42, n_jobs=-1, verbosity=0)
    except ImportError:
        from sklearn.ensemble import GradientBoostingRegressor
        return GradientBoostingRegressor(n_estimators=100, random_state=42)


# ─── preprocessing ────────────────────────────────────────────────────────────

def _preprocess(df: pd.DataFrame, feature_cols: list[str], target: str):
    X = df[feature_cols].copy()
    y = df[target].copy()
    for col in X.columns:
        if X[col].dtype == "object" or str(X[col].dtype) == "category":
            X[col] = X[col].fillna("__missing__")
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
        else:
            median = pd.to_numeric(X[col], errors="coerce").median()
            X[col] = pd.to_numeric(X[col], errors="coerce").fillna(median)
    if y.dtype == "object" or str(y.dtype) == "category":
        le = LabelEncoder()
        y = le.fit_transform(y.astype(str))
    else:
        median = pd.to_numeric(y, errors="coerce").median()
        y = pd.to_numeric(y, errors="coerce").fillna(median)
    return X.values, np.array(y)


# ─── per-class metrics ────────────────────────────────────────────────────────

def _compute_per_class_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> list[dict]:
    try:
        report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
        result = []
        for label, metrics in report.items():
            if label in ("accuracy", "macro avg", "weighted avg"):
                continue
            result.append({
                "class": str(label),
                "precision": round(float(metrics["precision"]), 4),
                "recall": round(float(metrics["recall"]), 4),
                "f1": round(float(metrics["f1-score"]), 4),
                "support": int(metrics["support"]),
            })
        return result
    except Exception:
        return []


# ─── threshold analysis ────────────────────────────────────────────────────────

def _compute_threshold_analysis(y_true: np.ndarray,
                                  y_prob_pos: np.ndarray) -> list[dict]:
    results = []
    n_neg = max(int(np.sum(y_true == 0)), 1)
    for t in [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]:
        y_pred_t = (y_prob_pos >= t).astype(int)
        tp = int(np.sum((y_pred_t == 1) & (y_true == 1)))
        fp = int(np.sum((y_pred_t == 1) & (y_true == 0)))
        fn = int(np.sum((y_pred_t == 0) & (y_true == 1)))
        tn = int(np.sum((y_pred_t == 0) & (y_true == 0)))
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
        fpr = fp / n_neg
        results.append({
            "threshold": t,
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "fpr": round(fpr, 4),
            "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        })
    return results


# ─── confusion matrix ─────────────────────────────────────────────────────────

def _compute_confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    try:
        labels = sorted(np.unique(np.concatenate([y_true, y_pred])).tolist())
        cm = confusion_matrix(y_true, y_pred, labels=labels)
        total = max(cm.sum(), 1)
        return {
            "labels": [str(l) for l in labels],
            "values": cm.tolist(),
            "values_pct": [[round(v / total * 100, 1) for v in row] for row in cm.tolist()],
        }
    except Exception:
        return {}


# ─── ROC curve ───────────────────────────────────────────────────────────────

def _compute_roc_curve(y_true: np.ndarray, y_prob_pos: np.ndarray) -> list[dict]:
    try:
        fpr_arr, tpr_arr, _ = roc_curve(y_true, y_prob_pos)
        # Downsample to max 60 points for payload size
        idx = np.round(np.linspace(0, len(fpr_arr) - 1, min(60, len(fpr_arr)))).astype(int)
        return [{"fpr": round(float(fpr_arr[i]), 4), "tpr": round(float(tpr_arr[i]), 4)}
                for i in idx]
    except Exception:
        return []


# ─── PR curve ────────────────────────────────────────────────────────────────

def _compute_pr_curve(y_true: np.ndarray, y_prob_pos: np.ndarray) -> list[dict]:
    try:
        prec_arr, rec_arr, _ = precision_recall_curve(y_true, y_prob_pos)
        idx = np.round(np.linspace(0, len(prec_arr) - 1, min(60, len(prec_arr)))).astype(int)
        return [{"recall": round(float(rec_arr[i]), 4),
                 "precision": round(float(prec_arr[i]), 4)}
                for i in idx]
    except Exception:
        return []


# ─── feature importance ───────────────────────────────────────────────────────

def _compute_feature_importance(model, feature_cols: list[str]) -> list[dict]:
    try:
        if hasattr(model, "feature_importances_"):
            imps = model.feature_importances_
        elif hasattr(model, "coef_"):
            imps = np.abs(model.coef_[0]) if model.coef_.ndim > 1 else np.abs(model.coef_)
        else:
            return []
        total = imps.sum()
        if total == 0:
            return []
        result = [
            {"feature": feature_cols[i], "importance": round(float(imps[i] / total), 4)}
            for i in range(len(feature_cols))
        ]
        result.sort(key=lambda x: x["importance"], reverse=True)
        return result[:20]  # top 20
    except Exception:
        return []


# ─── model complexity & inference speed ──────────────────────────────────────

def _compute_model_complexity(model, X_sample: np.ndarray) -> dict:
    out: dict[str, Any] = {}
    try:
        params = model.get_params() if hasattr(model, "get_params") else {}
        out["n_estimators"] = params.get("n_estimators") or params.get("num_estimators")
        out["max_depth"] = params.get("max_depth") or params.get("num_leaves")
    except Exception:
        pass
    # Pickle size
    try:
        buf = io.BytesIO()
        pickle.dump(model, buf)
        out["model_size_kb"] = round(buf.tell() / 1024, 1)
    except Exception:
        pass
    # Inference latency (predict 100 rows, repeat 5 times)
    try:
        sample = X_sample[:min(100, len(X_sample))]
        times = []
        for _ in range(5):
            t0 = time.perf_counter()
            model.predict(sample)
            times.append(time.perf_counter() - t0)
        per_row_ms = round(np.median(times) / len(sample) * 1000, 4)
        out["inference_ms_per_row"] = per_row_ms
        out["batch_throughput_per_sec"] = int(1000 / per_row_ms) if per_row_ms > 0 else 0
    except Exception:
        pass
    return out


# ─── learning curve ───────────────────────────────────────────────────────────

def _compute_learning_curve(model, X: np.ndarray, y: np.ndarray,
                              is_classifier: bool) -> list[dict]:
    """Train the model at 5 different training-set sizes and record train/val scores."""
    try:
        fractions = [0.2, 0.4, 0.6, 0.8, 1.0]
        # Use a fixed 20% hold-out for validation
        n = len(X)
        holdout = max(int(n * 0.2), 50)
        if n - holdout < 20:
            return []
        rng = np.random.default_rng(42)
        idx = rng.permutation(n)
        val_idx, train_pool = idx[:holdout], idx[holdout:]

        X_val, y_val = X[val_idx], y[val_idx]
        X_pool, y_pool = X[train_pool], y[train_pool]

        results = []
        for frac in fractions:
            n_train = max(int(len(X_pool) * frac), 20)
            sub_idx = train_pool[:n_train] if frac == 1.0 else rng.choice(
                len(X_pool), n_train, replace=False)
            X_tr, y_tr = X[sub_idx], y[sub_idx]

            m = clone(model)
            m.fit(X_tr, y_tr)
            y_pred_train = m.predict(X_tr)
            y_pred_val = m.predict(X_val)

            if is_classifier:
                train_sc = round(float(accuracy_score(y_tr, y_pred_train)), 4)
                val_sc = round(float(accuracy_score(y_val, y_pred_val)), 4)
            else:
                train_sc = round(max(float(r2_score(y_tr, y_pred_train)), 0.0), 4)
                val_sc = round(max(float(r2_score(y_val, y_pred_val)), 0.0), 4)

            results.append({
                "training_size": n_train,
                "training_fraction": frac,
                "train_score": train_sc,
                "val_score": val_sc,
                "gap": round(train_sc - val_sc, 4),
            })
        return results
    except Exception:
        return []


# ─── leakage detection ────────────────────────────────────────────────────────

def _detect_leakage(X: np.ndarray, y: np.ndarray,
                    feature_cols: list[str], threshold: float = 0.85) -> list[dict]:
    result = []
    for i, col in enumerate(feature_cols):
        try:
            corr = float(np.corrcoef(X[:, i], y)[0, 1])
            if not np.isnan(corr) and abs(corr) > threshold:
                result.append({"feature": col, "correlation": round(abs(corr), 4)})
        except Exception:
            pass
    return sorted(result, key=lambda x: x["correlation"], reverse=True)


# ─── strengths & weaknesses ───────────────────────────────────────────────────

def _generate_sw(result: dict, is_classifier: bool) -> dict:
    strengths: list[str] = []
    weaknesses: list[str] = []
    cv_std = result.get("cv_std", 0.0)
    gap = result.get("train_score", 0.0) - result.get("cv_score", 0.0)
    model_name = result.get("model_name", "")

    if cv_std < 0.02:
        strengths.append(f"Very stable across folds (σ={cv_std:.1%})")
    elif cv_std > 0.05:
        weaknesses.append(f"Unstable fold scores (σ={cv_std:.1%}) — check for data issues")

    if gap > 0.15:
        weaknesses.append(f"Strong overfitting — train-CV gap {gap:.1%}")
    elif gap > 0.05:
        weaknesses.append(f"Mild overfitting — train-CV gap {gap:.1%}")
    else:
        strengths.append("No significant overfitting detected")

    if is_classifier:
        auc = result.get("auc_roc", 0.0)
        f1 = result.get("f1", 0.0)
        if auc > 0.75:
            strengths.append(f"Good discrimination (AUC={auc:.3f})")
        elif auc > 0.65:
            strengths.append(f"Moderate discrimination (AUC={auc:.3f})")
        elif auc < 0.6:
            weaknesses.append(f"Weak discrimination (AUC={auc:.3f}) — model may not rank risk well")
        if f1 > 0.75:
            strengths.append("Strong weighted F1")
        elif f1 < 0.6:
            weaknesses.append("Low F1 — likely struggling with minority class")

    if model_name == "Logistic Regression":
        strengths.append("Fully interpretable (linear coefficients)")
        strengths.append("Very fast inference — linear complexity")
        weaknesses.append("Cannot capture non-linear relationships")
    elif model_name == "Random Forest":
        strengths.append("Robust to outliers and noisy features")
        strengths.append("Feature importances available natively")
        if gap > 0.10:
            weaknesses.append("Tends to memorise training data — consider lower max_depth")
    elif model_name in ("LightGBM", "XGBoost"):
        strengths.append("Fast inference, scalable to large datasets")
        strengths.append("Handles missing values natively")
        strengths.append("Usually best tabular performance (Kaggle benchmark)")

    return {"strengths": strengths, "weaknesses": weaknesses}


# ─── hyperparameter extraction ────────────────────────────────────────────────

def _extract_params(model) -> dict:
    try:
        return {k: v for k, v in model.get_params().items() if not callable(v)}
    except Exception:
        return {}


# ─── core CV training loop ────────────────────────────────────────────────────

def _train_model_cv(model, X: np.ndarray, y: np.ndarray,
                    cv_splitter, is_classifier: bool,
                    feature_cols: list[str]) -> dict:
    """Manual CV loop — captures per-fold metrics + all expert diagnostics."""
    fold_cv_scores: list[float] = []
    fold_train_scores: list[float] = []
    all_val_true: list = []
    all_val_pred: list = []
    all_val_prob: list = []
    has_proba = False

    for train_idx, val_idx in cv_splitter.split(X, y if is_classifier else None):
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y[train_idx], y[val_idx]

        m = clone(model)
        m.fit(X_train, y_train)
        y_pred_val = m.predict(X_val)
        y_pred_train = m.predict(X_train)

        all_val_true.extend(y_val.tolist())
        all_val_pred.extend(y_pred_val.tolist())

        if is_classifier:
            fold_cv_scores.append(round(float(accuracy_score(y_val, y_pred_val)), 4))
            fold_train_scores.append(round(float(accuracy_score(y_train, y_pred_train)), 4))
            try:
                prob = m.predict_proba(X_val)
                all_val_prob.extend(prob.tolist())
                has_proba = True
            except Exception:
                all_val_prob.extend([[0.5, 0.5]] * len(y_val))
        else:
            fold_cv_scores.append(round(max(float(r2_score(y_val, y_pred_val)), 0.0), 4))
            fold_train_scores.append(round(max(float(r2_score(y_train, y_pred_train)), 0.0), 4))

    cv_score = float(np.mean(fold_cv_scores))
    cv_std = float(np.std(fold_cv_scores))
    train_score = float(np.mean(fold_train_scores))

    y_true_arr = np.array(all_val_true)
    y_pred_arr = np.array(all_val_pred)

    fold_scores_out = [
        {"fold": i + 1, "cv_score": s, "train_score": t, "gap": round(t - s, 4)}
        for i, (s, t) in enumerate(zip(fold_cv_scores, fold_train_scores))
    ]

    auc, f1_val, rmse = 0.0, 0.0, None
    per_class_metrics: list[dict] = []
    threshold_analysis: list[dict] = []
    confusion_matrix_data: dict = {}
    roc_curve_data: list[dict] = []
    pr_curve_data: list[dict] = []

    if is_classifier:
        f1_val = round(float(f1_score(y_true_arr, y_pred_arr,
                                       average="weighted", zero_division=0)), 4)
        per_class_metrics = _compute_per_class_metrics(y_true_arr, y_pred_arr)
        confusion_matrix_data = _compute_confusion_matrix(y_true_arr, y_pred_arr)
        n_classes = len(np.unique(y_true_arr))
        if has_proba:
            y_prob_arr = np.array(all_val_prob)
            try:
                if n_classes == 2:
                    auc = round(float(roc_auc_score(y_true_arr, y_prob_arr[:, 1])), 4)
                    threshold_analysis = _compute_threshold_analysis(y_true_arr, y_prob_arr[:, 1])
                    roc_curve_data = _compute_roc_curve(y_true_arr, y_prob_arr[:, 1])
                    pr_curve_data = _compute_pr_curve(y_true_arr, y_prob_arr[:, 1])
                else:
                    auc = round(float(roc_auc_score(y_true_arr, y_prob_arr,
                                                     multi_class="ovr", average="weighted")), 4)
            except Exception:
                auc = 0.0
    else:
        rmse = round(float(np.sqrt(mean_squared_error(y_true_arr, y_pred_arr))), 4)

    # Fit final model on ALL data for feature importance + complexity + inference latency
    final_model = clone(model)
    final_model.fit(X, y)
    feature_importances = _compute_feature_importance(final_model, feature_cols)
    complexity = _compute_model_complexity(final_model, X[:200])
    learning_curve = _compute_learning_curve(model, X, y, is_classifier)

    return {
        "cv_score": round(cv_score, 4),
        "cv_std": round(cv_std, 4),
        "cv_min": round(float(np.min(fold_cv_scores)), 4),
        "cv_max": round(float(np.max(fold_cv_scores)), 4),
        "train_score": round(train_score, 4),
        "val_score": round(cv_score, 4),
        "f1": f1_val,
        "auc_roc": auc,
        "rmse": rmse,
        "fold_scores": fold_scores_out,
        "per_class_metrics": per_class_metrics,
        "threshold_analysis": threshold_analysis,
        "confusion_matrix_data": confusion_matrix_data,
        "roc_curve_data": roc_curve_data,
        "pr_curve_data": pr_curve_data,
        "feature_importances": feature_importances,
        "complexity": complexity,
        "learning_curve": learning_curve,
    }


# ─── entry point ─────────────────────────────────────────────────────────────

def run_training(
    dataset_id: str,
    df: pd.DataFrame,
    target_column: str,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
) -> dict:
    strategy = (sampling_config or {}).get("config", {}).get("strategy", "none")
    is_classifier = task_type in ("classification", "anomaly_detection")

    if selection_plan and selection_plan.get("importances"):
        feature_cols = _get_selected_features(selection_plan)
    else:
        feature_cols = [c for c in df.columns if c != target_column]

    feature_cols = [f for f in feature_cols if f in df.columns and f != target_column]
    if not feature_cols:
        raise ValueError("No features available after selection")

    X, y = _preprocess(df, feature_cols, target_column)
    leakage_warnings = _detect_leakage(X, y, feature_cols)

    models_cfg = _build_models(task_type, strategy)
    n_splits = 5
    cv_splitter = (
        StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        if is_classifier
        else KFold(n_splits=n_splits, shuffle=True, random_state=42)
    )

    candidates: list[dict] = []
    for cfg in models_cfg:
        model = cfg["model"]
        t0 = time.time()
        try:
            diag = _train_model_cv(model, X, y, cv_splitter, is_classifier, feature_cols)
            result: dict[str, Any] = {
                "id": cfg["id"],
                "model_name": cfg["model_name"],
                "library": cfg["library"],
                "status": "done",
                "progress": 100,
                "hyperparams": _extract_params(model),
                "n_features": len(feature_cols),
                **diag,
            }
        except Exception as exc:
            result = {
                "id": cfg["id"],
                "model_name": cfg["model_name"],
                "library": cfg["library"],
                "status": "failed",
                "progress": 0,
                "error": str(exc),
                "cv_score": 0.0, "cv_std": 0.0, "cv_min": 0.0, "cv_max": 0.0,
                "train_score": 0.0, "val_score": 0.0, "f1": 0.0, "auc_roc": 0.0,
                "rmse": None, "fold_scores": [], "per_class_metrics": [],
                "threshold_analysis": [], "confusion_matrix_data": {},
                "roc_curve_data": [], "pr_curve_data": [],
                "feature_importances": [], "complexity": {}, "learning_curve": [],
                "hyperparams": {}, "n_features": len(feature_cols),
            }

        result["train_time_s"] = round(time.time() - t0, 2)
        sw = _generate_sw(result, is_classifier)
        result.update(sw)
        candidates.append(result)

    candidates.sort(key=lambda c: c["cv_score"], reverse=True)

    return {
        "dataset_id": dataset_id,
        "task_type": task_type,
        "target_column": target_column,
        "n_features": len(feature_cols),
        "features_used": feature_cols,
        "sampling_strategy": strategy,
        "leakage_warnings": leakage_warnings,
        "candidates": candidates,
        "best_model": candidates[0]["model_name"] if candidates else None,
        "best_cv_score": candidates[0]["cv_score"] if candidates else 0.0,
    }
