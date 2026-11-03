import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('patcher', Path(__file__).with_name('fix-rtl-chatgpt.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class PatchTests(unittest.TestCase):
    def test_repeat_revert_and_external_change(self):
        with tempfile.TemporaryDirectory() as d:
            ext = Path(d)
            root = ext / 'webview'
            root.mkdir()
            html = root / 'index.html'
            original = b'<html><head></head><body></body></html>'
            html.write_bytes(original)
            m.patch(ext, 'console.log("ok");', 'body{}')
            patched = html.read_bytes()
            # The patch really happened: one marker, and the files it links hold our exact payload.
            self.assertEqual(patched.count(b'<!-- CHATGPT-RTL -->'), 1)
            meta = json.loads((root / '.chatgpt-rtl.json').read_text())
            js_name, css_name = meta['assets']
            self.assertIn(f'src="./{js_name}"'.encode(), patched)
            self.assertIn(f'href="./{css_name}"'.encode(), patched)
            self.assertEqual((root / js_name).read_text(), 'console.log("ok");')
            self.assertEqual((root / css_name).read_text(), 'body{}')
            self.assertLess(patched.index(b'CHATGPT-RTL'), patched.index(b'</head>'))
            m.patch(ext, 'console.log("ok");', 'body{}')
            self.assertEqual(html.read_bytes(), patched)
            self.assertEqual(patched.count(b'<!-- CHATGPT-RTL -->'), 1)
            html.write_bytes(patched + b'\nexternal change')
            with self.assertRaises(RuntimeError):
                m.patch(ext, 'console.log("ok");', 'body{}', True)
            html.write_bytes(patched)
            m.patch(ext, '', '', True)
            self.assertEqual(html.read_bytes(), original)

    def test_repatch_and_revert_leave_no_extra_files(self):
        with tempfile.TemporaryDirectory() as d:
            ext = Path(d)
            root = ext / 'webview'
            root.mkdir()
            (root / 'index.html').write_bytes(b'<html><head></head></html>')
            (root / 'chatgpt-rtl-not-recorded.js').write_text('not ours by record')
            tree = lambda: {p.name: p.read_bytes() for p in root.iterdir()}
            before = tree()
            m.patch(ext, 'var a;', 'a{}')
            first = set(json.loads((root / '.chatgpt-rtl.json').read_text())['assets'])
            m.patch(ext, 'var b;', 'b{}')
            second = set(json.loads((root / '.chatgpt-rtl.json').read_text())['assets'])
            self.assertFalse(first & second)
            self.assertFalse(first & set(tree()), 'Previous payload files must go')
            self.assertTrue(second <= set(tree()), 'Current payload files must stay')
            m.patch(ext, '', '', True)
            self.assertEqual(tree(), before)

    def test_failed_install_leaves_folder_identical(self):
        real = m.atomic_write
        def fail_on_manifest(path, data):
            if path.name == '.chatgpt-rtl.json':
                raise OSError('disk full')
            real(path, data)
        tree = lambda root: {p.name: p.read_bytes() for p in root.iterdir()}
        with tempfile.TemporaryDirectory() as d:
            ext = Path(d)
            root = ext / 'webview'
            root.mkdir()
            (root / 'index.html').write_bytes(b'<html><head></head></html>')
            before = tree(root)
            m.atomic_write = fail_on_manifest
            try:
                with self.assertRaises(OSError):
                    m.patch(ext, 'var a;', 'a{}')
                self.assertEqual(tree(root), before)
                # Same on a re-patch: the working install and its recorded files survive.
                m.atomic_write = real
                m.patch(ext, 'var a;', 'a{}')
                installed = tree(root)
                m.atomic_write = fail_on_manifest
                with self.assertRaises(OSError):
                    m.patch(ext, 'var b;', 'b{}')
                self.assertEqual(tree(root), installed)
            finally:
                m.atomic_write = real

    def test_with_font_flag_changes_nothing_and_vazirmatn_stays(self):
        repo = Path(__file__).parent
        self.assertNotIn('--with-font', (repo / 'install-chatgpt-autofix.py').read_text())
        css = (repo / 'chatgpt-rtl.css').read_text()
        self.assertIn('font-family:Vazirmatn,Tahoma,sans-serif!important', css)
        with tempfile.TemporaryDirectory() as d:
            results = []
            (Path(d) / 'home').mkdir()
            for name, extra in [('plain', []), ('flag', ['--with-font'])]:
                ext = Path(d) / name
                (ext / 'webview/assets').mkdir(parents=True)
                (ext / 'webview/index.html').write_text('<html><head></head></html>')
                (ext / 'package.json').write_text('{}')
                r = subprocess.run([sys.executable, str(repo / 'fix-rtl-chatgpt.py'), '--extension-dir', str(ext), *extra],
                                   capture_output=True, text=True, env={**os.environ, 'HOME': str(Path(d) / 'home')})
                self.assertEqual(r.returncode, 0, r.stderr)
                meta = json.loads((ext / 'webview/.chatgpt-rtl.json').read_text())
                results.append(((ext / 'webview/index.html').read_bytes(),
                                {n: (ext / 'webview' / n).read_bytes() for n in meta['assets']}))
            self.assertEqual(results[0], results[1])
            self.assertIn(css.encode(), results[0][1].values())

    def test_bad_javascript_does_not_modify_html(self):
        with tempfile.TemporaryDirectory() as d:
            ext = Path(d)
            (ext / 'webview').mkdir()
            html = ext / 'webview/index.html'
            html.write_text('<head></head>')
            with self.assertRaises(Exception):
                m.patch(ext, 'function {', '')
            self.assertEqual(html.read_text(), '<head></head>')


if __name__ == '__main__':
    unittest.main()
