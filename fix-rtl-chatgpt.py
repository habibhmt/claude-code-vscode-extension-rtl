#!/usr/bin/env python3
"""Reversible ChatGPT VS Code webview patch. No changes to host executable code."""
import argparse
import hashlib
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile

REPO = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('adapter', REPO / 'chatgpt-adapter.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)


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
    if not previous:
        if backup.exists() and backup.read_bytes() != original:
            raise RuntimeError('Untracked backup differs from current HTML')
        atomic_write(backup, original)
    atomic_write(root / js_name, ui.encode())
    atomic_write(root / css_name, css.encode())
    try:
        atomic_write(html, output)
        atomic_write(manifest, json.dumps({'html_sha256': digest(output), 'assets': [js_name, css_name]}).encode())
    except Exception:
        atomic_write(html, current)
        raise
    print(f'[PATCHED] {ext}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension-dir', type=Path, action='append', help='Explicit extension root (repeatable)')
    parser.add_argument('--revert', action='store_true')
    parser.add_argument('--with-font', action='store_true', help='Prefer locally installed Vazirmatn for conversation text')
    args = parser.parse_args()
    defaults_path = Path.home() / '.chatgpt-rtl-sizes.json'
    defaults = json.loads(defaults_path.read_text()) if defaults_path.exists() else {}
    ui = adapter.build_ui(REPO, defaults)
    css = (REPO / 'chatgpt-rtl.css').read_text()
    if args.with_font:
        css += '\n.thread-scroll-container :is([class*="MarkdownContent"],.rich-text-user-turn){font-family:Vazirmatn,Tahoma,sans-serif}\n'
    dirs = args.extension_dir or [p for ide in ['.vscode','.vscode-insiders','.cursor','.windsurf','.windsurf-next','.devin'] for p in (Path.home() / ide / 'extensions').glob('openai.chatgpt-*')]
    if not dirs:
        parser.exit(1, 'No installed openai.chatgpt extension found.\n')
    # Serialize manual and background runs without changing extension folders.
    lock = Path.home() / '.chatgpt-rtl-patch.lock'
    with lock.open('a') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        for ext in dirs:
            patch(ext.resolve(), ui, css, args.revert)


if __name__ == '__main__':
    main()
