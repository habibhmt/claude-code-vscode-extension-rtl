# فورکِ DeepSeek Harness روی مک — راهِ درست و کجاهای اشتباه رفتیم

**تاریخ:** ۱۴ نوامبر ۲۰۲۶ · **پروژه:** ۱۳۶ · **نتیجه:** اپِ فورک ساخته شد، نصب شد و **پایدار اجرا می‌شود**.

این سند دو بخش دارد: اول **راهِ درست** که دفعهٔ بعد مستقیم برویم، بعد **فهرستِ اشتباه‌ها** با دلیلِ هر کدام.

---

## ۱) راهِ درست (از صفر تا اپِ اجراشده)

| # | قدم | فرمان / نکته |
|---|---|---|
| ۱ | فورک | `gh repo fork deepseek-ai/deepseek-harness --clone=false` |
| ۲ | کلون | `git clone https://github.com/<user>/deepseek-harness.git dsh-fork` (۳۸۲ مگابایت) |
| ۳ | Node 24 | `export PATH="$HOME/.nvm/versions/node/v24.22.3/bin:$PATH"` — مخزن `>=24.9` می‌خواهد |
| ۴ | pnpm | `corepack enable && corepack prepare pnpm@11.28.5 --activate` |
| ۵ | نصب | `pnpm install --frozen-lockfile` (۲۸ ثانیه) |
| ۶ | بیلد | `DSH_GATE_CONCURRENCY=1 pnpm run build` (۴.۵ دقیقه، ۱۰/۱۰ سبز) — با ۱۶ گیگ رم سری بزن |
| ۷ | بسته | `pnpm run package:desktop:mac:arm64:unsigned` → DMG در `apps/desktop/.desktop-build/targets/mac-arm64/unsigned-artifacts/` |
| ۸ | نصب | DMG را باز کن، `DeepSeek Harness.app` را به `/Applications/DeepSeek Harness (fork).app` کپی کن |
| ۹ | **امضا** | با گواهیِ **self-signedِ موردِ اعتماد**، نه ad-hoc و نه Apple Development — جزئیاتِ پایین |
| ۱۰ | اجرا | `open -a "/Applications/DeepSeek Harness (fork).app"` |

### امضای درست (قلبِ ماجرا)

```zsh
ID=$(security find-identity -v -p codesigning | awk '/Local Signing/ && !/REVOKED/ {print $2; exit}')
A="/Applications/DeepSeek Harness (fork).app"

# ۱) کمکی‌ها — با حقِ disable-library-validation
for f in "$A/Contents/Frameworks/"*.app; do
  codesign --force --sign "$ID" --options runtime --entitlements /tmp/helper-ent.plist "$f"
done

# ۲) فریمورک‌ها
for f in "$A/Contents/Frameworks/"*.framework; do
  codesign --force --sign "$ID" --options runtime "$f"
done

# ۳) dylibها
find "$A/Contents/Frameworks" -type f \( -name "*.dylib" -o -name "*.so" \) \
  | while read -r f; do codesign --force --sign "$ID" --options runtime "$f"; done

# ۴) آخر از همه، خودِ اپ
codesign --force --sign "$ID" --options runtime --entitlements /tmp/ent.plist "$A"
codesign --verify --deep --strict "$A"
```

`/tmp/helper-ent.plist` و `/tmp/ent.plist` هر دو باید این چهار حق را داشته باشند:

```xml
<key>com.apple.security.cs.allow-jit</key><true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
<key>com.apple.security.cs.disable-library-validation</key><true/>
<key>com.apple.security.device.audio-input</key><true/>
```

**چرا self-signed و نه Apple Development؟** روی مکِ ۲۶.۷.۱ آزمودیم: امضای ad-hoc با `AMFI -423` رد می‌شود، امضای Apple Development با `spctl: rejected` رد می‌شود، ولی گواهیِ self-signed که در Keychain برای «Code Signing» **موردِ اعتماد** است، پذیرفته می‌شود. گواهیِ `VoiceClip Local Signing` روی همین مک از قبل چنین وضعی داشت.

**چرا کمکی‌ها حقِ جدا می‌خواهند؟** بدونِ `disable-library-validation`، رندرر با این خطا کرش می‌کند:

> `Library not loaded: Electron Framework` — `mapping process and mapped file (non-platform) have different Team IDs`

---

## ۲) کجاها اشتباه کردم

| # | اشتباه | چرا اشتباه بود | راهِ درست |
|---|---|---|---|
| ۱ | **«مک جلوی اجرا را می‌گیرد» را زود باور کردم** | اپ با **کدِ خروجِ ۰** بسته می‌شد؛ یعنی خودش خارج می‌شد، نه اینکه سیستم بکشدش. اگر سیستم می‌کشت، سیگنال می‌دیدیم | اول **لاگِ خودِ اپ** را بخوان: `~/Library/Logs/DeepSeek Harness/crash-*.log` و `~/Library/Logs/DiagnosticReports/*.ips`. همان‌جا خطای دقیق بود |
| ۲ | **گفتم «notarization لازم است» و هدف را blocked کردم** | notarization فقط برای **پخش** لازم است؛ برای اجرای محلی، گواهیِ self-signedِ موردِ اعتماد کافی بود | قبل از اعلامِ بن‌بست، هر سه راهِ امضا را تا آخر بیازما: ad-hoc، Apple Development، self-signedِ trusted |
| ۳ | **`--deep` را کافی دانستم** | `--deep` منسوخ است و اپ‌های کمکی و بعضی dylibها را نمی‌گیرد | امضای **درون‌به‌بیرون**: کمکی‌ها ← فریمورک‌ها ← dylibها ← اپ |
| ۴ | **حقِ کمکی‌ها را فراموش کردم** | اپ بالا می‌آمد ولی رندرر کرش می‌کرد؛ خطا هم «different Team IDs» بود که گمراه‌کننده است | همان چهار حقِ اپِ اصلی را به کمکی‌ها هم بده |
| ۵ | **دنبالِ هشِ یکپارچگیِ asar رفتم** | هشِ `ElectronAsarIntegrity` در **اپِ رسمی هم** با هشِ فایل نمی‌خواند؛ یعنی طبیعی است | این را به‌عنوانِ علتِ احتمالی کنار بگذار؛ اتلافِ وقت است |
| ۶ | **قفلِ تک‌نمونه را متهم کردم** | با عوض‌کردنِ نامِ بسته در `extraMetadata`، پوشهٔ دادهٔ اپ جدا می‌شود (`@deepseek-ai/dsh-desktop-fork`) و قفل هم جدا | نامِ بسته را از اول عوض کن؛ بعد قفل اصلاً موضوع نمی‌شود |
| ۷ | **`ELECTRON_RUN_AS_NODE=1` در شل مانده بود** | باعث شد Electron به‌جای اپ، مثلِ Node اجرا شود و خطای `does not provide an export named 'BrowserWindow'` بدهد | با `env -u ELECTRON_RUN_AS_NODE` اجرا کن |
| ۸ | **`productName` را عوض کردم** | اسکریپتِ smoke خودِ مخزن نامِ `DeepSeek Harness.app` را هاردکد دارد و بیلد شکست | فقط `extraMetadata.name` را عوض کن، `productName` را دست نزن |
| ۹ | **چند بار «سنجیدم» گفتم بدونِ اینکه واقعاً چیزی را که کاربر می‌بیند بسنجم** | نصب و امضا را می‌سنجیدم، ولی اجرا را نه | معیارِ موفقیت = **پروسه زنده بماند + پنجره باز شود + کرشِ تازه نباشد** |

---

## ۳) نشانه‌های تشخیصی که باید اول می‌دیدم

| نشانه | معنی |
|---|---|
| `exit=0` بدونِ هیچ خروجی | اپ **خودش** خارج شده؛ سیستم نکشته. دنبالِ لاگِ خودِ اپ برو |
| `amfid: ... Code=-423 "adhoc signed"` | امضا پذیرفته نشد → گواهیِ trusted لازم است |
| `spctl -a` → `rejected` | برای اجرای محلی هم مانع است |
| `crash-*.log` در `~/Library/Logs/DeepSeek Harness/` | خطای دقیقِ رندرر همین‌جاست |
| `different Team IDs` | کمکی‌ها حقِ `disable-library-validation` ندارند |
| `bad option: --remote-debugging-port` | `ELECTRON_RUN_AS_NODE` در محیط مانده |

---

## ۴) ابزارِ آماده

`abzar/dsh-fork.sh` با دستورهای `build` / `package` / `install` / `all` / `web` / `status`.
دستورِ `install` خودش با گواهیِ self-signedِ موردِ اعتماد و با حقِ کمکی‌ها امضا می‌کند.

**نکتهٔ مهم:** اپِ فورک و اپِ رسمی می‌توانند هم‌زمان باز باشند، چون نامِ بستهٔ فورک `@deepseek-ai/dsh-desktop-fork` است و پوشهٔ داده‌اش جداست. چت‌ها و افزونه‌ها در `~/.dsh` مشترک‌اند.
