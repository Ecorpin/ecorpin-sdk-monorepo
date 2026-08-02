import { describe, expect, it } from "vitest";
import { z } from "zod";
import { NotFoundError } from "@ecorpin/core";
import { mapThrownError } from "./mapThrownError.js";

describe("mapThrownError", () => {
  it("serializes an EcorpinError as-is, using its own code/httpStatus", () => {
    const mapped = mapThrownError(new NotFoundError("User 1 not found", { details: { id: "1" } }), "corr-1");
    expect(mapped.httpStatus).toBe(404);
    expect(mapped.envelope).toEqual({
      error: { code: "ECORPIN_NOT_FOUND", message: "User 1 not found", details: { id: "1" }, correlationId: "corr-1" },
    });
  });

  it("maps a real ZodError (from this package's own zod) to a 400 validation error", () => {
    const schema = z.object({ name: z.string().min(1) });
    const result = schema.safeParse({});
    const mapped = mapThrownError(result.error, "corr-2");
    expect(mapped.httpStatus).toBe(400);
    expect(mapped.envelope.error.code).toBe("ECORPIN_VALIDATION_ERROR");
  });

  it("maps a *structurally* ZodError-shaped object from a different zod module instance " +
    "(the real-world failure mode: a host app installs its own separate zod copy)", () => {
    class ForeignZodError extends Error {
      issues: unknown[];
      constructor(issues: unknown[]) {
        super("Invalid input");
        this.name = "ZodError";
        this.issues = issues;
      }
    }
    const mapped = mapThrownError(new ForeignZodError([{ path: ["name"], message: "Required" }]), "corr-3");
    expect(mapped.httpStatus).toBe(400);
    expect(mapped.envelope.error.code).toBe("ECORPIN_VALIDATION_ERROR");
    expect(mapped.envelope.error.details).toEqual([{ path: ["name"], message: "Required" }]);
  });

  it("maps a legacy `err.status` error (ecorpin-app's existing pattern) via its HTTP status", () => {
    const err = Object.assign(new Error("Forbidden"), { status: 403 });
    const mapped = mapThrownError(err, "corr-4");
    expect(mapped.httpStatus).toBe(403);
    expect(mapped.envelope.error.code).toBe("ECORPIN_FORBIDDEN");
  });

  it("falls back to an opaque 500 for anything unrecognized, never leaking internals", () => {
    const mapped = mapThrownError(new Error("some internal detail nobody should see"), "corr-5");
    expect(mapped.httpStatus).toBe(500);
    expect(mapped.envelope.error.code).toBe("ECORPIN_INTERNAL_ERROR");
    expect(mapped.envelope.error.message).toBe("Internal server error.");
  });
});
