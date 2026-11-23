#!/usr/bin/env python3
"""آزمونِ فرستندهٔ پیامِ بین‌سشنی بدونِ مدل (`Doc/abzar/peer_send.py`).

چه چیزی سنجیده می‌شود:
  ۱ یکسان‌سازیِ نام: «مجری-۲۰۳-ای مک» (واژهٔ اسکریپتِ ۲۰۳) ⟷ «مجری-۲۰۳- ایمک» (نامِ واقعی)
  ۲ پیدا کردنِ سشن فقط با نامِ دقیق/یکسان‌شده، نه با پوشه و نه با زیررشته
  ۳ گواهیِ تحویل از دفترِ همان سشن (پیدا شد / نشد)
  ۴ چهار حکم و کدِ خروجِ آن‌ها

اجرا: python3 Doc/abzar/test_peer_send.py
خرابکاری: (الف) `_norm` را به `return s` برگردان ⇒ آزمونِ ۱ قرمز.
          (ب) در `dar_tarikhche` جست‌وجو را بردار ⇒ آزمونِ ۳ قرمز.
          (ج) در `hokm` شرطِ refused را جابه‌جا کن ⇒ آزمونِ ۴ قرمز.
"""
import importlib.util
import json
import os
import pathlib
import sys
import tempfile

# تلهٔ سنجیده‌شده (۲۳ نوامبر ۲۰۲۶): `cp` فایل را با همان اندازه و ثانیه برمی‌گرداند و
# پایتون `.pyc` کهنه را تازه می‌پندارد ⇒ آزمون سبزِ دروغ روی کدِ خراب. پس هرگز pyc نه.
sys.dont_write_bytecode = True

RISHE = pathlib.Path(__file__).resolve().parents[2]

TMP = tempfile.mkdtemp()
SESS = pathlib.Path(TMP) / "sessions"
PROJ = pathlib.Path(TMP) / "projects" / "-tmp-x"
SESS.mkdir(parents=True)
PROJ.mkdir(parents=True)

for pid, nom, sid in ((os.getpid(), "مجری-۲۰۳- ایمک", "sid-203"),
                      (os.getppid(), "ناظر-۱۳۶", "sid-nazer")):
    (SESS / ("%d.json" % pid)).write_text(json.dumps({
        "pid": pid, "sessionId": sid, "name": nom, "cwd": "/tmp/x",
        "messagingSocketPath": "/tmp/cc-socks/%d.sock" % pid, "status": "idle"}))
    (PROJ / ("%s.jsonl" % sid)).write_text("")

os.environ["PEER_SESSIONS_DIR"] = str(SESS)
os.environ["PEER_PROJECTS_DIR"] = str(pathlib.Path(TMP) / "projects")

spec = importlib.util.spec_from_file_location("peer_send", RISHE / "Doc/abzar/peer_send.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def main() -> int:
    bad = 0

    def check(nom, got, want):
        nonlocal bad
        ok = got == want
        bad += not ok
        print(("%s %s: %r (انتظار %r)" % ("PASS" if ok else "FAIL", nom, got, want)))

    # ۱ یکسان‌سازی
    check("۱ نامِ اسکریپتِ ۲۰۳", m._norm("مجری-۲۰۳-ای مک"), m._norm("مجری-۲۰۳- ایمک"))
    check("۱ دو نامِ متفاوت یکی نشوند", m._norm("مجری-۱۳۶") == m._norm("ناظر-۱۳۶"), False)

    # ۲ پیدا کردن
    check("۲ نامِ عیناً", m.peyda_kon("ناظر-۱۳۶")["sessionId"], "sid-nazer")
    check("۲ نامِ یکسان‌شده", m.peyda_kon("مجری-۲۰۳-ای مک")["sessionId"], "sid-203")
    for bad_name in ("مجری-۱۳۶", "۱۳۶", "/tmp"):
        try:
            m.peyda_kon(bad_name)
            got = "پیدا کرد"
        except SystemExit:
            got = "رد کرد"
        check("۲ «%s» ⇒" % bad_name, got, "رد کرد")

    # ۳ گواهیِ تحویل
    check("۳ هنوز ننشسته", m.dar_tarikhche("msg-abc", "sid-nazer"), False)
    with open(PROJ / "sid-nazer.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps({"msg_id": "msg-abc", "text": "سلام"}) + "\n")
    check("۳ نشست", m.dar_tarikhche("msg-abc", "sid-nazer"), True)
    check("۳ شناسهٔ دیگر نه", m.dar_tarikhche("msg-zzz", "sid-nazer"), False)

    # ۴ حکم و کدِ خروج
    check("۴ refused", m.hokm(["refused"], False), "refused")
    check("۴ refused حتی با تحویل", m.hokm(["refused"], True), "refused")
    check("۴ delivered", m.hokm([], True), "delivered")
    check("۴ held", m.hokm(["held"], False), "held")
    check("۴ unverified", m.hokm([], False), "unverified")
    check("۴ کد ۰ برای رسید", m.code_khoruj("delivered"), 0)
    check("۴ کد ۳ برای ننوشتن", m.code_khoruj("not_sent"), 3)
    check("۴ کد ۴ برای رد", m.code_khoruj("refused"), 4)
    # ایرادِ ناظر-۱۳۶ (۲۳ نوامبر ۲۳:۲۲): «نامعلوم» نباید مثلِ «رسید» باشد
    check("۵ کد ۵ برای رسیدِ تأییدنشده", m.code_khoruj("unverified"), 5)
    check("۵ کد ۰ برای در صف", m.code_khoruj("held"), 0)

    print("جمع:", "سبز" if not bad else "%d قرمز" % bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
