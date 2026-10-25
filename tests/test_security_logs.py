
from app.tools.security_logs import (
    get_alert_details,
    search_security_logs,
)


def test_known_alert_returns_expected_user():
    result = get_alert_details("ALT-1001")
    assert result["found"] is True
    assert result["username"] == "employee01"


def test_log_search_returns_three_events():
    result = search_security_logs("employee01", 30)
    assert result["events_found"] == 3


def test_log_search_contains_expected_event_types():
    result = search_security_logs("employee01", 30)
    event_types = [
        event["event_type"] for event in result["events"]
    ]
    assert event_types.count("failed_login") == 2
    assert event_types.count("successful_login") == 1


def test_unknown_alert_is_not_found():
    result = get_alert_details("ALT-9999")
    assert result["found"] is False


def test_unknown_user_has_no_events():
    result = search_security_logs("unknown_user", 30)
    assert result["events_found"] == 0
    assert result["events"] == []
