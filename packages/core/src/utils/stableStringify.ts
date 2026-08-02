/**
 * Deterministic JSON serialization: object keys are sorted recursively, so
 * two structurally-equal objects always serialize identically regardless of
 * property insertion order. Used as the basis for cache keys and the
 * manifest's `metadataHash` (architecture doc §10/§17).
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const sortedEntries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, sortValue((value as Record<string, unknown>)[key])] as const);
    return Object.fromEntries(sortedEntries);
  }
  return value;
}
