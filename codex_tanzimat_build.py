"""Builds the host-side code of the «تنظیمات Codex» tab (تعریف ۲۵) for out/extension.js."""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent


def build_host():
    host = (REPO / 'codex-tanzimat-host.js').read_text().replace('#!/usr/bin/env node\n', '', 1)
    schema = json.loads((REPO / 'codex-config-schema.json').read_text())
    ext = (REPO / 'codex-tanzimat-ext.js').read_text()
    for mark, val in (('/*__HOST__*/', host), ('/*__SCHEMA__*/null', json.dumps(schema, ensure_ascii=False))):
        if ext.count(mark) != 1:
            raise ValueError(f'codex-tanzimat-ext.js: marker {mark} missing')
        ext = ext.replace(mark, val)
    return ext


# Where the folder filter cannot install (an older Codex, e.g. Windsurf's 26.51007), the tab's host part goes in alone.
# Its own backup; restored before the folder step so that step always starts from Codex's own file.
HOST_BACKUP = 'extension.js.chatgpt-tanzimat-backup'
ANCHORS = (
    ('Message(u=>{if(s.markMessageReceived(),u.type==="chunked-message-ack"){',
     'Message(u=>{if(globalThis.__crtlCodexTanzimat&&globalThis.__crtlCodexTanzimat.handle(this,e,u))return;'
     'if(s.markMessageReceived(),u.type==="chunked-message-ack"){'),
    ('let{id:n,method:o,params:i}=r.request;this.pendingMcpRequests.set(String(n),e),',
     'let{id:n,method:o,params:i}=r.request;if(globalThis.__crtlCodexTanzimat)i=globalThis.__crtlCodexTanzimat.turn(o,i);'
     'this.pendingMcpRequests.set(String(n),e),'),
)


def apply_anchors(source):
    for old, new in ANCHORS:
        if source.count(old) != 1:
            raise ValueError('Codex host contract changed: ' + old[:60])
        source = source.replace(old, new, 1)
    return source + '\n// CHATGPT-RTL-TANZIMAT\n' + build_host() + '\n'


def restore_host_only(ext, atomic_write):
    host = ext / 'out' / 'extension.js'
    backup = ext / 'out' / HOST_BACKUP
    if backup.exists():
        atomic_write(host, backup.read_bytes())
        backup.unlink()


def patch_host_only(ext, atomic_write):
    import subprocess, tempfile
    host = ext / 'out' / 'extension.js'
    if (ext / 'webview' / '.chatgpt-folder-filter.json').exists():
        return False  # the folder step already carries the host part
    if not host.exists():
        print(f'[SKIP tanzimat host] {ext}: no out/extension.js', file=sys.stderr)
        return False
    original = host.read_bytes()
    try:
        apply_anchors(original.decode())
    except ValueError as error:
        print(f'[SKIP tanzimat host] {ext}: {error}', file=sys.stderr)
        return False
    if b'__crtlCodexTanzimat' in original:
        raise RuntimeError(f'{host}: host part present without a record')
    out = apply_anchors(original.decode()).encode()
    with tempfile.TemporaryDirectory() as t:
        c = Path(t) / 'ext.js'
        c.write_bytes(out)
        subprocess.run(['node', '--check', str(c)], check=True, capture_output=True)
    atomic_write(ext / 'out' / HOST_BACKUP, original)
    atomic_write(host, out)
    print(f'[TANZIMAT HOST] {ext}')
    return True
