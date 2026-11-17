
"""Convert raw Jira issue JSON into our schemas. Missing data stays None."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas.models import Issue, NamedRef, Person, StatusRef
from app.services.description import extract_description_text


def parse_jira_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None

    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(value, fmt).astimezone(timezone.utc)
        except ValueError:
            continue

    return None


def _person(raw: Any) -> Person | None:
    if not isinstance(raw, dict):
        return None

    name = raw.get("displayName") or raw.get("emailAddress")
    if not name:
        return None

    return Person(
        account_id=raw.get("accountId"),
        display_name=str(name),
    )


def _named(raw: Any) -> NamedRef | None:
    if not isinstance(raw, dict) or not raw.get("name"):
        return None

    return NamedRef(
        id=str(raw["id"]) if raw.get("id") is not None else None,
        name=raw["name"],
    )


def _status(raw: Any) -> StatusRef | None:
    if not isinstance(raw, dict) or not raw.get("name"):
        return None

    category = raw.get("statusCategory") or {}

    return StatusRef(
        id=str(raw["id"]) if raw.get("id") is not None else None,
        name=raw["name"],
        category=category.get("key"),
    )


def normalize_issue(raw: dict[str, Any], base_url: str) -> Issue:
    fields = raw.get("fields") or {}
    key = raw["key"]

    return Issue(
        id=str(raw.get("id", key)),
        key=key,
        url=f"{base_url}/browse/{key}",
        summary=fields.get("summary"),
        description=extract_description_text(fields.get("description")),
        status=_status(fields.get("status")),
        assignee=_person(fields.get("assignee")),
        reporter=_person(fields.get("reporter")),
        creator=_person(fields.get("creator")),
        issue_type=_named(fields.get("issuetype")),
        priority=_named(fields.get("priority")),
        created=parse_jira_datetime(fields.get("created")),
        updated=parse_jira_datetime(fields.get("updated")),
    )
