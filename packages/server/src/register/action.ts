import type { HttpMethod } from "@ecorpin/core";
import type { ActionDefinition } from "./types.js";

export interface ResolvedAction {
  name: string;
  method: HttpMethod;
  /** Relative to the resource base, e.g. "/", "/:id", "/:id/archive". */
  path: string;
  idempotent: boolean;
  definition: ActionDefinition;
}

interface ActionConvention {
  method: HttpMethod;
  path: string;
  idempotent: boolean;
}

/**
 * Convention-over-configuration table for well-known CRUD action names
 * (architecture doc §11.2). Any action name outside this table is treated
 * as a custom verb: `POST /:id/{action}`, non-idempotent by default.
 */
const WELL_KNOWN_CONVENTIONS: Record<string, ActionConvention> = {
  list: { method: "GET", path: "/", idempotent: true },
  get: { method: "GET", path: "/:id", idempotent: true },
  create: { method: "POST", path: "/", idempotent: false },
  update: { method: "PATCH", path: "/:id", idempotent: false },
  delete: { method: "DELETE", path: "/:id", idempotent: false },
};

const MUTATING_METHODS: readonly HttpMethod[] = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Resolves a declared `ActionDefinition` into concrete HTTP method/path,
 * applying convention-over-configuration for well-known action names and
 * enforcing the contract validation rules from architecture doc §11.3.
 * Throws synchronously at `registerResource()` time — boot fails fast on a
 * contract violation, the same way Prisma validates its schema at
 * generate-time rather than at first query.
 */
export function resolveAction(
  resourceName: string,
  actionName: string,
  definition: ActionDefinition
): ResolvedAction {
  const convention = WELL_KNOWN_CONVENTIONS[actionName];
  const method = definition.method ?? convention?.method ?? "POST";
  const path = definition.path ?? convention?.path ?? `/:id/${actionName}`;
  const idempotent = definition.idempotent ?? convention?.idempotent ?? false;

  if (MUTATING_METHODS.includes(method) && !definition.input && !definition.allowNoInput) {
    throw new Error(
      `Resource "${resourceName}" action "${actionName}" is mutating (${method}) but declares no input schema. ` +
        `Either provide \`input\`, or set \`allowNoInput: true\` to explicitly opt out.`
    );
  }

  if (method === "POST" && idempotent && !definition.requiresIdempotencyKey) {
    throw new Error(
      `Resource "${resourceName}" action "${actionName}" is a POST marked idempotent: true, which the client ` +
        `pipeline treats as safe to auto-retry. Set \`requiresIdempotencyKey: true\` to confirm the handler is ` +
        `actually safe to retry, or leave \`idempotent\` unset/false.`
    );
  }

  return { name: actionName, method, path, idempotent, definition };
}
