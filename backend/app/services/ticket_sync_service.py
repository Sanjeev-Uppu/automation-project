
"""Synchronize accessible Jira projects into the PostgreSQL ticket index."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func
from sqlalchemy.dialects.postgresql import insert

from app.core.database import Database
from app.integrations.jira_client import JiraClient
from app.models.sync_state import SyncState
from app.models.ticket import Ticket
from app.services.normalizer import normalize_issue
from app.services.ticket_classifier import classify_ticket

logger = logging.getLogger(__name__)

BATCH_SIZE = 250

ISSUE_FIELDS = (
    "summary,description,status,assignee,reporter,"
    "issuetype,priority,created,updated"
)


class ProjectSyncError(Exception):
    """A project sync failed after possibly indexing some tickets."""

    def __init__(self, message: str, indexed: int) -> None:
        super().__init__(message)
        self.indexed = indexed


class TicketSyncService:
    """Fetch Jira tickets and maintain their PostgreSQL index."""

    def __init__(
        self,
        client: JiraClient,
        database: Database,
        batch_size: int = BATCH_SIZE,
    ) -> None:
        self.client = client
        self.database = database
        self.batch_size = max(1, batch_size)
        self._sync_lock = asyncio.Lock()

    async def sync_all_projects(self) -> dict[str, Any]:
        """Synchronize every project accessible to the Jira account."""

        async with self._sync_lock:
            projects = await self.client.list_projects()

            results: list[dict[str, Any]] = []

            for project in projects:
                project_key = str(project.get("key") or "").strip().upper()

                if not project_key:
                    continue

                try:
                    count = await self._sync_project(project_key)

                    results.append({
                        "project_key": project_key,
                        "status": "completed",
                        "indexed": count,
                    })

                except ProjectSyncError as exc:
                    logger.exception(
                        "Ticket synchronization failed for project %s",
                        project_key,
                    )

                    results.append({
                        "project_key": project_key,
                        "status": "failed",
                        "indexed": exc.indexed,
                        "error": str(exc)[:1000],
                    })

                except Exception as exc:
                    logger.exception(
                        "Ticket synchronization failed for project %s",
                        project_key,
                    )

                    results.append({
                        "project_key": project_key,
                        "status": "failed",
                        "indexed": 0,
                        "error": str(exc)[:1000],
                    })

            completed = sum(
                item["status"] == "completed" for item in results
            )
            failed = sum(
                item["status"] == "failed" for item in results
            )

            return {
                "status": "completed" if failed == 0 else "partial",
                "projects_found": len(results),
                "projects_completed": completed,
                "projects_failed": failed,
                "total_indexed": sum(
                    item["indexed"] for item in results
                ),
                "results": results,
            }

    async def sync_project(self, project_key: str) -> int:
        """Synchronize one project without overlapping another sync."""

        async with self._sync_lock:
            return await self._sync_project(project_key)

    async def _sync_project(self, project_key: str) -> int:
        """Internal project sync. Caller must hold the sync lock."""

        project_key = project_key.strip().upper()

        if not project_key:
            raise ValueError("Project key cannot be empty.")

        indexed = 0
        run_started_at = datetime.now(timezone.utc)

        await self._set_sync_state(
            project_key,
            status="running",
            started=True,
            error=None,
            total=0,
        )

        try:
            batch: list[dict[str, Any]] = []

            async for raw_issue in self.client.iter_search(
                f'project = "{project_key}"',
                ISSUE_FIELDS,
                self.batch_size,
            ):
                values = self._ticket_values(raw_issue, project_key)

                if values is None:
                    continue

                batch.append(values)

                if len(batch) >= self.batch_size:
                    await self._save_batch(batch, run_started_at)
                    indexed += len(batch)
                    batch.clear()

                    await self._set_sync_state(
                        project_key,
                        status="running",
                        started=False,
                        error=None,
                        total=indexed,
                    )

            if batch:
                await self._save_batch(batch, run_started_at)
                indexed += len(batch)

            # Remove tickets no longer returned by Jira.
            # This runs ONLY after the entire Jira scan succeeds.
            await self._remove_stale_tickets(
                project_key,
                run_started_at,
            )

            await self._set_sync_state(
                project_key,
                status="completed",
                started=False,
                error=None,
                total=indexed,
                completed=True,
            )

            logger.info(
                "Project %s synchronization completed: %s tickets",
                project_key,
                indexed,
            )

            return indexed

        except Exception as exc:
            try:
                await self._set_sync_state(
                    project_key,
                    status="failed",
                    started=False,
                    error=str(exc)[:4000],
                    total=indexed,
                )
            except Exception:
                logger.exception(
                    "Could not update failed sync state for %s",
                    project_key,
                )

            raise ProjectSyncError(
                f"Project {project_key} synchronization failed: {exc}",
                indexed=indexed,
            ) from exc

    def _ticket_values(
        self,
        raw_issue: dict[str, Any],
        project_key: str,
    ) -> dict[str, Any] | None:
        """Normalize and classify one Jira issue."""

        if not raw_issue.get("key"):
            return None

        issue = normalize_issue(
            raw_issue,
            self.client.settings.jira_base_url,
        )

        category = classify_ticket(issue.description)

        assignee = issue.assignee
        reporter = issue.reporter
        status = issue.status
        priority = issue.priority
        issue_type = issue.issue_type

        return {
            "jira_issue_id": str(issue.id),
            "jira_key": issue.key,
            "project_key": project_key,
            "jira_url": issue.url,
            "summary": issue.summary,
            "description": issue.description,
            "category": category.value,
            "status": status.name if status else None,
            "priority": priority.name if priority else None,
            "issue_type": issue_type.name if issue_type else None,
            "assignee_id": assignee.account_id if assignee else None,
            "assignee_name": assignee.display_name if assignee else None,
            "reporter_id": reporter.account_id if reporter else None,
            "reporter_name": reporter.display_name if reporter else None,
            "jira_created_at": issue.created,
            "jira_updated_at": issue.updated,
        }

    async def _save_batch(
        self,
        batch: list[dict[str, Any]],
        indexed_at: datetime,
    ) -> None:
        """Insert or update a bounded batch of tickets."""

        if not batch:
            return

        values = [
            {**ticket, "indexed_at": indexed_at}
            for ticket in batch
        ]

        statement = insert(Ticket).values(values)

        update_columns = (
            "jira_key",
            "project_key",
            "jira_url",
            "summary",
            "description",
            "category",
            "status",
            "priority",
            "issue_type",
            "assignee_id",
            "assignee_name",
            "reporter_id",
            "reporter_name",
            "jira_created_at",
            "jira_updated_at",
            "indexed_at",
        )

        update_values = {
            column: getattr(statement.excluded, column)
            for column in update_columns
        }

        statement = statement.on_conflict_do_update(
            index_elements=[Ticket.jira_issue_id],
            set_=update_values,
        )

        async with self.database.session_factory() as session:
            async with session.begin():
                await session.execute(statement)

    async def _remove_stale_tickets(
        self,
        project_key: str,
        run_started_at: datetime,
    ) -> None:
        """Delete tickets not seen during a fully successful sync."""

        statement = delete(Ticket).where(
            Ticket.project_key == project_key,
            Ticket.indexed_at < run_started_at,
        )

        async with self.database.session_factory() as session:
            async with session.begin():
                await session.execute(statement)

    async def _set_sync_state(
        self,
        project_key: str,
        *,
        status: str,
        started: bool,
        error: str | None,
        total: int,
        completed: bool = False,
    ) -> None:
        """Create or update project synchronization state atomically."""

        now = datetime.now(timezone.utc)

        values = {
            "project_key": project_key,
            "sync_status": status,
            "last_started_at": now if started else None,
            "last_completed_at": now if completed else None,
            "last_error": error,
            "total_indexed": total,
            "updated_at": now,
        }

        statement = insert(SyncState).values(**values)

        update_values = {
            "sync_status": statement.excluded.sync_status,
            "last_error": statement.excluded.last_error,
            "total_indexed": statement.excluded.total_indexed,
            "updated_at": statement.excluded.updated_at,
        }

        if started:
            update_values["last_started_at"] = (
                statement.excluded.last_started_at
            )

        if completed:
            update_values["last_completed_at"] = (
                statement.excluded.last_completed_at
            )

        statement = statement.on_conflict_do_update(
            index_elements=[SyncState.project_key],
            set_=update_values,
        )

        async with self.database.session_factory() as session:
            async with session.begin():
                await session.execute(statement)
