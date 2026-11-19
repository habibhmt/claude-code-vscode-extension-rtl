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
run "claude ask width" node test_claude_ask_width.cjs
run "claude tanzimat" env NODE_PATH=node_modules node test_claude_tanzimat.cjs

# Root tests that were outside the old chain.
run "claude fekr shenavar" env NODE_PATH=node_modules node test_claude_fekr_shenavar.cjs
run "claude navar" env NODE_PATH=node_modules node test_claude_navar.cjs
run "claude tik ha" env NODE_PATH=node_modules node test_claude_tik_ha.cjs
run "codex tanzimat" env NODE_PATH=node_modules node test_codex_tanzimat.cjs
run "reset ha" node test_reset_ha.mjs

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
