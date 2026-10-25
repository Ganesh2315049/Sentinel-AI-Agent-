import json
from typing import Any

from app.database import get_connection


def save_investigation(result: dict[str, Any]) -> dict[str, Any]:
    """Save an investigation and its evidence in one transaction."""

    structured = result.get("structured_report")

    if not isinstance(structured, dict):
        raise ValueError("Investigation must contain a structured report.")

    alert_id = structured.get("alert_id")
    status = structured.get("status")

    if not isinstance(alert_id, str) or not alert_id.strip():
        raise ValueError("Investigation alert_id is required.")

    if status != "completed":
        raise ValueError("Only completed investigations can be saved.")

    evidence = structured.get("evidence", [])

    if not isinstance(evidence, list):
        raise ValueError("Investigation evidence must be a list.")

    data_source = (
        structured.get("data_source")
        or result.get("data_source")
        or "unknown"
    )

    report_json = json.dumps(result, ensure_ascii=False)

    with get_connection() as connection:
        # 1. Save the main investigation.
        cursor = connection.execute(
            """
            INSERT INTO investigations (
                alert_id,
                status,
                severity,
                risk_score,
                report_json
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                alert_id,
                status,
                structured.get("severity"),
                structured.get("risk_score"),
                report_json,
            ),
        )

        investigation_id = cursor.lastrowid

        if investigation_id is None:
            raise RuntimeError("Failed to create investigation.")

        # 2. Save evidence linked to the investigation.
        evidence_rows = []

        for item in evidence:
            if not isinstance(item, dict):
                raise ValueError("Each evidence item must be a dictionary.")

            required_fields = (
                "event_id",
                "event_type",
                "username",
                "source_ip",
            )

            if any(
                not isinstance(item.get(field), str)
                or not item[field].strip()
                for field in required_fields
            ):
                raise ValueError(
                    "Each evidence item must contain event_id, "
                    "event_type, username, and source_ip."
                )

            evidence_rows.append(
                (
                    investigation_id,
                    item["event_id"],
                    item["event_type"],
                    item["username"],
                    item["source_ip"],
                    data_source,
                )
            )

        if evidence_rows:
            connection.executemany(
                """
                INSERT INTO investigation_evidence (
                    investigation_id,
                    event_id,
                    event_type,
                    username,
                    source_ip,
                    data_source
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (
                    investigation_id,
                    event_id,
                    data_source
                ) DO NOTHING
                """,
                evidence_rows,
            )

        # 3. Return the saved investigation.
        row = connection.execute(
            """
            SELECT
                id,
                alert_id,
                status,
                severity,
                risk_score,
                created_at
            FROM investigations
            WHERE id = ?
            """,
            (investigation_id,),
        ).fetchone()

    return dict(row)


def list_investigations(limit: int = 50) -> list[dict[str, Any]]:
    """Return recent investigation summaries."""

    limit = max(1, min(limit, 200))

    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                alert_id,
                status,
                severity,
                risk_score,
                json_extract(report_json, '$.structured_report.username') AS username,
                json_extract(report_json, '$.structured_report.source_ip') AS source_ip,
                created_at
            FROM investigations
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [dict(row) for row in rows]


def get_investigation(history_id: int) -> dict[str, Any] | None:
    """Return one investigation with its saved report and evidence links."""

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                alert_id,
                status,
                severity,
                risk_score,
                report_json,
                created_at
            FROM investigations
            WHERE id = ?
            """,
            (history_id,),
        ).fetchone()

        if row is None:
            return None

        investigation = dict(row)
        investigation["report"] = json.loads(
            investigation.pop("report_json")
        )

        evidence_rows = connection.execute(
            """
            SELECT
                id,
                investigation_id,
                event_id,
                event_type,
                username,
                source_ip,
                data_source
            FROM investigation_evidence
            WHERE investigation_id = ?
            ORDER BY id
            """,
            (history_id,),
        ).fetchall()

        investigation["evidence_links"] = [
            dict(evidence_row) for evidence_row in evidence_rows
        ]

    return investigation
