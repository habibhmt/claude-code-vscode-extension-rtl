#!/usr/bin/env python3
"""Keep the «Fable» row out of the model picker, from the wrapper, before the
CLI reads its config.

حبیب ۲۲ نوامبر: «این چه حرفیه حذفش کن» — the row must be gone, not merely
harmless through the gateway's mapping. The CLI rewrites ~/.claude.json on exit,
so a one-off edit can come back; doing it at launch, before exec, closes the
race. Safe to run on every launch: locked, atomic, idempotent, silent when the
key is already absent.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import time

KEY = 'additionalModelOptionsCache'
LOG = Path(__file__).resolve().parents[1] / '.runtime/fable-guard.log'
BIG = ('projects', 'oauthAccount', 'customApiKeyResponses')


def _log(message):
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG, 'a', encoding='utf8') as handle:
            handle.write(f'{time.strftime("%Y-%m-%dT%H:%M:%S")} {message}\n')
    except OSError:
        pass


def _hash(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


def drop(path=None):
    """Remove the key if present. Returns 'absent', 'removed', or 'busy'."""
    path = Path(path or Path.home() / '.claude.json')
    lock = path.with_name('.claude.json.fable-guard.lock')
    try:
        handle = open(lock, 'a+')
    except OSError:
        return 'absent'
    with handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            return 'busy'
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            return 'absent'
        if not isinstance(data, dict) or KEY not in data:
            return 'absent'
        entries = data.get(KEY)
        if isinstance(entries, list):
            # Only the Fable row is junk. Removing the whole key would also wipe
            # the real OpenCode list that opencode_picker.py seeds into it, so
            # the row is filtered out and the rest is left alone.
            kept = [e for e in entries
                    if 'fable' not in json.dumps(e, ensure_ascii=False).lower()]
            if len(kept) == len(entries):
                return 'absent'
            data[KEY] = kept
        before = {k: _hash(data[k]) for k in BIG if k in data}
        before_count = len(data)
        if not isinstance(entries, list):
            del data[KEY]
            before_count = len(data) + 1
        temp = path.with_name(path.name + '.fable-guard.tmp')
        try:
            with open(temp, 'w', encoding='utf8') as out:
                json.dump(data, out, ensure_ascii=False, indent=2)
                out.flush()
                os.fsync(out.fileno())
            os.replace(temp, path)
        except OSError as error:
            _log(f'نوشتن نشد: {error}')
            return 'absent'
        written = json.loads(path.read_text())
        after = {k: _hash(written[k]) for k in BIG if k in written}
        left = len(written.get(KEY, []) or [])
        _log(f'حذف شد — keys_before={before_count} keys_after={len(written)} '
             f'big_keys_same={before == after} kept_options={left}')
        return 'removed'


if __name__ == '__main__':
    print(drop())
