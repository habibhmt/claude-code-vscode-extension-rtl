// Every day: the newest tweets of the people on tweet_ha.json, in simple Persian, into
// Doc/tweet_ha/<date>.md — only tweets not reported before (Habib, 11 Nov 2026 02:39: «دو نفر رو
// توییت هاشون رو میخوام همیشه … کلا اگه کسی میتونی در بیاری که نکته های ناب به درد بخور میده برای
// کلود کد پیدا کن و به این لیست اضافه کن»; window 02:50: «بله، هر روز خودکار»).
//
//   node tweet_ha.mjs            read, translate with Haiku, write the report (run by com.habib.tweet-ha)
//   TWEET_KHOSHK=1 node …        read and write, no Haiku, no notification, seen-file untouched
//
// x.com is read in a background tab of this project's Chrome (9226), never brought to the front
// (browser skill rule 3); the tab is closed after each account and the whole Chrome when this run
// opened it. An account that gives no tweet is an error, never a quiet "nothing new".
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.TWEET_PORT || '9226'
const FEHREST = process.env.TWEET_FEHREST || join(REPO, 'tweet_ha.json')
const DIDE = process.env.TWEET_DIDE || join(REPO, 'tweet_ha.dide.json')
const GOZARESH_DIR = process.env.TWEET_GOZARESH_DIR || join(REPO, 'Doc/tweet_ha')
const LOG = process.env.TWEET_LOG || join(REPO, 'tweet_ha.log')
const KHOSHK = !!process.env.TWEET_KHOSHK
const BAZ_KON = '/Users/habib/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar/ers_monshi/chrome_baz_kon.sh'
const had_roz_aval = 7          // first time an account is read: only its last 7 days
const had_tweet_har_kas = 8     // newest articles looked at per account
const sabr_safhe_ms = 12000     // x.com needs ~10 s in a background tab
const had_kharj_usd = '0.3'

const say = (s) => appendFileSync(LOG, `[${new Date().toISOString()}] ${s}\n`)
const notif = (onvan, matn) => {
  if (KHOSHK) return say(`خشک (نوتیف): ${onvan} — ${matn}`)
  try { execFileSync('osascript', ['-e', `display notification ${JSON.stringify(matn)} with title ${JSON.stringify(onvan)}`]) } catch (e) {}
}
const khata = (s) => { say('❌ ' + s); notif('توییت‌های Claude Code: خطا', s); process.exitCode = 1 }

async function cdp() {
  const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
  const ws = new WebSocket(v.webSocketDebuggerUrl); let id = 0; const pend = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } }
  await new Promise((ok, na) => { ws.onopen = ok; ws.onerror = na })
  const send = (method, params = {}, sessionId) => new Promise((ok) => { const i = ++id; pend.set(i, ok); ws.send(JSON.stringify({ id: i, method, params, sessionId })) })
  return { ws, send }
}

// x.com's page has no <time> or tweetText any more (new UI, 11 Nov 2026): take only each post's own
// link (its first /<user>/status/<id>) from the page, and the words and time from api.fxtwitter.com
const ESTEKHRAJ = `(() => [...document.querySelectorAll('article')].map((a) => {
  const l = [...a.querySelectorAll('a[href*="/status/"]')].map((x) => x.getAttribute('href').match(/^\\/([^/]+)\\/status\\/(\\d+)$/)).find(Boolean)
  return l ? { user: l[1], id: l[2] } : null
}).filter(Boolean))()`

async function joziat(t) {
  const r = await fetch(`https://api.fxtwitter.com/${t.user}/status/${t.id}`, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
  const d = (await r.json()).tweet
  if (!d) throw new Error(`fxtwitter برای ${t.user}/${t.id} چیزی نداد (${r.status})`)
  return { ...t, iso: new Date(d.created_at).toISOString(), matn: d.text || '', naghl: d.quote ? `@${d.quote.author?.screen_name}: ${d.quote.text || ''}` : '' }
}

async function khandan(send, user) {
  let t = await send('Target.createTarget', { url: `https://x.com/${user}`, background: true, windowState: 'minimized' })
  if (t.error) t = await send('Target.createTarget', { url: `https://x.com/${user}`, background: true })
  if (t.error) throw new Error('تب باز نشد: ' + JSON.stringify(t.error))
  const targetId = t.result.targetId
  try {
    const sid = (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId
    await send('Emulation.setFocusEmulationEnabled', { enabled: true }, sid)
    await new Promise((ok) => setTimeout(ok, sabr_safhe_ms))
    const e = await send('Runtime.evaluate', { expression: ESTEKHRAJ, returnByValue: true }, sid)
    return (e.result?.result?.value || []).slice(0, had_tweet_har_kas)
  } finally { await send('Target.closeTarget', { targetId }) }
}

function tarjome(taze) {
  if (KHOSHK) return Object.fromEntries(taze.map((t) => [t.id, { fa: '(خشک) ' + t.matn.slice(0, 80), kar: '-' }]))
  const ext = join(process.env.HOME, '.vscode/extensions')
  const C = readdirSync(ext).filter((d) => /^anthropic\.claude-code-[\d.]+-darwin-arm64$/.test(d))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((d) => join(ext, d, 'resources/native-binary/claude')).filter(existsSync).pop()
  if (!C) throw new Error('claude پیدا نشد')
  const prompt = `این توییت‌ها از آدم‌های Claude Code است. برای هر کدام یک خلاصهٔ فارسیِ ساده (حداکثر ۲ جمله، اصطلاحِ فنی با توضیحِ ساده در پرانتز) و یک «به کارِ حبیب»: اگر نکته یا ترفندِ عملی برای استفاده از Claude Code است، در چند کلمه بگو چه کند؛ اگر نه «-».
فقط JSON بده، بی هیچ متنِ دیگر: {"<id>": {"fa": "...", "kar": "..."}, ...}
${JSON.stringify(taze.map((t) => ({ id: t.id, user: t.user, matn: t.matn, naghl: t.naghl })))}`
  const env = { ...process.env }; for (const k of ['CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_SESSION_ID', 'CLAUDECODE']) delete env[k]
  const out = execFileSync(C, ['-p', '--model', 'haiku', '--permission-mode', 'dontAsk', '--strict-mcp-config', '--setting-sources', '',
    '--allowedTools', '', '--max-budget-usd', had_kharj_usd, prompt], { cwd: GOZARESH_DIR, env, timeout: 300000, encoding: 'utf8' })
  const m = out.match(/\{[\s\S]*\}/); if (!m) throw new Error('جوابِ Haiku JSON نداشت: ' + out.slice(0, 200))
  return JSON.parse(m[0])
}

const ZAMAN = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const tamiz = (s) => String(s || '').replace(/\|/g, '¦').replace(/\s*\n\s*/g, ' ').trim()

async function asli() {
  const fehrest = JSON.parse(readFileSync(FEHREST, 'utf8')).afrad
  const dide = existsSync(DIDE) ? JSON.parse(readFileSync(DIDE, 'utf8')) : {}
  let bazkardam = false
  try { await fetch(`http://127.0.0.1:${PORT}/json/version`) } catch (e) {
    execFileSync('/bin/zsh', [BAZ_KON, PORT], { timeout: 60000 }); bazkardam = true
    await new Promise((ok) => setTimeout(ok, 4000))
  }
  const { ws, send } = await cdp()
  const taze = [], bi_tweet = []
  try {
    for (const f of fehrest) {
      const ha = await khandan(send, f.user)
      const khodash = ha.filter((t) => t.user.toLowerCase() === f.user.toLowerCase())
      if (!khodash.length) { bi_tweet.push(f.user); continue }
      const ghabli = new Set(dide[f.user] || []), aval = !dide[f.user]
      for (const t of khodash) {
        if (ghabli.has(t.id)) continue
        const j = await joziat(t)
        if (aval && Date.now() - Date.parse(j.iso) > had_roz_aval * 864e5) continue
        taze.push(j)
      }
      dide[f.user] = [...new Set([...khodash.map((t) => t.id), ...(dide[f.user] || [])])].slice(0, 60)
    }
  } finally {
    if (bazkardam) await send('Browser.close')
    ws.close()
  }
  if (bi_tweet.length) khata(`از این‌ها هیچ توییتی خوانده نشد (اسمِ غلط، یا x.com بیرون‌مان کرده): ${bi_tweet.join('، ')}`)
  if (!taze.length) { say(`تازه‌ای نبود (${fehrest.length} نفر)`); if (!KHOSHK && !bi_tweet.length) writeFileSync(DIDE, JSON.stringify(dide, null, 1)); return }
  mkdirSync(GOZARESH_DIR, { recursive: true })
  taze.sort((a, b) => Date.parse(b.iso) - Date.parse(a.iso))
  const fa = tarjome(taze)
  const rooz = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })
  const file = join(GOZARESH_DIR, rooz + '.md')
  const sar = existsSync(file) ? '' : `# توییت‌های تازهٔ Claude Code — ${rooz}\n\nفهرستِ آدم‌ها: \`tweet_ha.json\`. هر توییت فقط یک بار می‌آید.\n`
  const satr = taze.map((t) => `| ${ZAMAN.format(new Date(t.iso))} | @${t.user} | ${tamiz(fa[t.id]?.fa) || '(ترجمه نیامد) ' + tamiz(t.matn).slice(0, 120)} | ${tamiz(fa[t.id]?.kar) || '-'} | [لینک](https://x.com/${t.user}/status/${t.id}) |`)
  appendFileSync(file, `${sar}\n## خوانده‌شده ساعتِ ${ZAMAN.format(new Date())}\n\n| کی (تهران) | کی | به زبانِ ساده | به کارِ حبیب | لینک |\n|---|---|---|---|---|\n${satr.join('\n')}\n`)
  if (!KHOSHK) writeFileSync(DIDE, JSON.stringify(dide, null, 1))
  say(`✅ ${taze.length} توییتِ تازه ⇐ ${file}`)
  const kar = taze.filter((t) => fa[t.id]?.kar && fa[t.id].kar !== '-').length
  notif(`${taze.length} توییتِ تازهٔ Claude Code`, `${kar} نکتهٔ به‌دردبخور — Doc/tweet_ha/${rooz}.md`)
}

asli().catch((e) => khata(String(e && e.stack || e).slice(0, 400)))
