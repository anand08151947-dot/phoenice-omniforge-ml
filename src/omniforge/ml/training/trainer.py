"""AutoML trainer for Phase 7."""
from __future__ import annotations

import time
import uuid
import warnings
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.model_selection import StratifiedKFold, KFold, cross_val_predict
from sklearn.metrics import (
    roc_auc_score, f1_score, accuracy_score, r2_score, mean_squared_error,
)
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")


def _get_selected_features(selection_plan: dict) -> list[str]:
    """Return feature names where keep=True from selection_plan."""
    importances = selection_plan.get("importances", [])
    return [f["feature"] for f in importances if f.get("keep", True)]


def _build_models(task_type: str, strategy: str) -> list[dict]:
    """Return list of {id, model_name, library, model, is_classifier}."""
    cw = "balanced" if strategy == "class_weights" else None

    if task_type in ("classification", "anomaly_detection"):
        return [
            {
                "id": str(uuid.uuid4()),
                "model_name": "LightGBM",
                "library": "lightgbm",
                "model": _make_lgbm_clf(cw),
            },
            {
                "id": str(uuid.uuid4()),
                "model_name": "XGBoost",
                "library": "xgboost",
                "model": _make_xgb_clf(cw),
            },
            {
                "id": str(uuid.uuid4()),
                "model_name": "Random Forest",
                "library": "sklearn",
                "model": RandomForestClassifier(
                    n_estimators=200, class_weight=cw, random_state=42, n_jobs=-1
                ),
            },
            {
                "id": str(uuid.uuid4()),
                "model_name": "Logistic Regression",
                "library": "sklearn",
                "model": LogisticRegression(
                    max_iter=1000, class_weight=cw, random_state=42, n_jobs=-1
                ),
            },
        ]
    else:
        # regression / forecasting / etc.
        return [
            {
                "id": str(uuid.uuid4()),
                "model_name": "LightGBM",
                "library": "lightgbm",
                "model": _make_lgbm_reg(),
            },
            {
                "id": str(uuid.uuid4()),
                "model_name": "XGBoost",
                "library": "xgboost",
                "model": _make_xgb_reg(),
            },
            {
                "id": str(uuid.uuid4()),
                "model_name": "Random Forest",
                "library": "sklearn",
                "model": RandomForestRegressor(
                    n_estimators=200, random_state=42, n_jobs=-1
                ),
            },
            {
                "id": str(uuid.uuid4()),
                "model_name": "Ridge Regression",
                "library": "sklearn",
                "model": Ridge(alpha=1.0),
            },
        ]


def _make_lgbm_clf(class_weight):
    try:
        import lightgbm as lgb
        return lgb.LGBMClassifier(
            n_estimators=300, learning_rate=0.05, num_leaves=63,
            class_weight=class_weight, random_state=42, n_jobs=-1, verbose=-1,
        )
    except ImportError:
        from sklearn.ensemble import GradientBoostingClassifier
        return GradientBoostingClassifier(n_estimators=100, random_state=42)


def _make_xgb_clf(class_weight):
    try:
        import xgboost as xgb
        return xgb.XGBClassifier(
            n_estimators=300, learning_rate=0.05, max_depth=6,
            eval_metric="logloss", random_state=42, n_jobs=-1, verbosity=0,
        )
    except ImportError:
        from sklearn.ensemble import GradientBoostingClassifier
        return GradientBoostingClassifier(n_estimators=100, random_state=42)


def _make_lgbm_reg():
    try:
        import lightgbm as lgb
        return lgb.LGBMRegressor(
            n_estimators=300, learning_rate=0.05, num_leaves=63,
            random_state=42, n_jobs=-1, verbose=-1,
        )
    except ImportError:
        from sklearn.ensemble import GradientBoostingRegressor
        return GradientBoostingRegressor(n_estimators=100, random_state=42)


def _make_xgb_reg():
    try:
        import xgboost as xgb
        return xgb.XGBRegressor(
            n_estimators=300, learning_rate=0.05, max_depth=6,
            random_state=42, n_jobs=-1, verbosity=0,
        )
    except ImportError:
        from sklearn.ensemble import GradientBoostingRegressor
        return GradientBoostingRegressor(n_estimators=100, random_state=42)


def _preprocess(df: pd.DataFrame, feature_cols: list[str], target: str):
    """Numeric imputation + ordinal encode categoricals."""
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


def run_training(
    dataset_id: str,
    df: pd.DataFrame,
    target_column: str,
    task_type: str,
    selection_plan: dict | None,
    sampling_config: dict | None,
) -> dict:
    """Run AutoML training and return results dict."""
    strategy = (sampling_config or {}).get("config", {}).get("strategy", "none")
    is_classifier = task_type in ("classification", "anomaly_detection")

    # Determine features from selection plan
    if selection_plan and selection_plan.get("importances"):
        feature_cols = _get_selected_features(selection_plan)
    else:
        feature_cols = [c for c in df.columns if c != target_column]

    feature_cols = [f for f in feature_cols if f in df.columns and f != target_column]
    if not feature_cols:
        raise ValueError("No features available after selection")

    X, y = _preprocess(df, feature_cols, target_column)
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
        result: dict[str, Any] = {
            "id": cfg["id"],
            "model_name": cfg["model_name"],
            "library": cfg["library"],
            "status": "done",
            "progress": 100,
            "hyperparams": _extract_params(model),
            "cv_score": 0.0,
            "train_score": 0.0,
            "val_score": 0.0,
            "f1": 0.0,
            "auc_roc": 0.0,
            "rmse": None,
            "train_time_s": 0.0,
            "n_features": len(feature_cols),
        }

        try:
            if is_classifier:
                y_pred = cross_val_predict(model, X, y, cv=cv_splitter, method="predict")
                try:
                    y_prob = cross_val_predict(model, X, y, cv=cv_splitter, method="predict_proba")
                    n_classes = len(np.unique(y))
                    if n_classes == 2:
                        auc = roc_auc_score(y, y_prob[:, 1])
                    else:
                        auc = roc_auc_score(y, y_prob, multi_class="ovr", average="weighted")
                except Exception:
                    auc = 0.0
                cv_acc = accuracy_score(y, y_pred)
                f1 = f1_score(y, y_pred, average="weighted", zero_division=0)
                result["cv_score"] = round(cv_acc, 4)
                result["val_score"] = round(cv_acc, 4)
                result["f1"] = round(f1, 4)
                result["auc_roc"] = round(auc, 4)
            else:
                y_pred = cross_val_predict(model, X, y, cv=cv_splitter)
                r2 = r2_score(y, y_pred)
                rmse = float(np.sqrt(mean_squared_error(y, y_pred)))
                result["cv_score"] = round(max(r2, 0.0), 4)
                result["val_score"] = round(max(r2, 0.0), 4)
                result["rmse"] = round(rmse, 4)

            model.fit(X, y)
            if is_classifier:
                result["train_score"] = round(accuracy_score(y, model.predict(X)), 4)
            else:
                result["train_score"] = round(r2_score(y, model.predict(X)), 4)

        except Exception as exc:
            result["status"] = "failed"
            result["error"] = str(exc)

        result["train_time_s"] = round(time.time() - t0, 2)
        candidates.append(result)

    candidates.sort(key=lambda c: c["cv_score"], reverse=True)

    return {
        "dataset_id": dataset_id,
        "task_type": task_type,
        "target_column": target_column,
        "n_features": len(feature_cols),
        "features_used": feature_cols,
        "sampling_strategy": strategy,
        "candidates": candidates,
        "best_model": candidates[0]["model_name"] if candidates else None,
        "best_cv_score": candidates[0]["cv_score"] if candidates else 0.0,
    }


def _extract_params(model) -> dict:
    try:
        return {k: v for k, v in model.get_params().items() if not callable(v)}
    except Exception:
        return {}
