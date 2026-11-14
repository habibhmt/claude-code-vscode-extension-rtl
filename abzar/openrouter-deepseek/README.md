# اسکرپرِ مدل‌های دیپ‌سیک در OpenRouter

این ابزار از API عمومیِ OpenRouter، همهٔ مدل‌های دیپ‌سیک و همهٔ ارائه‌دهنده‌هایشان را می‌گیرد و
دو چیز را رتبه می‌دهد:

1. **کیفیتِ تحویل** — از روی دقتِ `quantization`، آپ‌تایمِ ۳۰ دقیقهٔ اخیر و `service_tier`.
2. **off** — همان `pricing.discount` که OpenRouter کنارِ هر ارائه‌دهنده اعلام می‌کند.

هدف: همیشه بتوانیم مدلِ در حالِ استفاده را روی بهترین ترکیبِ «کیفیت + تخفیف» ست کنیم.

## اجرا

```bash
python3 abzar/openrouter-deepseek/scan.py                 # مدلِ فوکوسِ پیش‌فرض
python3 abzar/openrouter-deepseek/scan.py --fresh         # بدونِ کش، تازه
python3 abzar/openrouter-deepseek/scan.py --focus deepseek/deepseek-v4-flash-0731 --top 15
python3 abzar/openrouter-deepseek/scan.py --json-only     # فقط فایل، بدونِ چاپ
```

بدونِ وابستگیِ بیرونی؛ فقط کتابخانهٔ استانداردِ پایتون ۳.

## خروجی‌ها

| فایل | محتوا |
|---|---|
| `khoroji/gozresh.md` | گزارشِ فارسی: جدولِ مدلِ فوکوس، برندگانِ هر مدل، برندگانِ کلی، قطعهٔ ست‌کردن |
| `khoroji/snapshot.json` | همهٔ مدل‌ها و ارائه‌دهنده‌ها با امتیازها (۱۵۰KB حدود) |
| `khoroji/pishnehad.json` | فقط برندگانِ مدلِ فوکوس + payload آمادهٔ `provider` |

کش در `.cache/` است و ۱۰ دقیقه معتبر می‌ماند؛ `--fresh` دورش می‌زند.

## تعریفِ امتیازها

**کیفیت** = `0.72 × دقت + 0.28 × آپ‌تایم + امتیازِ tier`

| quantization | دقت |
|---|---|
| fp32 / bf16 / fp16 | ۱۰۰ / ۹۷ / ۹۵ |
| fp8 | ۸۸ |
| int8 / nvfp4 | ۷۴ |
| fp4 / mxfp4 | ۵۸ / ۵۲ |
| unknown (اعلام‌نشده) | ۶۲ |

- آپ‌تایمِ ناموجود ۶۰ گرفته می‌شود.
- tier: `priority` +۴، `ultrafast` +۲، `flex` −۴.
- ارائه‌دهنده‌های با `status` منفی (خراب/محدود) از برندگان حذف می‌شوند.

**off** = `pricing.discount × ۱۰۰`. بررسی شد که قیمتِ `pricing.prompt/completion` **قیمتِ بعد از تخفیف** است
(با `display_pricing` صفحه یکی است)؛ پس قیمتِ اعلامیِ ارائه‌دهنده = `قیمت ÷ (۱ − off)`.

**توازن** = `0.55 × (کیفیت/۱۰۰) + 0.45 × off`.

## ست‌کردن روی نتیجه

قطعهٔ `provider` را به بدنهٔ درخواستِ OpenRouter اضافه کن:

```json
{
  "model": "deepseek/deepseek-v4.1-flash-1017",
  "provider": {"order": ["stepfun"], "allow_fallbacks": true, "quantizations": ["fp8"]}
}
```

در DSH (`~/.dsh/profiles/*/cordis.patch.yml`) مدل زیرِ `providers.openrouter.models` می‌آید:

```yaml
        models:
          - id: deepseek/deepseek-v4.1-flash-1017
            name: DeepSeek (اسکرین‌شده)
```

## محدودیت‌ها (واقعیتِ داده، نه حدس)

- `throughput_last_30m` و `latency_last_30m` در API برای همهٔ اندپوینت‌های دیپ‌سیک `null` است؛
  پس در امتیاز نیامده‌اند.
- `quantization` برای ۵۶ اندپوینت از ۱۸۶ مورد `unknown` است؛ جریمهٔ سنگین ندارد ولی بهترین هم نیست.
- `discount` لحظه‌ای است و ممکن است فردا عوض شود؛ برای همین کش کوتاه است و `--fresh` دارد.
- نسخه‌های `:batch` جدا شمرده می‌شوند و ارزان‌ترند ولی برای کارِ تعاملی مناسب نیستند.
- خودِ API ملاک است؛ HTML صفحه فقط برای تأییدِ معنیِ `discount` یک‌بار خوانده شد.
