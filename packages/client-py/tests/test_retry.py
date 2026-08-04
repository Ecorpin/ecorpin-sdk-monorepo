import pytest

from ecorpin_client.errors import ServiceUnavailableError, ValidationError
from ecorpin_client.retry import is_retryable, with_retry

GET_ACTION = {"name": "list", "method": "GET", "path": "/", "idempotent": True}
NON_IDEMPOTENT_POST = {"name": "create", "method": "POST", "path": "/", "idempotent": False}
IDEMPOTENT_POST = {"name": "upsert", "method": "PUT", "path": "/:id", "idempotent": True}


def test_is_retryable_true_for_retryable_error_on_get():
    assert is_retryable(ServiceUnavailableError("down"), GET_ACTION) is True


def test_is_retryable_false_for_non_retryable_error_class():
    assert is_retryable(ValidationError("bad"), GET_ACTION) is False


def test_is_retryable_false_for_non_idempotent_mutation():
    assert is_retryable(ServiceUnavailableError("down"), NON_IDEMPOTENT_POST) is False


def test_is_retryable_true_for_idempotent_mutation():
    assert is_retryable(ServiceUnavailableError("down"), IDEMPOTENT_POST) is True


def test_with_retry_succeeds_after_retries(monkeypatch):
    monkeypatch.setattr("ecorpin_client.retry.time.sleep", lambda _s: None)
    calls = {"count": 0}

    def attempt(_attempt_number):
        calls["count"] += 1
        if calls["count"] < 3:
            raise ServiceUnavailableError("down")
        return "ok"

    result = with_retry(attempt, max_retries=2, should_retry=lambda err: isinstance(err, ServiceUnavailableError))
    assert result == "ok"
    assert calls["count"] == 3


def test_with_retry_raises_after_exhausting_retries(monkeypatch):
    monkeypatch.setattr("ecorpin_client.retry.time.sleep", lambda _s: None)
    calls = {"count": 0}

    def attempt(_attempt_number):
        calls["count"] += 1
        raise ServiceUnavailableError("down")

    with pytest.raises(ServiceUnavailableError):
        with_retry(attempt, max_retries=2, should_retry=lambda err: True)
    assert calls["count"] == 3


def test_with_retry_does_not_retry_when_should_retry_is_false(monkeypatch):
    monkeypatch.setattr("ecorpin_client.retry.time.sleep", lambda _s: None)
    calls = {"count": 0}

    def attempt(_attempt_number):
        calls["count"] += 1
        raise ValidationError("bad")

    with pytest.raises(ValidationError):
        with_retry(attempt, max_retries=2, should_retry=lambda err: False)
    assert calls["count"] == 1
