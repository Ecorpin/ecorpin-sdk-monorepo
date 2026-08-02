import { ServiceRegistry, type RegisterServiceOptions } from "./serviceRegistry.js";

export type { RegisterServiceOptions, ServerAuthConfig, RegisteredResource } from "./serviceRegistry.js";
export { ServiceRegistry };

let currentRegistry: ServiceRegistry | undefined;

/**
 * Declares this process's identity once (architecture doc §5.2). Subsequent
 * `registerResource()` calls attach to the registry returned here — one
 * `registerService()` call per process, matching the framework's
 * one-process-is-one-service model.
 */
export function registerService(options: RegisterServiceOptions): ServiceRegistry {
  currentRegistry = new ServiceRegistry(options);
  return currentRegistry;
}

/**
 * Internal accessor used by `registerResource()` and the Express adapter.
 * Throws with a clear message if called before `registerService()`.
 */
export function getCurrentRegistry(): ServiceRegistry {
  if (!currentRegistry) {
    throw new Error(
      "No Ecorpin service registered yet. Call registerService({ name, version }) before registerResource() or createEcorpinRouter()."
    );
  }
  return currentRegistry;
}

/** Test-only escape hatch to reset the module-level singleton between test files. */
export function __resetEcorpinRegistryForTests(): void {
  currentRegistry = undefined;
}
