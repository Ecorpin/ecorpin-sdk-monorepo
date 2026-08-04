"""
ecorpin_client — the Python consumer SDK for the Ecorpin Service SDK
Framework. Turns any number of registered services' metadata into one
fluent object: ``sdk.crm.clients.list()``. See the package README for the
full guide; this module just re-exports the public surface.
"""
from .config import SDKConfig
from .errors import (
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    DiscoveryError,
    EcorpinError,
    FeatureNotSupportedError,
    InternalServiceError,
    MetadataError,
    NetworkError,
    NotFoundError,
    PluginError,
    RateLimitError,
    ServiceUnavailableError,
    TimeoutError,
    UnknownEcorpinError,
    ValidationError,
    error_from_envelope,
)
from .sdk import SDK, create_sdk

try:
    # Single source of truth: [project].version in pyproject.toml (via the
    # installed distribution metadata). Avoids drifting a duplicate string
    # here — the mismatch that left this at 0.1.0 after pyproject hit 1.0.0.
    from importlib.metadata import PackageNotFoundError, version as _pkg_version

    __version__ = _pkg_version("ecorpin-client")
except PackageNotFoundError:  # pragma: no cover - only when running from a raw checkout without `pip install`
    __version__ = "0.0.0+local"

__all__ = [
    "__version__",
    "create_sdk",
    "SDK",
    "SDKConfig",
    "EcorpinError",
    "ValidationError",
    "AuthenticationError",
    "AuthorizationError",
    "NotFoundError",
    "ConflictError",
    "RateLimitError",
    "ServiceUnavailableError",
    "InternalServiceError",
    "TimeoutError",
    "NetworkError",
    "DiscoveryError",
    "MetadataError",
    "FeatureNotSupportedError",
    "PluginError",
    "UnknownEcorpinError",
    "error_from_envelope",
]
