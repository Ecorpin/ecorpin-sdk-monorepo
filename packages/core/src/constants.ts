export { METADATA_PROTOCOL_VERSION as PROTOCOL_VERSION } from "./metadata/schema.js";

/** Bumped whenever the manifest shape itself changes, independent of `PROTOCOL_VERSION`. */
export const METADATA_SCHEMA_VERSION = "1.0.0";

/** Default per-action timeout used by `@ecorpin/client` when metadata provides no override. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Default max automatic retry attempts for retryable errors on idempotent actions. */
export const DEFAULT_MAX_RETRIES = 2;

/** Default metadata cache TTL before revalidating against the discovery endpoint. */
export const DEFAULT_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;

/** Default TTL for a resolved service base URL from the registry (architecture doc §17.3). */
export const DEFAULT_REGISTRY_RESOLUTION_TTL_MS = 45 * 1000;

/** Header carrying the end-to-end correlation ID, propagated through every hop. */
export const CORRELATION_ID_HEADER = "x-ecorpin-correlation-id";

/** Header advertising the manifest's stable content hash, used for cache revalidation. */
export const METADATA_VERSION_HEADER = "x-ecorpin-metadata-version";

/** Default mount path for the discovery/health endpoints exposed by `@ecorpin/server`. */
export const DEFAULT_MOUNT_PATH = "/__ecorpin";
