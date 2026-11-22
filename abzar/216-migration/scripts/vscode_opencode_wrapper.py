#!/usr/bin/env python3
"""Third provider slot: OpenCode Go (subscription) instead of pay-per-token.

Windsurf is the slot Habib assigned to it (۲۲ نوامبر ۲۰۲۶). Until a key is in
Keychain this wrapper fails loudly instead of silently falling back to another
provider — a silent fallback would spend the wrong money.

Verified against opencode.ai on ۲۲ نوامبر:
  • Anthropic-compatible base is https://opencode.ai/inference/go/anthropic
    (no /v1; Claude Code appends /v1/messages itself).
  • Model id is deepseek-v4.1-flash; DeepSeek also needs Region=Global.
  • Without a key the route answers 401 «OpenCode Go requires an API key» —
    so the path is real, only the key is missing.
  • Claude Code already sends X-Claude-Code-Session-Id, which Go documents as
    the native session header it recognises; no custom header is added here.
"""
import ctypes
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

from claude_deepseek import PilotError
import claude_json_guard
import opencode_picker as picker

SERVICE = 'habib-claude-opencode'
ACCOUNT = 'windsurf'
# The local gateway (opencode_gateway.py) sits in front of opencode.ai: it
# publishes every model as `claude-oc-<id>` so Claude Code's picker can list
# them, measures per-model spend, and strips the stray Anthropic x-api-key.
GATEWAY = Path(__file__).resolve().parent / 'opencode_gateway.py'
PORT = int(os.environ.get('OPENCODE_GATEWAY_PORT', '50990'))
BASE = f'http://127.0.0.1:{PORT}'
MODEL = 'deepseek-v4.1-flash'
PREVIOUS = Path.home() / '.claude/claude_abzar_kam.sh'


def gateway_up():
    try:
        with urllib.request.urlopen(f'{BASE}/health', timeout=2) as response:
            return response.status == 200
    except OSError:
        return False


def ensure_gateway():
    if gateway_up():
        return True
    subprocess.Popen([sys.executable, str(GATEWAY)],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True, cwd=str(GATEWAY.parent))
    for _ in range(25):
        time.sleep(0.2)
        if gateway_up():
            return True
    return False


def read_key():
    """The OpenCode key, straight from Keychain — never printed, never in argv.

    OpenCode keys have no published prefix, so any opaque token is accepted;
    whitespace (a pasted newline is the usual mistake) is rejected.
    """
    sec = ctypes.CDLL('/System/Library/Frameworks/Security.framework/Security')
    service, account = SERVICE.encode(), ACCOUNT.encode()
    length = ctypes.c_uint32()
    data = ctypes.c_void_p()
    find = sec.SecKeychainFindGenericPassword
    find.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_char_p, ctypes.c_uint32,
                     ctypes.c_char_p, ctypes.POINTER(ctypes.c_uint32),
                     ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p]
    find.restype = ctypes.c_int32
    if find(None, len(service), service, len(account), account,
            ctypes.byref(length), ctypes.byref(data), None):
        raise PilotError('credential unavailable')
    try:
        key = ctypes.string_at(data, length.value).decode().strip()
    finally:
        sec.SecKeychainItemFreeContent(None, data)
    if not key or any(c.isspace() for c in key):
        raise PilotError('Invalid credential')
    return key


def seed_discovery_cache():
    """Write the model list where Claude Code keeps discovered gateway models.

    Measured ۲۲ نوامبر: the built-in discovery (CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY)
    fetched and cached once, then stopped writing even on a clean file, so the
    cache is written here from the same endpoint. Shape is the CLI's own:
    {baseUrl, fetchedAt, models:[{id, display_name}]}.
    """
    try:
        with urllib.request.urlopen(f'{BASE}/local/models.json', timeout=10) as response:
            rows = json.loads(response.read()).get('models', [])
    except (OSError, ValueError):
        return False
    # description matters: the CLI prints «From gateway» when it is empty, and
    # the real one from OpenCode is the honest label (حبیب ۲۲ نوامبر).
    models = [{'id': r['id'], 'display_name': r.get('name') or r['id'],
               'description': r.get('description') or ''}
              for r in rows if isinstance(r.get('id'), str)]
    if not models:
        return False
    cache = Path.home() / '.claude/cache'
    cache.mkdir(parents=True, exist_ok=True)
    payload = {'baseUrl': BASE, 'fetchedAt': int(time.time() * 1000), 'models': models}
    (cache / 'gateway-models.json').write_text(json.dumps(payload, ensure_ascii=False))
    return True


def picker_settings(entries=None):
    """`modelPicker` block: only Default plus OpenCode's own rows.

    The CLI validates this object itself («options must be an object with an
    options array of { model, label?, description?, behavesAs? } rows» and
    «replaceBuiltInOptions must be true or false»), and with
    replaceBuiltInOptions=true it hides the built-in line-up, the gateway rows
    and ANTHROPIC_CUSTOM_MODEL_OPTION — which is the only way to remove the
    Opus/Sonnet/Haiku/Fable rows without patching the binary (حبیب: «حذفش کن»).
    """
    rows = entries
    if rows is None:
        try:
            with urllib.request.urlopen(f'{BASE}/local/models.json', timeout=10) as response:
                rows = json.loads(response.read()).get('models', [])
        except (OSError, ValueError):
            return None
    options = []
    for row in rows or []:
        model_id = row.get('id')
        if not isinstance(model_id, str) or not model_id:
            continue
        option = {'model': model_id, 'label': row.get('name') or model_id}
        if row.get('description'):
            option['description'] = row['description']
        # behavesAs is the CLI's own key for «a model this version does not
        # know»: the row's label and the id sent stay untouched, only the
        # client-side handling profile (prompting/effort) is borrowed. Without
        # it such rows are not offered at all (measured in the 2.1.328 docs
        # string). Small models behave like Haiku, the rest like Sonnet.
        # Segment match, not substring: «gemini» must not read as «mini».
        segments = model_id.lower().replace('.', '-').split('-')
        light = any(seg in ('haiku', 'flash', 'free', 'mini', 'small', 'nano')
                    for seg in segments)
        option['behavesAs'] = 'claude-haiku-5-5' if light else 'claude-sonnet-5-5'
        options.append(option)
    if not options:
        return None
    return {'replaceBuiltInOptions': True, 'options': options}


# Commands that must be left EXACTLY as the IDE typed them. The extension asks
# `claude auth status` every few seconds for the sign-in badge; appending
# `--settings` to that produced «error: unknown option '--settings'» and the
# red «did not give a readable answer to the sign-in status check» box in
# Windsurf (measured ۲۲ نوامبر ۱۹:۱۵). Subcommands parse their own options, so
# the picker has no business there.
SUBCOMMANDS = {'auth', 'doctor', 'mcp', 'config', 'plugin', 'plugins', 'update',
               'upgrade', 'agents', 'install', 'uninstall', 'migrate-installer',
               'setup-token', 'login', 'logout', 'help',
               # VS Code asks this on every window: `claude --setting-sources user
               # workspace-trust`. Missing it kept the red «couldn't check whether
               # this folder is trusted» box alive (سنجیده ۲۲ نوامبر ۲۰:۲۵).
               'workspace-trust', 'trust'}
BARE_FLAGS = {'--version', '-v', '-V', '--help', '-h'}
# پرچم‌هایی که مقدار می‌گیرند؛ مقدارشان نباید به‌جای زیرفرمان خوانده شود
# (`--setting-sources user` ⇒ «user» زیرفرمان نیست).
VALUE_FLAGS = {'--setting-sources', '--model', '--settings', '--mcp-config',
               '--append-system-prompt', '--allowed-tools', '--disallowed-tools',
               '--permission-mode', '--output-format', '--input-format',
               '--max-turns', '--fallback-model', '--resume', '--agents',
               '--add-dir', '--plugin-dir', '--session-id', '--system-prompt'}


def is_subcommand(argv):
    """True for `claude auth status`-style calls and bare --version/--help.

    argv[0] is the binary. The first token that is not a flag decides: a known
    subcommand ⇒ leave the invocation alone; anything else (a prompt, or no
    argument at all for the TUI) ⇒ normal run, picker applies.
    """
    args = argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg in BARE_FLAGS:
            return True
        if arg in VALUE_FLAGS:
            i += 2  # پرچم و مقدارش
            continue
        if arg.startswith('-'):
            i += 1
            continue
        return arg in SUBCOMMANDS
    return False


def apply_picker(argv):
    """Merge the picker block into the IDE's own --settings value.

    A second --settings flag would replace the IDE's one (measured: the CLI
    reads the last occurrence), losing autoCompactWindow and friends. So the
    IDE's value is parsed and extended in place. Returns 'merged'|'added'|'none'.
    """
    block = picker_settings()
    if block is None:
        return 'none'
    index = None
    for i, arg in enumerate(argv):
        if arg == '--settings' and i + 1 < len(argv):
            index = i + 1
            break
        if arg.startswith('--settings='):
            index = i
            break
    if index is None:
        argv.extend(['--settings', json.dumps({'modelPicker': block}, ensure_ascii=False)])
        return 'added'
    raw = argv[index]
    prefix = ''
    if raw.startswith('--settings='):
        prefix, raw = '--settings=', raw.split('=', 1)[1]
    try:
        data = json.loads(raw) if '{' in raw else json.loads(Path(raw).read_text())
    except (OSError, ValueError):
        return 'none'
    if not isinstance(data, dict):
        return 'none'
    data['modelPicker'] = block
    argv[index] = prefix + json.dumps(data, ensure_ascii=False)
    return 'merged'


def drop_alias_model(argv, rows):
    """Remove a --model that names something OpenCode does not serve.

    The IDE keeps the user's last choice and passes it as `--model=opus`; that
    alias resolves inside the CLI to a built-in Claude model id which OpenCode
    cannot answer, so ANTHROPIC_MODEL is used instead. A real OpenCode id — the
    only kind the new picker offers — is passed through untouched.
    """
    ids = {row.get('id') for row in rows or [] if row.get('id')}

    def mappable(value):
        """مدلی که دروازه می‌تواند به یکی از مدل‌هایش برساند حذف نمی‌شود.

        افزونه مدلِ به‌یادمانده‌اش را با `--model` می‌فرستد: گاهی املای
        `@preset`/`[1m]` (که دروازه با `mapped_from` به همان DeepSeek می‌رساند)
        و گاهی `opus`. حذفِ اولی همان چیزی بود که حبیب دید: بعد از refresh مدل
        «می‌رفت روی ورژنِ دیگر»، چون CLI به پیش‌فرضش برمی‌گشت (ناظر-۱۳۶، ۲۰:۳۱).
        """
        if value in ids:
            return True
        # `claude-oc-` پیشوندِ دورهٔ اولِ دروازه است و دروازه خودش برش می‌دهد
        if value.startswith('claude-oc-') and value[len('claude-oc-'):] in ids:
            return True
        bare = value.split('[', 1)[0]
        if '@preset/' in bare:
            bare = bare.split('@preset/', 1)[0]
        for candidate in (bare, bare.rsplit('/', 1)[-1]):
            if candidate in ids:
                return True
            for known in sorted(ids, key=len, reverse=True):
                if candidate.startswith(known):
                    return True
        return False

    for i, arg in enumerate(argv):
        if arg == '--model' and i + 1 < len(argv):
            if not mappable(argv[i + 1]):
                dropped = argv[i + 1]
                del argv[i:i + 2]
                return dropped
            return None
        if arg.startswith('--model='):
            value = arg.split('=', 1)[1]
            if not mappable(value):
                del argv[i]
                return value
            return None
    return None


def prepare(argv):
    env = os.environ.copy()
    if not ensure_gateway():
        raise PilotError('دروازهٔ محلی بالا نیامد')
    seed_discovery_cache()
    env['ANTHROPIC_BASE_URL'] = BASE
    # Discovering /v1/models is what makes the full list appear in the picker;
    # Claude Code only keeps ids that start with `claude-`, which is exactly
    # what the gateway above publishes.
    env['CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY'] = '1'
    env['ANTHROPIC_AUTH_TOKEN'] = read_key()
    # Every alias is pinned to DeepSeek. Leaving the Haiku alias empty made the
    # CLI fall back to its built-in `claude-haiku-5-5`, which OpenCode *does*
    # serve — so background and IDE-inherited calls were billed at Claude rates
    # (۳۷ درخواست، $۰.۳۳ تا ۰۸:۴۰ در برابر $۰.۱۳ برای ۹۰ درخواستِ DeepSeek).
    # The duplicate "Custom Opus/Sonnet/Haiku" rows these vars used to add are
    # now hidden by modelPicker.replaceBuiltInOptions, so they are safe to set
    # (حبیب ۲۲ نوامبر: «اون مدلای چرت انپروپیک رو حذف کن»).
    env['ANTHROPIC_MODEL'] = MODEL
    env['CLAUDE_CODE_SUBAGENT_MODEL'] = MODEL
    env['ANTHROPIC_SMALL_FAST_MODEL'] = MODEL
    for name in ('ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL',
                 'ANTHROPIC_DEFAULT_HAIKU_MODEL'):
        env[name] = MODEL
    env.pop('ANTHROPIC_DEFAULT_FABLE_MODEL', None)
    env.pop('ANTHROPIC_API_KEY', None)
    for name in ('CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK',
                 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY'):
        env.pop(name, None)
    return argv, env


def exec_previous(argv, env):
    """Hand over to the tool-policy wrapper; never returns on success."""
    if not PREVIOUS.is_file():
        raise PilotError('Previous tool-policy wrapper unavailable')
    os.execve(str(PREVIOUS), [str(PREVIOUS), *argv], env)
    return 1  # execve only returns on failure


def main():
    try:
        if len(sys.argv) < 2:
            raise PilotError('Missing native binary')
        argv, env = prepare([sys.argv[1], *sys.argv[2:]])
        claude_json_guard.drop()
        if is_subcommand(argv):
            # `auth status`, `--version`, `mcp list` …: the IDE is only asking
            # a question. Any extra flag here is rejected by the CLI and the
            # extension shows it as a broken sign-in (measured ۲۲ نوامبر ۱۹:۱۵).
            picker.log(f'subcommand بدونِ modelPicker: {argv[1:3]}')
            return exec_previous(argv, env)
        # The picker list is OpenCode's own: real ids, real names, seeded from
        # the gateway right before the CLI reads its config (حبیب ۲۲ نوامبر).
        picker.seed()
        picker.log(f'modelPicker: {apply_picker(argv)}')
        dropped = drop_alias_model(argv, [{'id': e['value']} for e in picker.fetch_models()])
        if dropped:
            picker.log(f'--model حذف شد (مدلِ اوپن کد نیست): {dropped}')
        return exec_previous(argv, env)
    except (OSError, ValueError, PilotError):
        print('کلید OpenCode Go در Keychain نیست؛ وینسرف فعلاً باید روی Standard Compute بماند.',
              file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
