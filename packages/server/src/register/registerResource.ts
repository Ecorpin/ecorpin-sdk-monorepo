import { getCurrentRegistry } from "./registerService.js";
import type { RegisteredResource } from "./serviceRegistry.js";
import type { RegisterResourceOptions } from "./types.js";

export type { RegisterResourceOptions, ActionDefinition, ActionContext, ActionHandler, ResolvedAuth } from "./types.js";

/**
 * Declares a resource (a noun within the current service) and its actions
 * (architecture doc §5.2/§11). Must be called after `registerService()`.
 *
 * ```
 * registerService({ name: "crm", version: "1.0.0" });
 * registerResource("users", {
 *   actions: {
 *     list:   { handler: (ctx) => ... },
 *     get:    { handler: (ctx) => ... },
 *     create: { input: CreateUserSchema, handler: (ctx) => ... },
 *   },
 * });
 * ```
 */
export function registerResource(name: string, definition: RegisterResourceOptions): RegisteredResource {
  return getCurrentRegistry().registerResource(name, definition);
}
