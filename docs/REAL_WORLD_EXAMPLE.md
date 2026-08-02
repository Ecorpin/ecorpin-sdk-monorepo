# Real-world example: an Inventory service, end to end

This is a second, standalone walkthrough of the Ecorpin SDK Platform — distinct from [`examples/pilot-consumer`](../examples/pilot-consumer) (which wraps `ecorpin-app`'s real `clients` module). Here we build a fictional **Inventory** service from scratch and consume it, using all three packages together:

- **[`@ecorpin/server`](../packages/server)** — exposes an `inventory` service with a `products` resource
- **[`@ecorpin/client`](../packages/client)** — a separate "low-stock alert" script that consumes it
- **[`@ecorpin/core`](../packages/core)** — the shared `EcorpinError` taxonomy both sides throw/catch

No URLs, no `fetch()`, no HTTP method names anywhere in either script — everything is `service.resource.action(...)`.

## The scenario

A warehouse system needs to track products and their stock levels. Other internal tools (a purchasing dashboard, a low-stock alerting job, a mobile scanner app) all need to read and update that data without knowing anything about the Inventory service's database, framework, or even that it's an HTTP API at all.

## 1. The service side — `@ecorpin/server`

```js
// inventory-service/index.js
const express = require("express");
const { z } = require("zod");
const {
  registerService,
  registerResource,
  createEcorpinRouter,
} = require("@ecorpin/server");
const { NotFoundError, ConflictError } = require("@ecorpin/core");

// In-memory store for this example — a real service would use a database.
const products = new Map();
let nextId = 1;

registerService({
  name: "inventory",
  version: "1.0.0",
  description: "Product catalog and stock levels.",
  auth: {
    apiKeys: { [process.env.ECORPIN_API_KEY]: true },
  },
  healthCheck: async () => ({ ok: true, productCount: products.size }),
});

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(0).default(0),
});

const updateProductSchema = createProductSchema.partial();

const restockSchema = z.object({
  amount: z.number().int().positive(),
});

registerResource("products", {
  description: "Products tracked in the warehouse.",
  actions: {
    // GET /products
    list: {
      handler: async (ctx) => {
        const all = [...products.values()];
        const lowStockOnly = ctx.query.lowStock === "true";
        const items = lowStockOnly ? all.filter((p) => p.quantity < 10) : all;
        return { products: items, total: items.length };
      },
    },

    // GET /products/:id
    get: {
      handler: async (ctx) => {
        const product = products.get(ctx.params.id);
        if (!product) {
          throw new NotFoundError(`Product ${ctx.params.id} not found`, {
            resource: "products",
            action: "get",
          });
        }
        return product;
      },
    },

    // POST /products (input validated against createProductSchema)
    create: {
      input: createProductSchema,
      handler: async (ctx) => {
        const existing = [...products.values()].find((p) => p.sku === ctx.input.sku);
        if (existing) {
          throw new ConflictError(`SKU "${ctx.input.sku}" already exists`, {
            resource: "products",
            action: "create",
          });
        }
        const id = String(nextId++);
        const product = { id, ...ctx.input, createdAt: new Date().toISOString() };
        products.set(id, product);
        return product;
      },
    },

    // PATCH /products/:id
    update: {
      input: updateProductSchema,
      handler: async (ctx) => {
        const product = products.get(ctx.params.id);
        if (!product) throw new NotFoundError(`Product ${ctx.params.id} not found`);
        Object.assign(product, ctx.input);
        return product;
      },
    },

    // Custom verb -> POST /products/:id/restock
    // (Any action name that isn't list/get/create/update/delete maps to
    //  POST /<resource>/:id/<actionName>, per @ecorpin/server's routing convention.)
    restock: {
      input: restockSchema,
      handler: async (ctx) => {
        const product = products.get(ctx.params.id);
        if (!product) throw new NotFoundError(`Product ${ctx.params.id} not found`);
        product.quantity += ctx.input.amount;
        return product;
      },
    },
  },
});

const app = express();
app.use("/api/ecorpin", createEcorpinRouter());
app.listen(process.env.PORT || 4100, () => {
  console.log(`inventory service listening on :${process.env.PORT || 4100}`);
});
```

That's the entire service. `GET /api/ecorpin/discovery` now advertises `products` with its five actions (including the custom `restock` verb), `GET /api/ecorpin/health` reports `productCount` alongside the usual uptime/memory/cpu stats, and every input is validated before a handler ever runs.

## 2. The consumer side — `@ecorpin/client`

A separate "low-stock alert" script, running as its own process (e.g. a scheduled job), needs to find every product under 10 units and flag it — without ever knowing the Inventory service's base URL is hardcoded anywhere but its own environment config.

```js
// low-stock-alert/index.js
const { createSDK } = require("@ecorpin/client");
const { NotFoundError, ValidationError } = require("@ecorpin/core");

async function main() {
  const sdk = createSDK({
    // Static fallback registry — only consulted if SDK_SERVICE_INVENTORY_URL
    // isn't already set in the environment.
    registry: { inventory: process.env.INVENTORY_SERVICE_URL || "http://localhost:4100/api/ecorpin" },
  });

  const { products } = await sdk.inventory.products.list({ lowStock: "true" });

  if (products.length === 0) {
    console.log("No low-stock products. All clear.");
    return;
  }

  console.log(`${products.length} product(s) below the low-stock threshold:`);
  for (const product of products) {
    console.log(`  ${product.sku} — ${product.name}: ${product.quantity} left`);
  }

  // Restock the first flagged item as a demonstration of the custom `restock` action.
  const [first] = products;
  try {
    const restocked = await sdk.inventory.products.restock(first.id, { amount: 50 });
    console.log(`Restocked ${restocked.sku} -> ${restocked.quantity} units`);
  } catch (err) {
    if (err instanceof NotFoundError) {
      console.error(`Product ${first.id} was removed before it could be restocked.`);
    } else if (err instanceof ValidationError) {
      console.error("Restock amount was invalid:", err.details);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error("Low-stock alert failed:", err.code ? `[${err.code}] ${err.message}` : err);
  process.exitCode = 1;
});
```

Notice what's absent: no `inventory-service.internal.example.com` string, no `axios.get(...)`, no `response.status === 404` checks. `sdk.inventory.products.restock(id, input)` exists purely because the server declared a `restock` action — add another custom action on the server tomorrow and it shows up here automatically, with no client-side changes.

## 3. `@ecorpin/core` ties both sides together

Both scripts above import error classes from the same package:

- The **server** throws `NotFoundError` / `ConflictError` when a handler detects a problem; `@ecorpin/server` maps any *other* thrown error to a generic `500 ECORPIN_INTERNAL_ERROR`, and maps Zod validation failures on `input` to `400 ECORPIN_VALIDATION_ERROR` automatically.
- The **client** never inspects an HTTP status code. `@ecorpin/client` reconstructs the exact same `EcorpinError` subclass from the response envelope via `errorFromEnvelope()`, so `err instanceof NotFoundError` on the client is true precisely when the server threw a `NotFoundError` — even though the two processes never share code or a deployment.

## Running it yourself

```bash
# Terminal 1 — start the service
mkdir inventory-service && cd inventory-service
npm init -y && npm install @ecorpin/server express zod
ECORPIN_API_KEY=dev-key PORT=4100 node index.js   # paste the server script above into index.js

# Terminal 2 — run the consumer
mkdir low-stock-alert && cd low-stock-alert
npm init -y && npm install @ecorpin/client
SDK_API_KEY=dev-key INVENTORY_SERVICE_URL=http://localhost:4100/api/ecorpin node index.js   # paste the client script above into index.js
```

## See also

- [`packages/server/README.md`](../packages/server/README.md) — full `@ecorpin/server` API reference
- [`packages/client/README.md`](../packages/client/README.md) — full `@ecorpin/client` API reference
- [`packages/core/README.md`](../packages/core/README.md) — the complete `EcorpinError` taxonomy
- [`examples/pilot-consumer`](../examples/pilot-consumer) — the other end-to-end example, wrapping `ecorpin-app`'s real `clients` module instead of a from-scratch service
