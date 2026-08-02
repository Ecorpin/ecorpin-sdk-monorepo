/**
 * Common query-shape for `list` actions. Individual services may extend
 * this with resource-specific filters in their own input schema.
 */
export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [filterKey: string]: unknown;
}

/**
 * Context passed to a request as it moves through the client pipeline
 * (architecture doc §7) and to server-side plugin hooks. Carries enough
 * to correlate a call across services without leaking transport details
 * into application code.
 */
export interface RequestContext {
  service: string;
  resource: string;
  action: string;
  correlationId: string;
  attempt: number;
}

/**
 * The envelope actually sent on the wire for a mutating action. Not used
 * for GET requests, where args map to path/query params instead.
 */
export interface RequestEnvelope<TInput = unknown> {
  data: TInput;
}
