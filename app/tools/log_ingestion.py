
import csv
import json
from datetime import datetime, timezone
from ipaddress import ip_address
from pathlib import Path
from typing import Any


MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_RECORDS = 10_000

REQUIRED_FIELDS = {
    "event_id",
    "event_type",
    "username",
    "source_ip",
    "timestamp",
}


class LogIngestionError(ValueError):
    """Raised when an uploaded log file is invalid."""


def _normalize_record(
    record: dict[str, Any],
    row_number: int,
) -> dict[str, Any]:
    missing = REQUIRED_FIELDS - record.keys()
    if missing:
        raise LogIngestionError(
            f"Record {row_number} is missing fields: "
            f"{', '.join(sorted(missing))}"
        )

    normalized = {
        key: str(record[key]).strip()
        for key in REQUIRED_FIELDS
    }

    if any(not value for value in normalized.values()):
        raise LogIngestionError(
            f"Record {row_number} contains an empty required field."
        )

    try:
        parsed_ip = ip_address(normalized["source_ip"])
    except ValueError:
        raise LogIngestionError(
            f"Record {row_number} has an invalid source_ip."
        ) from None

    try:
        timestamp = datetime.fromisoformat(
            normalized["timestamp"].replace("Z", "+00:00")
        )
    except ValueError:
        raise LogIngestionError(
            f"Record {row_number} has an invalid ISO timestamp."
        ) from None

    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    normalized["source_ip"] = str(parsed_ip)
    normalized["timestamp"] = (
        timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    )

    return normalized


def ingest_log_file(file_path: str | Path) -> dict[str, Any]:
    """Read and normalize a JSON or CSV security log file."""

    path = Path(file_path)

    if path.suffix.lower() not in {".json", ".csv"}:
        raise LogIngestionError("Only JSON and CSV files are supported.")

    try:
        if not path.is_file():
            raise LogIngestionError("Log file does not exist.")

        if path.stat().st_size > MAX_FILE_SIZE:
            raise LogIngestionError("Log file exceeds the 5 MB limit.")

        text = path.read_text(encoding="utf-8-sig")
    except OSError:
        raise LogIngestionError("Unable to read the log file.") from None
    except UnicodeError:
        raise LogIngestionError("Log file must use UTF-8 encoding.") from None

    try:
        if path.suffix.lower() == ".json":
            data = json.loads(text)

            if isinstance(data, dict):
                records = data.get("events")
            else:
                records = data

            if not isinstance(records, list):
                raise LogIngestionError(
                    "JSON must contain a list of events or an events array."
                )

        else:
            records = list(csv.DictReader(text.splitlines()))

            if not records:
                raise LogIngestionError("CSV file contains no records.")

    except json.JSONDecodeError:
        raise LogIngestionError("Invalid JSON format.") from None

    if len(records) > MAX_RECORDS:
        raise LogIngestionError("Log file exceeds the 10,000-record limit.")

    normalized_records = []

    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            raise LogIngestionError(
                f"Record {index} must be a JSON object."
            )

        normalized_records.append(_normalize_record(record, index))

    return {
        "source_file": path.name,
        "data_source": "imported_file",
        "events_found": len(normalized_records),
        "events": normalized_records,
    }
