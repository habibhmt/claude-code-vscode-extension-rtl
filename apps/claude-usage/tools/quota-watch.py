#!/usr/bin/env python3
"""Sample the usage percentages every 10 minutes up to the weekly reset.

Reads what the ClaudeUsage menubar app already fetched (UserDefaults key
`lastRows`, refreshed by the app every 5 minutes) — it never calls the usage
endpoint itself, because a direct call there gets rate limited.

Each sample is appended to tools/quota-watch.log as one line:
    2026-09-07 11:40:02 | session 31% | weekly 82% | fable 74% | age 3m
`age` is how old the app's own fetch was, so a frozen number is visible.
"""

import datetime
import plistlib
import subprocess
import time
import os

TZ = datetime.timezone(datetime.timedelta(hours=3, minutes=30))
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quota-watch.log")
DOMAIN = "com.habib.ClaudeUsage.v5"
STEP = 600  # 10 minutes


def read(key):
    out = subprocess.run(
        ["defaults", "export", DOMAIN, "-"], capture_output=True
    ).stdout
    return plistlib.loads(out).get(key)


def sample():
    rows = read("lastRows") or []
    at = read("lastFetchAt") or 0
    by = {r["id"]: r["p"] for r in rows}
    age = int((time.time() - at) / 60) if at else -1
    stamp = datetime.datetime.now(TZ).strftime("%Y-%m-%d %H:%M:%S")
    return (
        f"{stamp} | session {by.get('session','?')}% | weekly {by.get('weekly','?')}%"
        f" | fable {by.get('fable','?')}% | age {age}m"
    )


def schedule():
    """Every 10 minutes, then a last reading 30 seconds BEFORE the reset.

    Nothing is sampled after 12:29:59 — past that point every bucket is back to
    zero and the number says nothing about the week that just ended.
    """
    now = datetime.datetime.now(TZ)
    last = now.replace(hour=12, minute=29, second=30, microsecond=0)
    times, t = [], now
    while t < last - datetime.timedelta(seconds=STEP / 2):
        times.append(t)
        t += datetime.timedelta(seconds=STEP)
    times.append(last)
    return times


def main():
    for t in schedule():
        wait = (t - datetime.datetime.now(TZ)).total_seconds()
        if wait > 0:
            time.sleep(wait)
        with open(LOG, "a") as fh:
            fh.write(sample() + "\n")
    with open(LOG, "a") as fh:
        fh.write("--- last reading before the 12:29:59 reset; watch finished\n")


if __name__ == "__main__":
    main()
