"""
Ecorpin SDK Platform — Python pilot proof script.

Proves the whole stack end to end against a real, running `ecorpin-app`:
`ecorpin_client` discovers the `crm` service, downloads its metadata, and
builds `sdk.crm.clients.*` purely from that manifest. This script never
constructs a URL, calls `requests`, or names an HTTP method — everything
below is `service.resource.action(...)`.

Usage:
    SDK_API_KEY=<value of ECORPIN_API_KEY in ecorpin-app's .env> \\
    CRM_SERVICE_URL=http://localhost:5602/api/ecorpin \\
    python examples/pilot_consumer.py

(`CRM_SERVICE_URL` defaults to the value above, matching ecorpin-app's
default dev port — override it, or set `SDK_SERVICE_CRM_URL` directly, to
point at a different environment.)
"""
import os
import sys
import time

from ecorpin_client import EcorpinError, create_sdk

DEFAULT_CRM_URL = "http://localhost:5602/api/ecorpin"


def log(heading: str) -> None:
    print(f"\n{'-' * len(heading)}\n{heading}\n{'-' * len(heading)}")


def main() -> None:
    sdk = create_sdk(
        # Static fallback registry — only consulted if SDK_SERVICE_CRM_URL
        # isn't already set in the environment.
        registry={"crm": os.environ.get("CRM_SERVICE_URL", DEFAULT_CRM_URL)},
    )

    log("1. sdk.crm.clients.list()")
    listed = sdk.crm.clients.list(limit=5)
    print(f"Found {listed['total']} client(s) (showing up to 5):")
    for client in listed["clients"]:
        print(f"  #{client['id']} {client['name']} <{client.get('email') or 'no email'}> [{client['status']}]")

    log("2. sdk.crm.clients.create(data)")
    unique_suffix = int(time.time() * 1000)
    created = sdk.crm.clients.create(
        name=f"Pilot Consumer Client {unique_suffix}",
        email=f"pilot-consumer-{unique_suffix}@example.com",
    )
    print(f"Created client #{created['id']}: {created['name']} <{created['email']}>")

    log("3. sdk.crm.clients.get(id)")
    fetched = sdk.crm.clients.get(created["id"])
    print(f"Fetched back client #{fetched['id']}: {fetched['name']} (status: {fetched['status']})")

    log("4. sdk.crm.clients.archive(id)")
    archived = sdk.crm.clients.archive(created["id"])
    print(f"Archived client #{archived['id']} (status: {archived['status']}, archivedAt: {archived['archivedAt']})")

    log("Pilot succeeded")
    print(
        "This script never built a URL, called requests, or named an HTTP method — every call above was "
        "service.resource.action(...), fully driven by the manifest sdk.crm fetched from ecorpin-app's "
        "/api/ecorpin/discovery endpoint at runtime."
    )


if __name__ == "__main__":
    try:
        main()
    except EcorpinError as err:
        print(f"\nPilot failed: [{err.code}] {err.message}", file=sys.stderr)
        if err.details:
            import json

            print(f"Details: {json.dumps(err.details, indent=2)}", file=sys.stderr)
        sys.exit(1)
