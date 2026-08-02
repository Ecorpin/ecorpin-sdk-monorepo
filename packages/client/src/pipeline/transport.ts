import {
  CORRELATION_ID_HEADER,
  NetworkError,
  TimeoutError,
  errorFromEnvelope,
  type ErrorEnvelope,
  type HttpMethod,
  type ResponseEnvelope,
} from "@ecorpin/core";

export interface TransportRequest {
  url: string;
  method: HttpMethod;
  authHeader: { name: "Authorization"; value: string };
  body?: unknown;
  timeoutMs: number;
  correlationId: string;
  service: string;
  resource: string;
  action: string;
}

/**
 * The single seam where an actual HTTP request happens. Everything above
 * this layer (proxy engine, retry, auth) works in terms of
 * service/resource/action; this is the one place that knows about `fetch`,
 * headers, and JSON bodies — kept intentionally small so a future
 * transport swap (HTTP/2, gRPC — architecture doc §20) only touches this
 * file.
 */
export async function performRequest(request: TransportRequest): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);

  const headers: Record<string, string> = {
    [request.authHeader.name]: request.authHeader.value,
    [CORRELATION_ID_HEADER]: request.correlationId,
    Accept: "application/json",
  };
  if (request.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(request.url, {
      method: request.method,
      headers,
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new TimeoutError(`Request timed out after ${request.timeoutMs}ms.`, {
        service: request.service,
        resource: request.resource,
        action: request.action,
        correlationId: request.correlationId,
      });
    }
    throw new NetworkError(err instanceof Error ? err.message : "Network request failed.", {
      service: request.service,
      resource: request.resource,
      action: request.action,
      correlationId: request.correlationId,
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }

  const json = await response.json().catch(() => undefined);

  if (!response.ok) {
    const envelope: ErrorEnvelope =
      json && typeof json === "object" && "error" in (json as Record<string, unknown>)
        ? (json as ErrorEnvelope)
        : { error: { code: "ECORPIN_INTERNAL_ERROR", message: `HTTP ${response.status}` } };
    throw errorFromEnvelope(envelope, {
      service: request.service,
      resource: request.resource,
      action: request.action,
      correlationId: request.correlationId,
    });
  }

  return (json as ResponseEnvelope | undefined)?.data;
}
