from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import Any

import pandas as pd


NUMERIC_FEATURES = [
    "age",
    "lead_days",
    "appointment_hour",
    "day_of_week",
    "is_weekend",
    "duration_minutes",
    "prior_appointments",
    "prior_no_show_rate",
]
CATEGORICAL_FEATURES = ["gender", "service_name"]
MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
REAL_PILOT_FEATURES = [
    "appointment_hour",
    "day_of_week",
    "is_weekend",
    "duration_minutes",
    "age_group",
    "gender",
    "service_name",
]
SUPPORTED_MODEL_FEATURES = set(MODEL_FEATURES + REAL_PILOT_FEATURES)
SERVICE_DURATIONS = {
    "General Consultation": 20,
    "Immunization": 15,
    "Prenatal Care": 30,
    "Blood Pressure Monitoring": 15,
    "Child Wellness Check": 25,
    "Family Planning": 25,
    "Dental": 30,
}
SERVICE_ALIASES = {
    "general consultation": "General Consultation",
    "immunization": "Immunization",
    "pediatric / immunization": "Immunization",
    "prenatal care": "Prenatal Care",
    "maternal care - prenatal": "Prenatal Care",
    "blood pressure monitoring": "Blood Pressure Monitoring",
    "child wellness check": "Child Wellness Check",
    "family planning": "Family Planning",
    "dental": "Dental",
    "dental checkup": "Dental",
}
REQUIRED_SOURCE_COLUMNS = {
    "appointment_date",
    "appointment_time",
    "created_at",
    "age",
    "gender",
    "service_name",
    "duration_minutes",
    "prior_appointments",
    "prior_no_show_rate",
}
LEAKAGE_COLUMNS = {
    "attendance_status",
    "check_in",
    "check_out",
    "result",
    "probability",
    "risk_level",
    "sent_at",
}


def assert_no_leakage(columns: Iterable[str]) -> None:
    leaked = LEAKAGE_COLUMNS.intersection(columns)
    if leaked:
        raise ValueError(f"Outcome or post-appointment columns cannot be model features: {', '.join(sorted(leaked))}")


def normalize_service_name(value: Any) -> str:
    normalized = " ".join(str(value).strip().lower().split())
    if not normalized or normalized not in SERVICE_ALIASES:
        raise ValueError(f"Unknown or blank health service: {value!r}")
    return SERVICE_ALIASES[normalized]


def build_feature_frame(rows: Iterable[Mapping[str, Any]], model_features: Iterable[str] | None = None) -> pd.DataFrame:
    source = pd.DataFrame(list(rows))
    requested_features = list(model_features or MODEL_FEATURES)
    unknown_features = set(requested_features).difference(SUPPORTED_MODEL_FEATURES)
    if unknown_features:
        raise ValueError(f"Unsupported model features: {', '.join(sorted(unknown_features))}")

    required = {
        "appointment_date",
        "appointment_time",
        "age",
        "gender",
        "service_name",
        "duration_minutes",
    }
    if "lead_days" in requested_features:
        required.add("created_at")
    if "prior_appointments" in requested_features:
        required.add("prior_appointments")
    if "prior_no_show_rate" in requested_features:
        required.add("prior_no_show_rate")
    missing = required.difference(source.columns)
    if missing:
        raise ValueError(f"Missing required feature sources: {', '.join(sorted(missing))}")
    assert_no_leakage(source.columns)

    appointment_dates = pd.to_datetime(source["appointment_date"], errors="raise")
    appointment_hours = source["appointment_time"].map(_time_to_hour)
    ages = pd.to_numeric(source["age"], errors="raise")

    frame = pd.DataFrame(index=source.index)
    frame["age"] = ages
    frame["age_group"] = pd.cut(
        ages,
        bins=[float("-inf"), 0, 17, 59, float("inf")],
        labels=["Infant", "Child", "Adult", "Senior"],
    ).astype(str)
    frame["appointment_hour"] = appointment_hours
    frame["day_of_week"] = appointment_dates.dt.dayofweek
    frame["is_weekend"] = (appointment_dates.dt.dayofweek >= 5).astype(int)
    frame["duration_minutes"] = pd.to_numeric(source["duration_minutes"], errors="raise")
    frame["gender"] = source["gender"].astype(str).str.strip()
    frame["service_name"] = source["service_name"].map(normalize_service_name)
    if "lead_days" in requested_features:
        created_dates = pd.to_datetime(source["created_at"], utc=True, errors="raise").dt.tz_localize(None)
        frame["lead_days"] = (appointment_dates.dt.normalize() - created_dates.dt.normalize()).dt.days.clip(lower=0)
    if "prior_appointments" in requested_features:
        frame["prior_appointments"] = pd.to_numeric(source["prior_appointments"], errors="raise")
    if "prior_no_show_rate" in requested_features:
        frame["prior_no_show_rate"] = pd.to_numeric(source["prior_no_show_rate"], errors="raise").clip(0, 1)
    return frame[requested_features]


def _time_to_hour(value: Any) -> float:
    parsed = datetime.strptime(str(value)[:5], "%H:%M")
    return parsed.hour + parsed.minute / 60
