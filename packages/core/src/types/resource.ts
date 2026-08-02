import type { ActionMetadata } from "./action.js";

/**
 * Wire-format description of a resource (a noun within a service, e.g.
 * "users", "customers") as advertised in a service's Metadata Manifest.
 */
export interface ResourceMetadata {
  name: string;
  description?: string;
  actions: ActionMetadata[];
}
