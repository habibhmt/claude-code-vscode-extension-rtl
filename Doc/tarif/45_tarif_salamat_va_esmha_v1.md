# تعریف ۴۵ — سلامت‌سنجیِ دوگانه و شش نام

حبیب ۲۴ نوامبر ۲۰۲۶ ۰۶:۴۸ · ناظر-۱۳۶: «`/v1/models` تنها کافی نیست».

## حکم

سالم‌بودنِ دروازه **دو** سنجش دارد و هر دو باید سبز باشند:
۱) `code_salamat_gateway` = **۲۰۰** روی `http://127.0.0.1:50990/v1/models`
۲) مسیرِ `claudeCode.claudeProcessWrapper` در تنظیمِ VS Code **و** Windsurf وجود دارد و `os.access(..., X_OK)` درست است.
سنجشِ اول حتی وقتی مسیرِ wrapper غلط است ۲۰۰ می‌دهد — و همان حالت سه بار چتِ VS Code را شکست.

**▪ باطل می‌شود اگر:** حبیب بگوید «چت باز نمی‌شود» ولی `/v1/models` سبز بود.
**فرمان:** `python3 Doc/abzar/restart_service.py --dry-run` ⇒ خطِ سلامت + دو خطِ wrapper با ✅/❌.
**خرابکاری:** در تنظیمِ VS Code مسیرِ wrapper را به یک فایلِ ناموجود بده ⇒ سنجشِ دوم باید ❌ بدهد، هرچند سنجشِ اول ۲۰۰ است.

## شش نام (ثبت‌شده — «بله»ی حبیب ۰۶:۴۸)

| اسم | معنی | جای به‌کارگیری در کد | مقدارِ فعلی |
|---|---|---|---|
| `masir_darvaze` | مسیرِ پوشهٔ دروازه | `Doc/abzar/chek_nam_kohne.py:22` | `abzar/darvaze` |
| `nam_kohne_ha` | نام‌های بازنشسته | `Doc/abzar/chek_nam_kohne.py:21` | `216-migration` · `186-montaghel` |
| `label_service_gateway` | نامِ سرویسِ دروازه | `Doc/abzar/restart_service.py:23` | `com.habib.opencode-gateway` |
| `ravesh_restart` | روشِ مجازِ ری‌استارت | `Doc/abzar/restart_service.py:25` | `enable` ⇒ `bootout` ⇒ `bootstrap` |
| `code_salamat_gateway` | کدِ سلامتِ دروازه | `Doc/abzar/restart_service.py:24` | `200` |
| `gozaresh_service_khabide` | فایلِ گزارشِ سرویس‌های خفته | `Doc/abzar/chek_service_ha.py:18` | `Doc/service_ha.md` |
