
"""Test helpers: a fake Jira served through respx. Mock data lives ONLY in tests."""

from __future__ import annotations

import re

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


BASE = "https://acme.atlassian.net"


def make_settings(**overrides) -> Settings:
    values = dict(
        jira_base_url=BASE,
        jira_email="me@acme.test",
        jira_api_token="secret-token-123",
        jira_project_keys=("TDF", "BE"),
        cache_ttl_seconds=60,
        jira_retry_backoff_seconds=0.0,
        jira_max_retries=2,
        stats_page_size=2,
        key_page_size=3,
        detail_page_size=100,
    )
    values.update(overrides)
    return Settings(**values)


def make_issue(
    key: str,
    status: str = "Open",
    cat: str = "new",
    assignee: str | None = "alice",
    itype: str = "Bug",
    prio: str = "High",
    summary: str | None = None,
) -> dict:
    sid = {
        "Open": "1",
        "In Progress": "2",
        "Closed": "3",
    }.get(status, "9")

    return {
        "id": str(abs(hash(key)) % 100000),
        "key": key,
        "fields": {
            "summary": summary or f"Summary of {key}",
            "status": {
                "id": sid,
                "name": status,
                "statusCategory": {
                    "key": cat,
                    "name": cat,
                },
            },
            "assignee": (
                {
                    "accountId": assignee,
                    "displayName": assignee.title(),
                }
                if assignee
                else None
            ),
            "reporter": {
                "accountId": "r1",
                "displayName": "Rita",
            },
            "issuetype": {
                "id": "10",
                "name": itype,
            },
            "priority": {
                "id": "2",
                "name": prio,
            },
            "created": "2025-01-02T10:11:12.123+0000",
            "updated": "2025-02-03T04:05:06.000+0530",
        },
    }


class FakeJira:
    """Serves fake Jira projects and issues through paginated responses."""

    def __init__(self, issues_by_project: dict[str, list[dict]]):
        self.issues = issues_by_project

        # Issue-search requests only.
        # Existing tests can use this to verify whether an issue search occurred.
        self.requests: list[httpx.Request] = []

        # All Jira requests, including project discovery and metadata requests.
        self.all_requests: list[httpx.Request] = []

        # Projects visible to the fake Jira account.
        self.projects = [
            {"key": "TDF", "name": "Tech Debt Fund"},
            {"key": "BE", "name": "Backend"},
        ]

    def _record(self, request: httpx.Request) -> None:
        self.all_requests.append(request)

    def _project_search(self, request: httpx.Request) -> httpx.Response:
        """Mock Jira's paginated project discovery endpoint."""

        self._record(request)

        params = request.url.params

        start_at = int(params.get("startAt", 0))
        max_results = int(params.get("maxResults", 50))

        # Jira returns projects ordered by key.
        projects = sorted(
            self.projects,
            key=lambda project: project["key"],
        )

        page = projects[start_at : start_at + max_results]

        next_start = start_at + len(page)
        is_last = next_start >= len(projects)

        return httpx.Response(
            200,
            json={
                "values": page,
                "startAt": start_at,
                "maxResults": max_results,
                "total": len(projects),
                "isLast": is_last,
            },
        )

    def _search(self, request: httpx.Request) -> httpx.Response:
        """Mock Jira issue search with nextPageToken pagination."""

        self._record(request)
        self.requests.append(request)

        params = request.url.params

        jql = params["jql"]
        fields = params.get("fields", "")
        size = int(params.get("maxResults", 50))

        project_match = re.search(r'project = "(\w+)"', jql)

        if project_match:
            project_key = project_match.group(1)
            pool = list(self.issues.get(project_key, []))
        else:
            pool = [
                issue
                for project_issues in self.issues.values()
                for issue in project_issues
            ]

        # Issue-key filtering.
        key_match = re.search(r"key in \(([^)]*)\)", jql)

        if key_match:
            wanted = [
                key.strip()
                for key in key_match.group(1).split(",")
            ]

            # Return in reverse order to test result-order handling.
            pool = [
                issue
                for issue in pool
                if issue["key"] in wanted
            ][::-1]

        # Status filtering.
        status_match = re.search(r'status = "([^"]+)"', jql)

        if status_match:
            status = status_match.group(1)

            pool = [
                issue
                for issue in pool
                if issue["fields"]["status"]["name"] == status
            ]

        # Priority filtering.
        priority_match = re.search(r'priority = "([^"]+)"', jql)

        if priority_match:
            priority = priority_match.group(1)

            pool = [
                issue
                for issue in pool
                if issue["fields"]["priority"]["name"] == priority
            ]

        # Unassigned issues.
        if "assignee is EMPTY" in jql:
            pool = [
                issue
                for issue in pool
                if issue["fields"]["assignee"] is None
            ]

        # Assignee filtering.
        assignee_match = re.search(
            r'assignee = "([^"]+)"',
            jql,
        )

        if assignee_match:
            account_id = assignee_match.group(1)

            pool = [
                issue
                for issue in pool
                if (
                    issue["fields"]["assignee"] or {}
                ).get("accountId") == account_id
            ]

        # Summary text filtering.
        # Matches JQL such as: summary ~ "summary*"
        summary_match = re.search(
            r'summary\s*~\s*"([^"]+)\*"',
            jql,
        )

        if summary_match:
            token = summary_match.group(1).lower()

            pool = [
                issue
                for issue in pool
                if token in (
                    issue["fields"].get("summary") or ""
                ).lower()
            ]

        # Jira nextPageToken pagination.
        token = params.get("nextPageToken")

        start = (
            int(token.split("-")[1])
            if token
            else 0
        )

        page = pool[start : start + size]

        # Some Jira requests only need issue keys.
        if fields == "key":
            page = [
                {
                    "id": issue["id"],
                    "key": issue["key"],
                }
                for issue in page
            ]

        body = {
            "issues": page,
        }

        if start + size < len(pool):
            body["nextPageToken"] = f"tok-{start + size}"
        else:
            body["isLast"] = True

        return httpx.Response(200, json=body)

    def _myself(self, request: httpx.Request) -> httpx.Response:
        self._record(request)

        return httpx.Response(
            200,
            json={
                "displayName": "Test User",
            },
        )

    def _project_details(
        self,
        request: httpx.Request,
        key: str,
        name: str,
    ) -> httpx.Response:
        self._record(request)

        return httpx.Response(
            200,
            json={
                "key": key,
                "name": name,
                "issueTypes": [
                    {"id": "10", "name": "Bug"},
                    {"id": "11", "name": "Epic"},
                ],
            },
        )

    def _project_statuses(
        self,
        request: httpx.Request,
    ) -> httpx.Response:
        self._record(request)

        return httpx.Response(
            200,
            json=[
                {
                    "statuses": [
                        {
                            "id": "1",
                            "name": "Open",
                            "statusCategory": {
                                "key": "new",
                                "name": "To Do",
                            },
                        },
                        {
                            "id": "2",
                            "name": "In Progress",
                            "statusCategory": {
                                "key": "indeterminate",
                                "name": "In Progress",
                            },
                        },
                        {
                            "id": "3",
                            "name": "Closed",
                            "statusCategory": {
                                "key": "done",
                                "name": "Done",
                            },
                        },
                        {
                            "id": "4",
                            "name": "Blocked",
                            "statusCategory": {
                                "key": "indeterminate",
                                "name": "In Progress",
                            },
                        },
                    ],
                },
            ],
        )

    def install(self, mock: respx.MockRouter) -> None:
        """Register all fake Jira API endpoints."""

        # Dynamic project discovery.
        mock.get(
            f"{BASE}/rest/api/3/project/search"
        ).mock(
            side_effect=self._project_search
        )

        # Issue search.
        mock.get(
            f"{BASE}/rest/api/3/search/jql"
        ).mock(
            side_effect=self._search
        )

        # Current Jira user.
        mock.get(
            f"{BASE}/rest/api/3/myself"
        ).mock(
            side_effect=self._myself
        )

        # Project metadata and statuses.
        for project in self.projects:
            key = project["key"]
            name = project["name"]

            mock.get(
                f"{BASE}/rest/api/3/project/{key}"
            ).mock(
                side_effect=lambda request, k=key, n=name: (
                    self._project_details(request, k, n)
                )
            )

            mock.get(
                f"{BASE}/rest/api/3/project/{key}/statuses"
            ).mock(
                side_effect=self._project_statuses
            )


@pytest.fixture
def issues():
    return {
        "TDF": [
            make_issue("TDF-1", "Open"),
            make_issue("TDF-2", "Closed", "done"),
            make_issue(
                "TDF-3",
                "In Progress",
                "indeterminate",
                assignee=None,
            ),
            make_issue(
                "TDF-4",
                "Closed",
                "done",
                assignee="bob",
                prio="Low",
            ),
            make_issue(
                "TDF-5",
                "Closed",
                "done",
                summary='=HYPERLINK("x")',
            ),
        ],
        "BE": [
            make_issue("BE-1", "Open"),
            make_issue("BE-2", "Closed", "done"),
        ],
    }


@pytest.fixture
def jira(issues):
    with respx.mock(assert_all_called=False) as mock:
        fake = FakeJira(issues)
        fake.install(mock)
        fake.mock = mock

        yield fake


@pytest.fixture
def client(jira):
    app = create_app(make_settings())

    with TestClient(app) as test_client:
        test_client.fake = jira
        yield test_client
