import type { Credentials, EcorpinPlugin, SDKConfig } from "@ecorpin/core";

/**
 * `@ecorpin/client`'s concrete `createSDK()` options, extending the core
 * `SDKConfig` shape with fields specific to this package's v0 discovery
 * strategy (architecture doc §8: env-var override + static registry; the
 * central Registry Service is a later phase).
 */
export interface ClientSDKConfig extends SDKConfig {
  /**
   * Static fallback registry: service name -> base URL. Consulted only
   * after the `SDK_SERVICE_<NAME>_URL` environment override, per the
   * resolution order in architecture doc §8.
   */
  registry?: Record<string, string>;
  /** Overrides the env-var-based credential resolution entirely. */
  credentials?: Credentials;
  /** Overrides `DEFAULT_METADATA_CACHE_TTL_MS` for this SDK instance. */
  metadataCacheTtlMs?: number;
  plugins?: EcorpinPlugin[];
}

/**
 * The runtime shape of `sdk.<service>.<resource>.<action>(...)`. Fully
 * dynamic — see `sdk/createSDK.ts` — so this type exists mainly for
 * documentation; real call-site type safety comes from the generated
 * `.d.ts` augmentation described in architecture doc §15 (not part of this
 * pass).
 */
export type DynamicSDK = Record<string, unknown>;
