#!/usr/bin/env python3
"""One file both apps can read: how much of OpenCode Go is left, per model.

Sources, all measured ۲۲ نوامبر ۲۰۲۶:
  • aggregate windows  — GET https://opencode.ai/inference/go/v1/usage
    (rolling 5h / weekly / monthly, only a percent, no model split)
  • per-model caps     — opencode.ai/console/go HTML → model-caps.json
  • per-model spend    — every response's usage.opencode.list_cost, logged by
    opencode_gateway.py in usage.jsonl (nothing upstream publishes this)

Writes ~/Library/Application Support/claude-usage-bar/opencode-go.json so the
menubar app and the ۱۸۶ panel read one shape instead of each calling the API.
"""
import json
import os
from pathlib import Path
import sys
import time
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
import opencode_caps
import vscode_opencode_wrapper as wrapper

OUT = Path.home() / 'Library/Application Support/claude-usage-bar/opencode-go.json'
MIN_LINE = OUT.with_name('opencode-go.line')
# هزینهٔ هر چت و هر فولدر (ناظر-۱۳۶، ۲۳ نوامبر ۲۰۲۶ ۱۶:۰۶ «هم‌نظر شدیم، اجرا کن»).
# همان فیلترِ snapshotِ دروازه تا جمعِ چت‌ها با جمعِ per_model یکی بماند:
# ماهِ جاری + ردیفِ دارای مدل (کارِ count_tokens پول ندارد ولی ردیفش می‌ماند).
USAGE_LOG = Path(__file__).resolve().parents[1] / '.runtime/opencode-go/usage.jsonl'
SESSIONS_DIR = Path.home() / '.claude/sessions'
PROJECTS_DIR = Path.home() / '.claude/projects'
UNKNOWN_CHAT = 'نامعلوم (پیش از ثبت)'
UNKNOWN_FOLDER = 'نامعلوم (بی‌مسیر)'


def _folder_map():
    """نامِ رمزشدهٔ پوشهٔ رونوشت ⇒ مسیرِ واقعی (با رمزکردنِ پوشه‌های واقعی، نه رمزگشایی).

    نامِ پوشهٔ `~/.claude/projects/-Users-…-136th-day-fix-rtl-claude` با `/`→`-` ساخته
    می‌شود و برگرداندنش مبهم است (خطِ تیره در مسیرِ واقعی هم هست)؛ پس برعکسش می‌کنیم.
    """
    out = {}
    for base in (Path.home(), Path.home() / '1-MY-WORK'):
        try:
            for d in base.iterdir():
                if d.is_dir():
                    out[str(d).replace('/', '-')] = str(d)
        except OSError:
            continue
    return out


def _session_meta():
    """sessionId ⇒ نام و مسیر؛ از سشن‌های زنده، بعد از نامِ پوشهٔ رونوشت (بی خواندنِ محتوا)."""
    meta = {}
    for f in SESSIONS_DIR.glob('*.json'):
        try:
            d = json.loads(f.read_text())
        except (OSError, ValueError):
            continue
        sid = d.get('sessionId')
        if sid:
            meta[sid] = {'cwd': d.get('cwd') or '', 'name': d.get('name') or ''}
    enc = _folder_map()
    for p in PROJECTS_DIR.glob('*/*.jsonl'):
        sid = p.stem
        slot = meta.setdefault(sid, {'cwd': '', 'name': ''})
        if not slot.get('cwd'):
            slot['cwd'] = enc.get(p.parent.name, '')
    return meta


def chat_costs():
    """هزینهٔ هر چت و هر فولدر از `usage.jsonl` — با همان فیلترِ snapshotِ دروازه.

    فیلتر: ماهِ جاری + ردیفِ دارای مدل (تا جمعِ چت‌ها با جمعِ `per_model` یکی بماند).
    ردیفِ بی‌`session_id` به هیچ چتی نسبت داده نمی‌شود و در گروهِ «نامعلوم» می‌ماند.
    """
    month = time.strftime('%Y-%m', time.gmtime())
    meta = _session_meta()
    per, unknown = {}, {'cost': 0.0, 'requests': 0}
    total, rows = 0.0, 0
    if USAGE_LOG.exists():
        for line in USAGE_LOG.read_text(errors='replace').splitlines():
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if not str(row.get('time_utc', '')).startswith(month):
                continue
            if not row.get('model'):
                continue
            cost = float(row.get('list_cost') or 0)
            total += cost
            rows += 1
            sid = row.get('session_id')
            if not sid:
                unknown['cost'] += cost
                unknown['requests'] += 1
                continue
            slot = per.setdefault(sid, {'cost': 0.0, 'requests': 0, 'models': {}})
            slot['cost'] += cost
            slot['requests'] += 1
            slot['models'][row['model']] = round(slot['models'].get(row['model'], 0.0) + cost, 6)
    sessions = []
    for sid, slot in per.items():
        info = meta.get(sid) or {}
        sessions.append({'session_id': sid, 'name': info.get('name') or '',
                         'cwd': info.get('cwd') or '', 'cost': round(slot['cost'], 6),
                         'requests': slot['requests'], 'models': slot['models']})
    sessions.sort(key=lambda s: (-s['cost'], s['session_id']))
    folders = {}
    for s in sessions:
        key = s['cwd'] or UNKNOWN_FOLDER
        f = folders.setdefault(key, {'cwd': s['cwd'], 'label': key, 'cost': 0.0,
                                     'requests': 0, 'chats': 0})
        f['cost'] += s['cost']
        f['requests'] += s['requests']
        f['chats'] += 1
    folder_rows = sorted(folders.values(), key=lambda f: -f['cost'])
    for f in folder_rows:
        f['cost'] = round(f['cost'], 6)
    return {'schema': 1, 'month': month, 'total': round(total, 6), 'requests': rows,
            'unknown': {'label': UNKNOWN_CHAT, 'cost': round(unknown['cost'], 6),
                        'requests': unknown['requests']},
            'sessions': sessions, 'folders': folder_rows}


def snapshot():
    if not wrapper.ensure_gateway():
        raise SystemExit('دروازهٔ محلی بالا نیامد')
    with urllib.request.urlopen(f'{wrapper.BASE}/local/usage.json', timeout=30) as response:
        return json.loads(response.read())


def merge_aliases(data):
    """Fold the OpenRouter spelling of a model onto the OpenCode one, for display.

    Rows written before the gateway sent real ids carry `deepseek/deepseek-v4.1-flash-1017`
    (۱۶ درخواست تا ۲۲ نوامبر). The raw log in usage.jsonl is left untouched —
    this is only what the apps read — and what was folded is recorded so the
    number stays explainable (شرطِ ناظر-۱۳۶).
    """
    per_model = data.get('per_model')
    if not isinstance(per_model, dict):
        return
    merged = {}
    for name, acc in per_model.items():
        target = name
        if name != 'deepseek-v4.1-flash' and 'deepseek-v4.1-flash' in name:
            target = 'deepseek-v4.1-flash'
        if target == name:
            merged[name] = acc
            continue
        slot = merged.setdefault(target, {'requests': 0, 'count_tokens': 0,
                                          'unpriced': 0, 'list_cost': 0.0})
        for counter in ('requests', 'count_tokens', 'unpriced'):
            slot[counter] = slot.get(counter, 0) + int(acc.get(counter) or 0)
        slot['list_cost'] = slot.get('list_cost', 0.0) + float(acc.get('list_cost') or 0)
        slot['merged_from'] = slot.get('merged_from', []) + [{
            'model': name, 'requests': acc.get('requests'),
            'list_cost': acc.get('list_cost')}]
    for acc in merged.values():
        cap = acc.get('monthly_cap')
        if isinstance(cap, (int, float)) and cap > 0:
            cost = float(acc.get('list_cost') or 0)
            acc['remaining'] = round(max(0.0, cap - cost), 6)
            acc['used_percent'] = round(100 * cost / cap, 2)
        acc['list_cost'] = round(float(acc.get('list_cost') or 0), 6)
    data['per_model'] = merged


def main():
    if not (Path(wrapper.GATEWAY).parent / '../../.runtime').exists():
        pass
    caps_path = Path(__file__).resolve().parents[1] / '.runtime/opencode-go/model-caps.json'
    if not caps_path.exists() or caps_path.stat().st_size < 50:
        try:
            text = opencode_caps.fetch()
            caps = opencode_caps.parse(text)
            caps_path.write_text(json.dumps(caps, ensure_ascii=False, indent=1, sort_keys=True))
        except (OSError, ValueError):
            pass
    data = snapshot()
    merge_aliases(data)
    # هزینهٔ هر چت و فولدر؛ خودش را با جمعِ per_model می‌سنجد تا اختلاف بی‌صدا نماند.
    data['chat_cost'] = chat_costs()
    per_model_total = round(sum(float((v or {}).get('list_cost') or 0)
                                for v in (data.get('per_model') or {}).values()), 6)
    # رواداریِ ۱e-4: هر مدل جدا تا ۶ رقم گِرد می‌شود، پس خطای انباشته چند ۱e-6 است
    # (سنجیده: −۱e-6). هر اختلافِ واقعی (ردیفِ جاافتاده یا دوبارشمرده) از این بزرگ‌تر است.
    if abs(per_model_total - data['chat_cost']['total']) > 1e-4:
        data['chat_cost']['mismatch'] = round(per_model_total - data['chat_cost']['total'], 6)
        print('هشدار: جمعِ چت‌ها با جمعِ per_model یکی نیست:', data['chat_cost']['mismatch'],
              file=sys.stderr)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True))
    usage = (data.get('usage') or {})
    parts = []
    for key, label in (('rolling', '۵ساعت'), ('weekly', 'هفته'), ('monthly', 'ماه')):
        row = usage.get(key) or {}
        parts.append(f"{label} {row.get('percent', '?')}٪")
    line = 'OpenCode ' + ' · '.join(parts)
    MIN_LINE.write_text(line + '\n')
    print(json.dumps({'file': str(OUT), 'line': line}, ensure_ascii=False))


if __name__ == '__main__':
    main()
