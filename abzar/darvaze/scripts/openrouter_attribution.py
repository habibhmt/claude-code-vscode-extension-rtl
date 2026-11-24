"""Per-project OpenRouter headers; no credentials, routing, or session mutation."""
from pathlib import Path
import re

_PROJECT = re.compile(r'^([1-9][0-9]{0,5})(?:th|st|nd|rd)?(?:-|$)')
# A folder with no numbered prefix keeps its own name as the project id. Using
# its digits instead would put `0th-day-salamat`, `000-BRAIN` and every other
# zero-prefixed folder into one "0" bucket (۲۲ نوامبر ۲۰۲۶).
_SAFE_ID = re.compile(r'^[A-Za-z0-9._-]{1,64}$')
_OWN = {'x-openrouter-title', 'x-title', 'http-referer', 'x-openrouter-app-visibility'}
_HEADER = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")


PROJECTS_ROOT = Path('/Users/habib/1-MY-WORK')


def project_number(cwd, *, projects_root=PROJECTS_ROOT):
    """Only a direct project child of the verified workspace root counts.

    A numbered folder (`136th-day-…`) reports its number; a folder without one
    reports its own name, so `0th-day-salamat` and `000-BRAIN` stay two separate
    projects instead of collapsing into "0".
    """
    p = Path(cwd).resolve(strict=True)
    root = Path(projects_root).resolve(strict=True)
    if not p.is_dir():
        raise ValueError('Project directory must exist')
    if not p.is_relative_to(root):
        return None
    relative = p.relative_to(root)
    if not relative.parts:
        return None
    folder = relative.parts[0]
    match = _PROJECT.match(folder)
    if match:
        return str(int(match.group(1)))
    return folder if _SAFE_ID.fullmatch(folder) else None


def apply_project_attribution(env, cwd, *, projects_root=PROJECTS_ROOT):
    """Copy env and merge attribution, preserving other headers and session ID.

    A reserved .localhost origin separates projects without publishing private
    paths or pretending that an unrelated public website belongs to the user.
    OpenRouter supports localhost attribution when a title accompanies it.
    Unknown projects retain their original headers rather than guessing.
    """
    result = dict(env)
    number = project_number(cwd, projects_root=projects_root)
    if number is None:
        return result
    raw = result.get('ANTHROPIC_CUSTOM_HEADERS', '')
    kept = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        name, sep, value = line.partition(':')
        if not sep or not _HEADER.fullmatch(name.strip()) or '\x00' in value:
            raise ValueError('Invalid custom HTTP header')
        if name.strip().lower() not in _OWN:
            kept.append(line)
    kept += [f'X-OpenRouter-Title: Claude Code - Project {number}',
             f'HTTP-Referer: http://project-{number}.claude-code.localhost',
             'X-OpenRouter-App-Visibility: hidden']
    result['ANTHROPIC_CUSTOM_HEADERS'] = '\n'.join(kept)
    return result
