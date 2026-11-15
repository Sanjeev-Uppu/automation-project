"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message: str
    hint: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class Person(BaseModel):
    account_id: str | None = None
    display_name: str


class StatusRef(BaseModel):
    id: str | None = None
    name: str
    category: str | None = None  # Jira status category key: new | indeterminate | done


class NamedRef(BaseModel):
    id: str | None = None
    name: str



class Issue(BaseModel):
    id: str
    key: str
    url: str
    summary: str | None = None
    description: str | None = None
    status: StatusRef | None = None
    assignee: Person | None = None
    reporter: Person | None = None
    issue_type: NamedRef | None = None
    priority: NamedRef | None = None
    created: datetime | None = None
    updated: datetime | None = None



class CacheMeta(BaseModel):
    fetched_at: datetime
    cached: bool
    ttl_seconds: int


class Pagination(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool


class IssuePage(BaseModel):
    items: list[Issue]
    pagination: Pagination
    jql: str
    meta: CacheMeta


class StatusCount(BaseModel):
    id: str | None = None
    name: str
    category: str | None = None
    category_name: str | None = None
    count: int


class FacetCount(BaseModel):
    id: str | None = None
    name: str
    count: int


class AssigneeFacet(BaseModel):
    account_id: str
    display_name: str
    count: int


class ProjectSummary(BaseModel):
    key: str
    name: str
    url: str
    total: int
    statuses: list[StatusCount]
    issue_types: list[FacetCount]
    priorities: list[FacetCount]
    assignees: list[AssigneeFacet]
    unassigned: int
    meta: CacheMeta


class StatusesResponse(BaseModel):
    project_key: str
    statuses: list[StatusCount]
    meta: CacheMeta


class ProjectInfo(BaseModel):
    key: str
    name: str | None = None
    url: str
    ok: bool
    error: ErrorBody | None = None


class ProjectsResponse(BaseModel):
    jira_site: str
    projects: list[ProjectInfo]


class DashboardProject(BaseModel):
    key: str
    url: str
    ok: bool
    summary: ProjectSummary | None = None
    error: ErrorBody | None = None


class DashboardResponse(BaseModel):
    jira_site: str
    projects: list[DashboardProject]
    synced_at: datetime | None = None  # oldest fetched_at among successful projects
    cached: bool = False


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    environment: str


class JiraConnection(BaseModel):
    connected: bool
    site: str | None = None
    account: str | None = None
    checked_at: datetime
    error: ErrorBody | None = None


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    jira: JiraConnection

class TestingDashboardCategory(BaseModel):
    category: Literal["manual", "automation"]
    total: int


class TestingDashboardResponse(BaseModel):
    jira_site: str
    category: Literal["manual", "automation"]
    items: list[Issue]
    pagination: Pagination
    jql: str
    meta: CacheMeta


class TestingTicketItem(BaseModel):
    jira_issue_id: str
    jira_key: str
    project_key: str
    jira_url: str
    summary: str | None = None
    description: str | None = None
    category: Literal["manual", "automation"]
    status: str | None = None
    priority: str | None = None
    issue_type: str | None = None
    assignee_id: str | None = None
    assignee_name: str | None = None
    reporter_id: str | None = None
    reporter_name: str | None = None
    jira_created_at: datetime | None = None
    jira_updated_at: datetime | None = None


class TestingTicketPage(BaseModel):
    category: Literal["manual", "automation"]
    items: list[TestingTicketItem]
    pagination: Pagination


class TestingDashboardSummary(BaseModel):
    manual: int
    automation: int
    total: int


class TestingProjectSyncStatus(BaseModel):
    project_key: str
    status: str
    total_indexed: int
    last_started_at: datetime | None = None
    last_completed_at: datetime | None = None
    last_error: str | None = None
    updated_at: datetime | None = None


class TestingSyncStatusResponse(BaseModel):
    projects: list[TestingProjectSyncStatus]
