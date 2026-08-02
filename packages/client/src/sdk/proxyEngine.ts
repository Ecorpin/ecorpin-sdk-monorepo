import { FeatureNotSupportedError, NotFoundError, isUrlSafeName, type ServiceMetadata } from "@ecorpin/core";
import type { PluginNamespaceRegistry } from "./namespaceBuilder.js";

export type ActionInvoker = (serviceName: string, resourceName: string, actionName: string, args: unknown[]) => Promise<unknown>;
export type MetadataResolver = (serviceName: string) => Promise<ServiceMetadata>;

/**
 * Layer 1 dynamic SDK (architecture doc §12.1): a chain of `Proxy` objects
 * that builds `sdk.<service>.<resource>.<action>` purely from property
 * access, with **zero metadata fetched yet**. Property access must stay
 * synchronous (`get` traps can't `await`), so all async work — discovery,
 * metadata fetch, resource/action existence checks — is deferred to the
 * terminal function call (`.list()`, `.create(...)`, ...), which is the
 * only part of the chain that was ever going to be a `Promise` anyway.
 * This is a deliberate refinement of "lazy per-namespace on first access":
 * it's lazy per first *call*, since first *property access* can't await.
 */
export function createDynamicSdkProxy(invokeAction: ActionInvoker, pluginNamespaces: PluginNamespaceRegistry): Record<string, unknown> {
  const serviceProxyCache = new Map<string, unknown>();

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (pluginNamespaces.has(prop)) return pluginNamespaces.get(prop);

        const cached = serviceProxyCache.get(prop);
        if (cached) return cached;

        const serviceProxy = createResourceLevelProxy(prop, invokeAction);
        serviceProxyCache.set(prop, serviceProxy);
        return serviceProxy;
      },
    }
  ) as Record<string, unknown>;
}

function createResourceLevelProxy(serviceName: string, invokeAction: ActionInvoker): Record<string, unknown> {
  const resourceProxyCache = new Map<string, unknown>();

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;

        const cached = resourceProxyCache.get(prop);
        if (cached) return cached;

        const resourceProxy = createActionLevelProxy(serviceName, prop, invokeAction);
        resourceProxyCache.set(prop, resourceProxy);
        return resourceProxy;
      },
    }
  ) as Record<string, unknown>;
}

function createActionLevelProxy(serviceName: string, resourceName: string, invokeAction: ActionInvoker): Record<string, unknown> {
  const actionFnCache = new Map<string, (...args: unknown[]) => Promise<unknown>>();

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;

        const cached = actionFnCache.get(prop);
        if (cached) return cached;

        const actionFn = (...args: unknown[]) => invokeAction(serviceName, resourceName, prop, args);
        actionFnCache.set(prop, actionFn);
        return actionFn;
      },
    }
  ) as Record<string, unknown>;
}

/**
 * Validates that `resourceName`/`actionName` actually exist on a fetched
 * manifest, called once real metadata is available (i.e. inside the
 * terminal function call, not at proxy-`get` time). Kept separate from the
 * proxy so the "unknown resource/action" error carries full context in one
 * place.
 */
export function findResourceAndAction(manifest: ServiceMetadata, resourceName: string, actionName: string) {
  if (!isUrlSafeName(resourceName)) {
    throw new NotFoundError(`"${resourceName}" is not a valid resource name on service "${manifest.service.name}".`, {
      service: manifest.service.name,
    });
  }

  const resource = manifest.resources.find((candidate) => candidate.name === resourceName);
  if (!resource) {
    throw new NotFoundError(`Resource "${resourceName}" is not registered on service "${manifest.service.name}".`, {
      service: manifest.service.name,
      resource: resourceName,
    });
  }

  const action = resource.actions.find((candidate) => candidate.name === actionName);
  if (!action) {
    throw new FeatureNotSupportedError(
      `Action "${actionName}" is not registered on resource "${manifest.service.name}.${resourceName}".`,
      { service: manifest.service.name, resource: resourceName, action: actionName }
    );
  }

  return { resource, action };
}
