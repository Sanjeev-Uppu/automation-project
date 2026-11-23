"""Authenticated ticket bookmark endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import (
    get_current_user,
    get_db_session,
    require_csrf,
)
from app.models.ticket import Ticket
from app.models.ticket_bookmark import TicketBookmark
from app.models.user import User


router = APIRouter(prefix="/bookmarks", tags=["Bookmarks"])


def ticket_to_dict(ticket: Ticket) -> dict:
    return {
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
        "jira_created_at": (
            ticket.jira_created_at.isoformat()
            if ticket.jira_created_at
            else None
        ),
        "jira_updated_at": (
            ticket.jira_updated_at.isoformat()
            if ticket.jira_updated_at
            else None
        ),
    }


@router.get("")
async def get_bookmarks(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    statement = (
        select(Ticket)
        .join(
            TicketBookmark,
            TicketBookmark.jira_issue_id == Ticket.jira_issue_id,
        )
        .where(TicketBookmark.user_id == current_user.id)
        .order_by(TicketBookmark.created_at.desc())
    )

    result = await db.execute(statement)
    tickets = result.scalars().all()

    return {
        "items": [ticket_to_dict(ticket) for ticket in tickets],
        "total": len(tickets),
    }


@router.post("/{jira_issue_id}", status_code=status.HTTP_201_CREATED)
async def add_bookmark(
    jira_issue_id: str,
    _: None = Depends(require_csrf),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    ticket_result = await db.execute(
        select(Ticket).where(Ticket.jira_issue_id == jira_issue_id)
    )
    ticket = ticket_result.scalar_one_or_none()

    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )

    statement = (
        insert(TicketBookmark)
        .values(
            user_id=current_user.id,
            jira_issue_id=jira_issue_id,
        )
        .on_conflict_do_nothing(
            constraint="uq_ticket_bookmarks_user_ticket"
        )
    )

    await db.execute(statement)
    await db.commit()

    return {
        "message": "Ticket bookmarked.",
        "jira_issue_id": jira_issue_id,
        "bookmarked": True,
    }


@router.delete("/{jira_issue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bookmark(
    jira_issue_id: str,
    _: None = Depends(require_csrf),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TicketBookmark).where(
            TicketBookmark.user_id == current_user.id,
            TicketBookmark.jira_issue_id == jira_issue_id,
        )
    )

    bookmark = result.scalar_one_or_none()

    if bookmark is not None:
        await db.delete(bookmark)
        await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)