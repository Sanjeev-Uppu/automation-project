"""Application configuration, loaded from environment variables / backend/.env."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

PROJECT_KEY_RE = re.compile(r"^[A-Z][A-Z0-9_]{1,19}$")
BACKEND_DIR = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    jira_base_url: str = ""
    jira_email: str = ""
    jira_api_token: str = field(default="", repr=False)  # never printed
    jira_project_keys: tuple[str, ...] = ()
    app_env: str = "development"
    log_level: str = "INFO"
    frontend_origins: tuple[str, ...] = ("http://localhost:5173",)
    cache_ttl_seconds: int = 60
    jira_timeout_seconds: float = 20.0
    jira_max_retries: int = 3
    jira_retry_backoff_seconds: float = 0.5
    default_page_size: int = 25
    max_page_size: int = 100
    stats_page_size: int = 1000
    key_page_size: int = 1000
    detail_page_size: int = 100
    project_meta_ttl_seconds: int = 300
    version: str = "1.0.0"
    database_url: str = field(default="", repr=False)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def jira_host(self) -> str:
        return urlparse(self.jira_base_url).netloc

    def config_problems(self) -> list[str]:
        """Human readable list of what is wrong with the configuration."""
        problems: list[str] = []
        if not self.jira_base_url:
            problems.append("JIRA_BASE_URL is not set")
        else:
            parsed = urlparse(self.jira_base_url)
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                problems.append("JIRA_BASE_URL must look like https://your-company.atlassian.net")
            elif self.is_production and parsed.scheme != "https":
                problems.append("JIRA_BASE_URL must use https in production")
        if not self.jira_email:
            problems.append("JIRA_EMAIL is not set")
        elif "@" not in self.jira_email:
            problems.append("JIRA_EMAIL must be a valid email address")
        if not self.jira_api_token:
            problems.append("JIRA_API_TOKEN is not set")
        
        for key in self.jira_project_keys:
            if not PROJECT_KEY_RE.match(key):
                problems.append(f"'{key}' in JIRA_PROJECT_KEYS is not a valid Jira project key")
        return problems


def _csv(value: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in value.split(",") if part.strip())


def _int(name: str, default: int, minimum: int = 0) -> int:
    raw = os.getenv(name, "").strip()
    try:
        return max(minimum, int(raw)) if raw else default
    except ValueError:
        return default


def _float(name: str, default: float, minimum: float = 1.0) -> float:
    raw = os.getenv(name, "").strip()
    try:
        return max(minimum, float(raw)) if raw else default
    except ValueError:
        return default


def normalize_base_url(raw: str) -> str:
    """Reduce any pasted Jira URL (e.g. .../browse/TDF-1) to scheme://host."""
    raw = raw.strip()
    if raw and "://" not in raw:
        raw = "https://" + raw
    parsed = urlparse(raw)
    if not parsed.scheme or not parsed.netloc:
        return raw.rstrip("/")
    return f"{parsed.scheme}://{parsed.netloc}"


def load_settings() -> Settings:
    load_dotenv(BACKEND_DIR / ".env", override=False)
    return Settings(
        jira_base_url=normalize_base_url(os.getenv("JIRA_BASE_URL", "")),
        jira_email=os.getenv("JIRA_EMAIL", "").strip(),
        jira_api_token=os.getenv("JIRA_API_TOKEN", "").strip(),
      jira_project_keys=tuple(
    k.upper() for k in _csv(os.getenv("JIRA_PROJECT_KEYS", ""))
),
        app_env=os.getenv("APP_ENV", "development").strip().lower(),
        log_level=os.getenv("LOG_LEVEL", "INFO").strip().upper(),
        frontend_origins=_csv(os.getenv("FRONTEND_ORIGINS", "http://localhost:5173")),
        cache_ttl_seconds=_int("CACHE_TTL_SECONDS", 60),
        jira_timeout_seconds=_float("JIRA_TIMEOUT_SECONDS", 20.0),
        jira_max_retries=_int("JIRA_MAX_RETRIES", 3),
        default_page_size=_int("DEFAULT_PAGE_SIZE", 25, 1),
        max_page_size=_int("MAX_PAGE_SIZE", 100, 1),
        database_url=os.getenv("DATABASE_URL", "").strip(),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()
