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




# ─── time-series / forecasting helpers ───────────────────────────────────────

def _detect_date_column(df: pd.DataFrame, exclude: str | None = None) -> str | None:
    """Return the first column that looks like a date/datetime."""
    # 1. dtype-based detection
    for col in df.columns:
        if col == exclude:
            continue
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            return col
    # 2. Try parsing object columns
    for col in df.columns:
        if col == exclude:
            continue
        if df[col].dtype != "object":
            continue
        sample = df[col].dropna().head(200).astype(str)
        try:
            parsed = pd.to_datetime(sample, infer_datetime_format=True, errors="coerce")
            if parsed.notna().mean() > 0.7:
                return col
        except Exception:
            continue
    return None


def _make_lag_features(series: pd.Series, lags: list[int]) -> pd.DataFrame:
    """Create lag columns from a time series."""
    data = {"y": series.values}
    for lag in lags:
        data[f"lag_{lag}"] = series.shift(lag).values
    df_lags = pd.DataFrame(data).dropna()
    return df_lags


def _smape(actual: np.ndarray, predicted: np.ndarray) -> float:
    denom = (np.abs(actual) + np.abs(predicted)) / 2.0
    mask = denom > 0
    return float(np.mean(np.abs(actual[mask] - predicted[mask]) / denom[mask])) * 100.0


def _mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    mask = actual != 0
    if not mask.any():
        return 0.0
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask]))) * 100.0


def _run_forecasting(
    dataset_id: str,
    df: pd.DataFrame,
    target_column: str,
    date_col: str | None,
    n_splits: int = 5,
    n_lags: int = 12,
    n_forecast: int = 12,
) -> dict:
    """Walk-forward forecasting: Naive, Exp Smoothing, Ridge+lags, GBM+lags."""
    from sklearn.linear_model import Ridge
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import mean_squared_error, mean_absolute_error
    from sklearn.model_selection import TimeSeriesSplit
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    # ── Sort by date / index ──────────────────────────────────────────────────
    if date_col and date_col in df.columns:
        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df = df.sort_values(date_col).reset_index(drop=True)
    else:
        df = df.copy().reset_index(drop=True)

    y_series = pd.to_numeric(df[target_column], errors="coerce").fillna(method="ffill").fillna(0)
    y_all = y_series.values.astype(float)
    n = len(y_all)

    if n < 20:
        raise ValueError(f"Forecasting requires at least 20 rows, got {n}.")

    n_splits_actual = min(n_splits, max(2, n // 10))
    tscv = TimeSeriesSplit(n_splits=n_splits_actual)

    # ── Lag feature matrix ────────────────────────────────────────────────────
    lags = list(range(1, min(n_lags + 1, n // 4 + 1)))
    lag_df = _make_lag_features(y_series, lags)
    lag_offset = max(lags)  # rows lost due to lagging
    X_lag = lag_df[[c for c in lag_df.columns if c != "y"]].values
    y_lag = lag_df["y"].values
    n_lag = len(y_lag)

    # ── Candidate definitions ─────────────────────────────────────────────────
    candidates_cfg = [
        {
            "id": str(uuid.uuid4()),
            "model_name": "Naive (Last Value)",
            "kind": "naive",
        },
        {
            "id": str(uuid.uuid4()),
            "model_name": "Exponential Smoothing (Holt-Winters)",
            "kind": "ets",
        },
        {
            "id": str(uuid.uuid4()),
            "model_name": "Ridge Regression (Lag Features)",
            "kind": "ridge",
        },
        {
            "id": str(uuid.uuid4()),
            "model_name": "Gradient Boosting (Lag Features)",
            "kind": "gbm",
        },
    ]

    results = []

    for cfg in candidates_cfg:
        t0 = time.time()
        kind = cfg["kind"]
        rmse_folds, mae_folds, mape_folds = [], [], []

        try:
            if kind in ("ridge", "gbm"):
                for train_idx, test_idx in tscv.split(X_lag):
                    X_tr, X_te = X_lag[train_idx], X_lag[test_idx]
                    y_tr, y_te = y_lag[train_idx], y_lag[test_idx]
                    if kind == "ridge":
                        scaler = StandardScaler()
                        X_tr_s = scaler.fit_transform(X_tr)
                        X_te_s = scaler.transform(X_te)
                        m = Ridge(alpha=1.0)
                        m.fit(X_tr_s, y_tr)
                        y_pred = m.predict(X_te_s)
                    else:
                        m = GradientBoostingRegressor(n_estimators=100, max_depth=3,
                                                      learning_rate=0.1, random_state=42)
                        m.fit(X_tr, y_tr)
                        y_pred = m.predict(X_te)
                    rmse_folds.append(float(np.sqrt(mean_squared_error(y_te, y_pred))))
                    mae_folds.append(float(mean_absolute_error(y_te, y_pred)))
                    mape_folds.append(_mape(y_te, y_pred))

                # Final model for forecast
                if kind == "ridge":
                    scaler = StandardScaler()
                    X_s = scaler.fit_transform(X_lag)
                    final_m = Ridge(alpha=1.0).fit(X_s, y_lag)
                else:
                    final_m = GradientBoostingRegressor(n_estimators=100, max_depth=3,
                                                        learning_rate=0.1, random_state=42)
                    final_m.fit(X_lag, y_lag)

                # Recursive multi-step forecast
                hist = list(y_all[-max(lags):])
                forecast_vals = []
                for _ in range(n_forecast):
                    x_in = np.array([[hist[-lag] for lag in lags]])
                    if kind == "ridge":
                        x_in_s = scaler.transform(x_in)
                        nxt = float(final_m.predict(x_in_s)[0])
                    else:
                        nxt = float(final_m.predict(x_in)[0])
                    forecast_vals.append(nxt)
                    hist.append(nxt)

            elif kind == "naive":
                for train_idx, test_idx in tscv.split(y_all):
                    y_tr, y_te = y_all[train_idx], y_all[test_idx]
                    y_pred = np.full_like(y_te, y_tr[-1], dtype=float)
                    rmse_folds.append(float(np.sqrt(mean_squared_error(y_te, y_pred))))
                    mae_folds.append(float(mean_absolute_error(y_te, y_pred)))
                    mape_folds.append(_mape(y_te, y_pred))
                last_val = float(y_all[-1])
                forecast_vals = [last_val] * n_forecast

            elif kind == "ets":
                for train_idx, test_idx in tscv.split(y_all):
                    y_tr, y_te = y_all[train_idx], y_all[test_idx]
                    try:
                        with warnings.catch_warnings():
                            warnings.simplefilter("ignore")
                            m = ExponentialSmoothing(
                                y_tr,
                                trend="add",
                                seasonal=None,
                                initialization_method="estimated",
                            ).fit(optimized=True, disp=False)
                        y_pred = m.forecast(len(y_te))
                    except Exception:
                        # Fallback to simple exponential smoothing
                        alpha = 0.3
                        pred = y_tr[-1]
                        y_pred = []
                        for _ in range(len(y_te)):
                            y_pred.append(pred)
                        y_pred = np.array(y_pred, dtype=float)
                    rmse_folds.append(float(np.sqrt(mean_squared_error(y_te, y_pred))))
                    mae_folds.append(float(mean_absolute_error(y_te, y_pred)))
                    mape_folds.append(_mape(y_te, y_pred))
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        final_m = ExponentialSmoothing(
                            y_all, trend="add", seasonal=None,
                            initialization_method="estimated",
                        ).fit(optimized=True, disp=False)
                    forecast_vals = list(final_m.forecast(n_forecast).astype(float))
                except Exception:
                    forecast_vals = [float(y_all[-1])] * n_forecast

            rmse_mean = round(float(np.mean(rmse_folds)), 4)
            mae_mean = round(float(np.mean(mae_folds)), 4)
            mape_mean = round(float(np.mean(mape_folds)), 2)
            smape_all_idx = list(tscv.split(y_all))[-1][1]
            y_last_test = y_all[smape_all_idx]
            forecast_check = forecast_vals[:len(y_last_test)] if len(forecast_vals) >= len(y_last_test) else forecast_vals
            smape_val = _smape(y_last_test[:len(forecast_check)], np.array(forecast_check))

            # Build forecast timeline
            if date_col and date_col in df.columns:
                last_date = pd.to_datetime(df[date_col].dropna().iloc[-1])
                freq_delta = None
                if len(df) > 1:
                    dts = pd.to_datetime(df[date_col].dropna())
                    freq_delta = (dts.iloc[-1] - dts.iloc[0]) / max(len(dts) - 1, 1)
                forecast_dates = []
                for i in range(1, n_forecast + 1):
                    if freq_delta:
                        forecast_dates.append(str((last_date + freq_delta * i).date()))
                    else:
                        forecast_dates.append(f"T+{i}")
            else:
                forecast_dates = [f"T+{i}" for i in range(1, n_forecast + 1)]

            forecast_series = [
                {"period": fd, "value": round(fv, 6)}
                for fd, fv in zip(forecast_dates, forecast_vals)
            ]

            results.append({
                "id": cfg["id"],
                "model_name": cfg["model_name"],
                "library": "statsmodels" if kind == "ets" else "sklearn",
                "status": "done",
                "progress": 100,
                "cv_score": round(-rmse_mean, 4),  # neg so higher = better for sorting
                "cv_std": round(float(np.std(rmse_folds)), 4),
                "cv_min": round(float(np.min(rmse_folds)), 4),
                "cv_max": round(float(np.max(rmse_folds)), 4),
                "train_score": round(-rmse_mean, 4),
                "val_score": round(-rmse_mean, 4),
                "f1": 0.0,
                "auc_roc": 0.0,
                "rmse": rmse_mean,
                "mae": mae_mean,
                "mape": mape_mean,
                "smape": round(smape_val, 2),
                "fold_scores": [round(-r, 4) for r in rmse_folds],
                "forecast": forecast_series,
                "n_lags": len(lags) if kind in ("ridge", "gbm") else 0,
                "hyperparams": {"n_lags": len(lags), "n_splits": n_splits_actual},
                "n_features": len(lags) if kind in ("ridge", "gbm") else 1,
                "feature_importances": [],
                "per_class_metrics": [],
                "confusion_matrix_data": {},
                "threshold_analysis": [],
                "roc_curve_data": [],
                "pr_curve_data": [],
                "complexity": {},
                "learning_curve": [],
                "train_time_s": round(time.time() - t0, 2),
                "strengths": [f"RMSE={rmse_mean:.4f}", f"MAE={mae_mean:.4f}", f"MAPE={mape_mean:.1f}%"],
                "weaknesses": [],
            })

        except Exception as exc:
            results.append({
                "id": cfg["id"],
                "model_name": cfg["model_name"],
                "library": "statsmodels" if kind == "ets" else "sklearn",
                "status": "failed",
                "error": str(exc),
                "cv_score": -9999.0, "cv_std": 0.0, "cv_min": 0.0, "cv_max": 0.0,
                "train_score": -9999.0, "val_score": -9999.0,
                "f1": 0.0, "auc_roc": 0.0, "rmse": None, "mae": None,
                "mape": None, "smape": None, "fold_scores": [],
                "forecast": [], "n_lags": 0,
                "hyperparams": {}, "n_features": 0,
                "feature_importances": [], "per_class_metrics": [],
                "confusion_matrix_data": {}, "threshold_analysis": [],
                "roc_curve_data": [], "pr_curve_data": [],
                "complexity": {}, "learning_curve": [],
                "train_time_s": round(time.time() - t0, 2),
                "strengths": [], "weaknesses": [],
            })

    # Sort ascending by RMSE (lowest = best); failed models last
    results.sort(
        key=lambda r: r["rmse"] if r["rmse"] is not None else float("inf")
    )

    best = results[0] if results else {}

    # Historical series for charting
    historical = [
        {"period": str(df[date_col].iloc[i].date()) if date_col and date_col in df.columns else str(i),
         "value": round(float(y_all[i]), 6)}
        for i in range(n)
    ] if n <= 2000 else []

    return {
        "dataset_id": dataset_id,
        "task_type": "forecasting",
        "target_column": target_column,
        "date_column": date_col,
        "n_features": len(lags),
        "features_used": [target_column],
        "sampling_strategy": "none",
        "leakage_warnings": [],
        "candidates": results,
        "best_model": best.get("model_name"),
        "best_cv_score": best.get("rmse"),
        "n_lags": len(lags),
        "n_forecast": n_forecast,
        "historical": historical,
        "forecast_horizon": n_forecast,
    }



def _detect_text_columns(df: pd.DataFrame, exclude: str | None = None,
                          min_avg_words: float = 3.0) -> list[str]:
    """Return columns that look like free text (high avg word count, object dtype)."""
    text_cols = []
    for col in df.columns:
        if col == exclude:
            continue
        if df[col].dtype != "object":
            continue
        sample = df[col].dropna().astype(str).head(500)
        if len(sample) == 0:
            continue
        avg_words = sample.apply(lambda x: len(x.split())).mean()
        if avg_words >= min_avg_words:
            text_cols.append(col)
    return text_cols


def _run_nlp_classification(
    dataset_id: str,
    df: pd.DataFrame,
    text_col: str,
    target_column: str,
    max_features: int = 10_000,
    ngram_range: tuple = (1, 2),
) -> dict:
    """TF-IDF + Naive Bayes / LinearSVC / Logistic Regression text classifier."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.naive_bayes import MultinomialNB
    from sklearn.svm import LinearSVC
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.preprocessing import LabelEncoder
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.metrics import (
        f1_score as f1_metric, accuracy_score, classification_report,
        confusion_matrix,
    )
    import scipy.sparse as sp

    # ── Prepare text + labels ────────────────────────────────────────────────
    texts = df[text_col].fillna("").astype(str).tolist()
    raw_labels = df[target_column].astype(str).tolist()

    le = LabelEncoder()
    y = le.fit_transform(raw_labels)
    classes = le.classes_.tolist()
    n_classes = len(classes)

    # ── TF-IDF vectorization ─────────────────────────────────────────────────
    # Use sublinear TF to reduce impact of very frequent terms
    tfidf = TfidfVectorizer(
        max_features=max_features,
        ngram_range=ngram_range,
        sublinear_tf=True,
        strip_accents="unicode",
        analyzer="word",
        min_df=2,
    )
    X = tfidf.fit_transform(texts)
    vocab_size = X.shape[1]

    # Top terms by TF-IDF weight (global)
    feature_names = tfidf.get_feature_names_out()
    mean_tfidf = np.asarray(X.mean(axis=0)).ravel()
    top_idx = np.argsort(mean_tfidf)[::-1][:20]
    top_terms = [{"term": feature_names[i], "score": round(float(mean_tfidf[i]), 5)}
                 for i in top_idx]

    # ── CV ───────────────────────────────────────────────────────────────────
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    is_binary = n_classes == 2

    models_cfg = [
        {
            "id": str(uuid.uuid4()),
            "model_name": "Naive Bayes (TF-IDF)",
            "model": MultinomialNB(alpha=0.1),
        },
        {
            "id": str(uuid.uuid4()),
            "model_name": "Linear SVM (TF-IDF)",
            # Wrap in CalibratedClassifierCV so predict_proba is available
            "model": CalibratedClassifierCV(LinearSVC(C=1.0, max_iter=2000), cv=3),
        },
        {
            "id": str(uuid.uuid4()),
            "model_name": "Logistic Regression (TF-IDF)",
            "model": LogisticRegression(C=1.0, max_iter=1000, solver="lbfgs",
                                        multi_class="auto", n_jobs=-1),
        },
    ]

    candidates = []
    for cfg in models_cfg:
        t0 = time.time()
        model = cfg["model"]
        try:
            # cross_val_predict on sparse X
            y_pred = cross_val_predict(model, X, y, cv=cv, method="predict")
            acc = round(float(accuracy_score(y, y_pred)), 4)
            f1 = round(float(f1_metric(y, y_pred, average="weighted", zero_division=0)), 4)

            # Per-class metrics
            report = classification_report(y, y_pred, target_names=classes,
                                           output_dict=True, zero_division=0)
            per_class = [
                {
                    "class": cls,
                    "precision": round(float(report[cls]["precision"]), 4),
                    "recall": round(float(report[cls]["recall"]), 4),
                    "f1": round(float(report[cls]["f1-score"]), 4),
                    "support": int(report[cls]["support"]),
                }
                for cls in classes if cls in report
            ]

            # Confusion matrix
            cm_labels = list(range(n_classes))
            cm = confusion_matrix(y, y_pred, labels=cm_labels)
            cm_data = {
                "labels": classes,
                "values": cm.tolist(),
            }

            # Fit final model for complexity
            final = clone(model)
            final.fit(X, y)

            result = {
                "id": cfg["id"],
                "model_name": cfg["model_name"],
                "library": "sklearn",
                "status": "done",
                "progress": 100,
                "cv_score": acc,
                "cv_std": 0.0,
                "cv_min": acc,
                "cv_max": acc,
                "train_score": acc,
                "val_score": acc,
                "f1": f1,
                "auc_roc": 0.0,
                "rmse": None,
                "fold_scores": [],
                "per_class_metrics": per_class,
                "confusion_matrix_data": cm_data,
                "threshold_analysis": [],
                "roc_curve_data": [],
                "pr_curve_data": [],
                "vocab_size": vocab_size,
                "top_terms": top_terms,
                "n_classes": n_classes,
                "text_column": text_col,
                "hyperparams": {"max_features": max_features, "ngram_range": list(ngram_range)},
                "n_features": vocab_size,
                "feature_importances": [],
                "complexity": {},
                "learning_curve": [],
                "train_time_s": round(time.time() - t0, 2),
                "strengths": [f"Weighted F1 = {f1:.3f}", f"Vocab size = {vocab_size:,}"],
                "weaknesses": [],
            }
        except Exception as exc:
            result = {
                "id": cfg["id"],
                "model_name": cfg["model_name"],
                "library": "sklearn",
                "status": "failed",
                "error": str(exc),
                "cv_score": 0.0, "cv_std": 0.0, "cv_min": 0.0, "cv_max": 0.0,
                "train_score": 0.0, "val_score": 0.0, "f1": 0.0, "auc_roc": 0.0,
                "rmse": None, "fold_scores": [], "per_class_metrics": [],
                "confusion_matrix_data": {}, "threshold_analysis": [],
                "roc_curve_data": [], "pr_curve_data": [],
                "vocab_size": 0, "top_terms": [], "n_classes": n_classes,
                "text_column": text_col,
                "hyperparams": {}, "n_features": 0,
                "feature_importances": [], "complexity": {}, "learning_curve": [],
                "train_time_s": round(time.time() - t0, 2),
                "strengths": [], "weaknesses": [],
            }
        candidates.append(result)

    candidates.sort(key=lambda c: c["cv_score"], reverse=True)

    return {
        "dataset_id": dataset_id,
        "task_type": "text_classification",
        "target_column": target_column,
        "text_column": text_col,
        "n_features": vocab_size,
        "vocab_size": vocab_size,
        "top_terms": top_terms,
        "n_classes": n_classes,
        "classes": classes,
        "features_used": [text_col],
        "sampling_strategy": "none",
        "leakage_warnings": [],
        "candidates": candidates,
        "best_model": candidates[0]["model_name"] if candidates else None,
        "best_cv_score": candidates[0].get("f1", 0.0) if candidates else 0.0,
    }




def _run_anomaly_detection(
    dataset_id: str,
    df: pd.DataFrame,
    feature_cols: list[str],
    contamination: float,
    ground_truth_col: str | None,
) -> dict:
    """Train IsolationForest + LOF ensemble for anomaly detection."""
    from sklearn.ensemble import IsolationForest
    from sklearn.neighbors import LocalOutlierFactor
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import precision_score, recall_score, f1_score as f1_metric
    import uuid

    X_raw = df[feature_cols].copy()
    for col in X_raw.columns:
        if X_raw[col].dtype == "object" or str(X_raw[col].dtype) == "category":
            X_raw[col] = X_raw[col].fillna("__missing__")
            from sklearn.preprocessing import LabelEncoder
            le = LabelEncoder()
            X_raw[col] = le.fit_transform(X_raw[col].astype(str))
        else:
            median = pd.to_numeric(X_raw[col], errors="coerce").median()
            X_raw[col] = pd.to_numeric(X_raw[col], errors="coerce").fillna(median)
    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw.values)

    candidates = []
    models_cfg = [
        {"id": str(uuid.uuid4()), "model_name": "Isolation Forest",
         "model": IsolationForest(contamination=contamination, random_state=42, n_jobs=-1)},
        {"id": str(uuid.uuid4()), "model_name": "Local Outlier Factor",
         "model": LocalOutlierFactor(contamination=contamination, n_jobs=-1, novelty=False)},
    ]

    for cfg in models_cfg:
        t0 = time.time()
        model = cfg["model"]
        try:
            raw_labels = model.fit_predict(X)
            is_anomaly = (raw_labels == -1).astype(int)

            if hasattr(model, "decision_function"):
                scores = -model.decision_function(X)
            elif hasattr(model, "negative_outlier_factor_"):
                scores = -model.negative_outlier_factor_
            else:
                scores = is_anomaly.astype(float)

            n_anomalies = int(is_anomaly.sum())
            detected_contamination = round(float(n_anomalies / len(is_anomaly)), 4)

            sup_metrics: dict = {}
            if ground_truth_col and ground_truth_col in df.columns:
                try:
                    y_gt = (pd.to_numeric(df[ground_truth_col], errors="coerce").fillna(0) != 0).astype(int).values
                    sup_metrics["precision"] = round(float(precision_score(y_gt, is_anomaly, zero_division=0)), 4)
                    sup_metrics["recall"] = round(float(recall_score(y_gt, is_anomaly, zero_division=0)), 4)
                    sup_metrics["f1"] = round(float(f1_metric(y_gt, is_anomaly, zero_division=0)), 4)
                except Exception:
                    pass

            score_pct = {
                "p50": round(float(np.percentile(scores, 50)), 4),
                "p90": round(float(np.percentile(scores, 90)), 4),
                "p95": round(float(np.percentile(scores, 95)), 4),
                "p99": round(float(np.percentile(scores, 99)), 4),
            }

            result = {
                "id": cfg["id"],
                "model_name": cfg["model_name"],
                "library": "sklearn",
                "status": "done",
                "progress": 100,
                "n_anomalies": n_anomalies,
                "detected_contamination": detected_contamination,
                "configured_contamination": contamination,
                "anomaly_score_percentiles": score_pct,
                "cv_score": detected_contamination,
                "cv_std": 0.0,
                "train_score": detected_contamination,
                "f1": sup_metrics.get("f1", 0.0),
                "auc_roc": 0.0,
                "rmse": None,
                **sup_metrics,
                "hyperparams": {"contamination": contamination},
                "n_features": len(feature_cols),
                "train_time_s": round(time.time() - t0, 2),
                "strengths": [f"Detected {n_anomalies} anomalies ({detected_contamination:.1%} of data)"],
                "weaknesses": [],
            }
        except Exception as exc:
            result = {
                "id": cfg["id"],
                "model_name": cfg["model_name"],
                "library": "sklearn",
                "status": "failed",
                "error": str(exc),
                "cv_score": 0.0, "cv_std": 0.0, "train_score": 0.0,
                "f1": 0.0, "auc_roc": 0.0, "rmse": None,
                "n_anomalies": 0, "detected_contamination": 0.0,
                "hyperparams": {}, "n_features": len(feature_cols),
                "train_time_s": round(time.time() - t0, 2),
                "strengths": [], "weaknesses": [],
            }
        candidates.append(result)

    candidates.sort(key=lambda c: abs(c.get("detected_contamination", 0) - contamination))

    return {
        "dataset_id": dataset_id,
        "task_type": "anomaly_detection",
        "target_column": ground_truth_col,
        "n_features": len(feature_cols),
        "features_used": feature_cols,
        "sampling_strategy": "none",
        "leakage_warnings": [],
        "candidates": candidates,
        "best_model": candidates[0]["model_name"] if candidates else None,
        "best_cv_score": candidates[0].get("detected_contamination", 0.0) if candidates else 0.0,
        "contamination": contamination,
    }


def _run_clustering(
    dataset_id: str,
    df: pd.DataFrame,
    feature_cols: list[str],
    n_clusters: int = 8,
) -> dict:
    """Train KMeans + DBSCAN clustering and score with silhouette."""
    from sklearn.cluster import KMeans, DBSCAN
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import StandardScaler
    import uuid

    X_raw = df[feature_cols].copy()
    for col in X_raw.columns:
        if X_raw[col].dtype == "object" or str(X_raw[col].dtype) == "category":
            X_raw[col] = X_raw[col].fillna("__missing__")
            from sklearn.preprocessing import LabelEncoder
            le = LabelEncoder()
            X_raw[col] = le.fit_transform(X_raw[col].astype(str))
        else:
            median = pd.to_numeric(X_raw[col], errors="coerce").median()
            X_raw[col] = pd.to_numeric(X_raw[col], errors="coerce").fillna(median)
    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw.values)

    sample_size = min(5000, len(X))
    rng = np.random.default_rng(42)
    sample_idx = rng.choice(len(X), sample_size, replace=False)
    X_sample = X[sample_idx]

    candidates = []

    best_k, best_sil, best_km_labels = 2, -1.0, None
    max_k = min(n_clusters, int(np.sqrt(len(X))), 15)
    max_k = max(max_k, 2)
    km_model_id = str(uuid.uuid4())
    t0 = time.time()
    try:
        for k in range(2, max_k + 1):
            km = KMeans(n_clusters=k, random_state=42, n_init=5)
            labels = km.fit_predict(X)
            labels_sample = labels[sample_idx]
            if len(np.unique(labels_sample)) < 2:
                continue
            sil = float(silhouette_score(X_sample, labels_sample))
            if sil > best_sil:
                best_sil = sil
                best_k = k
                best_km_labels = labels

        best_km = KMeans(n_clusters=best_k, random_state=42, n_init=10)
        best_km.fit(X)
        inertia = round(float(best_km.inertia_), 2)

        candidates.append({
            "id": km_model_id,
            "model_name": "KMeans",
            "library": "sklearn",
            "status": "done",
            "progress": 100,
            "n_clusters": best_k,
            "silhouette_score": round(best_sil, 4),
            "inertia": inertia,
            "cv_score": round(max(best_sil, 0.0), 4),
            "cv_std": 0.0,
            "train_score": round(max(best_sil, 0.0), 4),
            "f1": 0.0,
            "auc_roc": 0.0,
            "rmse": None,
            "hyperparams": {"n_clusters": best_k},
            "n_features": len(feature_cols),
            "train_time_s": round(time.time() - t0, 2),
            "strengths": [
                f"Found {best_k} clusters (silhouette={best_sil:.3f})",
                "Deterministic, fast inference for new data",
            ],
            "weaknesses": ["Assumes spherical clusters", "Sensitive to outliers"],
        })
    except Exception as exc:
        candidates.append({
            "id": km_model_id, "model_name": "KMeans", "library": "sklearn",
            "status": "failed", "error": str(exc),
            "cv_score": 0.0, "cv_std": 0.0, "train_score": 0.0,
            "f1": 0.0, "auc_roc": 0.0, "rmse": None,
            "n_clusters": 0, "silhouette_score": 0.0, "inertia": 0.0,
            "hyperparams": {}, "n_features": len(feature_cols),
            "train_time_s": round(time.time() - t0, 2),
            "strengths": [], "weaknesses": [],
        })

    dbscan_id = str(uuid.uuid4())
    t0 = time.time()
    try:
        from sklearn.neighbors import NearestNeighbors
        k_nn = 5
        nn = NearestNeighbors(n_neighbors=k_nn, n_jobs=-1)
        nn.fit(X_sample)
        distances, _ = nn.kneighbors(X_sample)
        k_distances = np.sort(distances[:, -1])
        diffs = np.diff(k_distances)
        eps = round(float(k_distances[int(np.argmax(diffs))]), 4)
        eps = max(eps, 0.1)

        db = DBSCAN(eps=eps, min_samples=5, n_jobs=-1)
        db_labels = db.fit_predict(X)
        n_found = int(len(set(db_labels)) - (1 if -1 in db_labels else 0))
        n_noise = int(np.sum(db_labels == -1))

        db_sil = 0.0
        if n_found >= 2:
            mask = db_labels[sample_idx] != -1
            if mask.sum() >= 2 and len(np.unique(db_labels[sample_idx][mask])) >= 2:
                db_sil = round(float(silhouette_score(X_sample[mask], db_labels[sample_idx][mask])), 4)

        candidates.append({
            "id": dbscan_id,
            "model_name": "DBSCAN",
            "library": "sklearn",
            "status": "done",
            "progress": 100,
            "n_clusters": n_found,
            "n_noise_points": n_noise,
            "silhouette_score": db_sil,
            "inertia": None,
            "eps_auto": eps,
            "cv_score": round(max(db_sil, 0.0), 4),
            "cv_std": 0.0,
            "train_score": round(max(db_sil, 0.0), 4),
            "f1": 0.0,
            "auc_roc": 0.0,
            "rmse": None,
            "hyperparams": {"eps": eps, "min_samples": 5},
            "n_features": len(feature_cols),
            "train_time_s": round(time.time() - t0, 2),
            "strengths": [
                f"Detected {n_found} clusters + {n_noise} noise points",
                "Finds arbitrary cluster shapes",
                "Automatically identifies outliers",
            ],
            "weaknesses": ["Sensitive to eps parameter", "Struggles with varying density"],
        })
    except Exception as exc:
        candidates.append({
            "id": dbscan_id, "model_name": "DBSCAN", "library": "sklearn",
            "status": "failed", "error": str(exc),
            "cv_score": 0.0, "cv_std": 0.0, "train_score": 0.0,
            "f1": 0.0, "auc_roc": 0.0, "rmse": None,
            "n_clusters": 0, "silhouette_score": 0.0, "inertia": None,
            "hyperparams": {}, "n_features": len(feature_cols),
            "train_time_s": round(time.time() - t0, 2),
            "strengths": [], "weaknesses": [],
        })

    candidates.sort(key=lambda c: c["cv_score"], reverse=True)

    return {
        "dataset_id": dataset_id,
        "task_type": "clustering",
        "target_column": None,
        "n_features": len(feature_cols),
        "features_used": feature_cols,
        "sampling_strategy": "none",
        "leakage_warnings": [],
        "candidates": candidates,
        "best_model": candidates[0]["model_name"] if candidates else None,
        "best_cv_score": candidates[0].get("silhouette_score", 0.0) if candidates else 0.0,
    }


# ─── entry point ─────────────────────────────────────────────────────────────

def run_training(
    dataset_id: str,
    df: pd.DataFrame,
    target_column: str | None,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
) -> dict:
    # Dispatch unsupervised tasks first
    if task_type == "clustering":
        feature_cols = [c for c in df.columns if c != (target_column or "__none__")]
        if selection_plan and selection_plan.get("importances"):
            fc = _get_selected_features(selection_plan)
            feature_cols = [f for f in fc if f in df.columns]
        n_clusters = (sampling_config or {}).get("config", {}).get("n_clusters", 8)
        return _run_clustering(dataset_id, df, feature_cols, n_clusters=n_clusters)

    if task_type == "anomaly_detection":
        feature_cols = [c for c in df.columns if c != (target_column or "__none__")]
        if selection_plan and selection_plan.get("importances"):
            fc = _get_selected_features(selection_plan)
            feature_cols = [f for f in fc if f in df.columns]
        contamination = (sampling_config or {}).get("config", {}).get("contamination", 0.05)
        contamination = min(max(float(contamination), 0.01), 0.49)
        return _run_anomaly_detection(dataset_id, df, feature_cols, contamination, target_column)

    if task_type == "forecasting":
        if not target_column:
            raise ValueError("target_column is required for forecasting")
        date_col = (sampling_config or {}).get("config", {}).get("date_column") or \
                   _detect_date_column(df, exclude=target_column)
        n_forecast = int((sampling_config or {}).get("config", {}).get("n_forecast", 12))
        n_lags = int((sampling_config or {}).get("config", {}).get("n_lags", 12))
        return _run_forecasting(dataset_id, df, target_column, date_col,
                                n_forecast=n_forecast, n_lags=n_lags)

    if task_type == "text_classification":
        if not target_column:
            raise ValueError("target_column is required for text_classification")
        # Auto-detect best text column (highest avg word count, excluding target)
        text_cols = _detect_text_columns(df, exclude=target_column)
        if not text_cols:
            # Fallback: use the first object column that isn't the target
            text_cols = [c for c in df.columns if df[c].dtype == "object" and c != target_column]
        if not text_cols:
            raise ValueError(
                "No text column found. text_classification requires at least one string column."
            )
        text_col = text_cols[0]
        max_features = (sampling_config or {}).get("config", {}).get("max_tfidf_features", 10_000)
        return _run_nlp_classification(dataset_id, df, text_col, target_column,
                                       max_features=int(max_features))

    strategy = (sampling_config or {}).get("config", {}).get("strategy", "none")
    is_classifier = task_type in ("classification",)

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


# ─── fix-overfit remediation params ──────────────────────────────────────────

FIX_OVERFIT_PARAMS: dict[str, dict] = {
    "Random Forest": {
        "n_estimators": 200,
        "max_depth": 8,
        "min_samples_leaf": 10,
        "min_samples_split": 20,
        "max_features": "sqrt",
    },
    "XGBoost": {
        "n_estimators": 200,
        "max_depth": 4,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
    },
    "LightGBM": {
        "n_estimators": 200,
        "num_leaves": 31,
        "learning_rate": 0.05,
        "min_child_samples": 30,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "reg_alpha": 0.1,
        "reg_lambda": 0.1,
    },
    "Logistic Regression": {
        "C": 0.1,
        "max_iter": 1000,
        "solver": "lbfgs",
    },
}

HYPERPARAMETER_SEARCH_SPACES: dict[str, list[dict]] = {
    "Random Forest": [
        {"name": "n_estimators", "type": "int", "min": 50, "max": 500, "step": 50, "default": 200},
        {"name": "max_depth", "type": "int", "min": 2, "max": 20, "step": 1, "default": 8, "nullable": True},
        {"name": "min_samples_leaf", "type": "int", "min": 1, "max": 50, "step": 1, "default": 10},
        {"name": "min_samples_split", "type": "int", "min": 2, "max": 50, "step": 2, "default": 20},
        {"name": "max_features", "type": "choice", "choices": ["sqrt", "log2", "None"], "default": "sqrt"},
    ],
    "XGBoost": [
        {"name": "n_estimators", "type": "int", "min": 50, "max": 500, "step": 50, "default": 200},
        {"name": "max_depth", "type": "int", "min": 2, "max": 12, "step": 1, "default": 4},
        {"name": "learning_rate", "type": "float", "min": 0.01, "max": 0.3, "step": 0.01, "default": 0.05},
        {"name": "subsample", "type": "float", "min": 0.5, "max": 1.0, "step": 0.05, "default": 0.8},
        {"name": "colsample_bytree", "type": "float", "min": 0.5, "max": 1.0, "step": 0.05, "default": 0.8},
        {"name": "reg_alpha", "type": "float", "min": 0.0, "max": 2.0, "step": 0.05, "default": 0.1},
        {"name": "reg_lambda", "type": "float", "min": 0.0, "max": 2.0, "step": 0.05, "default": 1.0},
    ],
    "LightGBM": [
        {"name": "n_estimators", "type": "int", "min": 50, "max": 500, "step": 50, "default": 200},
        {"name": "num_leaves", "type": "int", "min": 10, "max": 127, "step": 5, "default": 31},
        {"name": "learning_rate", "type": "float", "min": 0.01, "max": 0.3, "step": 0.01, "default": 0.05},
        {"name": "min_child_samples", "type": "int", "min": 5, "max": 100, "step": 5, "default": 30},
        {"name": "subsample", "type": "float", "min": 0.5, "max": 1.0, "step": 0.05, "default": 0.8},
        {"name": "reg_alpha", "type": "float", "min": 0.0, "max": 2.0, "step": 0.1, "default": 0.1},
        {"name": "reg_lambda", "type": "float", "min": 0.0, "max": 2.0, "step": 0.1, "default": 0.1},
    ],
    "Logistic Regression": [
        {"name": "C", "type": "float", "min": 0.001, "max": 10.0, "step": 0.05, "default": 1.0},
        {"name": "max_iter", "type": "int", "min": 100, "max": 2000, "step": 100, "default": 1000},
    ],
    "Ridge Regression": [
        {"name": "alpha", "type": "float", "min": 0.001, "max": 10.0, "step": 0.1, "default": 1.0},
    ],
}


def get_hyperparameter_space(model_name: str) -> list[dict]:
    return HYPERPARAMETER_SEARCH_SPACES.get(model_name, [])


def get_fix_overfit_params(model_name: str) -> dict:
    return FIX_OVERFIT_PARAMS.get(model_name, {})


def _build_model_from_params(model_name: str, hyperparams: dict,
                               task_type: str, strategy: str):
    """Instantiate a model by name with given hyperparameters."""
    cw = "balanced" if strategy == "class_weights" else None
    is_clf = task_type in ("classification", "anomaly_detection")

    # Sanitise: remove None-valued keys; handle "None" string for max_features
    clean = {}
    for k, v in hyperparams.items():
        if v == "None":
            clean[k] = None
        elif v is not None:
            clean[k] = v

    if model_name == "Random Forest":
        cls = RandomForestClassifier if is_clf else RandomForestRegressor
        base = {"random_state": 42, "n_jobs": -1}
        if is_clf:
            base["class_weight"] = cw
        return cls(**{**base, **clean})

    if model_name == "XGBoost":
        try:
            import xgboost as xgb
            cls = xgb.XGBClassifier if is_clf else xgb.XGBRegressor
            base = {"random_state": 42, "n_jobs": -1, "verbosity": 0}
            if is_clf:
                base["eval_metric"] = "logloss"
            return cls(**{**base, **clean})
        except ImportError:
            from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
            return (GradientBoostingClassifier if is_clf else GradientBoostingRegressor)(n_estimators=100, random_state=42)

    if model_name == "LightGBM":
        try:
            import lightgbm as lgb
            cls = lgb.LGBMClassifier if is_clf else lgb.LGBMRegressor
            base = {"random_state": 42, "n_jobs": -1, "verbose": -1}
            if is_clf:
                base["class_weight"] = cw
            return cls(**{**base, **clean})
        except ImportError:
            from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
            return (GradientBoostingClassifier if is_clf else GradientBoostingRegressor)(n_estimators=100, random_state=42)

    if model_name == "Logistic Regression":
        return LogisticRegression(class_weight=cw, random_state=42, n_jobs=-1, **clean)

    if model_name == "Ridge Regression":
        return Ridge(**clean)

    raise ValueError(f"Unknown model: {model_name}")


def retrain_single_model(
    model_name: str,
    model_id: str,
    hyperparams: dict,
    df: pd.DataFrame,
    target_column: str,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
) -> dict:
    """Retrain one model with custom hyperparams and return updated candidate dict."""
    strategy = (sampling_config or {}).get("config", {}).get("strategy", "none")
    is_classifier = task_type in ("classification", "anomaly_detection")

    if selection_plan and selection_plan.get("importances"):
        feature_cols = _get_selected_features(selection_plan)
    else:
        feature_cols = [c for c in df.columns if c != target_column]
    feature_cols = [f for f in feature_cols if f in df.columns and f != target_column]

    X, y = _preprocess(df, feature_cols, target_column)
    model = _build_model_from_params(model_name, hyperparams, task_type, strategy)

    n_splits = 5
    cv_splitter = (
        StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        if is_classifier else KFold(n_splits=n_splits, shuffle=True, random_state=42)
    )

    t0 = time.time()
    diag = _train_model_cv(model, X, y, cv_splitter, is_classifier, feature_cols)
    result: dict[str, Any] = {
        "id": model_id,
        "model_name": model_name,
        "library": _model_library(model_name),
        "status": "done",
        "progress": 100,
        "hyperparams": _extract_params(model),
        "n_features": len(feature_cols),
        **diag,
    }
    result["train_time_s"] = round(time.time() - t0, 2)
    result.update(_generate_sw(result, is_classifier))
    return result


def autotune_model(
    model_name: str,
    model_id: str,
    df: pd.DataFrame,
    target_column: str,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
    n_trials: int = 30,
) -> dict:
    """Run Optuna HPO for one model, return best retrained candidate dict."""
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    except ImportError:
        raise ValueError("Optuna is not installed. Run: pip install optuna")

    strategy = (sampling_config or {}).get("config", {}).get("strategy", "none")
    is_classifier = task_type in ("classification", "anomaly_detection")

    if selection_plan and selection_plan.get("importances"):
        feature_cols = _get_selected_features(selection_plan)
    else:
        feature_cols = [c for c in df.columns if c != target_column]
    feature_cols = [f for f in feature_cols if f in df.columns and f != target_column]

    X, y = _preprocess(df, feature_cols, target_column)
    cv_splitter = (
        StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        if is_classifier else KFold(n_splits=5, shuffle=True, random_state=42)
    )
    space = HYPERPARAMETER_SEARCH_SPACES.get(model_name, [])

    def objective(trial: "optuna.Trial") -> float:
        params = {}
        for p in space:
            if p["type"] == "int":
                params[p["name"]] = trial.suggest_int(p["name"], p["min"], p["max"], step=p.get("step", 1))
            elif p["type"] == "float":
                params[p["name"]] = trial.suggest_float(p["name"], p["min"], p["max"], step=p.get("step"))
            elif p["type"] == "choice":
                params[p["name"]] = trial.suggest_categorical(p["name"], p["choices"])

        try:
            model = _build_model_from_params(model_name, params, task_type, strategy)
        except Exception:
            return 0.0

        scores = []
        for train_idx, val_idx in cv_splitter.split(X, y if is_classifier else None):
            m = clone(model)
            m.fit(X[train_idx], y[train_idx])
            y_pred = m.predict(X[val_idx])
            if is_classifier:
                scores.append(float(accuracy_score(y[val_idx], y_pred)))
            else:
                scores.append(max(float(r2_score(y[val_idx], y_pred)), 0.0))
        return float(np.mean(scores))

    study = optuna.create_study(direction="maximize")

    # Track per-trial progress so the API can poll it
    _AUTOTUNE_PROGRESS[model_id] = {"trial": 0, "total": n_trials, "best": None}

    def _progress_cb(study: "optuna.Study", trial: "optuna.trial.FrozenTrial") -> None:
        _AUTOTUNE_PROGRESS[model_id] = {
            "trial": trial.number + 1,
            "total": n_trials,
            "best": round(study.best_value, 4) if study.best_trial else None,
        }

    study.optimize(objective, n_trials=n_trials, callbacks=[_progress_cb], show_progress_bar=False)
    _AUTOTUNE_PROGRESS.pop(model_id, None)  # clear on completion

    best_params = study.best_params
    best_score = round(study.best_value, 4)

    # Full retrain with best params to get all diagnostics
    result = retrain_single_model(
        model_name=model_name,
        model_id=model_id,
        hyperparams=best_params,
        df=df,
        target_column=target_column,
        task_type=task_type,
        selection_plan=selection_plan,
        sampling_config=sampling_config,
    )
    result["optuna_best_score"] = best_score
    result["optuna_n_trials"] = n_trials
    result["optuna_best_params"] = best_params
    return result


# ── In-memory progress store (single-process dev) ─────────────────────────────
_AUTOTUNE_PROGRESS: dict[str, dict] = {}  # model_id -> {trial, total, best}


def get_autotune_progress(model_id: str) -> dict:
    """Return current Optuna trial progress for a running autotune job."""
    return _AUTOTUNE_PROGRESS.get(model_id, {})


def _model_library(model_name: str) -> str:
    mapping = {
        "LightGBM": "lightgbm",
        "XGBoost": "xgboost",
        "Random Forest": "sklearn",
        "Logistic Regression": "sklearn",
        "Ridge Regression": "sklearn",
    }
    return mapping.get(model_name, "sklearn")
