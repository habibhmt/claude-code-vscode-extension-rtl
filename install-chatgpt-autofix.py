#!/usr/bin/env python3
"""Install/remove this checkout's macOS launch agent; never reload an IDE."""
import argparse
import os
from pathlib import Path
import plistlib
import subprocess
import sys

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--remove', action='store_true')
a = p.parse_args()
label = 'com.habib.fix-rtl-chatgpt'
domain = f'gui/{os.getuid()}'
target = Path.home() / 'Library/LaunchAgents' / (label + '.plist')
subprocess.run(['launchctl', 'bootout', domain + '/' + label], capture_output=True)
if a.remove:
    target.unlink(missing_ok=True)
    print('Automatic ChatGPT RTL patching removed.')
else:
    target.parent.mkdir(parents=True, exist_ok=True)
    env = {'PATH': os.environ['PATH']}
    data = {'Label': label, 'ProgramArguments': [sys.executable, str(Path(__file__).resolve().with_name('fix-rtl-chatgpt.py')), '--with-font'], 'RunAtLoad': True, 'StartInterval': 300, 'EnvironmentVariables': env, 'StandardErrorPath': str(Path.home() / 'Library/Logs/chatgpt-rtl-error.log')}
    target.write_bytes(plistlib.dumps(data))
    subprocess.run(['launchctl', 'bootstrap', domain, str(target)], check=True)
    print(f'Installed {target}')
