// Every day: the Usage pages of Claude and ChatGPT are read, and a reset that was not there before (a free
// reset, a banked reset, a new «Expires …») is told to Habib the same day, with its own deadline alarm
// (Habib, 11 Nov 2026 22:49: «یه راهکاری بزار که هر روز بری تو صفحه یوسیج کلود و چت جی پی تی که از ریست های
// جدید با خبر بشی مثل الان نشه»; window 22:55: «بله، همین است»).
//
//   node reset_ha.mjs            read, compare with reset_ha.dide.json, report (run by com.habib.136.reset-ha)
//   RESET_KHOSHK=1 node …        read and print, no notification, no window, seen-file and alarms untouched
//   RESET_SAFHE=<file.json>      take the two pages from a file instead of the browser (tests)
//
// The pages are read in background tabs of this project's Chrome (9226), never brought to the front (browser
// skill rule 3). A reset button is only hovered, to read its «Expires …» tooltip: it is NEVER clicked, a click
// would spend the reset. A page that gives nothing is an error, never a quiet «nothing new».
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, rmSync, readdirSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.RESET_PORT || '9226'
const DIDE = process.env.RESET_DIDE || join(REPO, 'reset_ha.dide.json')
const GOZARESH_DIR = process.env.RESET_GOZARESH_DIR || join(REPO, 'Doc/reset_ha')
const LOG = process.env.RESET_LOG || join(REPO, 'reset_ha.log')
const ALARM_DIR = process.env.RESET_ALARM_DIR || join(REPO, 'abzar/alarm-reset.d')
const KHOSHK = !!process.env.RESET_KHOSHK
const BISEDA = KHOSHK || !!process.env.RESET_AZMUN
const A203 = '/Users/habib/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar'
const BAZ_KON = A203 + '/ers_monshi/chrome_baz_kon.sh'
const CHAT = 'مجری -۱۳۶- ایمک -نیو'
const SAFHE = {
  claude: 'https://claude.ai/settings/usage',
  chatgpt: 'https://chatgpt.com/settings/usage?tab=overview',
}
const had_kol_ms = 240000      // the whole run; a browser that died mid-way must not hang the job
const had_farman_ms = 20000    // one CDP command
const sabr_safhe_ms = 75000    // a page: polled every 3 s, reloaded once at 30 s

const say = (s) => appendFileSync(LOG, `[${new Date().toISOString()}] ${s}\n`)
const ejra = (f, a, o = {}) => { try { return execFileSync(f, a, { encoding: 'utf8', timeout: 60000, ...o }) } catch (e) { say(`❌ ${f.split('/').pop()}: ${String(e.message).slice(0, 200)}`); return '' } }
const notif = (onvan, matn, seda = '') => {
  if (BISEDA) return say(`خشک (نوتیف${seda ? '، صدادار' : ''}): ${onvan} — ${matn}`)
  ejra('/bin/zsh', [A203 + '/notif.sh', onvan, matn, seda, 'reset-ha', 'open https://claude.ai/settings/usage'])
}
// to Habib's phone, when this project has its Bale bot (abzar/bale-136.sh; without it, nothing)
const bale = (matn) => {
  const f = join(REPO, 'abzar/bale-136.sh')
  if (BISEDA || !existsSync(f)) return
  ejra('/bin/zsh', [f, matn])
}
const be_chat = (matn) => {
  if (BISEDA) return say(`خشک (چت): ${matn}`)
  spawn('/bin/zsh', [A203 + '/alarm_be_saheb.sh', CHAT, matn], { detached: true, stdio: 'ignore' }).unref()
}
const panjere = (onvan, khat_ha) => {
  if (BISEDA) return say(`خشک (پنجره): ${onvan} — ${khat_ha.join(' / ')}`)
  spawn(A203 + '/panjere_dokme', [onvan, '43200', 'دیدم=didam', ...khat_ha], { detached: true, stdio: 'ignore' }).unref()
}

// ---- reading the two pages -------------------------------------------------------------------------------
const JS_MATN = `(() => (document.querySelector('[role=dialog]') || document.querySelector('main') || document.body).innerText)()`
// every control that speaks of a reset (not the plain «Resets Monday» line): its words and where it is
const JS_DOKME = `(() => { const d = document.querySelector('[role=dialog]') || document.body
  const ha = [...d.querySelectorAll('button, a, [role=button]')].filter((x) => /\\breset\\b/i.test((x.getAttribute('aria-label') || '') + ' ' + x.innerText))
  const hame = ha.map((x) => { const r = x.getBoundingClientRect(); return { label: (x.getAttribute('aria-label') || x.innerText).trim().slice(0, 80), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } })
  return hame.filter((d, i) => d.x > 0 && d.y > 0 && hame.findIndex((e) => Math.abs(e.x - d.x) < 8 && Math.abs(e.y - d.y) < 8) === i) })()`
const JS_TOOLTIP = `(() => { const k = document.body.innerText.split('\\n').map((x) => x.trim()).filter(Boolean); const i = k.findIndex((x) => /^Expires /.test(x)); return i < 0 ? '' : (i > 0 ? k[i - 1] + ' | ' : '') + k[i] })()`
const AMADE = {
  claude: `/Resets|% used/.test(document.body.innerText) && !/Loading\\nLoading/.test(document.body.innerText)`,
  chatgpt: `/Plan limits|Weekly limit|Usage limit resets/.test(document.body.innerText)`,
}

async function khandan_safhe_ha() {
  if (process.env.RESET_SAFHE) return JSON.parse(readFileSync(process.env.RESET_SAFHE, 'utf8'))
  let bazkardam = false
  try { await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(4000) }) } catch (e) {
    execFileSync('/bin/zsh', [BAZ_KON, PORT], { timeout: 60000 }); bazkardam = true
    await new Promise((ok) => setTimeout(ok, 6000))
  }
  const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(8000) })).json()
  const ws = new WebSocket(v.webSocketDebuggerUrl); let id = 0; const pend = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } }
  await new Promise((ok, na) => { ws.onopen = ok; ws.onerror = () => na(new Error('وصل شدن به کروم نشد')); setTimeout(() => na(new Error('کروم جواب نداد')), 10000) })
  const send = (method, params = {}, sessionId) => new Promise((ok) => {
    const i = ++id; pend.set(i, ok)
    setTimeout(() => { if (pend.has(i)) { pend.delete(i); ok({ error: { message: 'بی‌جواب: ' + method } }) } }, had_farman_ms)
    ws.send(JSON.stringify({ id: i, method, params, sessionId }))
  })
  const arz = async (sid, expression) => (await send('Runtime.evaluate', { expression, returnByValue: true }, sid)).result?.result?.value
  const out = {}
  try {
    for (const [nam, url] of Object.entries(SAFHE)) {
      let t = await send('Target.createTarget', { url, background: true, windowState: 'minimized' })
      if (t.error) t = await send('Target.createTarget', { url, background: true })
      if (t.error) { out[nam] = { khata: 'تب باز نشد: ' + JSON.stringify(t.error).slice(0, 150) }; continue }
      const targetId = t.result.targetId
      try {
        const sid = (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId
        await send('Emulation.setFocusEmulationEnabled', { enabled: true }, sid)
        let amade = false
        for (let i = 0; i < sabr_safhe_ms / 3000 && !amade; i++) {
          await new Promise((ok) => setTimeout(ok, 3000))
          amade = (await arz(sid, AMADE[nam])) === true
          if (!amade && i === 9) await arz(sid, 'location.reload()')
        }
        await new Promise((ok) => setTimeout(ok, 2500))
        const txt = (await arz(sid, JS_MATN)) || ''
        const dokme = []
        for (const d of (await arz(sid, JS_DOKME)) || []) {
          // hover only: mouseMoved, never mousePressed
          let tooltip = ''
          for (let bar = 0; bar < 3 && !tooltip; bar++) {
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: d.x + bar, y: d.y + bar }, sid)
            await new Promise((ok) => setTimeout(ok, 2000))
            tooltip = (await arz(sid, JS_TOOLTIP)) || ''
          }
          dokme.push({ label: d.label, tooltip })
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }, sid)
          await new Promise((ok) => setTimeout(ok, 500))
        }
        out[nam] = { amade, txt, dokme, url: await arz(sid, 'location.href') }
      } finally { await send('Target.closeTarget', { targetId }) }
    }
  } finally {
    if (bazkardam) await send('Browser.close')
    ws.close()
  }
  return out
}

// ---- what the pages say ----------------------------------------------------------------------------------
const MAH = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
// «Expires Dec 11, 1:30 AM GMT+3:30» ⇒ epoch ms; the year is the first one that puts it after `alan - 2 days`
export function tarikh(matn, alan = Date.now()) {
  const m = String(matn).match(/([A-Z][a-z]{2})[a-z]* (\d{1,2})(?:, (\d{4}))?,? (?:at )?(\d{1,2}):(\d{2}) ?(AM|PM)?(?: GMT([+-]\d{1,2})(?::(\d{2}))?)?/)
  if (!m || !(m[1].toLowerCase() in MAH)) return null
  let h = +m[4] % (m[6] ? 12 : 24); if (m[6] === 'PM') h += 12
  const off = m[7] === undefined ? 210 : Math.sign(+m[7] || 1) * (Math.abs(+m[7]) * 60 + +(m[8] || 0))
  const saz = (y) => Date.UTC(y, MAH[m[1].toLowerCase()], +m[2], h, +m[5]) - off * 60000
  if (m[3]) return saz(+m[3])
  const y = new Date(alan).getUTCFullYear()
  return [y, y + 1].map(saz).find((t) => t > alan - 2 * 864e5) ?? saz(y)
}
const FA = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
// 01:30 is read as «the day after»; say whose night it is (Habib's side note, 11 Nov 22:02)
export function mohlat_fa(ms) {
  const s = FA.format(new Date(ms))
  const saat = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', hour12: false }).format(new Date(ms))
  if (saat >= 6) return s
  const shab = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ms - 864e5))
  return `${s} بامداد (یعنی ${shab}، آخرِ شب)`
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

export function estekhraj_claude(s, alan) {
  const txt = s?.txt || ''
  const ha = []
  for (const d of s?.dokme || []) {
    const e = (d.tooltip || '').match(/Expires[^|\n]*/)
    if (e && ha.some((h) => h.mohlat_matn === e[0].trim())) continue
    ha.push({ manba: 'claude', nam: d.label, mohlat_matn: e ? e[0].trim() : '', mohlat: e ? tarikh(e[0], alan) : null })
  }
  // an «Expires …» written on the page itself, with no button of its own
  for (const m of txt.matchAll(/^(.*)\n?(Expires [^\n]+)$/gm)) if (!ha.some((h) => h.mohlat_matn === m[2].trim())) ha.push({ manba: 'claude', nam: (m[1] || 'reset').trim().slice(0, 80) || 'reset', mohlat_matn: m[2].trim(), mohlat: tarikh(m[2], alan) })
  return { vaz: [txt.match(/\d+% used/)?.[0], txt.match(/Resets [^\n]+/)?.[0]].filter(Boolean).join('، '), ha }
}
export function estekhraj_chatgpt(s, alan) {
  const txt = s?.txt || ''
  const i = txt.indexOf('Usage limit resets')
  const bakhsh = i < 0 ? '' : txt.slice(i).split(/\nCredits\n/)[0]
  const khat = bakhsh.split('\n').map((x) => x.trim()).filter(Boolean)
  const ha = []
  khat.forEach((k, j) => { if (/^Expires /.test(k)) ha.push({ manba: 'chatgpt', nam: khat[j - 1] || 'reset', mohlat_matn: k, mohlat: tarikh(k, alan) }) })
  const mojud = bakhsh.match(/Available\n\s*(\d+)/)?.[1]
  // «Available 2» with one «Expires» line: the rest are still resets he has
  for (let n = ha.length; mojud !== undefined && n < +mojud; n++) ha.push({ manba: 'chatgpt', nam: `reset ${n + 1} (بی تاریخ)`, mohlat_matn: '', mohlat: null })
  return { vaz: [txt.match(/\d+% left/)?.[0], txt.match(/Resets in [^\n]+/)?.[0], mojud !== undefined ? `ریستِ موجود: ${mojud}` : ''].filter(Boolean).join('، '), ha }
}
export const shenase = (h) => h.mohlat_matn ? `${h.manba}|${h.mohlat_matn}` : `${h.manba}|${h.nam}`
const esm = { claude: 'Claude', chatgpt: 'ChatGPT' }

// ---- compare, report, alarm ------------------------------------------------------------------------------
export async function asli() {
  const alan = +(process.env.RESET_ALAN || Date.now())
  const safhe = await khandan_safhe_ha()
  const dide = existsSync(DIDE) ? JSON.parse(readFileSync(DIDE, 'utf8')) : { ha: {} }
  const khande = { claude: estekhraj_claude(safhe.claude, alan), chatgpt: estekhraj_chatgpt(safhe.chatgpt, alan) }
  // a page is «read» only when its own words are there; a login page or an empty one is an error
  const kharab = Object.keys(SAFHE).filter((n) => !khande[n].vaz)
  for (const n of kharab) say(`❌ صفحهٔ Usage ِ ${esm[n]} خوانده نشد: ${safhe[n]?.khata || (safhe[n]?.txt || '').slice(0, 120).replace(/\n/g, ' ') || 'خالی'}`)
  const hame = Object.keys(SAFHE).filter((n) => !kharab.includes(n)).flatMap((n) => khande[n].ha)
  const taze = hame.filter((h) => !dide.ha[shenase(h)])
  // gone from a page that was read: used or expired
  const nist = Object.entries(dide.ha).filter(([k, v]) => !v.raft && !kharab.includes(v.manba) && !hame.some((h) => shenase(h) === k))
  const rafte = nist.filter(([, v]) => (v.nabud || 0) >= 1)

  const rooz = new Date(alan).toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })
  const saat = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date(alan))
  const khat = (h) => `${esm[h.manba]}: «${h.nam}»${h.mohlat ? ` تا ${mohlat_fa(h.mohlat)}` : h.mohlat_matn ? ` (${h.mohlat_matn})` : ''}`
  const radif = [
    ...Object.keys(SAFHE).map((n) => `| ${esm[n]} | ${kharab.includes(n) ? '❌ خوانده نشد' : khande[n].vaz} | ${kharab.includes(n) ? '-' : khande[n].ha.length} |`),
  ]
  mkdirSync(GOZARESH_DIR, { recursive: true })
  const file = join(GOZARESH_DIR, rooz + '.md')
  appendFileSync(file, `${existsSync(file) ? '' : `# ریست‌های Claude و ChatGPT — ${rooz}\n`}\n## خوانده‌شده ساعتِ ${saat}\n\n| کجا | وضع | ریستِ موجود |\n|---|---|---|\n${radif.join('\n')}\n\n` +
    (hame.length ? hame.map((h) => `- ${dide.ha[shenase(h)] ? '' : '🆕 '}${khat(h)}`).join('\n') + '\n' : '') +
    (rafte.length ? rafte.map(([, v]) => `- ⏹ دیگر نیست (خرج شد یا مهلتش گذشت): ${khat(v)}`).join('\n') + '\n' : '') +
    (!taze.length && !rafte.length ? 'ریستِ تازه‌ای نبود.\n' : ''))

  if (!KHOSHK) {
    mkdirSync(ALARM_DIR, { recursive: true })
    for (const h of taze) dide.ha[shenase(h)] = { ...h, aval_dide: new Date(alan).toISOString() }
    for (const [k, v] of Object.entries(dide.ha)) if (!v.raft && !kharab.includes(v.manba)) v.nabud = nist.some(([n]) => n === k) ? (v.nabud || 0) + 1 : 0
    for (const [k] of rafte) dide.ha[k].raft = new Date(alan).toISOString()
    // one alarm entry per reset that has a deadline; alarm-reset.sh does the rest. Gone ⇒ its entry goes too
    for (const h of hame) if (h.mohlat) {
      const f = join(ALARM_DIR, slug(shenase(h)) + '.json')
      if (!existsSync(f)) writeFileSync(f, JSON.stringify({ shenase: shenase(h), nam: `${esm[h.manba]}: ${h.nam}`, mohlat: Math.round(h.mohlat / 1000), mohlat_fa: mohlat_fa(h.mohlat), url: SAFHE[h.manba] }, null, 1))
    }
    for (const [k] of rafte) for (const f of readdirSync(ALARM_DIR)) if (f.startsWith(slug(k) + '.')) rmSync(join(ALARM_DIR, f))
    writeFileSync(DIDE, JSON.stringify({ ...dide, akharin_ejra: new Date(alan).toISOString() }, null, 1))
  }

  const kholase = Object.keys(SAFHE).map((n) => `${esm[n]}: ${kharab.includes(n) ? 'خوانده نشد' : khande[n].ha.length + ' ریست'}`).join(' · ')
  if (taze.length) {
    const matn = `ریستِ تازه: ${taze.map(khat).join(' ؛ ')}`
    say(`🆕 ${matn}`)
    notif(`${taze.length} ریستِ تازه`, taze.map(khat).join(' ؛ '), 'KhabarNoskhe')
    panjere('ریستِ تازه پیدا شد', [...taze.map(khat), 'آلارمِ مهلتش خودکار ساخته شد.'])
    be_chat(`${matn}. آلارمِ مهلت خودکار ساخته شد (abzar/alarm-reset.d).`)
    bale(`🆕 ${matn}`)
  }
  if (rafte.length) say(`⏹ دیگر نیست: ${rafte.map(([, v]) => khat(v)).join(' ؛ ')}`)
  if (kharab.length) {
    const matn = `صفحهٔ Usage خوانده نشد: ${kharab.map((n) => esm[n]).join('، ')} (ورود پریده یا صفحه عوض شده)`
    notif('ریست‌ها: خطا', matn, 'KhabarNoskhe'); be_chat(matn); process.exitCode = 1
  }
  if (!taze.length && !kharab.length) { say(`تازه‌ای نبود — ${kholase}`); notif('ریست‌های Claude و ChatGPT', `امروز ریستِ تازه‌ای نبود — ${kholase}`) }
  return { khande, taze, rafte, kharab }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setTimeout(() => { say('❌ کل اجرا بیش از حد طول کشید'); notif('ریست‌ها: خطا', 'خواندنِ صفحه‌های Usage گیر کرد'); process.exit(3) }, had_kol_ms).unref()
  asli().then((r) => { if (KHOSHK) console.log(JSON.stringify({ khande: r.khande, taze: r.taze.map(shenase), rafte: r.rafte.map(([k]) => k), kharab: r.kharab }, null, 1)); process.exit(process.exitCode || 0) })
    .catch((e) => { say('❌ ' + String(e && e.stack || e).slice(0, 400)); notif('ریست‌ها: خطا', String(e && e.message || e).slice(0, 150), 'KhabarNoskhe'); process.exit(1) })
}
