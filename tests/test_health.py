def test_health_check(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "healthy"
    assert data["database"] == "ok"


def test_index_page(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"API Pulse" in resp.data
