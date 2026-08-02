/**
 * Ecorpin SDK Platform — pilot proof script (MVP plan Phase 4).
 *
 * Proves the whole stack end to end against a real, running `ecorpin-app`:
 * `@ecorpin/client` discovers the `crm` service, downloads its metadata,
 * and builds `sdk.crm.clients.*` purely from that manifest. This script
 * never constructs a URL, calls `fetch()`, or names an HTTP method —
 * everything below is `service.resource.action(...)`.
 *
 * Usage:
 *   SDK_API_KEY=<value of ECORPIN_API_KEY in ecorpin-app's .env> \
 *   CRM_SERVICE_URL=http://localhost:5602/api/ecorpin \
 *   node index.js
 *
 * (`CRM_SERVICE_URL` defaults to the value above, matching ecorpin-app's
 * default dev port from docs/PROJECT.md — override it, or set
 * `SDK_SERVICE_CRM_URL` directly, to point at a different environment.)
 */
const { createSDK } = require("@ecorpin/client");

const DEFAULT_CRM_URL = "http://localhost:5602/api/ecorpin";

function log(heading) {
  console.log(`\n${"-".repeat(heading.length)}\n${heading}\n${"-".repeat(heading.length)}`);
}

async function main() {
  const sdk = createSDK({
    // Static fallback registry (architecture doc §8) — only consulted if
    // SDK_SERVICE_CRM_URL isn't already set in the environment.
    registry: { crm: process.env.CRM_SERVICE_URL || DEFAULT_CRM_URL },
  });

  log("1. sdk.crm.clients.list()");
  const listed = await sdk.crm.clients.list({ limit: 5 });
  console.log(`Found ${listed.total} client(s) (showing up to 5):`);
  for (const client of listed.clients) {
    console.log(`  #${client.id} ${client.name} <${client.email || "no email"}> [${client.status}]`);
  }

  log("2. sdk.crm.clients.create(data)");
  const uniqueSuffix = Date.now();
  const created = await sdk.crm.clients.create({
    name: `Pilot Consumer Client ${uniqueSuffix}`,
    email: `pilot-consumer-${uniqueSuffix}@example.com`,
  });
  console.log(`Created client #${created.id}: ${created.name} <${created.email}>`);

  log("3. sdk.crm.clients.get(id)");
  const fetched = await sdk.crm.clients.get(created.id);
  console.log(`Fetched back client #${fetched.id}: ${fetched.name} (status: ${fetched.status})`);

  log("4. sdk.crm.clients.archive(id)");
  const archived = await sdk.crm.clients.archive(created.id);
  console.log(`Archived client #${archived.id} (status: ${archived.status}, archivedAt: ${archived.archivedAt})`);

  log("Pilot succeeded");
  console.log(
    "This script never built a URL, called fetch(), or named an HTTP method — every call above was " +
      "service.resource.action(...), fully driven by the manifest sdk.crm fetched from ecorpin-app's " +
      "/api/ecorpin/discovery endpoint at runtime."
  );
}

main().catch((err) => {
  console.error("\nPilot failed:", err.code ? `[${err.code}] ${err.message}` : err.message || err);
  if (err.details) console.error("Details:", JSON.stringify(err.details, null, 2));
  process.exitCode = 1;
});
