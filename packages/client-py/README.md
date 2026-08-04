# ecorpin-client

The **Python** **consumer** SDK for the Ecorpin Service SDK Framework — the sibling of `[@ecorpin/client](../client)` for Python applications, scripts, and notebooks. Turns any number of internal services' metadata into **one fluent SDK**. No URLs, no `requests.get()`, no HTTP methods in your application code — just `sdk.<service>.<resource>.<action>(...)`, discovered and built dynamically at runtime from each service's `@ecorpin/server`-generated manifest.

```python
sdk = create_sdk()
customers = sdk.crm.customers.list()
product = sdk.inventory.products.get(product_id)
```

Install this inside every Python codebase that *consumes* internal services (scripts, data pipelines, other backends, notebooks, ...). Services that *expose* an API install `[@ecorpin/server](../server)` (Node.js) instead.

This client is **synchronous** (built on `[requests](https://requests.readthedocs.io/)`) by design — every call blocks and returns a plain value, no `asyncio`/`await` required.

## Install

```bash
pip install ecorpin-client
```

Requires Python >= 3.9.

## Quick start

```python
from ecorpin_client import create_sdk

sdk = create_sdk(
    # Static fallback registry: service name -> base URL. Only consulted if
    # SDK_SERVICE_<NAME>_URL isn't already set in the environment (see below).
    registry={"crm": "http://localhost:5602/api/ecorpin"},
)

result = sdk.crm.clients.list(limit=5)
created = sdk.crm.clients.create(name="Acme Inc", email="hello@acme.com")
fetched = sdk.crm.clients.get(created["id"])
```

Behind that one call: `create_sdk()` fetches `crm`'s manifest from `GET /discovery` the first time you touch `sdk.crm`, caches it (TTL + `ETag` revalidation), and builds `sdk.crm.clients.*` purely from what that manifest describes — add a new resource/action on the server and it shows up on the client automatically, with no client-side code changes.

### Calling conventions

Every action maps call-site arguments to an HTTP request purely from the action's declared method/path — never from hardcoded per-resource knowledge — and accepts either a positional dict or keyword arguments, whichever reads better at the call site:


| Action shape                                                   | Example                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Actions with an `:id` path (`get`, `update`, `delete`, custom) | `sdk.crm.users.get(user_id)`, `sdk.crm.users.update(user_id, name="Ada")`             |
| `GET` without an id (`list`)                                   | `sdk.inventory.products.list(page=2)` or `sdk.inventory.products.list({"page": 2})`   |
| Everything else (`create`)                                     | `sdk.crm.customers.create(name="Ada")` or `sdk.crm.customers.create({"name": "Ada"})` |




## Discovery: how a service's base URL is resolved

For each service name, in order:

1. `SDK_SERVICE_<NAME>_URL` environment variable (e.g. `SDK_SERVICE_CRM_URL=https://crm.internal.example.com/api/ecorpin`) — always wins if set.
2. The `registry` option passed to `create_sdk()` (a static fallback map, useful for local development).
3. Otherwise, discovery fails with a `DiscoveryError`.

(A central Registry Service is a planned future phase — not required for this to work today.)

## Authentication

Set one of these environment variables (or pass `credentials=` directly to `create_sdk()` to override entirely — anything with a `get_header()` method):


| Variable                   | Scope                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `SDK_API_KEY`              | Global default, sent as `Authorization: Bearer <key>` to every service                                  |
| `SDK_SERVICE_<NAME>_TOKEN` | Per-service override (e.g. `SDK_SERVICE_CRM_TOKEN`), takes priority over `SDK_API_KEY` for that service |


```bash
export SDK_API_KEY=your-shared-key
# or, scoped to just one service:
export SDK_SERVICE_CRM_TOKEN=a-crm-specific-token
```



## Error handling

Every failure surfaces as a typed `EcorpinError` subclass, reconstructed from the server's response envelope — so you can branch on `.code` / `isinstance()` instead of parsing HTTP status codes:

```python
from ecorpin_client import NotFoundError, ValidationError

try:
    sdk.crm.clients.get(999)
except NotFoundError:
    print("no such client")
except ValidationError as err:
    print("bad input:", err.details)
```

> **Note:** `ecorpin_client.TimeoutError` intentionally shadows the Python builtin, to keep the error taxonomy identical to `@ecorpin/core`/`@ecorpin/client`. Prefer `import ecorpin_client as ecorpin` (then `ecorpin.TimeoutError`) or catching by name from the module (`from ecorpin_client.errors import TimeoutError as EcorpinTimeoutError`) if that ambiguity matters in your code.



## Retries & timeouts

Requests that fail with a `retryable` error (`RateLimitError`, `ServiceUnavailableError`, `TimeoutError`, `NetworkError`) on a safe method (`GET`) or an action explicitly marked `idempotent` are automatically retried with exponential backoff + jitter. An `AuthenticationError` triggers one immediate credential refresh + retry before falling back to normal backoff. Every request has a default timeout (overridable per-action via the manifest); timed-out requests raise a `TimeoutError`.

## Full working example

`[examples/pilot_consumer.py](examples/pilot_consumer.py)` is a complete, runnable script proving this end-to-end against a real running service — `list` → `create` → `get` → `archive`, with zero URLs, zero `requests` calls, and zero HTTP method names anywhere in the script:

```bash
cd packages/client-py
pip install -e .
SDK_API_KEY=<your key> SDK_SERVICE_CRM_URL=http://localhost:5602/api/ecorpin python examples/pilot_consumer.py
```



## Development

```bash
cd packages/client-py
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[test]"
pytest
```



## Part of the Ecorpin SDK Platform

- `[@ecorpin/core](../core)` / `[@ecorpin/client](../client)` — the TypeScript/Node.js siblings this package mirrors
- `[@ecorpin/server](../server)` — how a service becomes callable as `sdk.<service>.*`



## License

MIT