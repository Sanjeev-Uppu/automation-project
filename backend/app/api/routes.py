
"""HTTP routes for Jira and Testing Dashboards."""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
)
from fastapi.responses import JSONResponse, Response

from app.core.errors import InvalidParameter
from app.schemas.models import (
    DashboardResponse,
    HealthResponse,
    Issue,
    IssuePage,
    ProjectsResponse,
    ProjectSummary,
    ReadinessResponse,
    StatusesResponse,
    TestingDashboardSummary,
    TestingSyncStatusResponse,
    TestingTicketPage,
)
from app.services.jira_service import JiraService
from app.services.jql import IssueFilters
from app.services.testing_dashboard_service import TestingDashboardService


router = APIRouter()


# ---------------------------------------------------------------------------
# Service dependencies
# ---------------------------------------------------------------------------

def get_service(request: Request) -> JiraService:
    return request.app.state.service


def get_testing_dashboard_service(
    request: Request,
) -> TestingDashboardService:
    service = getattr(
        request.app.state,
        "testing_dashboard_service",
        None,
    )

    if service is None:
        raise HTTPException(
            status_code=503,
            detail="Testing Dashboard database is not configured.",
        )

    return service


# ---------------------------------------------------------------------------
# Common helpers
# ---------------------------------------------------------------------------

def _clean(value: str | None) -> str | None:
    value = value.strip() if value else None
    return value or None


def _date(name: str, value: str | None) -> date | None:
    if not value:
        return None

    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise InvalidParameter(
            f"{name} must be a date in YYYY-MM-DD format."
        ) from exc


# ---------------------------------------------------------------------------
# Existing Jira filters
# ---------------------------------------------------------------------------

def get_filters(
    status: str | None = Query(None, max_length=255),
    search: str | None = Query(None, max_length=200),
    assignee: str | None = Query(
        None,
        max_length=128,
        description="Jira account id or __unassigned__",
    ),
    issue_type: str | None = Query(None, max_length=255),
    priority: str | None = Query(None, max_length=255),
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
    updated_after: str | None = Query(None),
    updated_before: str | None = Query(None),
    sort_by: Literal["created", "updated"] = "created",
    sort_order: Literal["asc", "desc"] = "desc",
) -> IssueFilters:
    return IssueFilters(
        status=_clean(status),
        search=_clean(search),
        assignee=_clean(assignee),
        issue_type=_clean(issue_type),
        priority=_clean(priority),
        created_after=_date("created_after", created_after),
        created_before=_date("created_before", created_before),
        updated_after=_date("updated_after", updated_after),
        updated_before=_date("updated_before", updated_before),
        sort_by=sort_by,
        sort_order=sort_order,
    )


# ---------------------------------------------------------------------------
# Existing Jira endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness probe",
)
async def health(request: Request) -> HealthResponse:
    settings = request.app.state.settings

    return HealthResponse(
        status="ok",
        version=settings.version,
        environment=settings.app_env,
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness: tests the Jira connection",
)
async def ready(
    refresh: bool = False,
    service: JiraService = Depends(get_service),
):
    result = await service.check_connection(force=refresh)

    return JSONResponse(
        status_code=200 if result.status == "ready" else 503,
        content=result.model_dump(mode="json"),
    )


@router.get("/projects", response_model=ProjectsResponse)
async def projects(
    refresh: bool = False,
    service: JiraService = Depends(get_service),
):
    return await service.list_projects(force=refresh)


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(
    refresh: bool = False,
    service: JiraService = Depends(get_service),
):
    return await service.dashboard(force=refresh)


@router.get(
    "/projects/{project_key}/summary",
    response_model=ProjectSummary,
)
async def project_summary(
    project_key: str,
    refresh: bool = False,
    service: JiraService = Depends(get_service),
):
    return await service.project_summary(
        project_key,
        force=refresh,
    )


@router.get(
    "/projects/{project_key}/statuses",
    response_model=StatusesResponse,
)
async def project_statuses(
    project_key: str,
    refresh: bool = False,
    service: JiraService = Depends(get_service),
):
    return await service.project_statuses(
        project_key,
        force=refresh,
    )


@router.get(
    "/projects/{project_key}/issues",
    response_model=IssuePage,
)
async def project_issues(
    request: Request,
    project_key: str,
    filters: IssueFilters = Depends(get_filters),
    page: int = Query(1, ge=1, le=100000),
    page_size: int | None = Query(None, ge=1),
    refresh: bool = False,
    service: JiraService = Depends(get_service),
):
    settings = request.app.state.settings
    size = page_size or settings.default_page_size

    if size > settings.max_page_size:
        raise InvalidParameter(
            f"page_size must be at most {settings.max_page_size}."
        )

    return await service.list_issues(
        project_key,
        filters,
        page,
        size,
        force=refresh,
    )


@router.get(
    "/projects/{project_key}/issues/{issue_key}",
    response_model=Issue,
)
async def project_issue(
    project_key: str,
    issue_key: str,
    service: JiraService = Depends(get_service),
):
    return await service.get_issue(
        project_key,
        issue_key,
    )


@router.get(
    "/projects/{project_key}/export",
    summary="Export filtered issues as CSV",
)
async def export_issues(
    project_key: str,
    filters: IssueFilters = Depends(get_filters),
    service: JiraService = Depends(get_service),
):
    content, count = await service.export_csv(
        project_key,
        filters,
    )

    key = await service.require_project(project_key)

    return Response(
        content="\ufeff" + content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{key}-issues.csv"',
            "X-Row-Count": str(count),
        },
    )


# ---------------------------------------------------------------------------
# Testing Dashboard: ticket synchronization
# ---------------------------------------------------------------------------

@router.post(
    "/testing-dashboard/sync",
    summary="Synchronize Jira tickets into PostgreSQL",
)
async def sync_testing_dashboard(request: Request):
    sync_service = getattr(
        request.app.state,
        "ticket_sync_service",
        None,
    )

    if sync_service is None:
        raise HTTPException(
            status_code=503,
            detail="Testing Dashboard database is not configured.",
        )

    return await sync_service.sync_all_projects()


# ---------------------------------------------------------------------------
# Testing Dashboard: database-backed ticket filters
# ---------------------------------------------------------------------------

async def _get_testing_tickets(
    category: Literal["manual", "automation"],
    request: Request,
    search: str | None,
    status: str | None,
    priority: str | None,
    created_after: str | None,
    created_before: str | None,
    page: int,
    page_size: int | None,
    service: TestingDashboardService,
):
    settings = request.app.state.settings
    size = page_size or settings.default_page_size

    if size > settings.max_page_size:
        raise InvalidParameter(
            f"page_size must be at most {settings.max_page_size}."
        )

    return await service.get_tickets(
        category,
        search=_clean(search),
        status=_clean(status),
        priority=_clean(priority),
        created_after=_date("created_after", created_after),
        created_before=_date("created_before", created_before),
        page=page,
        page_size=size,
    )


@router.get(
    "/testing-dashboard/manual",
    response_model=TestingTicketPage,
    summary="Get Manual testing tickets",
)
async def get_manual_tickets(
    request: Request,
    search: str | None = Query(None, max_length=200),
    status: str | None = Query(None, max_length=255),
    priority: str | None = Query(None, max_length=255),
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
    page: int = Query(1, ge=1, le=100000),
    page_size: int | None = Query(None, ge=1),
    service: TestingDashboardService = Depends(
        get_testing_dashboard_service
    ),
):
    return await _get_testing_tickets(
        category="manual",
        request=request,
        search=search,
        status=status,
        priority=priority,
        created_after=created_after,
        created_before=created_before,
        page=page,
        page_size=page_size,
        service=service,
    )


@router.get(
    "/testing-dashboard/automation",
    response_model=TestingTicketPage,
    summary="Get Automation testing tickets",
)
async def get_automation_tickets(
    request: Request,
    search: str | None = Query(None, max_length=200),
    status: str | None = Query(None, max_length=255),
    priority: str | None = Query(None, max_length=255),
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
    page: int = Query(1, ge=1, le=100000),
    page_size: int | None = Query(None, ge=1),
    service: TestingDashboardService = Depends(
        get_testing_dashboard_service
    ),
):
    return await _get_testing_tickets(
        category="automation",
        request=request,
        search=search,
        status=status,
        priority=priority,
        created_after=created_after,
        created_before=created_before,
        page=page,
        page_size=page_size,
        service=service,
    )


# ---------------------------------------------------------------------------
# Testing Dashboard: summary and synchronization status
# ---------------------------------------------------------------------------

@router.get(
    "/testing-dashboard/summary",
    response_model=TestingDashboardSummary,
    summary="Get Manual and Automation ticket counts",
)
async def testing_dashboard_summary(
    service: TestingDashboardService = Depends(
        get_testing_dashboard_service
    ),
):
    return await service.get_summary()


@router.get(
    "/testing-dashboard/sync-status",
    response_model=TestingSyncStatusResponse,
    summary="Get Jira project synchronization status",
)
async def testing_dashboard_sync_status(
    service: TestingDashboardService = Depends(
        get_testing_dashboard_service
    ),
):
    return await service.get_sync_status()
