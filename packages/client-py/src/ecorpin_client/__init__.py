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

__version__ = "0.1.0"

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
