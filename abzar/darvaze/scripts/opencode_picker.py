#!/usr/bin/env python3
"""Fill the model picker with OpenCode Go's own list — real ids, real names.

Claude Code's discovery endpoint keeps only ids containing `claude`/`anthropic`
(measured in 2.1.327: `filter((oe)=>/(claude|anthropic)/i.test(oe.id))`), so the
real OpenCode ids would vanish from the menu. The picker *also* renders
`additionalModelOptionsCache` in ~/.claude.json, and that list is not filtered —
the «Fable» row that appeared there proves it.

So this writes the cache from the gateway's `/local/models.json`, which is the
untouched `/v1/models` of OpenCode Go: same id, same name. Whatever is picked is
then sent to the gateway as that exact id and answered by OpenCode — no prefix,
no invented label (حبیب ۲۲ نوامبر ۰۸:۰۶).

Safe to run on every launch: flock, atomic write, timestamped backup on change,
idempotent when the list is already right, and the big keys are hashed before
and after so a bad write cannot go unnoticed.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.request

# Loopback only: a stale macOS system proxy (a VPN app that is off) must never
# sit in front of the gateway. Measured ۲۴ نوامبر ۲۰۲۶ ۰۴:۴۵ — proxy enabled at
# 127.0.0.1:1087, nothing listening, urllib refused every call, the picker
# silently lost the whole model list.
PICKER_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

PORT = int(os.environ.get('OPENCODE_GATEWAY_PORT', '50990'))
BASE = f'http://127.0.0.1:{PORT}'
KEY = 'additionalModelOptionsCache'
ANSWERED = 'additionalModelOptionsAnsweredAt'
BIG = ('projects', 'oauthAccount', 'customApiKeyResponses')
ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / '.runtime/picker.log'


def _log(message):
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG, 'a', encoding='utf8') as handle:
            handle.write(f'{time.strftime("%Y-%m-%dT%H:%M:%S")} {message}\n')
    except OSError:
        pass


def log(message):
    """Public hook so the wrapper can record what it merged into --settings."""
    _log(message)


def _hash(value):
    raw = json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def fetch_models(timeout=10):
    try:
        with PICKER_OPENER.open(f'{BASE}/local/models.json', timeout=timeout) as response:
            rows = json.loads(response.read()).get('models', [])
    except (OSError, ValueError):
        return []
    entries = []
    for row in rows:
        model_id = row.get('id')
        if not isinstance(model_id, str) or not model_id:
            continue
        name = row.get('name') or model_id
        description = row.get('description') or f'OpenCode Go · {model_id}'
        entries.append({'value': model_id, 'label': name, 'description': description})
    return entries


def default_path():
    config_dir = os.environ.get('CLAUDE_CONFIG_DIR')
    if config_dir:
        return Path(config_dir) / '.claude.json'
    return Path.home() / '.claude.json'


def seed(path=None, entries=None):
    """Rewrite the picker cache. Returns 'absent'|'same'|'written'|'busy'|'fail'."""
    path = Path(path or default_path())
    entries = entries if entries is not None else fetch_models()
    if not entries:
        _log('فهرستِ مدل از دروازه نیامد — دست نزدم')
        return 'fail'
    lock = path.with_name(path.name + '.picker.lock')
    try:
        handle = open(lock, 'a+')
    except OSError:
        return 'fail'
    with handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            return 'busy'
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            return 'fail'
        if not isinstance(data, dict):
            return 'fail'
        if data.get(KEY) == entries:
            return 'same'
        before = {k: _hash(data[k]) for k in BIG if k in data}
        before_count = len(data)
        backup = path.with_name(path.name + '.bak-picker-' + time.strftime('%Y%m%d-%H%M%S'))
        try:
            backup.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        except OSError as error:
            _log(f'بکاپ نوشته نشد: {error}')
            return 'fail'
        data[KEY] = entries
        data[ANSWERED] = int(time.time() * 1000)
        temp = path.with_name(path.name + '.picker.tmp')
        try:
            with open(temp, 'w', encoding='utf8') as out:
                json.dump(data, out, ensure_ascii=False, indent=2)
                out.flush()
                os.fsync(out.fileno())
            os.replace(temp, path)
        except OSError as error:
            _log(f'نوشتن نشد: {error}')
            return 'fail'
        check = json.loads(path.read_text())
        after = {k: _hash(check[k]) for k in BIG if k in check}
        fable = [e for e in check.get(KEY, []) if 'fable' in json.dumps(e, ensure_ascii=False).lower()]
        _log(f'نوشته شد — models={len(check.get(KEY, []))} keys_before={before_count} '
             f'keys_after={len(check)} big_keys_same={before == after} fable_rows={len(fable)} '
             f'backup={backup.name}')
        return 'written'


if __name__ == '__main__':
    print(seed())
