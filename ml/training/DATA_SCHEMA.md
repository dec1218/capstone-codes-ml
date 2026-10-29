# Training Data Contract

Every training file must contain one appointment outcome per row. It must not contain patient names, contact numbers, addresses, check-in/out times, reminder outcomes, or prediction output.

## Current Real-Pilot Contract

The audited `datasets.xlsx` pilot is intentionally narrower than the full contract below because it does not contain a stable anonymous patient-history key or booking timestamp. Its Colab pipeline derives appointment hour, weekday, weekend indicator, duration, and age group, then trains on those fields plus gender and service. The exact cleaning, split, evaluation, and export rules are in [`../../docs/real-data-colab-workflow.md`](../../docs/real-data-colab-workflow.md).

The pilot must not fabricate booking lead time or prior attendance. The full contract remains the target for a later improved real-data model.

## Full Model Contract

## Excel Collection Workbook

[`../../No-Show-Dataset-Template.xlsx`](../../No-Show-Dataset-Template.xlsx) demonstrates the required collection and ML-ready formats. It contains a blank validated template, explicitly fictional examples, valid values, instructions, and a data dictionary. The example rows are for format demonstration only and must never be combined with real training data.

Regenerate the workbook after changing this contract with:

```powershell
.\.venv\Scripts\python.exe -m training.create_dataset_template
```

[`../../Health-Center-Data-Verification-Form.xlsx`](../../Health-Center-Data-Verification-Form.xlsx) is the print-ready clinic verification pack for approving the study period, Show extraction rules, and exact No-Show appointment mappings. Regenerate it after changing the source-image inventory with:

```powershell
.\.venv\Scripts\python.exe -m training.create_health_center_verification_form
```

| Column | Type | Meaning |
|---|---|---|
| `appointment_date` | `YYYY-MM-DD` | Scheduled service date |
| `appointment_time` | `HH:MM` | Scheduled service time |
| `created_at` | ISO timestamp | Time the appointment was created |
| `age` | Integer | Age available before the appointment |
| `gender` | Text | Recorded gender category |
| `service_name` | Text | Scheduled health service |
| `duration_minutes` | Integer | Expected service duration |
| `prior_appointments` | Integer | Count of this patient's earlier completed attendance outcomes |
| `prior_no_show_rate` | Decimal 0–1 | Earlier no-shows divided by earlier attendance outcomes |
| `label` | `0` or `1` | `1` for No-Show; `0` for Present or Late |

`prior_appointments` and `prior_no_show_rate` must use records strictly before that row's appointment date. This prevents future attendance information from leaking into training.

## Prohibited Inputs

- `attendance_status`, `check_in`, or `check_out`
- `result`, `probability`, or `risk_level`
- `sent_at` or any post-appointment reminder result
- Patient names, IDs, contact numbers, or addresses

## Dataset Policy

The dean requires real data for the official model. `datasets.xlsx` is the current anonymized real-data pilot source; the synthetic dataset remains technical-integration evidence only. Fixture artifacts cannot serve live predictions by default, and synthetic results must not be presented as real-world accuracy.

## Service Normalization

- `Pediatric / Immunization` maps to `Immunization`.
- `Maternal Care - Prenatal` maps to `Prenatal Care`.
- Dental is a canonical 30-minute service.
- `Dental Checkup` maps to `Dental`.
- Unknown or blank service names fail validation and must be reviewed rather than silently recoded.
