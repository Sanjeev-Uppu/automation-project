
"""Read-only Jira Cloud REST API v3 client.

Only GET requests are ever issued. Credentials live in the httpx client's auth
object and are never logged or returned.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import Settings
from app.core.errors import (
    AppError,
    JiraAuthError,
    JiraBadRequest,
    JiraForbidden,
    JiraNotConfigured,
    JiraNotFound,
    JiraRateLimited,
    JiraUnavailable,
)

logger = logging.getLogger(__name__)

RETRY_STATUSES = {429, 502, 503, 504}
MAX_RETRY_DELAY = 30.0


class JiraClient:
    def __init__(self, settings: Settings, http: httpx.AsyncClient | None = None):
        self.settings = settings
        self._http = http
        if self._http is None and not settings.config_problems():
            self._http = httpx.AsyncClient(
                base_url=settings.jira_base_url,
                auth=httpx.BasicAuth(settings.jira_email, settings.jira_api_token),
                headers={"Accept": "application/json"},
                timeout=httpx.Timeout(settings.jira_timeout_seconds, connect=10.0),
                follow_redirects=False,
            )

    async def aclose(self) -> None:
        if self._http is not None:
            await self._http.aclose()

    # ------------------------------------------------------------------ core
    def _require_http(self) -> httpx.AsyncClient:
        if self._http is None:
            problems = self.settings.config_problems()
            raise JiraNotConfigured(
                "Jira credentials are missing or invalid in the backend configuration: "
                + "; ".join(problems or ["unknown problem"])
                + ".",
                hint="Edit backend/.env (see backend/.env.example), then restart the backend.",
            )
        return self._http

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        http = self._require_http()
        retries = self.settings.jira_max_retries
        for attempt in range(retries + 1):
            last = attempt >= retries
            try:
                response = await http.get(path, params=params)
            except httpx.TimeoutException as exc:
                if last:
                    raise JiraUnavailable(
                        "Jira did not respond in time.",
                        hint="Try again, or increase JIRA_TIMEOUT_SECONDS.",
                    ) from exc
                await self._sleep(attempt, None)
                continue
            except httpx.TransportError as exc:
                if last:
                    raise JiraUnavailable(
                        f"Could not reach Jira at {self.settings.jira_host}.",
                        hint="Check JIRA_BASE_URL and your network connection.",
                    ) from exc
                await self._sleep(attempt, None)
                continue
            if response.status_code in RETRY_STATUSES and not last:
                await self._sleep(attempt, response.headers.get("Retry-After"))
                continue
            return self._handle(response)
        raise JiraUnavailable("Jira request failed.")  # pragma: no cover

    async def _sleep(self, attempt: int, retry_after: str | None) -> None:
        delay = self.settings.jira_retry_backoff_seconds * (2**attempt)
        if retry_after:
            try:
                delay = max(delay, float(retry_after))
            except ValueError:
                pass
        delay = min(delay, MAX_RETRY_DELAY)
        logger.warning("Jira request will be retried", extra={"ctx": {"delay_seconds": delay}})
        if delay > 0:
            await asyncio.sleep(delay)

    @staticmethod
    def _jira_messages(response: httpx.Response) -> str:
        try:
            body = response.json()
        except ValueError:
            return ""
        parts = list(body.get("errorMessages") or []) + list((body.get("errors") or {}).values())
        return "; ".join(str(p) for p in parts)[:300]

    def _handle(self, response: httpx.Response) -> Any:
        status = response.status_code
        if 200 <= status < 300:
            try:
                return response.json()
            except ValueError as exc:
                raise JiraUnavailable(
                    "Jira returned a response that is not JSON.",
                    hint="Check that JIRA_BASE_URL points at your Jira Cloud site.",
                ) from exc
        detail = self._jira_messages(response)
        if status == 401:
            raise JiraAuthError(
                "Jira rejected the email or API token.",
                hint="Check JIRA_EMAIL and JIRA_API_TOKEN in backend/.env. Create a token at "
                "https://id.atlassian.com/manage-profile/security/api-tokens and restart the backend.",
            )
        if status == 403:
            raise JiraForbidden(
                "Your Jira account is not allowed to read this data.",
                hint="Ask a Jira admin to give this account Browse Projects permission on the "
                "configured projects.",
            )
        if status == 404:
            raise JiraNotFound(
                "Jira could not find the requested project or issue.",
               hint="Check that the project key is correct and your Jira account has Browse Projects permission.",
            )
        if status == 400:
            raise JiraBadRequest(f"Jira rejected the query. {detail}".strip())
        if status == 429:
            raise JiraRateLimited(
                "Jira is rate limiting requests.", hint="Wait a minute and refresh."
            )
        if status >= 500:
            raise JiraUnavailable(f"Jira is temporarily unavailable (HTTP {status}).")
        raise JiraUnavailable(f"Unexpected response from Jira (HTTP {status}).")

    # -------------------------------------------------------------- endpoints
    async def myself(self) -> dict[str, Any]:
        return await self._get("/rest/api/3/myself")

    async def get_project(self, key: str) -> dict[str, Any]:
        return await self._get(f"/rest/api/3/project/{key}")

    # NEW METHOD: List all accessible Jira projects
    async def list_projects(self, page_size: int = 50) -> list[dict[str, Any]]:
        """
        Retrieve all Jira projects accessible to the authenticated account.

        Uses Jira REST API v3 project search with pagination.
        """
        projects: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        start_at = 0

        while True:
            data = await self._get(
                "/rest/api/3/project/search",
                params={
                    "startAt": start_at,
                    "maxResults": page_size,
                    "orderBy": "key",
                },
            )

            batch = data.get("values", [])

            for project in batch:
                key = project.get("key")

                if key and key not in seen_keys:
                    seen_keys.add(key)
                    projects.append(project)

            # Jira confirms that this is the final page.
            if data.get("isLast") is True:
                break

            # Stop if Jira returns no additional projects.
            if not batch:
                break

            start_at += len(batch)

            total = data.get("total")
            if total is not None and start_at >= total:
                break

        return projects

    async def get_project_statuses(self, key: str) -> list[dict[str, Any]]:
        return await self._get(f"/rest/api/3/project/{key}/statuses")

    async def get_issue(self, issue_key: str, fields: str) -> dict[str, Any]:
        return await self._get(f"/rest/api/3/issue/{issue_key}", {"fields": fields})

    async def search_page(
        self, jql: str, fields: str, max_results: int, next_page_token: str | None = None
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"jql": jql, "fields": fields, "maxResults": max_results}
        if next_page_token:
            params["nextPageToken"] = next_page_token
        return await self._get("/rest/api/3/search/jql", params)

    async def iter_search(
        self, jql: str, fields: str, page_size: int
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield every issue matching ``jql`` following nextPageToken.

        Issues are de-duplicated by key and a repeated token aborts loudly so
        results are never silently truncated.
        """
        seen_keys: set[str] = set()
        seen_tokens: set[str] = set()
        token: str | None = None
        while True:
            data = await self.search_page(jql, fields, page_size, token)
            for issue in data.get("issues", []):
                ident = issue.get("key") or issue.get("id")
                if ident is None or ident in seen_keys:
                    continue
                seen_keys.add(ident)
                yield issue
            token = data.get("nextPageToken")
            if not token or data.get("isLast") is True:
                return
            if token in seen_tokens:
                raise AppError("Jira returned a repeating pagination token; results incomplete.")
            seen_tokens.add(token)

    async def search_all(self, jql: str, fields: str, page_size: int) -> list[dict[str, Any]]:
        return [issue async for issue in self.iter_search(jql, fields, page_size)]
