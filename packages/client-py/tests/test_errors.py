from ecorpin_client.errors import (
    EcorpinError,
    NotFoundError,
    UnknownEcorpinError,
    ValidationError,
    error_from_envelope,
)


def test_error_from_envelope_reconstructs_known_code():
    envelope = {"error": {"code": "ECORPIN_NOT_FOUND", "message": "User 999 not found"}}
    err = error_from_envelope(envelope, service="crm", resource="users", action="get")

    assert isinstance(err, NotFoundError)
    assert isinstance(err, EcorpinError)
    assert err.code == "ECORPIN_NOT_FOUND"
    assert err.http_status == 404
    assert err.retryable is False
    assert err.message == "User 999 not found"
    assert err.service == "crm"
    assert err.resource == "users"
    assert err.action == "get"


def test_error_from_envelope_falls_back_to_unknown_for_unrecognized_code():
    envelope = {"error": {"code": "SOME_FUTURE_CODE", "message": "Something new"}}
    err = error_from_envelope(envelope)

    assert isinstance(err, UnknownEcorpinError)
    assert err.code == "SOME_FUTURE_CODE"
    assert err.retryable is False


def test_error_from_envelope_prefers_envelope_correlation_id():
    envelope = {"error": {"code": "ECORPIN_VALIDATION_ERROR", "message": "bad", "correlationId": "from-envelope"}}
    err = error_from_envelope(envelope, correlation_id="from-caller")

    assert isinstance(err, ValidationError)
    assert err.correlation_id == "from-envelope"


def test_error_from_envelope_uses_caller_correlation_id_when_envelope_has_none():
    envelope = {"error": {"code": "ECORPIN_VALIDATION_ERROR", "message": "bad"}}
    err = error_from_envelope(envelope, correlation_id="from-caller")

    assert err.correlation_id == "from-caller"


def test_to_dict_round_trips_wire_shape():
    err = ValidationError("bad input", details={"field": "email"}, correlation_id="c-1")
    assert err.to_dict() == {
        "code": "ECORPIN_VALIDATION_ERROR",
        "message": "bad input",
        "details": {"field": "email"},
        "correlationId": "c-1",
    }
