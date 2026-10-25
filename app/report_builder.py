
from typing import Any

from app.report_schema import EvidenceItem, InvestigationReport


def calculate_risk(
    failed_count: int,
    successful_count: int,
) -> tuple[int, str, list[str]]:
    """Calculate a transparent demo risk score from login evidence."""

    score = 10
    reasons = ["Base score: 10 points for the alert under review."]

    if failed_count > 0:
        points = min(failed_count * 15, 45)
        score += points
        reasons.append(
            f"{failed_count} failed login event(s): +{points} points."
        )

    if failed_count > 0 and successful_count > 0:
        score += 20
        reasons.append(
            "Failed login(s) and a successful login occurred in the "
            "same evidence window: +20 points."
        )

    score = min(score, 100)

    if score >= 75:
        severity = "Critical"
    elif score >= 50:
        severity = "High"
    elif score >= 25:
        severity = "Medium"
    else:
        severity = "Low"

    return score, severity, reasons


def build_investigation_report(
    alert: dict[str, Any],
    log_result: dict[str, Any],
) -> InvestigationReport:
    """Build a structured report from validated tool results."""

    if alert.get("found") is not True:
        raise ValueError("Cannot build a report without a valid alert.")

    if log_result.get("error"):
        raise ValueError("Cannot build a report from failed log search.")

    username = alert.get("username")
    if not isinstance(username, str) or not username.strip():
        raise ValueError("Alert does not contain a valid username.")

    if log_result.get("username") != username:
        raise ValueError("Log search username does not match the alert.")

    raw_events = log_result.get("events")
    if not isinstance(raw_events, list):
        raise ValueError("Log search did not return a valid event list.")

    evidence = []

    for event in raw_events:
        if not isinstance(event, dict):
            raise ValueError("Log search contains an invalid event.")

        if event.get("username") != username:
            raise ValueError("Evidence username does not match the alert.")

        evidence.append(
            EvidenceItem(
                event_id=event["event_id"],
                event_type=event["event_type"],
                username=event["username"],
                source_ip=event["source_ip"],
                minutes_ago=event["minutes_ago"],
            )
        )

    failed_count = sum(
        item.event_type == "failed_login" for item in evidence
    )
    successful_count = sum(
        item.event_type == "successful_login" for item in evidence
    )

    risk_score, severity, risk_reason = calculate_risk(
        failed_count,
        successful_count,
    )

    data_source = log_result.get("data_source", "unknown")

    if data_source == "imported_sqlite":
        source_description = "imported SQLite events"
    elif data_source == "synthetic_demo_data":
        source_description = "synthetic demo events"
    else:
        source_description = "events from an unspecified source"

    summary = (
        f"Found {len(evidence)} matching {source_description} for {username}: "
        f"{failed_count} failed login(s) and "
        f"{successful_count} successful login(s)."
    )

    recommendations = [
        "Review whether the login attempts match expected user activity.",
        "Check the source IP against approved organizational context.",
        "Follow the incident response playbook if suspicious activity is confirmed.",
    ]

    return InvestigationReport(
        alert_id=alert["alert_id"],
        status="completed",
        username=username,
        source_ip=alert["source_ip"],
        summary=summary,
        evidence=evidence,
        severity=severity,
        risk_score=risk_score,
        risk_reason=risk_reason,
        recommendations=recommendations,
        data_source=data_source,
    )
