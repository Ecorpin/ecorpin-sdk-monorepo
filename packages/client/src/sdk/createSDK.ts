import { EcorpinError } from "@ecorpin/core";
import type { ClientSDKConfig, DynamicSDK } from "../types.js";
import { MetadataCache } from "../cache/metadataCache.js";
import { dispatchAction } from "../pipeline/composePipeline.js";
import { createDynamicSdkProxy, findResourceAndAction } from "./proxyEngine.js";
import { PluginNamespaceRegistry } from "./namespaceBuilder.js";

/**
 * Builds the developer-facing `sdk` object: `sdk.crm.users.list()`,
 * `sdk.inventory.products.get(id)`, ... with no URLs, HTTP methods, or
 * `fetch` calls anywhere in application code (architecture doc's core
 * guiding principle, §12).
 *
 * v0 scope (architecture doc §22 Phase 3): Layer 1 dynamic Proxy only — no
 * generated static types yet (Phase 5), no central Registry Service yet
 * (Phase 6). Discovery resolves via `SDK_SERVICE_<NAME>_URL` / the static
 * `registry` option (see `discovery/resolveServiceBaseUrl.ts`).
 */
export function createSDK(config: ClientSDKConfig = {}): DynamicSDK {
  const metadataCache = new MetadataCache();
  const pluginNamespaces = new PluginNamespaceRegistry();

  for (const plugin of config.plugins ?? []) {
    plugin.client?.onInit?.({ config });
    plugin.client?.extendNamespace?.(pluginNamespaces);
  }

  async function invokeAction(serviceName: string, resourceName: string, actionName: string, args: unknown[]): Promise<unknown> {
    const manifest = await metadataCache.getOrFetch(serviceName, config);

    for (const plugin of config.plugins ?? []) {
      plugin.client?.onServiceDiscovered?.(manifest);
    }

    const { resource, action } = findResourceAndAction(manifest, resourceName, actionName);

    try {
      return await dispatchAction({ serviceName, resource, action, args, config, metadataCache });
    } catch (err) {
      if (err instanceof EcorpinError) {
        for (const plugin of config.plugins ?? []) {
          const transformed = plugin.client?.onError?.(err, {
            service: serviceName,
            resource: resourceName,
            action: actionName,
            correlationId: err.correlationId ?? "unknown",
            attempt: 1,
          });
          if (transformed) throw transformed;
        }
      }
      throw err;
    }
  }

  if (config.eager) {
    for (const serviceName of config.services ?? []) {
      // Fire-and-forget warm-up (architecture doc §9.2 "eager mode"): pre-fetches
      // metadata so the *first real call* doesn't pay the discovery latency.
      // Failures here are intentionally swallowed — the same call will
      // simply retry discovery lazily when a real action is invoked.
      void metadataCache.getOrFetch(serviceName, config).catch(() => undefined);
    }
  }

  return createDynamicSdkProxy(invokeAction, pluginNamespaces) as DynamicSDK;
}
