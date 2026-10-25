
from pydantic import BaseModel, ConfigDict, Field


class EvidenceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: str
    event_type: str
    username: str
    source_ip: str
    minutes_ago: int = Field(ge=0)


class InvestigationReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alert_id: str
    status: str
    username: str
    source_ip: str
    summary: str
    evidence: list[EvidenceItem]

    severity: str
    risk_score: int = Field(ge=0, le=100)
    risk_reason: list[str]

    recommendations: list[str]
    data_source: str = "synthetic_demo_data"
