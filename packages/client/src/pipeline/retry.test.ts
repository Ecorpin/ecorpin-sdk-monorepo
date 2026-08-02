import { describe, expect, it, vi } from "vitest";
import { RateLimitError, ValidationError, type ActionMetadata } from "@ecorpin/core";
import { isRetryable, withRetry } from "./retry.js";

const getAction: ActionMetadata = { name: "get", method: "GET", path: "/:id", idempotent: true };
const createAction: ActionMetadata = { name: "create", method: "POST", path: "/", idempotent: false };

describe("isRetryable", () => {
  it("is retryable for a retryable error on a GET action", () => {
    expect(isRetryable(new RateLimitError("x"), getAction)).toBe(true);
  });

  it("is not retryable for a retryable error on a non-idempotent POST action", () => {
    expect(isRetryable(new RateLimitError("x"), createAction)).toBe(false);
  });

  it("is never retryable for a non-retryable error class", () => {
    expect(isRetryable(new ValidationError("x"), getAction)).toBe(false);
  });

  it("is never retryable for a non-EcorpinError", () => {
    expect(isRetryable(new Error("plain"), getAction)).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns the result on the first successful attempt without retrying", async () => {
    const attempt = vi.fn(async () => "ok");
    const result = await withRetry(attempt, 2, () => true);
    expect(result).toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxRetries times when shouldRetry returns true, then succeeds", async () => {
    let calls = 0;
    const attempt = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error("transient");
      return "ok";
    });
    const result = await withRetry(attempt, 2, () => true);
    expect(result).toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("stops immediately (no retry) when shouldRetry returns false", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("permanent");
    });
    await expect(withRetry(attempt, 3, () => false)).rejects.toThrow("permanent");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("throws the last error once maxRetries is exhausted", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("always fails");
    });
    await expect(withRetry(attempt, 2, () => true)).rejects.toThrow("always fails");
    expect(attempt).toHaveBeenCalledTimes(3);
  });
});
