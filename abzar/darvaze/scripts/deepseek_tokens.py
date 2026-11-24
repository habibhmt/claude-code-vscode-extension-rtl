"""Local prompt counting with the model's own tokenizer.

The client asks POST /v1/messages/count_tokens before a request; OpenRouter has
no such route (proved: /api/v1/messages answers 401 without a key while
/v1/messages/count_tokens answers 404, exactly like a made-up path), so every
such call costs a wasted 404. This module answers it locally.

The count is not an estimate from character counts: the prompt is rendered with
the official encoding.py shipped in the model's HuggingFace repo
(deepseek-ai/DeepSeek-V4.1-Flash-1017) and tokenized with its tokenizer.json.
All five official test vectors reproduce byte-for-byte (see tests/test_input_*.json
/ test_output_*.txt) before this file is trusted.

If the tokenizer or its runtime is missing, count() returns None and the proxy
falls back to a character estimate clearly labelled as such in the log.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]          # abzar/darvaze
MODEL_DIR = HERE / 'claude-api' / 'deepseek-v41'
TOKENIZER_FILE = MODEL_DIR / 'tokenizer.json'
ENCODING_FILE = MODEL_DIR / 'encoding.py'

_state = {'tok': None, 'enc': None, 'error': None}


def _add_venv_site():
    for sp in (HERE / '.runtime').glob('venv/lib/python*/site-packages'):
        if str(sp) not in sys.path:
            sys.path.insert(0, str(sp))


def load():
    """Return (tokenizer, encoding module) or raise; cached after first call."""
    if _state['tok'] is not None:
        return _state['tok'], _state['enc']
    if _state['error'] is not None:
        raise RuntimeError(_state['error'])
    try:
        _add_venv_site()
        from tokenizers import Tokenizer
        if str(MODEL_DIR) not in sys.path:
            sys.path.insert(0, str(MODEL_DIR))
        import encoding as enc
        _state['tok'] = Tokenizer.from_file(str(TOKENIZER_FILE))
        _state['enc'] = enc
    except Exception as exc:                    # missing lib or files
        _state['error'] = f'tokenizer_unavailable: {exc.__class__.__name__}'
        raise RuntimeError(_state['error'])
    return _state['tok'], _state['enc']


def _text_of(content):
    if isinstance(content, str):
        return content
    parts = []
    for block in content or []:
        if not isinstance(block, dict):
            continue
        kind = block.get('type')
        if kind == 'text':
            parts.append(block.get('text') or '')
        elif kind == 'thinking':
            parts.append(block.get('thinking') or '')
        elif kind == 'tool_result':
            inner = block.get('content')
            parts.append(_text_of(inner) if not isinstance(inner, str) else inner)
    return '\n'.join(p for p in parts if p)


def _tool_output(content):
    return content if isinstance(content, str) else _text_of(content)


def to_openai(body):
    """Anthropic /v1/messages body -> the OpenAI-shaped messages encoding.py eats."""
    msgs = []
    system = body.get('system')
    if system:
        text = _text_of(system)
        if text:
            msgs.append({'role': 'system', 'content': text})
    for msg in body.get('messages') or []:
        if not isinstance(msg, dict):
            continue
        role = msg.get('role')
        content = msg.get('content')
        if isinstance(content, str):
            msgs.append({'role': role, 'content': content})
            continue
        texts, calls = [], []
        for block in content or []:
            if not isinstance(block, dict):
                continue
            kind = block.get('type')
            if kind == 'text':
                texts.append(block.get('text') or '')
            elif kind == 'tool_use':
                calls.append({'id': block.get('id'), 'type': 'function',
                              'function': {'name': block.get('name') or '',
                                           'arguments': json.dumps(block.get('input') or {},
                                                                   ensure_ascii=False)}})
            elif kind == 'tool_result':
                msgs.append({'role': 'tool', 'tool_call_id': block.get('tool_use_id'),
                             'content': _tool_output(block.get('content'))})
        if calls:
            msgs.append({'role': 'assistant', 'content': '\n'.join(t for t in texts if t),
                         'tool_calls': calls})
        elif any(texts):
            msgs.append({'role': role, 'content': '\n'.join(t for t in texts if t)})
    tools = []
    for tool in body.get('tools') or []:
        if not isinstance(tool, dict) or not tool.get('name'):
            continue
        tools.append({'type': 'function',
                      'function': {'name': tool['name'],
                                   'description': tool.get('description') or '',
                                   'parameters': tool.get('input_schema') or {}}})
    if tools and msgs:
        msgs[0] = dict(msgs[0], tools=tools)
    return msgs


def mode_and_effort(body):
    """Map the Anthropic `thinking` field to the model's (mode, effort).

    The field is {"type":"disabled"} when thinking is off, which is truthy — a
    plain body.get('thinking') test would count the reasoning prefix for a chat
    that never renders it. Anthropic also sends budget_tokens far outside the
    model's 1..100 range (e.g. 31999); encoding.py asserts on that, so clamp.
    """
    thinking = body.get('thinking')
    if isinstance(thinking, dict) and thinking.get('type') == 'enabled':
        budget = thinking.get('budget_tokens')
        if isinstance(budget, int) and not isinstance(budget, bool):
            return 'thinking', max(1, min(100, budget))
        return 'thinking', 75
    return 'chat', 75


def count(body):
    """Model-exact prompt tokens for an Anthropic /v1/messages body, or None."""
    try:
        tok, enc = load()
        msgs = to_openai(body)
        if not msgs:
            return 0
        mode, effort = mode_and_effort(body)
        prompt, _media = enc.encode_messages(msgs, thinking_mode=mode,
                                             reasoning_effort=effort,
                                             return_multi_modal_data=True)
        return len(tok.encode(prompt, add_special_tokens=False).ids)
    except Exception:
        return None


def estimate(body):
    """Character estimate, only used when the real tokenizer is unavailable."""
    text = json.dumps(body, ensure_ascii=False)
    ascii_chars = sum(1 for c in text if ord(c) < 128)
    return math.ceil(ascii_chars / 2.7 + (len(text) - ascii_chars) / 1.7)
