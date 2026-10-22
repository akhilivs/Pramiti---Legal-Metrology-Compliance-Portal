"""Smoke tests: the API starts, sign-in works and roles are enforced. Run with `pytest` in backend/."""
from conftest import login

ADMIN = ("official@metrology.gov.in", "admin123")
INSPECTOR = ("inspector@metrology.gov.in", "inspector123")


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["rules_passages"] > 0


def test_login_and_profile(client):
    headers = login(client, *ADMIN)
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["email"] == ADMIN[0]
    assert me["role"] == "admin"


def test_wrong_password_rejected(client):
    r = client.post("/api/auth/login", json={"email": ADMIN[0], "password": "wrong"})
    assert r.status_code == 401


def test_protected_routes_need_a_session(client):
    assert client.get("/api/scans").status_code == 401
    assert client.get("/api/scans", headers={"Authorization": "Bearer forged.token"}).status_code == 401


def test_dashboard_data(client):
    headers = login(client, *ADMIN)
    stats = client.get("/api/stats", headers=headers)
    assert stats.status_code == 200
    assert "total" in stats.json()
    assert client.get("/api/scans", headers=headers).status_code == 200
    assert client.get("/api/meta").json()["states"]


def test_roles_are_enforced(client):
    inspector = login(client, *INSPECTOR)
    assert client.get("/api/users", headers=inspector).status_code == 403
    assert client.get("/api/users", headers=login(client, *ADMIN)).status_code == 200


def test_google_sign_in_disabled_without_client_id(client):
    r = client.post("/api/auth/google", json={"credential": "x"})
    assert r.status_code == 503


def test_responses_are_compressed(client):
    r = client.get("/api/meta", headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("content-encoding") == "gzip"
