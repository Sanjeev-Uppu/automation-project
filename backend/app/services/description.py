
"""Utilities for extracting searchable text from Jira descriptions."""
from __future__ import annotations

from typing import Any


def extract_description_text(value: Any) -> str | None:
    """
    Extract readable text from Jira description values.

    Jira Cloud descriptions may be plain strings, ADF documents,
    or None. ADF content is recursively traversed.
    """
    if value is None:
        return None

    if isinstance(value, str):
        text = value.strip()
        return text or None

    if isinstance(value, list):
        parts = [
            extract_description_text(item)
            for item in value
        ]
        result = " ".join(part for part in parts if part)
        return result.strip() or None

    if not isinstance(value, dict):
        return None

    # ADF text node
    if value.get("type") == "text":
        text = value.get("text")
        return text.strip() if isinstance(text, str) and text.strip() else None

    # Recursively extract text from ADF child nodes.
    content = value.get("content")
    if isinstance(content, list):
        parts = [
            extract_description_text(item)
            for item in content
        ]
        result = " ".join(part for part in parts if part)
        return result.strip() or None

    return None
