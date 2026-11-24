#!/usr/bin/env python3
"""Reversible, version-anchored DeepSeek selector overlay; never reloads VS Code."""
import json
from pathlib import Path
import re
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]

def _newest_target():
    """Newest installed Claude extension, so no version is pinned here."""
    found = sorted(
        (p for p in (Path.home()/'.vscode/extensions').glob('anthropic.claude-code-*/extension.js') if p.is_file()),
        key=lambda p: [int(n) for n in re.findall(r'\d+', p.parent.name)] or [0],
    )
    return found[-1] if found else Path.home()/'.vscode/extensions/anthropic.claude-code-missing/extension.js'

TARGET=_newest_target()
CATALOG=ROOT/'claude-api/deepseek-models.json'
BACKUP=ROOT/'.runtime/controls-nov14/extension.before-model-selector.js'
MARK='/* project216-deepseek-models */'
READER = 'require(' + json.dumps(str(ROOT / 'scripts/vscode_model_catalog.cjs')) + ').modelChoices()'


# The config schema is a zod object, and zod drops every key it does not know.
# `group`, `family` and `familyLabel` would vanish on the cached path, so the
# picker would draw its provider headers only on a fresh window. One anchored
# addition, proved by the fields being present exactly once afterwards.
MODEL_SCHEMA = re.compile(r'(\{value:(\w+)\(\),resolvedModel:\w+\(\)\.optional\(\),displayName:\2\(\)'
                          r'[^}]*?disabled:\w+\(\)\.optional\(\))')


def install_model_fields(text):
    if re.search(r'\{value:(\w+)\(\),resolvedModel:\w+\(\)\.optional\(\),displayName:\1\(\)'
                 r'[^}]*?group:\1\(\)\.optional\(\)', text):
        return text
    found = MODEL_SCHEMA.findall(text)
    if len(found) != 1:
        raise ValueError(f'model schema anchor changed (matched {len(found)})')
    match = MODEL_SCHEMA.search(text)
    string = match.group(2)
    # The capture stops before the object's closing brace, so the new fields go
    # right after `disabled:` and the brace the caller still holds stays put.
    extra = (',group:' + string + '().optional(),family:' + string + '().optional(),familyLabel:'
             + string + '().optional()')
    patched = text[:match.start(1)] + match.group(1) + extra + text[match.end(1):]
    if patched.count(extra) != 1:
        raise ValueError('model schema overlay damaged')
    return patched


def patch_text(text):
    import re
    text = install_model_fields(text)
    # Upgrade already-running patch versions from 2.1.323–326. The legacy
    # catalog stays readable by windows that have not reloaded yet.
    #
    # The path is matched as a wildcard on purpose: 2.1.326 still carries the
    # absolute path of the folder this migration deleted, so an exact-path
    # match skipped it and left that version reading a file that no longer
    # exists. Only the wrapper is replaced, never the bare read — the wrapper's
    # own "deepseek/ only" check would reject the Claude rows.
    expr = re.compile(r'JSON\.parse\(require\("fs"\)\.readFileSync\("[^"]*deepseek-models\.json","utf8"\)\)')
    if MARK in text:
        for check in (
            'x.value.startsWith("deepseek/")',
            '(x.value.startsWith("deepseek/")||x.value.startsWith("claude-"))',
        ):
            for message in ('invalid DeepSeek-only catalog', 'invalid model catalog'):
                legacy = re.compile(
                    r'\(\(\)=>\{const (\w+)=' + expr.pattern + r';if\(!Array\.isArray\(\1\)\|\|!\1\.length'
                    r'\|\|!\1\.every\(x=>x&&typeof x\.value==="string"&&' + re.escape(check)
                    + r'&&!x\.value\.includes\(":"\)\)\)throw Error\("' + re.escape(message)
                    + r'"\);return \1\}\)\(\)')
                text = legacy.sub(lambda m: READER, text)
        text = expr.sub(lambda m: READER, text)

    def install(pattern, replacement, proof):
        nonlocal text
        if re.search(proof, text):
            if len(re.findall(proof, text)) != 1:
                raise ValueError('ambiguous installed selector: ' + pattern)
            return
        if len(list(re.finditer(pattern, text))) != 1:
            raise ValueError('selector anchor changed: ' + pattern)
        text = re.sub(pattern, replacement, text, count=1)

    read = re.escape(READER)
    ident = r'[\w$]+'
    install(r'async supportedModels\(\)\{return\(await this\.initialization\)\.models\}',
            lambda m: 'async supportedModels(){await this.initialization;return ' + READER + '}',
            r'async supportedModels\(\)\{await this\.initialization;return ' + read + r'\}')
    install(r'\{models:(' + ident + r')\.models,unavailable_models:\1\.unavailable_models',
            lambda m: '{models:' + READER + ',unavailable_models:[]',
            r'\{models:' + read + r',unavailable_models:\[\]')
    init = r'let (' + ident + r')=\(await ' + ident + r'\)\.response;'
    install(init, lambda m: m[0] + m[1] + '={...' + m[1] + ',models:' + READER + ',unavailable_models:[]};',
            init + r'\1=\{\.\.\.\1,models:' + read)
    cache = r'return\{\.\.\.(' + ident + r')\.data,agents:\[\],account:\{\}'
    install(cache + r'\}', lambda m: m[0][:-1] + ',models:' + READER + ',unavailable_models:[]}',
            cache + r',models:' + read)
    seed = r'this\.config=Promise\.resolve\((' + ident + r')\.config\),this\.settledConfig=\1\.config'
    install(seed, lambda m: m[1] + '.config={...' + m[1] + '.config,models:' + READER + ',unavailable_models:[]};' + m[0],
            r'(' + ident + r')\.config=\{\.\.\.\1\.config,models:' + read)
    if text.count(READER) != 5:
        raise ValueError('selector overlay damaged')
    return text if MARK in text else MARK + '\n' + text


def main():
    import hashlib
    import os
    import shutil
    import stat
    import tempfile
    target = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else TARGET
    if target.name != 'extension.js' or 'anthropic.claude-code-' not in target.parent.name:
        raise ValueError('not a Claude extension target')
    before = target.read_bytes()
    result = patch_text(before.decode()).encode()
    if result == before:
        print('already patched:', target.parent.name)
        return
    node = shutil.which('node') or next((n for n in ('/opt/homebrew/bin/node', '/usr/local/bin/node') if Path(n).exists()), None)
    if not node:
        raise FileNotFoundError('node not found')
    # Require the live catalog too: a parseable bundle alone cannot prove the picker opens.
    subprocess.run([node, '-e', READER], check=True)
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    backup = BACKUP.parent / (target.parent.name + '-' + hashlib.sha256(before).hexdigest()[:12] + '.js')
    try:
        with backup.open('xb') as saved:
            saved.write(before)
    except FileExistsError:
        pass
    with tempfile.NamedTemporaryFile(dir=target.parent, suffix='.js', delete=False) as tmp:
        tmp.write(result)
    try:
        subprocess.run([node, '--check', tmp.name], check=True, capture_output=True)
        os.chmod(tmp.name, stat.S_IMODE(target.stat().st_mode))
        if target.read_bytes() != before:
            raise RuntimeError('extension changed during patch; retry')
        os.replace(tmp.name, target)
    finally:
        Path(tmp.name).unlink(missing_ok=True)
    print('patched selector:', target.parent.name)

if __name__=='__main__':main()
