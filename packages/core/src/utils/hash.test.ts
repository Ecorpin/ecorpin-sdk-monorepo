import { describe, expect, it } from "vitest";
import { contentHash, buildCacheKey, fnv1aHash } from "./hash.js";
import { stableStringify } from "./stableStringify.js";

describe("stableStringify", () => {
  it("produces identical output regardless of key insertion order", () => {
    const a = { b: 1, a: 2, nested: { z: 1, y: 2 } };
    const b = { a: 2, nested: { y: 2, z: 1 }, b: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("preserves array order (arrays are ordered, not sorted)", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });
});

describe("contentHash / fnv1aHash", () => {
  it("is deterministic for the same input", () => {
    const value = { service: "crm", resource: "users", action: "list" };
    expect(contentHash(value)).toBe(contentHash({ action: "list", resource: "users", service: "crm" }));
  });

  it("differs for different input", () => {
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });

  it("fnv1aHash returns a fixed-length hex string", () => {
    expect(fnv1aHash("hello")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("buildCacheKey", () => {
  it("scopes the cache key by auth so two callers never collide (architecture doc §17.2)", () => {
    const base = { service: "crm", resource: "customers", action: "list", args: { page: 1 } };
    const keyForCallerA = buildCacheKey({ ...base, authScope: "caller-a" });
    const keyForCallerB = buildCacheKey({ ...base, authScope: "caller-b" });
    expect(keyForCallerA).not.toBe(keyForCallerB);
  });
});
