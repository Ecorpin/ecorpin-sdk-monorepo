"""
Credential resolution mirroring @ecorpin/client's auth/credentialProvider.ts:
an explicit `config.credentials` override always wins; otherwise falls back
to environment variables — a per-service token (`SDK_SERVICE_<NAME>_TOKEN`)
if set, else the global `SDK_API_KEY`.
"""
from __future__ import annotations

import os
from typing import TYPE_CHECKING, Callable, Optional, Protocol, Tuple

from .errors import AuthenticationError

if TYPE_CHECKING:
    from .config import SDKConfig

#: `(header_name, header_value)`, e.g. `("Authorization", "Bearer <token>")`.
AuthHeader = Tuple[str, str]


class Credentials(Protocol):
    """Anything with a `get_header()` (and optionally `force_refresh()`) can be passed as `credentials=`."""

    def get_header(self) -> AuthHeader: ...

    def force_refresh(self) -> None: ...  # pragma: no cover - optional, no-op by default


class EnvApiKeyCredentials:
    """Default strategy: resolve a bearer token from process environment variables."""

    strategy = "apiKey"

    def __init__(self, service_name: str) -> None:
        self._service_name = service_name

    def get_header(self) -> AuthHeader:
        from .discovery import service_env_var_name

        per_service_token = os.environ.get(service_env_var_name(self._service_name, "TOKEN"))
        global_key = os.environ.get("SDK_API_KEY")
        key = per_service_token or global_key
        if not key:
            token_var = service_env_var_name(self._service_name, "TOKEN")
            raise AuthenticationError(
                f'No credentials configured for service "{self._service_name}". Set the SDK_API_KEY '
                f"environment variable (or {token_var} for a service-scoped override).",
                service=self._service_name,
            )
        return ("Authorization", f"Bearer {key}")

    def force_refresh(self) -> None:
        # Env vars are re-read on every `get_header()` call already; nothing to invalidate.
        return None


def resolve_credentials(service_name: str, config: "SDKConfig") -> Credentials:
    return config.credentials or EnvApiKeyCredentials(service_name)
