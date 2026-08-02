import { DiscoveryError, isServiceMetadata, type ServiceMetadata } from "@ecorpin/core";

export interface FetchManifestResult {
  notModified: boolean;
  manifest?: ServiceMetadata;
  etag?: string;
}

/**
 * `GET {baseUrl}/discovery`, with `If-None-Match` revalidation when a
 * previous `etag` is supplied (architecture doc §9.2, mirroring the
 * server's `discoveryEndpoint.ts`).
 */
export async function fetchManifest(baseUrl: string, previousEtag: string | undefined, serviceName: string): Promise<FetchManifestResult> {
  const headers: Record<string, string> = {};
  if (previousEtag) headers["If-None-Match"] = previousEtag;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/discovery`, { headers });
  } catch (err) {
    throw new DiscoveryError(`Failed to reach service "${serviceName}" at ${baseUrl}/discovery.`, {
      service: serviceName,
      cause: err,
    });
  }

  if (response.status === 304) {
    return { notModified: true };
  }

  if (!response.ok) {
    throw new DiscoveryError(`Service "${serviceName}" discovery endpoint returned HTTP ${response.status}.`, {
      service: serviceName,
    });
  }

  const body = await response.json().catch(() => undefined);
  if (!isServiceMetadata(body)) {
    throw new DiscoveryError(`Service "${serviceName}" returned a malformed metadata manifest.`, { service: serviceName });
  }

  return { notModified: false, manifest: body, etag: response.headers.get("etag") ?? undefined };
}
