import { EcorpinError, type ErrorEnvelope } from "@ecorpin/core";

export interface MappedError {
  httpStatus: number;
  envelope: ErrorEnvelope;
  /** The original error, kept for server-side logging — never sent on the wire. */
  cause: unknown;
}

/**
 * Legacy shape already used throughout ecorpin-app's service layer:
 * `const err = new Error("Forbidden"); err.status = 403; throw err;`
 * (see ecorpin-app/src/modules/clients/client.service.js). Mapped here so
 * existing handlers can be wrapped by `registerResource()` completely
 * unmodified.
 */
interface LegacyStatusError extends Error {
  status?: number;
  code?: string;
}

function isLegacyStatusError(err: unknown): err is LegacyStatusError {
  return err instanceof Error && typeof (err as LegacyStatusError).status === "number";
}

interface ZodLikeError extends Error {
  name: "ZodError";
  issues: unknown[];
}

/**
 * Duck-typed rather than `instanceof ZodError`: `zod` is a *peer*
 * dependency (deliberately not bundled, see `tsup.config.ts`'s
 * `external`), and a host app installs its own copy to build its own
 * schemas (as `client.schemas.js` does in ecorpin-app). npm can easily end
 * up with two separate `zod` module instances — the host's and whatever
 * `@ecorpin/server` itself resolves — in which case `instanceof` against
 * *our* `ZodError` class silently fails even for a real Zod validation
 * error thrown by the host's schema. Structural detection has no such
 * cross-instance failure mode.
 */
function isZodError(err: unknown): err is ZodLikeError {
  return err instanceof Error && err.name === "ZodError" && Array.isArray((err as ZodLikeError).issues);
}

const LEGACY_STATUS_TO_CODE: Record<number, string> = {
  400: "ECORPIN_VALIDATION_ERROR",
  401: "ECORPIN_UNAUTHENTICATED",
  403: "ECORPIN_FORBIDDEN",
  404: "ECORPIN_NOT_FOUND",
  409: "ECORPIN_CONFLICT",
  429: "ECORPIN_RATE_LIMITED",
  503: "ECORPIN_SERVICE_UNAVAILABLE",
};

/**
 * Server-side error-boundary mapping (architecture doc §16.3): any thrown
 * `EcorpinError` is serialized as-is; a Zod validation failure becomes
 * `ECORPIN_VALIDATION_ERROR`; a legacy `{ status, message }` error (the
 * pattern already used across ecorpin-app) is mapped via its HTTP status;
 * anything else is wrapped as an opaque `ECORPIN_INTERNAL_ERROR` so
 * internals never leak onto the wire.
 */
export function mapThrownError(err: unknown, correlationId: string): MappedError {
  if (err instanceof EcorpinError) {
    return {
      httpStatus: err.httpStatus || 500,
      envelope: { error: { code: err.code, message: err.message, details: err.details, correlationId } },
      cause: err,
    };
  }

  if (isZodError(err)) {
    return {
      httpStatus: 400,
      envelope: {
        error: {
          code: "ECORPIN_VALIDATION_ERROR",
          message: "Request failed validation.",
          details: err.issues,
          correlationId,
        },
      },
      cause: err,
    };
  }

  if (isLegacyStatusError(err)) {
    const status = err.status ?? 500;
    const code = LEGACY_STATUS_TO_CODE[status] ?? "ECORPIN_INTERNAL_ERROR";
    return {
      httpStatus: status,
      envelope: { error: { code, message: err.message, correlationId } },
      cause: err,
    };
  }

  return {
    httpStatus: 500,
    envelope: { error: { code: "ECORPIN_INTERNAL_ERROR", message: "Internal server error.", correlationId } },
    cause: err,
  };
}
