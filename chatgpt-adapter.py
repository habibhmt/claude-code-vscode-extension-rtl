"""Build the shared settings UI against the installed ChatGPT DOM contract."""
import json
from pathlib import Path


def build_ui(repo, defaults):
    s = (repo / 'claude-ui-buttons.js').read_text()
    # No Claude host protocol, VS Code API interception or session assumptions.
    start = s.index('  // acquireVsCodeApi()')
    end = s.index("  window.addEventListener('error'", start)
    s = s[:start] + '  function porsidan_shenase_chat() {}\n  function neshan_shenase_chat() {}\n' + s[end:]
    start = s.index('  var DEFAULT_COMMANDS = [')
    end = s.index('\n  /* ---------------- settings', start)
    commands = [
        dict(label='ادامه', text='ادامه بده', side='right', send=False),
        dict(label='خلاصه', text='این گفتگو را خلاصه کن', side='right', send=False),
        dict(label='بررسی', text='تغییرات را بررسی کن و ایرادهای احتمالی را بگو', side='left', send=False),
        dict(label='توضیح', text='این بخش را به فارسی توضیح بده', side='left', send=False),
    ]
    s = s[:start] + '  var DEFAULT_COMMANDS = ' + json.dumps(commands, ensure_ascii=False) + ';\n' + s[end:]
    start = s.index("    // this chat's names")
    end = s.index('    // presets', start)
    s = s[:start] + s[end:]
    start = s.index("    tools.appendChild(sakht_dokme('sel'")
    end = s.index("    tools.appendChild(sakht_dokme(s.quoteMenu", start)
    s = s[:start] + s[end:]
    start = s.index("    toggles.appendChild(sakht_dokme(s.collapse")
    end = s.index("    toggles.appendChild(", start + 10)
    s = s[:start] + s[end:]
    s = s.replace('if (s.collapse) {', 'if (false) {').replace('    jam_kardan_fekr_va_abzar();', '')
    s = s.replace("    panel.appendChild(radif_andaze('حواشی', 'chrome', s, set));", '')
    s = s.replace("negahban_khata('glossary', vazhe_name_ru_kalame)();", '')
    s = s.replace('lines.concat(barabari_kadr_va_ayne(), gozaresh_khat_payam_jam())', 'lines.concat(gozaresh_khat_payam_jam())')
    # Scope the table mode to Codex; do not change Claude's shared implementation.
    s = s.replace("overflow-x:auto!important;white-space:nowrap!important}",
                  "overflow-x:auto!important;white-space:nowrap!important;min-width:0!important}")
    s = s.replace("    // Thinking / tool-call chatter", "    if (s.tableScroll) { out.push('[class*=\"messagesContainer_\"] table :is(th,td){white-space:nowrap!important}'); }\n    // Thinking / tool-call chatter")
    s = s.replace('  function emal_andaze_va_rang(s) {', '  function emal_andaze_va_rang(s) {\n    document.documentElement.dataset.crtlTableMode = s.tableScroll ? "scroll" : "free";')
    mappings = {
        '[class*="messagesContainer_"]': '.thread-scroll-container',
        '[class*="userMessage_"]': '[data-user-message-bubble]',
        '[class*="message_"]': '[data-content-search-unit-key]',
        '[class*="content_"]': ':is([class*="MarkdownContent"],.rich-text-user-turn)',
        '[class*="markdown"]': '[class*="MarkdownContent"]',
        '[class*="messageInputContainer_"]': '[data-composer-surface-variant]',
        '[class*="messageInput_"]': '[contenteditable="true"]',
    }
    for old, new in mappings.items():
        s = s.replace(old, new)
    s = s.replace("node.className.indexOf('userMessage_') !== -1", "node.matches('[data-user-message-bubble]')")
    s = s.replace("n.className.indexOf('userMessage_') !== -1", "!!n.querySelector('[data-user-message-bubble]') || n.matches('[data-user-message-bubble]')")
    # Only outer transcript units, never both a unit and its nested user bubble.
    s = s.replace("root.querySelectorAll('[data-content-search-unit-key],[data-user-message-bubble]')", "root.querySelectorAll('[data-content-search-unit-key]')")
    s = s.replace("'crtl-sizes'", "'chatgpt-rtl-sizes'")
    s = s.replace('~/.claude-rtl-sizes.json', '~/.chatgpt-rtl-sizes.json').replace('## کلود', '## ChatGPT')
    s = s.replace("return document.querySelector('[aria-label=\"Message input\"]')\n        || document.querySelector('textarea')\n        || document.querySelector('[contenteditable=\"true\"]');", "return document.querySelector('[data-composer-surface-variant] [contenteditable=\"true\"]') || document.querySelector('[contenteditable=\"true\"]') || document.querySelector('textarea:not(#crtl-panel textarea)');")
    # Settings supplied by the dedicated seed; Claude command lists aren't imported.
    tabs = (repo / 'chatgpt-tabs.js').read_text()
    return 'window.__CRTL_DEFAULTS=' + json.dumps(defaults, ensure_ascii=False) + ';\n' + s + '\n' + tabs
