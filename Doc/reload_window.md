# Reload Window ِ یک پنجرهٔ VS Code از Bash (برای دیدنِ نسخهٔ تازهٔ پچ)

حبیب (۲۶ اکت ۲۳:۲۶، به ۲۰۳): «وقتی تو از وی اس کد میتونی این کار رو بکنی پس خود ۱۳۶ هم میتونی راهشو یاد بده خودش بزنه دستورالعملشش رو هم سیو کن»

دستورالعملِ کامل و به‌روز مالِ ۲۰۳ است: `/Users/habib/1-MY-WORK/203th-day-imac-cpu-tracker/doc/tarif/achar/15-reload-window.md`

| قدم | کار |
|---|---|
| ۱ | اجازهٔ حبیب پیش از هر موس/کیبورد: `…/203th-day-imac-cpu-tracker/doc/abzar/ejaze_computer_use.sh "۱۳۶" "Reload Window" 1` ⇐ فقط با «alan» ادامه |
| ۲ | پنجره جلو: `…/doc/abzar/tamiz.sh '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code' <پوشه>` و چک که پنجرهٔ جلو همان است |
| ۳ | **از منوی View** ⇐ «Command Palette…» (osascript) ⇐ «Developer: Reload Window» ⇐ `key code 36` |
| ⚠️ | **Cmd+Shift+P نزن**: کادرِ Claude آن را می‌گیرد و متن به‌عنوانِ پیام در چت می‌رود (۲۶ اکت ۲۳:۲۳) |
| ⚠️ | ریلودِ پنجرهٔ خودِ ۱۳۶ پروسهٔ همین چت را از نو بالا می‌آورد ⇐ آخرین قدمِ نوبت باشد |
| سنجش | خطِ «SessionStart:resume» در چت + `screencapture -x -o -l <CGWindowID>` وقتی پنجره جلو است (پنجرهٔ پشتی عکسِ کهنه می‌دهد) |
