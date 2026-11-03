#!/usr/bin/env python3
"""Reversible Codex RTL UI and current-folder chat-list patch."""
import argparse
import hashlib
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('adapter', REPO / 'chatgpt-adapter.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
folder_patch, folder_load_error = None, None
try:
    folder_spec = importlib.util.spec_from_file_location('folder_patch', REPO / 'chatgpt-folder-patch.py')
    folder_patch = importlib.util.module_from_spec(folder_spec)
    folder_spec.loader.exec_module(folder_patch)
except Exception as error:  # a broken filter must not cost the RTL patch
    folder_load_error = error


def atomic_write(path, data):
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.chatgpt-rtl-')
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
        os.chmod(name, path.stat().st_mode & 0o777 if path.exists() else 0o644)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def remove_recorded_assets(root, names, keep=()):
    """Delete only files our manifest names, and only with our own name shape."""
    for name in names:
        if name not in keep and Path(name).name == name and name.startswith('chatgpt-rtl-'):
            (root / name).unlink(missing_ok=True)


def patch(ext, ui, css, revert=False):
    root = ext / 'webview'
    html = root / 'index.html'
    backup = root / 'index.html.chatgpt-rtl-backup'
    manifest = root / '.chatgpt-rtl.json'
    previous = json.loads(manifest.read_text()) if manifest.exists() else None
    current = html.read_bytes()
    digest = lambda data: hashlib.sha256(data).hexdigest()
    if previous and digest(current) != previous['html_sha256']:
        raise RuntimeError(f'{html} changed externally; refusing to overwrite it')
    if revert:
        if previous:
            atomic_write(html, backup.read_bytes())
            manifest.unlink()
            backup.unlink()
            remove_recorded_assets(root, previous.get('assets', []))
            print(f'[RESTORED] {ext}')
        return
    original = backup.read_bytes() if previous else current
    if b'<!-- CHATGPT-RTL -->' in original:
        raise RuntimeError('Patch marker without manifest; inspect backup before proceeding')
    if original.count(b'</head>') != 1:
        raise RuntimeError('Unsupported HTML layout')
    stamp = digest(ui.encode() + css.encode())[:16]
    js_name, css_name = f'chatgpt-rtl-{stamp}.js', f'chatgpt-rtl-{stamp}.css'
    block = f'<!-- CHATGPT-RTL --><link rel="stylesheet" href="./{css_name}"><script defer src="./{js_name}"></script>\n'
    output = original.replace(b'</head>', block.encode() + b'</head>')
    if current == output and (root / js_name).exists() and (root / css_name).exists():
        return
    # Validate payload before touching the extension. CSP permits local external files.
    with tempfile.TemporaryDirectory() as temp:
        candidate = Path(temp) / 'ui.js'
        candidate.write_text(ui)
        subprocess.run(['node', '--check', str(candidate)], check=True, capture_output=True)
    if not previous and backup.exists() and backup.read_bytes() != original:
        raise RuntimeError('Untracked backup differs from current HTML')
    # A half install leaves nothing new: no later run could name these files, as no manifest records them.
    created = [p for p in (backup, root / js_name, root / css_name) if not p.exists()]
    try:
        if not previous:
            atomic_write(backup, original)
        atomic_write(root / js_name, ui.encode())
        atomic_write(root / css_name, css.encode())
        atomic_write(html, output)
        atomic_write(manifest, json.dumps({'html_sha256': digest(output), 'assets': [js_name, css_name]}).encode())
    except Exception:
        atomic_write(html, current)
        for path in created:
            path.unlink(missing_ok=True)
        raise
    if previous:
        remove_recorded_assets(root, previous.get('assets', []), keep=(js_name, css_name))
    print(f'[PATCHED] {ext}')


def patch_manifest(ext, revert=False):
    """The editor-title icon opens Codex as its own editor tab (like Claude), not the sidebar.
    Habib, 31 Oct: he opens a file, clicks the icon in its top corner, and wants the chat there."""
    pkg = ext / 'package.json'
    backup = ext / 'package.json.chatgpt-rtl-backup'
    if revert:
        if backup.exists():
            atomic_write(pkg, backup.read_bytes()); backup.unlink()
        return
    if not backup.exists():
        atomic_write(backup, pkg.read_bytes())
    data = json.loads(backup.read_text())
    c = data.get('contributes', {})
    cmds = {x['command']: x for x in c.get('commands', [])}
    if 'chatgpt.newCodexPanel' not in cmds or 'chatgpt.openSidebar' not in cmds:
        print(f'[SKIP manifest] {ext}: commands changed', file=sys.stderr); return
    cmds['chatgpt.newCodexPanel']['icon'] = cmds['chatgpt.openSidebar'].get('icon')
    for item in c.get('menus', {}).get('editor/title', []):
        if item.get('command') == 'chatgpt.openSidebar':
            item['command'] = 'chatgpt.newCodexPanel'
    out = (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode()
    if pkg.read_bytes() != out:
        atomic_write(pkg, out); print(f'[MANIFEST] {ext}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension-dir', type=Path, action='append', help='Explicit extension root (repeatable)')
    parser.add_argument('--revert', action='store_true')
    parser.add_argument('--with-font', action='store_true', help='No effect: chatgpt-rtl.css always sets Vazirmatn. Still accepted because installed launch agents pass it')
    args = parser.parse_args()
    defaults_path = Path.home() / '.chatgpt-rtl-sizes.json'
    defaults = json.loads(defaults_path.read_text()) if defaults_path.exists() else {}
    ui = adapter.build_ui(REPO, defaults)
    css = (REPO / 'chatgpt-rtl.css').read_text()
    dirs = args.extension_dir or [p for ide in ['.vscode','.vscode-insiders','.cursor','.windsurf','.windsurf-next','.devin'] for p in (Path.home() / ide / 'extensions').glob('openai.chatgpt-*')]
    if not dirs:
        parser.exit(1, 'No installed openai.chatgpt extension found.\n')
    # Serialize manual and background runs without changing extension folders.
    lock = Path.home() / '.chatgpt-rtl-patch.lock'
    with lock.open('a') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        # One failing step must not cost the other steps or the other extensions.
        def folder_step(ext):
            if folder_load_error:
                raise RuntimeError(f'chatgpt-folder-patch.py: {folder_load_error}')
            folder_patch.patch_folder_filter(ext, (REPO / 'chatgpt-folder-filter.js').read_text(), atomic_write, args.revert)
        steps = [('folder filter', folder_step),
                 ('rtl', lambda ext: patch(ext, ui, css, args.revert)),
                 ('manifest', lambda ext: patch_manifest(ext, args.revert))]
        failed = 0
        for ext in dirs:
            for name, step in steps:
                try:
                    step(ext.resolve())
                except Exception as error:
                    failed += 1
                    print(f'[FAILED {name}] {ext}: {error} {getattr(error, "stderr", "") or ""}', file=sys.stderr)
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main()
