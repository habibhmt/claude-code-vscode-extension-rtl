#!/usr/bin/env python3
"""Write OpenRouter's exact today spend into ClaudeUsage's source-of-truth.

The app blocks itself when the country check says IR, so its own
`analyticsToday` never runs here. This small job uses the management key and
writes only `today`/`updated`, preserving credit, folders and the rest.
"""
import datetime
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HOME = Path.home()
ENV = HOME / ".dsh/.env"
TRUTH = HOME / "Library/Application Support/ClaudeUsage/source-of-truth.json"
URL = "https://openrouter.ai/api/v1/analytics/query"


def management_key():
    override = os.environ.get("OPENROUTER_MANAGEMENT_KEY")
    if override:
        return override.strip()
    try:
        text = ENV.read_text(encoding="utf-8")
    except OSError:
        return None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() != "OPENROUTER_MANAGEMENT_KEY":
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        return value or None
    return None


def today_spend(key):
    # OpenRouter has no timezone parameter: a Tehran day is 20:30 UTC on the
    # previous day to 20:30 UTC today. Off-midnight ranges read raw generations,
    # which the docs allow for one day with one dimension.
    tehran = datetime.timezone(datetime.timedelta(hours=3, minutes=30))
    now = datetime.datetime.now(tehran)
    start_local = datetime.datetime.combine(now.date(), datetime.time.min, tzinfo=tehran)
    end_local = start_local + datetime.timedelta(days=1)
    start = start_local.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    end = end_local.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    body = {
        "metrics": ["request_count", "total_usage"],
        "dimensions": ["model"],
        "time_range": {"start": start, "end": end},
        "order_by": {"field": "total_usage", "direction": "desc"},
        "limit": 5000,
    }
    req = urllib.request.Request(
        URL,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        payload = json.load(response)
    meta = payload.get("data", {}).get("metadata", {})
    if meta.get("truncated"):
        raise RuntimeError("analytics query truncated")
    rows = payload.get("data", {}).get("data", [])
    spend = sum(float(row.get("total_usage") or 0) for row in rows)
    requests = sum(int(row.get("request_count") or 0) for row in rows)
    return spend, requests, len(rows)


def main():
    key = management_key()
    if not key:
        print("update_truth_today: no OPENROUTER_MANAGEMENT_KEY")
        return 1
    spend, requests, rows = today_spend(key)
    truth = json.loads(TRUTH.read_text(encoding="utf-8"))
    truth["today"] = {"spend": spend, "requests": requests}
    truth["updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    tmp = TRUTH.with_suffix(".tmp")
    tmp.write_text(json.dumps(truth, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, TRUTH)
    print(f"update_truth_today: spend={spend:.6f} requests={requests} rows={rows}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"update_truth_today: {error}")
        raise SystemExit(1)
