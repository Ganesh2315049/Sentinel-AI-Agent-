import csv
import json

import pytest

from app.tools.log_ingestion import (
    LogIngestionError,
    ingest_log_file,
)


VALID_EVENT = {
    "event_id": "EVT-101",
    "event_type": "failed_login",
    "username": "employee01",
    "source_ip": "192.0.2.15",
    "timestamp": "2026-10-12T10:30:00Z",
}


def test_ingest_valid_json_file(tmp_path):
    file_path = tmp_path / "events.json"
    file_path.write_text(
        json.dumps([VALID_EVENT]),
        encoding="utf-8",
    )

    result = ingest_log_file(file_path)

    assert result["events_found"] == 1
    assert result["events"][0]["username"] == "employee01"
    assert result["data_source"] == "imported_file"


def test_ingest_valid_csv_file(tmp_path):
    file_path = tmp_path / "events.csv"

    with file_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=list(VALID_EVENT.keys()),
        )
        writer.writeheader()
        writer.writerow(VALID_EVENT)

    result = ingest_log_file(file_path)

    assert result["events_found"] == 1
    assert result["events"][0]["event_type"] == "failed_login"


def test_unsupported_file_extension_is_rejected(tmp_path):
    file_path = tmp_path / "events.txt"
    file_path.write_text("sample", encoding="utf-8")

    with pytest.raises(LogIngestionError):
        ingest_log_file(file_path)


def test_invalid_ip_address_is_rejected(tmp_path):
    event = VALID_EVENT.copy()
    event["source_ip"] = "not-an-ip"

    file_path = tmp_path / "events.json"
    file_path.write_text(json.dumps([event]), encoding="utf-8")

    with pytest.raises(LogIngestionError):
        ingest_log_file(file_path)


def test_missing_required_field_is_rejected(tmp_path):
    event = VALID_EVENT.copy()
    del event["username"]

    file_path = tmp_path / "events.json"
    file_path.write_text(json.dumps([event]), encoding="utf-8")

    with pytest.raises(LogIngestionError):
        ingest_log_file(file_path)


def test_missing_file_is_rejected(tmp_path):
    file_path = tmp_path / "missing.json"

    with pytest.raises(LogIngestionError):
        ingest_log_file(file_path)
