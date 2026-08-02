# @ecorpin/server

Turns an Express service into a self-describing **Ecorpin node**. Instead of hand-writing routes, you declare a service and its resources/actions once; `@ecorpin/server` derives the HTTP routes by convention, generates a discovery manifest for `@ecorpin/client` to consume, and wires up auth, validation, logging, and a health endpoint for you.

Install this inside every internal application that *exposes* an API (CRM, Inventory, HR, ...). Consumers of that API use [`@ecorpin/client`](../client) instead.

## Install

```bash
npm install @ecorpin/server
```

Peer dependencies (you already have these in any Express app): `express@^4` and `zod@^3`.

## Quick start

```js
const express = require("express");
const { z } = require("zod");
const { registerService, registerResource, createEcorpinRouter } = require("@ecorpin/server");

// 1. Declare this process's identity, once.
registerService({
  name: "crm",
  version: "1.0.0",
  description: "Customer relationship data.",
  auth: {
    // Static allow-list for now: API key -> granted scopes, or `true` for unrestricted.
    apiKeys: { [process.env.ECORPIN_API_KEY]: true },
  },
  healthCheck: async () => {
    // Whatever "is my database reachable" means for you.
    return { ok: true };
  },
});

// 2. Declare resources and their actions. Method + path are inferred from the
//    action name unless you override them:
//      list   -> GET    /users
//      get    -> GET    /users/:id
//      create -> POST   /users            (requires `input`, unless allowNoInput: true)
//      update -> PATCH  /users/:id
//      delete -> DELETE /users/:id
//      <verb> -> POST   /users/:id/<verb> (e.g. "archive" -> POST /users/:id/archive)
registerResource("users", {
  description: "Application user accounts.",
  actions: {
    list: {
      handler: async (ctx) => ({ users: await db.users.findAll(ctx.query) }),
    },
    get: {
      handler: async (ctx) => db.users.findById(ctx.params.id),
    },
    create: {
      input: z.object({ name: z.string(), email: z.string().email() }),
      handler: async (ctx) => db.users.create(ctx.input),
    },
  },
});

// 3. Mount the generated router wherever makes sense for your app.
const app = express();
app.use("/api/ecorpin", createEcorpinRouter());
app.listen(3000);
```

That's it — `GET /api/ecorpin/discovery` now returns a manifest describing the `users` resource, `GET /api/ecorpin/health` returns status/uptime/memory/cpu/disk/database info, and `@ecorpin/client` on the consuming side can immediately call `sdk.crm.users.list()` / `.get(id)` / `.create(data)` with zero URLs written on either side.

## What a handler receives (`ActionContext`)

Handlers never touch Express's raw `req`/`res` for normal use — they get a typed context instead:

```ts
interface ActionContext<TInput> {
  input: TInput;                    // validated against `input` schema, if provided
  params: Record<string, string>;   // e.g. { id: "42" } for GET /users/:id
  query: Record<string, unknown>;   // raw query string params
  auth?: { key: string; scopes: string[] | true };
  correlationId: string;
  req: Request;                     // escape hatch — discouraged for normal use
  res: Response;
}
```

Throw an `EcorpinError` subclass from `@ecorpin/core` (e.g. `NotFoundError`, `ConflictError`) to control the response's status/code; any other thrown error is mapped to a `500 ECORPIN_INTERNAL_ERROR`. Zod validation failures on `input` are mapped to `400 ECORPIN_VALIDATION_ERROR` automatically.

## Endpoints every service gets for free

| Method & path | Purpose |
|---|---|
| `GET /discovery` | Metadata manifest (service name/version, resources, actions, auth requirements). Supports `ETag`/`If-None-Match`. |
| `GET /health` | `status`, `version`, `timestamp`, `uptime`, `memory`, `cpu`, `disk`, `network`, and your `healthCheck()` result under `database`. |
| `<resource routes>` | One route per registered action, derived by convention (see above) or overridden via `method`/`path` on the action definition. |

## Real-world example

[`ecorpin-app`](../../../ecorpin-app/src/ecorpin) wraps its existing `clients` module this way — reusing its real business logic and Zod schemas unchanged, and mounting the router under an existing `/api` prefix:

```js
// ecorpin-app/src/ecorpin/resources/clients.resource.js
const { registerResource } = require("@ecorpin/server");
const clientService = require("../../modules/clients/client.service");
const { createClientSchema } = require("../../modules/clients/client.schemas");

registerResource("clients", {
  actions: {
    list: { handler: (ctx) => clientService.listClients(ctx.query, SERVICE_ACCOUNT_USER) },
    create: {
      input: createClientSchema,
      handler: (ctx) => clientService.createClient(ctx.input, SERVICE_ACCOUNT_USER, ctx.req),
    },
    archive: {
      allowNoInput: true,
      handler: (ctx) => clientService.archiveClient(ctx.params.id, SERVICE_ACCOUNT_USER, ctx.req),
    },
  },
});
```

See [`examples/pilot-consumer`](../../examples/pilot-consumer) for the matching client-side call.

## Part of the Ecorpin SDK Platform

- [`@ecorpin/core`](../core) — shared types/errors this package builds on
- [`@ecorpin/client`](../client) — how consumers call the resources you register here

## License

MIT
