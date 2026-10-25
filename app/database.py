import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DATABASE_PATH = DATA_DIR / "sentinel_history.db"


def get_connection() -> sqlite3.Connection:
    """Open a connection to the Sentinel AI database."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row

    # Enable foreign-key enforcement for this connection.
    connection.execute("PRAGMA foreign_keys = ON")

    return connection


def initialize_database() -> None:
    """Create investigation history, evidence, and security-event tables."""
    with get_connection() as connection:
        # 1. Investigation history table
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS investigations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id TEXT NOT NULL,
                status TEXT NOT NULL,
                severity TEXT,
                risk_score INTEGER,
                report_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (
                    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                )
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_investigations_alert_id
            ON investigations(alert_id)
            """
        )

        # 2. Evidence linked to an investigation through a foreign key
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS investigation_evidence (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                investigation_id INTEGER NOT NULL,
                event_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                username TEXT NOT NULL,
                source_ip TEXT NOT NULL,
                data_source TEXT NOT NULL,
                FOREIGN KEY (investigation_id)
                    REFERENCES investigations(id),
                UNIQUE (investigation_id, event_id, data_source)
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_investigation_evidence_investigation_id
            ON investigation_evidence(investigation_id)
            """
        )

        # 3. Imported security events
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS security_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                username TEXT NOT NULL,
                source_ip TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                source_file TEXT NOT NULL,
                imported_at TEXT NOT NULL DEFAULT (
                    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                ),
                UNIQUE(event_id, source_file)
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_security_events_username
            ON security_events(username)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_security_events_timestamp
            ON security_events(timestamp)
            """
        )
