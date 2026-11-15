
"""Classify Jira tickets into Manual and Automation categories."""
from __future__ import annotations

import re
from enum import StrEnum


class TicketCategory(StrEnum):
    MANUAL = "manual"
    AUTOMATION = "automation"


# Match "automation" as a complete word, case-insensitively.
# This includes descriptions such as "Automation Bug" and
# "Automation testing" without matching unrelated substrings.
_AUTOMATION_PATTERN = re.compile(r"\bautomation\b", re.IGNORECASE)


def classify_ticket(description: str | None) -> TicketCategory:
    """
    Classify a ticket using its extracted description text.

    Rules:
    - Contains the word "Automation" -> Automation
    - Missing or empty description -> Manual
    - Otherwise -> Manual
    """
    if not description:
        return TicketCategory.MANUAL

    if _AUTOMATION_PATTERN.search(description):
        return TicketCategory.AUTOMATION

    return TicketCategory.MANUAL
