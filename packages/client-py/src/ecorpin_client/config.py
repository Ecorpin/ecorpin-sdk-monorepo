"""`create_sdk()`'s options, mirroring @ecorpin/client's `ClientSDKConfig`."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import requests

from .auth import Credentials
from .constants import DEFAULT_MAX_RETRIES, DEFAULT_METADATA_CACHE_TTL_MS, DEFAULT_TIMEOUT_MS


@dataclass
class SDKConfig:
    #: Static fallback registry: service name -> base URL. Consulted only after the
    #: ``SDK_SERVICE_<NAME>_URL`` environment override.
    registry: dict = field(default_factory=dict)
    #: Overrides the env-var-based credential resolution entirely.
    credentials: Optional[Credentials] = None
    #: Overrides ``DEFAULT_METADATA_CACHE_TTL_MS`` for this SDK instance.
    metadata_cache_ttl_ms: int = DEFAULT_METADATA_CACHE_TTL_MS
    #: Overrides ``DEFAULT_MAX_RETRIES`` for this SDK instance.
    max_retries: int = DEFAULT_MAX_RETRIES
    #: Overrides ``DEFAULT_TIMEOUT_MS`` for actions that don't declare their own ``timeoutMs``.
    default_timeout_ms: int = DEFAULT_TIMEOUT_MS
    #: Shared `requests.Session` (connection pooling). A new one is created if omitted.
    session: Optional[requests.Session] = None
