import { describe, expect, it } from "vitest";
import {
  ERROR_CODE_REGISTRY,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  TimeoutError,
  NetworkError,
  InternalServiceError,
  UnknownEcorpinError,
} from "./taxonomy.js";
import { EcorpinError } from "./base.js";
import { errorFromEnvelope } from "./fromEnvelope.js";
import type { ErrorEnvelope } from "../types/response.js";

describe("error taxonomy", () => {
  it("every registry entry's instantiated code matches its registry key", () => {
    for (const [code, ErrorClass] of Object.entries(ERROR_CODE_REGISTRY)) {
      const instance = new ErrorClass("boom");
      expect(instance.code).toBe(code);
      expect(instance).toBeInstanceOf(EcorpinError);
    }
  });

  it("marks retryable errors correctly per the retry policy (architecture doc §16.5)", () => {
    expect(new RateLimitError("x").retryable).toBe(true);
    expect(new ServiceUnavailableError("x").retryable).toBe(true);
    expect(new TimeoutError("x").retryable).toBe(true);
    expect(new NetworkError("x").retryable).toBe(true);

    expect(new ValidationError("x").retryable).toBe(false);
    expect(new NotFoundError("x").retryable).toBe(false);
    expect(new InternalServiceError("x").retryable).toBe(false);
  });

  it("carries context (service/resource/action/correlationId/details)", () => {
    const err = new NotFoundError("User 123 not found", {
      service: "crm",
      resource: "users",
      action: "get",
      correlationId: "abc123",
      details: { id: "123" },
    });
    expect(err.service).toBe("crm");
    expect(err.resource).toBe("users");
    expect(err.action).toBe("get");
    expect(err.correlationId).toBe("abc123");
    expect(err.details).toEqual({ id: "123" });
    expect(err.toJSON()).toEqual({
      code: "ECORPIN_NOT_FOUND",
      message: "User 123 not found",
      details: { id: "123" },
      correlationId: "abc123",
    });
  });
});

describe("errorFromEnvelope", () => {
  it("reconstructs a known error class from a wire envelope", () => {
    const envelope: ErrorEnvelope = {
      error: { code: "ECORPIN_NOT_FOUND", message: "User 123 not found", details: { id: "123" }, correlationId: "abc" },
    };
    const err = errorFromEnvelope(envelope, { service: "crm", resource: "users", action: "get" });
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.code).toBe("ECORPIN_NOT_FOUND");
    expect(err.service).toBe("crm");
    expect(err.correlationId).toBe("abc");
  });

  it("falls back to UnknownEcorpinError for an unrecognized code without throwing", () => {
    const envelope: ErrorEnvelope = {
      error: { code: "ECORPIN_SOMETHING_FROM_THE_FUTURE", message: "future error" },
    };
    const err = errorFromEnvelope(envelope);
    expect(err).toBeInstanceOf(UnknownEcorpinError);
    expect(err.code).toBe("ECORPIN_SOMETHING_FROM_THE_FUTURE");
    expect(err.retryable).toBe(false);
  });
});
