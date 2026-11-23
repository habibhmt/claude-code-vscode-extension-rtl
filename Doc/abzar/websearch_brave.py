#!/usr/bin/env python3
"""جست‌وجوی وب با Brave — کلید از Keychain، هیچ‌جا چاپ نمی‌شود.

چرا: ابزارِ WebSearchِ کلود کد فقط با کلیدِ Anthropic کار می‌کند (جست‌وجو سمتِ سرورِ Anthropic
انجام می‌شود، `web_search_20250305`)؛ روی دروازهٔ OpenRouter چیزی جز متنِ مدل برنمی‌گرداند.
این اسکریپت همان کار را مستقیم با Brave می‌کند.

اجرا:  python3 Doc/abzar/websearch_brave.py "پرسش" [تعداد]
"""
import json
import subprocess
import sys
import urllib.parse

SVC = "ramz-web:api.search.brave.com"


def kilid():
    r = subprocess.run(["security", "find-generic-password", "-s", SVC, "-w"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("کلیدِ Brave در Keychain نیست: " + r.stderr.strip()[:120])
    k = r.stdout.strip()
    if len(k) < 20:
        sys.exit(f"کلیدِ Brave نامعتبر است (طول {len(k)})")
    return k


def jostojo(porsesh, tedad=8):
    url = "https://api.search.brave.com/res/v1/web/search?" + urllib.parse.urlencode(
        {"q": porsesh, "count": tedad})
    r = subprocess.run(["curl", "-s", "-H", f"X-Subscription-Token: {kilid()}",
                        "-H", "Accept: application/json", url],
                       capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
    except Exception:
        sys.exit("پاسخِ Brave خوانده نشد: " + r.stdout[:200])
    if "error" in d:
        sys.exit("Brave: " + json.dumps(d["error"], ensure_ascii=False)[:200])
    out = []
    for w in ((d.get("web") or {}).get("results") or []):
        out.append({"title": w.get("title"), "url": w.get("url"),
                    "description": w.get("description"), "age": w.get("age")})
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    tedad = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    for i, w in enumerate(jostojo(sys.argv[1], tedad), 1):
        print(f"{i}. {w['title']}\n   {w['url']}  {('· ' + w['age']) if w['age'] else ''}")
        if w["description"]:
            print("   " + w["description"][:220].replace("\n", " "))


if __name__ == "__main__":
    main()
