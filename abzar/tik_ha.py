#!/usr/bin/env python3
"""The «ابزارها» ticks: which built-in tools, MCPs, plugins and skills a new chat gets.

Habib, 16 Nov 2026: «توی Aa ... برای ام سی پی و پلاگین و اسکیل و ابزارهای خود اپ» — a tick list per new chat,
one list shared by Claude Code and DSH, three levels like the «تنظیمات کلود» tab: «این چت-این پوشه -سراسری».
Confirmed with Habib (yes/no, same day):
  · a separate tab in Aa; it opens by itself on every new chat;
  · a tick changes only new chats (an old open chat keeps what it started with);
  · «این چت» = only this new chat; «این پوشه» = this chat and every later new chat of the folder;
    «سراسری» (with a popup) = folders that have no list of their own yet; a folder's list starts as a copy of it;
  · terminal and WezTerm take the folder's list (no Aa there);
  · the old locks are the first ticks: 136 = the 11-tool list, every other folder = Agent and Workflow off;
    ultracode still opens Agent and Workflow.

Store ~/.claude/tik_ha.json (TIK_HA env for tests):
  {"sarasari": {kind: {name: bool}}, "poshe": {cwd: {kind: {name: bool}}}, "chat": {key: {kind: {name: bool}}}}
  kind = abzar (built-in tools) · mcp · afzune (plugins, "name@marketplace") · eskil (skills)
A name not in any level falls to its base: on, except a plugin, which keeps what ~/.claude/settings.json says.
What the engine has been seen to offer is kept in ~/.claude/tik_ha_dide.json (TIK_HA_DIDE), written by the
VS Code host hook from each chat's first message, so a tool turned off still shows in the list.

The ticks reach the engine as one --settings object (measured 16 Nov on 2.1.325, at launch):
  permissions.deny [tool]       ⇒ the tool is gone from the chat's list
  deniedMcpServers [{serverName}] ⇒ the server is never started
  enabledPlugins {key: bool}     ⇒ the plugin (and its skills and MCPs) on or off
  skillOverrides {name: "off"}   ⇒ the skill is gone
A running engine takes plugins and skills live but not denied tools or MCPs (measured), so a new chat whose
ticks change is restarted by the host before its first message.

Usage:
  tik_ha.py settings <cwd> [--chat KEY] [--resume-args ARGS...] [--ezafe JSON] [--ultracode]  → JSON for --settings
  tik_ha.py fehrest <cwd> [--chat KEY]                                       → the list with every tick
  tik_ha.py sabt  (JSON on stdin: {sath, cwd, chat?, taghir: [{kind, name, on}]})  → {ok, matn}
  tik_ha.py kooch                                                            → the first ticks from the old locks
"""
import json
import subprocess
import os
import re
import shutil
import sys
import time
from pathlib import Path

HOME = Path.home() / ".claude"
KINDS = ("abzar", "mcp", "afzune", "eskil")
SID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
# The engine's own tools seen on 2.1.325 (init of 16 Nov) plus AskUserQuestion, which a print-mode chat lacks.
ABZAR_PAYE = ["Agent", "AskUserQuestion", "Bash", "CronCreate", "CronDelete", "CronList", "DesignSync", "Edit",
              "EnterWorktree", "ExitWorktree", "ListAgents", "Monitor", "NotebookEdit", "PushNotification", "Read",
              "RemoteTrigger", "ReportFindings", "ScheduleWakeup", "SendMessage", "Skill", "TaskStop", "ToolSearch",
              "WebFetch", "WebSearch", "Workflow", "Write"]
# the 11 of the old 136 lock (claude_abzar_kam.sh, claude_terminal.zsh, 4 Nov)
ABZAR_136 = ["Bash", "Read", "Edit", "Write", "ToolSearch", "AskUserQuestion", "SendMessage", "ListAgents", "Skill",
             "WebSearch", "WebFetch"]
POSHE_136 = "/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude"
ULTRACODE_BAZ = ("Agent", "Workflow")   # «اولتراکد که میشه ایجنت و ورک فلو» (Habib, 5 Nov)


def masir():
    return Path(os.environ.get("TIK_HA") or HOME / "tik_ha.json")


def masir_dide():
    return Path(os.environ.get("TIK_HA_DIDE") or HOME / "tik_ha_dide.json")


def json_khan(p):
    try:
        d = json.loads(Path(p).read_text())
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def atomi(p, d):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + ".%d.%d.tmp" % (os.getpid(), int(time.time() * 1000)))
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    os.replace(tmp, p)


def aa_shared(action, **data):
    helper = Path(__file__).resolve().parent.parent / 'dsh-rtl' / 'aa-shared.cjs'
    payload = {'action': action, **data}
    if os.environ.get('TIK_HA') and not os.environ.get('CRTL_AA_SHARED'):
        payload['home'] = str(Path(os.environ['TIK_HA']).parent / 'aa-test-home')
    # Finder-launched editors can have only the system directories in PATH.
    node_path = os.pathsep.join(filter(None, [os.environ.get('PATH'), '/opt/homebrew/bin', '/usr/local/bin']))
    node = shutil.which('node', path=node_path)
    if not node:
        raise ValueError('برای خواندن تنظیمات مشترک Aa، برنامهٔ Node.js پیدا نشد')
    result = subprocess.run([node, str(helper)], input=json.dumps(payload), text=True, capture_output=True, timeout=5)
    if result.returncode:
        raise ValueError('فهرست مشترک Aa خوانده نشد')
    return json.loads(result.stdout)


def anbar(sakht=False):
    """sakht: a missing or broken store is an error (a launch then keeps the old lock), never an empty, open list."""
    if sakht:
        a = json.loads(masir().read_text())
        if not isinstance(a, dict) or not a.get("kooch"):
            raise ValueError("tik_ha.json is not a tick list")
    else:
        a = json_khan(masir())
    for k in ("sarasari", "poshe", "chat"):
        if not isinstance(a.get(k), dict):
            a[k] = {}
    return aa_shared("ticks-load", base=a, nativeKind="abzar")


def list_sath(o):
    """One level's ticks, cleaned: {kind: {name: bool}}."""
    out = {}
    o = o if isinstance(o, dict) else {}
    for k in KINDS:
        m = o.get(k)
        out[k] = {n: v for n, v in m.items() if isinstance(n, str) and isinstance(v, bool)} if isinstance(m, dict) else {}
    return out


def poshe_kelid(a, cwd):
    """The folder whose list a chat in cwd takes: the deepest listed folder that holds cwd."""
    cwd = os.path.realpath(cwd) if cwd else ""
    best = None
    for p in a["poshe"]:
        if cwd == p or cwd.startswith(p.rstrip("/") + "/"):
            if best is None or len(p) > len(best):
                best = p
    return best


def tanzimat_karbar():
    return json_khan(Path(os.environ.get("CLAUDE_CONFIG_DIR") or HOME) / "settings.json")


def claude_json():
    return json_khan(Path(os.environ.get("TIK_CLAUDE_JSON") or Path.home() / ".claude.json"))


def pishfarz(kind, name, karbar):
    if kind == "afzune":
        v = (karbar.get("enabledPlugins") or {}).get(name)
        return v if isinstance(v, bool) else True
    if kind == "mcp":
        return not any(isinstance(x, dict) and x.get("serverName") == name for x in karbar.get("deniedMcpServers") or [])
    return True


def tik_nahayi(a, cwd, chat):
    """Every named tick in force for this chat, and the level each came from."""
    pk = poshe_kelid(a, cwd)
    lahye = [("sarasari", list_sath(a["sarasari"]))] if pk is None else [("poshe", list_sath(a["poshe"][pk]))]
    if chat and isinstance(a["chat"].get(chat), dict):
        lahye.append(("chat", list_sath(a["chat"][chat])))
    out = {k: {} for k in KINDS}
    for sath, l in lahye:
        for k in KINDS:
            for n, v in l[k].items():
                out[k][n] = (v, sath)
    return out, pk


def ghalam_ha(cwd):
    """Everything there is to tick, from the files and from what the engine has been seen to offer."""
    karbar, cj, dide = tanzimat_karbar(), claude_json(), json_khan(masir_dide())
    cwd = os.path.realpath(cwd) if cwd else ""
    s = {k: set() for k in KINDS}
    s["abzar"].update(ABZAR_PAYE)
    s["mcp"].update((cj.get("mcpServers") or {}).keys())
    proj = (cj.get("projects") or {}).get(cwd) or {}
    s["mcp"].update((proj.get("mcpServers") or {}).keys())
    s["mcp"].update((json_khan(Path(cwd) / ".mcp.json").get("mcpServers") or {}).keys() if cwd else [])
    s["afzune"].update((karbar.get("enabledPlugins") or {}).keys())
    s["afzune"].update((json_khan(HOME / "plugins" / "installed_plugins.json").get("plugins") or {}).keys())
    for d in [HOME / "skills"] + ([Path(cwd) / ".claude" / "skills"] if cwd else []):
        try:
            for f in d.iterdir():
                if f.name != "synced" and (f / "SKILL.md").is_file():
                    s["eskil"].add(f.name)
        except OSError:
            pass
    for k in KINDS:
        v = dide.get(k)
        if isinstance(v, list):
            s[k].update(x for x in v if isinstance(x, str) and x)
    s["abzar"].discard("Task")   # the engine names Agent "Task" in some lists; one tick for both
    # a plugin's own skills follow the plugin's tick
    plug = {n.split("@", 1)[0] for n in s["afzune"]}
    s["eskil"] = {n for n in s["eskil"] if ":" not in n or n.split(":", 1)[0] not in plug}
    # a plugin's own MCPs too
    s["mcp"] = {n for n in s["mcp"] if not n.startswith("plugin:")}
    return s, karbar


def scoped_bridge(cwd, chat):
    try:
        rows = json.loads((Path.home() / ".dsh/dsh-rtl/bridge-inventory.json").read_text())
        sid = re.sub(r"^session-([0-9a-f-]{36})$", r"\1", str(chat or ""), flags=re.I).lower()
        if not cwd or not sid or not isinstance(rows, list):
            return []
        return [r for r in rows if isinstance(r, dict) and r.get("source") == "deepseek" and
                r.get("scope", {}).get("cwd") == os.path.realpath(cwd) and
                str(r.get("scope", {}).get("sessionId", "")).lower() == sid and isinstance(r.get("name"), str)]
    except (OSError, ValueError, TypeError):
        return []


def tool_aliases(name):
    bare = re.sub(r"^mcp__(?:claude_yeki|dsh_yeki)__", "", name)
    bare = re.sub(r"^(?:claude_|dsh_)", "", bare)
    names = [bare]
    family = {"Read": "read", "read": "Read", "Glob": "glob", "glob": "Glob", "Grep": "grep", "grep": "Grep"}.get(bare)
    if family:
        names.append(family)
    return list(dict.fromkeys(alias for n in names for alias in (n, "claude_"+n, "dsh_"+n,
        "mcp__claude_yeki__"+n, "mcp__dsh_yeki__"+n, "mcp__claude_yeki__claude_"+n, "mcp__dsh_yeki__dsh_"+n)))


def expanded_alias_changes(changes, effective):
    out = {(t["kind"], t["name"]): t for t in changes}
    for t in changes:
        if t["kind"] != "mcp" or not imported_name(t["name"]):
            continue
        for n in tool_aliases(t["name"]):
            if n in effective["mcp"]:
                out[("mcp", n)] = {"kind": "mcp", "name": n, "on": t["on"]}
            for k in ("abzar",):
                if n in effective[k]:
                    out[(k, n)] = {"kind": k, "name": n, "on": t["on"]}
    return list(out.values())


def imported_name(n):
    return bool(re.match(r"^(?:claude_|dsh_|mcp__(?:claude_yeki|dsh_yeki)__)", n))


def fehrest(cwd, chat, scope_chat=None, view_scope=""):
    a = anbar()
    s, karbar = ghalam_ha(cwd)
    tik, pk = tik_nahayi(a, "" if view_scope == "sarasari" else cwd, chat if view_scope in ("", "chat") else "")
    imported = {r["name"] for r in scoped_bridge(cwd, scope_chat if scope_chat is not None else chat)}
    s["mcp"].update(imported)
    out = {}
    for k in KINDS:
        rows = []
        names = {n for n in s[k] | set(tik[k]) if not imported_name(n) or (k == "mcp" and n in imported)}
        for n in sorted(names, key=lambda x: x.lower()):
            v, sath = tik[k].get(n, (pishfarz(k, n, karbar), "paye"))
            if imported_name(n):
                if any(tik[kind].get(alias, (True, ""))[0] is False for kind in ("abzar", "mcp", "afzune") for alias in tool_aliases(n)):
                    v = False
            rows.append({"n": n, "on": v, "sath": sath})
        out[k] = rows
    return {"ghalam": out, "poshe": pk or "", "chat_dard": bool(chat and a["chat"].get(chat)), "cwd": cwd, "scopeSessionId": scope_chat if scope_chat is not None else chat, "viewScope": view_scope or "chat", "aliasList": {k: {n: v[0] for n, v in values.items()} for k, values in tik.items()}}


def tanzimat(cwd, chat, ultracode=False, ezafe=None):
    a = anbar(sakht=True)
    karbar = tanzimat_karbar()
    tik, _ = tik_nahayi(a, cwd, chat)
    out = dict(ezafe or {})
    deny = [n for n, (v, _) in sorted(tik["abzar"].items()) if v is False]
    if ultracode:
        deny = [n for n in deny if n not in ULTRACODE_BAZ]
    if "Agent" in deny:
        deny.append("Task")
    if deny:
        p = dict(out.get("permissions") or {})
        p["deny"] = list(p.get("deny") or []) + deny
        out["permissions"] = p
    mcp = [n for n, (v, _) in sorted(tik["mcp"].items()) if v is False]
    if mcp:
        out["deniedMcpServers"] = list(out.get("deniedMcpServers") or []) + [{"serverName": n} for n in mcp]
    plug = {n: v for n, (v, _) in sorted(tik["afzune"].items()) if v != pishfarz("afzune", n, karbar)}
    if plug:
        out["enabledPlugins"] = {**(out.get("enabledPlugins") or {}), **plug}
    esk = {n: "off" for n, (v, _) in sorted(tik["eskil"].items()) if v is False}
    if esk:
        out["skillOverrides"] = {**(out.get("skillOverrides") or {}), **esk}
    return out


def sabt(m):
    sath = m.get("sath")
    cwd = os.path.realpath(m.get("cwd") or "") if m.get("cwd") else ""
    chat = m.get("chat") or ""
    taghir = m.get("taghir") or []
    if sath not in ("chat", "poshe", "sarasari"):
        return {"ok": False, "matn": "اول یکی از سه کلید را بزن: این چت / این پوشه / سراسری"}
    if sath == "chat" and not chat:
        return {"ok": False, "matn": "این چت هنوز شناخته نشده"}
    if sath == "poshe" and not cwd:
        return {"ok": False, "matn": "پوشهٔ این چت معلوم نیست"}
    ok_t = [t for t in taghir if isinstance(t, dict) and t.get("kind") in KINDS and isinstance(t.get("name"), str)
            and t["name"] and isinstance(t.get("on"), bool)]
    if not ok_t:
        return {"ok": False, "matn": "تیکی عوض نشده"}
    a = anbar()
    requested_count = len(ok_t)
    effective, _ = tik_nahayi(a, cwd if sath != "sarasari" else "", chat if sath == "chat" else "")
    if any(t["kind"] == "mcp" and imported_name(t["name"]) for t in ok_t):
        ok_t = aa_shared("ticks-alias-expand", scope=sath, cwd=cwd, sid=chat, changes=ok_t, nativeFile=str(masir()), baseList={k: {n: v[0] for n, v in values.items()} for k, values in effective.items()})
    if sath == "sarasari":
        l = list_sath(a["sarasari"])
    elif sath == "poshe":
        pk = poshe_kelid(a, cwd)
        if pk != cwd:
            # «هر پوشه فهرستِ خودش؛ اولِ کار کپیِ سراسری» — or of the folder above it, when that one has a list
            base = list_sath(a["poshe"][pk]) if pk else list_sath(a["sarasari"])
            l = json.loads(json.dumps(base))
        else:
            l = list_sath(a["poshe"][cwd])
    else:
        l = list_sath(a["chat"].get(chat))
    for t in ok_t:
        if t["kind"] in KINDS:
            l[t["kind"]][t["name"]] = t["on"]
    if sath == "sarasari":
        a["sarasari"] = l
    elif sath == "poshe":
        a["poshe"][cwd] = l
    else:
        a["chat"][chat] = l
    atomi(masir(), a)
    aa_shared("ticks-save", scope=sath, cwd=cwd, sid=chat, changes=ok_t)
    return {"ok": True, "matn": "%s تیک ثبت شد (%s)" % (str(requested_count).translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")), {"chat": "این چت", "poshe": "این پوشه", "sarasari": "سراسری"}[sath])}


def chat_be_sid(kelid, sid):
    """A new chat's ticks were kept under its channel; from its first message they belong to its id."""
    a = anbar()
    if kelid in a["chat"] and SID.match(sid or ""):
        a["chat"][sid] = a["chat"].pop(kelid)
        atomi(masir(), a)
        return True
    return False


def kooch():
    """The first ticks, from the locks as they were (Habib: «قفل‌های فعلی اولین تیک‌ها شوند»). Runs once."""
    a = anbar()
    if a.get("kooch"):
        return {"ok": False, "matn": "قبلاً انجام شده"}
    a["sarasari"] = list_sath(a["sarasari"])
    a["sarasari"]["abzar"].update({"Agent": False, "Workflow": False})
    l = json.loads(json.dumps(a["sarasari"]))
    for n in ABZAR_PAYE:
        l["abzar"][n] = n in ABZAR_136
    a["poshe"][POSHE_136] = l
    try:
        baz = [x.strip() for x in (HOME / "abzar_baz.txt").read_text().splitlines() if x.strip()]
    except OSError:
        baz = []
    for d in baz:
        lb = json.loads(json.dumps(a["sarasari"]))
        lb["abzar"].update({"Agent": True, "Workflow": True})
        a["poshe"][os.path.realpath(d)] = lb
    a["kooch"] = int(time.time() * 1000)
    atomi(masir(), a)
    return {"ok": True, "matn": "سراسری: Agent و Workflow خاموش · ۱۳۶: فقط ۱۱ ابزار · پوشه‌های باز: %d" % len(baz)}


def chat_az_args(args, cwd):
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from terminal_model import sid_az_args
        return sid_az_args(args, cwd)
    except Exception:
        return None


CHAT_NESHANE = "__crtl_tik_chat"   # the host hook names a new chat's channel inside --settings; taken out here


def exec_chat(cwd, argv):
    """The VS Code launch (claude_abzar_kam.sh): this chat's ticks join the --settings the extension already passes.
    The extension's own --settings may carry ultracode and the host's chat name; both are read and the name removed."""
    args = list(argv[1:])
    ezafe, jaye = {}, None
    for i, a in enumerate(args):
        if a == "--settings" and i + 1 < len(args):
            try:
                v = json.loads(args[i + 1])
                if isinstance(v, dict):
                    ezafe, jaye = v, i
            except ValueError:
                pass
    chat = ezafe.pop(CHAT_NESHANE, "") if isinstance(ezafe.get(CHAT_NESHANE, ""), str) else ""
    ezafe.pop(CHAT_NESHANE, None)
    chat = chat or chat_az_args(args, os.path.realpath(cwd)) or ""
    s = tanzimat(cwd, chat, ezafe.get("ultracode") is True, ezafe)
    if jaye is not None:
        del args[jaye:jaye + 2]
    if s:
        args += ["--settings", json.dumps(s, ensure_ascii=False)]
    return [argv[0]] + args


def ultracode_dar_args(args):
    """آیا همین اجرا در --settings خودش ultracode:true دارد؟ (برای وقتی انبار خوانده نمی‌شود)"""
    for i, a in enumerate(args):
        if a == "--settings" and i + 1 < len(args):
            try:
                v = json.loads(args[i + 1])
            except ValueError:
                continue
            if isinstance(v, dict) and v.get("ultracode") is True:
                return True
    return False


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    cmd, rest = argv[0], argv[1:]
    if cmd == "exec" and len(rest) >= 2:
        # never an open chat by mistake: anything wrong here ⇒ the old default lock
        try:
            nv = exec_chat(rest[0], rest[1:])
        except Exception as e:
            print("tik_ha: %s ⇒ قفلِ قدیمی" % e, file=sys.stderr)
            # The lock stays even here, except when the launch itself asks for
            # ultracode — that promise lives in the wrapper's header (Habib, 5 Nov:
            # «اولتراکد که میشه ایجنت و ورک فلو») and must not depend on the store.
            nv = rest[1:] + ([] if ultracode_dar_args(rest[1:]) else ["--disallowedTools", "Agent,Workflow"])
        os.execv(nv[0], nv)
    if cmd == "sabt":
        print(json.dumps(sabt(json.loads(sys.stdin.read() or "{}")), ensure_ascii=False))
        return 0
    if cmd == "kooch":
        print(json.dumps(kooch(), ensure_ascii=False))
        return 0
    if cmd == "chat-be-sid" and len(rest) == 2:
        print(json.dumps({"ok": chat_be_sid(rest[0], rest[1])}))
        return 0
    if cmd in ("settings", "fehrest") and rest:
        cwd, chat, ezafe, uc, i = rest[0], "", None, False, 1
        scope_chat = None
        view_scope = ""
        while i < len(rest):
            if rest[i] == "--chat" and i + 1 < len(rest):
                chat = rest[i + 1]; i += 2
            elif rest[i] == "--view-scope" and i + 1 < len(rest):
                view_scope = rest[i + 1]; i += 2
            elif rest[i] == "--scope-chat" and i + 1 < len(rest):
                scope_chat = rest[i + 1]; i += 2
            elif rest[i] == "--ezafe" and i + 1 < len(rest):
                try:
                    ezafe = json.loads(rest[i + 1])
                except ValueError:
                    ezafe = None
                i += 2
            elif rest[i] == "--ultracode":
                uc = True; i += 1
            elif rest[i] == "--resume-args":
                chat = chat or (chat_az_args(rest[i + 1:], os.path.realpath(cwd)) or ""); break
            else:
                i += 1
        if cmd == "fehrest":
            print(json.dumps(fehrest(cwd, chat, scope_chat, view_scope), ensure_ascii=False))
        else:
            print(json.dumps(tanzimat(cwd, chat, uc, ezafe if isinstance(ezafe, dict) else None), ensure_ascii=False))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
