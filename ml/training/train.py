from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.features import CATEGORICAL_FEATURES, NUMERIC_FEATURES, build_feature_frame


def chronological_split(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if len(frame) < 20:
        raise ValueError("At least 20 labelled rows are required to exercise train/validation/test splitting.")
    ordered = frame.sort_values(["appointment_date", "appointment_time"]).reset_index(drop=True)
    train_end = max(1, int(len(ordered) * 0.70))
    validation_end = max(train_end + 1, int(len(ordered) * 0.85))
    return ordered.iloc[:train_end], ordered.iloc[train_end:validation_end], ordered.iloc[validation_end:]


def train_model(data_path: Path, output_path: Path, dataset_kind: str, model_version: str) -> dict[str, Any]:
    source = pd.read_csv(data_path)
    if "label" not in source.columns:
        raise ValueError("Training data must include a binary label column (1 = No-Show, 0 = Show).")
    if not set(source["label"].dropna().unique()).issubset({0, 1}):
        raise ValueError("Training labels must contain only 0 and 1.")
    train_rows, validation_rows, test_rows = chronological_split(source)
    if train_rows["label"].nunique() < 2:
        raise ValueError("The chronological training partition must contain Show and No-Show outcomes.")

    preprocessor = ColumnTransformer([
        ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median"))]), NUMERIC_FEATURES),
        ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
    ])
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(
            n_estimators=400,
            max_depth=7,
            min_samples_leaf=5,
            max_features="sqrt",
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )),
    ])
    pipeline.fit(build_feature_frame(train_rows.to_dict("records")), train_rows["label"].astype(int))

    feature_names = pipeline.named_steps["preprocessor"].get_feature_names_out()
    importances = pipeline.named_steps["classifier"].feature_importances_
    feature_importance = [
        {"feature": str(feature), "importance": round(float(importance), 6)}
        for feature, importance in sorted(zip(feature_names, importances, strict=True), key=lambda item: item[1], reverse=True)
    ]

    metrics = {
        "validation": _evaluate(pipeline, validation_rows),
        "test": _evaluate(pipeline, test_rows),
    }
    metadata = {
        "model_version": model_version,
        "dataset_kind": dataset_kind,
        "trained_at": datetime.now(UTC).isoformat(),
        "source_file": data_path.name,
        "row_count": len(source),
        "split": {"train": len(train_rows), "validation": len(validation_rows), "test": len(test_rows)},
        "features": NUMERIC_FEATURES + CATEGORICAL_FEATURES,
        "decision_threshold": 0.5,
        "risk_thresholds": {"moderate": 0.4, "high": 0.7},
        "metrics": metrics,
        "class_distribution": {"show": int((source["label"] == 0).sum()), "no_show": int((source["label"] == 1).sum())},
        "feature_importance": feature_importance,
        "leakage_policy": "Only information available before the appointment is used; attendance outcomes and delivery fields are excluded.",
        "usage_warning": "Synthetic models are for technical integration testing only and must not drive operational reminder decisions." if dataset_kind == "synthetic" else None,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "metadata": metadata}, output_path)
    output_path.with_suffix(".json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def _evaluate(pipeline: Pipeline, rows: pd.DataFrame) -> dict[str, Any]:
    labels = rows["label"].astype(int)
    probabilities = pipeline.predict_proba(build_feature_frame(rows.to_dict("records")))[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    return {
        "precision": round(float(precision_score(labels, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(labels, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(labels, predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(labels, probabilities)), 4) if labels.nunique() == 2 else None,
        "confusion_matrix": confusion_matrix(labels, predictions, labels=[0, 1]).tolist(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the no-show Random Forest model.")
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("artifacts/no_show_model.joblib"))
    parser.add_argument("--dataset-kind", choices=["fixture", "synthetic", "real"], required=True)
    parser.add_argument("--model-version", required=True)
    arguments = parser.parse_args()
    metadata = train_model(arguments.data, arguments.output, arguments.dataset_kind, arguments.model_version)
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
