
"""Classify Jira tickets into Manual and Automation categories."""

from __future__ import annotations

import re
from enum import StrEnum


class TicketCategory(StrEnum):
    MANUAL = "manual"
    AUTOMATION = "automation"


# Match Automation in any letter case.
_AUTOMATION_PATTERN = re.compile(r"\bautomation\b", re.IGNORECASE)


def classify_ticket(summary: str | None) -> TicketCategory:
    """
    Classify tickets using Jira summary only.

    Any case variation of the complete word "Automation"
    is classified as Automation.
    """

    if not summary or not summary.strip():
        return TicketCategory.MANUAL

    if _AUTOMATION_PATTERN.search(summary):
        return TicketCategory.AUTOMATION

    return TicketCategory.MANUAL
