from pathlib import Path

from training.generate_synthetic import generate_dataset, write_dataset


def test_synthetic_generator_is_reproducible_and_complete(tmp_path: Path) -> None:
    first, metadata = generate_dataset(500, 42)
    second, _ = generate_dataset(500, 42)
    output = tmp_path / "synthetic.csv"
    write_dataset(first, metadata, output)

    assert first.equals(second)
    assert len(first) == 500
    assert 0.12 <= first["label"].mean() <= 0.24
    first_visit_rows = first.sort_values(["appointment_date", "appointment_time"]).groupby("synthetic_patient_id", sort=False).head(1)
    assert (first_visit_rows["prior_appointments"] == 0).all()
    assert (first_visit_rows["prior_no_show_rate"] == 0).all()
    assert metadata["dataset_kind"] == "synthetic"
    assert metadata["partition_counts"] == {
        "train": {"rows": 350, "no_shows": metadata["partition_counts"]["train"]["no_shows"]},
        "validation": {"rows": 75, "no_shows": metadata["partition_counts"]["validation"]["no_shows"]},
        "test": {"rows": 75, "no_shows": metadata["partition_counts"]["test"]["no_shows"]},
    }
    assert output.exists()
    assert output.with_suffix(".metadata.json").exists()
