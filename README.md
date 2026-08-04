# Ecorpin SDK Platform

[![Release](https://github.com/Ecorpin/ecorpin-sdk-monorepo/actions/workflows/release.yml/badge.svg)](https://github.com/Ecorpin/ecorpin-sdk-monorepo/actions/workflows/release.yml)
[![Release Python client](https://github.com/Ecorpin/ecorpin-sdk-monorepo/actions/workflows/release-python.yml/badge.svg)](https://github.com/Ecorpin/ecorpin-sdk-monorepo/actions/workflows/release-python.yml)

[![Core](https://img.shields.io/npm/v/%40ecorpin%2Fcore?label=%40ecorpin%2Fcore)](https://www.npmjs.com/package/@ecorpin/core)
[![Client](https://img.shields.io/npm/v/%40ecorpin%2Fclient?label=%40ecorpin%2Fclient)](https://www.npmjs.com/package/@ecorpin/client)
[![Server](https://img.shields.io/npm/v/%40ecorpin%2Fserver?label=%40ecorpin%2Fserver)](https://www.npmjs.com/package/@ecorpin/server)
[![ecorpin-client (Python)](https://img.shields.io/pypi/v/ecorpin-client?label=ecorpin-client)](https://pypi.org/project/ecorpin-client/)

The internal communication layer for all Ecorpin applications (CRM, Inventory, HR, ...). Instead of every app hand-rolling `fetch()`/`axios` calls, hardcoded URLs, and ad-hoc auth headers to talk to each other, services expose themselves once through this framework and consumers get a fully dynamic, type-safe SDK for free:

```ts
const sdk = createSDK();
const customers = await sdk.crm.customers.list();
const product = await sdk.inventory.products.get(productId);
```

No URLs. No HTTP methods. No `fetch()`. Developers think in **Service → Resource → Action**, not URL → HTTP Method → Endpoint.

This repo is an npm-workspaces monorepo publishing three JavaScript/TypeScript packages to npm under the `@ecorpin` scope, plus one standalone Python package published to PyPI.

## Packages

| Package | Install into | What it does |
|---|---|---|
| [`@ecorpin/core`](packages/core) | (transitive) | Shared types, error taxonomy, metadata schema, auth contracts, plugin interfaces. No HTTP, no framework deps. |
| [`@ecorpin/server`](packages/server) | Every service that **exposes** an API | `registerService`/`registerResource` → discovery + health endpoints, auth, validation, logging, an Express router — all generated from your declarations. |
| [`@ecorpin/client`](packages/client) | Every Node.js app that **consumes** a service | `createSDK()` turns any service's metadata into `sdk.<service>.<resource>.<action>()`, with discovery, caching, auth, retries, and timeouts handled for you. |
| [`ecorpin-client`](packages/client-py) (Python, [PyPI](https://pypi.org/project/ecorpin-client/)) | Every Python app that **consumes** a service | The synchronous Python sibling of `@ecorpin/client` — same `sdk.<service>.<resource>.<action>()` model, built on `requests`. |

See each package's own README for detailed usage, or [`examples/pilot-consumer`](examples/pilot-consumer) (Node.js) / [`packages/client-py/examples/pilot_consumer.py`](packages/client-py/examples/pilot_consumer.py) (Python) for a complete, runnable end-to-end script.

## Repo structure

```
utilities/
├── packages/
│   ├── core/        @ecorpin/core
│   ├── server/      @ecorpin/server
│   ├── client/       @ecorpin/client
│   └── client-py/    ecorpin-client (Python) — separate toolchain, not an npm workspace
├── examples/
│   └── pilot-consumer/   standalone script proving the SDK end-to-end against a real running service
├── .changeset/      Changesets config (npm packages' versioning/publishing, see below)
└── .github/workflows/
    ├── release.yml          CI for the 3 npm packages: opens a "Version Packages" PR, publishes once merged
    └── release-python.yml   CI for ecorpin-client: tests, builds, and publishes to PyPI on every change
```

## Prerequisites

- Node.js >= 20 (see [`.nvmrc`](.nvmrc); run `nvm use` if you use nvm) — for `@ecorpin/core`/`server`/`client`
- npm (workspaces are npm-native — no pnpm/yarn required)
- Python >= 3.9 — only if you're working on `packages/client-py` (its own [README](packages/client-py/README.md) has full setup instructions; it's intentionally **not** an npm workspace member)

## Getting started

```bash
npm install     # installs and links all three packages together via npm workspaces
npm run build   # builds @ecorpin/core first, then server + client (order matters — see below)
npm test        # runs the full Vitest suite across all packages
npm run typecheck
```

> **Why build order matters:** `@ecorpin/server` and `@ecorpin/client` both import `@ecorpin/core`'s built type declarations (`dist/index.d.ts`), so `core` is always built first. The root `build`/`typecheck` scripts already encode this — just use `npm run build` / `npm run typecheck` rather than building individual packages out of order.

## Development workflow

| Command | Does |
|---|---|
| `npm run build` | Build all three packages (dual ESM + CJS output via `tsup`) |
| `npm run dev` | Build all packages in watch mode |
| `npm test` / `npm run test:watch` | Run the Vitest suite once / in watch mode |
| `npm run typecheck` | `tsc --noEmit` across every package |

Each package builds to `dist/` with both an ESM (`index.js`) and CJS (`index.cjs`) entry point plus `.d.ts` declarations, so it works from both modern ESM code and existing CommonJS apps (like `ecorpin-app`) via plain `require()`.

## Try it yourself: the pilot integration

[`examples/pilot-consumer`](examples/pilot-consumer) proves the whole stack end-to-end against a real running service (`ecorpin-app`'s `crm` service, wrapping its real `clients` module): `list` → `create` → `get` → `archive`, entirely through `sdk.crm.clients.*`, with zero URLs or `fetch()` calls anywhere in the script.

```bash
# 1. Start ecorpin-app locally (see its own README), then:
cd examples/pilot-consumer
SDK_API_KEY=<value of ECORPIN_API_KEY in ecorpin-app's .env> \
CRM_SERVICE_URL=http://localhost:5602/api/ecorpin \
node index.js
```

## Versioning & publishing

Versioning is handled by [Changesets](https://github.com/changesets/changesets), with each package versioned **independently** (only packages that actually changed get bumped).

**Day-to-day workflow:**

1. Make your change, then record it: `npm run changeset` — pick which package(s) changed, the semver bump (patch/minor/major), and a short description.
2. Commit the generated `.changeset/*.md` file with your PR and merge to `master`.
3. CI ([`.github/workflows/release.yml`](.github/workflows/release.yml)) automatically opens/updates a **"Version Packages" PR** that applies the version bump(s) + changelog(s), and updates any internal `@ecorpin/core` dependency ranges in `server`/`client` accordingly.
4. Merging that PR triggers CI to build, test, and `npm publish` every changed package automatically — versions are never bumped or published by hand.

Useful local commands: `npm run changeset:status` (preview pending bumps without applying them), `npm run version` (apply changesets locally), `npm run release` (build + test + publish — normally only run by CI).

Publishing authenticates via npm's OIDC **Trusted Publishing** (no stored tokens) — see the top of `release.yml` for the one-time bootstrap required per package before this works (npm doesn't allow OIDC publishing for a package's very first version).

### Python client (`ecorpin-client`)

`packages/client-py` isn't part of the Changesets flow above — it's versioned by hand in its own `pyproject.toml`. Bump `version` there as part of your PR; [`release-python.yml`](.github/workflows/release-python.yml) tests, builds, and publishes to PyPI on every push to `master` that touches the package, authenticating via PyPI's OIDC **Trusted Publishing** (no stored tokens). Unlike npm, PyPI supports a **pending publisher** — you can register the trust relationship before the project's first-ever publish (see the comment at the top of that workflow file), so there's no manual first-publish bootstrap step required.

## Architecture

The full design — discovery strategy, metadata format, dynamic SDK generation, plugin system, caching/versioning/security considerations, and the long-term roadmap — is documented in `docs/SDK_PLATFORM_ARCHITECTURE.md` in the parent workspace. This repo implements Phases 0–4 of that roadmap (scaffold → `@ecorpin/core` → `@ecorpin/server` v0 → `@ecorpin/client` v0 → the pilot integration above).

## License

MIT
