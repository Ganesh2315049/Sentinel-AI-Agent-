
from app.report_builder import build_investigation_report
from app.tools.security_logs import (
    get_alert_details,
    search_security_logs,
)


def main():
    alert = get_alert_details("ALT-1001")

    assert alert.get("found") is True, "Alert was not found"

    username = alert["username"]
    logs = search_security_logs(username, 30)

    report = build_investigation_report(alert, logs)
    report_data = report.model_dump()

    assert report_data["username"] == username
    assert len(report_data["evidence"]) == 3
    assert report_data["data_source"] == "synthetic_demo_data"

    print("\nSTRUCTURED INVESTIGATION REPORT")
    print(report.model_dump_json(indent=2))
    print("\nPASS: Structured report integration check")


if __name__ == "__main__":
    main()
