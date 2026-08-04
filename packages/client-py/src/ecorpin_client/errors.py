"""
Error taxonomy mirroring @ecorpin/core's errors/{base,taxonomy,fromEnvelope}.ts,
so a Python consumer catches the exact same `code`/`retryable` semantics as a
JS/TS one talking to the same service. See packages/core/src/errors for the
canonical (TypeScript) definitions this file is kept in sync with.

Note: this module deliberately shadows a few builtin names (`TimeoutError`)
to match the cross-language taxonomy 1:1 — prefer `import ecorpin_client as
ecorpin` / `from ecorpin_client import errors` over `from ecorpin_client
import *` if that matters to you.
"""
from __future__ import annotations

from typing import Any, Optional, Type


class EcorpinError(Exception):
    """Base class for every error the Ecorpin SDK Framework raises or reconstructs."""

    code: str = "ECORPIN_UNKNOWN_ERROR"
    http_status: int = 0
    retryable: bool = False

    def __init__(
        self,
        message: str,
        *,
        service: Optional[str] = None,
        resource: Optional[str] = None,
        action: Optional[str] = None,
        correlation_id: Optional[str] = None,
        details: Any = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.service = service
        self.resource = resource
        self.action = action
        self.correlation_id = correlation_id
        self.details = details
        if cause is not None:
            self.__cause__ = cause

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details,
            "correlationId": self.correlation_id,
        }

    def __repr__(self) -> str:  # pragma: no cover - cosmetic
        return f"{type(self).__name__}(code={self.code!r}, message={self.message!r})"


class ValidationError(EcorpinError):
    """400 — request payload failed schema validation. Never retryable."""

    code = "ECORPIN_VALIDATION_ERROR"
    http_status = 400
    retryable = False


class AuthenticationError(EcorpinError):
    """401 — missing/invalid/expired credentials. Never retryable automatically."""

    code = "ECORPIN_UNAUTHENTICATED"
    http_status = 401
    retryable = False


class AuthorizationError(EcorpinError):
    """403 — authenticated, but lacking the required scope/permission."""

    code = "ECORPIN_FORBIDDEN"
    http_status = 403
    retryable = False


class NotFoundError(EcorpinError):
    """404 — resource instance does not exist."""

    code = "ECORPIN_NOT_FOUND"
    http_status = 404
    retryable = False


class ConflictError(EcorpinError):
    """409 — the action conflicts with current server state."""

    code = "ECORPIN_CONFLICT"
    http_status = 409
    retryable = False


class RateLimitError(EcorpinError):
    """429 — caller exceeded a rate limit. Safe to retry after backoff."""

    code = "ECORPIN_RATE_LIMITED"
    http_status = 429
    retryable = True


class ServiceUnavailableError(EcorpinError):
    """503 — service is temporarily unable to handle the request."""

    code = "ECORPIN_SERVICE_UNAVAILABLE"
    http_status = 503
    retryable = True


class InternalServiceError(EcorpinError):
    """500 — unexpected server-side failure. Never auto-retried (ambiguous outcome)."""

    code = "ECORPIN_INTERNAL_ERROR"
    http_status = 500
    retryable = False


class TimeoutError(EcorpinError):  # noqa: A001 - intentional, mirrors @ecorpin/core
    """504 — the client pipeline aborted the request after its timeout elapsed."""

    code = "ECORPIN_TIMEOUT"
    http_status = 504
    retryable = True


class NetworkError(EcorpinError):
    """The request never reached the server (DNS/connection/socket failure)."""

    code = "ECORPIN_NETWORK_ERROR"
    http_status = 0
    retryable = True


class DiscoveryError(EcorpinError):
    """Discovery (registry lookup or metadata fetch) failed for a service."""

    code = "ECORPIN_DISCOVERY_FAILED"
    http_status = 0
    retryable = True


class MetadataError(EcorpinError):
    """A fetched Metadata Manifest is malformed or uses an unsupported protocol version."""

    code = "ECORPIN_METADATA_INVALID"
    http_status = 0
    retryable = False


class FeatureNotSupportedError(EcorpinError):
    """The requested namespace/action requires a feature the service hasn't advertised."""

    code = "ECORPIN_FEATURE_UNSUPPORTED"
    http_status = 0
    retryable = False


class PluginError(EcorpinError):
    """A plugin hook threw during registration or execution."""

    code = "ECORPIN_PLUGIN_ERROR"
    http_status = 0
    retryable = False


class UnknownEcorpinError(EcorpinError):
    """
    Fallback reconstructed when a response envelope carries an error `code`
    this build of ecorpin_client doesn't recognize (e.g. a service running a
    newer @ecorpin/core version). Defaults to non-retryable — an unrecognized
    error class is treated conservatively, never assumed safe to retry.
    """

    def __init__(
        self,
        message: str,
        *,
        code: str = "ECORPIN_UNKNOWN_ERROR",
        http_status: int = 0,
        retryable: bool = False,
        **kwargs: Any,
    ) -> None:
        super().__init__(message, **kwargs)
        self.code = code
        self.http_status = http_status
        self.retryable = retryable


ERROR_CODE_REGISTRY: dict[str, Type[EcorpinError]] = {
    ValidationError.code: ValidationError,
    AuthenticationError.code: AuthenticationError,
    AuthorizationError.code: AuthorizationError,
    NotFoundError.code: NotFoundError,
    ConflictError.code: ConflictError,
    RateLimitError.code: RateLimitError,
    ServiceUnavailableError.code: ServiceUnavailableError,
    InternalServiceError.code: InternalServiceError,
    TimeoutError.code: TimeoutError,
    NetworkError.code: NetworkError,
    DiscoveryError.code: DiscoveryError,
    MetadataError.code: MetadataError,
    FeatureNotSupportedError.code: FeatureNotSupportedError,
    PluginError.code: PluginError,
}


def error_from_envelope(
    envelope: dict,
    *,
    service: Optional[str] = None,
    resource: Optional[str] = None,
    action: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> EcorpinError:
    """
    Reconstructs a typed `EcorpinError` from a wire-format error envelope
    (`{"error": {"code", "message", "details"?, "correlationId"?}}`). Falls
    back to `UnknownEcorpinError` for an unrecognized `code`.
    """
    err = envelope.get("error") or {}
    code = err.get("code", "ECORPIN_UNKNOWN_ERROR")
    message = err.get("message", "Unknown error")
    details = err.get("details")
    # The envelope's own correlationId (set server-side) wins when present;
    # otherwise fall back to whatever the caller already knows.
    merged_correlation_id = err.get("correlationId") or correlation_id

    error_class = ERROR_CODE_REGISTRY.get(code)
    if error_class is not None:
        return error_class(
            message,
            service=service,
            resource=resource,
            action=action,
            correlation_id=merged_correlation_id,
            details=details,
        )
    return UnknownEcorpinError(
        message,
        code=code,
        service=service,
        resource=resource,
        action=action,
        correlation_id=merged_correlation_id,
        details=details,
    )
