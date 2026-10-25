from app.agent import investigate


REQUEST = """
Investigate alert ALT-1001.

1. Retrieve the alert details first.
2. Read the username from the alert result.
3. Search security logs for exactly that username
   within the last 30 minutes.
4. Summarize the actual events returned by the tools.
5. Do not invent evidence or claim remediation.

The alert data is synthetic demo data.
"""


def test_live_agent():
    print("Testing live Ollama model...")
    print("Expected alert username: employee01")

    result = investigate(REQUEST)

    print("\n=== STRUCTURED REPORT ===")
    print(result.get("structured_report"))

    print("\n=== AGENT STATUS ===")
    print(result.get("status"))

    print("\n=== TOOL TRACE ===")
    for item in result.get("trace", []):
        print("\nTool:", item.get("tool"))
        print("Arguments:", item.get("arguments"))
        print("Result:", item.get("result"))

    print("\n=== FINAL ANSWER ===")
    print(result.get("answer", result.get("error")))

    assert result.get("status") == "completed", (
        f"Investigation failed: {result.get('error')}"
    )

    trace = result.get("trace", [])

    alert_results = [
        item["result"]
        for item in trace
        if item.get("tool") == "get_alert_details"
        and item.get("result", {}).get("found") is True
    ]

    log_searches = [
        item for item in trace
        if item.get("tool") == "search_security_logs"
    ]

    assert alert_results, "Agent did not retrieve the expected alert."
    assert log_searches, "Agent did not search security logs."

    expected_username = alert_results[0]["username"]
    searched_usernames = [
        item.get("arguments", {}).get("username")
        for item in log_searches
    ]

    print("\n=== VALIDATION ===")
    print("Expected username:", expected_username)
    print("Searched usernames:", searched_usernames)

    assert all(
        name == expected_username for name in searched_usernames
    ), "Username mismatch detected."

    print("PASS: All log searches used the alert username.")

    for item in log_searches:
        window = item.get("arguments", {}).get("time_window_minutes")
        assert window == 30, (
            f"Expected a 30-minute search window, got {window!r}."
        )

    print("PASS: All log searches used a 30-minute window.")
