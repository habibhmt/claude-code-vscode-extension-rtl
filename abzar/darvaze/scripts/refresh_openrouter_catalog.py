#!/usr/bin/env python3
"""One source of truth for every OpenRouter model this Mac can talk to.

Claude Code speaks the Anthropic Messages shape, so the useful universe is the
models OpenRouter serves on `/api/v1/messages` — not the whole catalogue. The
rest is kept as a name-only exclusion list so "why is X missing?" has an answer.

Stealth models are the exception: they never appear in `/v1/models`, so the only
way to see them is the public stealth page. They are recorded, never guessed.

Nothing here needs a credential. The output is sorted, so two runs against the
same upstream produce byte-identical files — the model picker rebuilds its list
from this file, and a reshuffle would move an open chat's model.
"""
import argparse
import datetime as dt
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'claude-api/openrouter-catalog.json'
MESSAGES_URL = 'https://openrouter.ai/api/v1/models?endpoints=/api/v1/messages'
ALL_URL = 'https://openrouter.ai/api/v1/models'
STEALTH_URL = 'https://openrouter.ai/stealth'
STEALTH_RE = re.compile(r'stealth/[a-z0-9][a-z0-9.-]{0,59}[a-z0-9]')


def fetch(url, timeout=45):
    request = urllib.request.Request(url, headers={'User-Agent': 'habib-model-catalog/1'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def price(value):
    """USD per million tokens. Raw per-token prices sit near 1e-7, and rounding
    those to six places turns every cheap model into a free one."""
    try:
        number = float(value) * 1_000_000
    except (TypeError, ValueError):
        return None
    # OpenRouter writes -1 for "this row has no fixed price" (router models).
    return None if number < 0 else round(number, 6)


def short_name(name, model):
    """«DeepSeek: DeepSeek V4.1 Flash 1017» -> «DeepSeek V4.1 Flash 1017»."""
    text = re.sub(r'^[^:]+:\s*', '', str(name or '')).strip()
    return text or model.split('/')[-1]


def efforts(reasoning):
    """Only the levels OpenRouter actually advertises; nothing invented."""
    if not isinstance(reasoning, dict):
        return []
    listed = reasoning.get('supported_efforts')
    if not isinstance(listed, list):
        return []
    return sorted({e for e in listed if isinstance(e, str) and e != 'none'})


def normalize(model):
    """One catalogue row, or ValueError when the shape is not what we expect."""
    if not isinstance(model, dict):
        raise ValueError('model row is not an object')
    model_id = model.get('id')
    if not isinstance(model_id, str) or '/' not in model_id or model_id.count('@'):
        raise ValueError(f'bad model id: {model_id!r}')
    pricing = model.get('pricing') or {}
    prompt, completion = price(pricing.get('prompt')), price(pricing.get('completion'))
    architecture = model.get('architecture') or {}
    parameters = model.get('supported_parameters') or []
    provider = model_id.split('/')[0]
    free = prompt == 0 and completion == 0
    # free/paid is what the picker filters on; "variable" is a router row whose
    # price depends on where the request lands, so it is neither.
    tier = 'free' if free else ('variable' if prompt is None or completion is None else 'paid')
    return {
        'id': model_id,
        'name': short_name(model.get('name'), model_id),
        'provider': provider,
        'family': model_id.split('/')[-1].split(':')[0],
        'context': model.get('context_length') if isinstance(model.get('context_length'), int) else None,
        'prompt': prompt,
        'completion': completion,
        'free': free,
        'tier': tier,
        'stealth': False,
        'tools': 'tools' in parameters if isinstance(parameters, list) else False,
        'reasoning': efforts(model.get('reasoning')),
        'modality': architecture.get('modality') if isinstance(architecture.get('modality'), str) else None,
        'created': model.get('created') if isinstance(model.get('created'), int) else None,
    }


def build(messages_payload, all_payload, stealth_html, generated):
    """Pure: the three upstream answers in, the catalogue document out."""
    served = [normalize(m) for m in messages_payload.get('data') or []]
    if not served:
        raise ValueError('no models served /api/v1/messages')
    known = {m['id'] for m in served}
    everything = [m.get('id') for m in (all_payload.get('data') or []) if isinstance(m.get('id'), str)]
    stealth = sorted(set(STEALTH_RE.findall(stealth_html.decode('utf-8', 'replace')))) if stealth_html else []
    served_count = len(served)
    # Stealth models are absent from /v1/models, so they enter as rows of their
    # own. Price is unknown, not zero: claiming "free" without evidence would be
    # the same guess that made every cheap model look free a moment ago.
    for slug in stealth:
        family = slug.split('/')[-1]
        served.append({'id': slug, 'name': family.replace('-', ' ').title(), 'provider': 'stealth',
                       'family': family, 'context': None, 'prompt': None, 'completion': None,
                       'free': None, 'tier': 'stealth', 'stealth': True, 'tools': None,
                       'reasoning': [], 'modality': None, 'created': None})
    served.sort(key=lambda m: (m['provider'], m['id']))
    providers = {}
    for row in served:
        providers[row['provider']] = providers.get(row['provider'], 0) + 1
    return {
        'generated': generated,
        'sources': {'messages': MESSAGES_URL, 'all': ALL_URL, 'stealth': STEALTH_URL},
        'counts': {'messages': served_count, 'total': len(served), 'all': len(everything), 'stealth': len(stealth),
                   'not_served': len([i for i in everything if i not in known])},
        'providers': dict(sorted(providers.items())),
        'models': served,
        'stealth': stealth,
        # Name-only: these answer on chat/completions but not on /messages, so
        # Claude Code cannot use them yet. Listed so the gap is visible.
        'not_served': sorted(i for i in everything if i not in known),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='verify the file matches upstream, write nothing')
    parser.add_argument('--offline', metavar='FILE', help='read a saved payload instead of the network')
    args = parser.parse_args()
    if args.offline:
        saved = json.loads(Path(args.offline).read_text())
        document = build(saved['messages'], saved['all'], saved.get('stealth', '').encode(), saved['generated'])
    else:
        document = build(json.loads(fetch(MESSAGES_URL)), json.loads(fetch(ALL_URL)),
                         fetch(STEALTH_URL), dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat())
    body = json.dumps(document, ensure_ascii=False, indent=1, sort_keys=False) + '\n'
    if args.check:
        current = TARGET.read_text() if TARGET.exists() else ''
        same = json.loads(current or '{}').get('models') == document['models']
        print('up to date' if same else 'catalogue changed upstream')
        return 0 if same else 1
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    temporary = TARGET.with_suffix('.json.tmp')
    temporary.write_text(body)
    temporary.replace(TARGET)
    print(f"catalogue: {document['counts']['messages']} models, {len(document['providers'])} providers, "
          f"{document['counts']['stealth']} stealth, {document['counts']['not_served']} not served on /messages")
    return 0


if __name__ == '__main__':
    sys.exit(main())
