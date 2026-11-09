"""Version-checked, reversible scoping of the webview and VS Code chat lists."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

MARKER = '// CHATGPT-RTL-FOLDER\n'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def one_file(root, pattern, contains=None):
    files = list(root.glob(pattern))
    if contains is not None:
        files = [p for p in files if contains in p.read_text()]
    if len(files) != 1:
        raise ValueError(f'Expected one {pattern}; found {len(files)}')
    return files[0]


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError(f'Unsupported recent-chat contract: {old[:90]}')
    return source.replace(old, new, 1)


def need_exports(path, pairs):
    """The helper imports these names, and a wrong one is a blank page that no syntax check sees."""
    found = set()
    for group in re.findall(r'export\s*\{([^}]*)\}', path.read_text()):
        for item in group.split(','):
            parts = item.split(' as ')
            found.add((parts[0].strip(), parts[-1].strip()))
    missing = [pair for pair in pairs if pair not in found]
    if missing:
        raise ValueError(f'{path.name}: native exports changed: {missing}')


def prepare(root, originals, payload):
    """Check all anchors/imports before returning any replacement bytes."""
    hooks = one_file(root, 'app-server-manager-hooks-*.js')
    header = one_file(root, 'header-*.js', 'open-recent-tasks-menu')
    inputs = one_file(root, 'thread-context-inputs-*.js')
    scope = one_file(root, 'app-scope-*.js')
    bus = one_file(root, 'message-bus-*.js', 'acquireVsCodeApi')
    need_exports(bus, [('c', 'c'), ('l', 's')])
    initial = one_file(root, 'app-initial-*.js')
    recent_anchor = 'async listRecentThreads({originators:e,cursor:t,limit:n,background:r=!1}){let i={limit:n,'
    runtime = one_file(root, 'src-*.js', 'async listRecentThreads({originators:e,cursor:t,limit:n,background:r=!1})')
    inp = inputs.read_text()
    need_exports(inputs, [('U', 'u'), ('$', 's'), ('E', 'O'), ('D', 'D')])
    if 'queryFn:({signal:t})=>E(e,t)' not in inp:
        raise ValueError('Unsupported workspace-root query contract')
    if 'm?.workspaceRoots' not in inp:
        raise ValueError('Workspace-root query no longer reads the native host')
    need_exports(scope, [('Wa', 'c')])
    if 'rS' not in {item.split(' as ')[-1].strip() for group in re.findall(r'export\s*\{([^}]*)\}', initial.read_text())
                    for item in group.split(',')}:
        raise ValueError('Native React export changed')
    prefix = (
        f'import {{u as crtlWorkspaceRoots,s as crtlInitInputs}} from "./{inputs.name}";\n'
        f'import {{c as crtlUseQuery}} from "./{scope.name}";\n'
        f'import {{rS as crtlReact}} from "./{initial.name}";\n'
    )
    prefix += (
        f'import {{c as crtlPanelApi,s as crtlInitPanelApi}} from "./{bus.name}";\n'
        f'import {{O as crtlReadPanelRoots,D as crtlInitPanelRoots}} from "./{inputs.name}";\n'
    )
    panel_state = Path(__file__).with_name('chatgpt-panel-state.js').read_text()
    helper = (prefix + payload + '\n' + panel_state).encode()
    helper_name = f'chatgpt-folder-filter-{sha(helper)[:16]}.js'
    hook_source = originals.get(hooks.name, hooks.read_bytes()).decode()
    header_source = originals.get(header.name, header.read_bytes()).decode()
    # Both the home list and the history dropdown use the recent-conversation
    # hook. Scope its returned view, never its query cache or app-server requests.
    hook_source = replace_once(hook_source, 'function Y(){', 'function crtlNativeRecent(){')
    hook_source += '\n' + MARKER + (
        f'import {{crtlUseFolderResult}} from "./{helper_name}";\n'
        'function Y(){return crtlUseFolderResult(crtlNativeRecent());}\n'
    )
    if 'export{_e as n,Y as r,$ as t}' not in hook_source:
        raise ValueError('Recent-conversation export changed')
    # The merged view also contains cloud and pending-worktree entries. Filter
    # those at its rendering boundary, including the native title-search menu.
    header_source = replace_once(header_source, 'function _n(e,t,n){',
                                 'function crtlNativeMerged(e,t,n){')
    if 'pendingWorktrees:r,pendingThreadStarts:i' not in header_source:
        raise ValueError('Merged recent-chat shape changed')
    header_source += '\n' + MARKER + (
        f'import {{crtlUseFolderRows}} from "./{helper_name}";\n'
        'function _n(e,t,n){return crtlUseFolderRows(crtlNativeMerged(e,t,n),true);}\n'
    )
    # Home must use exactly the same current rows/order as the clock menu.
    header_source = replace_once(header_source,
        'u=(0,Lt.default)([...r,...n],Nt).slice(0,Math.max(3,r.length))', 'u=n')
    # Scope the webview's recent-history request before its native 50-row limit.
    # General searches, cleanup and thread reads keep their existing scope.
    runtime_source = originals.get(runtime.name, runtime.read_bytes()).decode()
    runtime_source = replace_once(runtime_source, recent_anchor,
        'async listRecentThreads({originators:e,cursor:t,limit:n,background:r=!1}){'
        'let crtlRoots;if(this.params.hostId===`local`){crtlInitRoots();'
        'crtlRoots=(await crtlReadWorkspaceRoots({hostId:`local`})).roots;}'
        'let i={cwd:crtlRoots?.length?crtlRoots:void 0,limit:n,')
    runtime_source += '\n' + MARKER + (
        f'import {{O as crtlReadWorkspaceRoots,D as crtlInitRoots}} from "./{inputs.name}";\n')
    # VS Code's native Chat Sessions provider is outside the webview. Limit only
    # its listing request, using the extension's current-folder/WSL conversion.
    # Do not scope the general RPC bridge, cleanup, preview lookup, or thread reads.
    host_name = '../../out/extension.js'
    host_source = originals.get(host_name, (root / host_name).read_bytes()).decode()
    if 'function fv(){let t=iWe.workspace.workspaceFolders?' not in host_source:
        raise ValueError('Native workspace-folder reader changed')
    old = 'this.codexAppServer.sendRequest(YGe,r,"thread/list",{limit:50,'
    new = 'this.codexAppServer.sendRequest(YGe,r,"thread/list",{cwd:fv().length?fv():void 0,limit:50,'
    host_source = replace_once(host_source, old, new)
    # The «تنظیمات Codex» tab (تعریف ۲۵): the panel's own messages, and this chat's saved values on its turn/start.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import codex_tanzimat_build
    host_source = host_source + '\n' + MARKER
    host_source = codex_tanzimat_build.apply_anchors(host_source)

    return {hooks.name: hook_source.encode(), header.name: header_source.encode(), runtime.name: runtime_source.encode(),
            host_name: host_source.encode()}, helper_name, helper


def remove_recorded_helper(root, name, recorded_sha):
    """Delete a helper only if the manifest names it and its bytes are still what we wrote."""
    if not name or Path(name).name != name or not name.startswith('chatgpt-folder-filter-') or not name.endswith('.js'):
        return
    path = root / name
    if not path.exists():
        return
    if sha(path.read_bytes()) != recorded_sha:
        print(f'[KEPT folder helper] {path}: changed since we wrote it', file=sys.stderr)
        return
    path.unlink()


def patch_folder_filter(ext, payload, atomic_write, revert=False):
    root = ext / 'webview/assets'
    manifest = ext / 'webview/.chatgpt-folder-filter.json'
    previous = json.loads(manifest.read_text()) if manifest.exists() else None
    originals = {}
    if previous:
        for name, record in previous['files'].items():
            path = root / name
            current = path.read_bytes()
            original = (root / record['backup']).read_bytes()
            if sha(current) != record['patched_sha256'] or sha(original) != record['original_sha256']:
                raise RuntimeError(f'{path}: folder-filter files changed externally; refusing overwrite')
            originals[name] = original
    if revert:
        if previous:
            for name, original in originals.items():
                atomic_write(root / name, original)
            for record in previous['files'].values():
                (root / record['backup']).unlink()
            manifest.unlink()
            remove_recorded_helper(root, previous.get('helper'), previous.get('helper_sha256'))
            print(f'[FOLDER RESTORED] {ext}')
        return
    try:
        outputs, helper_name, helper = prepare(root, originals, payload)
    except ValueError as error:
        if previous:
            raise RuntimeError(str(error)) from error
        print(f'[SKIP folder filter] {ext}: {error}', file=sys.stderr)  # launchd keeps only stderr
        return
    if not previous and any(MARKER.encode() in (root / name).read_bytes() for name in outputs):
        raise RuntimeError('Folder-filter marker without manifest; inspect before proceeding')
    for name, data in {helper_name: helper, **outputs}.items():
        mode = 'commonjs' if name.endswith('/out/extension.js') else 'module'
        subprocess.run(['node', f'--input-type={mode}', '--check'], input=data,
                       check=True, capture_output=True)
    records = {}
    for name, data in outputs.items():
        original = originals.get(name, (root / name).read_bytes())
        backup_name = name + '.chatgpt-folder-backup'
        backup = root / backup_name
        if backup.exists() and backup.read_bytes() != original:
            raise RuntimeError(f'Untracked folder-filter backup differs: {backup}')
        records[name] = {'backup': backup_name, 'original_sha256': sha(original),
                         'patched_sha256': sha(data)}
    meta = {'files': records, 'helper': helper_name, 'helper_sha256': sha(helper)}
    if previous == meta and (root / helper_name).exists() and (root / helper_name).read_bytes() == helper:
        return
    before = {name: (root / name).read_bytes() for name in outputs}
    helper_is_new = not (root / helper_name).exists()
    new_backups = []
    try:
        atomic_write(root / helper_name, helper)
        for name, data in outputs.items():
            # An upgrade can start patching an additional native file. It needs
            # its own original even when the other files were backed up before.
            if not previous or name not in previous['files']:
                new_backups.append(root / records[name]['backup'])
                atomic_write(new_backups[-1], before[name])
            atomic_write(root / name, data)
        atomic_write(manifest, (json.dumps(meta, indent=2) + '\n').encode())
    except BaseException:  # Ctrl-C too: a half patch without manifest fails every later run
        for name, data in before.items():
            atomic_write(root / name, data)
        for path in new_backups + ([root / helper_name] if helper_is_new else []):
            path.unlink(missing_ok=True)
        raise
    if previous and previous.get('helper') != helper_name:
        remove_recorded_helper(root, previous.get('helper'), previous.get('helper_sha256'))
    print(f'[FOLDER FILTER] {ext}')
