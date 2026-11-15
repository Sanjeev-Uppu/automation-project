
import httpx
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import BASE, make_issue, make_settings


def test_health_does_not_call_jira(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert client.fake.requests == []


def test_ready_ok(client):
    response = client.get("/api/ready")

    assert response.status_code == 200

    body = response.json()

    assert body["status"] == "ready"
    assert body["jira"]["account"] == "Test User"


def test_missing_credentials_reported_clearly(jira):
    app = create_app(
        make_settings(
            jira_email="",
            jira_api_token="",
            jira_base_url="",
        )
    )

    with TestClient(app) as client:
        response = client.get("/api/ready")

        assert response.status_code == 503

        error = response.json()["jira"]["error"]

        assert error["code"] == "jira_not_configured"
        assert "JIRA_API_TOKEN" in error["message"]

        dashboard = client.get("/api/dashboard")

        assert dashboard.status_code == 503
        assert dashboard.json()["error"]["code"] == "jira_not_configured"

    assert jira.requests == []


def test_invalid_credentials_reported(jira):
    jira.mock.get(
        f"{BASE}/rest/api/3/myself"
    ).mock(
        return_value=httpx.Response(401)
    )

    with TestClient(create_app(make_settings())) as client:
        response = client.get("/api/ready")

        assert response.status_code == 503
        assert response.json()["jira"]["error"]["code"] == "jira_auth_failed"
        assert "JIRA_API_TOKEN" in response.json()["jira"]["error"]["hint"]


def test_projects_discovered_dynamically(client):
    response = client.get("/api/projects")

    assert response.status_code == 200

    data = response.json()

    # Projects are returned in deterministic alphabetical order.
    assert [
        (project["key"], project["name"])
        for project in data["projects"]
    ] == [
        ("BE", "Backend"),
        ("TDF", "Tech Debt Fund"),
    ]


def test_unknown_project_rejected_without_issue_search(client):
    response = client.get("/api/projects/SECRET/issues")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_configured"

    # Project discovery may call Jira, but no issue search should be made
    # for a project that is not accessible to the configured Jira account.
    assert client.fake.requests == []


def test_summary_counts_and_discovered_statuses(client):
    response = client.get("/api/projects/tdf/summary")

    assert response.status_code == 200

    summary = response.json()

    assert summary["total"] == 5

    status_counts = {
        item["name"]: item["count"]
        for item in summary["statuses"]
    }

    assert status_counts == {
        "Open": 1,
        "In Progress": 1,
        "Closed": 3,
        "Blocked": 0,
    }

    assert sum(status_counts.values()) == summary["total"]

    assert [
        item["category"]
        for item in summary["statuses"]
    ] == [
        "new",
        "indeterminate",
        "indeterminate",
        "done",
    ]

    assert summary["unassigned"] == 1

    assert {
        item["display_name"]: item["count"]
        for item in summary["assignees"]
    } == {
        "Alice": 3,
        "Bob": 1,
    }

    assert "Epic" in {
        item["name"]
        for item in summary["issue_types"]
    }

    assert summary["url"] == f"{BASE}/browse/TDF"


def test_new_status_in_jira_appears_without_code_change(client, jira):
    jira.issues["TDF"].append(
        make_issue("TDF-6", "Waiting")
    )

    response = client.get(
        "/api/projects/TDF/summary?refresh=true"
    )

    assert response.status_code == 200

    summary = response.json()

    assert {
        item["name"]: item["count"]
        for item in summary["statuses"]
    }["Waiting"] == 1


def test_dashboard_aggregation_and_isolated_errors(client, jira):
    response = client.get("/api/dashboard")

    assert response.status_code == 200

    dashboard = response.json()

    # Dashboard follows the same alphabetical ordering as project discovery.
    assert [
        project["key"]
        for project in dashboard["projects"]
    ] == ["BE", "TDF"]

    assert dashboard["projects"][0]["summary"]["total"] == 2
    assert dashboard["projects"][1]["summary"]["total"] == 5
    assert dashboard["synced_at"]

    # One project failing must be visible, not shown as zero.
    jira.mock.get(
        f"{BASE}/rest/api/3/project/BE/statuses"
    ).mock(
        return_value=httpx.Response(403)
    )

    response = client.get("/api/dashboard?refresh=true")

    assert response.status_code == 200

    dashboard = response.json()

    projects_by_key = {
        project["key"]: project
        for project in dashboard["projects"]
    }

    be_project = projects_by_key["BE"]
    tdf_project = projects_by_key["TDF"]

    assert be_project["ok"] is False
    assert be_project["error"]["code"] == "jira_forbidden"
    assert be_project["summary"] is None

    assert tdf_project["ok"] is True


def test_caching_and_refresh(client):
    first = client.get(
        "/api/projects/TDF/summary"
    ).json()["meta"]

    assert first["cached"] is False

    request_count = len(client.fake.requests)

    second = client.get(
        "/api/projects/TDF/summary"
    ).json()["meta"]

    assert second["cached"] is True
    assert second["fetched_at"] == first["fetched_at"]
    assert len(client.fake.requests) == request_count

    third = client.get(
        "/api/projects/TDF/summary?refresh=true"
    ).json()["meta"]

    assert third["cached"] is False
    assert len(client.fake.requests) > request_count


def test_issue_pagination_and_order(client):
    page_one = client.get(
        "/api/projects/TDF/issues?page=1&page_size=2"
    ).json()

    assert [
        issue["key"]
        for issue in page_one["items"]
    ] == ["TDF-1", "TDF-2"]

    assert page_one["pagination"] == {
        "page": 1,
        "page_size": 2,
        "total": 5,
        "total_pages": 3,
        "has_next": True,
        "has_prev": False,
    }

    page_three = client.get(
        "/api/projects/TDF/issues?page=3&page_size=2"
    ).json()

    assert [
        issue["key"]
        for issue in page_three["items"]
    ] == ["TDF-5"]

    assert page_three["pagination"]["has_next"] is False

    beyond = client.get(
        "/api/projects/TDF/issues?page=9&page_size=2"
    ).json()

    assert beyond["items"] == []
    assert beyond["pagination"]["total"] == 5

    all_keys = [
        issue["key"]
        for page in (1, 2, 3)
        for issue in client.get(
            f"/api/projects/TDF/issues?page={page}&page_size=2"
        ).json()["items"]
    ]

    assert all_keys == [
        f"TDF-{number}"
        for number in range(1, 6)
    ]

    assert len(set(all_keys)) == 5


def test_status_filter_exact_and_jql_sent(client):
    response = client.get(
        "/api/projects/TDF/issues"
        "?status=Closed&priority=High&search=summary&page_size=10"
    )

    assert response.status_code == 200

    data = response.json()

    assert 'status = "Closed"' in data["jql"]
    assert 'priority = "High"' in data["jql"]
    assert 'summary ~ "summary*"' in data["jql"]

    assert [
        issue["key"]
        for issue in data["items"]
    ] == ["TDF-2"]

    assert data["pagination"]["total"] == 1

    both = client.get(
        "/api/projects/TDF/issues"
        "?status=Closed&priority=High&page_size=10"
    ).json()

    assert [
        issue["key"]
        for issue in both["items"]
    ] == ["TDF-2", "TDF-5"]

    closed = client.get(
        "/api/projects/BE/issues?status=Closed"
    ).json()

    assert [
        issue["key"]
        for issue in closed["items"]
    ] == ["BE-2"]

    assert all(
        issue["status"]["name"] == "Closed"
        for issue in closed["items"]
    )

    jqls = [
        request.url.params["jql"]
        for request in client.fake.requests
    ]

    assert any(
        'status = "Closed"' in jql
        for jql in jqls
    )


def test_issue_normalization_and_links(client):
    item = client.get(
        "/api/projects/TDF/issues?page_size=1"
    ).json()["items"][0]

    assert item["url"] == f"{BASE}/browse/TDF-1"
    assert item["assignee"]["display_name"] == "Alice"
    assert item["reporter"]["display_name"] == "Rita"
    assert item["issue_type"]["name"] == "Bug"
    assert item["priority"]["name"] == "High"

    assert item["created"].startswith(
        "2025-01-02T10:11:12"
    )

    assert item["updated"].startswith(
        "2025-02-02T22:35:06"
    )

    unassigned = client.get(
        "/api/projects/TDF/issues?assignee=__unassigned__"
    ).json()

    assert [
        issue["key"]
        for issue in unassigned["items"]
    ] == ["TDF-3"]

    assert "assignee is EMPTY" in unassigned["jql"]

    bob = client.get(
        "/api/projects/TDF/issues?assignee=bob"
    ).json()

    assert [
        issue["key"]
        for issue in bob["items"]
    ] == ["TDF-4"]


def test_validation_errors(client):
    invalid_queries = (
        "page=0",
        "page_size=500",
        "created_after=yesterday",
        "sort_by=summary",
        "sort_order=up",
        "assignee=x%22%20OR%201=1",
        "search=()!",
    )

    for query in invalid_queries:
        response = client.get(
            f"/api/projects/TDF/issues?{query}"
        )

        assert response.status_code == 422, query
        assert response.json()["error"]["code"] == "invalid_parameter"


def test_single_issue_validation_and_fetch(client, jira):
    assert client.get(
        "/api/projects/TDF/issues/BE-1"
    ).status_code == 422

    assert client.get(
        "/api/projects/TDF/issues/not-a-key"
    ).status_code == 422

    jira.mock.get(
        f"{BASE}/rest/api/3/issue/TDF-1"
    ).mock(
        return_value=httpx.Response(
            200,
            json=make_issue("TDF-1"),
        )
    )

    response = client.get(
        "/api/projects/TDF/issues/tdf-1"
    )

    assert response.status_code == 200
    assert response.json()["key"] == "TDF-1"


def test_csv_export_matches_filters_and_blocks_formula_injection(client):
    response = client.get(
        "/api/projects/TDF/export?status=Closed"
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")

    lines = (
        response.text
        .lstrip("\ufeff")
        .strip()
        .splitlines()
    )

    assert lines[0].startswith(
        "Ticket ID,Summary,Status"
    )

    assert response.headers["X-Row-Count"] == "3"
    assert len(lines) == 4

    assert "'=HYPERLINK" in response.text
    assert f"{BASE}/browse/TDF-2" in response.text


def test_jira_failure_surfaces_as_error_not_zero(client, jira):
    jira.mock.get(
        f"{BASE}/rest/api/3/search/jql"
    ).mock(
        return_value=httpx.Response(503)
    )

    response = client.get(
        "/api/projects/TDF/issues"
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "jira_unavailable"


def test_error_responses_hide_secrets(client, jira):
    jira.mock.get(
        f"{BASE}/rest/api/3/myself"
    ).mock(
        return_value=httpx.Response(401)
    )

    response_text = client.get(
        "/api/ready?refresh=true"
    ).text

    assert "secret-token-123" not in response_text
    assert "me@acme.test" not in response_text


def test_only_get_allowed(client):
    response = client.post("/api/dashboard")

    assert response.status_code == 405
