"""Temporary, all-workspace tracing for the VS Code DeepSeek adapter only."""
import fcntl
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / '.runtime/live-request-trace'
STATE = DIRECTORY / 'state.json'
ENABLED = DIRECTORY / 'enabled'

def healthy(state):
    try:
        port=state['port']; token=state['token']
        if type(port) is not int or not 1 <= port <= 65535:return False
        req=urllib.request.Request(f'http://127.0.0.1:{port}/health',headers={'X-Trace-Token':token})
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req,timeout=1) as r:return r.status==204
    except Exception:return False

def ensure_service(*, accounts=False):
    DIRECTORY.mkdir(parents=True,exist_ok=True,mode=0o700)
    state_file = DIRECTORY / 'vscode-accounts-v1.json' if accounts else STATE
    action = 'serve-accounts' if accounts else 'serve'
    with (DIRECTORY/(action+'.lock')).open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        try:state=json.loads(state_file.read_text())
        except (OSError,ValueError):state={}
        if healthy(state):return state
        subprocess.Popen([sys.executable,str(Path(__file__).resolve()),action],
                         stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                         start_new_session=True,close_fds=True)
        for _ in range(50):
            time.sleep(.1)
            try:state=json.loads(state_file.read_text())
            except (OSError,ValueError):continue
            if healthy(state):return state
    raise RuntimeError('Local request tracing failed to start')

def apply_trace(env,cwd):
    if not ENABLED.exists():return env
    return _local_endpoint(env, cwd, ensure_service())


def apply_account_gateway(env, cwd):
    state = ensure_service(accounts=True)
    result = _local_endpoint(env, cwd, state)
    result['ANTHROPIC_AUTH_TOKEN'] = state['token']
    result['ANTHROPIC_API_KEY'] = ''
    for key in ('CLAUDE_CODE_OAUTH_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY'):
        result.pop(key, None)
    return result


def _local_endpoint(env, cwd, state):
    from openrouter_attribution import project_number
    result=dict(env)
    lines=[l for l in result.get('ANTHROPIC_CUSTOM_HEADERS','').splitlines()
           if not l.lower().startswith(('x-trace-token:','x-trace-project:','x-trace-run:'))]
    lines += ['X-Trace-Token: '+state['token'],
              'X-Trace-Project: '+(project_number(cwd) or 'unknown'),
              'X-Trace-Run: '+str(uuid.uuid4())]
    result['ANTHROPIC_CUSTOM_HEADERS']='\n'.join(lines)
    result['ANTHROPIC_BASE_URL']=f"http://127.0.0.1:{state['port']}"
    return result

def serve(*, accounts=False):
    from request_trace_proxy import TraceServer
    os.umask(0o077)
    DIRECTORY.mkdir(parents=True,exist_ok=True,mode=0o700)
    from vscode_default_deepseek import read_key
    def credential(account):
        if account == 'anthropic':
            return read_key('habib-claude-code-anthropic', 'sk-ant-')
        return read_key()
    state_file = DIRECTORY / 'vscode-accounts-v1.json' if accounts else STATE
    try: previous=json.loads(state_file.read_text())
    except (OSError,ValueError): previous={}
    token=previous.get('token') if isinstance(previous.get('token'),str) and len(previous['token'])>=24 else secrets.token_hex(32)
    port=previous.get('port') if isinstance(previous.get('port'),int) and 1<=previous['port']<=65535 else 0
    server=TraceServer(DIRECTORY/'requests.jsonl',token,
                       credential=credential if accounts else None,
                       trace_enabled=ENABLED.exists if accounts else None,
                       port=port)
    tmp=state_file.with_suffix('.tmp')
    tmp.write_text(json.dumps({'port':server.server_port,'token':server.token,'pid':os.getpid()}))
    tmp.replace(state_file)
    try:server.serve_forever()
    finally:server.server_close()

if __name__=='__main__' and sys.argv[1:] in (['serve'], ['serve-accounts']):
    serve(accounts=sys.argv[1]=='serve-accounts')
