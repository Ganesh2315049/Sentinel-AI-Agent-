import ipaddress
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv


# Load D:\sentinel-ai\.env when running from the project.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

ABUSEIPDB_URL = "https://api.abuseipdb.com/api/v2/check"


def check_ip_reputation(
    ip_address: str,
    max_age_days: int = 90,
) -> dict:
    """
    Check a globally routable IP address using AbuseIPDB.

    This performs a read-only reputation lookup. It does not report
    an IP address or perform remediation.
    """
    if not isinstance(ip_address, str):
        return {
            "status": "invalid_input",
            "provider": "AbuseIPDB",
            "ip_address": str(ip_address),
            "message": "A valid IPv4 or IPv6 address is required.",
        }

    try:
        parsed_ip = ipaddress.ip_address(ip_address.strip())
    except ValueError:
        return {
            "status": "invalid_input",
            "provider": "AbuseIPDB",
            "ip_address": ip_address,
            "message": "A valid IPv4 or IPv6 address is required.",
        }

    normalized_ip = str(parsed_ip)

    # Documentation, private, loopback, reserved, and other non-global
    # addresses should not be sent to the external reputation provider.
    if not parsed_ip.is_global:
        return {
            "status": "skipped",
            "provider": "AbuseIPDB",
            "ip_address": normalized_ip,
            "message": (
                "The IP is not globally routable. "
                "External reputation lookup was skipped."
            ),
        }

    if (
        not isinstance(max_age_days, int)
        or isinstance(max_age_days, bool)
        or not 1 <= max_age_days <= 365
    ):
        return {
            "status": "invalid_input",
            "provider": "AbuseIPDB",
            "ip_address": normalized_ip,
            "message": "max_age_days must be between 1 and 365.",
        }

    api_key = os.getenv("ABUSEIPDB_API_KEY")
    if not api_key:
        return {
            "status": "unavailable",
            "provider": "AbuseIPDB",
            "ip_address": normalized_ip,
            "message": (
                "ABUSEIPDB_API_KEY is missing. Add it to the project-root "
                ".env file or configure it in the environment."
            ),
        }

    query = urlencode(
        {
            "ipAddress": normalized_ip,
            "maxAgeInDays": max_age_days,
        }
    )

    request = Request(
        f"{ABUSEIPDB_URL}?{query}",
        headers={
            "Key": api_key,
            "Accept": "application/json",
            "User-Agent": "SentinelAI/1.0",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 429:
            message = "Provider rate limit reached."
        elif exc.code in (401, 403):
            message = "Provider authentication or permission failed."
        else:
            message = f"Provider returned HTTP {exc.code}."

        return {
            "status": "unavailable",
            "provider": "AbuseIPDB",
            "ip_address": normalized_ip,
            "message": message,
        }
    except (URLError, TimeoutError, OSError):
        return {
            "status": "unavailable",
            "provider": "AbuseIPDB",
            "ip_address": normalized_ip,
            "message": "Unable to reach the reputation provider.",
        }
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {
            "status": "unavailable",
            "provider": "AbuseIPDB",
            "ip_address": normalized_ip,
            "message": "Provider returned an invalid response.",
        }

    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        return {
            "status": "unavailable",
            "provider": "AbuseIPDB",
            "ip_address": normalized_ip,
            "message": "Provider response did not contain reputation data.",
        }

    data = payload["data"]

    return {
        "status": "success",
        "provider": "AbuseIPDB",
        "ip_address": data.get("ipAddress", normalized_ip),
        "abuse_confidence_score": data.get("abuseConfidenceScore"),
        "total_reports": data.get("totalReports"),
        "country_code": data.get("countryCode"),
        "usage_type": data.get("usageType"),
        "isp": data.get("isp"),
        "last_reported_at": data.get("lastReportedAt"),
        "is_whitelisted": data.get("isWhitelisted"),
        "lookup_period_days": max_age_days,
        "message": (
            "Reputation data retrieved. Interpret the score alongside "
            "other evidence; it does not prove malicious activity."
        ),
    }
