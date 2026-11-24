#!/usr/bin/env python3
"""Opt-in loopback request trace. Not wired into the live launcher.
Use a separate X-Trace-Token header; never log headers, bodies or exception text.
The one exception is a short upstream error message on 4xx/5xx: without it a
failed request is undiagnosable. It is capped, flattened, and dropped entirely
if it looks like it contains a credential.
"""
import datetime as dt
import hmac
import http.server
import json
import os
from pathlib import Path
import queue
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

import deepseek_tokens
import uuid
from zoneinfo import ZoneInfo
from claude_deepseek import PilotError

# One source of truth: the catalog. This shape check only keeps the log useful
# when the catalog cannot be read, so a model id is never hardcoded here.
MODEL_SHAPE = re.compile(r'(?:deepseek|anthropic)/[A-Za-z0-9._@/-]{1,120}'
                         r'|anthropic-api/[A-Za-z0-9._-]{1,120}'
                         r'|claude-[A-Za-z0-9._-]{1,120}')
PATHS = frozenset({'/v1/messages', '/v1/messages?beta=true'})
# Project ids are numbers for numbered folders and folder names for the rest
# (`0th-day-salamat`). Anything with a slash, space or over 64 chars is a bad
# header and must not reach the log.
PROJECT_ID = re.compile(r'[A-Za-z0-9._-]{1,64}')
TOKEN_PATHS = frozenset({'/v1/messages/count_tokens', '/v1/messages/count_tokens?beta=true'})
CATALOG = Path(__file__).resolve().parents[1] / 'claude-api/deepseek-models.json'
FIELDS = frozenset({'time_utc','time_tehran','run_id','request_number','model',
                    'work_type','status','duration_ms','response_id','error','project','sender_run',
                    'client',
                    'input_tokens','output_tokens','cache_read_input_tokens','cache_creation_input_tokens',
                    'estimate_tokens'})

def safe_id(value):
    return value if isinstance(value,str) and re.fullmatch(r'(?:gen|msg)-[A-Za-z0-9-]{1,110}|msg_[A-Za-z0-9]{1,110}', value) else None


def safe_error(text):
    """Short upstream error text only; never a credential, never the prompt."""
    text = re.sub(r'\s+', ' ', str(text or '')).strip()
    if not text or re.search(r'sk-[A-Za-z0-9_-]{8,}', text):
        return None
    return text[:300]


def safe_client(headers):
    """Who sent the call: app name and title only, never a credential or prompt.

    user-agent says the program (claude-cli/2.1.328, node, python-requests …);
    x-app / x-title are OpenRouter's own app labels when a client sets them.
    Composed here so a row alone answers «which program was this», which is the
    question the Extensions bucket could not answer (۲۱ نوامبر ۲۰۲۶).
    """
    parts = []
    for key in ('user-agent', 'x-app', 'x-title', 'x-openrouter-title'):
        value = str(headers.get(key) or '')
        value = re.sub(r'\s+', ' ', value).strip()
        value = re.sub(r'sk-[A-Za-z0-9_-]{8,}', '', value).strip()
        if value and value not in parts:
            parts.append(value[:60])
    if not parts:
        return None
    return ' · '.join(parts)[:160]


def safe_count(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def merge_usage(row, usage):
    if not isinstance(usage, dict):
        return
    for key in ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'):
        value = safe_count(usage.get(key))
        if value is not None:
            row[key] = value


ATTRIBUTION_DELAYS = (2, 3, 5, 8)


def provider_of(base, generation_id, key, opener):
    """Which upstream actually served this generation.

    The picker's label says «DeepSeek V4.1 Flash 1017 · DeepInfra» because that
    is the preset we asked for; OpenRouter may have fallen back elsewhere. This
    asks OpenRouter what really ran. It is OpenRouter's own word, not a
    cryptographic proof — that research prototype is not callable yet — but it
    turns «Morph said, InferenceNet answered» from invisible into recorded.
    """
    request = urllib.request.Request(base + '/generation?id=' + urllib.parse.quote(generation_id),
                                     headers={'Authorization': 'Bearer ' + key})
    try:
        with opener.open(request, timeout=15) as response:
            data = json.loads(response.read()).get('data') or {}
    except urllib.error.HTTPError as error:
        # OpenRouter answers 404 until it has indexed the generation.
        error.close()
        return None
    except (OSError, ValueError, urllib.error.URLError):
        return None
    if not isinstance(data, dict):
        return None
    provider = data.get('provider_name')
    if not isinstance(provider, str) or not provider.strip():
        return None
    cost = data.get('total_cost')
    return {'provider': provider.strip()[:80],
            'model': data.get('model') if isinstance(data.get('model'), str) else None,
            'cost': cost if isinstance(cost, (int, float)) and not isinstance(cost, bool) else None}


def account_model(model, catalog):
    if not isinstance(model, str) or not model:
        raise ValueError('Missing model')
    paired = {row['value']: row['openRouterModel'] for row in catalog if row.get('openRouterModel')}
    if model.startswith('anthropic-api/'):
        native = model.removeprefix('anthropic-api/')
        if native not in paired:
            raise ValueError('Unknown Anthropic API model')
        return 'anthropic', native
    return 'openrouter', paired.get(model, model)

class TraceServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, log_path, token, *, test_upstream=None, credential=None, trace_enabled=None,
                 attribution_base='auto', port=0):
        if len(token) < 24: raise ValueError('local token too short')
        upstream = 'https://openrouter.ai/api'
        if test_upstream is not None:
            if not re.fullmatch(r'http://127\.0\.0\.1:[0-9]+',test_upstream):
                raise ValueError('test upstream must be loopback')
            upstream=test_upstream
        # Off in the isolated tests unless asked for: a fixture server has no
        # /generation route, and a background retry would outlive the test.
        self.attribution_base = ((upstream + '/v1') if test_upstream is None else None) \
            if attribution_base == 'auto' else attribution_base
        self.attribution_log = None
        self.pending = None
        if self.attribution_base:
            self.pending = queue.Queue()
            p = Path(log_path).with_name('provider-attribution.jsonl')
            p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            fd = os.open(p, os.O_WRONLY|os.O_CREAT|os.O_APPEND|os.O_NOFOLLOW, 0o600)
            os.fchmod(fd, 0o600)
            self.attribution_log = os.fdopen(fd, 'a', encoding='utf8')
            threading.Thread(target=self.attribute, daemon=True).start()
        self.upstream=upstream
        self.anthropic_upstream = test_upstream or 'https://api.anthropic.com'
        self.credential = credential
        self.trace_enabled = trace_enabled
        # Proxy environment variables must not redirect this transport.
        self.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        self.token=token; self.run_id=str(uuid.uuid4()); self.counter=0
        self.lock=threading.Lock()
        p=Path(log_path); p.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_APPEND|os.O_NOFOLLOW,0o600)
        os.fchmod(fd,0o600); self.log=os.fdopen(fd,'a',encoding='utf8')
        super().__init__(('127.0.0.1',port),TraceHandler)
    def record(self,row):
        if self.trace_enabled is not None and not self.trace_enabled():
            return
        assert set(row)<=FIELDS
        with self.lock:
            self.log.write(json.dumps(row,ensure_ascii=False)+'\n');self.log.flush()
    def ask_provider(self, generation, key, model, project):
        """Runs off the request path: OpenRouter needs a few seconds to index."""
        for delay in ATTRIBUTION_DELAYS:
            time.sleep(delay)
            found = provider_of(self.attribution_base, generation, key, self.opener)
            if not found:
                continue
            with self.lock:
                self.attribution_log.write(json.dumps({
                    'time_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
                    'generation': generation, 'requested_model': model,
                    'project': project, **found}, ensure_ascii=False) + '\n')
                self.attribution_log.flush()
            return
    def attribute(self):
        while True:
            item = self.pending.get()
            if item is None:
                return
            try:
                self.ask_provider(*item)
            except Exception:
                # A failed attribution must never take the gateway down; the
                # request it belongs to has already been answered.
                pass
    def server_close(self):
        super().server_close()
        if self.pending is not None:
            self.pending.put(None)
        self.log.close()
        if self.attribution_log is not None:
            self.attribution_log.close()

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

class TraceHandler(http.server.BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,*args): pass
    def reply(self,status):
        self.send_response(status);self.send_header('Content-Length','0')
        self.send_header('Connection','close');self.end_headers();self.close_connection=True
    def do_GET(self):
        self.reply(204 if self.path == '/health' and hmac.compare_digest(self.headers.get('X-Trace-Token',''),self.server.token) else 403)
    def do_POST(self):
        if not hmac.compare_digest(self.headers.get('X-Trace-Token',''),self.server.token):
            return self.reply(403)
        if self.path not in PATHS and not (self.server.credential and self.path in TOKEN_PATHS):
            return self.reply(404)
        if self.headers.get('Transfer-Encoding'):return self.reply(400)
        try:
            size=int(self.headers.get('Content-Length','-1'))
            if not 0<=size<=32*1024*1024: return self.reply(413)
            raw=self.rfile.read(size)
            if len(raw)!=size:return self.reply(400)
            body=json.loads(raw)
            if not isinstance(body,dict):return self.reply(400)
        except (ValueError,OSError):return self.reply(400)
        with self.server.lock:
            self.server.counter+=1; number=self.server.counter
        now=dt.datetime.now(dt.timezone.utc); start=time.monotonic()
        allowed = set()
        catalog = []
        try:
            catalog = json.loads(CATALOG.read_text())
            allowed.update(m['value'] for m in catalog)
            for m in catalog:
                if m.get('openRouterModel'):
                    allowed.update((m['openRouterModel'], 'anthropic-api/'+m['value']))
        except (OSError,ValueError,KeyError,TypeError):pass
        project = self.headers.get('X-Trace-Project','')
        sender = self.headers.get('X-Trace-Run','')
        model = body.get('model')
        if not (isinstance(model,str) and (model in allowed or MODEL_SHAPE.fullmatch(model))):
            model = 'unknown'
        row={'time_utc':now.isoformat(),'time_tehran':now.astimezone(ZoneInfo('Asia/Tehran')).isoformat(),
             'run_id':self.server.run_id,'request_number':number,
             'model':model,
             'project':project if PROJECT_ID.fullmatch(project) else 'unknown',
             'sender_run':sender if re.fullmatch(r'[a-f0-9-]{36}',sender) else 'unknown',
             'client':safe_client(self.headers),
             'work_type':'unknown','status':None,'response_id':None,'error':None,
             'input_tokens':None,'output_tokens':None,
             'cache_read_input_tokens':None,'cache_creation_input_tokens':None,
             'estimate_tokens':None}
        if self.path in TOKEN_PATHS:
            return self.count_tokens(body, row, now, start)
        # Do not infer work type from private prompt text. No verified explicit
        # sender marker is currently available, so attribution remains unknown.
        headers={k:v for k,v in self.headers.items() if k.lower() in
                 {'authorization','x-api-key','anthropic-version','anthropic-beta','content-type','accept','user-agent','x-app','http-referer','x-title','x-openrouter-title','x-openrouter-app-visibility','x-session-id','x-openrouter-session-id'}}
        upstream = self.server.upstream
        account = None
        key = None
        if self.server.credential is not None:
            try:
                account, model = account_model(body.get('model'), catalog)
                key = self.server.credential(account)
            except (PilotError, OSError):
                return self.api_error(401, 'The API key for this model is unavailable in Keychain.')
            except ValueError:
                return self.api_error(400, 'Unknown model for this API account.')
            # Neither the local token nor an incoming vendor credential may leave the Mac.
            headers = {k:v for k,v in headers.items() if k.lower() not in ('authorization','x-api-key')}
            if account == 'anthropic':
                upstream = self.server.anthropic_upstream
                headers = {k:v for k,v in headers.items() if k.lower() in
                           ('anthropic-version','anthropic-beta','content-type','accept','user-agent')}
                headers['x-api-key'] = key
            else:
                headers['Authorization'] = 'Bearer ' + key
            if model != body['model']:
                body['model'] = model
                raw = json.dumps(body, ensure_ascii=False).encode()
        request=urllib.request.Request(upstream+self.path,data=raw,headers=headers,method='POST')
        started=False
        try:
            try: response=self.server.opener.open(request,timeout=45)
            except urllib.error.HTTPError as e: response=e
            with response:
                row['status']=response.status
                # Fixed metadata only; arbitrary upstream headers never enter logs.
                row['response_id']=safe_id(response.headers.get('x-generation-id'))
                self.send_response(response.status)
                self.send_header('Content-Type',response.headers.get('Content-Type','application/octet-stream'))
                self.send_header('Connection','close');self.end_headers();started=True
                # Chunked upstream transfer is decoded by urllib; downstream is
                # close-delimited. Application bytes and SSE boundaries survive.
                pending=b''
                error_body=b''
                while True:
                    chunk=response.read1(65536)
                    if not chunk:break
                    if row['status'] >= 400 and len(error_body) < 8192:
                        error_body += chunk[:8192-len(error_body)]
                    self.wfile.write(chunk);self.wfile.flush()
                    pending += chunk
                    if len(pending)>1024*1024:pending=b''
                    while b'\n' in pending:
                        line,pending=pending.split(b'\n',1)
                        if not line.startswith(b'data:'):continue
                        try:
                            event=json.loads(line[5:])
                        except (ValueError,AttributeError):continue
                        if row['response_id'] is None:
                            row['response_id']=safe_id(event.get('id')) or safe_id(event.get('message',{}).get('id'))
                        typ=event.get('type')
                        if typ=='message_start':
                            merge_usage(row,event.get('message',{}).get('usage',{}))
                        elif typ=='message_delta':
                            merge_usage(row,event.get('usage',{}))
                # Non-streaming JSON is parsed only in memory.
                if row['response_id'] is None and pending:
                    try:
                        payload=json.loads(pending)
                        row['response_id']=safe_id(payload.get('id'))
                        merge_usage(row,payload.get('usage',{}))
                    except (ValueError,AttributeError):pass
                if row['status'] >= 400 and error_body:
                    text=error_body.decode('utf-8','replace')
                    try:
                        payload=json.loads(text)
                        detail=payload.get('error')
                        if isinstance(detail,dict):detail=detail.get('message') or detail.get('code')
                        text=str(detail or payload.get('message') or text)
                    except (ValueError,AttributeError):pass
                    row['error']=safe_error(text)
        except (OSError,urllib.error.URLError,ValueError):
            row['error']='transport_error'
            if not started:self.reply(502)
        finally:
            # Only OpenRouter can name the upstream that served a generation, and
            # only once it has indexed it — so this never blocks the answer.
            if (self.server.pending is not None and account == 'openrouter' and row['status'] == 200
                    and isinstance(row['response_id'], str) and row['response_id'].startswith('gen-')):
                self.server.pending.put((row['response_id'], key, row['model'], row['project']))
            self.close_connection=True
            row['duration_ms']=round((time.monotonic()-start)*1000)
            self.server.record(row)

    def count_tokens(self, body, row, now, start):
        """Answer /v1/messages/count_tokens here instead of earning a 404.

        OpenRouter has no such route (a key-less POST there answers 404 exactly
        like a made-up path, while /v1/messages answers 401). The count is the
        model's own tokenization of the rendered prompt; if the tokenizer files
        are missing the character estimate is returned and the row says so.
        """
        count = deepseek_tokens.count(body)
        exact = count is not None
        if not exact:
            count = deepseek_tokens.estimate(body)
        row['work_type'] = 'count_tokens' if exact else 'count_tokens_estimate'
        row['status'] = 200
        row['estimate_tokens'] = count
        row['duration_ms'] = round((time.monotonic() - start) * 1000)
        data = json.dumps({'input_tokens': count}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(data)
        self.close_connection = True
        self.server.record(row)

    def api_error(self, status, message):
        data = json.dumps({'type':'error','error':{'type':'authentication_error' if status == 401 else 'invalid_request_error',
                                                   'message':message}}).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(data)))
        self.send_header('Connection','close')
        self.end_headers()
        self.wfile.write(data)
        self.close_connection=True

if __name__=='__main__':
    raise SystemExit('Not activated. Import only for isolated tests; live launcher unchanged.')
