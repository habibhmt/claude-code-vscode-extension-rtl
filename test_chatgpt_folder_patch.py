import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import io
import os
import shutil
import subprocess
import json
import contextlib
from unittest.mock import patch

REPO = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('patcher', REPO / 'fix-rtl-chatgpt.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
f = m.folder_patch
PAYLOAD = (REPO / 'chatgpt-folder-filter.js').read_text()


def fixture(root):
    root.mkdir(parents=True)
    (root / '../../out').mkdir()
    sources = {
        'app-server-manager-hooks-fixture.js': 'function Y(){return {data:[]}}function _e(){}function $(){}export{_e as n,Y as r,$ as t};',
        'header-fixture.js': 'function _n(e,t,n){return []}function home(n,r){let u;u=(0,Lt.default)([...r,...n],Nt).slice(0,Math.max(3,r.length));return u}/*pendingWorktrees:r,pendingThreadStarts:i open-recent-tasks-menu*/',
        'header-unrelated.js': 'function unrelatedHeader(){}',
        'thread-context-inputs-fixture.js': '/* queryFn:({signal:t})=>E(e,t),m?.workspaceRoots */export{D,E as O,$ as s,U as u};',
        'message-bus-fixture.js': '/*acquireVsCodeApi*/export{c,l as s};',
        'app-scope-fixture.js': 'export{Wa as c};', 'app-initial-fixture.js': 'export{a as rS};',
        'src-fixture.js': 'class Store{async listRecentThreads({originators:e,cursor:t,limit:n,background:r=!1}){let i={limit:n,cursor:t};return i}}',
        '../../out/extension.js': 'function fv(){let t=iWe.workspace.workspaceFolders?.map(x=>x.uri.fsPath);return t??[]}class Provider{list(){return this.codexAppServer.sendRequest(YGe,r,"thread/list",{limit:50,cursor:null})}}',
    }
    for name, text in sources.items():
        (root / name).write_text(text)
    return sources


class FolderPatchTests(unittest.TestCase):
    def test_upgrade_backs_up_added_native_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            ext = Path(tmp)
            root = ext / 'webview/assets'
            sources = fixture(root)
            real_prepare = f.prepare
            def old_prepare(*args):
                outputs, helper_name, helper = real_prepare(*args)
                del outputs['src-fixture.js']
                return outputs, helper_name, helper
            with patch.object(f, 'prepare', old_prepare):
                f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            self.assertFalse((root / 'src-fixture.js.chatgpt-folder-backup').exists())
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            self.assertEqual((root / 'src-fixture.js.chatgpt-folder-backup').read_text(),
                             sources['src-fixture.js'])
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write, revert=True)
            self.assertEqual(sources, {name: (root / name).read_text() for name in sources})

    def test_installed_asset_copy_and_native_provider(self):
        candidates = sorted((Path.home() / '.vscode/extensions').glob('openai.chatgpt-*/out/extension.js'))
        if not candidates:
            self.skipTest('Installed VS Code extension unavailable')
        live = candidates[-1].parent.parent
        with tempfile.TemporaryDirectory(prefix='crtl-installed-copy-') as tmp:
            ext = Path(tmp)
            root = ext / 'webview/assets'
            root.mkdir(parents=True)
            (ext / 'out').mkdir()
            shutil.copy2(live / 'out/extension.js', ext / 'out/extension.js')
            for pattern in ['app-server-manager-hooks-*.js', 'header-*.js', 'thread-context-inputs-*.js',
                            'app-scope-*.js', 'app-initial-*.js', 'src-*.js', 'message-bus-*.js']:
                for path in (live / 'webview/assets').glob(pattern):
                    shutil.copy2(path, root / path.name)
            # An already-installed patch must first be restored in this copy.
            manifest = live / 'webview/.chatgpt-folder-filter.json'
            if manifest.exists():
                for name, record in json.loads(manifest.read_text())['files'].items():
                    shutil.copy2(live / 'webview/assets' / record['backup'], root / name)
            originals = {p: p.read_bytes() for p in ext.rglob('*.js')}
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            self.assertTrue((ext / 'webview/.chatgpt-folder-filter.json').exists(), 'Patch was skipped')
            meta = json.loads((ext / 'webview/.chatgpt-folder-filter.json').read_text())
            self.assertEqual(len(meta['files']), 4)
            subprocess.run(['node', str(REPO / 'test_chatgpt_folder_native.cjs'),
                            str(ext / 'out/extension.js')], check=True)
            subprocess.run(['node', str(REPO / 'test_chatgpt_folder_recent.cjs'),
                            str(root)], check=True)
            header = next(p for p in root.glob('header-*.js') if 'function At(' in p.read_text())
            subprocess.run(['node', str(REPO / 'test_chatgpt_home_order.cjs'), str(header)], check=True)
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write, revert=True)
            self.assertTrue(all(path.read_bytes() == data for path, data in originals.items()))

    def test_repeat_restore_and_external_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            ext = Path(tmp)
            root = ext / 'webview/assets'
            sources = fixture(root)
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            self.assertTrue((ext / 'webview/.chatgpt-folder-filter.json').exists())
            patched = {name: (root / name).read_bytes() for name in sources}
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            self.assertEqual(patched, {name: (root / name).read_bytes() for name in sources})
            target = root / 'header-fixture.js'
            target.write_bytes(target.read_bytes() + b'/*external*/')
            with self.assertRaises(RuntimeError):
                f.patch_folder_filter(ext, PAYLOAD, m.atomic_write, revert=True)
            target.write_bytes(patched[target.name])
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write, revert=True)
            self.assertEqual(sources, {name: (root / name).read_text() for name in sources})

    def test_repatch_removes_own_helper_and_revert_is_identical(self):
        with tempfile.TemporaryDirectory() as tmp:
            ext = Path(tmp)
            root = ext / 'webview/assets'
            fixture(root)
            stranger = root / 'chatgpt-folder-filter-notrecorded.js'
            stranger.write_text('no manifest names this file')
            tree = lambda: {str(p.relative_to(ext)): p.read_bytes() for p in ext.rglob('*') if p.is_file()}
            before = tree()
            helper = lambda: json.loads((ext / 'webview/.chatgpt-folder-filter.json').read_text())['helper']
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            first = helper()
            f.patch_folder_filter(ext, PAYLOAD + '\n// next version', m.atomic_write)
            second = helper()
            self.assertNotEqual(first, second)
            self.assertFalse((root / first).exists(), 'Previous helper must go')
            self.assertTrue((root / second).exists())
            self.assertTrue(stranger.exists(), 'A file the manifest does not name stays')
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write, revert=True)
            self.assertEqual(tree(), before)

    def test_changed_helper_is_kept(self):
        with tempfile.TemporaryDirectory() as tmp:
            ext = Path(tmp)
            root = ext / 'webview/assets'
            fixture(root)
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            name = json.loads((ext / 'webview/.chatgpt-folder-filter.json').read_text())['helper']
            (root / name).write_text('edited by someone else')
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                f.patch_folder_filter(ext, PAYLOAD, m.atomic_write, revert=True)
            self.assertEqual((root / name).read_text(), 'edited by someone else')
            self.assertIn('[KEPT folder helper]', err.getvalue())

    def test_contract_change_does_not_partially_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            ext = Path(tmp)
            root = ext / 'webview/assets'
            fixture(root)
            target = root / 'header-fixture.js'
            target.write_text('function changed(){}')
            before = {p.name: p.read_bytes() for p in root.iterdir()}
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            self.assertEqual(before, {p.name: p.read_bytes() for p in root.iterdir()})

    def test_renamed_import_is_refused_and_reported(self):
        # 'E as O' -> 'E as Q' still parses, yet the helper's import would blank the page.
        for name, old, new in [('thread-context-inputs-fixture.js', 'E as O', 'E as Q'),
                               ('thread-context-inputs-fixture.js', 'U as u', 'V as u'),
                               ('message-bus-fixture.js', 'l as s', 'l as z'),
                               ('app-scope-fixture.js', 'Wa as c', 'Wa as d'),
                               ('app-initial-fixture.js', 'a as rS', 'a as rT'),
                               ('thread-context-inputs-fixture.js', 'export{D,', 'export{Z,'),
                               ('thread-context-inputs-fixture.js', '$ as s', '$ as z'),
                               ('message-bus-fixture.js', 'export{c,', 'export{b,')]:
            with tempfile.TemporaryDirectory() as tmp:
                ext = Path(tmp)
                root = ext / 'webview/assets'
                fixture(root)
                target = root / name
                target.write_text(target.read_text().replace(old, new))
                before = {p.name: p.read_bytes() for p in root.iterdir()}
                err = io.StringIO()
                with contextlib.redirect_stderr(err):
                    f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
                self.assertEqual(before, {p.name: p.read_bytes() for p in root.iterdir()}, old)
                self.assertFalse((ext / 'webview/.chatgpt-folder-filter.json').exists(), old)
                self.assertIn('[SKIP folder filter]', err.getvalue(), old)

    def test_wrappers_really_call_the_filter(self):
        with tempfile.TemporaryDirectory() as tmp:
            ext = Path(tmp)
            root = ext / 'webview/assets'
            fixture(root)
            f.patch_folder_filter(ext, PAYLOAD, m.atomic_write)
            hook = (root / 'app-server-manager-hooks-fixture.js').read_text()
            wrapper = hook[hook.index('function Y(){return'):]
            head = hook[:hook.index('export{')]
            js = head + wrapper + ';const crtlUseFolderResult=x=>({filtered:x});console.log(JSON.stringify(Y()))'
            out = subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout
            self.assertEqual(json.loads(out), {'filtered': {'data': []}})
            header = (root / 'header-fixture.js').read_text()
            js = '\n'.join(l for l in header.split('\n') if not l.startswith('import ')) + \
                ';const crtlUseFolderRows=(r,o)=>({rows:r,own:o});console.log(JSON.stringify(_n()))'
            out = subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout
            self.assertEqual(json.loads(out), {'rows': [], 'own': True})

    def test_failing_filter_keeps_rtl_and_other_extensions(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp) / 'home'
            home.mkdir()
            exts = [Path(tmp) / 'one', Path(tmp) / 'two']
            for ext in exts:
                (ext / 'webview/assets').mkdir(parents=True)
                (ext / 'webview/index.html').write_text('<html><head></head><body></body></html>')
                (ext / 'package.json').write_text('{}')
                # the corrupt manifest makes the folder-filter step raise
                (ext / 'webview/.chatgpt-folder-filter.json').write_text('{')
            cmd = [sys.executable, str(REPO / 'fix-rtl-chatgpt.py')]
            for ext in exts:
                cmd += ['--extension-dir', str(ext)]
            r = subprocess.run(cmd, capture_output=True, text=True, env={**os.environ, 'HOME': str(home)})
            self.assertEqual(r.returncode, 1, r.stderr)
            self.assertEqual(r.stderr.count('[FAILED folder filter]'), 2, r.stderr)
            for ext in exts:
                self.assertIn('CHATGPT-RTL', (ext / 'webview/index.html').read_text())

    def test_interrupted_install_rolls_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            ext = Path(tmp)
            root = ext / 'webview/assets'
            fixture(root)
            before = {p.name: p.read_bytes() for p in root.iterdir() if p.is_file() and 'backup' not in p.name}
            writes = []
            def stopping_write(path, data):
                writes.append(path)
                if len(writes) == 5:
                    raise KeyboardInterrupt
                m.atomic_write(path, data)
            with self.assertRaises(KeyboardInterrupt):
                f.patch_folder_filter(ext, PAYLOAD, stopping_write)
            self.assertEqual(before, {n: (root / n).read_bytes() for n in before})
            self.assertEqual(set(before), {p.name for p in root.iterdir() if p.is_file()}, 'Rollback leaves no new file')

    def test_broken_filter_file_keeps_rtl(self):
        with tempfile.TemporaryDirectory() as tmp:
            home, ext, repo = Path(tmp) / 'home', Path(tmp) / 'ext', Path(tmp) / 'repo'
            home.mkdir()
            (ext / 'webview/assets').mkdir(parents=True)
            (ext / 'webview/index.html').write_text('<html><head></head><body></body></html>')
            (ext / 'package.json').write_text('{}')
            repo.mkdir()
            for p in REPO.glob('*'):
                if p.is_file() and p.suffix in ('.py', '.js', '.css', '.json'):
                    shutil.copy2(p, repo / p.name)
            (repo / 'chatgpt-folder-patch.py').write_text('def broken(:\n')
            r = subprocess.run([sys.executable, str(repo / 'fix-rtl-chatgpt.py'), '--extension-dir', str(ext)],
                               capture_output=True, text=True, env={**os.environ, 'HOME': str(home)})
            self.assertEqual(r.returncode, 1, r.stderr)
            self.assertIn('[FAILED folder filter]', r.stderr)
            self.assertIn('CHATGPT-RTL', (ext / 'webview/index.html').read_text())

    def test_invalid_js_leaves_files_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            ext = Path(tmp)
            root = ext / 'webview/assets'
            fixture(root)
            before = {p.name: p.read_bytes() for p in root.iterdir()}
            with self.assertRaises(Exception):
                f.patch_folder_filter(ext, 'function {', m.atomic_write)
            self.assertEqual(before, {p.name: p.read_bytes() for p in root.iterdir()})


if __name__ == '__main__':
    unittest.main()
