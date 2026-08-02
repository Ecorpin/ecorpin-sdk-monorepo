import { describe, expect, it } from "vitest";
import type { ActionMetadata } from "@ecorpin/core";
import { buildUrl, mapArgsToCall } from "./buildRequest.js";

const listAction: ActionMetadata = { name: "list", method: "GET", path: "/", idempotent: true };
const getAction: ActionMetadata = { name: "get", method: "GET", path: "/:id", idempotent: true };
const createAction: ActionMetadata = { name: "create", method: "POST", path: "/", idempotent: false };
const archiveAction: ActionMetadata = { name: "archive", method: "POST", path: "/:id/archive", idempotent: false };

describe("mapArgsToCall", () => {
  it("maps a bare id argument for a :id action to pathParams", () => {
    expect(mapArgsToCall(getAction, ["42"])).toEqual({ pathParams: { id: "42" }, body: undefined });
  });

  it("maps id + body for a mutating :id action (e.g. update/archive)", () => {
    expect(mapArgsToCall(archiveAction, ["42", { reason: "inactive" }])).toEqual({
      pathParams: { id: "42" },
      body: { reason: "inactive" },
    });
  });

  it("maps an optional query object for a list action", () => {
    expect(mapArgsToCall(listAction, [{ page: 2 }])).toEqual({ pathParams: {}, query: { page: 2 } });
    expect(mapArgsToCall(listAction, [])).toEqual({ pathParams: {}, query: {} });
  });

  it("maps a bare body argument for create", () => {
    expect(mapArgsToCall(createAction, [{ email: "a@b.com" }])).toEqual({ pathParams: {}, body: { email: "a@b.com" } });
  });

  it("throws a ValidationError if a :id action is called without an id", () => {
    expect(() => mapArgsToCall(getAction, [])).toThrow(/expects an id/);
  });
});

describe("buildUrl", () => {
  it("builds a list URL with no trailing slash", () => {
    expect(buildUrl("http://x/api/ecorpin", "users", listAction, {})).toBe("http://x/api/ecorpin/users");
  });

  it("substitutes :id into the path", () => {
    expect(buildUrl("http://x/api/ecorpin", "users", getAction, { id: "42" })).toBe("http://x/api/ecorpin/users/42");
  });

  it("substitutes :id for a custom-verb action path", () => {
    expect(buildUrl("http://x/api/ecorpin", "clients", archiveAction, { id: "7" })).toBe(
      "http://x/api/ecorpin/clients/7/archive"
    );
  });

  it("appends a query string for list params, skipping null/undefined", () => {
    expect(buildUrl("http://x/api/ecorpin", "users", listAction, {}, { page: 2, search: undefined })).toBe(
      "http://x/api/ecorpin/users?page=2"
    );
  });

  it("throws a ValidationError if a required path param is missing", () => {
    expect(() => buildUrl("http://x", "users", getAction, {})).toThrow(/Missing path parameter/);
  });
});
