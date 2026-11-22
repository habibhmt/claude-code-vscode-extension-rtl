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
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
import opencode_caps
import vscode_opencode_wrapper as wrapper

OUT = Path.home() / 'Library/Application Support/claude-usage-bar/opencode-go.json'
MIN_LINE = OUT.with_name('opencode-go.line')


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
