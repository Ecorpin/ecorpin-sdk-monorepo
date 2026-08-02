export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
  message?: string;
  [key: string]: unknown;
}

/**
 * Wire-format success envelope. Mirrors the convention already used by
 * ecorpin-app (`{ data: T, meta?: {...} }`, see docs/PROJECT.md §3.8 / §5.3)
 * so the framework standardizes an existing pattern rather than inventing
 * an incompatible one.
 */
export interface ResponseEnvelope<TOutput = unknown> {
  data: TOutput;
  meta?: ResponseMeta;
}

/**
 * Wire-format error envelope. Reconstructed into an `EcorpinError` subclass
 * on the client (see errors/taxonomy.ts).
 */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlationId?: string;
  };
}
