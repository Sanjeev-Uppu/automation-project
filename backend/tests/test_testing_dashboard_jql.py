import pytest

from app.core.errors import InvalidParameter
from app.services.jql import (
    IssueFilters,
    build_testing_dashboard_jql,
)


def test_automation_query():
    result = build_testing_dashboard_jql(
        ["SAM1", "SAM2"],
        IssueFilters(),
        "automation",
    )

    assert 'project in ("SAM1", "SAM2")' in result
    assert 'description ~ "automation"' in result


def test_manual_query():
    result = build_testing_dashboard_jql(
        ["SAM1"],
        IssueFilters(),
        "manual",
    )

    assert "description is EMPTY" in result
    assert 'description !~ "automation"' in result


def test_invalid_category():
    with pytest.raises(InvalidParameter):
        build_testing_dashboard_jql(
            ["SAM1"],
            IssueFilters(),
            "invalid",
        )


def test_invalid_project_key():
    with pytest.raises(InvalidParameter):
        build_testing_dashboard_jql(
            ["SAM1 OR project IS NOT EMPTY"],
            IssueFilters(),
            "automation",
        )


def test_created_date_filter():
    from datetime import date

    result = build_testing_dashboard_jql(
        ["SAM1"],
        IssueFilters(created_after=date(2026, 1, 1)),
        "automation",
    )

    assert 'created >= "2026-01-01"' in result