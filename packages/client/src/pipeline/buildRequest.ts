import { ValidationError, type ActionMetadata } from "@ecorpin/core";

export interface MappedCall {
  pathParams: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
}

/**
 * Maps the SDK call-site arguments to the parts of an HTTP request, based
 * purely on the action's declared method/path — never on hardcoded
 * per-resource knowledge (architecture doc §2/§12). Convention:
 *
 * - Actions whose path contains `:id` (get/update/delete/custom) take the
 *   id as the first argument, and an optional body as the second —
 *   `sdk.crm.users.get(id)`, `sdk.crm.users.update(id, data)`.
 * - `GET` actions without an id (list) take an optional query-params object
 *   — `sdk.inventory.products.list({ page: 2 })`.
 * - Everything else (create) takes the body as the first argument —
 *   `sdk.crm.customers.create(data)`.
 */
export function mapArgsToCall(action: ActionMetadata, args: unknown[]): MappedCall {
  const requiresId = action.path.includes(":id");

  if (requiresId) {
    const [id, body] = args;
    if (typeof id !== "string" && typeof id !== "number") {
      throw new ValidationError(
        `Action "${action.name}" expects an id as its first argument, e.g. sdk.<service>.<resource>.${action.name}(id${
          action.method === "GET" ? "" : ", data"
        }).`
      );
    }
    return { pathParams: { id: String(id) }, body };
  }

  if (action.method === "GET") {
    return { pathParams: {}, query: (args[0] as Record<string, unknown> | undefined) ?? {} };
  }

  return { pathParams: {}, body: args[0] };
}

/**
 * Joins a resolved service base URL with the resource name and the
 * action's declared path (substituting `:param` placeholders), plus an
 * optional query string for `list`-style calls. This is the *only* place
 * in a consumer's call stack where a URL is ever constructed — developers
 * never see it (architecture doc's core guiding principle).
 */
export function buildUrl(
  baseUrl: string,
  resourceName: string,
  action: ActionMetadata,
  pathParams: Record<string, string>,
  query?: Record<string, unknown>
): string {
  let path = action.path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
    const value = pathParams[key];
    if (value === undefined) {
      throw new ValidationError(`Missing path parameter "${key}" for action "${action.name}".`);
    }
    return encodeURIComponent(value);
  });
  if (path === "/") path = "";

  const url = `${baseUrl}/${resourceName}${path}`;

  if (!query) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const queryString = search.toString();
  return queryString ? `${url}?${queryString}` : url;
}
