import { EcorpinError, type EcorpinErrorContext } from "./base.js";
import { ERROR_CODE_REGISTRY, UnknownEcorpinError } from "./taxonomy.js";
import type { ErrorEnvelope } from "../types/response.js";

/**
 * Reconstructs a typed `EcorpinError` from a wire-format error envelope
 * (architecture doc §16.2/§16.4). Falls back to `UnknownEcorpinError` for
 * an unrecognized `code` — e.g. a server running a newer `@ecorpin/core`
 * than the client — so callers never have to special-case an unknown error.
 */
export function errorFromEnvelope(
  envelope: ErrorEnvelope,
  context: Omit<EcorpinErrorContext, "details"> = {}
): EcorpinError {
  const { code, message, details, correlationId } = envelope.error;
  const ErrorClass = ERROR_CODE_REGISTRY[code];
  const mergedContext: EcorpinErrorContext = {
    ...context,
    details,
    // The envelope's own correlationId (set server-side) wins when present;
    // otherwise fall back to whatever correlationId the caller already
    // knows (e.g. the client's own request context) rather than losing it.
    correlationId: correlationId ?? context.correlationId,
  };
  if (ErrorClass) {
    return new ErrorClass(message, mergedContext);
  }
  return new UnknownEcorpinError(message, { code, ...mergedContext });
}
