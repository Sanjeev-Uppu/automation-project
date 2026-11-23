
"""FastAPI application factory."""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.api.bookmark_routes import router as bookmark_router
from app.core.cache import TTLCache
from app.core.config import Settings, get_settings
from app.core.database import Database
from app.core.errors import AppError
from app.core.logging import configure_logging
from app.integrations.jira_client import JiraClient
from app.schemas.models import ErrorBody, ErrorResponse
from app.services.jira_service import JiraService
from app.services.ticket_sync_service import TicketSyncService
from app.services.testing_dashboard_service import TestingDashboardService
from app.routes.auth_routes import router as auth_router

logger = logging.getLogger("app")


def _error(
    status: int,
    code: str,
    message: str,
    hint: str | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorBody(
            code=code,
            message=message,
            hint=hint,
        )
    )

    return JSONResponse(
        status_code=status,
        content=body.model_dump(mode="json"),
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.is_production)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        client = JiraClient(settings)
        database = None

        app.state.client = client

        app.state.service = JiraService(
            settings,
            client,
            TTLCache(settings.cache_ttl_seconds),
        )

        try:
            # Initialize PostgreSQL when DATABASE_URL is configured.
            if settings.database_url:
                database = Database(settings.database_url)
                app.state.database = database

                logger.info(
                    "PostgreSQL database pool initialized."
                )
            else:
                app.state.database = None

                logger.warning(
                    "DATABASE_URL is not configured. "
                    "Database features are unavailable."
                )

            # Initialize the Testing Dashboard services.
            app.state.ticket_sync_service = (
                TicketSyncService(client, database)
                if database is not None
                else None
            )

            app.state.testing_dashboard_service = (
                TestingDashboardService(database)
                if database is not None
                else None
            )

            if app.state.ticket_sync_service is not None:
                logger.info(
                    "Testing Dashboard sync service initialized."
                )

            # Check Jira configuration.
            problems = settings.config_problems()

            if problems:
                logger.warning(
                    "Jira is not configured: %s",
                    "; ".join(problems),
                )
            else:
                logger.info(
                    "Jira site %s, projects %s",
                    settings.jira_host,
                    ",".join(settings.jira_project_keys),
                )

            yield

        finally:
            # Close PostgreSQL connections before closing the application.
            if database is not None:
                await database.close()

                logger.info(
                    "PostgreSQL database pool closed."
                )

            await client.aclose()

    # Create the FastAPI application first.
    app = FastAPI(
        title="Team Automation – Jira Dashboard API",
        version=settings.version,
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    app.state.settings = settings

    # Configure CORS for frontend authentication cookies.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.frontend_origins),
        allow_credentials=True,
        allow_methods=[
            "GET",
            "POST",
            "DELETE",
            "OPTIONS",
        ],
        allow_headers=[
            "Accept",
            "Content-Type",
            "X-CSRF-Token",
        ],
        expose_headers=[
            "Content-Disposition",
            "X-Row-Count",
        ],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        started = time.perf_counter()
        request_id = uuid.uuid4().hex[:12]

        response = await call_next(request)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"

        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store"

        logger.info(
            "%s %s -> %s",
            request.method,
            request.url.path,
            response.status_code,
            extra={
                "ctx": {
                    "request_id": request_id,
                    "duration_ms": round(
                        (time.perf_counter() - started) * 1000
                    ),
                }
            },
        )

        return response

    @app.exception_handler(AppError)
    async def app_error_handler(
        _: Request,
        exc: AppError,
    ):
        return _error(
            exc.status_code,
            exc.code,
            exc.message,
            exc.hint,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        _: Request,
        exc: RequestValidationError,
    ):
        first = exc.errors()[0] if exc.errors() else {}

        where = ".".join(
            str(p)
            for p in first.get("loc", [])
            if p != "query"
        )

        return _error(
            422,
            "invalid_parameter",
            f"Invalid parameter '{where}': "
            f"{first.get('msg', 'invalid value')}.",
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(
        _: Request,
        exc: Exception,
    ):
        logger.exception("Unhandled error")

        return _error(
            500,
            "internal_error",
            "Something went wrong on the server.",
            "Check the backend logs for details.",
        )

    # Register existing Jira API routes.
    app.include_router(router, prefix="/api")

    # Register bookmark routes.
    app.include_router(
        bookmark_router,
        prefix="/api",
        tags=["Bookmarks"],
    )

    # Preserve the existing versioned API routes.
    app.include_router(
        router,
        prefix="/api/v1",
        include_in_schema=False,
    )

    # Register authentication routes AFTER creating the app.
    app.include_router(
        auth_router,
        prefix="/api",
    )

    return app


app = create_app()  # uvicorn app.main:app
