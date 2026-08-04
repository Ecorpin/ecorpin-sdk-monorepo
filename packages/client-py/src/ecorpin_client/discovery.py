"""
v0 discovery: environment variable override first (always wins — local dev /
incident pinning), then the static fallback registry passed to
`create_sdk(registry=...)`. Mirrors @ecorpin/client's discovery/*.ts; a
central Registry Service is a later phase on both clients.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

import requests

from .errors import DiscoveryError
from .metadata import is_service_metadata

if TYPE_CHECKING:
    from .config import SDKConfig


def service_env_var_name(service_name: str, suffix: str) -> str:
    """`SDK_SERVICE_<NAME>_URL` / `SDK_SERVICE_<NAME>_TOKEN` naming convention."""
    normalized = re.sub(r"-", "_", service_name.upper())
    return f"SDK_SERVICE_{normalized}_{suffix}"


def _strip_trailing_slash(url: str) -> str:
    return re.sub(r"/+$", "", url)


def resolve_service_base_url(service_name: str, config: "SDKConfig") -> str:
    env_var_name = service_env_var_name(service_name, "URL")
    from_env = os.environ.get(env_var_name)
    if from_env:
        return _strip_trailing_slash(from_env)

    from_static_registry = (config.registry or {}).get(service_name)
    if from_static_registry:
        return _strip_trailing_slash(from_static_registry)

    raise DiscoveryError(
        f'Could not resolve a base URL for service "{service_name}". Set the {env_var_name} '
        f'environment variable, or pass registry={{"{service_name}": "http://..."}} to create_sdk().',
        service=service_name,
    )


@dataclass
class FetchManifestResult:
    not_modified: bool
    manifest: Optional[dict] = None
    etag: Optional[str] = None


def fetch_manifest(
    base_url: str,
    previous_etag: Optional[str],
    service_name: str,
    *,
    session: requests.Session,
    timeout_s: float,
) -> FetchManifestResult:
    """`GET {base_url}/discovery`, with `If-None-Match` revalidation when `previous_etag` is supplied."""
    headers = {}
    if previous_etag:
        headers["If-None-Match"] = previous_etag

    try:
        response = session.get(f"{base_url}/discovery", headers=headers, timeout=timeout_s)
    except requests.exceptions.RequestException as err:
        raise DiscoveryError(
            f'Failed to reach service "{service_name}" at {base_url}/discovery.',
            service=service_name,
            cause=err,
        ) from err

    if response.status_code == 304:
        return FetchManifestResult(not_modified=True)

    if not response.ok:
        raise DiscoveryError(
            f'Service "{service_name}" discovery endpoint returned HTTP {response.status_code}.',
            service=service_name,
        )

    try:
        body = response.json()
    except ValueError:
        body = None

    if not is_service_metadata(body):
        raise DiscoveryError(
            f'Service "{service_name}" returned a malformed metadata manifest.',
            service=service_name,
        )

    return FetchManifestResult(not_modified=False, manifest=body, etag=response.headers.get("ETag"))
