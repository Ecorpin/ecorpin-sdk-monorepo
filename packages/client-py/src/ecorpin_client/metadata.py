"""
Structural validation of a Metadata Manifest (@ecorpin/server's
`GET /discovery` response), mirroring @ecorpin/core's metadata/schema.ts.
Manifests are kept as plain `dict`s rather than dataclasses — intentionally
permissive on unknown/optional fields so additive manifest changes never
break older clients (same rationale as the TS version).
"""
from __future__ import annotations

from typing import Any

from .constants import METADATA_PROTOCOL_VERSION


def _parse_major(version: str) -> int | None:
    major = version.split(".")[0] if version else ""
    try:
        return int(major)
    except (ValueError, TypeError):
        return None


def is_protocol_version_compatible(manifest_protocol_version: str) -> bool:
    """True if this client's `METADATA_PROTOCOL_VERSION` shares the manifest's major segment."""
    client_major = _parse_major(METADATA_PROTOCOL_VERSION)
    manifest_major = _parse_major(manifest_protocol_version)
    if client_major is None or manifest_major is None:
        return False
    return client_major == manifest_major


def is_service_metadata(value: Any) -> bool:
    """Shallow shape-check that `value` looks like a `ServiceMetadata` manifest."""
    if not isinstance(value, dict):
        return False
    service = value.get("service")
    authentication = value.get("authentication")
    return (
        isinstance(value.get("protocolVersion"), str)
        and isinstance(service, dict)
        and isinstance(service.get("name"), str)
        and isinstance(service.get("version"), str)
        and isinstance(authentication, dict)
        and isinstance(value.get("resources"), list)
        and isinstance(value.get("metadataHash"), str)
        and isinstance(value.get("generatedAt"), str)
    )


def is_url_safe_name(name: str) -> bool:
    """Mirrors @ecorpin/core's `isUrlSafeName`: lowercase kebab-case identifiers only."""
    import re

    return bool(re.fullmatch(r"[a-z][a-z0-9-]*", name or ""))


def find_resource_and_action(manifest: dict, resource_name: str, action_name: str) -> tuple[dict, dict]:
    """
    Validates that `resource_name`/`action_name` exist on a fetched manifest.
    Raises `NotFoundError` for an unknown resource, `FeatureNotSupportedError`
    for a resource that exists but doesn't advertise that action.
    """
    from .errors import FeatureNotSupportedError, NotFoundError

    service_name = manifest.get("service", {}).get("name", "?")

    if not is_url_safe_name(resource_name):
        raise NotFoundError(
            f'"{resource_name}" is not a valid resource name on service "{service_name}".',
            service=service_name,
        )

    resource = next((r for r in manifest.get("resources", []) if r.get("name") == resource_name), None)
    if resource is None:
        raise NotFoundError(
            f'Resource "{resource_name}" is not registered on service "{service_name}".',
            service=service_name,
            resource=resource_name,
        )

    action = next((a for a in resource.get("actions", []) if a.get("name") == action_name), None)
    if action is None:
        raise FeatureNotSupportedError(
            f'Action "{action_name}" is not registered on resource "{service_name}.{resource_name}".',
            service=service_name,
            resource=resource_name,
            action=action_name,
        )

    return resource, action
