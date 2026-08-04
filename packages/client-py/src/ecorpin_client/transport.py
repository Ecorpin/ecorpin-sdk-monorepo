"""
The single seam where an actual HTTP request happens. Everything above this
layer (SDK namespaces, retry, auth) works in terms of service/resource/action;
this is the one place that knows about `requests`, headers, and JSON bodies —
kept intentionally small so a future transport swap only touches this file.
Mirrors @ecorpin/client's pipeline/transport.ts.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests

from .constants import CORRELATION_ID_HEADER
from .errors import NetworkError, TimeoutError, error_from_envelope


@dataclass
class TransportRequest:
    url: str
    method: str
    auth_header: tuple[str, str]
    body: Any
    timeout_ms: int
    correlation_id: str
    service: str
    resource: str
    action: str


def perform_request(request: TransportRequest, session: requests.Session) -> Any:
    headers = {
        request.auth_header[0]: request.auth_header[1],
        CORRELATION_ID_HEADER: request.correlation_id,
        "Accept": "application/json",
    }
    json_body = None
    if request.body is not None:
        headers["Content-Type"] = "application/json"
        json_body = request.body

    try:
        response = session.request(
            request.method,
            request.url,
            headers=headers,
            json=json_body,
            timeout=request.timeout_ms / 1000,
        )
    except requests.exceptions.Timeout as err:
        raise TimeoutError(
            f"Request timed out after {request.timeout_ms}ms.",
            service=request.service,
            resource=request.resource,
            action=request.action,
            correlation_id=request.correlation_id,
            cause=err,
        ) from err
    except requests.exceptions.RequestException as err:
        raise NetworkError(
            str(err) or "Network request failed.",
            service=request.service,
            resource=request.resource,
            action=request.action,
            correlation_id=request.correlation_id,
            cause=err,
        ) from err

    try:
        payload = response.json()
    except ValueError:
        payload = None

    if not response.ok:
        envelope = (
            payload
            if isinstance(payload, dict) and "error" in payload
            else {"error": {"code": "ECORPIN_INTERNAL_ERROR", "message": f"HTTP {response.status_code}"}}
        )
        raise error_from_envelope(
            envelope,
            service=request.service,
            resource=request.resource,
            action=request.action,
            correlation_id=request.correlation_id,
        )

    return (payload or {}).get("data") if isinstance(payload, dict) else None
