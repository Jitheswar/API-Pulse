def test_get_thresholds_empty(client, auth_headers):
    resp = client.get("/api/thresholds", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_create_threshold(client, auth_headers):
    resp = client.post(
        "/api/thresholds",
        json={"url_pattern": "https://api.example.com%", "max_response_time_ms": 500},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    resp = client.get("/api/thresholds", headers=auth_headers)
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["url_pattern"] == "https://api.example.com%"
    assert data[0]["max_response_time_ms"] == 500


def test_update_threshold(client, auth_headers):
    client.post(
        "/api/thresholds",
        json={"url_pattern": "https://api.example.com%", "max_response_time_ms": 500},
        headers=auth_headers,
    )
    # Upsert with same pattern
    client.post(
        "/api/thresholds",
        json={"url_pattern": "https://api.example.com%", "max_response_time_ms": 800},
        headers=auth_headers,
    )
    resp = client.get("/api/thresholds", headers=auth_headers)
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["max_response_time_ms"] == 800


def test_delete_threshold(client, auth_headers):
    client.post(
        "/api/thresholds",
        json={"url_pattern": "https://test.com%", "max_response_time_ms": 300},
        headers=auth_headers,
    )
    resp = client.get("/api/thresholds", headers=auth_headers)
    tid = resp.get_json()[0]["id"]

    resp = client.delete(f"/api/thresholds/{tid}", headers=auth_headers)
    assert resp.status_code == 200

    resp = client.get("/api/thresholds", headers=auth_headers)
    assert len(resp.get_json()) == 0


def test_create_threshold_invalid(client, auth_headers):
    resp = client.post(
        "/api/thresholds",
        json={"url_pattern": "", "max_response_time_ms": -10},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_thresholds_require_auth(client):
    resp = client.get("/api/thresholds")
    assert resp.status_code == 401
