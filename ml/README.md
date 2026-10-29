# No-Show Prediction Service

FastAPI and scikit-learn service for Phase 6. The Google Colab artifact `rf-real-pilot-colab-v1` is configured locally after compatibility, feature-schema, frontend, and health verification. The synthetic prototype remains available for rollback and technical evidence.

## Safety Boundaries

- `SUPABASE_SERVICE_ROLE_KEY` belongs only in `ml/.env`; never place it in React, a `VITE_` variable, source control, documentation, or chat.
- Training is a local CLI operation, not an HTTP endpoint.
- Fixture models are blocked from serving live predictions unless `ALLOW_FIXTURE_MODEL=true` is explicitly enabled for isolated tests.
- Synthetic and real-pilot models are visibly disclosed and never control SMS eligibility.
- Prediction writes require a valid Supabase session for an active admin or staff profile.
- The SMS Edge Function, PhilSMS secrets, Vault, and cron schedule are independent and untouched.

## Environment

Python 3.12 and `ml/.venv` are installed. Scikit-learn is pinned to `1.5.2` for Windows Application Control compatibility.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Fill `ml/.env` directly. Do not share its contents. Before live writes, run `capstone2-ui/supabase/phase6-predictions-setup.sql` in Supabase SQL Editor. The frontend uses `VITE_ML_API_URL` only for the public API location; no server secret belongs in a `VITE_` variable.

## Generate Synthetic Development Data

```powershell
.\.venv\Scripts\python.exe -m training.generate_synthetic `
  --rows 500 `
  --seed 42 `
  --output training\data\synthetic-training-data.csv
```

The adjacent metadata JSON records provenance, assumptions, class/service distributions, and limitations. It is fully separate from `Buruun-datasets.xlsx`.

## Train the Synthetic Prototype

```powershell
.\.venv\Scripts\python.exe -m training.train `
  --data training\data\synthetic-training-data.csv `
  --output artifacts\no_show_model.joblib `
  --dataset-kind synthetic `
  --model-version rf-synthetic-prototype-v1
```

The current artifact is synthetic and not evidence of real-world accuracy. When verified real labels exist, use the same command with an approved anonymized CSV, `--dataset-kind real`, and a new model version.

## Run

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

- API docs: `http://127.0.0.1:8000/docs`
- Health: `GET http://127.0.0.1:8000/health`
- Generate tomorrow: authenticated `POST /predictions/run`
- Chosen date: authenticated `POST /predictions/run?appointment_date=YYYY-MM-DD`

The endpoint defaults to tomorrow in Asia/Manila and expects the existing Supabase access token as a Bearer token.

## Test

```powershell
.\.venv\Scripts\python.exe -m compileall -q app training tests
.\.venv\Scripts\python.exe -m pytest -q
```

Current result: **18 tests passed**. Tests and synthetic generation do not write to Supabase.
