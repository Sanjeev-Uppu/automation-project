"""Safe JQL construction. Every user supplied value is validated or quoted."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from app.core.errors import InvalidParameter

UNASSIGNED = "__unassigned__"
ISSUE_KEY_RE = re.compile(r"^[A-Z][A-Z0-9_]+-\d+$")
ACCOUNT_ID_RE = re.compile(r"^[A-Za-z0-9:_\-]{1,128}$")
_FULL_KEY_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]+-\d+$")
_DIGITS_RE = re.compile(r"^\d+$")
_NON_WORD = re.compile(r"[^\w\s]", re.UNICODE)
MAX_VALUE_LENGTH = 255


@dataclass(frozen=True)
class IssueFilters:
    status: str | None = None
    search: str | None = None
    assignee: str | None = None
    issue_type: str | None = None
    priority: str | None = None
    created_after: date | None = None
    created_before: date | None = None
    updated_after: date | None = None
    updated_before: date | None = None
    sort_by: Literal["created", "updated"] = "created"
    sort_order: Literal["asc", "desc"] = "desc"


def quote(value: str) -> str:
    """Return ``value`` as a safely quoted JQL string literal."""
    if len(value) > MAX_VALUE_LENGTH:
        raise InvalidParameter("A filter value is too long.")
    if any(ord(ch) < 32 for ch in value):
        raise InvalidParameter("Filter values must not contain control characters.")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _search_clause(project_key: str, search: str) -> str:
    text = search.strip()
    parts: list[str] = []
    if _FULL_KEY_RE.match(text):
        parts.append(f"key = {quote(text.upper())}")
    elif _DIGITS_RE.match(text):
        parts.append(f"key = {quote(f'{project_key}-{text}')}")
    tokens = [t for t in _NON_WORD.sub(" ", text).split() if t]
    if tokens:
        parts.append(" AND ".join(f"summary ~ {quote(t + '*')}" for t in tokens))
        if len(parts) == 2:
            parts[1] = f"({parts[1]})"
    if not parts:
        raise InvalidParameter("Search text must contain letters or numbers.")
    return "(" + " OR ".join(parts) + ")" if len(parts) > 1 else parts[0]


def build_jql(project_key: str, f: IssueFilters, *, order: bool = True) -> str:
    clauses = [f"project = {quote(project_key)}"]
    if f.status:
        clauses.append(f"status = {quote(f.status)}")
    if f.issue_type:
        clauses.append(f"issuetype = {quote(f.issue_type)}")
    if f.priority:
        clauses.append(f"priority = {quote(f.priority)}")
    if f.assignee:
        if f.assignee == UNASSIGNED:
            clauses.append("assignee is EMPTY")
        elif ACCOUNT_ID_RE.match(f.assignee):
            clauses.append(f"assignee = {quote(f.assignee)}")
        else:
            raise InvalidParameter("assignee must be a Jira account id.")
    if f.search and f.search.strip():
        clauses.append(_search_clause(project_key, f.search))
    for field_name, after, before in (
        ("created", f.created_after, f.created_before),
        ("updated", f.updated_after, f.updated_before),
    ):
        if after:
            clauses.append(f'{field_name} >= "{after.isoformat()}"')
        if before:  # inclusive of the whole "before" day
            clauses.append(f'{field_name} < "{(before + timedelta(days=1)).isoformat()}"')
    jql = " AND ".join(clauses)
    if order:
        direction = "ASC" if f.sort_order == "asc" else "DESC"
        jql += f" ORDER BY {f.sort_by} {direction}, key {direction}"
    return jql

def build_testing_dashboard_jql(
    project_keys: list[str],
    filters: IssueFilters,
    category: Literal["manual", "automation"],
) -> str:
    """
    Build a Jira query for Manual or Automation tickets
    across the accessible projects.
    """
    if not project_keys:
        raise InvalidParameter("No accessible Jira projects were found.")

    if category not in ("manual", "automation"):
        raise InvalidParameter("Category must be manual or automation.")

    # Validate and quote project keys.
    validated_keys = []
    for key in project_keys:
        normalized = key.strip().upper()
        if not re.fullmatch(r"[A-Z][A-Z0-9_]+", normalized):
            raise InvalidParameter("An invalid Jira project key was found.")
        validated_keys.append(quote(normalized))

    clauses = [
        f"project in ({', '.join(validated_keys)})"
    ]

    # Category classification is performed by Jira's description index.
    if category == "automation":
        clauses.append('description ~ "automation"')
    else:
        clauses.append(
            '(description is EMPTY OR description !~ "automation")'
        )

    if filters.status:
        clauses.append(f"status = {quote(filters.status)}")

    if filters.issue_type:
        clauses.append(f"issuetype = {quote(filters.issue_type)}")

    if filters.priority:
        clauses.append(f"priority = {quote(filters.priority)}")

    if filters.assignee:
        if filters.assignee == UNASSIGNED:
            clauses.append("assignee is EMPTY")
        elif ACCOUNT_ID_RE.fullmatch(filters.assignee):
            clauses.append(f"assignee = {quote(filters.assignee)}")
        else:
            raise InvalidParameter("assignee must be a Jira account id.")

    if filters.search and filters.search.strip():
        # Existing search helper requires a project key for numeric searches.
        # Use a shared summary/key search for cross-project queries.
        text = filters.search.strip()
        if len(text) > MAX_VALUE_LENGTH:
            raise InvalidParameter("A filter value is too long.")

        if any(ord(ch) < 32 for ch in text):
            raise InvalidParameter("Filter values must not contain control characters.")

        tokens = [
            token
            for token in _NON_WORD.sub(" ", text).split()
            if token
        ]
        if not tokens:
            raise InvalidParameter("Search text must contain letters or numbers.")

        clauses.append(
            "(" + " AND ".join(
                f"summary ~ {quote(token + '*')}" for token in tokens
            ) + ")"
        )

    for field_name, after, before in (
        ("created", filters.created_after, filters.created_before),
        ("updated", filters.updated_after, filters.updated_before),
    ):
        if after:
            clauses.append(f'{field_name} >= "{after.isoformat()}"')
        if before:
            clauses.append(
                f'{field_name} < "{(before + timedelta(days=1)).isoformat()}"'
            )

    direction = "ASC" if filters.sort_order == "asc" else "DESC"
    clauses.append(
        f"ORDER BY {filters.sort_by} {direction}, key {direction}"
    )

    return " AND ".join(clauses)
