#!/usr/bin/env python3
"""نگاشتِ تواناییِ مدل‌ها برای منوی VS Code — فقط ردیف‌هایی که مدرک دارند.

چرا این فایل (۲۶ نوامبر ۲۰۲۶): پچِ «فهرست از دروازه» شش فیلدِ توانایی را از
ردیف‌ها انداخت و اسلایدرِ افورت رفت. حبیب گفت «الف»: فقط مدل‌هایی که مدرک
دارند اسلایدر بگیرند، نه همه. مدرک دو جاست:

۱) `claude-api/openrouter-catalog.json` — فیلدِ `reasoning` هر مدل (فهرستِ
   سطح‌هایی که خودِ OpenRouter اعلام کرده). فقط شناسه‌هایی که واقعاً در فهرستِ
   دروازه هستند نگه داشته می‌شوند.
۲) `claude-api/deepseek-models.json` — کاتالوگِ قبلیِ خودمان؛ مدل‌هایی که
   شناسه‌شان در دروازه هم هست (سه مدلِ opencode) شش فیلدشان عیناً کپی می‌شود.

هیچ عددی در کد ساخته نمی‌شود؛ این اسکریپت فقط دو منبع را تطبیق می‌دهد.
خروجی: `claude-api/model-caps-picker.json` (فقط داده؛ کد آن را می‌خواند).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'claude-api/openrouter-catalog.json'
OLD = ROOT / 'claude-api/deepseek-models.json'
MERGED = ROOT / '.runtime/opencode-go/merged-models.json'
TARGET = ROOT / 'claude-api/model-caps-picker.json'

LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']
OLD_FIELDS = ('supportsEffort', 'supportedEffortLevels', 'supportsAdaptiveThinking',
              'supportsThinkingOff', 'supportsAutoMode', 'supportsFastMode')


def slim(value):
    """`deepseek/deepseek-v4.1-flash@preset/x` و `anthropic-api/claude-haiku-5-5`
    هر دو به شناسهٔ سادهٔ دروازه تبدیل می‌شوند."""
    text = str(value).split('@')[0].strip('/')
    if text.startswith('anthropic-api/'):
        text = text[len('anthropic-api/'):]
    return text.split('/')[-1]


def levels(raw):
    if not isinstance(raw, list):
        return []
    seen = {str(x).lower() for x in raw}
    return [level for level in LEVELS if level in seen]


def main():
    gateway = json.loads(MERGED.read_text(encoding='utf8'))
    ids = {row['id'] for row in gateway if isinstance(row.get('id'), str)}
    rows, sources = {}, {'openrouter_catalog': 0, 'old_catalog': 0, 'skipped_not_in_gateway': 0}

    document = json.loads(CATALOG.read_text(encoding='utf8'))
    for model in document.get('models', []):
        model_id = model.get('id')
        found = levels(model.get('reasoning'))
        if not found:
            continue
        if model_id not in ids:
            sources['skipped_not_in_gateway'] += 1
            continue
        rows[model_id] = {'supportsEffort': True, 'supportedEffortLevels': found}
        sources['openrouter_catalog'] += 1

    for old in json.loads(OLD.read_text(encoding='utf8')):
        keys = {slim(old.get('value'))}
        if old.get('openRouterModel'):
            keys.add(slim(old['openRouterModel']))
        for key in keys & ids:
            if key in rows:
                continue
            caps = {field: old[field] for field in OLD_FIELDS if field in old}
            if not caps.get('supportsEffort'):
                continue
            rows[key] = caps
            sources['old_catalog'] += 1

    ordered = {key: rows[key] for key in sorted(rows)}
    payload = {'note': 'ساختهٔ saz_model_caps_picker.py — دستی ویرایش نکن',
               'gateway_rows': len(ids), 'with_effort': len(ordered),
               'sources': sources, 'rows': ordered}
    TARGET.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'rows={len(ordered)} از {len(ids)} ردیفِ دروازه · {sources}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
