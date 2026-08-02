const URL_SAFE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * True if `name` is safe to use as a service, resource, or action-derived
 * URL path segment: lowercase, starts with a letter, letters/digits/hyphens
 * only (architecture doc §11.3 contract validation rules).
 */
export function isUrlSafeName(name: string): boolean {
  return URL_SAFE_NAME_PATTERN.test(name);
}

/**
 * Throws a descriptive error if `name` is not URL-safe. Intended for use at
 * `registerService`/`registerResource` boot time, so a bad name fails fast
 * before the HTTP server starts listening.
 */
export function assertUrlSafeName(name: string, kind: "service" | "resource" | "action"): void {
  if (!isUrlSafeName(name)) {
    throw new Error(
      `Invalid ${kind} name "${name}": must be lowercase, start with a letter, and contain only letters, digits, and hyphens.`
    );
  }
}
