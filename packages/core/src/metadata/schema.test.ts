import { describe, expect, it } from "vitest";
import { isProtocolVersionCompatible, isServiceMetadata, METADATA_PROTOCOL_VERSION } from "./schema.js";
import type { ServiceMetadata } from "../types/service.js";

describe("isProtocolVersionCompatible", () => {
  it("is compatible when the major segment matches", () => {
    expect(isProtocolVersionCompatible(METADATA_PROTOCOL_VERSION)).toBe(true);
    expect(isProtocolVersionCompatible("1.9")).toBe(true);
  });

  it("is incompatible across a major version bump", () => {
    expect(isProtocolVersionCompatible("2.0")).toBe(false);
  });
});

const validManifest: ServiceMetadata = {
  protocolVersion: "1.0",
  service: { name: "crm", version: "1.0.0" },
  authentication: { required: true, strategies: ["apiKey"] },
  features: {},
  resources: [],
  generatedAt: new Date().toISOString(),
  metadataHash: "deadbeef",
};

describe("isServiceMetadata", () => {
  it("accepts a well-formed manifest", () => {
    expect(isServiceMetadata(validManifest)).toBe(true);
  });

  it("rejects null/non-object input", () => {
    expect(isServiceMetadata(null)).toBe(false);
    expect(isServiceMetadata("not a manifest")).toBe(false);
  });

  it("rejects a manifest missing required fields", () => {
    const { resources, ...rest } = validManifest;
    expect(isServiceMetadata(rest)).toBe(false);
  });
});
