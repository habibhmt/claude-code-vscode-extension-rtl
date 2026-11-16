#!/usr/bin/env node
// DeepSeek Harness reads only CLAUDE.md in projects, not AGENTS.md (Habib, 16 Nov 2026: «دیگه ایجنت ام دی نخونه
// همون کلود ام دی رو بخونه»; window answer «نه، ب»: copy the presets). The setting lives inside every agent preset,
// and DSH lets a profile only replace a preset whole, so the shipped standard / ptc / cordis presets are copied into
// the bundle @local/dsh-claude-yeki (dsh-claude-yeki/cordis.patch.yml) between two marker lines, with two changes:
//   1. agent-instructions: instructionFileCandidates [CLAUDE.md], localInstructionFileCandidates [CLAUDE.local.md]
//   2. skill-filesystem customSkillDirs: the shipped !!js resolves from baseUrl, which in a profile patch is the
//      bundle folder; it becomes the fixed skills path inside the app.
// A DSH update does not change the copy: run --check after every update, --write to refresh.
//
// Run with the app's own Node, which can read app.asar:
//   ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" abzar/dsh_preset_claude_md.cjs --check
//   … --write   (replaces the block in dsh-claude-yeki/cordis.patch.yml; a backup is kept beside it)
const fs = require('fs'), path = require('path'), os = require('os')
const APP = '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai'
const SKILLS = APP + '/dsh-agent-preset/skills'
const PATCH = process.env.DSH_PROFILE_PATCH || path.join(__dirname, '..', 'dsh-claude-yeki', 'cordis.patch.yml')
const SAR = '# >>> claude-md-presets (abzar/dsh_preset_claude_md.cjs — دستی عوض نکن)'
const TAH = '# <<< claude-md-presets'
const PRESETS = ['standard', 'ptc', 'cordis']

function radif(name) {
  const lines = fs.readFileSync(`${APP}/dsh-web-app/presets/${name}.patch.yml`, 'utf8').split('\n')
  const i = lines.indexOf('- insert:')
  if (i < 0) throw new Error(name + ': no insert row')
  let t = lines.slice(i + 1).map((l) => (l.startsWith('    ') ? l.slice(4) : l)).join('\n').replace(/\s+$/, '')
  const re = /(- id: agent-instructions\n\s+name: '@deepseek-ai\/dsh-agent-instructions'\n\s+config:\n(\s+)maxBytes: \d+)/
  const m = re.exec(t)
  if (!m) throw new Error(name + ': agent-instructions row changed shape')
  t = t.slice(0, m.index + m[0].length) + `\n${m[2]}instructionFileCandidates: ['CLAUDE.md']\n${m[2]}localInstructionFileCandidates: ['CLAUDE.local.md']` + t.slice(m.index + m[0].length)
  t = t.replace(/!!js process\.getBuiltinModule\('node:path'\)\.join\(.*createRequire\(baseUrl\).*'skills'\)/g, `'${SKILLS}'`)
  if (/baseUrl/.test(t)) throw new Error(name + ': another baseUrl expression: check by hand')
  return `# --- ${name} ---\n` + t
}
function boluk() {
  return [SAR,
    '# حبیب ۱۶ نوامبر ۲۰۲۶: در پروژه‌ها فقط CLAUDE.md خوانده شود. کپیِ کاملِ پریست‌های standard / ptc / cordis از',
    '# DSH ِ نصب‌شده، با دو تغییر (فهرستِ فایلِ دستورها، و مسیرِ ثابتِ اسکیل‌ها). بعد از آپدیتِ DSH: --check.',
    ...PRESETS.map(radif), TAH].join('\n')
}
const matn = fs.readFileSync(PATCH, 'utf8')
const a = matn.indexOf(SAR), b = matn.indexOf(TAH)
const now = a >= 0 && b > a ? matn.slice(a, b + TAH.length) : null
const taze = boluk()
if (process.argv.includes('--write')) {
  if (!fs.existsSync(SKILLS)) throw new Error('skills folder missing: ' + SKILLS)
  const bak = path.join(os.tmpdir(), path.basename(PATCH) + '.bak-claude-md-' + new Date().toISOString().replace(/[:.]/g, '-'))
  fs.copyFileSync(PATCH, bak)
  const out = now ? matn.slice(0, a) + taze + matn.slice(b + TAH.length) : matn.replace(/\s*$/, '\n') + '\n' + taze + '\n'
  fs.writeFileSync(PATCH, out)
  console.log('written; backup:', bak)
} else {
  const ok = now === taze
  console.log(now === null ? 'block missing' : ok ? 'up to date' : 'OUT OF DATE (DSH changed its presets): run --write')
  process.exit(ok ? 0 : 1)
}
