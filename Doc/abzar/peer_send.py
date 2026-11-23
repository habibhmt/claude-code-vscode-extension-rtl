#!/usr/bin/env python3
"""فرستادنِ پیامِ بین‌سشنی بدونِ مدل — مستقیم روی سوکتِ خودِ کلود کد.

پیش از این، `payam_be_203.sh` یک `claude -p --model ...` بالا می‌آورد تا ابزارِ
SendMessage را صدا بزند؛ یعنی برای هر پیام یک تماسِ مدلِ اضافی. این اسکریپت همان
خطِ لوله را خودش می‌نویسد:

    {"type":"auth","token":"<peerToken از فایلِ کلیدِ همان سشن>"}
    {"type":"user","from":"uds:/tmp/cc-socks/<pid>.sock","msg_id":"<uuid>",
     "priority":"next","message":{"role":"user","content":"..."}}

مسیرها (سنجیده از خودِ باینریِ 2.1.327):
  • سوکتِ هر سشن:  `~/.claude/sessions/<pid>.json` → `messagingSocketPath`
  • کلیدِ همان سشن: `~/.claude/sessions/<pid>.<64hex>.key` → `peerToken`
  • ثابت‌ها در باینری: `authRequired` فقط وقتی روشن است که سشن در حالتِ
    bypassPermissions باشد؛ در حالتِ عادی احرازِ هویت اختیاری است، ولی فرستادنش
    همیشه درست است.

اجرا:
    python3 Doc/abzar/peer_send.py --list
    python3 Doc/abzar/peer_send.py --name "مجری-۲۰۳- ایمک" --text "سلام"
    python3 Doc/abzar/peer_send.py --name ناظر-۱۳۶ --text "…" --wait 3

هیچ تماسِ مدلی نمی‌زند. فقط می‌نویسد روی سوکت و (اختیاری) رسیدِ برگشتی را می‌خواند.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import socket
import sys
import time
import uuid

KHANEH_SESSIONS = os.environ.get("PEER_SESSIONS_DIR") or os.path.expanduser("~/.claude/sessions")


def _zende(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, ValueError):
        return False
    except PermissionError:
        return True


def sessions() -> list[dict]:
    """همهٔ سشن‌های زندهٔ همین کاربر، از دفترِ خودِ کلود کد."""
    out = []
    for path in sorted(glob.glob(os.path.join(KHANEH_SESSIONS, "*.json"))):
        try:
            with open(path, encoding="utf-8") as f:
                d = json.load(f)
        except (OSError, ValueError):
            continue
        pid = d.get("pid")
        if not isinstance(pid, int) or not _zende(pid):
            continue
        if not d.get("messagingSocketPath"):
            continue
        out.append(d)
    return out


def _norm(s: str) -> str:
    """یکسان‌سازی: فاصله و نیم‌فاصله برداشته، ي/ك عربی به فارسی.

    علت: نامِ واقعیِ سشنِ ۲۰۳ «مجری-۲۰۳- ایمک» است و اسکریپتِ قدیمی
    «مجری-۲۰۳-ای مک» صدا می‌زد؛ هر دو بعد از این یکسان می‌شوند.
    """
    s = (s or "").translate({ord("ي"): "ی", ord("ك"): "ک", ord("‌"): "", ord("‏"): ""})
    return "".join(s.split()).lower()


def peyda_kon(esm: str) -> dict:
    """فقط نامِ دقیق یا نامِ یکسان‌شده؛ عمداً هیچ تطبیقِ دیگری نیست.

    حبیب ۲۸ اکت ۱۹:۲۰: پیامِ «مجری-۱۸۴» به تبِ خالیِ 184-c5 رفت ⇐ فقط اسمِ دقیق.
    """
    hame = sessions()
    for d in hame:
        if d.get("name") == esm:
            return d
    n = _norm(esm)
    for d in hame:
        if _norm(d.get("name")) == n:
            return d
    raise SystemExit("سشنی با این نام پیدا نشد: %r\n%s" % (esm, _jadval(hame)))


def _jadval(hame: list[dict]) -> str:
    khat = ["pid\tname\tstatus\tcwd"]
    for d in hame:
        khat.append("%s\t%s\t%s\t%s" % (d.get("pid"), d.get("name"), d.get("status"), d.get("cwd")))
    return "\n".join(khat)


def kalid(pid: int) -> str:
    """`peerToken` از فایلِ کلیدِ همان سشن؛ چاپ نمی‌شود."""
    namha = glob.glob(os.path.join(KHANEH_SESSIONS, "%d.*.key" % pid))
    if len(namha) != 1:
        raise SystemExit("فایلِ کلید برای pid=%d پیدا نشد (%d فایل)" % (pid, len(namha)))
    with open(namha[0], encoding="utf-8") as f:
        return json.load(f)["peerToken"]


def _soket_haye_khodi() -> tuple[socket.socket, str]:
    """یک سوکتِ گوش‌دهندهٔ موقت در همان پوشهٔ cc-socks، تا رسیدِ گیرنده را بشنویم.

    نامش باید با `^(\\d+(-[0-9a-f]{8})?|[0-9a-f]{1,16})\\.sock$` بخواند، وگرنه
    گیرنده آدرسِ فرستنده را معتبر نمی‌داند.
    """
    papke = os.path.dirname(os.environ.get("CLAUDE_CODE_MESSAGING_SOCKET", "/tmp/cc-socks/x.sock"))
    os.makedirs(papke, mode=0o700, exist_ok=True)
    for _ in range(20):
        nom = "%d" % (400000 + int(uuid.uuid4().int % 500000))
        masir = os.path.join(papke, nom + ".sock")
        if os.path.exists(masir):
            continue
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            s.bind(masir)
            s.listen(4)
            s.settimeout(0.2)
            return s, masir
        except OSError:
            s.close()
            continue
    raise SystemExit("سوکتِ موقت ساخته نشد")


def dar_tarikhche(msg_id: str, sid: str) -> bool:
    """آیا همین پیام در دفترِ همان سشن نشست؟ آخرِ فایل را می‌خوانیم، نه همه‌اش."""
    if not (msg_id and sid):
        return False
    khaneh = os.environ.get("PEER_PROJECTS_DIR") or os.path.expanduser("~/.claude/projects")
    for masir in glob.glob(os.path.join(khaneh, "*", "%s.jsonl" % sid)):
        try:
            andaze = os.path.getsize(masir)
            bakhsh = min(andaze, 4_000_000)
            with open(masir, "rb") as f:
                f.seek(andaze - bakhsh)
                if msg_id.encode() in f.read(bakhsh):
                    return True
        except OSError:
            continue
    return False


def khodam_ki_hastam() -> str:
    """نامِ همین سشن (فرستنده) از دفتر، تا گیرنده بداند از کیست."""
    sid = os.environ.get("CLAUDE_CODE_SESSION_ID", "")
    if sid:
        for d in sessions():
            if d.get("sessionId") == sid and d.get("name"):
                return d["name"]
    return ""


def befrest(d: dict, matn: str, wait: float = 2.0, priority: str = "next",
            envelope: bool = True, from_name: str = "") -> dict:
    pid = d["pid"]
    masir = d["messagingSocketPath"]
    token = kalid(pid)

    shenava, khodam = _soket_haye_khodi()
    from_addr = "uds:" + khodam

    if envelope:
        # همان پاکتی که خودِ کلود کد می‌سازد (تابعِ TZt در باینری)
        esm = from_name or khodam_ki_hastam()
        ezafe = ' from-name="%s"' % esm if esm else ""
        matn = ('<cross-session-message from="%s"%s>\n%s\n'
                '</cross-session-message>' % (from_addr, ezafe, matn))

    payload = [
        {"type": "auth", "token": token},
        {
            "type": "user",
            "from": from_addr,
            "msg_id": str(uuid.uuid4()),
            "priority": priority,
            "message": {"role": "user", "content": matn},
        },
    ]

    c = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    c.settimeout(2.0)
    try:
        c.connect(masir)
    except OSError as e:
        shenava.close()
        try:
            os.unlink(khodam)
        except OSError:
            pass
        return {"to": d.get("name"), "pid": pid, "msg_id": payload[1]["msg_id"],
                "verdict": "not_sent", "error": str(e), "receipts": [], "delivered": False}
    for row in payload:
        c.sendall((json.dumps(row, ensure_ascii=False) + "\n").encode("utf-8"))
    c.shutdown(socket.SHUT_WR)

    resul = {"to": d.get("name"), "pid": pid, "socket": masir, "from": from_addr,
             "msg_id": payload[1]["msg_id"], "receipts": []}
    payan = time.time() + wait
    shenava.settimeout(0.2)
    buf = b""
    while time.time() < payan:
        try:
            peyvand, _ = shenava.accept()
        except socket.timeout:
            continue
        except OSError:
            break
        peyvand.settimeout(0.3)
        try:
            while True:
                tok = peyvand.recv(65536)
                if not tok:
                    break
                buf += tok
        except socket.timeout:
            pass
        peyvand.close()
        while b"\n" in buf:
            khat, buf = buf.split(b"\n", 1)
            if khat.strip():
                try:
                    resul["receipts"].append(json.loads(khat))
                except ValueError:
                    resul["receipts"].append({"raw": khat.decode("utf-8", "replace")})
    c.close()
    shenava.close()
    try:
        os.unlink(khodam)
    except OSError:
        pass

    # حکم: رسیدِ «refused» یعنی قطعاً نرسیده؛ پیدا شدنِ msg_id در دفترِ همان سشن
    # یعنی قطعاً رسیده. «held» یعنی در صف مانده و بعد آزاد می‌شود.
    rad = [r.get("status") for r in resul["receipts"]
           if isinstance(r, dict) and r.get("status")]
    resul["receipt_status"] = rad
    dast = time.time() + max(0.0, wait)
    while True:
        if dar_tarikhche(resul["msg_id"], d.get("sessionId") or ""):
            resul["delivered"] = True
            break
        if time.time() >= dast:
            resul["delivered"] = False
            break
        time.sleep(0.3)
    resul["verdict"] = hokm(rad, resul["delivered"])
    return resul


def hokm(rad: list, delivered: bool) -> str:
    """فقط همین چهار حکم؛ تستِ واحد روی همین است."""
    if "refused" in rad:
        return "refused"
    if delivered:
        return "delivered"
    if rad:
        return "held"
    return "unverified"


def code_khoruj(hokm_val: str) -> int:
    """۰ = رسید یا صف · ۳ = روی سوکت نوشته نشد · ۴ = گیرنده رد کرد · ۵ = نوشته شد ولی رسید تأیید نشد.

    «۵» را ناظر-۱۳۶ گرفت (۲۳ نوامبر ۲۰۲۶ ۲۳:۲۲): پیش‌تر `unverified` هم کدِ ۰ می‌گرفت و
    اسکریپتِ ۲۰۳ روی آن «✅» چاپ می‌کرد — یعنی ادعای رسیدنِ بی‌مدرک. حبیب: «باید ۱۰۰ درصد باشه».
    """
    return {"delivered": 0, "held": 0, "unverified": 5, "not_sent": 3,
            "refused": 4}.get(hokm_val, 3)


def main() -> int:
    ap = argparse.ArgumentParser(description="پیامِ بین‌سشنی بدونِ مدل")
    ap.add_argument("--list", action="store_true", help="فهرستِ سشن‌ها")
    ap.add_argument("--name", help="نامِ سشنِ مقصد")
    ap.add_argument("--pid", type=int, help="pidِ سشنِ مقصد")
    ap.add_argument("--text", help="متنِ پیام (یا از stdin با --stdin)")
    ap.add_argument("--stdin", action="store_true", help="متن را از stdin بخوان")
    ap.add_argument("--wait", type=float, default=2.0, help="ثانیه انتظار برای رسید")
    ap.add_argument("--priority", default="next", choices=["next", "later", "now"])
    ap.add_argument("--no-envelope", action="store_true", help="بدونِ پاکتِ cross-session-message")
    ap.add_argument("--from-name", default="", help="نامِ فرستنده در پاکت")
    ap.add_argument("--dry-run", action="store_true", help="فقط مقصد را نشان بده، نفرست")
    a = ap.parse_args()

    if a.list:
        print(_jadval(sessions()))
        return 0

    if a.pid:
        d = next((x for x in sessions() if x["pid"] == a.pid), None)
        if d is None:
            raise SystemExit("سشنِ زنده با pid=%d نیست" % a.pid)
    elif a.name:
        d = peyda_kon(a.name)
    else:
        raise SystemExit("--name یا --pid یا --list لازم است")

    if a.dry_run:
        print(json.dumps({k: v for k, v in d.items() if k != "peerToken"},
                         ensure_ascii=False, indent=2))
        return 0

    matn = sys.stdin.read() if a.stdin else a.text
    if not matn:
        raise SystemExit("متنِ پیام خالی است")

    resul = befrest(d, matn, wait=a.wait, priority=a.priority, envelope=not a.no_envelope,
                    from_name=a.from_name)
    print(json.dumps(resul, ensure_ascii=False, indent=2))
    return code_khoruj(resul.get("verdict", "not_sent"))


if __name__ == "__main__":
    sys.exit(main())
