import { EcorpinError } from "./base.js";

/** 400 — request payload failed schema validation. Never retryable. */
export class ValidationError extends EcorpinError {
  readonly code = "ECORPIN_VALIDATION_ERROR";
  readonly httpStatus = 400;
  readonly retryable = false;
}

/** 401 — missing/invalid/expired credentials. Never retryable automatically. */
export class AuthenticationError extends EcorpinError {
  readonly code = "ECORPIN_UNAUTHENTICATED";
  readonly httpStatus = 401;
  readonly retryable = false;
}

/** 403 — authenticated, but lacking the required scope/permission. */
export class AuthorizationError extends EcorpinError {
  readonly code = "ECORPIN_FORBIDDEN";
  readonly httpStatus = 403;
  readonly retryable = false;
}

/** 404 — resource instance does not exist. */
export class NotFoundError extends EcorpinError {
  readonly code = "ECORPIN_NOT_FOUND";
  readonly httpStatus = 404;
  readonly retryable = false;
}

/** 409 — the action conflicts with current server state. */
export class ConflictError extends EcorpinError {
  readonly code = "ECORPIN_CONFLICT";
  readonly httpStatus = 409;
  readonly retryable = false;
}

/** 429 — caller exceeded a rate limit. Safe to retry after backoff. */
export class RateLimitError extends EcorpinError {
  readonly code = "ECORPIN_RATE_LIMITED";
  readonly httpStatus = 429;
  readonly retryable = true;
}

/** 503 — service is temporarily unable to handle the request. */
export class ServiceUnavailableError extends EcorpinError {
  readonly code = "ECORPIN_SERVICE_UNAVAILABLE";
  readonly httpStatus = 503;
  readonly retryable = true;
}

/** 500 — unexpected server-side failure. Never auto-retried (ambiguous outcome). */
export class InternalServiceError extends EcorpinError {
  readonly code = "ECORPIN_INTERNAL_ERROR";
  readonly httpStatus = 500;
  readonly retryable = false;
}

/** 504 — the client pipeline aborted the request after its timeout elapsed. */
export class TimeoutError extends EcorpinError {
  readonly code = "ECORPIN_TIMEOUT";
  readonly httpStatus = 504;
  readonly retryable = true;
}

/** The request never reached the server (DNS/connection/socket failure). */
export class NetworkError extends EcorpinError {
  readonly code = "ECORPIN_NETWORK_ERROR";
  readonly httpStatus = 0;
  readonly retryable = true;
}

/** Discovery (registry lookup or metadata fetch) failed for a service. */
export class DiscoveryError extends EcorpinError {
  readonly code = "ECORPIN_DISCOVERY_FAILED";
  readonly httpStatus = 0;
  readonly retryable = true;
}

/** A fetched Metadata Manifest is malformed or uses an unsupported protocol version. */
export class MetadataError extends EcorpinError {
  readonly code = "ECORPIN_METADATA_INVALID";
  readonly httpStatus = 0;
  readonly retryable = false;
}

/** The requested namespace/action requires a feature the service hasn't advertised. */
export class FeatureNotSupportedError extends EcorpinError {
  readonly code = "ECORPIN_FEATURE_UNSUPPORTED";
  readonly httpStatus = 0;
  readonly retryable = false;
}

/** A plugin hook threw during registration or execution. */
export class PluginError extends EcorpinError {
  readonly code = "ECORPIN_PLUGIN_ERROR";
  readonly httpStatus = 0;
  readonly retryable = false;
}

interface UnknownEcorpinErrorOptions {
  code: string;
  httpStatus?: number;
  retryable?: boolean;
}

/**
 * Fallback reconstructed on the client when a response envelope carries an
 * error `code` this build of `@ecorpin/core` doesn't recognize (e.g. a
 * service running a newer core version). Defaults to non-retryable —
 * an unrecognized error class is treated conservatively, never assumed safe
 * to retry (architecture doc §16.4).
 */
export class UnknownEcorpinError extends EcorpinError {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: UnknownEcorpinErrorOptions & ConstructorParameters<typeof EcorpinError>[1] = { code: "ECORPIN_UNKNOWN_ERROR" }
  ) {
    super(message, options);
    this.code = options.code;
    this.httpStatus = options.httpStatus ?? 0;
    this.retryable = options.retryable ?? false;
  }
}

type EcorpinErrorConstructor = new (
  message: string,
  context?: ConstructorParameters<typeof EcorpinError>[1]
) => EcorpinError;

/**
 * Registry of every known error class, keyed by wire `code`. Used by
 * `@ecorpin/client` to reconstruct a typed `EcorpinError` from a response
 * envelope (architecture doc §16.4). Keys must stay in sync with each
 * class's `code` literal above — covered by a unit test.
 */
export const ERROR_CODE_REGISTRY: Record<string, EcorpinErrorConstructor> = {
  ECORPIN_VALIDATION_ERROR: ValidationError,
  ECORPIN_UNAUTHENTICATED: AuthenticationError,
  ECORPIN_FORBIDDEN: AuthorizationError,
  ECORPIN_NOT_FOUND: NotFoundError,
  ECORPIN_CONFLICT: ConflictError,
  ECORPIN_RATE_LIMITED: RateLimitError,
  ECORPIN_SERVICE_UNAVAILABLE: ServiceUnavailableError,
  ECORPIN_INTERNAL_ERROR: InternalServiceError,
  ECORPIN_TIMEOUT: TimeoutError,
  ECORPIN_NETWORK_ERROR: NetworkError,
  ECORPIN_DISCOVERY_FAILED: DiscoveryError,
  ECORPIN_METADATA_INVALID: MetadataError,
  ECORPIN_FEATURE_UNSUPPORTED: FeatureNotSupportedError,
  ECORPIN_PLUGIN_ERROR: PluginError,
};
