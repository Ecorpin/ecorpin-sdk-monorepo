import type { JSONSchema } from "./jsonSchema.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * A well-known CRUD-style action name. Custom verbs (e.g. "archive",
 * "issue", "send-email") are also valid action names — this union exists
 * purely so convention-based method/path inference (see the architecture
 * doc, §11.2) has something to switch on.
 */
export type WellKnownActionName = "list" | "get" | "create" | "update" | "delete";

export interface AuthRequirement {
  required: boolean;
  scopes?: string[];
}

export interface DeprecationNotice {
  since: string;
  sunset?: string;
  message?: string;
}

/**
 * Wire-format description of a single action on a resource, as advertised
 * in a service's Metadata Manifest (architecture doc §10).
 */
export interface ActionMetadata {
  name: string;
  method: HttpMethod;
  /** Internal only — never surfaced to SDK consumers. */
  path: string;
  input?: JSONSchema;
  output?: JSONSchema;
  auth?: AuthRequirement;
  /** Safe for the client pipeline to retry automatically on retryable errors. */
  idempotent?: boolean;
  /** Opt-in flag for the future @ecorpin/cache plugin (architecture doc §17.2). */
  cacheable?: boolean;
  /** Per-action override of the client's default timeout. */
  timeoutMs?: number;
  deprecated?: DeprecationNotice;
}
