"""Application errors. Messages are safe to show to end users."""
from __future__ import annotations


class AppError(Exception):
    status_code = 500
    code = "internal_error"

    def __init__(self, message: str, *, hint: str | None = None):
        super().__init__(message)
        self.message = message
        self.hint = hint


class JiraNotConfigured(AppError):
    status_code = 503
    code = "jira_not_configured"


class JiraAuthError(AppError):
    status_code = 502
    code = "jira_auth_failed"


class JiraForbidden(AppError):
    status_code = 502
    code = "jira_forbidden"


class JiraNotFound(AppError):
    status_code = 404
    code = "not_found"


class JiraBadRequest(AppError):
    status_code = 400
    code = "invalid_query"


class JiraRateLimited(AppError):
    status_code = 429
    code = "jira_rate_limited"


class JiraUnavailable(AppError):
    status_code = 502
    code = "jira_unavailable"


class ProjectNotConfigured(AppError):
    status_code = 404
    code = "project_not_configured"


class InvalidParameter(AppError):
    status_code = 422
    code = "invalid_parameter"
