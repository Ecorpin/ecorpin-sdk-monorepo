"""Retry-with-backoff, mirroring @ecorpin/client's pipeline/retry.ts."""
from __future__ import annotations

import random
import time
from typing import Callable, TypeVar

from .errors import EcorpinError

_SAFE_METHODS = {"GET"}

T = TypeVar("T")


def is_retryable(err: BaseException, action: dict) -> bool:
    """
    An error is retried only if the taxonomy marks it `retryable` *and* the
    action is either a safe HTTP method (GET) or explicitly `idempotent` —
    never on an ambiguous mutating outcome.
    """
    if not isinstance(err, EcorpinError) or not err.retryable:
        return False
    return action.get("method") in _SAFE_METHODS or bool(action.get("idempotent"))


def _compute_backoff_seconds(attempt_number: int) -> float:
    base = 0.2 * (2 ** (attempt_number - 1))
    jitter = random.random() * base * 0.3
    return min(base + jitter, 5.0)


def with_retry(
    attempt: Callable[[int], T],
    max_retries: int,
    should_retry: Callable[[BaseException], bool],
) -> T:
    """
    Runs `attempt` up to `max_retries + 1` times total, backing off with
    jitter between attempts, stopping as soon as `should_retry` returns
    False for the error just raised.
    """
    last_error: BaseException | None = None
    for attempt_number in range(1, max_retries + 2):
        try:
            return attempt(attempt_number)
        except Exception as err:  # noqa: BLE001 - re-raised below when not retried
            last_error = err
            is_last_attempt = attempt_number > max_retries
            if is_last_attempt or not should_retry(err):
                raise
            time.sleep(_compute_backoff_seconds(attempt_number))
    assert last_error is not None  # pragma: no cover - unreachable, loop always returns/raises
    raise last_error
