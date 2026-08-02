import { describe, expect, it } from "vitest";
import { assertUrlSafeName, isUrlSafeName } from "./naming.js";

describe("isUrlSafeName", () => {
  it("accepts lowercase, hyphenated names", () => {
    expect(isUrlSafeName("crm")).toBe(true);
    expect(isUrlSafeName("users")).toBe(true);
    expect(isUrlSafeName("send-email")).toBe(true);
    expect(isUrlSafeName("a1-b2")).toBe(true);
  });

  it("rejects names that are empty, uppercase, or start with a digit/symbol", () => {
    expect(isUrlSafeName("")).toBe(false);
    expect(isUrlSafeName("CRM")).toBe(false);
    expect(isUrlSafeName("1crm")).toBe(false);
    expect(isUrlSafeName("-crm")).toBe(false);
    expect(isUrlSafeName("crm_users")).toBe(false);
    expect(isUrlSafeName("crm users")).toBe(false);
  });
});

describe("assertUrlSafeName", () => {
  it("does not throw for a valid name", () => {
    expect(() => assertUrlSafeName("customers", "resource")).not.toThrow();
  });

  it("throws a descriptive error for an invalid name", () => {
    expect(() => assertUrlSafeName("Bad Name", "service")).toThrow(/Invalid service name "Bad Name"/);
  });
});
