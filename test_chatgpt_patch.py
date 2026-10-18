import importlib.util
from pathlib import Path
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
            m.patch(ext, 'console.log("ok");', 'body{}')
            self.assertEqual(html.read_bytes(), patched)
            html.write_bytes(patched + b'\nexternal change')
            with self.assertRaises(RuntimeError):
                m.patch(ext, 'console.log("ok");', 'body{}', True)
            html.write_bytes(patched)
            m.patch(ext, '', '', True)
            self.assertEqual(html.read_bytes(), original)

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
