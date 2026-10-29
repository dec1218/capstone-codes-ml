import asyncio

import httpx

from app.main import active_profile, app, gateway, model_service


async def request(method: str, path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path)


def test_health_is_available_without_secrets() -> None:
    response = asyncio.run(request("GET", "/health"))
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_prediction_run_requires_supabase_session() -> None:
    response = asyncio.run(request("POST", "/predictions/run"))
    assert response.status_code == 401


def test_prediction_run_reports_skipped_services(monkeypatch) -> None:
    supported = {
        "appointment_id": "supported",
        "service_name": "Immunization",
    }
    skipped = {
        "appointment_id": "skipped",
        "service_name": "Dental",
    }
    stored = {}

    async def profile() -> dict[str, str]:
        return {"id": "staff", "full_name": "Test Staff", "role": "staff", "status": "active"}

    async def fetch_rows(_appointment_date):
        return [supported, skipped]

    async def store_predictions(predictions, profile, model_version, appointment_date, skipped_count=0, skipped_services=None):
        stored.update({
            "predictions": predictions,
            "profile": profile,
            "model_version": model_version,
            "appointment_date": appointment_date,
            "skipped": skipped_count,
            "skipped_services": skipped_services,
        })

    monkeypatch.setattr(gateway, "fetch_prediction_rows", fetch_rows)
    monkeypatch.setattr(gateway, "store_predictions", store_predictions)
    monkeypatch.setattr(model_service, "partition_supported", lambda rows: ([supported], [skipped]))
    monkeypatch.setattr(model_service, "predict", lambda rows: [0.8])
    monkeypatch.setattr(type(model_service), "metadata", property(lambda _self: {
        "model_version": "rf-real-pilot-colab-v1",
        "decision_threshold": 0.5,
        "risk_thresholds": {"moderate": 0.4, "high": 0.7},
    }))
    app.dependency_overrides[active_profile] = profile
    try:
        response = asyncio.run(request("POST", "/predictions/run?appointment_date=2026-10-30"))
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["generated"] == 1
    assert body["skipped"] == 1
    assert body["skipped_services"] == ["Dental"]
    assert stored["skipped"] == 1
    assert stored["skipped_services"] == ["Dental"]
