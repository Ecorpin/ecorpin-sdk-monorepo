"""
Maps SDK call-site arguments to the parts of an HTTP request, and joins a
resolved base URL with the resource name + action path. Mirrors
@ecorpin/client's pipeline/buildRequest.ts. This is decided purely from the
action's declared method/path — never from hardcoded per-resource knowledge.

Convention (same as the JS client, plus Python-idiomatic keyword args):

- Actions whose path contains `:id` (get/update/delete/custom) take the id
  as the first positional argument, and an optional body as the second, or
  as keyword arguments — ``sdk.crm.users.get(id)``,
  ``sdk.crm.users.update(id, name="Ada")``.
- ``GET`` actions without an id (list) take an optional query-params dict
  or keyword arguments — ``sdk.inventory.products.list(page=2)``.
- Everything else (create) takes the body as the first positional argument,
  or as keyword arguments — ``sdk.crm.customers.create(name="Ada")``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import quote, urlencode

from .errors import ValidationError

_PATH_PARAM_RE = re.compile(r":([a-zA-Z_][a-zA-Z0-9_]*)")


@dataclass
class MappedCall:
    path_params: dict = field(default_factory=dict)
    query: Optional[dict] = None
    body: Any = None


def map_args_to_call(action: dict, args: tuple, kwargs: dict) -> MappedCall:
    action_name = action.get("name", "?")
    requires_id = ":id" in action.get("path", "")

    if requires_id:
        if not args or not isinstance(args[0], (str, int)):
            hint = "" if action.get("method") == "GET" else ", data"
            raise ValidationError(
                f'Action "{action_name}" expects an id as its first argument, e.g. '
                f"sdk.<service>.<resource>.{action_name}(id{hint})."
            )
        body = args[1] if len(args) > 1 else (kwargs or None)
        return MappedCall(path_params={"id": str(args[0])}, body=body)

    if action.get("method") == "GET":
        query = args[0] if args else (kwargs or {})
        return MappedCall(query=query)

    body = args[0] if args else (kwargs or None)
    return MappedCall(body=body)


def build_url(base_url: str, resource_name: str, action: dict, path_params: dict, query: Optional[dict] = None) -> str:
    def substitute(match: re.Match) -> str:
        key = match.group(1)
        value = path_params.get(key)
        if value is None:
            raise ValidationError(f'Missing path parameter "{key}" for action "{action.get("name", "?")}".')
        return quote(str(value), safe="")

    path = _PATH_PARAM_RE.sub(substitute, action.get("path", ""))
    if path == "/":
        path = ""

    url = f"{base_url}/{resource_name}{path}"

    if not query:
        return url
    filtered = {k: v for k, v in query.items() if v is not None}
    if not filtered:
        return url
    return f"{url}?{urlencode(filtered)}"
