"""Per-user Jira ticket bookmarks."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TicketBookmark(Base):
    __tablename__ = "ticket_bookmarks"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "jira_issue_id",
            name="uq_ticket_bookmarks_user_ticket",
        ),
        Index("ix_ticket_bookmarks_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    jira_issue_id: Mapped[str] = mapped_column(
        ForeignKey("tickets.jira_issue_id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )