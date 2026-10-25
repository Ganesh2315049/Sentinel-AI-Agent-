
from typing import Any

from app.database import get_connection


def save_security_events(events: list[dict[str, Any]]) -> int:
    """Save imported events and return the number of newly inserted rows."""
    if not events:
        return 0

    with get_connection() as connection:
        before = connection.total_changes

        connection.executemany(
            """
            INSERT INTO security_events (
                event_id,
                event_type,
                username,
                source_ip,
                timestamp,
                source_file
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(event_id, source_file) DO NOTHING
            """,
            [
                (
                    event["event_id"],
                    event["event_type"],
                    event["username"],
                    event["source_ip"],
                    event["timestamp"],
                    event["source_file"],
                )
                for event in events
            ],
        )

        return connection.total_changes - before


def search_imported_events(
    username: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Retrieve imported security events, optionally filtered by username."""
    safe_limit = max(1, min(limit, 500))

    with get_connection() as connection:
        if username is not None:
            rows = connection.execute(
                """
                SELECT s.event_id, s.event_type, s.username, s.source_ip,
                       s.timestamp, s.source_file, s.imported_at,
                       MAX(ie.investigation_id) AS investigation_id,
                       MAX(inv.alert_id) AS related_alert_id
                FROM security_events s
                LEFT JOIN investigation_evidence ie ON s.event_id = ie.event_id
                LEFT JOIN investigations inv ON ie.investigation_id = inv.id
                WHERE s.username = ?
                GROUP BY s.id
                ORDER BY s.timestamp DESC
                LIMIT ?
                """,
                (username.strip(), safe_limit),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT s.event_id, s.event_type, s.username, s.source_ip,
                       s.timestamp, s.source_file, s.imported_at,
                       MAX(ie.investigation_id) AS investigation_id,
                       MAX(inv.alert_id) AS related_alert_id
                FROM security_events s
                LEFT JOIN investigation_evidence ie ON s.event_id = ie.event_id
                LEFT JOIN investigations inv ON ie.investigation_id = inv.id
                GROUP BY s.id
                ORDER BY s.timestamp DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()

    return [dict(row) for row in rows]
