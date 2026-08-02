import { randomUUID } from "node:crypto";
import {
  AuthenticationError,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  type ActionMetadata,
  type ResourceMetadata,
} from "@ecorpin/core";
import type { ClientSDKConfig } from "../types.js";
import type { MetadataCache } from "../cache/metadataCache.js";
import { resolveServiceBaseUrl } from "../discovery/resolveServiceBaseUrl.js";
import { resolveCredentials } from "../auth/credentialProvider.js";
import { buildUrl, mapArgsToCall } from "./buildRequest.js";
import { performRequest } from "./transport.js";
import { isRetryable, withRetry } from "./retry.js";

export interface DispatchParams {
  serviceName: string;
  resource: ResourceMetadata;
  action: ActionMetadata;
  args: unknown[];
  config: ClientSDKConfig;
  metadataCache: MetadataCache;
}

const warnedDeprecations = new Set<string>();

function warnOnceIfDeprecated(serviceName: string, resource: ResourceMetadata, action: ActionMetadata): void {
  if (!action.deprecated) return;
  const key = `${serviceName}.${resource.name}.${action.name}`;
  if (warnedDeprecations.has(key)) return;
  warnedDeprecations.add(key);
  const { since, sunset, message } = action.deprecated;
  // eslint-disable-next-line no-console -- deliberate one-time deprecation notice, architecture doc §18.3.
  console.warn(
    `[ecorpin] sdk.${serviceName}.${resource.name}.${action.name}() is deprecated since ${since}` +
      `${sunset ? ` (sunset: ${sunset})` : ""}.${message ? ` ${message}` : ""}`
  );
}

/**
 * The full request pipeline for one SDK call: auth -> retry -> transport
 * (architecture doc §7). Each retry attempt re-resolves the auth header
 * (so a rotated/refreshed credential is picked up between attempts) but
 * reuses the already-resolved service base URL.
 */
export async function dispatchAction(params: DispatchParams): Promise<unknown> {
  const { serviceName, resource, action, args, config, metadataCache } = params;

  warnOnceIfDeprecated(serviceName, resource, action);

  const mapped = mapArgsToCall(action, args);
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = action.timeoutMs ?? config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const credentials = resolveCredentials(serviceName, config);
  const baseUrl = metadataCache.getCachedBaseUrl(serviceName) ?? resolveServiceBaseUrl(serviceName, config);
  const url = buildUrl(baseUrl, resource.name, action, mapped.pathParams, mapped.query);

  const performOneAttempt = async (): Promise<unknown> => {
    const authHeader = await credentials.getHeader();
    return performRequest({
      url,
      method: action.method,
      authHeader,
      body: mapped.body,
      timeoutMs,
      // Node-runtime detail; a future browser build would substitute
      // `crypto.randomUUID()` from the Web Crypto API here instead.
      correlationId: randomUUID(),
      service: serviceName,
      resource: resource.name,
      action: action.name,
    });
  };

  let authAlreadyRefreshed = false;

  return withRetry(
    async () => {
      try {
        return await performOneAttempt();
      } catch (err) {
        // An auth failure gets exactly one immediate retry with a
        // force-refreshed credential (e.g. a proactively-rotated key) —
        // independent of, and prior to, the normal retryable/backoff
        // decision below (architecture doc §13.4/§13.5). Authentication
        // errors are never `retryable` in the taxonomy, so without this,
        // the outer retry loop would never give the refreshed credential
        // a chance.
        if (err instanceof AuthenticationError && !authAlreadyRefreshed && credentials.forceRefresh) {
          authAlreadyRefreshed = true;
          await credentials.forceRefresh();
          return performOneAttempt();
        }
        throw err;
      }
    },
    maxRetries,
    (err) => isRetryable(err, action)
  );
}
