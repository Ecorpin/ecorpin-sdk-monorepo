import { DEFAULT_METADATA_CACHE_TTL_MS, isProtocolVersionCompatible, MetadataError, type ServiceMetadata } from "@ecorpin/core";
import type { ClientSDKConfig } from "../types.js";
import { resolveServiceBaseUrl } from "../discovery/resolveServiceBaseUrl.js";
import { fetchManifest } from "../discovery/metadataFetcher.js";

interface CacheEntry {
  manifest: ServiceMetadata;
  etag?: string;
  fetchedAt: number;
  baseUrl: string;
}

/**
 * In-memory metadata cache with TTL + `ETag` revalidation, request
 * coalescing (one in-flight fetch per service, however many concurrent
 * calls ask for it), and "stale-if-error" fallback: if a refresh fails but
 * a previous manifest is cached, the stale manifest is served rather than
 * failing every call (architecture doc §17.1).
 */
export class MetadataCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<ServiceMetadata>>();

  async getOrFetch(serviceName: string, config: ClientSDKConfig): Promise<ServiceMetadata> {
    const ttl = config.metadataCacheTtlMs ?? DEFAULT_METADATA_CACHE_TTL_MS;
    const existing = this.entries.get(serviceName);
    if (existing && Date.now() - existing.fetchedAt < ttl) {
      return existing.manifest;
    }

    const inFlight = this.inFlight.get(serviceName);
    if (inFlight) return inFlight;

    const promise = this.refresh(serviceName, config, existing).finally(() => {
      this.inFlight.delete(serviceName);
    });
    this.inFlight.set(serviceName, promise);
    return promise;
  }

  /** Returns the base URL resolved during the most recent successful fetch for `serviceName`, if any. */
  getCachedBaseUrl(serviceName: string): string | undefined {
    return this.entries.get(serviceName)?.baseUrl;
  }

  private async refresh(serviceName: string, config: ClientSDKConfig, existing: CacheEntry | undefined): Promise<ServiceMetadata> {
    const baseUrl = resolveServiceBaseUrl(serviceName, config);

    try {
      const result = await fetchManifest(baseUrl, existing?.etag, serviceName);

      if (result.notModified && existing) {
        existing.fetchedAt = Date.now();
        return existing.manifest;
      }

      if (!result.manifest) {
        throw new MetadataError(`Service "${serviceName}" discovery returned no usable manifest.`, { service: serviceName });
      }

      if (!isProtocolVersionCompatible(result.manifest.protocolVersion)) {
        throw new MetadataError(
          `Service "${serviceName}" advertises metadata protocol version "${result.manifest.protocolVersion}", ` +
            `which this build of @ecorpin/client does not understand.`,
          { service: serviceName }
        );
      }

      this.entries.set(serviceName, { manifest: result.manifest, etag: result.etag, fetchedAt: Date.now(), baseUrl });
      return result.manifest;
    } catch (err) {
      if (existing) {
        // eslint-disable-next-line no-console -- deliberate degraded-mode warning, see architecture doc §17.1.
        console.warn(
          `[ecorpin] Failed to refresh metadata for "${serviceName}"; serving stale cached manifest. ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        return existing.manifest;
      }
      throw err;
    }
  }
}
