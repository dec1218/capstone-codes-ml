from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.features import SERVICE_DURATIONS


GENERATOR_VERSION = "synthetic-generator-v1"
START_DATE = date(2025, 10, 1)
END_DATE = date(2026, 9, 30)
TARGET_NO_SHOW_RATE = 0.18
SERVICE_WEIGHTS = {
    "Dental": 0.30,
    "General Consultation": 0.20,
    "Immunization": 0.14,
    "Prenatal Care": 0.12,
    "Blood Pressure Monitoring": 0.10,
    "Child Wellness Check": 0.08,
    "Family Planning": 0.06,
}


def generate_dataset(row_count: int, seed: int) -> tuple[pd.DataFrame, dict[str, Any]]:
    if row_count < 100:
        raise ValueError("Generate at least 100 rows so chronological partitions contain both outcomes.")

    rng = np.random.default_rng(seed)
    patient_count = max(80, round(row_count * 0.20))
    patients = {
        f"SYN-P{index:04d}": {
            "age": int(rng.integers(1, 86)),
            "gender": str(rng.choice(["Female", "Male"], p=[0.56, 0.44])),
        }
        for index in range(1, patient_count + 1)
    }
    patient_ids = list(patients)
    services = list(SERVICE_WEIGHTS)
    weights = list(SERVICE_WEIGHTS.values())
    span = (END_DATE - START_DATE).days + 1

    appointments: list[dict[str, Any]] = []
    for index in range(1, row_count + 1):
        appointment_date = START_DATE + timedelta(days=int(rng.integers(0, span)))
        patient_id = str(rng.choice(patient_ids))
        service_name = str(rng.choice(services, p=weights))
        lead_days = int(np.clip(rng.gamma(shape=2.2, scale=5.0), 0, 45))
        hour = int(rng.integers(7, 17))
        minute = int(rng.choice([0, 30]))
        appointments.append({
            "synthetic_appointment_id": f"SYN-A{index:04d}",
            "synthetic_patient_id": patient_id,
            "appointment_date": appointment_date,
            "appointment_time": time(hour, minute),
            "created_at": datetime.combine(appointment_date - timedelta(days=lead_days), time(8), tzinfo=UTC),
            "age": patients[patient_id]["age"],
            "gender": patients[patient_id]["gender"],
            "service_name": service_name,
            "duration_minutes": SERVICE_DURATIONS[service_name],
        })

    appointments.sort(key=lambda row: (row["appointment_date"], row["appointment_time"], row["synthetic_appointment_id"]))
    history: dict[str, list[int]] = defaultdict(list)
    rows: list[dict[str, Any]] = []
    for appointment in appointments:
        previous = history[appointment["synthetic_patient_id"]]
        prior_count = len(previous)
        prior_rate = sum(previous) / prior_count if previous else 0.0
        lead_days = max(0, (appointment["appointment_date"] - appointment["created_at"].date()).days)
        hour = appointment["appointment_time"].hour
        weekday = appointment["appointment_date"].weekday()
        probability = (
            0.025
            + (0.45 * prior_rate)
            + (0.14 * min(lead_days, 30) / 30)
            + (0.06 if hour >= 14 else 0)
            + (0.04 if weekday in {0, 5, 6} else 0)
            + float(rng.normal(0, 0.025))
        )
        probability = float(np.clip(probability, 0.03, 0.58))
        label = int(rng.random() < probability)
        history[appointment["synthetic_patient_id"]].append(label)
        rows.append({
            **appointment,
            "appointment_date": appointment["appointment_date"].isoformat(),
            "appointment_time": appointment["appointment_time"].strftime("%H:%M"),
            "created_at": appointment["created_at"].isoformat(),
            "prior_appointments": prior_count,
            "prior_no_show_rate": round(prior_rate, 4),
            "label": label,
        })

    frame = pd.DataFrame(rows)
    metadata = validate_dataset(frame, seed)
    return frame, metadata


def validate_dataset(frame: pd.DataFrame, seed: int) -> dict[str, Any]:
    required = {
        "synthetic_appointment_id", "synthetic_patient_id", "appointment_date", "appointment_time",
        "created_at", "age", "gender", "service_name", "duration_minutes", "prior_appointments",
        "prior_no_show_rate", "label",
    }
    missing_columns = required.difference(frame.columns)
    if missing_columns:
        raise ValueError(f"Generated data is missing columns: {', '.join(sorted(missing_columns))}")
    if frame[list(required)].isna().any().any():
        raise ValueError("Generated data contains missing required values.")
    if not frame["synthetic_appointment_id"].is_unique:
        raise ValueError("Synthetic appointment identifiers must be unique.")
    if set(frame["service_name"]) != set(SERVICE_DURATIONS):
        raise ValueError("Every canonical service must appear in the generated dataset.")
    if set(frame["label"]) != {0, 1}:
        raise ValueError("Generated data must contain Show and No-Show outcomes.")
    if not frame["age"].between(1, 85).all():
        raise ValueError("Generated ages must be between 1 and 85.")
    if not frame["prior_no_show_rate"].between(0, 1).all():
        raise ValueError("Prior no-show rates must stay between zero and one.")

    ordered = frame.sort_values(["appointment_date", "appointment_time"])
    partitions = {
        "train": ordered.iloc[:int(len(ordered) * 0.70)],
        "validation": ordered.iloc[int(len(ordered) * 0.70):int(len(ordered) * 0.85)],
        "test": ordered.iloc[int(len(ordered) * 0.85):],
    }
    if any(partition["label"].nunique() < 2 for partition in partitions.values()):
        raise ValueError("Every chronological partition must contain Show and No-Show outcomes.")

    no_show_count = int(frame["label"].sum())
    return {
        "generator_version": GENERATOR_VERSION,
        "dataset_kind": "synthetic",
        "generated_at": datetime.now(UTC).isoformat(),
        "seed": seed,
        "row_count": len(frame),
        "date_range": {"start": str(frame["appointment_date"].min()), "end": str(frame["appointment_date"].max())},
        "target_no_show_rate": TARGET_NO_SHOW_RATE,
        "observed_no_show_rate": round(no_show_count / len(frame), 4),
        "class_counts": {"show": len(frame) - no_show_count, "no_show": no_show_count},
        "service_counts": dict(Counter(frame["service_name"])),
        "partition_counts": {name: {"rows": len(part), "no_shows": int(part["label"].sum())} for name, part in partitions.items()},
        "label_assumptions": [
            "Prior no-show rate is the strongest simulated operational factor.",
            "Longer booking lead time and some schedule periods modestly increase simulated probability.",
            "Age, gender, and service do not directly determine the synthetic label.",
            "Random noise prevents deterministic labels and perfect prototype metrics.",
        ],
        "limitations": "Synthetic development data only. Metrics do not establish real-world predictive validity.",
    }


def write_dataset(frame: pd.DataFrame, metadata: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False)
    output_path.with_suffix(".metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate reproducible synthetic appointment data for prototype development.")
    parser.add_argument("--rows", type=int, default=500)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=Path("training/data/synthetic-training-data.csv"))
    arguments = parser.parse_args()
    frame, metadata = generate_dataset(arguments.rows, arguments.seed)
    write_dataset(frame, metadata, arguments.output)
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
