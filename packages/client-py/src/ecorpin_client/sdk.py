"""
The dynamic `sdk.<service>.<resource>.<action>(...)` surface, mirroring
@ecorpin/client's sdk/proxyEngine.ts + sdk/createSDK.ts. Property access
(`__getattr__`) is what a JS `Proxy` chain does with its `get` trap: it just
builds up "which service/resource/action is this", with **zero metadata
fetched yet**. All real work — discovery, metadata fetch, resource/action
existence checks, auth, retries, the HTTP call — happens only on the
terminal call (`.list()`, `.create(...)`, ...).

`__getitem__` (``sdk["service-name"]``) is also supported for service or
resource names that aren't valid Python identifiers (e.g. containing a
hyphen), since attribute access can't spell those.
"""
from __future__ import annotations

from typing import Any, Callable

from .cache import MetadataCache
from .config import SDKConfig
from .dispatch import dispatch_action
from .metadata import find_resource_and_action

Invoker = Callable[[str, str, str, tuple, dict], Any]


class _ActionNamespace:
    __slots__ = ("_invoke", "_service", "_resource")

    def __init__(self, invoke: Invoker, service: str, resource: str) -> None:
        self._invoke = invoke
        self._service = service
        self._resource = resource

    def __getattr__(self, action_name: str) -> Callable[..., Any]:
        def call(*args: Any, **kwargs: Any) -> Any:
            return self._invoke(self._service, self._resource, action_name, args, kwargs)

        return call

    def __getitem__(self, action_name: str) -> Callable[..., Any]:
        return self.__getattr__(action_name)


class _ResourceNamespace:
    __slots__ = ("_invoke", "_service")

    def __init__(self, invoke: Invoker, service: str) -> None:
        self._invoke = invoke
        self._service = service

    def __getattr__(self, resource_name: str) -> _ActionNamespace:
        return _ActionNamespace(self._invoke, self._service, resource_name)

    def __getitem__(self, resource_name: str) -> _ActionNamespace:
        return self.__getattr__(resource_name)


class SDK:
    """Returned by `create_sdk()`. `sdk.<service>.<resource>.<action>(...)` is the whole API."""

    __slots__ = ("_invoke",)

    def __init__(self, invoke: Invoker) -> None:
        self._invoke = invoke

    def __getattr__(self, service_name: str) -> _ResourceNamespace:
        return _ResourceNamespace(self._invoke, service_name)

    def __getitem__(self, service_name: str) -> _ResourceNamespace:
        return self.__getattr__(service_name)


def create_sdk(
    *,
    registry: dict | None = None,
    credentials: Any = None,
    metadata_cache_ttl_ms: int | None = None,
    max_retries: int | None = None,
    default_timeout_ms: int | None = None,
    session: Any = None,
) -> SDK:
    """
    Builds one fluent SDK across every service in `registry` (or resolved via
    `SDK_SERVICE_<NAME>_URL` env vars). See the package README for the full
    option reference; every argument has the same meaning as the sibling
    `@ecorpin/client` package's `createSDK()`.
    """
    import requests

    from .constants import DEFAULT_MAX_RETRIES, DEFAULT_METADATA_CACHE_TTL_MS, DEFAULT_TIMEOUT_MS

    config = SDKConfig(
        registry=registry or {},
        credentials=credentials,
        metadata_cache_ttl_ms=metadata_cache_ttl_ms if metadata_cache_ttl_ms is not None else DEFAULT_METADATA_CACHE_TTL_MS,
        max_retries=max_retries if max_retries is not None else DEFAULT_MAX_RETRIES,
        default_timeout_ms=default_timeout_ms if default_timeout_ms is not None else DEFAULT_TIMEOUT_MS,
        session=session or requests.Session(),
    )
    metadata_cache = MetadataCache()

    def invoke(service_name: str, resource_name: str, action_name: str, args: tuple, kwargs: dict) -> Any:
        manifest = metadata_cache.get_or_fetch(service_name, config)
        resource, action = find_resource_and_action(manifest, resource_name, action_name)
        return dispatch_action(service_name, resource, action, args, kwargs, config, metadata_cache)

    return SDK(invoke)
