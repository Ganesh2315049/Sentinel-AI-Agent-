
from app.report_builder import build_investigation_report


def test_imported_events_keep_their_source_and_event_ids():
    alert = {
        "found": True,
        "alert_id": "ALT-TEST",
        "username": "employee01",
        "source_ip": "198.51.100.25",
    }

    log_result = {
        "username": "employee01",
        "time_window_minutes": 1440,
        "events_found": 2,
        "data_source": "imported_sqlite",
        "events": [
            {
                "event_id": "EVT-101",
                "event_type": "failed_login",
                "username": "employee01",
                "source_ip": "192.0.2.15",
                "minutes_ago": 351,
            },
            {
                "event_id": "EVT-102",
                "event_type": "successful_login",
                "username": "employee01",
                "source_ip": "192.0.2.15",
                "minutes_ago": 349,
            },
        ],
    }

    report = build_investigation_report(alert, log_result)

    assert report.data_source == "imported_sqlite"
    assert {item.event_id for item in report.evidence} == {
        "EVT-101",
        "EVT-102",
    }
    assert report.severity == "Medium"
    assert report.risk_score == 45
    assert "imported SQLite events" in report.summary


def test_imported_evidence_preserves_its_ip_separately_from_alert_ip():
    alert = {
        "found": True,
        "alert_id": "ALT-TEST",
        "username": "employee01",
        "source_ip": "198.51.100.25",
    }

    log_result = {
        "username": "employee01",
        "data_source": "imported_sqlite",
        "events": [
            {
                "event_id": "EVT-101",
                "event_type": "failed_login",
                "username": "employee01",
                "source_ip": "192.0.2.15",
                "minutes_ago": 10,
            },
        ],
    }

    report = build_investigation_report(alert, log_result)

    # The alert IP and observed event IP must not be conflated.
    assert report.source_ip == "198.51.100.25"
    assert report.evidence[0].source_ip == "192.0.2.15"


def test_imported_report_rejects_username_mismatch():
    alert = {
        "found": True,
        "alert_id": "ALT-TEST",
        "username": "employee01",
        "source_ip": "198.51.100.25",
    }

    log_result = {
        "username": "employee01",
        "data_source": "imported_sqlite",
        "events": [
            {
                "event_id": "EVT-201",
                "event_type": "failed_login",
                "username": "employee02",
                "source_ip": "192.0.2.20",
                "minutes_ago": 10,
            },
        ],
    }

    try:
        build_investigation_report(alert, log_result)
    except ValueError:
        pass
    else:
        raise AssertionError("Mismatched evidence should be rejected.")
