# @ecorpin/client

Turns any number of internal services' metadata into **one fluent SDK**. No URLs, no `fetch()`, no HTTP methods in your application code — just `sdk.<service>.<resource>.<action>(...)`, discovered and built dynamically at runtime from each service's `@ecorpin/server`-generated manifest.

```ts
const sdk = createSDK();
const customers = await sdk.crm.customers.list();
const product = await sdk.inventory.products.get(productId);
```

Install this inside every application that *consumes* internal services (dashboards, other backends, scripts, ...). Services that *expose* an API install [`@ecorpin/server`](../server) instead.

## Install

```bash
npm install @ecorpin/client
```

Requires Node.js >= 20 (uses the global `fetch`/`AbortController` — no `axios` dependency).

## Quick start

```js
const { createSDK } = require("@ecorpin/client");

const sdk = createSDK({
  // Static fallback registry: service name -> base URL. Only consulted if
  // SDK_SERVICE_<NAME>_URL isn't already set in the environment (see below).
  registry: { crm: "http://localhost:5602/api/ecorpin" },
});

const result = await sdk.crm.clients.list({ limit: 5 });
const created = await sdk.crm.clients.create({ name: "Acme Inc", email: "hello@acme.com" });
const fetched = await sdk.crm.clients.get(created.id);
```

Behind that one call: `createSDK()` fetches `crm`'s manifest from `GET /discovery` the first time you touch `sdk.crm`, caches it (TTL + `ETag` revalidation), and builds `sdk.crm.clients.*` purely from what that manifest describes — add a new resource/action on the server and it shows up on the client automatically, with no client-side code changes.

## Discovery: how a service's base URL is resolved

For each service name, in order:

1. `SDK_SERVICE_<NAME>_URL` environment variable (e.g. `SDK_SERVICE_CRM_URL=https://crm.internal.example.com/api/ecorpin`) — always wins if set.
2. The `registry` option passed to `createSDK()` (a static fallback map, useful for local development).
3. Otherwise, discovery fails with a `DiscoveryError`.

(A central Registry Service is a planned future phase — not required for this to work today.)

## Authentication

Set one of these environment variables (or pass `credentials` directly to `createSDK()` to override entirely):

| Variable | Scope |
|---|---|
| `SDK_API_KEY` | Global default, sent as `Authorization: Bearer <key>` to every service |
| `SDK_SERVICE_<NAME>_TOKEN` | Per-service override (e.g. `SDK_SERVICE_CRM_TOKEN`), takes priority over `SDK_API_KEY` for that service |

```bash
export SDK_API_KEY=your-shared-key
# or, scoped to just one service:
export SDK_SERVICE_CRM_TOKEN=a-crm-specific-token
```

## Error handling

Every failure surfaces as a typed `EcorpinError` subclass from `@ecorpin/core`, reconstructed from the server's response envelope — so you can branch on `.code` / `instanceof` instead of parsing HTTP status codes:

```ts
const { NotFoundError, ValidationError } = require("@ecorpin/core");

try {
  await sdk.crm.clients.get(999);
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("no such client");
  } else if (err instanceof ValidationError) {
    console.log("bad input:", err.details);
  } else {
    throw err;
  }
}
```

## Retries & timeouts

Requests that fail with a `retryable` error (`RateLimitError`, `ServiceUnavailableError`, `TimeoutError`, `NetworkError`) on a safe method (`GET`) or an action explicitly marked `idempotent` are automatically retried with exponential backoff + jitter. An `AuthenticationError` triggers one immediate credential refresh + retry before falling back to normal backoff. Every request has a default timeout (overridable per-action via the manifest); timed-out requests are aborted via `AbortController` and surfaced as a `TimeoutError`.

## Full working example

[`examples/pilot-consumer`](../../examples/pilot-consumer) is a complete, runnable script proving this end-to-end against a real running service — `list` → `create` → `get` → `archive`, with zero URLs, zero `fetch()` calls, and zero HTTP method names anywhere in the script:

```bash
cd examples/pilot-consumer
SDK_API_KEY=<your key> CRM_SERVICE_URL=http://localhost:5602/api/ecorpin node index.js
```

## Part of the Ecorpin SDK Platform

- [`@ecorpin/core`](../core) — shared types/errors this package builds on
- [`@ecorpin/server`](../server) — how a service becomes callable as `sdk.<service>.*`

## License

MIT
