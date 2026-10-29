from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from app.model import ModelService, ModelUnavailableError
from training.train import train_model


def fixture_rows() -> list[dict[str, object]]:
    rows = []
    for index in range(60):
        appointment_date = date(2026, 1, 1) + timedelta(days=index)
        no_show = 1 if index % 4 == 0 or index % 11 == 0 else 0
        rows.append({
            "appointment_date": appointment_date.isoformat(),
            "appointment_time": f"{8 + index % 8:02d}:00",
            "created_at": f"{(appointment_date - timedelta(days=1 + index % 14)).isoformat()}T00:00:00+00:00",
            "age": 18 + index % 55,
            "gender": "Female" if index % 2 else "Male",
            "service_name": ["General Consultation", "Immunization", "Dental Checkup"][index % 3],
            "duration_minutes": [30, 20, 45][index % 3],
            "prior_appointments": index % 7,
            "prior_no_show_rate": 0 if index % 7 == 0 else round((index % 3) / (index % 7), 2),
            "label": no_show,
        })
    return rows


def test_fixture_training_is_reproducible_and_guarded(tmp_path: Path) -> None:
    csv_path = tmp_path / "fixture.csv"
    artifact_path = tmp_path / "fixture.joblib"
    pd.DataFrame(fixture_rows()).to_csv(csv_path, index=False)
    metadata = train_model(csv_path, artifact_path, "fixture", "fixture-test-v1")

    assert artifact_path.exists()
    assert artifact_path.with_suffix(".json").exists()
    assert metadata["split"] == {"train": 42, "validation": 9, "test": 9}
    assert "roc_auc" in metadata["metrics"]["test"]

    guarded = ModelService(artifact_path)
    try:
        guarded.load()
        raise AssertionError("Fixture model should be blocked from live serving.")
    except ModelUnavailableError:
        pass

    test_service = ModelService(artifact_path, allow_fixture_model=True)
    probabilities = test_service.predict(fixture_rows()[:2])
    assert len(probabilities) == 2
    assert all(0 <= value <= 1 for value in probabilities)


def test_real_pilot_artifact_loads_filters_and_predicts() -> None:
    artifact_path = Path(__file__).resolve().parents[1] / "artifacts" / "no_show_model_real_pilot.joblib"
    assert artifact_path.exists(), "Place the exported Colab pilot artifact in ml/artifacts before activation."
    service = ModelService(artifact_path)
    service.load()

    supported_row = fixture_rows()[0]
    supported_row["service_name"] = "Immunization"
    unsupported_row = fixture_rows()[1]
    unsupported_row["service_name"] = "Dental"
    supported, skipped = service.partition_supported([supported_row, unsupported_row])

    assert service.metadata["model_version"] == "rf-real-pilot-colab-v1"
    assert service.metadata["dataset_kind"] == "real"
    assert supported == [supported_row]
    assert skipped == [unsupported_row]
    probabilities = service.predict(supported)
    assert len(probabilities) == 1
    assert 0 <= probabilities[0] <= 1
