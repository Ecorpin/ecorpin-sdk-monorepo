import type { AuthStrategyName } from "../types/service.js";

/**
 * `AuthStrategyName` and `AuthRequirement` are defined once in `../types`
 * (the wire-format module) and reused here rather than redeclared, to avoid
 * duplicate-export ambiguity from the package's top-level barrel.
 */

/**
 * A resolved `Authorization` header ready to attach to a request.
 */
export interface AuthHeader {
  name: "Authorization";
  value: string;
}

/**
 * Interface only — no token issuing/verifying logic lives in `@ecorpin/core`.
 * `@ecorpin/client` provides concrete implementations (static API key,
 * future OAuth2 client-credentials, ...) per architecture doc §13.2/§13.4.
 */
export interface Credentials {
  readonly strategy: AuthStrategyName;
  getHeader(): Promise<AuthHeader>;
  /** Force a refresh ahead of the normal TTL, e.g. after a 401. */
  forceRefresh?(): Promise<void>;
  /** Register a callback fired when the underlying credential rotates. */
  onRotate?(callback: () => void): void;
}

/**
 * Identity of a consuming application as understood by a provider service —
 * used by future service-token / OAuth2 strategies to express "who is
 * calling" beyond a bare API key.
 */
export interface ServiceIdentity {
  serviceName: string;
  issuedTo: string;
  scopes: string[];
  expiresAt?: string;
}
