#!/usr/bin/env python3
"""نگاشتِ تواناییِ مدل‌ها برای منوی VS Code — فقط ردیف‌هایی که مدرک دارند.

چرا این فایل (۲۶ نوامبر ۲۰۲۶): پچِ «فهرست از دروازه» شش فیلدِ توانایی را از
ردیف‌ها انداخت و اسلایدرِ افورت رفت. حبیب گفت «الف»: فقط مدل‌هایی که مدرک
دارند اسلایدر بگیرند، نه همه. مدرک دو جاست:

۱) `claude-api/openrouter-catalog.json` — فیلدِ `reasoning` هر مدل (فهرستِ
   سطح‌هایی که خودِ OpenRouter اعلام کرده). فقط شناسه‌هایی که واقعاً در فهرستِ
   دروازه هستند نگه داشته می‌شوند.
۲) ردیفِ خودِ دروازه (`.runtime/opencode-go/merged-models.json`) — فیلدِ `effort`
   که دروازه از `capabilities.reasoning.effort` خودِ سرویس می‌خواند (زنده).
   منبعِ اول برای ردیف‌های OpenCode همین است.

حبیب ۲۶ نوامبر ۲۰۲۶: «یک کاری باید بکنی که اداپتیو باشه و برای هر مدلی طبق همون
چیزی که براش تعریف شده بیاد». پس سطح‌ها **فقط** از مدرکِ همان مدل می‌آید و
`claude-api/deepseek-models.json` دیگر منبعِ سطح نیست (همان کاتالوگ برای
`deepseek-v4.1-flash` یک «medium» اضافه داشت که نه OpenRouter می‌دهد نه OpenCode).

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
THINKING_OFF = 'none'
# این شش فیلد فقط از کاتالوگِ قدیمی و فقط برای ردیف‌های OpenCode می‌آید
# (پرچم‌های رفتار، نه سطح). سطح‌ها هرگز از آن‌جا خوانده نمی‌شوند.
OLD_FIELDS = ('supportsAdaptiveThinking', 'supportsModeFlags')


def slim(value):
    """`deepseek/deepseek-v4.1-flash@preset/x` و `anthropic-api/claude-haiku-5-5`
    هر دو به شناسهٔ سادهٔ دروازه تبدیل می‌شوند."""
    text = str(value).split('@')[0].strip('/')
    if text.startswith('anthropic-api/'):
        text = text[len('anthropic-api/'):]
    return text.split('/')[-1]


def levels(raw):
    """سطح‌های اعلام‌شدهٔ خودِ مدل، به ترتیبِ واژه‌نامهٔ منو؛ `none` اینجا نمی‌آید."""
    if not isinstance(raw, list):
        return []
    seen = {str(x).lower() for x in raw}
    return [level for level in LEVELS if level in seen]


def supports_off(raw):
    return isinstance(raw, list) and THINKING_OFF in {str(x).lower() for x in raw}


def main():
    gateway = json.loads(MERGED.read_text(encoding='utf8'))
    catalog = {m.get('id'): m for m in json.loads(CATALOG.read_text(encoding='utf8')).get('models', [])
               if isinstance(m.get('id'), str)}
    old_by = {}
    for old in json.loads(OLD.read_text(encoding='utf8')):
        keys = {slim(old.get('value'))}
        if old.get('openRouterModel'):
            keys.add(slim(old['openRouterModel']))
        for key in keys:
            old_by.setdefault(key, old)

    rows, sources = {}, {'gateway': 0, 'openrouter_catalog': 0, 'without_levels': 0,
                         'thinking_off': 0}

    for row in gateway:
        gid = row.get('id')
        if not isinstance(gid, str):
            continue
        raw, source = row.get('effort'), 'gateway'
        if not levels(raw):                       # ردیفِ OpenRouter: از کاتالوگِ خودِ سرویس
            model = catalog.get(gid) or {}
            raw = model.get('reasoning') if isinstance(model.get('reasoning'), list) else None
            source = 'openrouter_catalog'
        found = levels(raw)
        if not found:
            sources['without_levels'] += 1
            continue
        caps = {'supportsEffort': True, 'supportedEffortLevels': found, 'source': source}
        if supports_off(raw):
            caps['supportsThinkingOff'] = True
            sources['thinking_off'] += 1
        # پرچم‌های رفتاری از کاتالوگِ قدیمی، فقط برای ردیف‌های OpenCode و فقط اگر
        # مدرکِ بالا دربارهٔ همان کلید چیزی نگفته باشد.
        if row.get('provider') == 'opencode':
            old = old_by.get(gid)
            if old:
                for field in ('supportsAdaptiveThinking', 'supportsThinkingOff',
                              'supportsAutoMode', 'supportsFastMode'):
                    if field in old and field not in caps:
                        caps[field] = old[field]
        rows[gid] = caps
        sources[source] += 1

    ordered = {key: rows[key] for key in sorted(rows)}
    payload = {'note': 'ساختهٔ saz_model_caps_picker.py — دستی ویرایش نکن',
               'gateway_rows': len(gateway), 'with_effort': len(ordered),
               'sources': sources, 'rows': ordered}
    TARGET.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'rows={len(ordered)} از {len(gateway)} ردیفِ دروازه · {sources}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
