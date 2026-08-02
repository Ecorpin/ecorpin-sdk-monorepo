import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ServiceUnavailableError, type ServiceMetadata } from "@ecorpin/core";
import { createSDK } from "./createSDK.js";

const BASE_URL = "http://localhost:9999/api/ecorpin";

function buildManifest(): ServiceMetadata {
  return {
    protocolVersion: "1.0",
    service: { name: "crm", version: "1.0.0" },
    authentication: { required: true, strategies: ["apiKey"] },
    features: {},
    resources: [
      {
        name: "users",
        actions: [
          { name: "list", method: "GET", path: "/", idempotent: true },
          { name: "get", method: "GET", path: "/:id", idempotent: true },
          { name: "create", method: "POST", path: "/", idempotent: false },
        ],
      },
    ],
    generatedAt: new Date().toISOString(),
    metadataHash: "abc123",
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

/**
 * The dynamic SDK is intentionally untyped at runtime (see `types.ts`'s
 * `DynamicSDK`) — real call-site type safety is a later phase (architecture
 * doc §15). This test-only helper reaches into it without fighting
 * `noUncheckedIndexedAccess` on every call site below.
 */
function action(sdk: unknown, service: string, resource: string, actionName: string): (...args: unknown[]) => Promise<unknown> {
  return (sdk as Record<string, Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>>)[service]![resource]![
    actionName
  ]!;
}

describe("createSDK end-to-end (mocked transport)", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SDK_SERVICE_CRM_URL = BASE_URL;
    process.env.SDK_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("resolves the base URL from SDK_SERVICE_CRM_URL and fetches metadata lazily on first call", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${BASE_URL}/discovery`) return jsonResponse(buildManifest());
      if (url === `${BASE_URL}/users`) return jsonResponse({ data: [{ id: "1" }] });
      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const sdk = createSDK();
    const users = await action(sdk, "crm", "users", "list")();

    expect(users).toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/discovery`, expect.anything());
  });

  it("sends the SDK_API_KEY as a Bearer Authorization header automatically", async () => {
    let capturedHeaders: Headers | undefined;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `${BASE_URL}/discovery`) return jsonResponse(buildManifest());
      capturedHeaders = new Headers(init?.headers);
      return jsonResponse({ data: { id: "1" } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const sdk = createSDK();
    await action(sdk, "crm", "users", "get")("1");

    expect(capturedHeaders?.get("authorization")).toBe("Bearer test-key");
  });

  it("substitutes the id argument into the :id path segment for get()", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${BASE_URL}/discovery`) return jsonResponse(buildManifest());
      if (url === `${BASE_URL}/users/42`) return jsonResponse({ data: { id: "42" } });
      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const sdk = createSDK();
    const user = await action(sdk, "crm", "users", "get")("42");
    expect(user).toEqual({ id: "42" });
  });

  it("reconstructs a typed EcorpinError from a wire error envelope", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${BASE_URL}/discovery`) return jsonResponse(buildManifest());
      return jsonResponse({ error: { code: "ECORPIN_NOT_FOUND", message: "User 999 not found" } }, 404);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const sdk = createSDK();
    await expect(action(sdk, "crm", "users", "get")("999")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("retries a retryable GET failure and succeeds on the second attempt", async () => {
    let userCallCount = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${BASE_URL}/discovery`) return jsonResponse(buildManifest());
      userCallCount += 1;
      if (userCallCount === 1) {
        return jsonResponse({ error: { code: "ECORPIN_SERVICE_UNAVAILABLE", message: "Try again" } }, 503);
      }
      return jsonResponse({ data: [] });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const sdk = createSDK();
    const users = await action(sdk, "crm", "users", "list")();
    expect(users).toEqual([]);
    expect(userCallCount).toBe(2);
  });

  it("does not retry a non-idempotent create() on a retryable error", async () => {
    let createCallCount = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${BASE_URL}/discovery`) return jsonResponse(buildManifest());
      createCallCount += 1;
      return jsonResponse({ error: { code: "ECORPIN_SERVICE_UNAVAILABLE", message: "Try again" } }, 503);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const sdk = createSDK();
    await expect(action(sdk, "crm", "users", "create")({ email: "a@b.com" })).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(createCallCount).toBe(1);
  });

  it("throws FeatureNotSupportedError for an action the manifest doesn't declare", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${BASE_URL}/discovery`) return jsonResponse(buildManifest());
      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const sdk = createSDK();
    await expect(action(sdk, "crm", "users", "archive")("1")).rejects.toThrow(/not registered/);
  });
});
