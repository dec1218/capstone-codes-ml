import asyncio
from datetime import date, datetime
from pathlib import Path

import app.db as db_module
from app.config import Settings
from app.db import SupabaseGateway


class FakeResponse:
    def raise_for_status(self) -> None:
        return None


class FakeClient:
    def __init__(self, requests: list[dict]) -> None:
        self.requests = requests

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args) -> None:
        return None

    async def post(self, url: str, **kwargs) -> FakeResponse:
        self.requests.append({"url": url, **kwargs})
        return FakeResponse()


def test_prediction_upsert_refreshes_predicted_at(monkeypatch) -> None:
    requests: list[dict] = []
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="publishable",
        supabase_service_role_key="service-role",
        frontend_origin="http://localhost:5173",
        model_path=Path("model.joblib"),
        allow_fixture_model=False,
    )
    monkeypatch.setattr(db_module.httpx, "AsyncClient", lambda **_kwargs: FakeClient(requests))

    asyncio.run(SupabaseGateway(settings).store_predictions(
        [{"appointment_id": "appointment", "probability": 0.8, "result": "No-Show"}],
        {"id": "staff", "full_name": "Test Staff"},
        "rf-real-pilot-colab-v1",
        date(2026, 10, 30),
    ))

    prediction_request = requests[0]
    payload = prediction_request["json"][0]
    assert prediction_request["url"].endswith("predictions?on_conflict=appointment_id")
    assert datetime.fromisoformat(payload["predicted_at"]).tzinfo is not None
    assert payload["model_version"] == "rf-real-pilot-colab-v1"
