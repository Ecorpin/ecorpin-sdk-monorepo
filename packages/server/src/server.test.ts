import express from "express";
import request from "supertest";
import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import { registerService, registerResource, createEcorpinRouter, __resetEcorpinRegistryForTests } from "./index.js";

const API_KEY = "test-key";

function buildApp() {
  registerService({
    name: "crm",
    version: "9.9.9",
    auth: { apiKeys: { [API_KEY]: true } },
    healthCheck: () => ({ ok: true }),
  });

  const users = new Map<string, { id: string; email: string }>();

  registerResource("users", {
    actions: {
      list: {
        handler: () => Array.from(users.values()),
      },
      get: {
        handler: ({ params }) => {
          const user = users.get(params.id ?? "");
          if (!user) {
            const err = new Error("User not found");
            (err as Error & { status: number }).status = 404;
            throw err;
          }
          return user;
        },
      },
      create: {
        input: z.object({ email: z.string().email() }),
        handler: ({ input }) => {
          const id = String(users.size + 1);
          const record = { id, email: (input as { email: string }).email };
          users.set(id, record);
          return record;
        },
      },
    },
  });

  const app = express();
  app.use("/api/ecorpin", createEcorpinRouter({ logging: false }));
  return app;
}

describe("@ecorpin/server end-to-end", () => {
  beforeEach(() => {
    __resetEcorpinRegistryForTests();
  });

  it("exposes a discovery manifest describing the registered resource/actions", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/ecorpin/discovery");
    expect(res.status).toBe(200);
    expect(res.body.service).toEqual(expect.objectContaining({ name: "crm", version: "9.9.9" }));
    const usersResource = res.body.resources.find((r: { name: string }) => r.name === "users");
    expect(usersResource.actions.map((a: { name: string }) => a.name).sort()).toEqual(["create", "get", "list"]);
  });

  it("returns 304 on a revalidation request with a matching ETag", async () => {
    const app = buildApp();
    const first = await request(app).get("/api/ecorpin/discovery");
    const etag: string | undefined = first.headers.etag;
    expect(etag).toBeTruthy();
    const second = await request(app)
      .get("/api/ecorpin/discovery")
      .set("If-None-Match", etag ?? "");
    expect(second.status).toBe(304);
  });

  it("exposes a health endpoint matching the tasks.todo spec fields", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/ecorpin/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
    expect(res.body.version).toBe("9.9.9");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("memory");
    expect(res.body).toHaveProperty("cpu");
    expect(res.body).toHaveProperty("disk");
    expect(res.body).toHaveProperty("network");
    expect(res.body.database).toEqual({ ok: true });
  });

  it("denies requests with no Authorization header (deny-by-default)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/ecorpin/users");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("ECORPIN_UNAUTHENTICATED");
  });

  it("allows list/create/get with a valid API key, end to end", async () => {
    const app = buildApp();
    const auth = { Authorization: `Bearer ${API_KEY}` };

    const created = await request(app).post("/api/ecorpin/users").set(auth).send({ email: "a@example.com" });
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual({ id: "1", email: "a@example.com" });

    const listed = await request(app).get("/api/ecorpin/users").set(auth);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);

    const fetched = await request(app).get("/api/ecorpin/users/1").set(auth);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data).toEqual({ id: "1", email: "a@example.com" });
  });

  it("maps a legacy `err.status` thrown error to the matching wire error code", async () => {
    const app = buildApp();
    const auth = { Authorization: `Bearer ${API_KEY}` };
    const res = await request(app).get("/api/ecorpin/users/does-not-exist").set(auth);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ECORPIN_NOT_FOUND");
  });

  it("rejects a create call with an invalid body via Zod validation", async () => {
    const app = buildApp();
    const auth = { Authorization: `Bearer ${API_KEY}` };
    const res = await request(app).post("/api/ecorpin/users").set(auth).send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ECORPIN_VALIDATION_ERROR");
  });
});
