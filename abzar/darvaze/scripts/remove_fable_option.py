#!/usr/bin/env python3
"""One-shot: drop the cached «Fable» entry from ~/.claude.json, but only when
nothing is writing that file.

Conditions are ناظر-۱۳۶'s (۲۲ نوامبر ۲۰۲۶), not mine to relax:
  • zero Windsurf, zero Code, zero `claude` processes
  • the file's mtime untouched for 60 s
  • give up silently after 12 h and log «شرط جور نشد»
  • timestamped backup beside the file before any change
  • atomic write (temp + fsync + rename), never in place
  • after writing: top-level key count, hashes of the big keys, mtime — all logged
  • if the key is already gone: do nothing, log «قبلاً حذف شده»

`--no-proc-check` exists only so the copy-based sabotage test can run; the real
call never passes it.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

KEY = 'additionalModelOptionsCache'
BIG = ('projects', 'oauthAccount', 'customApiKeyResponses', 'cachedGrowthBookFeatures')
PATTERNS = ('Windsurf.app', '/Code.app/', 'Windsurf Helper', 'Visual Studio Code')


def log(path, message):
    line = f'{time.strftime("%Y-%m-%dT%H:%M:%S")} {message}'
    with open(path, 'a', encoding='utf8') as handle:
        handle.write(line + '\n')
    print(line, flush=True)


def live_processes():
    """Names of processes that would rewrite the config while we edit it."""
    found = []
    for pattern in PATTERNS:
        if subprocess.run(['pgrep', '-f', pattern], capture_output=True).returncode == 0:
            found.append(pattern)
    if subprocess.run(['pgrep', '-x', 'claude'], capture_output=True).returncode == 0:
        found.append('claude')
    return found


def digest(value):
    raw = json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def snapshot(data):
    return {'keys': len(data),
            'hashes': {k: digest(data[k]) for k in BIG if k in data}}


def stable_for(path, seconds=60):
    try:
        return time.time() - path.stat().st_mtime >= seconds
    except OSError:
        return False


def atomic_write(path, data):
    temp = path.with_name(path.name + '.tmp-remove-fable')
    with open(temp, 'w', encoding='utf8') as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', default=str(Path.home() / '.claude.json'))
    parser.add_argument('--log', default=str(Path(__file__).resolve().parents[1]
                                               / '.runtime/remove-fable.log'))
    parser.add_argument('--max-hours', type=float, default=12)
    parser.add_argument('--no-proc-check', action='store_true')
    parser.add_argument('--mtime-stable', type=float, default=60)
    args = parser.parse_args()

    path = Path(args.file)
    deadline = time.time() + args.max_hours * 3600
    Path(args.log).parent.mkdir(parents=True, exist_ok=True)
    log(args.log, f'شروع — file={path} proc_check={not args.no_proc_check}')

    while True:
        busy = [] if args.no_proc_check else live_processes()
        if not busy and stable_for(path, args.mtime_stable):
            break
        if time.time() > deadline:
            log(args.log, f'شرط جور نشد — procs={busy or "none"} '
                          f'mtime_age={time.time() - path.stat().st_mtime:.0f}s')
            return 0
        time.sleep(5)

    try:
        data = json.loads(path.read_text())
    except (OSError, ValueError) as error:
        log(args.log, f'خواندن نشد: {error}')
        return 1
    before = snapshot(data)
    log(args.log, f'قبل — keys={before["keys"]} hashes={before["hashes"]}')
    if KEY not in data:
        log(args.log, 'قبلاً حذف شده — تغییری ندادم')
        return 0

    backup = path.with_name(path.name + '.bak-' + time.strftime('%Y%m%d-%H%M%S'))
    shutil.copy2(path, backup)
    log(args.log, f'بکاپ: {backup}')

    del data[KEY]
    atomic_write(path, data)

    check = json.loads(path.read_text())
    after = snapshot(check)
    log(args.log, f'بعد — keys={after["keys"]} hashes={after["hashes"]} '
                  f'same_big_keys={before["hashes"] == after["hashes"]} '
                  f'key_gone={KEY not in check}')
    time.sleep(3)
    age = time.time() - path.stat().st_mtime
    log(args.log, f'mtime_age_after={age:.1f}s (باید کم بماند)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
