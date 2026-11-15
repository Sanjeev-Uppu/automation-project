from datetime import date

import pytest

from app.core.errors import InvalidParameter
from app.services.jql import UNASSIGNED, IssueFilters, build_jql, quote


def test_base_query_orders_deterministically():
    assert build_jql("TDF", IssueFilters()) == 'project = "TDF" ORDER BY created DESC, key DESC'


def test_filters_combine_with_and():
    f = IssueFilters(status="Closed", priority="High", issue_type="Bug", search="login",
                     assignee="abc:123", sort_by="updated", sort_order="asc")
    jql = build_jql("TDF", f)
    for part in ['project = "TDF"', 'status = "Closed"', 'priority = "High"', 'issuetype = "Bug"',
                 'assignee = "abc:123"', 'summary ~ "login*"']:
        assert part in jql
    assert jql.endswith("ORDER BY updated ASC, key ASC")
    assert jql.count(" AND ") == 5


def test_unassigned():
    assert "assignee is EMPTY" in build_jql("BE", IssueFilters(assignee=UNASSIGNED))


def test_quotes_are_escaped_against_injection():
    jql = build_jql("TDF", IssueFilters(status='Closed" OR project = "SECRET'))
    assert 'status = "Closed\\" OR project = \\"SECRET"' in jql
    assert quote("a\\b") == '"a\\\\b"'


def test_control_characters_rejected():
    with pytest.raises(InvalidParameter):
        quote("bad\nvalue")


def test_bad_assignee_rejected():
    with pytest.raises(InvalidParameter):
        build_jql("TDF", IssueFilters(assignee='x" OR 1=1'))


def test_search_by_ticket_key_and_number():
    assert 'key = "TDF-12"' in build_jql("TDF", IssueFilters(search="tdf-12"))
    assert 'key = "TDF-45"' in build_jql("TDF", IssueFilters(search="45"))


def test_search_strips_lucene_specials():
    jql = build_jql("TDF", IssueFilters(search='fix (login) OR "x" ~'))
    assert "(login)" not in jql and 'summary ~ "login*"' in jql
    with pytest.raises(InvalidParameter):
        build_jql("TDF", IssueFilters(search="()!"))


def test_dates_inclusive_before():
    f = IssueFilters(created_after=date(2025, 1, 1), created_before=date(2025, 1, 31),
                     updated_before=date(2025, 12, 31))
    jql = build_jql("TDF", f)
    assert 'created >= "2025-01-01"' in jql
    assert 'created < "2025-02-01"' in jql
    assert 'updated < "2026-01-01"' in jql
