import { stableStringify } from "./stableStringify.js";

/**
 * Non-cryptographic (FNV-1a) content hash, dependency-free so it works in
 * Node, browsers, and edge runtimes alike. Sufficient for cache keys and
 * ETag-style manifest revalidation (architecture doc §10's `metadataHash`,
 * §17's cache-key derivation) — never use for security-sensitive purposes.
 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Stable content hash of an arbitrary JSON-serializable value. */
export function contentHash(value: unknown): string {
  return fnv1aHash(stableStringify(value));
}

/**
 * Stable cache key for a single SDK call, scoped by auth identity so one
 * caller's cached response is never served to another (architecture doc
 * §17.2).
 */
export function buildCacheKey(parts: {
  service: string;
  resource: string;
  action: string;
  args?: unknown;
  authScope?: string;
}): string {
  return contentHash(parts);
}
