import json
from datetime import datetime, timezone

from app.models.api_test import ApiTest


def _seed_tests(db, count=5):
    for i in range(count):
        test = ApiTest(
            url="https://httpbin.org/get",
            method="GET",
            status_code=200,
            response_time_ms=100.0 + i * 50,
            request_headers=json.dumps({}),
            response_body=json.dumps({"ok": True}),
            created_at=datetime.now(timezone.utc),
            collection="Default",
        )
        db.session.add(test)
    db.session.commit()


def test_performance_analytics(client, auth_headers, db):
    _seed_tests(db)
    resp = client.get("/api/analytics/performance", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 5


def test_performance_analytics_by_url(client, auth_headers, db):
    _seed_tests(db)
    resp = client.get(
        "/api/analytics/performance?url=https://httpbin.org/get",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.get_json()) == 5


def test_analytics_summary(client, auth_headers, db):
    _seed_tests(db)
    resp = client.get("/api/analytics/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["total_tests"] == 5
    assert data[0]["url"] == "https://httpbin.org/get"


def test_slow_apis(client, auth_headers, db):
    # Seed a slow test
    test = ApiTest(
        url="https://slow-api.example.com",
        method="GET",
        status_code=200,
        response_time_ms=2000.0,
        request_headers=json.dumps({}),
        created_at=datetime.now(timezone.utc),
        collection="Default",
    )
    db.session.add(test)
    db.session.commit()

    resp = client.get("/api/analytics/slow?threshold=1000", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["url"] == "https://slow-api.example.com"


def test_compare_runs(client, auth_headers, db):
    _seed_tests(db)
    resp = client.get(
        "/api/analytics/compare?url=https://httpbin.org/get",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "https://httpbin.org/get" in data


def test_compare_runs_no_url(client, auth_headers):
    resp = client.get("/api/analytics/compare", headers=auth_headers)
    assert resp.status_code == 400


def test_analytics_requires_auth(client):
    resp = client.get("/api/analytics/summary")
    assert resp.status_code == 401
