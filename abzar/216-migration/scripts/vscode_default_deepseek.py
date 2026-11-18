#!/usr/bin/env python3
"""Default VS Code adapter. Keep existing tool policy and shared Claude history."""
import ctypes
import os
from pathlib import Path
import subprocess
import sys
from vscode_deepseek_wrapper import prepare
from claude_deepseek import PilotError
SERVICE='habib-claude-code-openrouter'
ACCOUNT='default-vscode'
PREVIOUS=Path.home()/'.claude/claude_abzar_kam.sh'

def read_key(service_name=SERVICE, prefix='sk-or-'):
    sec=ctypes.CDLL('/System/Library/Frameworks/Security.framework/Security')
    service=service_name.encode(); account=ACCOUNT.encode()
    length=ctypes.c_uint32(); data=ctypes.c_void_p()
    find=sec.SecKeychainFindGenericPassword
    find.argtypes=[ctypes.c_void_p,ctypes.c_uint32,ctypes.c_char_p,ctypes.c_uint32,ctypes.c_char_p,ctypes.POINTER(ctypes.c_uint32),ctypes.POINTER(ctypes.c_void_p),ctypes.c_void_p]
    find.restype=ctypes.c_int32
    status=find(None,len(service),service,len(account),account,ctypes.byref(length),ctypes.byref(data),None)
    if status:raise PilotError('credential unavailable')
    try:key=ctypes.string_at(data,length.value).decode().strip()
    finally:sec.SecKeychainItemFreeContent(None,data)
    if not key.startswith(prefix) or any(c.isspace() for c in key):raise PilotError('Invalid credential')
    return key

def main():
    try:
        if len(sys.argv)<2:raise PilotError('Missing native binary')
        args=sys.argv[2:]
        # A live chat changes its model without restarting this process.
        # The local endpoint resolves each explicit picker choice at request time.
        argv,env=prepare(sys.argv[1],args,'',picker_accounts=True)
        # Keep the previous default profile's tool selection behavior.
        if not PREVIOUS.is_file():raise PilotError('Previous tool-policy wrapper unavailable')
        os.execve(str(PREVIOUS),[str(PREVIOUS),*argv],os.environ.copy() if env is None else env)
    except (OSError,ValueError,subprocess.TimeoutExpired,PilotError):
        print('اتصال DeepSeek آماده نیست؛ برای جلوگیری از برگشت ناخواسته به Claude، اجرا متوقف شد.',file=sys.stderr)
        return 1
if __name__=='__main__':raise SystemExit(main())
