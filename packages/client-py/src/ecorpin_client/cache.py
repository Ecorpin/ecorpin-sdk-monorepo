"""
In-memory metadata cache with TTL + ETag revalidation and "stale-if-error"
fallback: if a refresh fails but a previous manifest is cached, the stale
manifest is served rather than failing every call. Mirrors
@ecorpin/client's cache/metadataCache.ts, adapted for sync/threaded Python
(a per-service lock replaces the JS version's in-flight-Promise coalescing).
"""
from __future__ import annotations

import threading
import time
import warnings
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

from .discovery import fetch_manifest, resolve_service_base_url
from .errors import MetadataError
from .metadata import is_protocol_version_compatible

if TYPE_CHECKING:
    from .config import SDKConfig


@dataclass
class _CacheEntry:
    manifest: dict
    etag: Optional[str]
    fetched_at: float
    base_url: str


class MetadataCache:
    def __init__(self) -> None:
        self._entries: dict[str, _CacheEntry] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._registry_lock = threading.Lock()

    def _lock_for(self, service_name: str) -> threading.Lock:
        with self._registry_lock:
            lock = self._locks.get(service_name)
            if lock is None:
                lock = threading.Lock()
                self._locks[service_name] = lock
            return lock

    def get_or_fetch(self, service_name: str, config: "SDKConfig") -> dict:
        ttl_s = config.metadata_cache_ttl_ms / 1000
        existing = self._entries.get(service_name)
        if existing is not None and (time.monotonic() - existing.fetched_at) < ttl_s:
            return existing.manifest

        # One fetch in flight per service at a time, however many concurrent
        # threads ask for it — mirrors the JS client's in-flight-Promise map.
        with self._lock_for(service_name):
            existing = self._entries.get(service_name)
            if existing is not None and (time.monotonic() - existing.fetched_at) < ttl_s:
                return existing.manifest
            return self._refresh(service_name, config, existing)

    def get_cached_base_url(self, service_name: str) -> Optional[str]:
        entry = self._entries.get(service_name)
        return entry.base_url if entry else None

    def _refresh(self, service_name: str, config: "SDKConfig", existing: Optional[_CacheEntry]) -> dict:
        base_url = resolve_service_base_url(service_name, config)
        session = config.session
        assert session is not None, "SDKConfig.session must be populated by create_sdk()"

        try:
            result = fetch_manifest(
                base_url,
                existing.etag if existing else None,
                service_name,
                session=session,
                timeout_s=10,
            )

            if result.not_modified and existing is not None:
                existing.fetched_at = time.monotonic()
                return existing.manifest

            if not result.manifest:
                raise MetadataError(
                    f'Service "{service_name}" discovery returned no usable manifest.', service=service_name
                )

            if not is_protocol_version_compatible(result.manifest.get("protocolVersion", "")):
                raise MetadataError(
                    f'Service "{service_name}" advertises metadata protocol version '
                    f'"{result.manifest.get("protocolVersion")}", which this build of ecorpin_client '
                    "does not understand.",
                    service=service_name,
                )

            entry = _CacheEntry(
                manifest=result.manifest, etag=result.etag, fetched_at=time.monotonic(), base_url=base_url
            )
            self._entries[service_name] = entry
            return entry.manifest
        except Exception as err:  # noqa: BLE001 - deliberate stale-if-error fallback
            if existing is not None:
                warnings.warn(
                    f'[ecorpin] Failed to refresh metadata for "{service_name}"; serving stale cached '
                    f"manifest. {err}",
                    stacklevel=2,
                )
                return existing.manifest
            raise
