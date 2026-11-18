import json
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest.mock import patch
import live_request_trace as live
from test_request_trace_proxy import ProxyTests,TOKEN,SECRET,TEXT

class LiveTests(unittest.TestCase):
    def test_all_projects_and_disabled_rollback(self):
        with tempfile.TemporaryDirectory() as tmp:
            flag=Path(tmp)/'enabled';flag.touch()
            original={'ANTHROPIC_BASE_URL':'https://openrouter.ai/api',
                      'ANTHROPIC_CUSTOM_HEADERS':'X-Session-ID: original-session'}
            with patch.object(live,'ENABLED',flag),patch.object(live,'ensure_service',return_value={'port':12345,'token':TOKEN}):
                for folder,number in [('136th-day-fix-rtl-claude','136'),('216th-day-migration-to-open-source-model','216')]:
                    result=live.apply_trace(original,Path('/Users/habib/1-MY-WORK')/folder)
                    self.assertEqual(result['ANTHROPIC_BASE_URL'],'http://127.0.0.1:12345')
                    self.assertIn('X-Trace-Project: '+number,result['ANTHROPIC_CUSTOM_HEADERS'])
                    self.assertIn('X-Session-ID: original-session',result['ANTHROPIC_CUSTOM_HEADERS'])
                flag.unlink();self.assertEqual(live.apply_trace(original,Path.cwd()),original)

class ReceiptTests(ProxyTests):
    def test_project_metadata_and_header_preservation(self):
        raw=json.dumps({'model':'claude-haiku-5-5','messages':[{'role':'user','content':TEXT}]}).encode()
        req=urllib.request.Request(f'http://127.0.0.1:{self.proxy.server_port}/v1/messages',data=raw,headers={
          'X-Trace-Token':TOKEN,'X-Trace-Project':'136','X-Trace-Run':'00000000-0000-0000-0000-000000000001',
          'X-Session-ID':'session-fixture','X-OpenRouter-App-Visibility':'hidden','Authorization':'Bearer '+SECRET})
        with urllib.request.urlopen(req,timeout=5) as r:r.read()
        row=json.loads(self.path.read_text().splitlines()[-1])
        self.assertEqual(row['project'],'136');self.assertEqual(row['model'],'claude-haiku-5-5')
        headers={k.lower():v for k,v in self.up.observed[-1][2].items()}
        self.assertEqual(headers['x-session-id'],'session-fixture')
        self.assertEqual(headers['x-openrouter-app-visibility'],'hidden')
        self.assertNotIn('x-trace-run',headers);self.assertNotIn('x-trace-project',headers)
        for secret in (SECRET,TEXT,TOKEN):self.assertNotIn(secret,self.path.read_text())

if __name__=='__main__':unittest.main()
