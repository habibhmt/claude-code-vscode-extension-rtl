#!/usr/bin/env python3
"""ری‌استارتِ درستِ سرویسِ launchd — `enable` ⇒ `bootout` ⇒ `bootstrap` + سلامت‌سنجی.

چرا: ۲۴ نوامبر ۲۰۲۶ با `launchctl kickstart -k` دروازه مُرد (`exit 78`) چون
kickstart تعریفِ **کش‌شده** را اجرا می‌کند، نه پلیستِ تازه. بدتر: سرویسی که در
launchctl «disabled» باشد با bootout/bootstrap هم بالا نمی‌آید (ناظر-مجری هفته‌ها
خاموش ماند). حبیب ۰۶:۴۸: «بله، هر پنج بند + شش نام».

اجرا:
  python3 Doc/abzar/restart_service.py --dry-run          # پیش‌فرض: فقط نشان بده
  python3 Doc/abzar/restart_service.py --live             # واقعی، جدا از سشن
  python3 Doc/abzar/restart_service.py --label com.habib.opencode-usage --live
کدِ خروج: ۰ سالم · ۱ سرویس بالا نیامد/سلامت رد شد · ۲ خطای استفاده
"""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

label_service_gateway = 'com.habib.opencode-gateway'
code_salamat_gateway = 200
ravesh_restart = 'enable bootout bootstrap'


def plist_of(label):
    return os.path.expanduser(f'~/Library/LaunchAgents/{label}.plist')


def backup(label):
    d = os.path.expanduser(f'~/.claude/backups/{label}-{time.strftime("%Y%m%d-%H%M%S")}')
    os.makedirs(d, exist_ok=True)
    src = plist_of(label)
    if os.path.exists(src):
        shutil.copy2(src, d)
    return d


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()[:200]


def salamat_gateway():
    """سنجشِ اول: کدِ HTTP روی /v1/models."""
    try:
        with urllib.request.urlopen('http://127.0.0.1:50990/v1/models', timeout=6) as r:
            return r.status
    except Exception as e:  # noqa: BLE001
        return f'خطا: {e}'


def wrapper_salem():
    """سنجشِ دوم: مسیرِ claudeCode.claudeProcessWrapper وجود دارد و اجراپذیر است.
    این همان چیزی است که سه بار چتِ VS Code را شکست و سنجشِ اول نمی‌دید."""
    report = []
    for p in ('~/Library/Application Support/Code/User/settings.json',
              '~/Library/Application Support/Windsurf/User/settings.json'):
        p = os.path.expanduser(p)
        if not os.path.exists(p):
            continue
        try:
            d = json.load(open(p, encoding='utf-8'))
        except Exception:
            report.append((p, 'JSON خوانده نشد', False))
            continue
        w = d.get('claudeCode.claudeProcessWrapper')
        if not w:
            report.append((p, '(تنظیم نشده)', True))
            continue
        ok = os.path.exists(w) and os.access(w, os.X_OK)
        report.append((p, w, ok))
    return report


def main():
    args = sys.argv[1:]
    if '--help' in args or '-h' in args:
        print(__doc__)
        return 0
    label = label_service_gateway
    if '--label' in args:
        label = args[args.index('--label') + 1]
    live = '--live' in args

    steps = [f'launchctl {s} gui/{os.getuid()} …' for s in ravesh_restart.split()]
    print('label:', label)
    print('ترتیب:', ' ⇒ '.join(ravesh_restart.split()), '  (kickstart هرگز)')
    for s in steps:
        print('  ', 'will run:' if live else 'plan:', s)

    if not live:
        w = wrapper_salem()
        print('سلامتِ فعلی — /v1/models:', salamat_gateway())
        for p, path, ok in w:
            print(f'  wrapper {"✅" if ok else "❌"} {path}  ({os.path.basename(os.path.dirname(os.path.dirname(p)))})')
        print('حالتِ خشک: هیچ سرویسی دست نخورد. برای اجرای واقعی --live بده.')
        return 0

    # جدا از سشن: خودمان را با setsid دوباره اجرا می‌کنیم تا قطعِ سشن، کار را نصفه نگذارد
    if not os.environ.get('RESTART_DETACHED'):
        log = os.path.expanduser(f'~/.claude/backups/restart-{label}-{time.strftime("%Y%m%d-%H%M")}.log')
        os.makedirs(os.path.dirname(log), exist_ok=True)
        env = dict(os.environ, RESTART_DETACHED='1')
        with open(log, 'w') as f:
            child = subprocess.Popen([sys.executable, os.path.abspath(__file__), '--live', '--label', label],
                                     stdout=f, stderr=subprocess.STDOUT, env=env, start_new_session=True)
        print('جدا اجرا شد؛ لاگ:', log)
        try:
            return child.wait(timeout=90)      # کدِ خروجِ واقعی؛ اگر بیشتر طول کشید، ۰
        except subprocess.TimeoutExpired:
            print('هنوز در حالِ اجراست؛ نتیجه در همان لاگ')
            return 0

    if not os.path.exists(plist_of(label)):
        print('❌ پلیست نیست:', plist_of(label))
        return 1
    d = backup(label)
    print('پشتیبان:', d)
    uid = os.getuid()
    cmds = [['launchctl', 'enable', f'gui/{uid}/{label}'],
            ['launchctl', 'bootout', f'gui/{uid}/{label}'],
            ['launchctl', 'bootstrap', f'gui/{uid}', plist_of(label)]]
    for cmd in cmds:
        rc, out = run(cmd)
        print(' '.join(cmd), '⇒', rc, out)
        if cmd[1] == 'bootstrap' and rc != 0:
            print('❌ bootstrap نشد — برگشت به پشتیبان')
            shutil.copy2(os.path.join(d, os.path.basename(plist_of(label))), plist_of(label))
            run(['launchctl', 'bootstrap', f'gui/{uid}', plist_of(label)])
            return 1
        if cmd[1] == 'bootout' and rc not in (0, 3):   # 3 = نبود، عیب نیست
            print('⚠️ bootout با کدِ', rc)

    time.sleep(2)
    code = salamat_gateway()
    print('سلامت — /v1/models:', code)
    ok = code == code_salamat_gateway
    for p, path, wok in wrapper_salem():
        print(f'  wrapper {"✅" if wok else "❌"} {path}')
        ok = ok and wok
    if not ok:
        print('❌ سلامت رد شد — برگشت به پشتیبان')
        shutil.copy2(os.path.join(d, os.path.basename(plist_of(label))), plist_of(label))
        run(['launchctl', 'bootout', f'gui/{uid}/{label}'])
        run(['launchctl', 'bootstrap', f'gui/{uid}', plist_of(label)])
        return 1
    print('✅ سالم:', label)
    return 0


if __name__ == '__main__':
    sys.exit(main())
