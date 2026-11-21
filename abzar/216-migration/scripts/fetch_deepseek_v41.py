#!/usr/bin/env python3
"""Fetch the model's own tokenizer and encoding files, pinned and verified.

The 6.4 MB tokenizer.json belongs to the model's official HuggingFace repo, so it
is not committed: this script downloads the exact revision and checks each
sha256 against the hashes that the local counter was tested with. Any drift is a
hard failure, never a silent accept.

    python3 fetch_deepseek_v41.py          # fetch into ../claude-api/deepseek-v41
"""
import hashlib
import sys
import urllib.request
from pathlib import Path

REPO = 'deepseek-ai/DeepSeek-V4.1-Flash-1017'
REVISION = '08c8657f02291e11b6f6b63e0e16014f8e748518'
DEST = Path(__file__).resolve().parents[1] / 'claude-api' / 'deepseek-v41'
# The repo does not serve ordinary files under a pinned revision, so fetch from
# main and treat the sha256 table below as the pin: any upstream change fails loudly.
BASE = f'https://huggingface.co/{REPO}/raw/main/'
FILES = {
    'tokenizer.json': 'c90dfa01249db1be4245780a052ede752e1361c612ac6d08e2bdada7d599476b',
    'encoding.py': '13231c592e958fb39e2af6001dae69d90e7a36b265702b9b390236fb387599e2',
    'tests/test_input_1.json': '6a5a86694e47169c8f0c9243a7e24cc5db05447be0d3d3a9891034e913c518de',
    'tests/test_input_2.json': 'fd985cda88e8640b8e2404d8e659f7006cad204eb41f73c9e6662b1f218c01aa',
    'tests/test_input_3.json': '4207613f15c79b95ad92074bdb8b2b81c5ce9cfdf15b7a67f58ded6bb3ec4fa5',
    'tests/test_input_4.json': '4c3890a7bc042ec6396d98d024a39a73cdcffbe1d0253e852da0c35e65296f3e',
    'tests/test_input_5.json': '88289b0aac8d650aa55c4ffeb392818fff3a0ac83c2293ddfd90546804d5e5c4',
    'tests/test_output_1.txt': '91f79aa955717b414a82aabfb38bcd83ab5a998bd47db89d2a26338e8d3de550',
    'tests/test_output_2.txt': '9fa162587b73ab9b315be5c88d433f9e0e681b4b36926952f289099ed9bc1dab',
    'tests/test_output_3.txt': 'cf2b801d0738c88abb691bf4a096000c0e0737faab8a54a4ba5243c5513a3711',
    'tests/test_output_4.txt': '94433b68370dcc69fa61efc5011b5d0e28685e4716fee1ee77fbbfc0c9935b54',
    'tests/test_output_5.txt': '4d673091746553d1cb2e40a3fc01dc09a7c53c40627096a3e49c97a269a81f64',
}


def fetch(name, want):
    # tokenizer.json sits at the repo root; encoding.py and its tests are nested
    # under encoding/. Locally they are kept flat under one folder.
    remote = name if name == 'tokenizer.json' else 'encoding/' + name
    url = BASE + remote
    with urllib.request.urlopen(url, timeout=120) as response:
        data = response.read()
    got = hashlib.sha256(data).hexdigest()
    if got != want:
        raise SystemExit(f'{name}: sha256 {got} != pinned {want}')
    path = DEST / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f'ok {name} ({len(data)} bytes)')


if __name__ == '__main__':
    if '--check' in sys.argv:
        bad = [n for n, h in FILES.items()
               if not (DEST / n).exists()
               or hashlib.sha256((DEST / n).read_bytes()).hexdigest() != h]
        if bad:
            raise SystemExit('missing or drifted: ' + ', '.join(bad))
        print(f'{len(FILES)}/{len(FILES)} OK')
        raise SystemExit(0)
    for name, want in FILES.items():
        fetch(name, want)
