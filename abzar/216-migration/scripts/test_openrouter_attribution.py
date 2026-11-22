import tempfile
from pathlib import Path
import unittest
from openrouter_attribution import apply_project_attribution, project_number

class AttributionTests(unittest.TestCase):
    def test_project_nested_and_merge(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'136th-day-fix-rtl-claude'/'2026-logs';p.mkdir(parents=True)
            env={'ANTHROPIC_AUTH_TOKEN':'secret-synthetic','ANTHROPIC_CUSTOM_HEADERS':'Authorization: private-synthetic\nX-Session-ID: session-existing\nx-title: stale\nHTTP-Referer: https://stale.invalid'}
            out=apply_project_attribution(env,p,projects_root=d)
            self.assertEqual(project_number(p,projects_root=d),'136')
            self.assertIn('Claude Code - Project 136',out['ANTHROPIC_CUSTOM_HEADERS'])
            self.assertIn('http://project-136.claude-code.localhost',out['ANTHROPIC_CUSTOM_HEADERS'])
            self.assertIn('X-Session-ID: session-existing',out['ANTHROPIC_CUSTOM_HEADERS'])
            self.assertIn('Authorization: private-synthetic',out['ANTHROPIC_CUSTOM_HEADERS'])
            self.assertEqual(out['ANTHROPIC_AUTH_TOKEN'],env['ANTHROPIC_AUTH_TOKEN'])
            self.assertNotIn('stale',out['ANTHROPIC_CUSTOM_HEADERS'])
            self.assertEqual(apply_project_attribution(out,p,projects_root=d),out)
            self.assertIn('stale',env['ANTHROPIC_CUSTOM_HEADERS'])
    def test_numbered_outside_workspace_not_guessed(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)/'workspace';root.mkdir()
            p=Path(d)/'136th-day-foreign';p.mkdir()
            self.assertIsNone(project_number(p,projects_root=root))

    def test_unknown_not_guessed(self):
        with tempfile.TemporaryDirectory(prefix='unknown-') as d:
            env={'ANTHROPIC_CUSTOM_HEADERS':'X-Session-ID: keep'}
            self.assertEqual(apply_project_attribution(env,d,projects_root=d),env)
    def test_bad_header_rejected_without_secret_exception(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'216th-day-project';p.mkdir()
            with self.assertRaisesRegex(ValueError,'Invalid custom HTTP header'):
                apply_project_attribution({'ANTHROPIC_CUSTOM_HEADERS':'secret-synthetic'},p,projects_root=d)
    def test_zero_prefixed_folders_keep_their_own_name(self):
        # The old rule read the digits first, so both of these became "0" and
        # landed in one bucket; each folder is its own project now.
        with tempfile.TemporaryDirectory() as d:
            a=Path(d)/'0th-day-salamat';a.mkdir()
            b=Path(d)/'000-BRAIN';b.mkdir()
            c=Path(d)/'0th-day-secreter-director-from-all-sources';c.mkdir()
            self.assertEqual(project_number(a,projects_root=d),'0th-day-salamat')
            self.assertEqual(project_number(b,projects_root=d),'000-BRAIN')
            self.assertEqual(project_number(c,projects_root=d),'0th-day-secreter-director-from-all-sources')
            self.assertNotEqual(project_number(a,projects_root=d),project_number(b,projects_root=d))

    def test_numbered_folder_without_suffix_is_still_the_number(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'136';p.mkdir()
            self.assertEqual(project_number(p,projects_root=d),'136')

    def test_zero_folder_keeps_numbered_ones_untouched(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'136th-day-fix-rtl-claude';p.mkdir()
            out=apply_project_attribution({},p,projects_root=d)
            self.assertIn('Claude Code - Project 136',out['ANTHROPIC_CUSTOM_HEADERS'])

    def test_real_path_over_symlink_label(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'216th-day-project';p.mkdir()
            alias=Path(d)/'136th-day-fake';alias.symlink_to(p)
            self.assertEqual(project_number(alias,projects_root=d),'216')

if __name__=='__main__':unittest.main()
