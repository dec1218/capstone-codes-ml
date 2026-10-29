from datetime import date, timedelta

import pytest

from app.features import MODEL_FEATURES, REAL_PILOT_FEATURES, assert_no_leakage, build_feature_frame, normalize_service_name


def source_row(index: int = 0) -> dict[str, object]:
    target = date(2026, 1, 1) + timedelta(days=index)
    return {
        "appointment_date": target.isoformat(),
        "appointment_time": "08:30",
        "created_at": f"{(target - timedelta(days=3)).isoformat()}T01:00:00+00:00",
        "age": 35,
        "gender": "Female",
        "service_name": "General Consultation",
        "duration_minutes": 30,
        "prior_appointments": 2,
        "prior_no_show_rate": 0.5,
    }


def test_builds_only_approved_features() -> None:
    frame = build_feature_frame([source_row()])
    assert list(frame.columns) == MODEL_FEATURES
    assert frame.iloc[0]["lead_days"] == 3
    assert frame.iloc[0]["appointment_hour"] == 8.5


def test_builds_real_pilot_features_without_history_or_booking_data() -> None:
    row = source_row()
    for key in ["created_at", "prior_appointments", "prior_no_show_rate"]:
        del row[key]
    frame = build_feature_frame([row], REAL_PILOT_FEATURES)
    assert list(frame.columns) == REAL_PILOT_FEATURES
    assert frame.iloc[0]["age_group"] == "Adult"


@pytest.mark.parametrize(("age", "expected"), [(0, "Infant"), (1, "Child"), (17, "Child"), (18, "Adult"), (59, "Adult"), (60, "Senior")])
def test_maps_live_age_to_colab_age_group(age: int, expected: str) -> None:
    row = source_row()
    row["age"] = age
    frame = build_feature_frame([row], REAL_PILOT_FEATURES)
    assert frame.iloc[0]["age_group"] == expected


def test_rejects_post_appointment_leakage() -> None:
    with pytest.raises(ValueError, match="cannot be model features"):
        assert_no_leakage(["age", "attendance_status"])


def test_normalizes_documented_service_aliases() -> None:
    assert normalize_service_name("Pediatric / Immunization") == "Immunization"
    assert normalize_service_name("Maternal Care - Prenatal") == "Prenatal Care"
    assert normalize_service_name(" Dental ") == "Dental"


def test_rejects_unknown_services() -> None:
    with pytest.raises(ValueError, match="Unknown or blank"):
        normalize_service_name("Unknown Clinic")
