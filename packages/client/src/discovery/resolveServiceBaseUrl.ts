import { DiscoveryError } from "@ecorpin/core";
import type { ClientSDKConfig } from "../types.js";
import { readEnvVar, serviceEnvVarName } from "./env.js";

/**
 * v0 resolution order (architecture doc §8): environment variable override
 * first (always wins — local dev / incident pinning), then the static
 * fallback registry passed to `createSDK({ registry })`. The central
 * Registry Service (self-registration + heartbeat) is intentionally
 * deferred to a later phase per the MVP roadmap (§22 Phase 6) — this
 * function is the seam where that lookup will be inserted without
 * changing any call site.
 */
export function resolveServiceBaseUrl(serviceName: string, config: ClientSDKConfig): string {
  const envVarName = serviceEnvVarName(serviceName, "URL");
  const fromEnv = readEnvVar(envVarName);
  if (fromEnv) return stripTrailingSlash(fromEnv);

  const fromStaticRegistry = config.registry?.[serviceName];
  if (fromStaticRegistry) return stripTrailingSlash(fromStaticRegistry);

  throw new DiscoveryError(
    `Could not resolve a base URL for service "${serviceName}". Set the ${envVarName} environment variable, ` +
      `or pass { registry: { "${serviceName}": "http://..." } } to createSDK().`,
    { service: serviceName }
  );
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
