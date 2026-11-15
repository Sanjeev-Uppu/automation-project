
"""Database-backed Testing Dashboard queries."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal

from sqlalchemy import func, or_, select

from app.core.database import Database
from app.models.sync_state import SyncState
from app.models.ticket import Ticket


class TestingDashboardService:
    """Read Manual and Automation tickets from PostgreSQL."""

    def __init__(self, database: Database):
        self.database = database

    async def get_tickets(
        self,
        category: Literal["manual", "automation"],
        *,
        search: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        created_after: date | None = None,
        created_before: date | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """Return filtered tickets with database pagination."""

        filters = [Ticket.category == category]

        if search:
            term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Ticket.jira_key.ilike(term),
                    Ticket.summary.ilike(term),
                )
            )

        if status:
            filters.append(Ticket.status == status)

        if priority:
            filters.append(Ticket.priority == priority)

        if created_after:
            start = datetime.combine(
                created_after,
                time.min,
                tzinfo=timezone.utc,
            )
            filters.append(Ticket.jira_created_at >= start)

        if created_before:
            end = datetime.combine(
                created_before + timedelta(days=1),
                time.min,
                tzinfo=timezone.utc,
            )
            filters.append(Ticket.jira_created_at < end)

        async with self.database.session_factory() as session:
            count_statement = (
                select(func.count())
                .select_from(Ticket)
                .where(*filters)
            )

            total = await session.scalar(count_statement)
            total = total or 0

            offset = (page - 1) * page_size

            statement = (
                select(Ticket)
                .where(*filters)
                .order_by(
                    Ticket.jira_created_at.desc().nullslast(),
                    Ticket.jira_key.asc(),
                )
                .offset(offset)
                .limit(page_size)
            )

            result = await session.execute(statement)
            tickets = result.scalars().all()

        total_pages = (
            (total + page_size - 1) // page_size
            if total
            else 0
        )

        return {
            "category": category,
            "items": [
                {
                    "jira_issue_id": ticket.jira_issue_id,
                    "jira_key": ticket.jira_key,
                    "project_key": ticket.project_key,
                    "jira_url": ticket.jira_url,
                    "summary": ticket.summary,
                    "description": ticket.description,
                    "category": ticket.category,
                    "status": ticket.status,
                    "priority": ticket.priority,
                    "issue_type": ticket.issue_type,
                    "assignee_id": ticket.assignee_id,
                    "assignee_name": ticket.assignee_name,
                    "reporter_id": ticket.reporter_id,
                    "reporter_name": ticket.reporter_name,
                    "jira_created_at": ticket.jira_created_at,
                    "jira_updated_at": ticket.jira_updated_at,
                }
                for ticket in tickets
            ],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1 and total > 0,
            },
        }

    async def get_summary(self) -> dict[str, Any]:
        """Return Manual and Automation ticket counts."""

        async with self.database.session_factory() as session:
            statement = (
                select(
                    Ticket.category,
                    func.count(Ticket.jira_issue_id),
                )
                .group_by(Ticket.category)
            )

            result = await session.execute(statement)
            counts = {
                category: count
                for category, count in result.all()
            }

        manual = counts.get("manual", 0)
        automation = counts.get("automation", 0)

        return {
            "manual": manual,
            "automation": automation,
            "total": manual + automation,
        }

    async def get_sync_status(self) -> dict[str, Any]:
        """Return synchronization status for all indexed projects."""

        async with self.database.session_factory() as session:
            statement = (
                select(SyncState)
                .order_by(SyncState.project_key.asc())
            )

            result = await session.execute(statement)
            states = result.scalars().all()

        return {
            "projects": [
                {
                    "project_key": state.project_key,
                    "status": state.sync_status,
                    "total_indexed": state.total_indexed,
                    "last_started_at": state.last_started_at,
                    "last_completed_at": state.last_completed_at,
                    "last_error": state.last_error,
                    "updated_at": state.updated_at,
                }
                for state in states
            ]
        }
