from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.features import build_feature_frame, normalize_service_name


class ModelUnavailableError(RuntimeError):
    pass


class ModelService:
    def __init__(self, path: Path, allow_fixture_model: bool = False) -> None:
        self.path = path
        self.allow_fixture_model = allow_fixture_model
        self._bundle: dict[str, Any] | None = None

    @property
    def loaded(self) -> bool:
        return self._bundle is not None

    @property
    def metadata(self) -> dict[str, Any]:
        return dict(self._bundle.get("metadata", {})) if self._bundle else {}

    def load(self) -> None:
        if not self.path.exists():
            raise ModelUnavailableError(f"Model artifact not found at {self.path}")
        bundle = joblib.load(self.path)
        if not isinstance(bundle, dict) or "pipeline" not in bundle or "metadata" not in bundle:
            raise ModelUnavailableError("Model artifact has an invalid format.")
        if bundle["metadata"].get("dataset_kind") == "fixture" and not self.allow_fixture_model:
            raise ModelUnavailableError("Fixture models cannot serve live predictions. Set ALLOW_FIXTURE_MODEL=true only for isolated testing.")
        self._bundle = bundle

    def predict(self, rows: list[dict[str, Any]]) -> list[float]:
        if not self._bundle:
            self.load()
        model_features = self.metadata.get("features")
        if not isinstance(model_features, list) or not model_features:
            raise ModelUnavailableError("Model metadata does not declare its feature schema.")
        probabilities: np.ndarray = self._bundle["pipeline"].predict_proba(build_feature_frame(rows, model_features))[:, 1]
        return [round(float(value), 4) for value in probabilities]

    def partition_supported(self, rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        if not self._bundle:
            self.load()
        approved = self.metadata.get("approved_services")
        if not isinstance(approved, list) or not approved:
            return rows, []
        approved_services = {normalize_service_name(value) for value in approved}
        supported = []
        skipped = []
        for row in rows:
            if normalize_service_name(row.get("service_name")) in approved_services:
                supported.append(row)
            else:
                skipped.append(row)
        return supported, skipped
