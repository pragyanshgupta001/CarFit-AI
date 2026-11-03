"""Unit tests for the /api/health endpoint."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok() -> None:
    """GET /api/health should return HTTP 200 and exactly {"ok": true}."""
    app = create_app()
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
