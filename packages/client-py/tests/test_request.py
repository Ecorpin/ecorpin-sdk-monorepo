import pytest

from ecorpin_client.errors import ValidationError
from ecorpin_client.request import build_url, map_args_to_call

GET_ACTION = {"name": "get", "method": "GET", "path": "/:id"}
LIST_ACTION = {"name": "list", "method": "GET", "path": "/"}
CREATE_ACTION = {"name": "create", "method": "POST", "path": "/"}


def test_map_args_to_call_extracts_id_for_get():
    mapped = map_args_to_call(GET_ACTION, ("42",), {})
    assert mapped.path_params == {"id": "42"}
    assert mapped.body is None


def test_map_args_to_call_accepts_int_id():
    mapped = map_args_to_call(GET_ACTION, (42,), {})
    assert mapped.path_params == {"id": "42"}


def test_map_args_to_call_requires_id_for_id_actions():
    with pytest.raises(ValidationError, match="expects an id"):
        map_args_to_call(GET_ACTION, (), {})


def test_map_args_to_call_takes_body_as_second_positional_arg_for_update():
    update_action = {"name": "update", "method": "PATCH", "path": "/:id"}
    mapped = map_args_to_call(update_action, ("1", {"name": "Ada"}), {})
    assert mapped.path_params == {"id": "1"}
    assert mapped.body == {"name": "Ada"}


def test_map_args_to_call_takes_body_as_kwargs_for_update():
    update_action = {"name": "update", "method": "PATCH", "path": "/:id"}
    mapped = map_args_to_call(update_action, ("1",), {"name": "Ada"})
    assert mapped.path_params == {"id": "1"}
    assert mapped.body == {"name": "Ada"}


def test_map_args_to_call_list_uses_positional_dict_as_query():
    mapped = map_args_to_call(LIST_ACTION, ({"page": 2},), {})
    assert mapped.query == {"page": 2}


def test_map_args_to_call_list_uses_kwargs_as_query():
    mapped = map_args_to_call(LIST_ACTION, (), {"page": 2})
    assert mapped.query == {"page": 2}


def test_map_args_to_call_create_uses_positional_dict_as_body():
    mapped = map_args_to_call(CREATE_ACTION, ({"email": "a@b.com"},), {})
    assert mapped.body == {"email": "a@b.com"}


def test_map_args_to_call_create_uses_kwargs_as_body():
    mapped = map_args_to_call(CREATE_ACTION, (), {"email": "a@b.com"})
    assert mapped.body == {"email": "a@b.com"}


def test_build_url_substitutes_path_param():
    url = build_url("http://host", "users", GET_ACTION, {"id": "42"})
    assert url == "http://host/users/42"


def test_build_url_missing_path_param_raises():
    with pytest.raises(ValidationError, match='Missing path parameter "id"'):
        build_url("http://host", "users", GET_ACTION, {})


def test_build_url_appends_query_string():
    url = build_url("http://host", "users", LIST_ACTION, {}, {"page": 2, "limit": 10})
    assert url in ("http://host/users?page=2&limit=10", "http://host/users?limit=10&page=2")


def test_build_url_omits_none_query_values():
    url = build_url("http://host", "users", LIST_ACTION, {}, {"page": None})
    assert url == "http://host/users"


def test_build_url_encodes_path_param():
    url = build_url("http://host", "users", GET_ACTION, {"id": "a/b c"})
    assert url == "http://host/users/a%2Fb%20c"
