def test_list_environments_empty(client, auth_headers):
    resp = client.get("/api/environments", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_create_environment(client, auth_headers):
    resp = client.post(
        "/api/environments",
        headers=auth_headers,
        json={"name": "Production", "variables": {"base_url": "https://api.example.com"}},
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["name"] == "Production"
    assert data["variables"]["base_url"] == "https://api.example.com"


def test_create_environment_upsert(client, auth_headers):
    client.post(
        "/api/environments",
        headers=auth_headers,
        json={"name": "Staging", "variables": {"key": "old"}},
    )
    resp = client.post(
        "/api/environments",
        headers=auth_headers,
        json={"name": "Staging", "variables": {"key": "new"}},
    )
    assert resp.status_code == 201
    assert resp.get_json()["variables"]["key"] == "new"

    # Should still be only one environment with that name
    list_resp = client.get("/api/environments", headers=auth_headers)
    envs = [e for e in list_resp.get_json() if e["name"] == "Staging"]
    assert len(envs) == 1


def test_delete_environment(client, auth_headers):
    resp = client.post(
        "/api/environments",
        headers=auth_headers,
        json={"name": "ToDelete", "variables": {}},
    )
    env_id = resp.get_json()["id"]

    del_resp = client.delete(f"/api/environments/{env_id}", headers=auth_headers)
    assert del_resp.status_code == 200

    list_resp = client.get("/api/environments", headers=auth_headers)
    assert all(e["id"] != env_id for e in list_resp.get_json())


def test_delete_environment_not_found(client, auth_headers):
    resp = client.delete("/api/environments/9999", headers=auth_headers)
    assert resp.status_code == 404


def test_resolve_variables(client, auth_headers):
    client.post(
        "/api/environments",
        headers=auth_headers,
        json={"name": "Test", "variables": {"base_url": "https://api.test.com", "token": "abc123"}},
    )
    envs = client.get("/api/environments", headers=auth_headers).get_json()
    env_id = envs[0]["id"]

    resp = client.post(
        "/api/environments/resolve",
        headers=auth_headers,
        json={"environment_id": env_id, "text": "{{base_url}}/users?token={{token}}"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["resolved"] == "https://api.test.com/users?token=abc123"


def test_resolve_without_environment(client, auth_headers):
    resp = client.post(
        "/api/environments/resolve",
        headers=auth_headers,
        json={"text": "{{base_url}}/test"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["resolved"] == "{{base_url}}/test"


def test_environments_require_auth(client):
    resp = client.get("/api/environments")
    assert resp.status_code == 401
