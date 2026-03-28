from unittest.mock import patch, MagicMock


def test_test_api_requires_auth(client):
    resp = client.post(
        "/api/test",
        json={"url": "https://httpbin.org/get", "method": "GET"},
    )
    assert resp.status_code == 401


def test_test_api_missing_url(client, auth_headers):
    resp = client.post(
        "/api/test",
        json={"url": "", "method": "GET"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_test_api_invalid_method(client, auth_headers):
    resp = client.post(
        "/api/test",
        json={"url": "https://httpbin.org/get", "method": "INVALID"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


@patch("app.services.api_tester.is_private_url", return_value=True)
def test_test_api_ssrf_blocked(mock_ssrf, client, auth_headers):
    resp = client.post(
        "/api/test",
        json={"url": "http://localhost/admin", "method": "GET"},
        headers=auth_headers,
    )
    assert resp.status_code == 403
    assert "private" in resp.get_json()["error"].lower()


@patch("app.services.api_tester.is_private_url", return_value=False)
@patch("app.services.api_tester.http_requests")
def test_test_api_success(mock_requests, mock_ssrf, client, auth_headers):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"Content-Type": "application/json"}
    mock_resp.json.return_value = {"message": "ok"}
    mock_requests.get.return_value = mock_resp

    resp = client.post(
        "/api/test",
        json={"url": "https://httpbin.org/get", "method": "GET"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status_code"] == 200
    assert data["url"] == "https://httpbin.org/get"


@patch("app.services.api_tester.is_private_url", return_value=False)
@patch("app.services.api_tester.http_requests")
def test_test_api_timeout(mock_requests, mock_ssrf, client, auth_headers):
    import requests

    mock_requests.get.side_effect = requests.exceptions.Timeout()
    mock_requests.exceptions = requests.exceptions

    resp = client.post(
        "/api/test",
        json={"url": "https://slow.example.com", "method": "GET"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "timed out" in data["error"].lower()


@patch("app.services.api_tester.is_private_url", return_value=False)
@patch("app.services.api_tester.http_requests")
def test_test_api_post_with_body(mock_requests, mock_ssrf, client, auth_headers):
    mock_resp = MagicMock()
    mock_resp.status_code = 201
    mock_resp.headers = {"Content-Type": "application/json"}
    mock_resp.json.return_value = {"id": 1}
    mock_requests.post.return_value = mock_resp

    resp = client.post(
        "/api/test",
        json={
            "url": "https://httpbin.org/post",
            "method": "POST",
            "body": '{"name": "test"}',
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status_code"] == 201
