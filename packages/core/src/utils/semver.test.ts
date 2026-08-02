import { describe, expect, it } from "vitest";
import { compareSemver, isSameMajor, parseSemver } from "./semver.js";

describe("parseSemver", () => {
  it("parses a plain major.minor.patch string", () => {
    expect(parseSemver("2.3.0")).toEqual({ major: 2, minor: 3, patch: 0 });
  });

  it("ignores pre-release/build suffixes", () => {
    expect(parseSemver("1.0.0-beta.1")).toEqual({ major: 1, minor: 0, patch: 0 });
  });

  it("returns undefined for an unparseable string", () => {
    expect(parseSemver("not-a-version")).toBeUndefined();
  });
});

describe("compareSemver", () => {
  it("orders versions correctly", () => {
    expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
    expect(compareSemver("2.0.0", "1.0.0")).toBe(1);
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });

  it("throws for invalid input", () => {
    expect(() => compareSemver("nope", "1.0.0")).toThrow();
  });
});

describe("isSameMajor", () => {
  it("is the platform's package compatibility contract (architecture doc §18.1)", () => {
    expect(isSameMajor("1.4.2", "1.0.0")).toBe(true);
    expect(isSameMajor("2.0.0", "1.9.9")).toBe(false);
  });
});
