
import pytest

from app.report_builder import build_investigation_report
from app.tools.security_logs import (
    get_alert_details,
    search_security_logs,
)


def test_report_uses_real_tool_results():
    alert = get_alert_details("ALT-1001")
    logs = search_security_logs("employee01", 30)

    report = build_investigation_report(alert, logs)

    assert report.alert_id == "ALT-1001"
    assert report.username == "employee01"
    assert len(report.evidence) == 3
    assert "2 failed login(s)" in report.summary
    assert "1 successful login(s)" in report.summary
    assert report.data_source == "synthetic_demo_data"


def test_report_rejects_username_mismatch():
    alert = get_alert_details("ALT-1001")
    logs = search_security_logs("employee02", 30)

    with pytest.raises(ValueError, match="does not match"):
        build_investigation_report(alert, logs)


def test_report_rejects_unknown_alert():
    alert = get_alert_details("ALT-9999")
    logs = search_security_logs("employee01", 30)

    with pytest.raises(ValueError, match="valid alert"):
        build_investigation_report(alert, logs)

from app.report_builder import calculate_risk


def test_two_failed_and_one_successful_login_is_high_risk():
    score, severity, reasons = calculate_risk(2, 1)

    assert score == 60
    assert severity == "High"
    assert len(reasons) == 3


def test_no_failed_logins_is_low_risk():
    score, severity, reasons = calculate_risk(0, 0)

    assert score == 10
    assert severity == "Low"


def test_risk_score_is_capped_at_100():
    score, severity, reasons = calculate_risk(10, 1)

    assert score == 75
    assert severity == "Critical"
