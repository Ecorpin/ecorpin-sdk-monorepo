/**
 * Options accepted by `@ecorpin/client`'s `createSDK()`. Declared in core
 * (rather than in `client`) so plugin authors can reference the exact
 * shape of `ClientInitContext.config` without importing `@ecorpin/client`.
 */
export interface SDKConfig {
  /** Explicit list of services to resolve eagerly; others resolve lazily on first access. */
  services?: string[];
  /** Warm up (discover + fetch metadata for) every listed service at createSDK() time instead of lazily. */
  eager?: boolean;
  /** Region hint forwarded to discovery, for future multi-region registries. */
  region?: string;
  /** Default per-action timeout in ms, overridable per action via metadata. */
  defaultTimeoutMs?: number;
  /** Max automatic retry attempts for retryable errors on idempotent actions. */
  maxRetries?: number;
  [extension: string]: unknown;
}
