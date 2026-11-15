import asyncio

import httpx
import pytest
import respx

from app.core.errors import (AppError, JiraAuthError, JiraBadRequest, JiraForbidden,
                             JiraNotConfigured, JiraNotFound, JiraRateLimited, JiraUnavailable)
from app.integrations.jira_client import JiraClient
from tests.conftest import BASE, make_settings

URL = f"{BASE}/rest/api/3/myself"


def run(coro):
    return asyncio.run(coro)


async def _call(settings, fn):
    client = JiraClient(settings)
    try:
        return await fn(client)
    finally:
        await client.aclose()


@pytest.mark.parametrize("status,exc", [(401, JiraAuthError), (403, JiraForbidden),
                                        (404, JiraNotFound), (400, JiraBadRequest)])
def test_error_mapping(status, exc):
    with respx.mock:
        respx.get(URL).mock(return_value=httpx.Response(status, json={"errorMessages": ["nope"]}))
        with pytest.raises(exc):
            run(_call(make_settings(), lambda c: c.myself()))


def test_auth_error_message_never_contains_token():
    with respx.mock:
        respx.get(URL).mock(return_value=httpx.Response(401))
        with pytest.raises(JiraAuthError) as e:
            run(_call(make_settings(), lambda c: c.myself()))
    assert "secret-token-123" not in e.value.message + (e.value.hint or "")


def test_missing_credentials_raise_not_configured():
    s = make_settings(jira_api_token="", jira_email="")
    with pytest.raises(JiraNotConfigured) as e:
        run(_call(s, lambda c: c.myself()))
    assert "JIRA_API_TOKEN" in e.value.message and "JIRA_EMAIL" in e.value.message


def test_rate_limit_retries_then_succeeds():
    with respx.mock:
        route = respx.get(URL).mock(side_effect=[httpx.Response(429, headers={"Retry-After": "0"}),
                                                 httpx.Response(200, json={"ok": 1})])
        assert run(_call(make_settings(), lambda c: c.myself())) == {"ok": 1}
        assert route.call_count == 2


def test_rate_limit_exhausted():
    with respx.mock:
        respx.get(URL).mock(return_value=httpx.Response(429))
        with pytest.raises(JiraRateLimited):
            run(_call(make_settings(), lambda c: c.myself()))


def test_server_error_and_timeout_and_network():
    with respx.mock:
        respx.get(URL).mock(return_value=httpx.Response(503))
        with pytest.raises(JiraUnavailable):
            run(_call(make_settings(), lambda c: c.myself()))
    with respx.mock:
        respx.get(URL).mock(side_effect=httpx.ReadTimeout("slow"))
        with pytest.raises(JiraUnavailable) as e:
            run(_call(make_settings(), lambda c: c.myself()))
        assert "respond in time" in e.value.message
    with respx.mock:
        respx.get(URL).mock(side_effect=httpx.ConnectError("dns"))
        with pytest.raises(JiraUnavailable) as e:
            run(_call(make_settings(), lambda c: c.myself()))
        assert "acme.atlassian.net" in e.value.message


def test_only_get_requests_are_made(jira):
    run(_call(make_settings(), lambda c: c.search_all('project = "TDF"', "key", 2)))
    assert {r.method for r in jira.requests} == {"GET"}


def test_pagination_follows_tokens_and_dedupes(jira):
    issues = run(_call(make_settings(), lambda c: c.search_all('project = "TDF"', "key", 2)))
    assert [i["key"] for i in issues] == [f"TDF-{n}" for n in range(1, 6)]
    tokens = [r.url.params.get("nextPageToken") for r in jira.requests]
    assert tokens == [None, "tok-2", "tok-4"]


def test_duplicates_across_pages_removed():
    pages = [{"issues": [{"key": "A-1"}, {"key": "A-2"}], "nextPageToken": "t1"},
             {"issues": [{"key": "A-2"}, {"key": "A-3"}], "isLast": True}]
    with respx.mock:
        respx.get(f"{BASE}/rest/api/3/search/jql").mock(
            side_effect=[httpx.Response(200, json=p) for p in pages])
        issues = run(_call(make_settings(), lambda c: c.search_all("x", "key", 2)))
    assert [i["key"] for i in issues] == ["A-1", "A-2", "A-3"]


def test_repeating_token_fails_loudly():
    page = {"issues": [{"key": "A-1"}], "nextPageToken": "same"}
    with respx.mock:
        respx.get(f"{BASE}/rest/api/3/search/jql").mock(return_value=httpx.Response(200, json=page))
        with pytest.raises(AppError) as e:
            run(_call(make_settings(), lambda c: c.search_all("x", "key", 1)))
    assert "repeating" in e.value.message
