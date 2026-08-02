import type { Request, Response } from "express";
import type { z } from "zod";
import type { AuthRequirement, DeprecationNotice, HttpMethod } from "@ecorpin/core";

/**
 * Resolved caller identity attached to `req` by the auth middleware
 * (architecture doc §13.6). `scopes: true` means unrestricted access for
 * that key.
 */
export interface ResolvedAuth {
  key: string;
  scopes: string[] | true;
}

/**
 * Everything a handler needs, without ever touching Express's raw
 * req/url/method — mirrors the "developers think in resources and actions,
 * never URLs" principle even on the provider side.
 */
export interface ActionContext<TInput = unknown> {
  input: TInput;
  params: Record<string, string>;
  query: Record<string, unknown>;
  auth?: ResolvedAuth;
  correlationId: string;
  /** Escape hatch for advanced cases (e.g. reading cookies) — discouraged for normal use. */
  req: Request;
  res: Response;
}

export type ActionHandler<TInput = unknown, TOutput = unknown> = (
  ctx: ActionContext<TInput>
) => Promise<TOutput> | TOutput;

/**
 * Declarative shape a backend team authors with `registerResource()`
 * (architecture doc §11.1). `method`/`path`/`idempotent` are all optional —
 * convention-based inference fills them in from the action name
 * (architecture doc §11.2) unless explicitly overridden here.
 */
export interface ActionDefinition<TInput = unknown, TOutput = unknown> {
  method?: HttpMethod;
  /** Overrides the convention-derived path, relative to the resource base (e.g. "/:id/archive"). */
  path?: string;
  input?: z.ZodType<TInput>;
  output?: z.ZodType<TOutput>;
  auth?: AuthRequirement;
  idempotent?: boolean;
  cacheable?: boolean;
  timeoutMs?: number;
  deprecated?: DeprecationNotice;
  /**
   * Explicit opt-out of the "every mutating action must declare `input`"
   * contract rule (architecture doc §11.3) — required for mutating actions
   * that genuinely take no body (e.g. `archive`).
   */
  allowNoInput?: boolean;
  /**
   * Required alongside `idempotent: true` on a POST-mapped action, since a
   * safe-to-retry POST implies the caller is expected to supply an
   * idempotency key (architecture doc §11.3, §7 failure branch).
   */
  requiresIdempotencyKey?: boolean;
  handler: ActionHandler<TInput, TOutput>;
}

export interface RegisterResourceOptions {
  description?: string;
  actions: Record<string, ActionDefinition>;
}
