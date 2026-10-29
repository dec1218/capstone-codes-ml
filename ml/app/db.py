from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime
from typing import Any
from urllib.parse import quote

import httpx

from app.config import Settings


class SupabaseGateway:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _require_config(self) -> None:
        if not self.settings.supabase_configured:
            raise RuntimeError("Supabase server credentials are not configured in ml/.env.")

    def _service_headers(self, prefer: str | None = None) -> dict[str, str]:
        headers = {
            "apikey": self.settings.supabase_service_role_key,
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    async def authenticate(self, access_token: str) -> dict[str, str]:
        self._require_config()
        async with httpx.AsyncClient(timeout=20) as client:
            user_response = await client.get(
                f"{self.settings.supabase_url}/auth/v1/user",
                headers={"apikey": self.settings.supabase_publishable_key, "Authorization": f"Bearer {access_token}"},
            )
            if user_response.status_code != 200:
                raise PermissionError("Invalid or expired Supabase session.")
            user_id = user_response.json().get("id")
            profile_response = await client.get(
                f"{self.settings.supabase_url}/rest/v1/profiles",
                params={"id": f"eq.{user_id}", "select": "id,full_name,role,status", "limit": "1"},
                headers=self._service_headers(),
            )
            profile_response.raise_for_status()
            profiles = profile_response.json()
        if not profiles or profiles[0].get("status") != "active" or profiles[0].get("role") not in {"admin", "staff"}:
            raise PermissionError("Only active health-center accounts may generate predictions.")
        return profiles[0]

    async def fetch_prediction_rows(self, appointment_date: date) -> list[dict[str, Any]]:
        self._require_config()
        select = "id,patient_id,appointment_date,appointment_time,created_at,patients!inner(age,gender),health_services!inner(name,duration_minutes)"
        async with httpx.AsyncClient(timeout=30) as client:
            appointments_response = await client.get(
                f"{self.settings.supabase_url}/rest/v1/appointments",
                params={"select": select, "appointment_date": f"eq.{appointment_date.isoformat()}", "status": "eq.Scheduled", "order": "appointment_time.asc", "limit": "100"},
                headers=self._service_headers(),
            )
            appointments_response.raise_for_status()
            appointments = appointments_response.json()
            patient_ids = sorted({row["patient_id"] for row in appointments})
            history: list[dict[str, Any]] = []
            if patient_ids:
                encoded_ids = quote(f"({','.join(patient_ids)})", safe="(),")
                history_response = await client.get(
                    f"{self.settings.supabase_url}/rest/v1/attendance?select=status,appointments!inner(patient_id,appointment_date)&appointments.patient_id=in.{encoded_ids}",
                    headers=self._service_headers(),
                )
                history_response.raise_for_status()
                history = history_response.json()

        history_by_patient: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in history:
            related = _relation(item.get("appointments"))
            if related:
                history_by_patient[related["patient_id"]].append({"status": item["status"], "date": related["appointment_date"]})

        rows: list[dict[str, Any]] = []
        for appointment in appointments:
            patient = _relation(appointment["patients"])
            service = _relation(appointment["health_services"])
            previous = [item for item in history_by_patient[appointment["patient_id"]] if item["date"] < appointment["appointment_date"]]
            no_shows = sum(item["status"] == "No-Show" for item in previous)
            rows.append({
                "appointment_id": appointment["id"],
                "appointment_date": appointment["appointment_date"],
                "appointment_time": appointment["appointment_time"],
                "created_at": appointment["created_at"],
                "age": patient["age"],
                "gender": patient["gender"],
                "service_name": service["name"],
                "duration_minutes": service["duration_minutes"],
                "prior_appointments": len(previous),
                "prior_no_show_rate": no_shows / len(previous) if previous else 0,
            })
        return rows

    async def store_predictions(
        self,
        predictions: list[dict[str, Any]],
        profile: dict[str, str],
        model_version: str,
        appointment_date: date,
        skipped: int = 0,
        skipped_services: list[str] | None = None,
    ) -> None:
        self._require_config()
        predicted_at = datetime.now(UTC).isoformat()
        payload = [{
            "appointment_id": item["appointment_id"],
            "probability": item["probability"],
            "result": item["result"],
            "model_version": model_version,
            "predicted_at": predicted_at,
        } for item in predictions]
        async with httpx.AsyncClient(timeout=30) as client:
            if payload:
                prediction_response = await client.post(
                    f"{self.settings.supabase_url}/rest/v1/predictions?on_conflict=appointment_id",
                    json=payload,
                    headers=self._service_headers("resolution=merge-duplicates,return=minimal"),
                )
                prediction_response.raise_for_status()
            activity_response = await client.post(
                f"{self.settings.supabase_url}/rest/v1/activity_logs",
                json={
                    "activity_type": "Staff Activity",
                    "actor_id": profile["id"],
                    "actor_name": profile["full_name"],
                    "action": "Prediction",
                    "module": "Predictions",
                    "description": f"Generated {len(payload)} no-show predictions and skipped {skipped} unsupported appointments for {appointment_date.isoformat()}.",
                    "metadata": {
                        "appointment_date": appointment_date.isoformat(),
                        "model_version": model_version,
                        "generated": len(payload),
                        "skipped": skipped,
                        "skipped_services": skipped_services or [],
                    },
                },
                headers=self._service_headers("return=minimal"),
            )
            activity_response.raise_for_status()


def _relation(value: Any) -> dict[str, Any] | None:
    if isinstance(value, list):
        return value[0] if value else None
    return value if isinstance(value, dict) else None
