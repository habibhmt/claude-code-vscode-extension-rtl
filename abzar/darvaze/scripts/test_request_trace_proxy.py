import http.server,json,pathlib,threading,tempfile,unittest,urllib.request,urllib.error,os,copy
from request_trace_proxy import TraceServer,FIELDS
SECRET='sk-or-SYNTHETIC-NEVER-LOG-9274'
TEXT='PRIVATE-FIXTURE-TEXT-1836'
TOKEN='local-test-only-'+('x'*30)
class Upstream(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def do_POST(self):
        raw=self.rfile.read(int(self.headers['Content-Length']))
        self.server.observed.append((self.path,raw,dict(self.headers)))
        self.send_response(self.server.status)
        self.send_header('Content-Type','text/event-stream')
        self.send_header('x-generation-id','gen-fixture-42')
        self.end_headers()
        for chunk in self.server.payload:
            self.wfile.write(chunk);self.wfile.flush()

def evidence_errors(original,received,expected_output,output,rows):
    errors=[]
    if original!=received:errors.append('request_changed')
    if expected_output!=output:errors.append('response_changed')
    if rows and rows[0]['model']!=json.loads(original)['model']:errors.append('wrong_model')
    raw=json.dumps(rows)
    if any(s in raw for s in [SECRET,TEXT,TOKEN]):errors.append('private_data_logged')
    if any(not set(r)<=FIELDS for r in rows):errors.append('unexpected_field')
    return errors

class ProxyTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=pathlib.Path(self.tmp.name)/'trace.jsonl'
        self.up=http.server.ThreadingHTTPServer(('127.0.0.1',0),Upstream)
        self.up.observed=[];self.up.status=200
        self.up.payload=[b'event: message_start\ndata: {"id":"msg_fixture"}\n\n',('data: '+TEXT+'\n\n').encode(),b'event: message_stop\ndata: {}\n\n']
        self.proxy=TraceServer(self.path,TOKEN,test_upstream=f'http://127.0.0.1:{self.up.server_port}')
        for s in [self.up,self.proxy]:threading.Thread(target=s.serve_forever,daemon=True).start()
    def tearDown(self):
        for s in [self.proxy,self.up]:s.shutdown();s.server_close()
        self.tmp.cleanup()
    def call(self,model='deepseek/deepseek-v4.1-flash-1017',token=TOKEN,path='/v1/messages?beta=true',project=None):
        raw=json.dumps({'model':model,'messages':[{'role':'user','content':TEXT}], 'stream':True,'output_config':{'effort':'high'}}).encode()
        headers={'X-Trace-Token':token,'Authorization':'Bearer '+SECRET,'Content-Type':'application/json'}
        if project is not None: headers['X-Trace-Project']=project
        req=urllib.request.Request(f'http://127.0.0.1:{self.proxy.server_port}'+path,data=raw,headers=headers)
        try:r=urllib.request.urlopen(req,timeout=5)
        except urllib.error.HTTPError as e:r=e
        with r: output=r.read();status=r.status
        # Connection closes after record has been flushed by handler.
        rows=[json.loads(l) for l in self.path.read_text().splitlines()]
        return raw,output,status,rows
    def test_transparent_stream_and_private_log(self):
        raw,out,status,rows=self.call()
        self.assertEqual(status,200);self.assertEqual(len(rows),1)
        self.assertEqual(evidence_errors(raw,self.up.observed[0][1],b''.join(self.up.payload),out,rows),[])
        self.assertEqual(rows[0]['work_type'],'unknown');self.assertEqual(rows[0]['response_id'],'gen-fixture-42')
        headers={k.lower():v for k,v in self.up.observed[0][2].items()}
        self.assertEqual(headers['authorization'],'Bearer '+SECRET)
        self.assertNotIn('x-trace-token',headers)
        self.assertEqual(self.path.stat().st_mode&0o777,0o600)
    def test_project_id_accepts_folder_name_and_rejects_a_path(self):
        # A folder without a number reports its own name; anything that could
        # escape the field (slash, space, too long) must fall back to unknown.
        for value, want in [
            ('136', '136'),
            ('0th-day-salamat', '0th-day-salamat'),
            ('000-BRAIN', '000-BRAIN'),
            ('../x', 'unknown'),
            ('0th day', 'unknown'),
            ('a' * 65, 'unknown'),
        ]:
            _,_,status,rows=self.call(project=value)
            self.assertEqual(status,200)
            self.assertEqual(rows[0]['project'],want,value)
            self.path.write_text('')      # each case its own row
    def test_haiku_detected(self):
        _,_,_,rows=self.call('claude-haiku-5-5');self.assertEqual(rows[0]['model'],'claude-haiku-5-5')
    def test_explicit_accounts_in_one_chat(self):
        from claude_deepseek import PilotError
        other = http.server.ThreadingHTTPServer(('127.0.0.1',0),Upstream)
        other.observed=[];other.status=200;other.payload=self.up.payload
        threading.Thread(target=other.serve_forever,daemon=True).start()
        self.addCleanup(other.server_close)
        self.addCleanup(other.shutdown)
        self.proxy.anthropic_upstream = f'http://127.0.0.1:{other.server_port}'
        keys={'openrouter':'fixture-router-key','anthropic':'fixture-console-key'}
        self.proxy.credential = keys.__getitem__
        for menu, dest, expected in [
            ('anthropic/claude-opus-5.5', self.up, 'anthropic/claude-opus-5.5'),
            ('anthropic-api/claude-opus-5-5', other, 'claude-opus-5-5'),
            ('deepseek/deepseek-v4.1-flash-1017', self.up, 'deepseek/deepseek-v4.1-flash-1017'),
            ('claude-opus-5-5', self.up, 'anthropic/claude-opus-5.5'),
        ]:
            with self.subTest(menu=menu):
                self.assertEqual(self.call(menu)[2],200)
                _, raw, observed = dest.observed[-1]
                self.assertEqual(json.loads(raw)['model'], expected)
                h = {k.lower():v for k,v in observed.items()}
                if dest is other:
                    self.assertEqual(h['x-api-key'],keys['anthropic'])
                    self.assertNotIn('authorization',h)
                else:
                    self.assertEqual(h['authorization'],'Bearer '+keys['openrouter'])
                    self.assertNotIn('x-api-key',h)
                self.assertNotIn('x-trace-token', h)
        def missing(_): raise PilotError('missing')
        self.proxy.credential = missing
        self.assertEqual(self.call('anthropic-api/claude-opus-5-5')[2],401)
        self.assertEqual(self.call('anthropic-api/not-in-catalog')[2],400)
        self.assertEqual((len(self.up.observed),len(other.observed)),(3,1))
        for key in keys.values():self.assertNotIn(key,self.path.read_text())
    def test_error_body_not_logged(self):
        self.up.status=429;self.up.payload=[(SECRET+TEXT).encode()]
        _,out,status,rows=self.call();self.assertEqual(status,429)
        self.assertIn(SECRET.encode(),out);self.assertNotIn(SECRET,json.dumps(rows))
    def test_local_auth_and_path(self):
        self.assertEqual(self.call(token='wrong')[2],403)
        self.assertEqual(self.call(path='/different-host')[2],404)
        self.assertEqual(self.up.observed,[])
    def test_unknown_model_not_logged_as_arbitrary_text(self):
        _,_,_,rows=self.call(SECRET);self.assertEqual(rows[0]['model'],'unknown');self.assertNotIn(SECRET,json.dumps(rows))
    def test_transport_failure_no_fallback(self):
        self.up.shutdown();self.up.server_close()
        _,_,status,rows=self.call();self.assertEqual(status,502);self.assertEqual(rows[0]['error'],'transport_error')
    def test_deliberate_corruptions_detected(self):
        raw,out,_,rows=self.call();recv=self.up.observed[0][1];expected=b''.join(self.up.payload)
        wrong=copy.deepcopy(rows);wrong[0]['model']='claude-haiku-5-5'
        self.assertIn('wrong_model',evidence_errors(raw,recv,expected,out,wrong))
        self.assertIn('response_changed',evidence_errors(raw,recv,expected,out[:-5],rows))
        leaked=copy.deepcopy(rows);leaked[0]['extra']=SECRET
        self.assertIn('private_data_logged',evidence_errors(raw,recv,expected,out,leaked))
        self.assertIn('request_changed',evidence_errors(raw,recv+b' ',expected,out,rows))
    def test_count_tokens_answered_locally(self):
        import deepseek_tokens
        self.proxy.credential = {'openrouter': 'fixture-router-key'}.__getitem__
        before = len(self.up.observed)
        raw, out, status, rows = self.call(path='/v1/messages/count_tokens')
        self.assertEqual(status, 200)
        payload = json.loads(out)
        self.assertIsInstance(payload.get('input_tokens'), int)
        self.assertGreater(payload['input_tokens'], 0)
        # Nothing left the Mac: the fake upstream saw no count_tokens call.
        self.assertEqual(len(self.up.observed), before)
        row = rows[-1]
        self.assertEqual(row['status'], 200)
        self.assertEqual(row['estimate_tokens'], payload['input_tokens'])
        self.assertIsNone(row['input_tokens'])
        self.assertIn(row['work_type'], ('count_tokens', 'count_tokens_estimate'))
        self.assertEqual(row['work_type'] == 'count_tokens', deepseek_tokens.count(json.loads(raw)) is not None)
        self.assertNotIn(TEXT, json.dumps(rows))
        self.assertNotIn(SECRET, json.dumps(rows))

    def test_count_tokens_language_aware(self):
        import deepseek_tokens
        self.proxy.credential = {'openrouter': 'fixture-router-key'}.__getitem__
        en = {'model': 'm', 'messages': [{'role': 'user', 'content': 'the quick brown fox jumps over the lazy dog ' * 20}]}
        fa = {'model': 'm', 'messages': [{'role': 'user', 'content': 'روباه قهوه‌ای سریع از روی سگ تنبل می‌پرد ' * 20}]}
        if deepseek_tokens.count(en) is None:
            self.skipTest('tokenizer not installed')
        self.assertGreater(deepseek_tokens.count(fa), deepseek_tokens.count(en))

    def test_no_symlink_log(self):
        target=pathlib.Path(self.tmp.name)/'target';target.write_text('untouched')
        link=pathlib.Path(self.tmp.name)/'link';link.symlink_to(target)
        with self.assertRaises(OSError):TraceServer(link,TOKEN)
        self.assertEqual(target.read_text(),'untouched')
if __name__=='__main__':unittest.main()
