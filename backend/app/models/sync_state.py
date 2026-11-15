
"""Tracks Jira project synchronization progress."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SyncState(Base):
    __tablename__ = "sync_states"

    project_key: Mapped[str] = mapped_column(
        String(32),
        primary_key=True,
    )

    sync_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
    )

    last_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
    )

    last_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
    )

    last_error: Mapped[str | None] = mapped_column(Text)

    total_indexed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
