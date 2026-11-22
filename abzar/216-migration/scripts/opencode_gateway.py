#!/usr/bin/env python3
"""Local gateway in front of OpenCode Go, for the Windsurf slot.

Why it exists (measured ۲۲ نوامبر ۲۰۲۶):
  1. Claude Code's model picker can discover a gateway's models, but it keeps
     only ids that start with `claude-` — a four-model fixture of
     (x-alpha, claude-test-1, gpt-9, deepseek-x) cached exactly one entry.
     OpenCode's real ids (deepseek-v4.1-flash, glm-5.3 …) would all vanish.
     So this gateway publishes each model as `claude-oc-<id>` with the human
     name in display_name, and strips the prefix on the way back.
  2. Go exposes only aggregate windows (/v1/usage: rolling, weekly, monthly).
     Per-model spend is not published, so it is measured here from every
     response's `usage.opencode.list_cost` and written to usage.jsonl.
  3. It also drops any incoming credential and adds the bearer token itself,
     so a leftover Anthropic `x-api-key` never leaves the Mac.
"""
import http.server
import json
import os
from pathlib import Path
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

import ctypes

UPSTREAM = 'https://opencode.ai/inference/go'
PREFIX = 'claude-oc-'
SERVICE = 'habib-claude-opencode'
ACCOUNT = 'windsurf'
PORT = int(os.environ.get('OPENCODE_GATEWAY_PORT', '50990'))
RUNTIME = Path(__file__).resolve().parents[1] / '.runtime/opencode-go'
USAGE = RUNTIME / 'usage.jsonl'
CAPS = RUNTIME / 'model-caps.json'
SESSION = 'claude-code-opencode-gateway'
DROP = {'authorization', 'x-api-key', 'host', 'content-length', 'connection',
        'accept-encoding', 'transfer-encoding'}

# --- مسیرِ دوم: OpenRouter، از راهِ پروکسیِ موجودِ ۵۰۹۶۷ -----------------------
# ناظر-۱۳۶ (۲۲ نوامبر ۱۹:۴۲): مسیرِ OpenRouter از نو ساخته نشود. همان
# `live_request_trace.py serve-accounts` کارِ چرخشِ حساب، ردیفِ requests.jsonl و
# پاسخِ محلیِ count_tokens را می‌کند؛ دروازه فقط پیام را به آن می‌دهد. پس
# هزینه در دروازه حساب نمی‌شود و ردیفِ دروازه `cost` ندارد.
TRACE_STATE = RUNTIME.parent / 'live-request-trace/vscode-accounts-v1.json'
OPENROUTER_CATALOGUE = RUNTIME / 'openrouter-models.json'
OPENCODE_CACHE = RUNTIME / 'opencode-models.json'
MERGED_CACHE = RUNTIME / 'merged-models.json'
STATUS = RUNTIME / 'status.json'
# مدلِ مرده نباید ۴۵ ثانیه سکوت بدهد (شرطِ ناظر-۱۳۶، ۲۰:۰۸): پیام حداکثر ۲۰
# ثانیه صبر می‌کند، بعد ردیفِ `timeout` و وضعیتِ قرمز. count_tokens ارزان است
# و همان تایم‌اوتِ کوتاه را دارد.
MESSAGE_TIMEOUT = int(os.environ.get('OPENCODE_GATEWAY_TIMEOUT', '20'))
ALARM_STATUSES = {401, 402, 403, 429, 500, 502, 503, 504}
OPENROUTER_URL = 'https://openrouter.ai/api/v1/models?endpoints=/api/v1/messages'
CATALOGUE_TTL = 3600
# الگوی مصرفِ کالیبرهٔ شکارچیِ مدل (abzar/model-hunter/docs/DETAIL.md):
# ۳۱۰٬۹۶۰ توکنِ کش + ۲۷٬۰۴۰ ورودی + ۶۹۸ خروجی در هر درخواست.
HUNTER_PATTERN = (310960, 27040, 698)
# هدرهایی که فقط در مسیرِ OpenRouter معنا دارند.
OR_HEADERS = {'anthropic-version', 'anthropic-beta', 'content-type', 'accept',
              'user-agent', 'x-app', 'http-referer', 'x-title',
              'x-openrouter-title', 'x-openrouter-app-visibility',
              'x-session-id', 'x-openrouter-session-id'}


def read_key():
    sec = ctypes.CDLL('/System/Library/Frameworks/Security.framework/Security')
    svc, acct = SERVICE.encode(), ACCOUNT.encode()
    length = ctypes.c_uint32(); data = ctypes.c_void_p()
    fn = sec.SecKeychainFindGenericPassword
    fn.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_char_p, ctypes.c_uint32,
                   ctypes.c_char_p, ctypes.POINTER(ctypes.c_uint32),
                   ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p]
    fn.restype = ctypes.c_int32
    if fn(None, len(svc), svc, len(acct), acct, ctypes.byref(length), ctypes.byref(data), None):
        return None
    try:
        return ctypes.string_at(data, length.value).decode().strip()
    finally:
        sec.SecKeychainItemFreeContent(None, data)


KEY = read_key()
AUTH_HEADERS = {'Authorization': 'Bearer ' + (KEY or ''),
                'x-opencode-session': SESSION,
                'user-agent': 'claude-cli/2.1.328 (external, claude-vscode, agent-sdk/0.3.328)'}
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
LOCK = threading.Lock()


def upstream(path, body=None, method='GET'):
    # Cloudflare in front of opencode.ai answers "error code: 1010" to urllib's
    # default UA, so the client's own name is used — same string Claude Code sends.
    headers = {'Authorization': 'Bearer ' + KEY, 'x-opencode-session': SESSION,
               'user-agent': 'claude-cli/2.1.328 (external, claude-vscode, agent-sdk/0.3.328)'}
    data = None
    if body is not None:
        headers['content-type'] = 'application/json'
        headers['anthropic-version'] = '2023-06-01'
        data = json.dumps(body, ensure_ascii=False).encode()
    request = urllib.request.Request(UPSTREAM + path, data=data, headers=headers, method=method)
    try:
        with OPENER.open(request, timeout=120) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        with error:
            return error.code, error.read()
    except (OSError, urllib.error.URLError):
        return 502, b'{"error":"gateway transport error"}'


def redistribute(items):
    return [{**m, 'id': PREFIX + m['id']} for m in items]


def catalogue():
    """The real OpenCode Go list, untouched: id and name exactly as served.

    حبیب ۲۲ نوامبر ۰۸:۰۶: «هر مدلی که از API اوپن کد می‌گیریم، با همان مشخصات
    و همان اسمِ اوپن کد» — so no `claude-oc-` prefix and no invented label here.
    """
    status, raw = upstream('/v1/models')
    if status != 200:
        return status, []
    rows = []
    for m in json.loads(raw).get('data', []):
        if not isinstance(m.get('id'), str):
            continue
        rows.append({'id': m['id'],
                     'name': m.get('name') or m.get('display_name') or m['id'],
                     'description': m.get('description') or ''})
    rows.sort(key=lambda r: r['name'].lower())
    return 200, rows


def merged_catalogue():
    """یک فهرست برای هر دو سرویس — منبعِ واحدِ لیستِ مدل (حبیب ۲۲ نوامبر ۱۹:۱۳).

    اول شناسه‌های واقعیِ اوپن‌کد با نامِ خودشان، بعد گروهِ OpenRouter که توضیحش
    با «OpenRouter —» شروع می‌شود تا معلوم باشد از اشتراک بیرون می‌رود. قیمتِ هر
    ردیف با الگوی کالیبرهٔ شکارچیِ مدل حساب می‌شود، نه با تخفیفِ اعلامی.
    """
    status, rows = catalogue()
    if status == 200 and rows:
        # کشِ آخرین فهرستِ سالمِ اوپن‌کد: اگر یک بار /v1/models جواب نداد، منو
        # نباید بی‌صدا ۳۰ ردیفِ خودش را از دست بدهد (سنجیده: ۲۰:۳۲، یک بار شد).
        try:
            OPENCODE_CACHE.write_text(json.dumps(rows, ensure_ascii=False))
        except OSError:
            pass
    else:
        try:
            rows = json.loads(OPENCODE_CACHE.read_text())
            status = 200
        except (OSError, ValueError):
            rows = []
    out = [{**r, 'provider': 'opencode'} for r in rows] if status == 200 else []
    seen = {r['id'] for r in out}
    for row in openrouter_catalogue():
        if row['id'] in seen:
            continue
        # «Fable» جایی در این مک ندارد (حبیب ۲۲ نوامبر: «این چه حرفیه حذفش کن»)
        if 'fable' in row['id'].lower() or 'fable' in str(row.get('name', '')).lower():
            continue
        cost = hunter_cost(row)
        price = f'${cost:.4f} هر درخواست' if cost is not None else 'قیمت نامعلوم'
        out.append({'id': row['id'], 'name': row['name'],
                    'description': f'OpenRouter — {price} (الگوی شکارچیِ مدل)',
                    'provider': 'openrouter'})
        seen.add(row['id'])
    # همان فهرست برای افزونهٔ وی‌اس‌کد: پچِ `modelChoices()` (project216) این فایل را
    # می‌خواند تا منوی VS Code هم از منبعِ واحد بیاید، نه از کاتالوگِ قدیمیِ OpenRouter
    # (حبیب ۲۱:۱۳: «وی‌اس‌کد نه هنوز اپن‌روتر»).
    try:
        RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
        MERGED_CACHE.write_text(json.dumps(out, ensure_ascii=False))
    except OSError:
        pass
    return (200 if out else status), out


def models():
    """Discovery endpoint. Ids are the real ones; Claude Code's client-side
    filter drops anything without `claude`/`anthropic` in the id, so the picker
    is filled from `additionalModelOptionsCache` instead (opencode_picker.py)."""
    status, rows = merged_catalogue()
    if status != 200:
        return status, b'{"error":"models unavailable"}'
    return 200, json.dumps({'data': [{**r, 'display_name': r['name'], 'type': 'model'}
                                     for r in rows]}).encode()


KNOWN_LOCK = threading.Lock()
KNOWN = {'ids': set(), 'at': 0.0}


def known_ids():
    """Model ids Go actually serves, cached for a minute."""
    with KNOWN_LOCK:
        if time.monotonic() - KNOWN['at'] < 60 and KNOWN['ids']:
            return KNOWN['ids']
    status, raw = upstream('/v1/models')
    ids = set()
    if status == 200:
        try:
            ids = {m['id'] for m in json.loads(raw).get('data', []) if isinstance(m.get('id'), str)}
        except ValueError:
            ids = set()
    if ids:
        with KNOWN_LOCK:
            KNOWN['ids'] = ids
            KNOWN['at'] = time.monotonic()
    return ids


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def openrouter_catalogue():
    """فهرستِ زندهٔ OpenRouter با کشِ یک‌ساعته — بی‌کلید، همان چیزی که اپ هم می‌بیند."""
    if OPENROUTER_CATALOGUE.exists() and time.time() - OPENROUTER_CATALOGUE.stat().st_mtime < CATALOGUE_TTL:
        try:
            return json.loads(OPENROUTER_CATALOGUE.read_text())
        except ValueError:
            pass
    rows = []
    try:
        request = urllib.request.Request(OPENROUTER_URL, headers={'user-agent': 'habib-gateway/1'})
        with OPENER.open(request, timeout=25) as response:
            raw = json.loads(response.read())
        for m in raw.get('data', []):
            if not isinstance(m, dict) or not isinstance(m.get('id'), str):
                continue
            p = m.get('pricing') or {}
            rows.append({'id': m['id'], 'name': m.get('name') or m['id'],
                         'prompt': _num(p.get('prompt')),
                         'completion': _num(p.get('completion')),
                         'cache': _num(p.get('input_cache_read'))})
        rows.sort(key=lambda r: r['id'])
    except (OSError, ValueError, urllib.error.URLError):
        rows = []
    if not rows:
        try:
            return json.loads(OPENROUTER_CATALOGUE.read_text())  # کشِ کهنه بهتر از هیچ
        except (OSError, ValueError):
            return []
    RUNTIME.mkdir(parents=True, exist_ok=True)
    try:
        OPENROUTER_CATALOGUE.write_text(json.dumps(rows, ensure_ascii=False))
    except OSError:
        pass
    return rows


def hunter_cost(row):
    """هزینهٔ هر درخواست با الگوی کالیبرهٔ شکارچیِ مدل — نه تخفیفِ اعلامی."""
    prompt = row.get('prompt')
    if prompt is None:
        return None
    cache = row.get('cache') if row.get('cache') is not None else prompt
    cache_t, input_t, output_t = HUNTER_PATTERN
    return cache_t * cache + input_t * prompt + output_t * (row.get('completion') or 0)


def route(name):
    """(provider, شناسهٔ فرستادنی, mapped_from) — ترتیبِ چهارگانهٔ ناظر-۱۳۶.

    ۱) شناسهٔ واقعیِ اوپن‌کد ⇒ اوپن‌کد
    ۲) برابرِ شناخته‌شده (املای preset/`[1m]`/vendor که به همان مدل می‌رسد) ⇒ اوپن‌کد
    ۳) شناسه‌ای که در فهرستِ OpenRouter هست و برابرِ هیچ مدلِ اوپن‌کد نیست ⇒ OpenRouter
    ۴) هیچ‌کدام ⇒ ۴۰۰ صدادار
    """
    if not isinstance(name, str) or not name:
        return None, name, None
    if name.startswith(PREFIX):
        return 'opencode', name[len(PREFIX):], None
    oc = known_ids()
    if name in oc:
        return 'opencode', name, None
    bare = name.split('[', 1)[0]
    if '@preset/' in bare:
        bare = bare.split('@preset/', 1)[0]
    for candidate in (bare, bare.rsplit('/', 1)[-1]):
        if candidate in oc:
            return 'opencode', candidate, name
        for known in sorted(oc, key=len, reverse=True):
            if candidate.startswith(known):
                return 'opencode', known, name
    or_ids = {row['id'] for row in openrouter_catalogue()}
    if name in or_ids:
        return 'openrouter', name, None
    if bare in or_ids:
        return 'openrouter', bare, name
    return None, name, None


def proxy_state():
    """(base, token) پروکسیِ OpenRouter — از فایلِ وضعیتِ خودش، هر بار خوانده می‌شود."""
    try:
        state = json.loads(TRACE_STATE.read_text())
        port, token = int(state['port']), str(state['token'])
    except (OSError, ValueError, KeyError, TypeError):
        return None, None
    return f'http://127.0.0.1:{port}', token


def set_status(provider, code, message):
    """وضعیتِ قرمزِ اتمیک: tmp + fsync + rename؛ هرگز نیمه‌نوشته نمی‌ماند."""
    payload = {'state': 'down' if code not in (429,) else 'limited',
               'provider': provider, 'code': code, 'message': message,
               'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    tmp = STATUS.with_name(STATUS.name + '.tmp')
    try:
        with open(tmp, 'w', encoding='utf8') as out:
            json.dump(payload, out, ensure_ascii=False)
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, STATUS)
    except OSError:
        pass


def clear_status(provider):
    """فقط همان پرووایدری که خطا داده، با اولین ۲۰۰ پاک می‌شود."""
    try:
        current = json.loads(STATUS.read_text())
    except (OSError, ValueError):
        return
    if current.get('provider') == provider:
        try:
            STATUS.unlink()
        except OSError:
            pass


def note(row):
    with LOCK:
        RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(USAGE, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'a', encoding='utf8') as f:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')


def spend_from(raw):
    """Sum list_cost / allowance out of an Anthropic-style response body."""
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    usage = data.get('usage') if isinstance(data, dict) else None
    if not isinstance(usage, dict):
        return None
    go = usage.get('opencode')
    if not isinstance(go, dict):
        return None
    return {'model': data.get('model'), 'input': usage.get('input_tokens'),
            'output': usage.get('output_tokens'),
            'cache_read': usage.get('cache_read_input_tokens'),
            'cache_write': usage.get('cache_creation_input_tokens'),
            'list_cost': go.get('list_cost'), 'allowance': go.get('allowance'),
            'billing_source': go.get('billing_source')}


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def reply(self, status, body, ctype='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_GET(self):
        if self.path == '/health':
            return self.reply(200, b'{"ok":true}', 'application/json')
        if self.path.rstrip('/').endswith('/v1/models') or self.path == '/v1/models':
            status, body = models()
            return self.reply(status, body)
        if self.path == '/local/usage.json':
            return self.reply(200, json.dumps(snapshot()).encode())
        if self.path == '/local/models.json':
            status, rows = merged_catalogue()
            return self.reply(status, json.dumps({'models': rows}, ensure_ascii=False).encode())
        return self.reply(404, b'{"error":"not found"}')

    def do_POST(self):
        if not self.path.startswith('/v1/'):
            return self.reply(404, b'{"error":"not found"}')
        try:
            size = int(self.headers.get('Content-Length', '-1'))
            if not 0 <= size <= 32 * 1024 * 1024:
                return self.reply(413, b'{"error":"too large"}')
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError
        except (ValueError, OSError):
            return self.reply(400, b'{"error":"bad json"}')
        # شناسهٔ ورودی پیش از بازنویسی نگه داشته می‌شود: `requested` باید همان
        # چیزی باشد که کلاینت فرستاد، نه آنچه دروازه فرستاد (سنجیده ۲۰:۳۶).
        original_model = body.get('model')
        provider, sent, mapped_from = route(original_model)
        # provider تهی یعنی هیچ‌کدام از دو سرویس این شناسه را ندارد؛ sent همان
        # رشتهٔ ورودی است و تهی‌بودنش ملاک نیست (ایرادِ سنجیده‌شده در ۲۰:۱۰).
        if provider is None or sent is None:
            wanted = body.get('model')
            note({'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                  'work_type': 'messages', 'model': None, 'requested': wanted,
                  'status': 400, 'error': 'unknown_model'})
            payload = json.dumps({'type': 'error', 'error': {
                'type': 'invalid_request_error',
                'message': f'مدلِ «{wanted}» در اوپن کد نیست؛ هیچ مدلی جای آن جواب نمی‌دهد.'}},
                ensure_ascii=False).encode()
            return self.reply(400, payload)
        body['model'] = sent
        started = time.monotonic()
        if provider == 'openrouter':
            # مسیرِ دوم: همان پروکسیِ ۵۰۹۶۷ (چرخشِ حساب، ردیفِ requests.jsonl و
            # count_tokensِ محلی مالِ اوست). هدرها فقط از فهرستِ مجازِ این مسیر
            # می‌آیند و توکنِ محلیِ پروکسی اضافه می‌شود؛ هیچ کلیدِ دومی این‌جا نیست.
            base, token = proxy_state()
            if not base:
                note({'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                      'provider': 'openrouter', 'work_type': 'messages',
                      'model': sent, 'requested': sent, 'status': 503,
                      'error': 'proxy_state_missing'})
                return self.reply(503, json.dumps({'type': 'error', 'error': {
                    'type': 'api_error',
                    'message': 'پروکسیِ OpenRouter بالا نیست (فایلِ وضعیت نبود).'}},
                    ensure_ascii=False).encode())
            headers = {k: v for k, v in self.headers.items() if k.lower() in OR_HEADERS}
            headers['X-Trace-Token'] = token
            headers['content-type'] = 'application/json'
            target = base + self.path
        else:
            headers = AUTH_HEADERS | {'content-type': 'application/json',
                                      'anthropic-version': '2023-06-01'}
            target = UPSTREAM + self.path.replace('/v1/', '/anthropic/v1/', 1)
        request = urllib.request.Request(
            target, data=json.dumps(body, ensure_ascii=False).encode(),
            headers=headers, method='POST')
        try:
            response = OPENER.open(request, timeout=MESSAGE_TIMEOUT)
        except urllib.error.HTTPError as error:
            response = error
        except TimeoutError:
            note({'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                  'provider': provider, 'work_type': 'messages', 'model': sent,
                  'requested': original_model, 'status': 504,
                  'duration_ms': round((time.monotonic() - started) * 1000),
                  'error': 'timeout'})
            set_status(provider, 504, f'مدلِ «{sent}» تا {MESSAGE_TIMEOUT} ثانیه جواب نداد')
            return self.reply(504, json.dumps({'type': 'error', 'error': {
                'type': 'api_error',
                'message': f'مدلِ «{sent}» تا {MESSAGE_TIMEOUT} ثانیه جواب نداد؛ به سرویسِ بعدی وصل نشد.'}},
                ensure_ascii=False).encode())
        except (OSError, urllib.error.URLError):
            note({'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                  'provider': provider, 'requested': original_model, 'status': 502,
                  'duration_ms': 0, 'error': 'transport_error'})
            set_status(provider, 502, 'خطای انتقال به سرویس')
            return self.reply(502, b'{"error":"gateway transport error"}')
        with response:
            status = response.status
            self.send_response(status)
            self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
            self.send_header('Connection', 'close')
            self.end_headers()
            spend = None
            pending = b''
            whole = b''
            while True:
                chunk = response.read1(65536)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
                if len(whole) < 1 << 20:
                    whole += chunk
                pending += chunk
                while b'\n' in pending:
                    line, pending = pending.split(b'\n', 1)
                    if not line.startswith(b'data:'):
                        continue
                    try:
                        event = json.loads(line[5:])
                    except ValueError:
                        continue
                    if not isinstance(event, dict):
                        continue
                    # The final usage block (with opencode.list_cost) rides the
                    # last message_delta — it never appears in a plain JSON body
                    # while streaming (measured ۲۲ نوامبر ۲۰۲۶).
                    usage = event.get('usage')
                    if not isinstance(usage, dict):
                        usage = (event.get('message') or {}).get('usage')
                    found = spend_from(json.dumps({'model': sent, 'usage': usage}))
                    if found and found.get('list_cost') is not None:
                        spend = found
                if len(pending) > 1 << 20:
                    pending = b''
        if spend is None and status == 200:
            spend = spend_from(whole)
        row = {'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
               'provider': provider,
               'work_type': 'count_tokens' if self.path.endswith('count_tokens') else 'messages',
               'model': sent,
               'requested': original_model, 'status': status,
               'duration_ms': round((time.monotonic() - started) * 1000)}
        if mapped_from and mapped_from != sent:
            row['mapped_from'] = mapped_from
        # پولِ OpenRouter فقط در requests.jsonlِ پروکسی شمرده می‌شود؛ ردیفِ
        # دروازه برای آن مسیر عددِ هزینه ندارد (شرطِ ناظر-۱۳۶، ۱۹:۴۲).
        if spend and provider == 'opencode':
            row.update({k: v for k, v in spend.items() if v is not None})
        if status >= 400:
            row['error'] = whole[:200].decode('utf8', 'replace')
        if status in ALARM_STATUSES:
            set_status(provider, status, f'پاسخِ {status} از سرویسِ {provider}')
        elif status == 200:
            clear_status(provider)
        note(row)
        self.close_connection = True


def snapshot():
    """Aggregate windows from Go plus per-model spend measured here."""
    status, raw = upstream('/v1/usage')
    usage = json.loads(raw).get('usage') if status == 200 else None
    per_model = {}
    month = time.strftime('%Y-%m', time.gmtime())
    # Every request this month that carries no list_cost, whatever its model:
    # the first gateway version wrote ۶۵ such rows (no model, no price), and a
    # future row with a model but no price must land here too instead of
    # slipping into per_model silently (شرطِ ناظر-۱۳۶، ۲۲ نوامبر).
    # count_tokens is free by nature and is excluded on purpose.
    unpriced_times = []
    if USAGE.exists():
        for line in USAGE.read_text(errors='replace').splitlines():
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if not str(row.get('time_utc', '')).startswith(month):
                continue
            # بی‌قیمت فقط ردیف‌های مسیرِ اوپن‌کد: پولِ OpenRouter در
            # requests.jsonlِ پروکسی شمرده می‌شود و این‌جا عدد ندارد.
            provider = row.get('provider') or 'opencode'
            if (provider == 'opencode' and row.get('list_cost') is None
                    and row.get('work_type') != 'count_tokens'):
                unpriced_times.append(str(row.get('time_utc', '')))
            model = row.get('model')
            if not model:
                continue
            # count_tokens costs nothing; counting it as a paid request made the
            # menubar read «۸ درخواست» when six were free tokenizations
            # (ناظر-۱۳۶، ۲۲ نوامبر). Legacy rows without work_type are neither.
            acc = per_model.setdefault(model, {'requests': 0, 'count_tokens': 0,
                                               'unpriced': 0, 'list_cost': 0.0,
                                               'provider': provider})
            # Rows written before work_type existed are still classifiable: a
            # cost means it was a real message; no cost means a tokenization.
            work = row.get('work_type') or ('messages' if row.get('list_cost') is not None else None)
            if work == 'count_tokens':
                acc['count_tokens'] += 1
            elif work == 'messages':
                acc['requests'] += 1
            else:
                acc['unpriced'] += 1
            acc['list_cost'] += float(row.get('list_cost') or 0)
    caps = {}
    if CAPS.exists():
        try:
            caps = json.loads(CAPS.read_text())
        except ValueError:
            caps = {}
    for model, acc in per_model.items():
        cap = caps.get(model)
        if isinstance(cap, (int, float)) and cap > 0:
            acc['monthly_cap'] = cap
            acc['remaining'] = round(max(0.0, cap - acc['list_cost']), 6)
            acc['used_percent'] = round(100 * acc['list_cost'] / cap, 2)
        acc['list_cost'] = round(acc['list_cost'], 6)
    honesty = {'unpriced_requests': len(unpriced_times),
               'from': min(unpriced_times) if unpriced_times else None,
               'to': max(unpriced_times) if unpriced_times else None}
    return {'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'usage': usage, 'month': month, 'per_model': per_model, 'caps': caps,
            'honesty': honesty}


if __name__ == '__main__':
    if not KEY:
        raise SystemExit('کلید OpenCode Go در Keychain نیست.')
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    server.daemon_threads = True
    print(f'listening 127.0.0.1:{PORT}', flush=True)
    server.serve_forever()
