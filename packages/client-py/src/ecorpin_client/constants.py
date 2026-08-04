"""Mirrors @ecorpin/core's constants.ts. Keep both files in sync."""

METADATA_PROTOCOL_VERSION = "1.0"
METADATA_SCHEMA_VERSION = "1.0.0"

#: Default per-action timeout (milliseconds) when metadata provides no override.
DEFAULT_TIMEOUT_MS = 10_000

#: Default max automatic retry attempts for retryable errors on idempotent actions.
DEFAULT_MAX_RETRIES = 2

#: Default metadata cache TTL (milliseconds) before revalidating against discovery.
DEFAULT_METADATA_CACHE_TTL_MS = 5 * 60 * 1000

#: Header carrying the end-to-end correlation ID, propagated through every hop.
CORRELATION_ID_HEADER = "x-ecorpin-correlation-id"

#: Header advertising the manifest's stable content hash, used for cache revalidation.
METADATA_VERSION_HEADER = "x-ecorpin-metadata-version"

#: Default mount path for the discovery/health endpoints exposed by @ecorpin/server.
DEFAULT_MOUNT_PATH = "/__ecorpin"
