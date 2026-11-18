"""The shared OpenRouter catalogue: shape, tiers, stealth rows, and determinism."""
import json
import unittest
from pathlib import Path

import refresh_openrouter_catalog as catalog

DOCUMENT = Path(__file__).resolve().parents[1] / 'claude-api/openrouter-catalog.json'

MESSAGES = {'data': [
    {'id': 'deepseek/deepseek-v4.1-flash-1017', 'name': 'DeepSeek: DeepSeek V4.1 Flash 1017',
     'context_length': 163840, 'pricing': {'prompt': '0.000000036', 'completion': '0.0000005'},
     'architecture': {'modality': 'text->text'}, 'supported_parameters': ['tools', 'temperature'],
     'reasoning': {'supported_efforts': ['none', 'low', 'high']}, 'created': 1794000000},
    {'id': 'baidu/ernie-5.5-flash-preview:free', 'name': 'Baidu: Ernie 5.5 Flash',
     'pricing': {'prompt': '0', 'completion': '0'}, 'supported_parameters': []},
    {'id': 'openrouter/auto', 'name': 'Auto Router',
     'pricing': {'prompt': '-1', 'completion': '-1'}, 'supported_parameters': ['tools']},
]}
ALL = {'data': [{'id': m['id']} for m in MESSAGES['data']] + [{'id': 'openai/gpt-legacy'}]}
STEALTH = b'<a href="/stealth/ox-alpha">ox</a> <a href="/stealth/union-alpha.">u</a>'


class CatalogueTests(unittest.TestCase):
    def build(self):
        return catalog.build(MESSAGES, ALL, STEALTH, '2026-11-18T00:00:00+00:00')

    def test_rows_keep_their_price(self):
        row = next(m for m in self.build()['models'] if m['id'] == 'deepseek/deepseek-v4.1-flash-1017')
        # Per-token prices sit near 1e-7; rounding those to six places reported
        # every cheap model as free, which is exactly what a tier filter must not do.
        self.assertEqual((row['prompt'], row['completion']), (0.036, 0.5))
        self.assertEqual(row['tier'], 'paid')
        self.assertFalse(row['free'])
        self.assertEqual(row['reasoning'], ['high', 'low'])
        self.assertTrue(row['tools'])
        self.assertEqual(row['name'], 'DeepSeek V4.1 Flash 1017')

    def test_free_and_variable_are_not_the_same_thing(self):
        rows = {m['id']: m for m in self.build()['models']}
        self.assertEqual(rows['baidu/ernie-5.5-flash-preview:free']['tier'], 'free')
        self.assertTrue(rows['baidu/ernie-5.5-flash-preview:free']['free'])
        self.assertEqual(rows['openrouter/auto']['tier'], 'variable')
        self.assertIsNone(rows['openrouter/auto']['prompt'])

    def test_stealth_models_are_rows_with_an_unknown_price(self):
        document = self.build()
        stealth = [m for m in document['models'] if m['stealth']]
        self.assertEqual([m['id'] for m in stealth], ['stealth/ox-alpha', 'stealth/union-alpha'])
        for row in stealth:
            self.assertEqual(row['tier'], 'stealth')
            self.assertIsNone(row['free'], 'a stealth model has no published price; claiming free is a guess')
        self.assertEqual(document['counts']['stealth'], 2)
        self.assertEqual(document['counts']['messages'], 3)
        self.assertEqual(document['counts']['total'], 5)

    def test_not_served_models_are_named_not_dropped(self):
        document = self.build()
        self.assertEqual(document['not_served'], ['openai/gpt-legacy'])
        self.assertEqual(document['counts']['all'], 4)

    def test_two_runs_produce_the_same_document(self):
        self.assertEqual(json.dumps(self.build(), sort_keys=False),
                         json.dumps(self.build(), sort_keys=False),
                         'an unstable order would move an open chat to another model')

    def test_a_broken_row_is_refused(self):
        for bad in ({'id': 'no-slash'}, {'id': 'x/y@preset/z'}, {'name': 'no id'}):
            with self.assertRaises(ValueError):
                catalog.normalize(bad)
        with self.assertRaises(ValueError):
            catalog.build({'data': []}, ALL, STEALTH, 'now')

    def test_the_file_on_disk_matches_the_shape(self):
        document = json.loads(DOCUMENT.read_text())
        self.assertGreater(document['counts']['messages'], 300)
        self.assertEqual(len(document['models']), document['counts']['total'])
        self.assertEqual(len({m['id'] for m in document['models']}), document['counts']['total'])
        for row in document['models']:
            self.assertIn(row['tier'], ('free', 'paid', 'variable', 'stealth'))
            self.assertEqual(row['stealth'], row['tier'] == 'stealth')
            self.assertIsInstance(row['id'], str)
        # Providers stay in contiguous blocks, and ids are ordered inside each.
        self.assertEqual(document['models'],
                         sorted(document['models'], key=lambda m: (m['provider'], m['id'])),
                         'the catalogue must be written in a stable, provider-major order')

    def test_stealth_alarm_feeds_the_catalogue(self):
        alarm = (Path(__file__).resolve().parents[3] / 'abzar/stealth_alarm.sh').read_text()
        self.assertIn('refresh_openrouter_catalog.py', alarm,
                      'a new stealth model would be announced but never reach the model list')


if __name__ == '__main__':
    unittest.main()
