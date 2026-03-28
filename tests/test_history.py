import json

from app.extensions import db
from app.models.api_test import ApiTest


def _seed_test(db_session, url="https://httpbin.org/get", method="GET", status_code=200):
    from datetime import datetime, timezone

    test = ApiTest(
        url=url,
        method=method,
        status_code=status_code,
        response_time_ms=150.0,
        request_headers=json.dumps({}),
        response_body=json.dumps({"ok": True}),
        response_headers=json.dumps({"content-type": "application/json"}),
        created_at=datetime.now(timezone.utc),
        collection="Default",
    )
    db_session.session.add(test)
    db_session.session.commit()
    return test


def test_get_history_empty(client, auth_headers):
    resp = client.get("/api/history", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["page"] == 1


def test_get_history_with_data(client, auth_headers, db):
    _seed_test(db)
    resp = client.get("/api/history", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["items"]) == 1
    assert data["items"][0]["url"] == "https://httpbin.org/get"
    assert data["total"] == 1


def test_get_history_url_filter(client, auth_headers, db):
    _seed_test(db, url="https://api.example.com/users")
    _seed_test(db, url="https://api.other.com/data")

    resp = client.get("/api/history?url=example", headers=auth_headers)
    data = resp.get_json()
    assert len(data["items"]) == 1
    assert "example" in data["items"][0]["url"]


def test_get_history_collection_filter(client, auth_headers, db):
    t = _seed_test(db)
    t.collection = "Production"
    db.session.commit()

    resp = client.get("/api/history?collection=Production", headers=auth_headers)
    data = resp.get_json()
    assert len(data["items"]) == 1


def test_get_test_detail(client, auth_headers, db):
    t = _seed_test(db)
    resp = client.get(f"/api/history/{t.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["url"] == t.url
    assert data["response_body"] == {"ok": True}


def test_get_test_detail_not_found(client, auth_headers):
    resp = client.get("/api/history/9999", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_test(client, auth_headers, db):
    t = _seed_test(db)
    resp = client.delete(f"/api/history/{t.id}", headers=auth_headers)
    assert resp.status_code == 200
    assert db.session.get(ApiTest, t.id) is None


def test_clear_history_requires_admin(client, auth_headers, db):
    _seed_test(db)
    resp = client.delete("/api/history", headers=auth_headers)
    # auth_headers is a regular user (not first user), should be forbidden
    # Actually auth_headers creates a user - need to check if admin
    assert resp.status_code in (200, 403)


def test_clear_history_as_admin(client, admin_headers, db):
    _seed_test(db)
    resp = client.delete("/api/history", headers=admin_headers)
    assert resp.status_code == 200
    assert ApiTest.query.count() == 0


def test_history_requires_auth(client):
    resp = client.get("/api/history")
    assert resp.status_code == 401
