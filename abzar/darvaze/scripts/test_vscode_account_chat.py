"""Switch API accounts in one real native VS Code chat, using two offline API fixtures."""
import http.server
import json
from pathlib import Path
import queue
import subprocess
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from request_trace_proxy import TraceServer
from vscode_deepseek_wrapper import prepare


class ModelEndpoint(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        self.server.seen.append((body['model'], self.headers.get('authorization'), self.headers.get('x-api-key')))
        message = {'id': 'msg_fixture', 'type': 'message', 'role': 'assistant', 'model': body['model'],
                   'content': [], 'stop_reason': None, 'usage': {'input_tokens': 1, 'output_tokens': 0}}
        events = [
            ('message_start', {'message': message}),
            ('content_block_start', {'index': 0, 'content_block': {'type': 'text', 'text': ''}}),
            ('content_block_delta', {'index': 0, 'delta': {'type': 'text_delta', 'text': 'OK'}}),
            ('content_block_stop', {'index': 0}),
            ('message_delta', {'delta': {'stop_reason': 'end_turn', 'stop_sequence': None}, 'usage': {'output_tokens': 1}}),
            ('message_stop', {}),
        ]
        data = ''.join('event: ' + typ + '\ndata: ' + json.dumps({'type': typ, **event}) + '\n\n'
                       for typ, event in events).encode()
        self.send_response(200)
        self.send_header('content-type', 'text/event-stream')
        self.send_header('content-length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def active_native():
    extensions = Path.home() / '.vscode/extensions'
    entry = next(e for e in json.loads((extensions/'extensions.json').read_text())
                 if e['identifier']['id'].lower() == 'anthropic.claude-code')
    return extensions / entry['relativeLocation'] / 'resources/native-binary/claude'


class AccountChatTests(unittest.TestCase):
    def start(self, server):
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return server

    def test_switch_in_one_native_chat(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            router, console = [self.start(http.server.ThreadingHTTPServer(('127.0.0.1', 0), ModelEndpoint)) for _ in range(2)]
            router.seen, console.seen = [], []
            token = 'local-only-account-route-fixture'
            proxy = self.start(TraceServer(root/'trace', token, test_upstream=f'http://127.0.0.1:{router.server_port}',
                                           credential=lambda account: 'fixture-' + account))
            proxy.anthropic_upstream = f'http://127.0.0.1:{console.server_port}'
            flags = ['--bare','--print','--verbose','--no-session-persistence','--setting-sources','',
                     '--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--tools','',
                     '--input-format','stream-json','--output-format','stream-json','--model','anthropic/claude-opus-5.5']
            with patch('live_request_trace.ensure_service', return_value={'port':proxy.server_port,'token':token}):
                argv, env = prepare(str(active_native()), flags, '', picker_accounts=True)
            env.update(CLAUDE_CONFIG_DIR=str(root), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1', DISABLE_TELEMETRY='1')
            with subprocess.Popen(argv, env=env, cwd=folder, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.DEVNULL, text=True, bufsize=1) as proc:
                output = queue.Queue()
                def read_output():
                    for line in proc.stdout:
                        output.put(json.loads(line))
                    output.put(None)
                threading.Thread(target=read_output, daemon=True).start()
                def send(obj):
                    proc.stdin.write(json.dumps(obj)+'\n')
                    proc.stdin.flush()
                def until(predicate):
                    deadline = time.monotonic() + 25
                    while True:
                        item = output.get(timeout=max(0, deadline-time.monotonic()))
                        self.assertIsNotNone(item, 'native chat closed')
                        if predicate(item):
                            return item
                try:
                    for index, (choice, endpoint, wire) in enumerate([
                        ('anthropic/claude-opus-5.5', router, 'anthropic/claude-opus-5.5'),
                        ('anthropic-api/claude-opus-5-5', console, 'claude-opus-5-5'),
                        ('deepseek/deepseek-v4.1-flash-1017', router, 'deepseek/deepseek-v4.1-flash-1017'),
                        # A @preset row must reach OpenRouter with the preset intact;
                        # 38 of the 52 DeepSeek rows use this shape.
                        ('deepseek/deepseek-v4.1-flash-1017@preset/mh-deepseek-v4-1-flash-1017-stepfun',
                         router,
                         'deepseek/deepseek-v4.1-flash-1017@preset/mh-deepseek-v4-1-flash-1017-stepfun')
                    ]):
                        if index:
                            req = 'pick-' + str(index)
                            send({'type':'control_request','request_id': req,'request':{
                                'subtype':'apply_flag_settings','settings':{'model':choice}}})
                            ack=until(lambda x:x.get('type')=='control_response' and x['response'].get('request_id')==req)
                            self.assertEqual(ack['response']['subtype'],'success')
                        before = len(endpoint.seen)
                        send({'type':'user','message':{'role':'user','content':'Reply OK.'}})
                        result=until(lambda x:x.get('type')=='result')
                        self.assertFalse(result.get('is_error'), result.get('result'))
                        self.assertGreater(len(endpoint.seen), before)
                        model, bearer, api_key = endpoint.seen[-1]
                        self.assertEqual(model, wire)
                        self.assertEqual((bearer,api_key), ('Bearer fixture-openrouter',None) if endpoint is router
                                         else (None,'fixture-anthropic'))
                finally:
                    proc.stdin.close()
                    proc.terminate()
                    try:proc.wait(timeout=4)
                    except subprocess.TimeoutExpired:proc.kill()


if __name__=='__main__':
    unittest.main()
