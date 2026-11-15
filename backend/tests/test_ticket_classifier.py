
import pytest

from app.services.ticket_classifier import (
    TicketCategory,
    classify_ticket,
)


@pytest.mark.parametrize(
    ("description", "expected"),
    [
        ("Automation Bug: login test failed", TicketCategory.AUTOMATION),
        ("Automation testing is required", TicketCategory.AUTOMATION),
        ("This is an AUTOMATION issue", TicketCategory.AUTOMATION),
        ("Manual regression testing", TicketCategory.MANUAL),
        ("automatically generated report", TicketCategory.MANUAL),
        ("", TicketCategory.MANUAL),
        (None, TicketCategory.MANUAL),
    ],
)
def test_classify_ticket(description, expected):
    assert classify_ticket(description) == expected
