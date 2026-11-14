#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
اسکرپرِ مدل‌های دیپ‌سیک در OpenRouter
-------------------------------------
دو چیز را از OpenRouter درمی‌آورد و رتبه می‌دهد:
  ۱) کیفیتِ تحویل (quantization + uptime + service_tier)
  ۲) تخفیف (pricing.discount) که همان «off» است

خروجی:
  khoroji/snapshot.json   دادهٔ خامِ نرمال‌شده
  khoroji/gozresh.md      گزارشِ فارسی
  khoroji/pishnehad.json  مدل/ارائه‌دهندهٔ پیشنهادی + payload آمادهٔ provider

بدونِ وابستگیِ بیرونی؛ فقط کتابخانهٔ استانداردِ پایتون.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE = "https://openrouter.ai/api/v1"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) DeepSeekScreener/1.0"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(HERE, ".cache")
OUT_DIR = os.path.join(HERE, "khoroji")
CACHE_TTL = 600  # ثانیه

FOCUS_DEFAULT = "deepseek/deepseek-v4.1-flash-1017"

# رتبهٔ دقتِ وزن‌ها: هرچه بالاتر، کیفیتِ تحویلِ بالاتر.
PRECISION = {
    "fp32": 100, "bf16": 97, "fp16": 95,
    "fp8": 88,
    "int8": 74, "nvfp4": 74,
    "fp4": 58, "mxfp4": 52,
    "unknown": 62,  # اعلام‌نشده ⇒ نه بهترین، نه بدترین
}
PRECISION_FA = {
    "fp32": "fp32 (کامل)", "bf16": "bf16 (کامل)", "fp16": "fp16 (کامل)",
    "fp8": "fp8", "int8": "int8", "nvfp4": "nvfp4",
    "fp4": "fp4 (سبک‌شده)", "mxfp4": "mxfp4 (سبک‌شده)",
    "unknown": "نامعلوم",
}
TIER_BONUS = {"priority": 4, "ultrafast": 2, "flex": -4, None: 0, "None": 0}


# ---------------------------------------------------------------- HTTP + cache
def _cache_path(url: str) -> str:
    import hashlib
    return os.path.join(CACHE_DIR, hashlib.sha1(url.encode()).hexdigest() + ".json")


def fetch_json(url: str, fresh: bool = False, retries: int = 3):
    os.makedirs(CACHE_DIR, exist_ok=True)
    cp = _cache_path(url)
    if not fresh and os.path.exists(cp):
        try:
            blob = json.load(open(cp, encoding="utf-8"))
            if time.time() - blob.get("_ts", 0) < CACHE_TTL:
                return blob["data"]
        except Exception:
            pass
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.load(r)
            json.dump({"_ts": time.time(), "data": data}, open(cp, "w", encoding="utf-8"))
            return data
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 + 2 * attempt)
                continue
            raise
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 + attempt)
    raise RuntimeError(f"دریافت {url} ناموفق ماند: {last}")


# ---------------------------------------------------------------------- بناء
def collect(fresh: bool = False):
    models = fetch_json(f"{BASE}/models", fresh=fresh)["data"]
    provs = fetch_json(f"{BASE}/providers", fresh=fresh)["data"]
    slug_of = {p["name"]: p["slug"] for p in provs if p.get("name") and p.get("slug")}

    ds = [m for m in models if m["id"].startswith("deepseek/")]
    out = {}
    for i, m in enumerate(sorted(ds, key=lambda x: x["id"])):
        mid = m["id"]
        try:
            ep = fetch_json(f"{BASE}/models/{mid}/endpoints", fresh=fresh)["data"]
        except Exception as e:  # noqa: BLE001
            print(f"  ! {mid}: {e}", file=sys.stderr)
            continue
        out[mid] = {"model": m, "endpoints": ep.get("endpoints", [])}
        print(f"  ✓ {mid}  ({len(ep.get('endpoints', []))} ارائه‌دهنده)", file=sys.stderr)
        if i:
            time.sleep(0.15)
    return out, slug_of


def num(x, default=0.0):
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def score_endpoint(e: dict, slug: str) -> dict:
    pr = e.get("pricing") or {}
    q = str(e.get("quantization") or "unknown").lower()
    uptime = e.get("uptime_last_30m")
    uptime_val = 60.0 if uptime is None else num(uptime, 60.0)
    tier = e.get("service_tier")

    quality = 0.72 * PRECISION.get(q, 62) + 0.28 * uptime_val + TIER_BONUS.get(tier, 0)
    quality = max(0.0, min(100.0, quality))

    discount = num(pr.get("discount"))
    if discount > 1:
        discount = discount / 100.0
    discount = max(0.0, min(0.99, discount))
    price_in = num(pr.get("prompt"))
    price_out = num(pr.get("completion"))
    cache_read = num(pr.get("input_cache_read"))
    listed_in = price_in / (1 - discount) if discount > 0 else price_in
    listed_out = price_out / (1 - discount) if discount > 0 else price_out

    balanced = 0.55 * (quality / 100.0) + 0.45 * discount

    return {
        "model": e.get("model_id"),
        "provider": e.get("provider_name"),
        "slug": slug,
        "quantization": q,
        "service_tier": tier,
        "uptime": None if uptime is None else round(num(uptime), 2),
        "status": e.get("status"),
        "quality": round(quality, 2),
        "discount_pct": round(discount * 100, 2),
        "price_in": price_in, "price_out": price_out, "cache_read": cache_read,
        "listed_in": round(listed_in, 12), "listed_out": round(listed_out, 12),
        "price_in_1m": round(price_in * 1e6, 4),
        "price_out_1m": round(price_out * 1e6, 4),
        "listed_in_1m": round(listed_in * 1e6, 4),
        "listed_out_1m": round(listed_out * 1e6, 4),
        "balanced": round(balanced, 4),
        "usable": (e.get("status") in (0, None)),
        "max_completion": e.get("max_completion_tokens"),
    }


def provider_payload(row: dict) -> dict:
    """قطعهٔ آمادهٔ provider برای درخواستِ OpenRouter."""
    payload = {"order": [row["slug"]], "allow_fallbacks": True}
    if row["quantization"] != "unknown":
        payload["quantizations"] = [row["quantization"]]
    return payload


def analyze(data: dict, slug_of: dict):
    result = {}
    for mid, v in data.items():
        rows = []
        for e in v["endpoints"]:
            name = e.get("provider_name") or "?"
            rows.append(score_endpoint(e, slug_of.get(name, name.lower().replace(" ", "-"))))
        seen, uniq = set(), []
        for r in rows:
            k = (r["provider"], r["quantization"], r["price_in"], r["price_out"], r["service_tier"])
            if k in seen:
                continue
            seen.add(k)
            uniq.append(r)
        rows = uniq
        usable = [r for r in rows if r["usable"]]
        by_quality = sorted(usable, key=lambda r: (-r["quality"], -r["discount_pct"], r["price_in"]))
        by_off = sorted(usable, key=lambda r: (-r["discount_pct"], -r["quality"], r["price_in"]))
        by_balanced = sorted(usable, key=lambda r: (-r["balanced"], r["price_in"]))
        by_price = sorted(usable, key=lambda r: (r["price_in"] + r["price_out"], -r["quality"]))
        result[mid] = {
            "name": v["model"].get("name"),
            "context": v["model"].get("context_length"),
            "created": v["model"].get("created"),
            "batch": mid.endswith(":batch"),
            "endpoints": rows,
            "count": len(rows),
            "best_quality": by_quality[0] if by_quality else None,
            "best_off": by_off[0] if by_off else None,
            "best_balanced": by_balanced[0] if by_balanced else None,
            "cheapest": by_price[0] if by_price else None,
        }
    return result


# ------------------------------------------------------------------- گزارش
def fa_num(x):
    if x is None:
        return "—"
    if isinstance(x, float):
        s = f"{x:,.2f}".rstrip("0").rstrip(".")
        return s
    return f"{x:,}"


def table(rows, cols):
    head = "| " + " | ".join(c[1] for c in cols) + " |"
    sep = "|" + "|".join("---" for _ in cols) + "|"
    body = []
    for r in rows:
        body.append("| " + " | ".join(str(c[2](r)) for c in cols) + " |")
    return "\n".join([head, sep] + body)


def fmt_row(r):
    up = "—" if r["uptime"] is None else f'{r["uptime"]:.0f}%'
    off = f'{r["discount_pct"]:.0f}%' if r["discount_pct"] > 0 else "—"
    return {
        "provider": r["provider"],
        "quant": PRECISION_FA.get(r["quantization"], r["quantization"]),
        "tier": r["service_tier"] or "—",
        "quality": f'{r["quality"]:.1f}',
        "off": off,
        "pin": fa_num(r["price_in_1m"]), "pout": fa_num(r["price_out_1m"]),
        "lin": fa_num(r["listed_in_1m"]),
        "uptime": up,
        "status": "سالم" if r["usable"] else f'خراب ({r["status"]})',
    }


COLS = [
    ("provider", "ارائه‌دهنده", lambda r: f'**{fmt_row(r)["provider"]}**'),
    ("quant", "دقت", lambda r: fmt_row(r)["quant"]),
    ("quality", "کیفیت", lambda r: fmt_row(r)["quality"]),
    ("off", "off", lambda r: fmt_row(r)["off"]),
    ("pin", "ورودی $/M", lambda r: fmt_row(r)["pin"]),
    ("pout", "خروجی $/M", lambda r: fmt_row(r)["pout"]),
    ("lin", "قیمتِ اعلامی ورودی", lambda r: fmt_row(r)["lin"]),
    ("uptime", "آپ‌تایم", lambda r: fmt_row(r)["uptime"]),
    ("status", "وضعیت", lambda r: fmt_row(r)["status"]),
]


def build_report(res, focus, top, now):
    lines = []
    add = lines.append
    add("# گزارشِ مدل‌های دیپ‌سیک در OpenRouter")
    add("")
    add(f"- زمانِ سنجش: `{now}`")
    add(f"- مدلِ فوکوس: `{focus}`")
    add("- منبع: `openrouter.ai/api/v1/models` + `/providers` + `/endpoints`")
    add("")

    total_ep = sum(v["count"] for v in res.values())
    with_off = sum(1 for v in res.values() for r in v["endpoints"] if r["discount_pct"] > 0)
    add("## خلاصه")
    add("")
    add(f"- {len(res)} مدل، {total_ep} ارائه‌دهنده، {with_off} ارائه‌دهنده با تخفیف")
    add("- **کیفیت** = 0.72×دقتِ quantization + 0.28×آپ‌تایم + امتیازِ service_tier")
    add("- **off** = `pricing.discount`؛ قیمتِ API همان قیمتِ بعد از تخفیف است")
    add("- **قیمتِ اعلامی** = قیمتِ بعد از تخفیف ÷ (۱ − off)")
    add("")

    f = res.get(focus)
    if f:
        add(f"## مدلِ فوکوس — {f['name']}")
        add("")
        rows = sorted([r for r in f["endpoints"] if r["usable"]], key=lambda r: -r["quality"])[:top]
        add(table(rows, COLS))
        add("")
        add("### سه انتخابِ این مدل")
        add("")
        for label, key in (("بالاترین کیفیت", "best_quality"), ("بالاترین off", "best_off"),
                           ("بهترین توازن", "best_balanced"), ("ارزان‌ترین", "cheapest")):
            b = f[key]
            if not b:
                continue
            extra = f' — off {b["discount_pct"]:.0f}٪' if b["discount_pct"] else ""
            add(f'- **{label}:** {b["provider"]} ({b["quantization"]}) — کیفیت {b["quality"]:.1f}{extra}، '
                f'ورودی ${b["price_in_1m"]:.4f}/M')
        add("")

    add("## همهٔ مدل‌ها: بهترین کیفیت و بهترین off")
    add("")
    add("| مدل | بهترین کیفیت | بهترین off | ارزان‌ترین |")
    add("|---|---|---|---|")
    for mid, v in sorted(res.items(), key=lambda kv: kv[1]["created"] or 0, reverse=True):
        def cell(key):
            b = v[key]
            if not b:
                return "—"
            off = f' / off {b["discount_pct"]:.0f}٪' if b["discount_pct"] else ""
            return f'{b["provider"]} ({b["quantization"]}){off}'
        add(f'| `{mid}` | {cell("best_quality")} | {cell("best_off")} | {cell("cheapest")} |')
    add("")

    flat = [r for v in res.values() for r in v["endpoints"] if r["usable"]]
    if flat:
        add("## برنده‌های کلی (بینِ همهٔ مدل‌ها)")
        add("")
        for label, key in (("بالاترین کیفیت", lambda r: (-r["quality"], -r["discount_pct"])),
                           ("بالاترین off", lambda r: (-r["discount_pct"], -r["quality"])),
                           ("بهترین توازن", lambda r: (-r["balanced"],))):
            best = sorted(flat, key=key)[0]
            add(f'- **{label}:** `{best["model"]}` روی **{best["provider"]}** — '
                f'کیفیت {best["quality"]:.1f}، off {best["discount_pct"]:.0f}٪، '
                f'ورودی ${best["price_in_1m"]:.4f}/M (اعلامی ${best["listed_in_1m"]:.4f})')
        add("")

    add("## چطور ست کنیم")
    add("")
    add("مدلِ پیشنهادی همان اسلاگِ مدل است؛ برای قفل‌کردن روی یک ارائه‌دهندهٔ خاص، "
        "این قطعه را به بدنهٔ درخواستِ OpenRouter اضافه کن:")
    add("")
    add("```json")
    f = res.get(focus) or {}
    bq, bo = f.get("best_quality"), f.get("best_off")
    if bq:
        add(json.dumps({"model": focus, "provider": provider_payload(bq)}, ensure_ascii=False, indent=2))
    add("```")
    if bq and bo:
        add("")
        add(f"یا برای تخفیفِ بیشتر (به‌جای بالاترین کیفیت): `provider.order = [\"{bo['slug']}\"]` "
            f"با off {bo['discount_pct']:.0f}٪ و ورودی ${bo['price_in_1m']:.4f}/M")
    add("")
    add("و در DSH، زیرِ `providers.openrouter.models` در `~/.dsh/profiles/*/cordis.patch.yml`:")
    add("")
    add("```yaml")
    add("        models:")
    add(f"          - id: {focus}")
    add("            name: DeepSeek (اسکرین‌شده)")
    add("```")
    add("")
    add("اگر همین مدل را با پسوندِ preset می‌خواهی (مثلِ تنظیمِ فعلی):")
    add("")
    add("```yaml")
    add(f"          - id: {focus}@preset/cheap-deepseek")
    add("```")
    add("")
    return "\n".join(lines)


def build_snapshot(res, focus, now):
    flat = [r for v in res.values() for r in v["endpoints"] if r["usable"]]
    best_quality = max(flat, key=lambda r: (r["quality"], r["discount_pct"])) if flat else None
    best_off = max(flat, key=lambda r: (r["discount_pct"], r["quality"])) if flat else None
    best_balanced = max(flat, key=lambda r: r["balanced"]) if flat else None
    f = res.get(focus) or {}
    return {
        "zaman": now,
        "focus": focus,
        "majmoo": {"model": len(res), "endpoint": sum(v["count"] for v in res.values()),
                   "ba_off": sum(1 for r in flat if r["discount_pct"] > 0)},
        "bartar": {"keyfiat": best_quality, "off": best_off, "motavazen": best_balanced},
        "pishnehad": {
            "model": focus,
            "behtarin_keyfiat": f.get("best_quality"),
            "behtarin_off": f.get("best_off"),
            "behtarin_motavazen": f.get("best_balanced"),
            "provider_payload_quality": provider_payload(f["best_quality"]) if f.get("best_quality") else None,
            "provider_payload_off": provider_payload(f["best_off"]) if f.get("best_off") else None,
        },
        "model_ha": res,
    }


def print_console(res, focus, top):
    f = res.get(focus)
    print()
    print("=" * 78)
    print(f"مدلِ فوکوس: {focus}")
    print("=" * 78)
    if not f:
        print("مدلِ فوکوس در فهرست نبود.")
        return
    rows = sorted([r for r in f["endpoints"] if r["usable"]], key=lambda r: -r["quality"])[:top]
    print(f'{"ارائه‌دهنده":<18}{"دقت":<12}{"کیفیت":>7}{"off":>7}{"ورودی$/M":>11}{"آپ‌تایم":>9}')
    for r in rows:
        up = "—" if r["uptime"] is None else f'{r["uptime"]:.0f}%'
        print(f'{r["provider"]:<18}{r["quantization"]:<12}{r["quality"]:>7.1f}'
              f'{r["discount_pct"]:>6.0f}%{r["price_in_1m"]:>11.4f}{up:>9}')
    print()
    for label, key in (("بالاترین کیفیت", "best_quality"), ("بالاترین off", "best_off"),
                       ("بهترین توازن", "best_balanced"), ("ارزان‌ترین", "cheapest")):
        b = f.get(key)
        if b:
            print(f'  {label:<14} {b["provider"]:<18} کیفیت {b["quality"]:>5.1f}  '
                  f'off {b["discount_pct"]:>4.0f}%  ${b["price_in_1m"]:.4f}/M')


def main(argv=None):
    ap = argparse.ArgumentParser(description="اسکرپر و رتبه‌بندِ مدل‌های دیپ‌سیک در OpenRouter")
    ap.add_argument("--focus", default=FOCUS_DEFAULT, help=f"مدلِ فوکوس (پیش‌فرض: {FOCUS_DEFAULT})")
    ap.add_argument("--top", type=int, default=12, help="تعداد ردیفِ جدول (پیش‌فرض 12)")
    ap.add_argument("--fresh", action="store_true", help="بدونِ کش، تازه بگیر")
    ap.add_argument("--json-only", action="store_true", help="فقط JSON بنویس، چاپ نکن")
    args = ap.parse_args(argv)

    now = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M %Z")
    print("در حالِ گرفتنِ داده از OpenRouter...", file=sys.stderr)
    data, slug_of = collect(fresh=args.fresh)
    if not data:
        print("هیچ داده‌ای نیامد.", file=sys.stderr)
        return 1
    res = analyze(data, slug_of)

    os.makedirs(OUT_DIR, exist_ok=True)
    snap = build_snapshot(res, args.focus, now)
    with open(os.path.join(OUT_DIR, "snapshot.json"), "w", encoding="utf-8") as fh:
        json.dump(snap, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT_DIR, "pishnehad.json"), "w", encoding="utf-8") as fh:
        json.dump(snap["pishnehad"], fh, ensure_ascii=False, indent=1)
    report = build_report(res, args.focus, args.top, now)
    with open(os.path.join(OUT_DIR, "gozresh.md"), "w", encoding="utf-8") as fh:
        fh.write(report)

    if not args.json_only:
        print_console(res, args.focus, args.top)
        print()
        print(f"گزارش: {os.path.join(OUT_DIR, 'gozresh.md')}")
        print(f"داده:  {os.path.join(OUT_DIR, 'snapshot.json')}")
        print(f"پیشنهاد: {os.path.join(OUT_DIR, 'pishnehad.json')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
