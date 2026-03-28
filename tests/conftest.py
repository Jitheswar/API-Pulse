import pytest

from app import create_app
from app.extensions import db as _db
from app.models.user import User


@pytest.fixture(scope="session")
def app():
    app = create_app("testing")
    yield app


@pytest.fixture(autouse=True)
def db(app):
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers(client, db):
    """Register a user and return auth headers."""
    client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
        },
    )
    resp = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "testpassword123"},
    )
    token = resp.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client, db):
    """Register the first user (admin) and return auth headers."""
    # Ensure no users exist so first user gets admin role
    User.query.delete()
    _db.session.commit()
    client.post(
        "/api/auth/register",
        json={
            "username": "adminuser",
            "email": "admin@example.com",
            "password": "adminpassword123",
        },
    )
    resp = client.post(
        "/api/auth/login",
        json={"username": "adminuser", "password": "adminpassword123"},
    )
    token = resp.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
