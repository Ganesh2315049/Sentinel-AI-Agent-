
import pytest
from pydantic import ValidationError

from app.report_schema import EvidenceItem, InvestigationReport


def test_valid_evidence_item():
    item = EvidenceItem(
        event_id="EVT-001",
        event_type="failed_login",
        username="employee01",
        source_ip="198.51.100.25",
        minutes_ago=12,
    )

    assert item.event_id == "EVT-001"
    assert item.minutes_ago == 12


def test_negative_event_time_is_rejected():
    with pytest.raises(ValidationError):
        EvidenceItem(
            event_id="EVT-001",
            event_type="failed_login",
            username="employee01",
            source_ip="198.51.100.25",
            minutes_ago=-1,
        )


def test_report_requires_core_fields():
    with pytest.raises(ValidationError):
        InvestigationReport(
            alert_id="ALT-1001",
            status="completed",
        )
