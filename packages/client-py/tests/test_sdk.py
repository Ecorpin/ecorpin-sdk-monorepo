import pytest
import responses

from ecorpin_client import ServiceUnavailableError, create_sdk
from ecorpin_client.errors import FeatureNotSupportedError, NotFoundError

from conftest import BASE_URL, build_manifest


@pytest.fixture(autouse=True)
def _configure_env(monkeypatch):
    monkeypatch.setenv("SDK_SERVICE_CRM_URL", BASE_URL)
    monkeypatch.setenv("SDK_API_KEY", "test-key")


@responses.activate
def test_resolves_base_url_and_fetches_metadata_lazily_on_first_call():
    responses.add(responses.GET, f"{BASE_URL}/discovery", json=build_manifest())
    responses.add(responses.GET, f"{BASE_URL}/users", json={"data": [{"id": "1"}]})

    sdk = create_sdk()
    users = sdk.crm.users.list()

    assert users == [{"id": "1"}]


@responses.activate
def test_sends_sdk_api_key_as_bearer_authorization_header():
    responses.add(responses.GET, f"{BASE_URL}/discovery", json=build_manifest())
    responses.add(responses.GET, f"{BASE_URL}/users/1", json={"data": {"id": "1"}})

    sdk = create_sdk()
    sdk.crm.users.get("1")

    auth_header = responses.calls[-1].request.headers.get("Authorization")
    assert auth_header == "Bearer test-key"


@responses.activate
def test_substitutes_id_argument_into_id_path_segment_for_get():
    responses.add(responses.GET, f"{BASE_URL}/discovery", json=build_manifest())
    responses.add(responses.GET, f"{BASE_URL}/users/42", json={"data": {"id": "42"}})

    sdk = create_sdk()
    user = sdk.crm.users.get("42")

    assert user == {"id": "42"}


@responses.activate
def test_reconstructs_typed_ecorpin_error_from_wire_error_envelope():
    responses.add(responses.GET, f"{BASE_URL}/discovery", json=build_manifest())
    responses.add(
        responses.GET,
        f"{BASE_URL}/users/999",
        json={"error": {"code": "ECORPIN_NOT_FOUND", "message": "User 999 not found"}},
        status=404,
    )

    sdk = create_sdk()
    with pytest.raises(NotFoundError):
        sdk.crm.users.get("999")


@responses.activate
def test_retries_a_retryable_get_failure_and_succeeds_on_second_attempt(monkeypatch):
    monkeypatch.setattr("ecorpin_client.retry.time.sleep", lambda _s: None)
    responses.add(responses.GET, f"{BASE_URL}/discovery", json=build_manifest())
    responses.add(
        responses.GET,
        f"{BASE_URL}/users",
        json={"error": {"code": "ECORPIN_SERVICE_UNAVAILABLE", "message": "Try again"}},
        status=503,
    )
    responses.add(responses.GET, f"{BASE_URL}/users", json={"data": []})

    sdk = create_sdk()
    users = sdk.crm.users.list()

    assert users == []
    assert len(responses.calls) == 3  # discovery + 2 attempts at /users


@responses.activate
def test_does_not_retry_a_non_idempotent_create_on_a_retryable_error(monkeypatch):
    monkeypatch.setattr("ecorpin_client.retry.time.sleep", lambda _s: None)
    responses.add(responses.GET, f"{BASE_URL}/discovery", json=build_manifest())
    responses.add(
        responses.POST,
        f"{BASE_URL}/users",
        json={"error": {"code": "ECORPIN_SERVICE_UNAVAILABLE", "message": "Try again"}},
        status=503,
    )

    sdk = create_sdk()
    with pytest.raises(ServiceUnavailableError):
        sdk.crm.users.create(email="a@b.com")

    create_calls = [c for c in responses.calls if c.request.method == "POST"]
    assert len(create_calls) == 1


@responses.activate
def test_throws_feature_not_supported_for_an_action_the_manifest_doesnt_declare():
    responses.add(responses.GET, f"{BASE_URL}/discovery", json=build_manifest())

    sdk = create_sdk()
    with pytest.raises(FeatureNotSupportedError, match="not registered"):
        sdk.crm.users.archive("1")


@responses.activate
def test_registry_kwarg_is_used_when_no_env_var_is_set(monkeypatch):
    monkeypatch.delenv("SDK_SERVICE_CRM_URL", raising=False)
    responses.add(responses.GET, f"{BASE_URL}/discovery", json=build_manifest())
    responses.add(responses.GET, f"{BASE_URL}/users", json={"data": []})

    sdk = create_sdk(registry={"crm": BASE_URL})
    assert sdk.crm.users.list() == []
