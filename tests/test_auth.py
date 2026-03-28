def test_register(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "password123",
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["user"]["username"] == "newuser"
    assert data["user"]["role"] == "admin"  # first user is admin


def test_register_duplicate(client, auth_headers):
    resp = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "password123",
        },
    )
    assert resp.status_code == 409


def test_register_invalid_email(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "username": "baduser",
            "email": "not-an-email",
            "password": "password123",
        },
    )
    assert resp.status_code == 400


def test_register_short_password(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "username": "shortpw",
            "email": "short@example.com",
            "password": "short",
        },
    )
    assert resp.status_code == 400


def test_login_success(client, auth_headers):
    resp = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "testpassword123"},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client, auth_headers):
    resp = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post(
        "/api/auth/login",
        json={"username": "ghost", "password": "password123"},
    )
    assert resp.status_code == 401


def test_me_endpoint(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["username"] == "testuser"


def test_me_unauthorized(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_refresh_token(client, auth_headers):
    # Get refresh token
    resp = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "testpassword123"},
    )
    refresh_token = resp.get_json()["refresh_token"]

    resp = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.get_json()
