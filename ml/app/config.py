from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _load_local_env() -> None:
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_publishable_key: str
    supabase_service_role_key: str
    frontend_origin: str
    model_path: Path
    allow_fixture_model: bool

    @property
    def supabase_configured(self) -> bool:
        return all((self.supabase_url, self.supabase_publishable_key, self.supabase_service_role_key))


def get_settings() -> Settings:
    _load_local_env()
    configured_path = Path(os.getenv("MODEL_PATH", "artifacts/no_show_model.joblib"))
    model_path = configured_path if configured_path.is_absolute() else PROJECT_ROOT / configured_path
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        supabase_publishable_key=os.getenv("SUPABASE_PUBLISHABLE_KEY", ""),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
        model_path=model_path,
        allow_fixture_model=os.getenv("ALLOW_FIXTURE_MODEL", "false").lower() == "true",
    )
