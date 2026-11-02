// «برگردون به پرشین و بعد چک کن با الان تغییرش رو و بهبودش رو با اسکریپت قابل اثبات» (Habib, 3 Nov 00:50)
// Part 1 reads real chats around the two setting changes. Part 2 (--azmoon) asks the model the same questions
// with the setting persian / absent / english; english is the control: if it does not come out English, the measure is broken.
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const hazer = path.dirname(fileURLToPath(import.meta.url))
const { englisi_ast } = await import(path.join(hazer, '../../mods/hads/hooks/register.js'))
const home = os.homedir()
const hazf = Date.parse('2026-10-28T01:28:44+03:30'), bargasht = Date.parse('2026-10-29T04:27:38+03:30'), az = hazf - 10 * 864e5
const dore = (t) => t < hazf ? '۱ با persian، پیش از حذف' : t < bargasht ? '۲ بی تنظیم' : '۳ با persian، بعد از برگشتن'
const jam = {}
const afzudan = (k, en) => { jam[k] ??= { kol: 0, en: 0 }; jam[k].kol++; if (en) jam[k].en++ }
const root = home + '/.claude/projects'
for (const d of fs.readdirSync(root)) {
  const p = path.join(root, d)
  if (!fs.statSync(p).isDirectory()) continue
  for (const f of fs.readdirSync(p)) {
    if (!f.endsWith('.jsonl') || fs.statSync(path.join(p, f)).mtimeMs < az) continue
    for (const l of fs.readFileSync(path.join(p, f), 'utf8').split('\n')) {
      if (!l.includes('"assistant"')) continue
      let e; try { e = JSON.parse(l) } catch { continue }
      if (e.type !== 'assistant' || e.isSidechain || e.entrypoint !== 'claude-vscode') continue
      const t = Date.parse(e.timestamp)
      if (!(t >= az) || !Array.isArray(e.message?.content)) continue
      const matn = e.message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
      if (matn.length < 40) continue
      const en = englisi_ast(matn)
      afzudan(dore(t), en); afzudan(dore(t) + ' · ' + e.version, en)
    }
  }
}
const chap = (k) => console.log(k.padEnd(50), String(jam[k].kol).padStart(6), String(jam[k].en).padStart(5), (100 * jam[k].en / jam[k].kol).toFixed(1) + '%')
console.log('--- بخش ۱: چت‌های VS Code (همه، انگلیسی، درصد)')
Object.keys(jam).filter((k) => !k.includes('·')).sort().forEach(chap)
console.log('--- همان، جدا به نسخه (فقط نسخه با ۳۰ جواب یا بیشتر)')
Object.keys(jam).filter((k) => k.includes('·') && jam[k].kol >= 30).sort().forEach(chap)

if (process.argv.includes('--azmoon')) {
  const bin = fs.readdirSync(home + '/.vscode/extensions').filter((x) => x.startsWith('anthropic.claude-code-')).sort().at(-1)
  const claude = `${home}/.vscode/extensions/${bin}/resources/native-binary/claude`
  const so = ['یک خط بگو git rebase چه کار می‌کند.', 'Explain in two sentences what a mutex is.', 'What is the difference between TCP and UDP? Two sentences.', 'این خطا یعنی چه؟ ECONNRESET', 'List three uses of the grep command.', 'Why can a cache go stale? Two sentences.']
  const dast = [['persian', { language: 'persian' }], ['bi_tanzim', {}], ['english_shahed', { language: 'english' }]]
  const cwd = fs.mkdtempSync(os.tmpdir() + '/zaban-')
  console.log('--- بخش ۲: هر سؤال با هر حالت؛ بی CLAUDE.md و بی تنظیم‌های حبیب')
  const natije = {}
  for (const [esm, s] of dast) {
    natije[esm] = { kol: 0, en: 0, khata: 0 }
    for (const q of so) {
      const r = spawnSync(claude, ['-p', q, '--setting-sources', 'project', '--settings', JSON.stringify(s), '--tools', '', '--model', 'claude-opus-5-5', '--no-session-persistence'], { cwd, encoding: 'utf8', timeout: 180000, env: { ...process.env, CLAUDE_CODE_PLUGIN_DIRS: '' } })
      const j = (r.stdout || '').trim()
      if (r.status !== 0 || !j || j.startsWith('API Error')) { natije[esm].khata++; console.log(esm, 'خطا:', (j || r.stderr || '').slice(0, 120)); continue }
      const fa = (j.match(/[؀-ۿ]/g) || []).length, en = (j.match(/[A-Za-z]/g) || []).length
      natije[esm].kol++; if (en > fa) natije[esm].en++
      console.log(esm.padEnd(15), en > fa ? 'EN' : 'FA', '|', q.slice(0, 28), '|', j.replace(/\n/g, ' ').slice(0, 60))
    }
  }
  console.log(JSON.stringify(natije))
  fs.rmSync(cwd, { recursive: true })
  const dorost = natije.english_shahed.kol > 0 && natije.english_shahed.en === natije.english_shahed.kol
  console.log(dorost ? 'شاهد درست: حالتِ english همه انگلیسی' : 'شاهد خطا داد: این اندازه‌گیری قابل اعتماد نیست')
  process.exit(dorost ? 0 : 1)
}
