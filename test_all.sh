#!/bin/bash
# Run every test, even after a failure, then exit non-zero if any failed.
# The old `&&` chain stopped at the first red, so later tests were never seen.
set -u
cd "$(dirname "$0")"

pass=0
skip=0
fail=0
failed=()
skipped=()

run() {
  local name="$1"
  shift
  printf '\n=== %s ===\n' "$name"
  "$@"
  local rc=$?
  if [ "$rc" -eq 0 ]; then
    pass=$((pass + 1))
  elif [ "$rc" -eq 77 ]; then
    skip=$((skip + 1))
    skipped+=("$name")
  else
    fail=$((fail + 1))
    failed+=("$name")
  fi
}

run "wezterm" node --no-warnings --experimental-strip-types mods/rtl-wezterm/test_rtl_wezterm.mjs
run "chatgpt patch" python3 test_chatgpt_patch.py
run "chatgpt folder patch" python3 test_chatgpt_folder_patch.py
run "chatgpt folder filter" node test_chatgpt_folder_filter.cjs
run "chatgpt folder query" node test_chatgpt_folder_query.cjs
run "chatgpt folder query new" node test_chatgpt_folder_query_new.cjs
run "chatgpt history click" node test_chatgpt_history_click.cjs
run "chatgpt panel state" node test_chatgpt_panel_state.cjs
run "chatgpt font spacing" node test_chatgpt_font_spacing.cjs
run "chatgpt header" node test_chatgpt_header.cjs
run "chatgpt layout" node test_chatgpt_layout.cjs
run "chatgpt tabs" env NODE_PATH=node_modules node test_chatgpt_tabs.cjs
run "chatgpt tabs memory" env TABS_ROUTER=memory NODE_PATH=node_modules node test_chatgpt_tabs.cjs
run "claude top buttons" node test_claude_top_buttons.cjs
run "ja button" node test_ja_dokme.cjs
run "claude stamp" node test_claude_stamp.cjs
run "claude hooks in chat" node test_claude_hooks_in_chat.cjs
run "claude hads order" node test_claude_hads_tartib.cjs
run "claude translation" env NODE_PATH=node_modules node test_claude_tarjome.cjs
run "claude plugin prompt" node test_claude_plugin_prompt.cjs
run "claude top wait" env NODE_PATH=node_modules node test_claude_top_wait.cjs
run "claude ask visible" node test_claude_ask_visible.cjs
run "claude amar" node test_claude_amar.cjs
run "claude code rangi" env NODE_PATH=node_modules node test_claude_code_rangi.cjs
run "claude code ink" node test_claude_code_ink.cjs
run "claude hover open" env NODE_PATH=node_modules node test_claude_hover_baz.cjs
run "hover farsi" node Doc/abzar/test_hover_farsi.cjs
run "claude hover khattire" env NODE_PATH=node_modules node Doc/abzar/test_hover_khattire.cjs
run "payam bine seshni" env PYTHONDONTWRITEBYTECODE=1 python3 Doc/abzar/test_peer_send.py
run "claude ask width" node test_claude_ask_width.cjs
run "claude tanzimat" env NODE_PATH=node_modules node test_claude_tanzimat.cjs
run "usage xss" env NODE_PATH=node_modules node test_usage_xss.cjs
run "usage snap" node test_usage_snap.cjs
run "usage compact" env NODE_PATH=node_modules node test_usage_compact.cjs

# Root tests that were outside the old chain.
run "claude fekr shenavar" env NODE_PATH=node_modules node test_claude_fekr_shenavar.cjs
run "claude navar" env NODE_PATH=node_modules node test_claude_navar.cjs
run "claude tik ha" env NODE_PATH=node_modules node test_claude_tik_ha.cjs
run "codex tanzimat" env NODE_PATH=node_modules node test_codex_tanzimat.cjs
run "reset ha" node test_reset_ha.mjs
run "nam kohne" python3 Doc/abzar/chek_nam_kohne.py
run "service ha" python3 Doc/abzar/chek_service_ha.py
run "rename gate" bash Doc/abzar/rename_ba_check.sh --selftest
# پیامِ ناظر-۱۳۶ ۲۴ نوامبر ۱۸:۲۴ (تاییدِ حبیب): سازنده‌ها پیش از چکر، وگرنه
# «بلوک اضافه شد، جدول ساخته نشد» چکر را قرمزِ گمراه‌کننده می‌کند (دو بار در دو روز).
# تلهٔ شمارشِ پروسه: grep روی ps پوسته‌ها را هم می‌شمارد؛ برای شمردنِ آزمون از pgrep -f استفاده کن.
run "shenasname saz" python3 Doc/abzar/jadval_motaghayer.py
run "barge saz" python3 abzar/barge_saz.py
run "motaghayer" python3 Doc/abzar/chek_motaghayer.py
run "tatbigh" python3 Doc/abzar/tatbigh_opencode.py
# تعریف ۴۹: گیتِ سخت روی دو شمارنده‌ای که بسته شدند (بی‌صاحب · بی‌provider) — اگر
# برگردند قرمزِ درست. بی‌قیمت و بی‌usage بدهیِ بازند و فقط گزارش می‌شوند تا قرمزِ
# همیشگی/سکوتِ همیشگی هیچ‌کدام پیش نیاید (ایرادِ ۷ ناظر-۱۳۶، ۲۵ نوامبر).
run "log kamel" python3 Doc/abzar/chek_log_kamel.py --az 2026-11-25T02:20:00Z --gate بی_صاحب,بی_provider
# «حدس کنسل شد» (حبیب ۲۵ نوامبر ۰۵:۵۴): هیچ عددِ دلاریِ تخمینی در تعریف‌ها نماند.
run "takhmin" python3 Doc/abzar/chek_takhmin.py
run "remembr cache" python3 Doc/abzar/test_remembr_cache.py
run "shomare yekta" python3 Doc/abzar/chek_shomare.py
run "ide nasb" bash test_ide_nasb.sh

printf '\n=== SUMMARY: %d passed, %d skipped, %d failed ===\n' "$pass" "$skip" "$fail"
if [ "${#skipped[@]}" -gt 0 ]; then
  for name in "${skipped[@]}"; do
    printf 'SKIPPED: %s\n' "$name"
  done
fi
if [ "${#failed[@]}" -gt 0 ]; then
  for name in "${failed[@]}"; do
    printf 'FAILED: %s\n' "$name"
  done
fi
[ "$fail" -eq 0 ]
