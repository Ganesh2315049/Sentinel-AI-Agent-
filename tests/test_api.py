
from fastapi.testclient import TestClient

from app.main import app
import app.main as main_module


client = TestClient(app, raise_server_exceptions=False)


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "Sentinel AI",
    }


def test_investigate_endpoint_returns_report(monkeypatch):
    def fake_investigate(user_request):
        return {
            "status": "completed",
            "answer": "Synthetic investigation completed.",
            "structured_report": {
                "alert_id": "ALT-1001",
                "username": "employee01",
                "evidence": [
                    {"event_id": "EVT-001"},
                    {"event_id": "EVT-002"},
                    {"event_id": "EVT-003"},
                ],
                "data_source": "synthetic_demo_data",
            },
        }

    monkeypatch.setattr(
        main_module,
        "investigate",
        fake_investigate,
    )

    response = client.post(
        "/investigate",
        json={"alert_id": "ALT-1001"},
    )

    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "completed"
    assert data["structured_report"]["username"] == "employee01"
    assert len(data["structured_report"]["evidence"]) == 3


def test_empty_alert_id_is_rejected():
    response = client.post(
        "/investigate",
        json={"alert_id": ""},
    )

    assert response.status_code == 422


def test_missing_alert_id_is_rejected():
    response = client.post("/investigate", json={})

    assert response.status_code == 422


def test_unknown_alert_is_rejected():
    response = client.post(
        "/investigate",
        json={"alert_id": "ALT-UNKNOWN"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Alert not found."


def test_whitespace_alert_id_is_rejected():
    response = client.post(
        "/investigate",
        json={"alert_id": "   "},
    )

    assert response.status_code == 422


def test_agent_exception_is_handled(monkeypatch):
    def failing_investigate(user_request):
        raise RuntimeError("Internal test error")

    monkeypatch.setattr(
        main_module,
        "investigate",
        failing_investigate,
    )

    response = client.post(
        "/investigate",
        json={"alert_id": "ALT-1001"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == (
        "Investigation service unavailable."
    )
