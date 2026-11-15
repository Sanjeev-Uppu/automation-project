
"""Persistent Jira ticket index."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Ticket(Base):
    __tablename__ = "tickets"

    __table_args__ = (
        CheckConstraint(
            "category IN ('manual', 'automation')",
            name="ck_tickets_category",
        ),
        Index(
            "ix_tickets_category_created",
            "category",
            "jira_created_at",
        ),
        Index(
            "ix_tickets_project_category",
            "project_key",
            "category",
        ),
        Index(
            "ix_tickets_category_status",
            "category",
            "status",
        ),
        Index(
            "ix_tickets_category_priority",
            "category",
            "priority",
        ),
    )

    # Jira's issue ID is the stable primary identifier.
    jira_issue_id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
    )

    jira_key: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
    )

    project_key: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
    )

    jira_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    summary: Mapped[str | None] = mapped_column(Text)

    description: Mapped[str | None] = mapped_column(Text)

    category: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    status: Mapped[str | None] = mapped_column(String(255))

    priority: Mapped[str | None] = mapped_column(String(255))

    issue_type: Mapped[str | None] = mapped_column(String(255))

    assignee_id: Mapped[str | None] = mapped_column(String(255))

    assignee_name: Mapped[str | None] = mapped_column(String(255))

    reporter_id: Mapped[str | None] = mapped_column(String(255))

    reporter_name: Mapped[str | None] = mapped_column(String(255))

    jira_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
    )

    jira_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
    )

    indexed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
