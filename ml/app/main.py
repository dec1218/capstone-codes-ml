from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import get_settings
from app.db import SupabaseGateway
from app.model import ModelService, ModelUnavailableError


settings = get_settings()
gateway = SupabaseGateway(settings)
model_service = ModelService(settings.model_path, settings.allow_fixture_model)
app = FastAPI(title="Smart Queue No-Show Prediction API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class PredictionItem(BaseModel):
    appointment_id: str
    probability: float
    result: str
    risk_level: str


class PredictionRun(BaseModel):
    appointment_date: date
    model_version: str
    generated: int
    skipped: int
    skipped_services: list[str]
    predictions: list[PredictionItem]


async def active_profile(authorization: Annotated[str | None, Header()] = None) -> dict[str, str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="A Supabase Bearer session is required.")
    try:
        return await gateway.authenticate(authorization.split(" ", 1)[1].strip())
    except PermissionError as reason:
        raise HTTPException(status_code=401, detail=str(reason)) from reason
    except Exception as reason:
        raise HTTPException(status_code=503, detail=str(reason)) from reason


@app.get("/health")
def health() -> dict[str, object]:
    model_error = None
    if settings.model_path.exists() and not model_service.loaded:
        try:
            model_service.load()
        except ModelUnavailableError as reason:
            model_error = str(reason)
    metadata = model_service.metadata
    return {
        "status": "degraded" if model_error else "ok",
        "supabase_configured": settings.supabase_configured,
        "model_available": settings.model_path.exists(),
        "model_loaded": model_service.loaded,
        "model_version": metadata.get("model_version"),
        "dataset_kind": metadata.get("dataset_kind"),
        "model_error": model_error,
    }


@app.post("/predictions/run", response_model=PredictionRun)
async def run_predictions(
    profile: Annotated[dict[str, str], Depends(active_profile)],
    appointment_date: Annotated[date | None, Query()] = None,
) -> PredictionRun:
    target_date = appointment_date or (datetime.now(ZoneInfo("Asia/Manila")).date() + timedelta(days=1))
    try:
        rows = await gateway.fetch_prediction_rows(target_date)
        supported_rows, skipped_rows = model_service.partition_supported(rows)
        probabilities = model_service.predict(supported_rows) if supported_rows else []
    except ModelUnavailableError as reason:
        raise HTTPException(status_code=503, detail=str(reason)) from reason
    except Exception as reason:
        raise HTTPException(status_code=502, detail=f"Prediction run failed: {reason}") from reason

    predictions = []
    decision_threshold = float(model_service.metadata.get("decision_threshold", 0.5))
    risk_thresholds = model_service.metadata.get("risk_thresholds", {"moderate": 0.4, "high": 0.7})
    moderate_threshold = float(risk_thresholds.get("moderate", 0.4))
    high_threshold = float(risk_thresholds.get("high", 0.7))
    for row, probability in zip(supported_rows, probabilities, strict=True):
        predictions.append({
            "appointment_id": row["appointment_id"],
            "probability": probability,
            "result": "No-Show" if probability >= decision_threshold else "Show",
            "risk_level": "High" if probability >= high_threshold else "Moderate" if probability >= moderate_threshold else "Low",
        })
    model_version = str(model_service.metadata.get("model_version", "unknown"))
    skipped_services = sorted({str(row["service_name"]) for row in skipped_rows})
    await gateway.store_predictions(predictions, profile, model_version, target_date, len(skipped_rows), skipped_services)
    return PredictionRun(
        appointment_date=target_date,
        model_version=model_version,
        generated=len(predictions),
        skipped=len(skipped_rows),
        skipped_services=skipped_services,
        predictions=predictions,
    )
