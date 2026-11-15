"""Structured logging. Never log credentials or Authorization headers."""
from __future__ import annotations

import json
import logging
import logging.config
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        extra = getattr(record, "ctx", None)
        if isinstance(extra, dict):
            payload.update(extra)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str, production: bool) -> None:
    formatter = (
        {"()": JsonFormatter}
        if production
        else {"format": "%(asctime)s %(levelname)-7s %(name)s: %(message)s"}
    )
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {"default": formatter},
            "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "default"}},
            "root": {"level": level, "handlers": ["console"]},
            # httpx logs full request URLs at INFO; keep it quiet.
            "loggers": {"httpx": {"level": "WARNING"}, "httpcore": {"level": "WARNING"}},
        }
    )
