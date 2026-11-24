"""Which upstream really answered — OpenRouter's own account of a generation."""
import http.server
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.request

import request_trace_proxy as proxy


class Fixture(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.startswith('/generation?id='):
            generation = self.path.split('=', 1)[1]
            body = json.dumps({'data': {'provider_name': 'InferenceNet', 'model': 'deepseek/deepseek-v4.1-flash',
                                        'total_cost': 1e-06, 'id': generation}}).encode()
            self.send_response(200)
        else:
            body = b'{"data":null}'
            self.send_response(404)
        self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self.rfile.read(int(self.headers['Content-Length']))
        self.send_response(200)
        self.send_header('content-type', 'text/event-stream')
        self.send_header('x-generation-id', 'gen-fixture-1')
        self.send_header('content-length', '0')
        self.end_headers()


def serve(server):
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


class AttributionTests(unittest.TestCase):
    def setUp(self):
        self.fixture = serve(http.server.ThreadingHTTPServer(('127.0.0.1', 0), Fixture))
        self.addCleanup(self.fixture.server_close)
        self.addCleanup(self.fixture.shutdown)
        self.base = f'http://127.0.0.1:{self.fixture.server_port}'
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def test_the_serving_provider_is_read_back(self):
        found = proxy.provider_of(self.base, 'gen-fixture-1', 'k', self.opener)
        self.assertEqual(found, {'provider': 'InferenceNet', 'model': 'deepseek/deepseek-v4.1-flash',
                                 'cost': 1e-06})

    def test_an_unknown_generation_is_not_a_guess(self):
        # The fixture answers 404 for anything that is not /generation.
        self.assertIsNone(proxy.provider_of(self.base + '/nope', 'gen-x', 'k', self.opener))

    def test_a_request_records_its_real_provider(self):
        delays = proxy.ATTRIBUTION_DELAYS
        proxy.ATTRIBUTION_DELAYS = (0, 0)
        self.addCleanup(setattr, proxy, 'ATTRIBUTION_DELAYS', delays)
        with tempfile.TemporaryDirectory() as folder:
            server = serve(proxy.TraceServer(Path(folder) / 'requests.jsonl', 'fixture-token-1234567890',
                                             test_upstream=self.base, credential=lambda account: 'fixture-key',
                                             attribution_base=self.base))
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
            request = urllib.request.Request(
                f'http://127.0.0.1:{server.server_port}/v1/messages',
                data=json.dumps({'model': 'deepseek/deepseek-v4.1-flash-1017', 'max_tokens': 1,
                                 'messages': [{'role': 'user', 'content': 'hi'}]}).encode(),
                headers={'X-Trace-Token': 'fixture-token-1234567890', 'content-type': 'application/json'},
                method='POST')
            with self.opener.open(request, timeout=10) as response:
                self.assertEqual(response.status, 200)
            record = Path(folder) / 'provider-attribution.jsonl'
            for _ in range(100):
                if record.exists() and record.read_text().strip():
                    break
                time.sleep(0.05)
            text = record.read_text() if record.exists() else ''
            self.assertTrue(text.strip(), 'no attribution line was written')
            row = json.loads(text.strip().splitlines()[0])
            self.assertEqual(row['provider'], 'InferenceNet')
            self.assertEqual(row['generation'], 'gen-fixture-1')
            self.assertEqual(row['requested_model'], 'deepseek/deepseek-v4.1-flash-1017')
            self.assertNotIn('fixture-key', text, 'the credential reached the log')

    def test_attribution_stays_off_when_not_asked_for(self):
        with tempfile.TemporaryDirectory() as folder:
            server = serve(proxy.TraceServer(Path(folder) / 'requests.jsonl', 'fixture-token-1234567890',
                                             test_upstream=self.base, credential=lambda account: 'fixture-key'))
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
            self.assertIsNone(server.pending)
            self.assertFalse((Path(folder) / 'provider-attribution.jsonl').exists())


if __name__ == '__main__':
    unittest.main()
