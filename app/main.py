
from pathlib import Path
import tempfile
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agent import investigate
from app.database import initialize_database
from app.history_repository import (
    get_investigation,
    list_investigations,
    save_investigation,
)
from app.security_events_repository import (
    save_security_events,
    search_imported_events,
)
from app.tools.log_ingestion import (
    LogIngestionError,
    ingest_log_file,
)
from app.tools.security_logs import get_alert_details


app = FastAPI(
    title="Sentinel AI API",
    description="Alert investigation, history, and security-log ingestion API.",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_database()


class InvestigationRequest(BaseModel):
    alert_id: str = Field(
        min_length=1,
        max_length=50,
        description="Alert ID, for example ALT-1001",
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "Sentinel AI"}


@app.post("/investigate")
def investigate_alert(request: InvestigationRequest) -> dict[str, Any]:
    alert_id = request.alert_id.strip()

    if not alert_id:
        raise HTTPException(
            status_code=422,
            detail="alert_id cannot be empty.",
        )

    try:
        alert = get_alert_details(alert_id)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Alert lookup service unavailable.",
        ) from None

    if alert.get("found") is not True:
        raise HTTPException(status_code=404, detail="Alert not found.")

    try:
        result = investigate(
            f"Investigate alert {alert_id}. "
            "First retrieve the alert details, then search security logs "
            "for the username associated with that alert. "
            "Use the available evidence and return an investigation report."
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Investigation service unavailable.",
        ) from None

    if result.get("status") in {"error", "incomplete"}:
        raise HTTPException(
            status_code=503,
            detail="Investigation could not be completed.",
        )

    structured = result.get("structured_report")

    if (
        isinstance(structured, dict)
        and structured.get("status") == "completed"
    ):
        try:
            saved = save_investigation(result)
            result["history_id"] = saved["id"]
            result["saved_at"] = saved["created_at"]
        except Exception:
            raise HTTPException(
                status_code=503,
                detail="Investigation completed, but saving history failed.",
            ) from None

    return result


@app.get("/investigations")
def investigation_history(
    limit: int = Query(default=50, ge=1, le=100),
) -> dict[str, Any]:
    try:
        items = list_investigations(limit)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not retrieve investigation history.",
        ) from None

    return {"count": len(items), "investigations": items}


@app.get("/investigations/{history_id}")
def investigation_history_detail(history_id: int) -> dict[str, Any]:
    if history_id < 1:
        raise HTTPException(
            status_code=422,
            detail="History ID must be a positive integer.",
        )

    try:
        saved = get_investigation(history_id)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not retrieve the saved investigation.",
        ) from None

    if saved is None:
        raise HTTPException(
            status_code=404,
            detail="Saved investigation not found.",
        )

    return saved


@app.post("/logs/import")
async def import_security_logs(
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Validate and save JSON or CSV security events."""
    original_name = Path(file.filename or "").name

    if not original_name or original_name in {".", ".."}:
        raise HTTPException(status_code=400, detail="A filename is required.")

    suffix = Path(original_name).suffix.lower()

    if suffix not in {".json", ".csv"}:
        raise HTTPException(
            status_code=400,
            detail="Only JSON and CSV files are supported.",
        )

    # Read at most 5 MiB plus one byte to detect oversized uploads.
    max_bytes = 5 * 1024 * 1024

    try:
        content = await file.read(max_bytes + 1)
    finally:
        await file.close()

    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail="File exceeds the 5 MiB upload limit.",
        )

    temp_path: str | None = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=suffix,
            delete=False,
        ) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        imported = ingest_log_file(temp_path)

        events_to_save = [
            {**event, "source_file": original_name}
            for event in imported["events"]
        ]

        inserted = save_security_events(events_to_save)

        return {
            "message": "Log import processed successfully.",
            "source_file": original_name,
            "events_in_file": len(events_to_save),
            "events_inserted": inserted,
            "events_skipped_as_duplicates": len(events_to_save) - inserted,
            "data_source": "imported_file",
        }

    except LogIngestionError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from None
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not process or save the uploaded logs.",
        ) from None
    finally:
        if temp_path is not None:
            Path(temp_path).unlink(missing_ok=True)


@app.get("/logs")
def get_imported_logs(
    username: str | None = Query(default=None, min_length=1, max_length=64),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    """Search imported events, optionally by username."""
    if username is not None and not username.strip():
        raise HTTPException(
            status_code=422,
            detail="Username cannot be blank.",
        )

    try:
        events = search_imported_events(username=username, limit=limit)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not retrieve imported security logs.",
        ) from None

    return {"count": len(events), "events": events}
