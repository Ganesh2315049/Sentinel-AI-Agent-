
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.security_events_repository import search_imported_events


class LogSearchArgs(BaseModel):
    """Validate arguments before searching security logs."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    username: str = Field(min_length=1, max_length=64)
    time_window_minutes: int = Field(default=30, ge=1, le=1440)


class AlertDetailsArgs(BaseModel):
    """Validate alert lookup arguments."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    alert_id: str = Field(min_length=1, max_length=64)


# Synthetic data for development and testing only.
SAMPLE_LOGS: list[dict[str, Any]] = [
    {
        "event_id": "EVT-001",
        "username": "employee01",
        "event_type": "failed_login",
        "source_ip": "198.51.100.25",
        "minutes_ago": 12,
    },
    {
        "event_id": "EVT-002",
        "username": "employee01",
        "event_type": "failed_login",
        "source_ip": "198.51.100.25",
        "minutes_ago": 10,
    },
    {
        "event_id": "EVT-003",
        "username": "employee01",
        "event_type": "successful_login",
        "source_ip": "198.51.100.25",
        "minutes_ago": 8,
    },
    {
        "event_id": "EVT-004",
        "username": "employee02",
        "event_type": "successful_login",
        "source_ip": "192.0.2.10",
        "minutes_ago": 5,
    },
]


SAMPLE_ALERTS: dict[str, dict[str, Any]] = {
    "ALT-1001": {
        "found": True,
        "alert_id": "ALT-1001",
        "event_type": "suspicious_login",
        "username": "employee01",
        "source_ip": "198.51.100.25",
        "description": (
            "Synthetic alert: repeated failed logins followed "
            "by a successful login."
        ),
        "data_source": "synthetic_demo_data",
    }
}


def search_security_logs(
    username: str,
    time_window_minutes: int = 30,
) -> dict[str, Any]:
    """Search imported events first, then use demo data if none match."""

    try:
        args = LogSearchArgs(
            username=username,
            time_window_minutes=time_window_minutes,
        )
    except ValidationError:
        return {
            "error": "Invalid log search arguments.",
            "events_found": 0,
            "events": [],
            "data_source": "none",
        }

    # Prefer persisted, imported security events.
    try:
        imported_events = search_imported_events(
            username=args.username,
            limit=500,
        )
    except Exception:
        return {
            "error": "Imported security log search failed.",
            "events_found": 0,
            "events": [],
            "data_source": "imported_sqlite",
        }

    now = datetime.now(timezone.utc)
    imported_matches: list[dict[str, Any]] = []

    for event in imported_events:
        try:
            timestamp = datetime.fromisoformat(
                event["timestamp"].replace("Z", "+00:00")
            )
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)

            minutes_ago = (now - timestamp.astimezone(timezone.utc)).total_seconds() / 60
        except (ValueError, TypeError, KeyError, AttributeError):
            # Never use malformed timestamps as investigation evidence.
            continue

        if 0 <= minutes_ago <= args.time_window_minutes:
            imported_matches.append(
                {
                    "event_id": event["event_id"],
                    "username": event["username"],
                    "event_type": event["event_type"],
                    "source_ip": event["source_ip"],
                    "minutes_ago": int(minutes_ago),
                    "timestamp": event["timestamp"],
                    "source_file": event["source_file"],
                }
            )

    if imported_matches:
        return {
            "username": args.username,
            "time_window_minutes": args.time_window_minutes,
            "events_found": len(imported_matches),
            "events": imported_matches,
            "data_source": "imported_sqlite",
        }

    # Keep existing demo behavior when no imported event matches the window.
    matches = [
        log.copy()
        for log in SAMPLE_LOGS
        if log["username"].casefold() == args.username.casefold()
        and 0 <= log["minutes_ago"] <= args.time_window_minutes
    ]

    return {
        "username": args.username,
        "time_window_minutes": args.time_window_minutes,
        "events_found": len(matches),
        "events": matches,
        "data_source": "synthetic_demo_data",
    }


def get_alert_details(alert_id: str) -> dict[str, Any]:
    """Retrieve an alert from the synthetic demo dataset."""

    try:
        args = AlertDetailsArgs(alert_id=alert_id)
    except ValidationError:
        return {
            "found": False,
            "message": "Invalid alert identifier.",
            "data_source": "synthetic_demo_data",
        }

    alert = SAMPLE_ALERTS.get(args.alert_id)

    if alert is None:
        return {
            "found": False,
            "alert_id": args.alert_id,
            "message": "Alert not found in the demo dataset.",
            "data_source": "synthetic_demo_data",
        }

    return alert.copy()
