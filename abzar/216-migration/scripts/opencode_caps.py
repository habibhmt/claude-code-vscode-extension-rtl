#!/usr/bin/env python3
"""Per-model monthly caps for OpenCode Go, read from the public console page.

Go's API publishes only aggregate windows; the per-model table lives in the
server-rendered HTML of https://opencode.ai/console/go (no login needed — the
page carries `data-model` rows with `data-plan` values). This turns that table
into .runtime/opencode-go/model-caps.json for the usage snapshot.

Measured ۲۲ نوامبر ۲۰۲۶: DeepSeek V4.1 Flash — est. requests / 5 hr: Go 43,300 ·
Go Plus 86,700; monthly limit: Go $100 · Go Plus $200.
"""
import json
from pathlib import Path
import re
import sys
import urllib.request

URL = 'https://opencode.ai/console/go'
OUT = Path(__file__).resolve().parents[1] / '.runtime/opencode-go/model-caps.json'
UA = 'claude-cli/2.1.328 (external, claude-vscode, agent-sdk/0.3.328)'
ROW = re.compile(r'data-model="([^"]+)"[^>]*>(.*?)</tr>', re.S)
VAL = re.compile(r'data-plan="([^"]+)"[^>]*>\s*<span[^>]*data-layer="current-value">([^<]*)<')


def money(text):
    digits = re.sub(r'[^0-9.]', '', text or '')
    return float(digits) if digits else None


def parse(html, plan='go-plus'):
    caps = {}
    for model, body in ROW.findall(html):
        values = dict(VAL.findall(body))
        raw = values.get(plan)
        if raw is None:
            continue
        cap = money(raw) if '$' in raw else None
        if cap:
            caps[model] = cap
    return caps


def fetch():
    request = urllib.request.Request(URL, headers={'user-agent': UA, 'accept': 'text/html'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read().decode('utf8', 'replace')


def main():
    html = Path(sys.argv[1]).read_text() if len(sys.argv) > 1 else fetch()
    caps = parse(html)
    if len(caps) < 20:
        raise SystemExit(f'فقط {len(caps)} مدل پارس شد — ساختارِ صفحه عوض شده؟')
    OUT.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    OUT.write_text(json.dumps(caps, ensure_ascii=False, indent=1, sort_keys=True))
    print(f'{len(caps)} مدل → {OUT}')
    for model in ('deepseek-v4.1-flash', 'deepseek-v4-pro'):
        print(' ', model, caps.get(model))


if __name__ == '__main__':
    main()
