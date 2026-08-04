# Ecorpin SDK Platform

[![JS Releases](https://github.com/Ecorpin/ecorpin-sdk-monorepo/actions/workflows/release.yml/badge.svg)](https://github.com/Ecorpin/ecorpin-sdk-monorepo/actions/workflows/release.yml)
[![Release Python client](https://github.com/Ecorpin/ecorpin-sdk-monorepo/actions/workflows/release-python.yml/badge.svg)](https://github.com/Ecorpin/ecorpin-sdk-monorepo/actions/workflows/release-python.yml)

Internal communication layer for Ecorpin apps. Services expose themselves once; consumers call them as `sdk.<service>.<resource>.<action>(...)` — no URLs, no HTTP methods, no `fetch()` / `requests` in application code.

```ts
// Node.js
const sdk = createSDK();
const customers = await sdk.crm.customers.list();
```

```python
# Python
sdk = create_sdk()
customers = sdk.crm.customers.list()
```

| | |
|---|---|
| **Consumers** (install & use) | [Install](#install) · [Which package do I need?](#which-package-do-i-need) · [Package versions](#package-versions) |
| **Contributors** (this repo) | [Monorepo layout](#monorepo-layout) · [Local development](#local-development) · [Releasing](#releasing-packages) |

---

## Install

**Node.js** (service that *exposes* an API):

```bash
npm install @ecorpin/server
```

**Node.js** (app that *calls* other services):

```bash
npm install @ecorpin/client
```

**Python** (app that *calls* other services):

```bash
pip install ecorpin-client
```

`@ecorpin/core` is pulled in automatically by the JS client/server — you normally don't install it directly.

Full guides: [`@ecorpin/server`](packages/server/README.md) · [`@ecorpin/client`](packages/client/README.md) · [`ecorpin-client` (Python)](packages/client-py/README.md)

---

## Which package do I need?

| I want to… | Install | Language |
|---|---|---|
| Expose my Express service as `sdk.<name>.*` | [`@ecorpin/server`](https://www.npmjs.com/package/@ecorpin/server) | Node.js |
| Call other services from a Node app / script | [`@ecorpin/client`](https://www.npmjs.com/package/@ecorpin/client) | Node.js |
| Call other services from Python | [`ecorpin-client`](https://pypi.org/project/ecorpin-client/) | Python |
| Share types/errors only (rare) | [`@ecorpin/core`](https://www.npmjs.com/package/@ecorpin/core) | Node.js |

---

## Package versions

Versions are **independent** per package. Badges show the **latest published** version on npm / PyPI (always current). The “In repo” column is the version in this git tree (`package.json` / `pyproject.toml`) — useful when working on `master` before a release lands.

| Package | Latest published | In repo | Registry | Source |
|---|---|---|---|---|
| `@ecorpin/core` | [![npm](https://img.shields.io/npm/v/%40ecorpin%2Fcore?label=)](https://www.npmjs.com/package/@ecorpin/core) | `1.0.0` | [npm](https://www.npmjs.com/package/@ecorpin/core) | [`packages/core`](packages/core) |
| `@ecorpin/server` | [![npm](https://img.shields.io/npm/v/%40ecorpin%2Fserver?label=)](https://www.npmjs.com/package/@ecorpin/server) | `1.0.0` | [npm](https://www.npmjs.com/package/@ecorpin/server) | [`packages/server`](packages/server) |
| `@ecorpin/client` | [![npm](https://img.shields.io/npm/v/%40ecorpin%2Fclient?label=)](https://www.npmjs.com/package/@ecorpin/client) | `1.0.0` | [npm](https://www.npmjs.com/package/@ecorpin/client) | [`packages/client`](packages/client) |
| `ecorpin-client` | [![PyPI](https://img.shields.io/pypi/v/ecorpin-client?label=)](https://pypi.org/project/ecorpin-client/) | `1.0.0` | [PyPI](https://pypi.org/project/ecorpin-client/) | [`packages/client-py`](packages/client-py) |

> When you cut a release, update the **In repo** column in this table to match the new versions (Changesets updates `package.json` automatically; for Python you bump `pyproject.toml` by hand).

**What each package does**

| Package | Role |
|---|---|
| `@ecorpin/core` | Shared types, error taxonomy, metadata schema. No HTTP. |
| `@ecorpin/server` | `registerService` / `registerResource` → discovery, auth, validation, Express router. |
| `@ecorpin/client` | `createSDK()` → dynamic `sdk.<service>.<resource>.<action>()`, discovery, retries, auth. |
| `ecorpin-client` | Same consumer SDK for Python (`requests`, sync). |

---

## Monorepo layout

One git repo, four publishable packages, two registries. Packages stay wire-compatible in source (`core` is shared), but each is versioned and published on its own — changing one package does **not** republish the others unless you include them in a release.

```
utilities/                          ← repo root (not published)
├── packages/
│   ├── core/                       @ecorpin/core      → npm
│   ├── server/                     @ecorpin/server    → npm  (depends on core)
│   ├── client/                     @ecorpin/client    → npm  (depends on core)
│   └── client-py/                  ecorpin-client     → PyPI (not an npm workspace)
├── examples/pilot-consumer/        Node proof script (never published)
├── .changeset/                     versioning for the three npm packages
└── .github/workflows/
    ├── release.yml                 npm releases
    └── release-python.yml          PyPI releases
```

---

## Local development

**Prerequisites:** Node.js >= 20 ([`.nvmrc`](.nvmrc)), npm. Python >= 3.9 only if you touch `packages/client-py`.

```bash
npm install
npm run build      # core first, then server + client
npm test
npm run typecheck
```

| Command | Does |
|---|---|
| `npm run build` | Build JS packages (ESM + CJS via `tsup`) |
| `npm run dev` | Watch mode |
| `npm test` | Vitest across JS packages |
| `npm run typecheck` | `tsc --noEmit` |

Python package (separate from npm workspaces):

```bash
cd packages/client-py
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[test]"
pytest
```

### Pilot (end-to-end against a running service)

With `ecorpin-app` running locally:

```bash
cd examples/pilot-consumer
SDK_API_KEY=<ECORPIN_API_KEY from ecorpin-app .env> \
CRM_SERVICE_URL=http://localhost:5602/api/ecorpin \
node index.js
```

Python equivalent: [`packages/client-py/examples/pilot_consumer.py`](packages/client-py/examples/pilot_consumer.py).

---

## Releasing packages

Two paths — don't mix them:

| Packages | How you bump the version | When it publishes | Registry |
|---|---|---|---|
| `@ecorpin/core`, `server`, `client` | `npm run changeset` | After you merge CI's **"Version Packages"** PR | npm |
| `ecorpin-client` | Edit `pyproject.toml` + `__version__` | On push to `master` under `packages/client-py/**` | PyPI |

### CI tests ≠ CI publishes

| Workflow | When it runs | Tests | Publishes |
|---|---|---|---|
| [`release.yml`](.github/workflows/release.yml) | Every push to `master` | All three JS packages | **Only** packages bumped by a changeset |
| [`release-python.yml`](.github/workflows/release-python.yml) | Changes under `packages/client-py/**` | Python tests | Python only (`skip-existing` if version already on PyPI) |

Changing `@ecorpin/client` alone does **not** publish `core` or `server`.

### Release npm packages

1. Change code under `packages/core`, `server`, and/or `client`.
2. `npm run changeset` — select **only** packages that need a release, pick patch/minor/major, write a short note.
3. Commit the new `.changeset/*.md` file and merge your PR to `master`.
4. CI opens a **"Version Packages"** PR (bumps `package.json`, changelogs, internal `@ecorpin/core` ranges).
5. **Merge that PR** → CI runs `changeset publish` for the bumped packages only and tags them (e.g. `@ecorpin/client@1.1.0`).
6. Update the **In repo** versions in the [Package versions](#package-versions) table above if they changed.

Do **not** hand-edit npm `package.json` versions — Changesets owns that.

| Command | Does |
|---|---|
| `npm run changeset` | Record a pending release |
| `npm run changeset:status` | Preview pending bumps |
| `npm run version` | Apply changesets locally (same as CI) |
| `npm run release` | Build + test + publish (CI normally does this) |

**GitHub setting (required):** Settings → Actions → General → Workflow permissions → **Read and write** + **Allow GitHub Actions to create and approve pull requests**. Without this, the Version Packages PR fails.

**npm Trusted Publishing:** workflow uses OIDC (`id-token: write`). Each package needed a one-time first publish, then a Trusted Publisher on npmjs.com (org `Ecorpin`, repo `ecorpin-sdk-monorepo`, workflow `release.yml`).

### Release Python (`ecorpin-client`)

1. Bump **both**:
   - `packages/client-py/pyproject.toml` → `version = "x.y.z"`
   - `packages/client-py/src/ecorpin_client/__init__.py` → `__version__ = "x.y.z"`
2. Update the **In repo** cell for `ecorpin-client` in the [Package versions](#package-versions) table.
3. Merge/push to `master` → [`release-python.yml`](.github/workflows/release-python.yml) tests, builds, and publishes to PyPI.

**PyPI Trusted Publishing (one-time):** [pending publisher](https://pypi.org/manage/account/publishing/) with project `ecorpin-client`, owner `Ecorpin`, repo `ecorpin-sdk-monorepo`, workflow `release-python.yml`, environment `pypi`. Create a matching GitHub Environment named `pypi`. No API token needed.

### Quick reference

| You changed… | Bump how? | What gets published |
|---|---|---|
| Only `@ecorpin/client` | changeset → **client** | Only `@ecorpin/client` |
| Only `@ecorpin/server` | changeset → **server** | Only `@ecorpin/server` |
| `@ecorpin/core` (shared API) | changeset → **core** (+ usually server & client) | Whatever you selected |
| Only `packages/client-py` | bump `pyproject.toml` + `__version__` | Only `ecorpin-client` on PyPI |
| Docs / this README only | — | Nothing |

---

## Architecture

Design notes (discovery, metadata, dynamic SDK, roadmap) live in `docs/SDK_PLATFORM_ARCHITECTURE.md` in the parent workspace. This repo implements Phases 0–4 of that plan.

## License

MIT
