#!/usr/bin/env python3
"""سقفِ دو مرحله‌ایِ دروازه — آزمونِ زنده با سرورِ قلابی (شرطِ ناظر-۱۳۶، ۲۳ نوامبر ۱۵:۱۰).

سه آزمون:
  ۱) سروری که هدرها را ۵۰ ثانیه دیر می‌فرستد ⇒ ۵۰۴، نه صبرِ ۱۸۰ ثانیه‌ای.
  ۲) سروری که سالم است ولی استریمش کند است ⇒ نباید قطع شود.
  ۳) خرابکاریِ عمدی: FIRST_BYTE_TIMEOUT=۵ ⇒ آزمونِ ۲ باید قرمز شود (وگرنه آزمون کور است).

اجرا: python3 test_gateway_first_byte.py [--quick]
  --quick آزمونِ ۱ را با ۸ ثانیه/سقفِ ۴ ثانیه می‌سنجد (همان مکانیزم، سریع‌تر).
"""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('gateway_under_test', HERE / 'opencode_gateway.py')
gw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gw)

TMP = Path(tempfile.mkdtemp(prefix='gw-first-byte-'))
# ردیف‌های آزمون نباید در فایلِ مصرفِ واقعی بنشینند
gw.USAGE = TMP / 'usage.jsonl'
gw.STATUS = TMP / 'status.json'
# فهرستِ مدل‌ها از سرورِ قلابی خوانده نمی‌شود؛ همان مدلِ پیش‌فرض از پیش در کش می‌نشیند.
gw.KNOWN['ids'] = {'deepseek-v4.1-flash'}
gw.KNOWN['at'] = time.monotonic() + 10000

MODE = {'name': 'slow_head'}
DELAY = {'head': 50.0, 'first': 8.0}


class Fake(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        self.rfile.read(length)
        if MODE['name'] == 'slow_head':
            time.sleep(DELAY['head'])          # هدرها هم نمی‌آیند
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.flush()
        if MODE['name'] == 'slow_body':
            time.sleep(DELAY['first'])         # هدر رفت، بایتِ اول دیر می‌آید
        for n in range(3):
            payload = {'type': 'content_block_delta', 'n': n,
                       'usage': {'opencode': {'list_cost': 0.001}}}
            try:
                self.wfile.write(b'data: ' + json.dumps(payload).encode() + b'\n\n')
                self.wfile.flush()
            except OSError:
                break          # دروازه عمداً قطع کرده (آزمونِ خرابکاری) — صدای سرورِ قلابی نیست
            if MODE['name'] == 'slow_body':
                time.sleep(4)
        self.close_connection = True


def call(port, timeout=300):
    body = json.dumps({'model': 'deepseek-v4.1-flash', 'stream': True,
                       'messages': [{'role': 'user', 'content': 'سلام'}]}).encode()
    request = urllib.request.Request(f'http://127.0.0.1:{port}/v1/messages', data=body,
                                     headers={'content-type': 'application/json',
                                              'x-claude-code-session-id': 'test-first-byte'})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            return response.status, round(time.monotonic() - started, 1), raw
    except urllib.error.HTTPError as error:
        return error.code, round(time.monotonic() - started, 1), error.read()


def main():
    quick = '--quick' in sys.argv
    if quick:
        DELAY['head'], DELAY['first'] = 10.0, 2.0
        gw.FIRST_BYTE_TIMEOUT = 4
        gw.RETRY_PAUSE = 0.1
    fake = ThreadingHTTPServer(('127.0.0.1', 0), Fake)
    threading.Thread(target=fake.serve_forever, daemon=True).start()
    gw.UPSTREAM = f'http://127.0.0.1:{fake.server_address[1]}'
    server = ThreadingHTTPServer(('127.0.0.1', 0), gw.Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    cap = gw.FIRST_BYTE_TIMEOUT
    bad = 0

    MODE['name'] = 'slow_head'
    status, seconds, raw = call(port)
    ok = status == 504 and seconds < cap + 15
    print(f'۱) بایتِ اولِ دیرآمده: کد={status} زمان={seconds}s سقف={cap}s '
          f'{"✅" if ok else "❌"}')
    bad += not ok

    MODE['name'] = 'slow_body'
    status, seconds, raw = call(port)
    streamed = raw.count(b'data:')
    ok = status == 200 and streamed == 3
    print(f'۲) پاسخِ سالمِ کند: کد={status} زمان={seconds}s تکه={streamed} '
          f'{"✅" if ok else "❌"}')
    bad += not ok

    # خرابکاریِ عمدی: اگر سقفِ بایتِ اول کوچک شود، پاسخِ سالمِ کند باید بُرده شود.
    saved = gw.FIRST_BYTE_TIMEOUT
    gw.FIRST_BYTE_TIMEOUT = 1 if quick else 5
    status, seconds, raw = call(port)
    caught = status == 504
    print(f'۳) خرابکاری (سقف={gw.FIRST_BYTE_TIMEOUT}s): کد={status} زمان={seconds}s '
          f'{"✅ قرمز شد" if caught else "❌ کور بود"}')
    bad += not caught
    gw.FIRST_BYTE_TIMEOUT = saved

    rows = [json.loads(l) for l in open(gw.USAGE)] if gw.USAGE.exists() else []
    print(f'ردیف‌های ثبت‌شده: {len(rows)} · آخرین: {rows[-1].get("error") if rows else "—"}')
    print('جمع: ' + ('سبز' if not bad else f'{bad} ❌'))
    return 1 if bad else 0


if __name__ == '__main__':
    raise SystemExit(main())
