import datetime

import pytest

BASE_URL = "http://localhost:9999/api/ecorpin"


def build_manifest() -> dict:
    return {
        "protocolVersion": "1.0",
        "service": {"name": "crm", "version": "1.0.0"},
        "authentication": {"required": True, "strategies": ["apiKey"]},
        "features": {},
        "resources": [
            {
                "name": "users",
                "actions": [
                    {"name": "list", "method": "GET", "path": "/", "idempotent": True},
                    {"name": "get", "method": "GET", "path": "/:id", "idempotent": True},
                    {"name": "create", "method": "POST", "path": "/", "idempotent": False},
                ],
            }
        ],
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "metadataHash": "abc123",
    }


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("SDK_SERVICE_CRM_URL", raising=False)
    monkeypatch.delenv("SDK_API_KEY", raising=False)
    yield
