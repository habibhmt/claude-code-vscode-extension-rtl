# Claude Code setup

| What | How |
|---|---|
| Project instructions | Agents read `CLAUDE.md` and `CLAUDE.local.md` only, not `AGENTS.md`. Applies to the `standard`, `ptc` and `cordis` presets. |
| Global instructions | `~/.dsh/AGENTS.md` is a link to `~/.claude/CLAUDE.md` (set up outside this bundle). |
| MCP servers | Every server in the global `mcpServers` of `~/.claude.json` is registered under the same name and follows that file. |

Limits: folder-only MCP servers and SSE servers are not brought in. The three presets are full copies of DSH 0.2.2-rc.1; a DSH update does not refresh them. Run `abzar/dsh_preset_claude_md.cjs --check` in project 136 after every update.
