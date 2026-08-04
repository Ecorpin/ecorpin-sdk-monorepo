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

This repo is a **monorepo**: one git repository, four publishable packages, two registries (npm + PyPI). Packages share protocol/types in source so `@ecorpin/core`, `@ecorpin/server`, and `@ecorpin/client` stay wire-compatible — but each package is **versioned and published independently**. Changing one package does **not** bump or republish the others (unless you explicitly include them in a changeset, or a `@ecorpin/core` bump triggers Changesets' internal-dependency patch update on `server`/`client`).

## Packages

| Package | Registry | Install into | What it does |
|---|---|---|---|
| [`@ecorpin/core`](packages/core) | npm | (transitive) | Shared types, error taxonomy, metadata schema, auth contracts, plugin interfaces. No HTTP, no framework deps. |
| [`@ecorpin/server`](packages/server) | npm | Every service that **exposes** an API | `registerService`/`registerResource` → discovery + health endpoints, auth, validation, logging, an Express router — all generated from your declarations. |
| [`@ecorpin/client`](packages/client) | npm | Every Node.js app that **consumes** a service | `createSDK()` turns any service's metadata into `sdk.<service>.<resource>.<action>()`, with discovery, caching, auth, retries, and timeouts handled for you. |
| [`ecorpin-client`](packages/client-py) | [PyPI](https://pypi.org/project/ecorpin-client/) | Every Python app that **consumes** a service | The synchronous Python sibling of `@ecorpin/client` — same `sdk.<service>.<resource>.<action>()` model, built on `requests`. |

See each package's own README for detailed usage, or [`examples/pilot-consumer`](examples/pilot-consumer) (Node.js) / [`packages/client-py/examples/pilot_consumer.py`](packages/client-py/examples/pilot_consumer.py) (Python) for a complete, runnable end-to-end script.

## Repo structure

```
utilities/                          ← monorepo root (private; not published)
├── packages/
│   ├── core/                       @ecorpin/core          → npm
│   ├── server/                     @ecorpin/server        → npm  (depends on @ecorpin/core)
│   ├── client/                     @ecorpin/client        → npm  (depends on @ecorpin/core)
│   └── client-py/                  ecorpin-client         → PyPI (own toolchain; not an npm workspace)
├── examples/
│   └── pilot-consumer/             local proof script (private; never published)
├── .changeset/                     Changesets config for the three npm packages
└── .github/workflows/
    ├── release.yml                 npm: Version Packages PR → publish changed packages only
    └── release-python.yml          PyPI: test + publish when packages/client-py/** changes
```

**npm workspaces** link `core` / `server` / `client` / `examples/*` for local development. `client-py` is listed explicitly *out* of workspaces so npm never tries to treat it as a Node package.

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

## Versioning & releasing packages

This monorepo has **two release paths**. Do not mix them up:

| Packages | Version bump | Publish trigger | Registry |
|---|---|---|---|
| `@ecorpin/core`, `@ecorpin/server`, `@ecorpin/client` | [Changesets](https://github.com/changesets/changesets) (`npm run changeset`) | Merge the **"Version Packages"** PR that CI opens on `master` | npm |
| `ecorpin-client` (Python) | Hand-edit `version` in `packages/client-py/pyproject.toml` (and `__version__` in `src/ecorpin_client/__init__.py`) | Push to `master` that touches `packages/client-py/**` | PyPI |

### What CI runs vs what gets published

Important distinction:

- **`release.yml` (npm):** on every push to `master`, CI **builds and tests all three JS packages**. That does **not** mean all three are published. `changeset publish` only uploads packages whose version was bumped by a merged changeset.
- **`release-python.yml` (PyPI):** only runs when `packages/client-py/**` (or that workflow file) changes. It builds/tests/publishes Python only. If the version on PyPI already matches `pyproject.toml`, publish is a no-op (`skip-existing: true`).

So: changing `@ecorpin/client` alone → CI may still test `core`/`server`, but only `client` is published (once you've filed a changeset for it and merged the Version Packages PR). Unrelated packages keep their previous npm versions.

### Release npm packages (`@ecorpin/*`)

**Day-to-day workflow:**

1. Make your code change in `packages/core`, `packages/server`, and/or `packages/client`.
2. Record it: `npm run changeset`
   - Select **only** the package(s) that actually need a release.
   - Choose semver bump: `patch` / `minor` / `major`.
   - Write a short changelog description.
3. Commit the generated `.changeset/<id>.md` file with your feature PR and merge to `master`.
4. CI ([`release.yml`](.github/workflows/release.yml)) opens or updates a **"Version Packages"** PR. That PR:
   - bumps `version` in the selected `package.json` file(s)
   - updates changelogs
   - patches internal `@ecorpin/core` dependency ranges in `server`/`client` when core itself was bumped (`updateInternalDependencies: "patch"`)
5. **Merge the Version Packages PR.** That second push to `master` has no remaining changesets, so CI runs `changeset publish` and publishes **only the bumped packages** to npm, then creates git tags (e.g. `@ecorpin/client@1.1.0`).

Never bump `package.json` versions by hand for the npm packages — Changesets owns that.

**Useful local commands:**

| Command | Does |
|---|---|
| `npm run changeset` | Create a changeset after a change |
| `npm run changeset:status` | Preview pending bumps without applying them |
| `npm run version` | Apply changesets locally (same as CI's version step) |
| `npm run release` | Build + test + `changeset publish` — normally only run by CI |

**Auth (OIDC Trusted Publishing):** `release.yml` uses `id-token: write` so npm can authenticate without a long-lived token. npm does **not** allow OIDC for a package's very first version — each `@ecorpin/*` package needed a one-time manual first publish, then a Trusted Publisher registered on npmjs.com (org `Ecorpin`, repo `ecorpin-sdk-monorepo`, workflow `release.yml`). After that, CI publishes automatically.

**GitHub repo setting required for the Version Packages PR:** under **Settings → Actions → General → Workflow permissions**, enable **Read and write permissions** and **Allow GitHub Actions to create and approve pull requests**. Without that, Changesets fails with *"GitHub Actions is not permitted to create or approve pull requests"* even though the workflow already declares `pull-requests: write`.

### Release the Python client (`ecorpin-client`)

`packages/client-py` is **not** in Changesets. Version by hand, publish via [`release-python.yml`](.github/workflows/release-python.yml).

1. Bump both:
   - `packages/client-py/pyproject.toml` → `version = "x.y.z"`
   - `packages/client-py/src/ecorpin_client/__init__.py` → `__version__ = "x.y.z"`
2. Commit, merge/push to `master` (any change under `packages/client-py/**` is enough to trigger the workflow).
3. CI runs pytest, builds sdist + wheel, and publishes to PyPI.

**Auth (OIDC Trusted Publishing):** register a **pending** publisher on [pypi.org/manage/account/publishing/](https://pypi.org/manage/account/publishing/) *before* the first publish:

| Field | Value |
|---|---|
| PyPI project name | `ecorpin-client` |
| Owner | `Ecorpin` |
| Repository name | `ecorpin-sdk-monorepo` |
| Workflow filename | `release-python.yml` |
| Environment name | `pypi` |

Also create a GitHub Environment named `pypi` on this repo (must match the workflow). Unlike npm, PyPI pending publishers work before the project exists — the first successful CI run creates the project. No API token is required.

### Quick reference: "I changed X — what do I do?"

| You changed… | Version bump | What gets published |
|---|---|---|
| Only `@ecorpin/client` | `npm run changeset` → select **client** only | Only `@ecorpin/client` (after Version Packages PR merge) |
| Only `@ecorpin/server` | changeset → **server** only | Only `@ecorpin/server` |
| `@ecorpin/core` (API/protocol) | changeset → **core**, and usually **server** + **client** if they must ship together | Whatever you selected (+ patch bumps on dependents if core's range changes) |
| Only `packages/client-py` | bump `pyproject.toml` + `__version__` | Only `ecorpin-client` on PyPI |
| Docs / root README only | nothing | nothing published |

## Architecture

The full design — discovery strategy, metadata format, dynamic SDK generation, plugin system, caching/versioning/security considerations, and the long-term roadmap — is documented in `docs/SDK_PLATFORM_ARCHITECTURE.md` in the parent workspace. This repo implements Phases 0–4 of that roadmap (scaffold → `@ecorpin/core` → `@ecorpin/server` v0 → `@ecorpin/client` v0 → the pilot integration above).

## License

MIT
