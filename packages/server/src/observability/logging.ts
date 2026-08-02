import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { CORRELATION_ID_HEADER } from "@ecorpin/core";

declare module "express-serve-static-core" {
  interface Request {
    ecorpinCorrelationId?: string;
  }
}

const SECRET_HEADER_PATTERN = /^authorization$/i;

function redactHeaders(headers: Request["headers"]): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SECRET_HEADER_PATTERN.test(key) ? "[redacted]" : value;
  }
  return redacted;
}

/**
 * Assigns (or propagates, if the caller already set one) a correlation ID
 * for this request, so a single cross-service call can be traced end to
 * end (architecture doc §19 "Audit trail").
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(CORRELATION_ID_HEADER);
  const correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
  req.ecorpinCorrelationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}

/**
 * Minimal structured request logger. Redacts `Authorization` (and never
 * logs request bodies, which may contain business data) — see architecture
 * doc §19 "Credential exposure".
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    // eslint-disable-next-line no-console -- v0 uses console; swap for pino in a later phase.
    console.log(
      JSON.stringify({
        level: "info",
        msg: "ecorpin.request",
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
        correlationId: req.ecorpinCorrelationId,
        headers: redactHeaders(req.headers),
      })
    );
  });
  next();
}
