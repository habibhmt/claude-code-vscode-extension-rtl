#!/bin/bash
# Definition 13: Persian language and the built-in plugins Habib asked to keep on
# («من میخوام همه اپشن ها روشن باشه»). Names, not a count: an eighth plugin he
# turns on later must not turn this red. Pass a copy of settings.json to test it.
F="${1:-$HOME/.claude/settings.json}"
fail=0
ok() { echo "PASS $1"; }
no() { echo "FAIL $1"; fail=1; }
[ "$(jq -r '.language // empty' "$F")" = "persian" ] && ok 'language = "persian"' || no 'language = "persian"'
for p in you-should-know sec-default plugin-authoring mods-guide responsive-mode diff claude-test; do
  [ "$(jq -r --arg k "cc-plugin-$p@builtin" '.enabledPlugins[$k] // false' "$F")" = "true" ] \
    && ok "cc-plugin-$p on" || no "cc-plugin-$p on"
done
[ $fail = 0 ] && echo "ALL PASS" || echo "FAILED"; exit $fail
