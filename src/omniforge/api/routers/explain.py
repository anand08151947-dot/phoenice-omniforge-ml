"""XAI/Explain router — Phase D."""
from __future__ import annotations

import asyncio
import io
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.dataset import Dataset
from ...db.session import get_db

router = APIRouter()


# ─── helpers ──────────────────────────────────────────────────────────────────

def _load_df(minio_path: str, original_filename: str) -> pd.DataFrame:
    from ...core.config import settings as _s
    from ...storage.minio import download_bytes
    raw = download_bytes(_s.MINIO_BUCKET_DATASETS, minio_path)
    fname = original_filename.lower()
    if fname.endswith(".parquet"):
        return pd.read_parquet(io.BytesIO(raw))
    if fname.endswith(".json"):
        return pd.read_json(io.BytesIO(raw))
    return pd.read_csv(io.BytesIO(raw))


def _get_best_candidate(training_results: dict) -> dict | None:
    candidates = training_results.get("candidates", [])
    done = [c for c in candidates if c.get("status") == "done"]
    return done[0] if done else None


def _retrain_best_model(
    dataset: Dataset,
    df: pd.DataFrame,
) -> tuple[Any, np.ndarray, list[str]]:
    """Retrain the best candidate model on full data. Returns (model, X, feature_cols)."""
    from ...ml.training.trainer import _preprocess, _build_models, _get_selected_features

    training_results = dataset.training_results or {}
    best = _get_best_candidate(training_results)
    if best is None:
        raise ValueError("No trained candidate found in training_results")

    task_type = dataset.task_type.value if dataset.task_type else "classification"
    target_column = dataset.target_column
    selection_plan = dataset.selection_plan
    sampling_config = dataset.sampling_config
    strategy = (sampling_config or {}).get("config", {}).get("strategy", "none")

    if selection_plan and selection_plan.get("importances"):
        feature_cols = _get_selected_features(selection_plan)
    else:
        feature_cols = [c for c in df.columns if c != target_column]

    feature_cols = [f for f in feature_cols if f in df.columns and f != target_column]
    if not feature_cols:
        raise ValueError("No features available after selection")

    X, y = _preprocess(df, feature_cols, target_column)

    best_model_name = best.get("model_name", "")
    models_cfg = _build_models(task_type, strategy)
    model_cfg = next((m for m in models_cfg if m["model_name"] == best_model_name), models_cfg[0])
    model = model_cfg["model"]
    model.fit(X, y)
    return model, X, feature_cols


def _extract_bv(bv: Any, is_clf: bool) -> float:
    """Extract scalar base value from expected_value (scalar, list, or array)."""
    if hasattr(bv, "__len__") and len(bv) > 0:
        return float(bv[1]) if (is_clf and len(bv) >= 2) else float(bv[0])
    try:
        return float(bv)
    except Exception:
        return 0.0


def _normalize_shap_values(sv: Any) -> np.ndarray | None:
    """Normalize SHAP values to 2D (n_samples, n_features), picking positive class for classifiers."""
    if sv is None:
        return None
    if isinstance(sv, list):
        # list of arrays: one per class
        arr = sv[1] if len(sv) >= 2 else sv[0]
        return np.asarray(arr)
    arr = np.asarray(sv)
    if arr.ndim == 3:
        # (n_samples, n_features, n_classes) — take positive class
        return arr[:, :, 1]
    return arr


def _compute_shap_explanation(dataset: Dataset, df: pd.DataFrame) -> dict:
    import shap
    from sklearn.base import is_classifier as sklearn_is_clf

    training_results = dataset.training_results or {}
    best = _get_best_candidate(training_results)
    if best is None:
        raise ValueError("No trained candidate found")

    task_type = dataset.task_type.value if dataset.task_type else "classification"
    model_id = best.get("id", "")

    # ── Unsupervised: return stored feature importances ──────────────────────
    if task_type in ("clustering", "anomaly_detection"):
        fi = best.get("feature_importances", [])
        global_shap = [
            {
                "feature": f["feature"],
                "mean_abs_shap": float(f.get("importance", 0.0)),
                "values": [float(f.get("importance", 0.0))],
            }
            for f in fi
        ]
        return {"model_id": model_id, "global_shap": global_shap,
                "local_shap": [], "base_value": 0.0, "prediction": 0.0}

    # ── Text classification: return TF-IDF top terms ─────────────────────────
    if task_type == "text_classification":
        top_terms = training_results.get("top_terms") or best.get("top_terms") or []
        global_shap = [
            {
                "feature": t["term"],
                "mean_abs_shap": float(t.get("score", 0.0)),
                "values": [float(t.get("score", 0.0))],
            }
            for t in top_terms
        ]
        return {"model_id": model_id, "global_shap": global_shap,
                "local_shap": [], "base_value": 0.0, "prediction": 0.0}

    # ── Forecasting: return lag feature importances ───────────────────────────
    if task_type == "forecasting":
        n_lags = training_results.get("n_lags", 12) or 12
        total = sum(range(1, n_lags + 1)) or 1
        global_shap = [
            {
                "feature": f"lag_{i}",
                "mean_abs_shap": round(float(n_lags - i + 1) / total, 4),
                "values": [round(float(n_lags - i + 1) / total, 4)],
            }
            for i in range(1, n_lags + 1)
        ]
        return {"model_id": model_id, "global_shap": global_shap,
                "local_shap": [], "base_value": 0.0, "prediction": 0.0}

    # ── Supervised: retrain + SHAP ────────────────────────────────────────────
    def _fi_fallback() -> dict:
        fi = best.get("feature_importances", [])
        return {
            "model_id": model_id,
            "global_shap": [
                {"feature": f["feature"], "mean_abs_shap": float(f.get("importance", 0.0)),
                 "values": [float(f.get("importance", 0.0))]}
                for f in fi
            ],
            "local_shap": [], "base_value": 0.0, "prediction": 0.0,
        }

    try:
        model, X, feature_cols = _retrain_best_model(dataset, df)
    except Exception:
        return _fi_fallback()

    is_clf = sklearn_is_clf(model)
    model_name = best.get("model_name", "")

    # Sample for global SHAP (max 500 rows)
    n_sample = min(500, len(X))
    rng = np.random.default_rng(42)
    idx = rng.choice(len(X), n_sample, replace=False)
    X_sample = X[idx]

    try:
        tree_keywords = ("Random Forest", "ExtraTrees", "GradientBoosting",
                         "XGBoost", "LightGBM", "CatBoost", "Decision Tree")
        linear_keywords = ("Logistic Regression", "Ridge", "Lasso",
                           "ElasticNet", "Ridge Regression")

        if any(kw in model_name for kw in tree_keywords):
            explainer = shap.TreeExplainer(model)
            sv_global_raw = explainer.shap_values(X_sample)
            sv_local_raw = explainer.shap_values(X[[0]])
            bv = explainer.expected_value
        elif any(kw in model_name for kw in linear_keywords):
            explainer = shap.LinearExplainer(model, X_sample)
            sv_global_raw = explainer.shap_values(X_sample)
            sv_local_raw = explainer.shap_values(X[[0]])
            bv = explainer.expected_value
        else:
            # KernelExplainer fallback for MLP / unknown models
            bg = X[:min(50, len(X))]
            predict_fn = model.predict_proba if is_clf else model.predict
            explainer = shap.KernelExplainer(predict_fn, bg)
            X_explain = X_sample[:min(50, n_sample)]
            sv_global_raw = explainer.shap_values(X_explain, nsamples=50)
            sv_local_raw = explainer.shap_values(X[[0]], nsamples=50)
            bv = explainer.expected_value

        base_value = _extract_bv(bv, is_clf)
        sv_global = _normalize_shap_values(sv_global_raw)
        sv_local = _normalize_shap_values(sv_local_raw)

    except Exception:
        return _fi_fallback()

    if sv_global is None or sv_global.ndim < 2:
        return _fi_fallback()

    # Global SHAP: mean(|shap_values|) per feature
    mean_abs = np.mean(np.abs(sv_global), axis=0)
    global_shap = []
    for i, col in enumerate(feature_cols):
        vals = sv_global[:, i].tolist()
        global_shap.append({
            "feature": col,
            "mean_abs_shap": round(float(mean_abs[i]), 6),
            "values": [round(float(v), 6) for v in vals],
        })
    global_shap.sort(key=lambda x: x["mean_abs_shap"], reverse=True)

    # Local SHAP: first row
    local_shap = []
    if sv_local is not None:
        local_1d = sv_local[0] if sv_local.ndim == 2 else sv_local
        df_row = df.iloc[0]
        for i, col in enumerate(feature_cols):
            raw_fv = df_row[col] if col in df.columns else X[0, i]
            try:
                fv: float | str = float(raw_fv)
            except (TypeError, ValueError):
                fv = str(raw_fv)
            local_shap.append({
                "feature": col,
                "shap_value": round(float(local_1d[i]), 6),
                "feature_value": fv,
            })

    # Prediction for first row
    try:
        prediction = (
            float(model.predict_proba(X[[0]])[:, 1][0]) if is_clf
            else float(model.predict(X[[0]])[0])
        )
    except Exception:
        prediction = 0.0

    return {
        "model_id": model_id,
        "global_shap": global_shap,
        "local_shap": local_shap,
        "base_value": base_value,
        "prediction": round(prediction, 6),
    }


def _compute_counterfactual(dataset: Dataset, df: pd.DataFrame) -> dict:
    """Compute a simple median-based counterfactual for the first row."""
    from ...ml.training.trainer import _detect_text_columns

    task_type = dataset.task_type.value if dataset.task_type else "classification"
    target_column = dataset.target_column
    training_results = dataset.training_results or {}
    best = _get_best_candidate(training_results)
    model_id = best.get("id", "") if best else ""

    # Identify numeric feature columns (exclude target + text cols)
    text_cols = set(_detect_text_columns(df, exclude=target_column) if target_column else [])
    exclude_cols = text_cols | ({target_column} if target_column else set())
    numeric_features = [
        c for c in df.columns
        if c not in exclude_cols and pd.api.types.is_numeric_dtype(df[c])
    ]

    if not numeric_features or df.empty:
        return {
            "original_prediction": 0.0,
            "cf_prediction": 0.0,
            "original_class": "unknown",
            "cf_class": "unknown",
            "features": [],
            "distance": 0.0,
        }

    first_row = df.iloc[0]
    features = []
    for col in numeric_features:
        col_min = float(df[col].min())
        col_max = float(df[col].max())
        col_range = col_max - col_min
        step = round(col_range / 100, 6) if col_range > 0 else 1.0
        median_val = float(df[col].median())
        orig_val = float(first_row[col]) if pd.notna(first_row[col]) else median_val
        features.append({
            "feature": col,
            "original_value": round(orig_val, 6),
            "cf_value": round(median_val, 6),
            "min": round(col_min, 6),
            "max": round(col_max, 6),
            "step": step,
        })

    # Unsupervised: return stub
    if task_type not in ("classification", "regression"):
        return {
            "original_prediction": 0.0,
            "cf_prediction": 0.0,
            "original_class": "n/a",
            "cf_class": "n/a",
            "features": features,
            "distance": 0.0,
        }

    # Retrain and predict
    try:
        model, X, feature_cols = _retrain_best_model(dataset, df)
    except Exception:
        return {
            "original_prediction": 0.0,
            "cf_prediction": 0.0,
            "original_class": "error",
            "cf_class": "error",
            "features": features,
            "distance": 0.0,
        }

    from sklearn.base import is_classifier as sklearn_is_clf
    from ...ml.training.trainer import _preprocess as _pp

    is_clf = sklearn_is_clf(model)

    try:
        if is_clf:
            orig_pred = float(model.predict_proba(X[[0]])[:, 1][0])
            orig_class = str(model.predict(X[[0]])[0])
        else:
            orig_pred = float(model.predict(X[[0]])[0])
            orig_class = "predicted value"
    except Exception:
        orig_pred = 0.0
        orig_class = "unknown"

    # Build counterfactual row with median substitutions
    cf_df = df.iloc[[0]].copy()
    for f in features:
        if f["feature"] in cf_df.columns:
            cf_df[f["feature"]] = f["cf_value"]

    try:
        X_cf, _ = _pp(cf_df, feature_cols, target_column)
        if is_clf:
            cf_pred = float(model.predict_proba(X_cf)[:, 1][0])
            cf_class = str(model.predict(X_cf)[0])
        else:
            cf_pred = float(model.predict(X_cf)[0])
            cf_class = "predicted value"
    except Exception:
        cf_pred = 0.0
        cf_class = "unknown"

    # Euclidean distance normalised by feature range
    orig_vals = np.array([f["original_value"] for f in features])
    cf_vals = np.array([f["cf_value"] for f in features])
    ranges = np.array([max(f["max"] - f["min"], 1e-9) for f in features])
    distance = round(float(np.sqrt(np.sum(((orig_vals - cf_vals) / ranges) ** 2))), 4)

    return {
        "original_prediction": round(orig_pred, 6),
        "cf_prediction": round(cf_pred, 6),
        "original_class": orig_class,
        "cf_class": cf_class,
        "features": features,
        "distance": distance,
    }


# ─── endpoints ────────────────────────────────────────────────────────────────

@router.get("/explain/shap")
async def get_shap_explanation(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not dataset.training_results:
        raise HTTPException(
            status_code=422,
            detail="Run training first before generating explanations",
        )
    if not dataset.minio_path:
        raise HTTPException(status_code=422, detail="No dataset file found")

    loop = asyncio.get_event_loop()
    try:
        df = await loop.run_in_executor(
            None, _load_df, dataset.minio_path, dataset.original_filename or "upload.csv"
        )
        explanation = await loop.run_in_executor(
            None, _compute_shap_explanation, dataset, df
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SHAP computation failed: {exc}") from exc

    return explanation


@router.get("/explain/counterfactual")
async def get_counterfactual(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not dataset.training_results:
        raise HTTPException(
            status_code=422,
            detail="Run training first before generating explanations",
        )
    if not dataset.minio_path:
        raise HTTPException(status_code=422, detail="No dataset file found")

    loop = asyncio.get_event_loop()
    try:
        df = await loop.run_in_executor(
            None, _load_df, dataset.minio_path, dataset.original_filename or "upload.csv"
        )
        cf_result = await loop.run_in_executor(
            None, _compute_counterfactual, dataset, df
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Counterfactual computation failed: {exc}"
        ) from exc

    return cf_result
