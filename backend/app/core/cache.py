"""Small async TTL cache with per-key locking (prevents duplicate Jira calls)."""
from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Generic, TypeVar

T = TypeVar("T")


@dataclass
class CacheResult(Generic[T]):
    value: T
    fetched_at: datetime  # when the data was actually retrieved from Jira
    hit: bool  # True when served from cache


class TTLCache:
    def __init__(self, ttl_seconds: float, max_entries: int = 512):
        self.ttl = ttl_seconds
        self.max_entries = max_entries
        self._data: dict[str, tuple[float, datetime, Any]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def _lookup(self, key: str, ttl: float) -> CacheResult | None:
        entry = self._data.get(key)
        if entry and ttl > 0 and time.monotonic() - entry[0] < ttl:
            return CacheResult(entry[2], entry[1], True)
        return None

    async def get_or_load(
        self,
        key: str,
        loader: Callable[[], Awaitable[T]],
        *,
        force: bool = False,
        ttl: float | None = None,
    ) -> CacheResult[T]:
        ttl = self.ttl if ttl is None else ttl
        if not force:
            cached = self._lookup(key, ttl)
            if cached:
                return cached
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            if not force:  # another request may have loaded it while we waited
                cached = self._lookup(key, ttl)
                if cached:
                    return cached
            value = await loader()  # errors propagate and are never cached
            fetched_at = datetime.now(timezone.utc)
            if ttl > 0:
                self._store(key, value, fetched_at)
            return CacheResult(value, fetched_at, False)

    def _store(self, key: str, value: Any, fetched_at: datetime) -> None:
        if len(self._data) >= self.max_entries:
            oldest = min(self._data, key=lambda k: self._data[k][0])
            self._data.pop(oldest, None)
            self._locks.pop(oldest, None)
        self._data[key] = (time.monotonic(), fetched_at, value)

    def invalidate(self, prefix: str | None = None) -> None:
        if prefix is None:
            self._data.clear()
            return
        for key in [k for k in self._data if k.startswith(prefix)]:
            self._data.pop(key, None)
