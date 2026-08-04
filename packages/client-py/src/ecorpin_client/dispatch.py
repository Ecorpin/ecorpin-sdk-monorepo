"""
The full request pipeline for one SDK call: auth -> retry -> transport.
Mirrors @ecorpin/client's pipeline/composePipeline.ts. Each retry attempt
re-resolves the auth header (so a rotated/refreshed credential is picked up
between attempts) but reuses the already-resolved service base URL.
"""
from __future__ import annotations

import uuid
import warnings
from typing import TYPE_CHECKING, Any

from .auth import AuthenticationError, resolve_credentials
from .cache import MetadataCache
from .constants import DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT_MS
from .discovery import resolve_service_base_url
from .request import build_url, map_args_to_call
from .retry import is_retryable, with_retry
from .transport import TransportRequest, perform_request

if TYPE_CHECKING:
    from .config import SDKConfig

_warned_deprecations: set[str] = set()


def _warn_once_if_deprecated(service_name: str, resource: dict, action: dict) -> None:
    deprecated = action.get("deprecated")
    if not deprecated:
        return
    key = f"{service_name}.{resource.get('name')}.{action.get('name')}"
    if key in _warned_deprecations:
        return
    _warned_deprecations.add(key)
    since = deprecated.get("since")
    sunset = deprecated.get("sunset")
    message = deprecated.get("message")
    warnings.warn(
        f"[ecorpin] sdk.{service_name}.{resource.get('name')}.{action.get('name')}() is deprecated "
        f"since {since}{f' (sunset: {sunset})' if sunset else ''}.{f' {message}' if message else ''}",
        stacklevel=3,
    )


def dispatch_action(
    service_name: str,
    resource: dict,
    action: dict,
    args: tuple,
    kwargs: dict,
    config: "SDKConfig",
    metadata_cache: MetadataCache,
) -> Any:
    _warn_once_if_deprecated(service_name, resource, action)

    mapped = map_args_to_call(action, args, kwargs)
    max_retries = config.max_retries if config.max_retries is not None else DEFAULT_MAX_RETRIES
    timeout_ms = action.get("timeoutMs") or config.default_timeout_ms or DEFAULT_TIMEOUT_MS
    credentials = resolve_credentials(service_name, config)
    base_url = metadata_cache.get_cached_base_url(service_name) or resolve_service_base_url(service_name, config)
    url = build_url(base_url, resource["name"], action, mapped.path_params, mapped.query)
    session = config.session
    assert session is not None, "SDKConfig.session must be populated by create_sdk()"

    def perform_one_attempt() -> Any:
        auth_header = credentials.get_header()
        return perform_request(
            TransportRequest(
                url=url,
                method=action["method"],
                auth_header=auth_header,
                body=mapped.body,
                timeout_ms=timeout_ms,
                correlation_id=str(uuid.uuid4()),
                service=service_name,
                resource=resource["name"],
                action=action["name"],
            ),
            session,
        )

    auth_already_refreshed = False

    def attempt(_attempt_number: int) -> Any:
        nonlocal auth_already_refreshed
        try:
            return perform_one_attempt()
        except AuthenticationError:
            # An auth failure gets exactly one immediate retry with a
            # force-refreshed credential (e.g. a proactively-rotated key) —
            # independent of, and prior to, the normal retryable/backoff
            # decision below. AuthenticationError is never `retryable` in
            # the taxonomy, so without this the outer retry loop would
            # never give the refreshed credential a chance.
            if not auth_already_refreshed:
                auth_already_refreshed = True
                credentials.force_refresh()
                return perform_one_attempt()
            raise

    return with_retry(attempt, max_retries, lambda err: is_retryable(err, action))
