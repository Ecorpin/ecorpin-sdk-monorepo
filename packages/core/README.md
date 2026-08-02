# @ecorpin/core

Shared foundation for the **Ecorpin Service SDK Framework**: types, a structured error taxonomy, the metadata manifest shape, auth contracts, and plugin interfaces. No HTTP logic, no framework dependencies — every other Ecorpin package (`@ecorpin/server`, `@ecorpin/client`) depends on this one, and it depends on nothing but the standard library.

You usually don't install this directly; it comes in as a transitive dependency of `@ecorpin/server` or `@ecorpin/client`. Install it yourself only if you need its types/errors directly (e.g. to type a shared library, or to catch `EcorpinError` subclasses in code that isn't itself an Ecorpin service or SDK consumer).

## Install

```bash
npm install @ecorpin/core
```

## What's inside

| Module | Purpose |
|---|---|
| `types/*` | `ServiceMetadata`, `ResourceMetadata`, `ActionMetadata`, request/response envelopes, `SDKConfig` |
| `errors/*` | The `EcorpinError` base class + full taxonomy (below), and `errorFromEnvelope()` to reconstruct a typed error from a wire response |
| `auth/contracts.ts` | `Credentials`, `AuthHeader`, `ServiceIdentity` — interfaces only, no token logic |
| `metadata/schema.ts` | `METADATA_PROTOCOL_VERSION`, `isProtocolVersionCompatible()`, `isServiceMetadata()` |
| `plugins/contracts.ts` | `EcorpinPlugin`, `ClientPluginHooks`, `ServerPluginHooks` — the extension points future packages (`@ecorpin/events`, `@ecorpin/realtime`, ...) will hook into |
| `constants.ts` | Protocol/schema versions, default timeouts, retry counts, header names |
| `utils/*` | Pure helpers: URL-safe name validation, deterministic JSON stringify + content hashing (used for `metadataHash`/ETags), a minimal semver comparer |

## Error taxonomy

Every error raised by `@ecorpin/server` or reconstructed by `@ecorpin/client` is an `EcorpinError` with a stable `code`, an HTTP status, and a `retryable` flag:

| Class | `code` | HTTP | Retryable |
|---|---|---|---|
| `ValidationError` | `ECORPIN_VALIDATION_ERROR` | 400 | no |
| `AuthenticationError` | `ECORPIN_UNAUTHENTICATED` | 401 | no |
| `AuthorizationError` | `ECORPIN_FORBIDDEN` | 403 | no |
| `NotFoundError` | `ECORPIN_NOT_FOUND` | 404 | no |
| `ConflictError` | `ECORPIN_CONFLICT` | 409 | no |
| `RateLimitError` | `ECORPIN_RATE_LIMITED` | 429 | yes |
| `InternalServiceError` | `ECORPIN_INTERNAL_ERROR` | 500 | no |
| `ServiceUnavailableError` | `ECORPIN_SERVICE_UNAVAILABLE` | 503 | yes |
| `TimeoutError` | `ECORPIN_TIMEOUT` | 504 | yes |
| `NetworkError` | `ECORPIN_NETWORK_ERROR` | — | yes |
| `DiscoveryError` | `ECORPIN_DISCOVERY_FAILED` | — | yes |
| `MetadataError` | `ECORPIN_METADATA_INVALID` | — | no |
| `FeatureNotSupportedError` | `ECORPIN_FEATURE_UNSUPPORTED` | — | no |
| `PluginError` | `ECORPIN_PLUGIN_ERROR` | — | no |
| `UnknownEcorpinError` | (fallback) | — | no |

`UnknownEcorpinError` is what `@ecorpin/client` reconstructs when it sees an error `code` it doesn't recognize (e.g. talking to a service running a newer `@ecorpin/core`) — it defaults to non-retryable rather than guessing.

## Example

```ts
import { NotFoundError, ValidationError, errorFromEnvelope, type EcorpinError } from "@ecorpin/core";

// Throwing a typed error from your own code:
throw new NotFoundError("Client #42 not found", { resource: "clients", action: "get" });

// Reconstructing a typed error from a wire response (this is what
// @ecorpin/client does internally after every failed request):
const reconstructed: EcorpinError = errorFromEnvelope({
  code: "ECORPIN_VALIDATION_ERROR",
  message: "email must be a valid email address",
  correlationId: "c1a2b3",
});

if (reconstructed instanceof ValidationError) {
  console.log(reconstructed.retryable); // false
}
```

## Part of the Ecorpin SDK Platform

- [`@ecorpin/server`](../server) — expose your service's resources/actions
- [`@ecorpin/client`](../client) — consume any Ecorpin service as `sdk.<service>.<resource>.<action>()`

## License

MIT
