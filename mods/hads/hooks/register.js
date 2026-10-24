// حدس: «دو جمله» is Sonnet 5.5 on the last messages, after each answer and (braked) after
// tools: cheap. The 3-5 guesses are one fork of the chat itself (its own model, the whole chat
// from the warm cache) every hads_har_chand_javab answers; Sonnet is their fallback. Each guess is a
// button above the prompt; a click fills the prompt box and never sends.
export const model_do_jomle_va_hads = 'claude-sonnet-5-5'
// Habib: «حدسو بذار مدل اصلی بکنه … منتها مثلاً چند تا پیام به چند تا پیام»
export const hads_har_chand_javab = 3
// answers seen per chat id since this process started: guesses are due on 1st, 4th, 7th…
const turnsOf = new Map()

const prompt_system_hads = [
  'You predict what the user (حبیب) will ask next in a Claude Code session.',
  'Give 1 or 2 items: what the user will most likely ask next, or an option the user has not',
  'thought of but that fit the user\'s pattern. Each item is ready to send as the user\'s own message,',
  'in plain Persian, in the user\'s tone. Reply ONLY with JSON: [{"label": "<= 3 words", "text": "<one line>"}].',
].join(' ')

let guesses = []
let busy = false
// the chat the guesses were made in: after /clear (a new id) they are not shown
let madeFor = ''

// «دو جمله»: what the agent is doing now, in Habib's words (the project's 00_vazhe_name.md),
// after each answer and, at most every do_jomle_fasele_ms ms, after a tool. One call at a time.
export const do_jomle_fasele_ms = 60000
// over this many tokens of chat even a warm fork costs too much: Sonnet on the last messages
export const had_fork_kontekst_token = 400000
// idle longer than this and the chat's cache is likely gone: «پرسش» warns first. The TTL is
// 1 h (Claude Code says so: «Prompt cache warm, about 58 min left»); a model switch tells
// the real one (classic.PostModelSwitch cache_ttl), a 5 min TTL makes it kash_sard_5m_ms.
export const kash_sard_ms = 55 * 60000
export const kash_sard_5m_ms = 4 * 60000
let coldAfter = kash_sard_ms
const prompt_system_do_jomle = [
  'In exactly two short sentences of plain Persian, tell حبیب what the agent in this Claude Code',
  'session is doing right now and what it is waiting for. Use the words of the glossary given, not',
  'technical terms. Do not guess what comes next. Reply with the two sentences only.',
].join(' ')
let now = { text: '', for: '' }
let nowBusy = false
let nowAgain = false
let lastNow = 0
// the end of an answer wins over a mid-work line still on its way
let endAt = 0
let endBusy = false
// an answer that ends while the last one is still told is told right after it, never dropped
let endAgain = false
// last time the chat itself talked to the model (an answer's end, a tool): the cache's age
let lastActivity = 0
// set by classic.SessionStart on a resume: Claude Code's own word that the cache is gone
let cacheExpired = false
// a «پرسش» that came before the fork had anything to read (resume, a turn still running):
// asked by itself when the next answer ends
let pendingAsk = null
// «بپرس»: a side question like /btw, answered by $.model.fork; never reaches the chat
let answer = null
let askText = ''

export function parseGuesses(raw) {
  try {
    const m = String(raw || '').match(/\[[\s\S]*\]/)
    const list = JSON.parse(m ? m[0] : raw)
    if (!Array.isArray(list)) return []
    return list
      .filter((g) => g && typeof g.label === 'string' && typeof g.text === 'string' && g.text.trim())
      .slice(0, 2)
      .map((g) => ({ label: g.label.trim().slice(0, 40), text: g.text.trim() }))
  } catch {
    return []
  }
}

const system_reminder_regex = /<system-reminder[\s\S]*?<\/system-reminder>/g
export const isAgent = (t) => /<cross-session-message|^\s*Another Claude session sent a message/.test(t)
// what starts a turn but is not Habib's: a task's or another chat's message, or what Claude Code sends
// by itself after a compact or a resume (205, 25 Oct: «Continue from where you left off.» was logged as
// his request). Such a turn has no new word of his: the summary says so
export const matn_bi_harfe_habib = 'حرفِ تازه‌ای از حبیب نبود؛ ادامهٔ کارِ قبلی'
export const harfeHabib = (t) => !t || isAgent(t) || /^\s*(<task-notification|Continue from where you left off|This session is being continued)/.test(t) ? matn_bi_harfe_habib : t

// Labelled context: Habib's own words, Claude's answers, and other agents'
// messages kept apart, so guesses follow Habib and still know the story.
export function buildPrompt(messages) {
  const cut = (s, n) => String(s).slice(0, n)
  const users = [], agents = []
  for (const m of messages) {
    if (m.role !== 'user' || !m.text) continue
    if (isAgent(m.text)) { agents.push(m.text); continue }
    const own = m.text.replace(system_reminder_regex, '').trim()
    if (own) users.push(own)
  }
  const answers = messages.filter((m) => m.role === 'assistant' && m.text).slice(-5)
  return '## درخواست‌های حبیب (قدیمی به جدید)\n' +
    users.slice(-12).map((t, i) => (i + 1) + '. ' + cut(t, 1500)).join('\n') +
    '\n\n## جواب‌های کلود\n' + answers.map((m) => '- ' + cut(m.text, 1200)).join('\n') +
    '\n\n## پیامِ ایجنتِ دیگر، نه حبیب\n' + (agents.slice(-3).map((t) => '- ' + cut(t, 1200)).join('\n') || '(هیچ)')
}

// .remember handoffs of this project: now, today, last seven days.
async function handoffs($) {
  const dir = '.remember/'
  const read = async (f) => { try { return String(await $.fs.read(dir + f)).slice(0, 3000) } catch { return '' } }
  let today = ''
  try {
    const names = (await $.fs.list(dir)).map((x) => x.name).filter((n) => /^today-.*\.md$/.test(n) && !n.includes('.done')).sort()
    if (names.length) today = await read(names[names.length - 1])
  } catch {}
  const parts = [['الان', await read('now.md')], ['امروز', today], ['هفت روزِ اخیر', await read('recent.md')]]
    .filter(([, t]) => t.trim())
  return parts.length ? '## هندآف‌های این پروژه\n' + parts.map(([k, t]) => '### ' + k + '\n' + t).join('\n') : ''
}

async function guess($) {
  if (busy) return
  busy = true
  try {
    const r = await $.model.complete({
      model: model_do_jomle_va_hads, system: prompt_system_hads,
      // handoffs first, cached: they change rarely between answers
      prompt: [{ text: (await handoffs($)) || '(no handoff)', cache: true }, { text: buildPrompt(await $.session.messages()) }],
      maxTokens: 600, timeoutMs: 60000,
    })
    guesses = r.isAnswered ? parseGuesses(r.text) : []
    if (guesses.length) await logEvent($, 'hads', { rah: 'sonnet', hads_ha: guesses.map((g) => g.text) })
    if (r.isAnswered) try { await $.store.set('kharj_akhar_hads_sonnet', r.usage) } catch {}
    if (r.isAnswered) await logUsage($, 'hads', 'sonnet', r.usage)
    madeFor = await $.session.id()
    $.ui.invalidate('ui.render')
  } catch {
    guesses = []
  } finally {
    busy = false
  }
}

// only the parts ticked on are asked for: fewer output tokens
const prompt_fork_do_jomle = '"do_jomle": "<exactly two short sentences of plain Persian: what the agent in this chat is doing now and what it waits for, in حبیب\'s own words from the glossary below>"'
const prompt_fork_hads = '"hads": [1 or 2 of {"label": "<= 3 words", "text": "<one line, ready to send as حبیب\'s next message, in his tone>"}]'
const forkPrompt = (p) => '(این پیام از مودِ «حدس» است، نه از حبیب؛ کاری نکن و ابزاری صدا نزن.) Reply ONLY with JSON: {' +
  [p.do_jomle && prompt_fork_do_jomle, p.hads && prompt_fork_hads].filter(Boolean).join(', ') + '}'

// {do_jomle, hads} from the fork's reply; null when it has neither
export function parseBoth(raw) {
  try {
    const m = String(raw || '').match(/\{[\s\S]*\}/)
    const o = JSON.parse(m ? m[0] : raw)
    const n = typeof o?.do_jomle === 'string' ? twoSentences(o.do_jomle) : ''
    const g = Array.isArray(o?.hads) ? parseGuesses(JSON.stringify(o.hads)) : []
    return n || g.length ? { do_jomle: n, hads: g } : null
  } catch {
    return null
  }
}

// $ per million tokens written to the cache (5 min, 1 h), for the cold «بپرس» warning
const gheymat_kash_neveshtan_usd = { 'opus-5-5': [5, 8], 'sonnet-5-5': [2.5, 4], 'haiku-5-5': [0.125, 0.2] }
export function coldCost(model, tokens) {
  const k = Object.keys(gheymat_kash_neveshtan_usd).find((x) => String(model).includes(x)) || 'opus-5-5'
  return gheymat_kash_neveshtan_usd[k].map((p) => (tokens * p) / 1e6)
}

// «قبلی‌ها»: every «دو جمله» with its time, this chat only (~/.claude/hads-log/<id>.do_jomle_ghablia.jsonl,
// the last had_ghablia_tedad); newest first on screen
export const had_ghablia_tedad = 50
const histPath = async ($) => (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.do_jomle_ghablia.jsonl'
// the file's name before 25 Oct (تعریفِ ۱۰): read when the new one is not there yet
const histPathGhadim = async ($) => (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.now.jsonl'
async function readHist($) {
  for (const f of [await histPath($), await histPathGhadim($)]) {
    try { return String(await $.fs.read(f)).split('\n').filter(Boolean).map((l) => JSON.parse(l)).reverse() } catch {}
  }
  return []
}
// «دفترِ حدس» (with چتِ ۲۰۵, 24 Oct): every «دو جمله», guess, «پرسش» and what Habib did with a
// guess, one JSON line each in ~/.claude/hads-log/<id>.events.jsonl — no cap, appended, never
// read back here (a 4 MB read limit would cut a long chat). Their memory index reads it; only
// «پرسش» and a guess Habib sent go to search, never «دو جمله» or an unsent guess.
async function logEvent($, kind, data) {
  try {
    const t = await $.clock.now(), sid = await $.session.id()
    const d = new Date(t + 3.5 * 3600e3)
    const iso = d.toISOString().replace('Z', '+03:30')
    const f = (await $.env.get('HOME')) + '/.claude/hads-log/' + sid + '.events.jsonl'
    const line = JSON.stringify({ t, iso, sid, kind, ...data }) + '\n'
    await $.process.run(['sh', '-c', 'mkdir -p "$(dirname "$1")" && cat >> "$1"', 'sh', f], { stdin: line, timeoutMs: 5000 })
  } catch {}
}
// a «دو جمله» that says what the last one said is not logged again (205: so the log stays readable)
export function sameText(a, b) {
  const w = (x) => new Set(String(x || '').split(/\s+/).filter((y) => y.length > 1))
  const A = w(a), B = w(b)
  if (!A.size || !B.size) return false
  let n = 0; for (const x of A) if (B.has(x)) n++
  return n / Math.max(A.size, B.size) >= 0.8
}
// per chat id: one process may serve more than one chat (/clear makes a new id)
const lastLogged = new Map()
// guesses pressed into the prompt box, to know at Enter which one Habib sent
let clicked = []

// every «دو جمله» of the turn now running, per chat: the end of the answer sums them up
const turnNows = new Map()
async function setNow($, text, kind = 'do_jomle') {
  const id = await $.session.id()
  if (kind === 'do_jomle') turnNows.set(id, [...(turnNows.get(id) || []), text].slice(-40))
  now = { text, for: id }; $.ui.invalidate('ui.render')
  if (kind !== 'jambandi_nobat' && !sameText(text, lastLogged.get(id))) { lastLogged.set(id, text); await logEvent($, 'do_jomle', { text }) }
  try {
    const old = (await readHist($)).reverse().map((x) => JSON.stringify(x))
    await $.fs.write(await histPath($), old.slice(-(had_ghablia_tedad - 1)).concat(JSON.stringify({ t: await $.clock.now(), text })).join('\n') + '\n')
  } catch {}
}
// Tehran time (+03:30, no DST), as Habib writes dates: «۲۴ اکت ۱۸:۵۷»
const mah_miladi = ['ژان', 'فور', 'مار', 'آور', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپت', 'اکت', 'نوا', 'دسا']
const fa = (x) => String(x).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
export function when(t) {
  const d = new Date(t + 3.5 * 3600e3)
  const two = (x) => String(x).padStart(2, '0')
  return fa(d.getUTCDate()) + ' ' + mah_miladi[d.getUTCMonth()] + ' ' + fa(two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()))
}

// Whatever the model says, at most two sentences are shown. A sentence ends at . ! ? ؟
// followed by a space: the dot inside register.js or v2.10 ends nothing. Never past had_do_jomle_harf.
// Shamsi (Jalali) date and Tehran time, Persian digits: «۳ آبان ۱۴۰۵ ۲۰:۰۹». Habib: «اگر که
// ساعت تاریخ شمسی باشه چه بهتر». Tehran is +03:30 all year (no DST since 1401).
const mah_shamsi = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
export function jalali(gy, gm, gd) {
  const g = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const gy2 = gm > 2 ? gy + 1 : gy
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g[gm - 1]
  let jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053
  jy += 4 * Math.floor(days / 1461); days %= 1461
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365 }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return [jy, jm, jd]
}
export function whenFa(t) {
  if (!t) return ''
  const d = new Date(t + 3.5 * 3600e3)
  const [jy, jm, jd] = jalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0')
  return fa(jd + ' ' + mah_shamsi[jm - 1] + ' ' + jy + ' ' + hh + ':' + mm)
}

export const had_do_jomle_harf = 300
export function twoSentences(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?؟]) /).slice(0, 2).join(' ')
  return t.length > had_do_jomle_harf ? t.slice(0, had_do_jomle_harf - 1) + '…' : t
}

async function vazhe($) {
  for (const f of ['Doc/tarif/00_vazhe_name.md', 'doc/tarif/00_vazhe_name.md']) {
    try { return '## واژه‌نامهٔ حبیب\n' + String(await $.fs.read((await $.session.root()) + '/' + f)).slice(0, 6000) } catch {}
  }
  return '(no glossary: plain Persian)'
}

// Sonnet on the last three messages only: cheap enough to run every do_jomle_fasele_ms during work
// every model call of this chat, one JSON line each (~/.claude/hads-log/<id>.usage.jsonl,
// the last 500): the real cost per part, read by `hads-kharj`
async function logUsage($, bakhsh, rah, usage) {
  try {
    const f = (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.usage.jsonl'
    // appended, never read and rewritten: two calls ending together would each drop the other's line
    const line = JSON.stringify({ t: await $.clock.now(), bakhsh, rah, usage }) + '\n'
    await $.process.run(['sh', '-c', 'mkdir -p "$(dirname "$1")" && cat >> "$1"', 'sh', f], { stdin: line, timeoutMs: 5000 })
  } catch {}
}

// «دو جمله» reads the last three messages and, always, Habib's last two: deep in a long answer
// the last three are all the agent's, and his request was missing (24 Oct)
export function recent(msgs) {
  const last = msgs.slice(-3)
  const his = msgs.filter((m) => m.role === 'user' && m.text && !isAgent(m.text) && m.text.replace(system_reminder_regex, '').trim()).slice(-2)
  return msgs.filter((m) => last.includes(m) || his.includes(m))
}

async function tellNow($, tool, force, viaFork = false) {
  // an answer's end while a mid-work line is on its way: told right after it, never dropped
  if (nowBusy) { if (force) nowAgain = true; return }
  const t = await $.clock.now()
  if (!force && t - lastNow < do_jomle_fasele_ms) return
  nowBusy = true; lastNow = t
  try {
    let done = false
    if (viaFork) {
      const r = await $.model.fork({ prompt: forkPrompt({ do_jomle: true }) + '\n\n' + (await vazhe($)) })
      const got = r.isAnswered ? parseBoth(r.text) : null
      if (r.isAnswered) await logUsage($, 'do_jomle', 'fork', r.usage)
      // no early return: a queued answer-end line (nowAgain) must still be told below
      if (got?.do_jomle && endAt <= t) { await setNow($, got.do_jomle, force ? 'akhar_javab' : 'do_jomle'); done = true }
    }
    if (!done) {
    const r = await $.model.complete({
      model: model_do_jomle_va_hads, system: prompt_system_do_jomle,
      prompt: [{ text: await vazhe($), cache: true },
        { text: buildPrompt(recent(await $.session.messages())) + (tool ? '\n\n## ابزاری که همین الان تمام شد\n' + tool : '') }],
      maxTokens: 200, timeoutMs: 30000,
    })
    // an answer's end started after this call: its line stands
    if (r.isAnswered && endAt <= t) {
      // only lines written during the work belong to the turn's summary, not the answer's last one
      await setNow($, twoSentences(r.text), force ? 'akhar_javab' : 'do_jomle')
      try { await $.store.set('kharj_akhar_do_jomle', r.usage) } catch {}
    }
    if (r.isAnswered) await logUsage($, 'do_jomle', 'sonnet', r.usage)
    }
  } catch {} finally {
    nowBusy = false
  }
  if (nowAgain) { nowAgain = false; await tellNow($, '', true) }
}

async function small($) {
  try { return ((await $.session.usage()).context.tokens || 0) <= had_fork_kontekst_token } catch { return false }
}

// The end of an answer. «دو جمله»: Sonnet on the last messages, every answer (cheap).
// The guesses: one fork over the whole chat (its own model, the cache this answer just
// warmed) every hads_har_chand_javab answers; a chat over had_fork_kontekst_token, or no usable reply, asks Sonnet.
async function turnEnd($, p = { hads: true, do_jomle: true }, force = false) {
  if (!p.hads && !p.do_jomle) return
  if (endBusy) { endAgain = true; return }
  endBusy = true; endAt = await $.clock.now()
  try {
    const id = await $.session.id()
    const seen = turnsOf.get(id) || 0
    turnsOf.set(id, seen + 1)
    // also due when this chat shows none (first answer, /clear, an empty or broken reply)
    const due = p.hads && (force || seen % hads_har_chand_javab === 0 || madeFor !== id || !guesses.length)
    await Promise.all([p.do_jomle && (async () => { if (!(await summarize($))) await tellNow($, '', true) })(), due && guessFork($)])
  } finally {
    endBusy = false
  }
  // turned off meanwhile: the queued run is dropped, never run on the old flags
  if (endAgain) { endAgain = false; const q = await readFlag($); if (q) await turnEnd($, q) }
}

// The end of an exchange (Habib, 24 Oct 22:42: «دو جمله … عکس لحظه ای میگیره … جمع بندی نداره …
// بعد از رفت و برگشت کل اینا رو بده به … یه ایجنت با کشه گرم که … جمعبندی کنه»): one fork of the
// chat itself (warm cache: the answer was just sent) gets every «دو جمله» of this turn and says
// what was done and what was not. Shown in place of «دو جمله» and logged as jambandi_nobat.
// No tool and no line, or no usable reply: the plain Sonnet «دو جمله», as before. Any size of
// chat is summed up by its own fork (24 Oct 23:37): it is injected into later chats' memory.
// a turn is summed up when the agent did work in it: a tool ran, or «دو جمله» was written.
// (v7 asked for 2 lines; «دو جمله» comes at most once a minute, so most turns had 0-1 and the
// real chat ۲۰۳ never got one — 24 Oct 22:58)
export const had_kamtarin_do_jomle_jambandi = 1
// tools run in the turn now running, per chat
const turnTools = new Map()
// Habib's own message that started the turn, per chat
const turnAsked = new Map()
const prompt_jambandi_nobat = (lines, tools) => '(این پیام از مودِ «حدس» است، نه از حبیب؛ کاری نکن و ابزاری صدا نزن.) ' +
  'جمع‌بندیِ همین نوبت را بده؛ این جمع‌بندی به حافظهٔ چت‌های بعدی تزریق می‌شود، پس باید بی‌اشتباه باشد. ' +
  'منبع: کلِ همین نوبت در حافظهٔ خودت، از آخرین پیامِ حبیب تا حالا: پیامِ حبیب، هر فراخوانیِ ابزار و خروجی‌اش، و جوابت. ' +
  (lines.length ? 'این «دو جمله»‌ها وسطِ کار نوشته شده‌اند؛ فقط راهنما‌اند، منبع نیستند:\n' + lines.map((l, i) => (i + 1) + ') ' + l).join('\n') + '\n' : '') +
  (tools.length ? 'فهرستِ ابزارهای این نوبت (خروجی‌شان را از حافظهٔ خودت بخوان):\n' + tools.map((l) => '- ' + l).join('\n') + '\n' : '') +
  '\nقاعده‌ها: ' +
  '۱) در anjam_shod فقط چیزی که خروجیِ یک ابزار در همین نوبت ثابتش کرد، و ته هر کدام مدرکش بعد از «⇐» (مثلاً «نگهبان روشن است ⇐ pgrep: 36459»). ' +
  '۲) پیشنهاد، نیت، کاری که فقط گفته شد، یا چیزی که از نوبت‌های قبل می‌دانستی ⇒ anjam_shod نیست. ' +
  '۳) نامطمئن یا سنجیده‌نشده ⇒ anjam_nashod با «چک نشد». ' +
  '۴) عدد، ساعت، اسمِ فایل و commit فقط اگر عیناً در خروجیِ یک ابزارِ همین نوبت آمده. ' +
  '۵) هر خواستهٔ حبیب در همین نوبت که انجام نشد ⇒ anjam_nashod. ' +
  '۶) مدرک فقط همان چیزی را ثابت می‌کند که خودش نشان می‌دهد: ویرایشِ کد ⇒ «کد اضافه شد»، نه «کار می‌کند»؛ رفتار فقط با آزمونی که همان رفتار را دید ⇒ وگرنه anjam_nashod «رفتارش آزموده نشد». فارسیِ ساده، با واژه‌های حبیب. ' +
  'Reply ONLY with JSON: {"text": "<at most two short sentences: the whole turn>", "anjam_shod": ["<short> ⇐ <evidence>", …], "anjam_nashod": ["<short>", …]}'
export function parseSummary(raw) {
  try {
    const m = String(raw || '').match(/\{[\s\S]*\}/)
    const o = JSON.parse(m ? m[0] : raw)
    const list = (x) => (Array.isArray(x) ? x : []).filter((y) => typeof y === 'string' && y.trim()).map((y) => y.trim()).slice(0, 8)
    const text = typeof o?.text === 'string' ? twoSentences(o.text) : ''
    return text ? { text, anjam_shod: list(o.anjam_shod), anjam_nashod: list(o.anjam_nashod) } : null
  } catch {
    return null
  }
}
async function summarize($) {
  const id = await $.session.id()
  const lines = turnNows.get(id) || []
  const tools = turnTools.get(id) || []
  const asked = turnAsked.get(id) || ''
  turnNows.set(id, []); turnTools.set(id, [])
  if (lines.length < had_kamtarin_do_jomle_jambandi && !tools.length) return false
  let tokens = 0
  try { tokens = (await $.session.usage()).context.tokens || 0 } catch {}
  try {
    // always the chat itself with its warm cache, whatever its size: only it has read every tool's
    // output (Habib, 24 Oct 23:37: «با مدل اصلی که با کش گرم کار میکنه»; Sonnet on the last few
    // messages got turns wrong). No usable reply: no summary, the plain «دو جمله».
    const r = await $.model.fork({ prompt: prompt_jambandi_nobat(lines, tools) })
    if (r.isAnswered) await logUsage($, 'jambandi_nobat', 'fork', r.usage)
    const got = r.isAnswered ? parseSummary(r.text) : null
    if (!got) return false
    await setNow($, got.text, 'jambandi_nobat')
    now.summary = got
    // what Habib asked in this turn, word for word from his own message (not the model's retelling)
    await logEvent($, 'jambandi_nobat', { khaste_habib: asked.slice(0, 300), text: got.text, anjam_shod: got.anjam_shod, anjam_nashod: got.anjam_nashod, tedad_do_jomle: lines.length, tedad_abzar: tools.length, rah: 'fork', kontekst_token: tokens })
    return true
  } catch {
    return false
  }
}

async function guessFork($) {
  let got = null
  let tokens = 0
  try { tokens = (await $.session.usage()).context.tokens || 0 } catch {}
  if (tokens <= had_fork_kontekst_token) {
    try {
      const r = await $.model.fork({ prompt: forkPrompt({ hads: true }) })
      got = r.isAnswered ? parseBoth(r.text) : null
      if (got?.hads.length) try { await $.store.set('kharj_akhar_hads_fork', { rah: 'fork', kontekst_token: tokens, usage: r.usage }) } catch {}
      if (r.isAnswered) await logUsage($, 'hads', 'fork', r.usage)
    } catch {}
  }
  if (got?.hads.length) {
    guesses = got.hads; madeFor = await $.session.id()
    await logEvent($, 'hads', { rah: 'fork', hads_ha: guesses.map((g) => g.text) })
    $.ui.invalidate('ui.render')
  } else await guess($)
}

const matn_porsesh_montazer = 'این پرسش بعد از جوابِ بعدیِ کلود در همین چت خودش پرسیده می‌شود (بعد از resume یا وسطِ کار، تا اولین جواب چیزی برای خواندن نیست).'
const matn_dalil_bi_javab = {
  'nothing-to-fork': 'این چت هنوز چیزی ندارد (مثلاً تازه /clear شده)؛ اول یک پیام بفرست.',
  'api-error': 'خطا از سمتِ Claude؛ دوباره بپرس.',
  'empty-reply': 'جوابی نیامد؛ دوباره بپرس.',
  aborted: 'نیمه‌کاره ماند؛ دوباره بپرس.',
}
async function ask($, q) {
  if (!String(q).trim()) return
  // off in this chat, or «پرسش» unticked: nothing would be drawn, so no fork is paid for
  if (!(await readFlag($))?.porsesh) return
  const id = await $.session.id()
  // a cold cache re-reads the whole chat at the write price: say how much, ask Enter again.
  // Known only from this process's own activity or the resume's numbers; no word means no warning
  // is claimed as fact.
  const idle = lastActivity ? (await $.clock.now()) - lastActivity : -1
  const cold = cacheExpired || idle > coldAfter
  if ((cold || idle < 0) && !(answer?.cold && answer.q === q && answer.for === id)) {
    let tokens = 0, model = ''
    try { tokens = (await $.session.usage()).context.tokens || 0 } catch {}
    try { model = await $.session.model() } catch {}
    if (tokens > 0) {
      const [a, b] = coldCost(model, tokens)
      const cost = '$' + a.toFixed(2) + ' تا $' + b.toFixed(2) + ' (' + Math.round(tokens / 1000) + 'k توکن)'
      answer = { q, for: id, cold: true,
        text: (cold ? 'کشِ چت سرد است (' + Math.round(idle / 60000) + ' دقیقه بی‌کار' + (cacheExpired ? '، به گفتهٔ خودِ Claude Code' : '') + '): این سؤال حدودِ ' + cost + ' خرج دارد.'
          : 'نمی‌دانم کشِ چت گرم است یا نه؛ اگر سرد باشد این سؤال حدودِ ' + cost + ' خرج دارد.') + ' برای پرسیدن «باشه، بپرس» یا دوباره Enter را بزن.' }
      $.ui.invalidate('ui.render')
      return
    }
  }
  // this question's own box: × or a newer question may replace `answer` while the fork runs
  const cur = answer = { q, text: '…', for: id }; askText = ''; $.ui.invalidate('ui.render')
  try {
    // mid-work the fork sees a tool call in flight and may try to go on with it: say it may not
    const r = await $.model.fork({ prompt: q + '\n\n(این پرسش از کادرِ حدس است، نه دستورِ کار: ابزاری صدا نزن و کاری را ادامه نده؛ فقط کوتاه، به فارسیِ ساده و با واژه‌های حبیب جواب بده.)' })
    // nothing to read yet, though the chat has a story: wait for the next answer, then ask
    let has = false
    if (!r.isAnswered && r.reason === 'nothing-to-fork') {
      try { has = ((await $.session.usage()).context.tokens || 0) > 0 || (await $.session.messages()).length > 0 } catch {}
    }
    if (has) { pendingAsk = q; cur.text = matn_porsesh_montazer; cur.waiting = true; await logEvent($, 'porsesh_montazer', { porsesh_matn: q }) }
    else cur.text = r.isAnswered ? r.text : (matn_dalil_bi_javab[r.reason] || 'جوابی نیامد (' + r.reason + ')؛ دوباره بپرس.')
    // the fork just read the whole chat into the cache: it is warm for the next question
    if (r.isAnswered) { try { lastActivity = await $.clock.now() } catch {} cacheExpired = false }
    if (r.isAnswered) await logEvent($, 'porsesh', { porsesh_matn: q, javab_matn: r.text, rah: 'fork' })
    if (r.isAnswered) try { await $.store.set('kharj_akhar_porsesh', r.usage) } catch {}
    if (r.isAnswered) await logUsage($, 'porsesh', 'fork', r.usage)
  } catch {
    cur.text = matn_dalil_bi_javab.aborted
  }
  if (answer === cur) $.ui.invalidate('ui.render')
}

// No app attached (claude -p, SDK) means nobody sees the row: skip the model call.
async function interactive($) {
  try {
    const s = await $.session.surfaces()
    return !Array.isArray(s) || s.length > 0
  } catch {
    return true
  }
}

// Keep what is already typed: the guess goes on its own line after it.
async function fillAppend($, text) {
  let cur = ''
  try {
    const v = await $.prompt.read()
    cur = typeof v === 'string' ? v : String(v?.text ?? '')
  } catch {}
  return $.prompt.fill({ text: cur.trim() ? cur + '\n' + text : text })
}

// on/off is per chat: one file per session id (~/.claude/hads-on/<id>), so no chat can
// switch another, not even one in the same folder. One file each, not $.store: the store
// is one JSON file every open chat rewrites. A new id (/clear, a new chat) starts off.
const flagPath = async ($) => (await $.env.get('HOME')) + '/.claude/hads-on/' + (await $.session.id())
// The file holds `on`, then the parts ticked off: `on -hads -porsesh`. h-on turns all of them on.
export const bakhsh_ha = [['hads', 'حدس'], ['do_jomle', 'دو جمله'], ['porsesh', 'پرسش'], ['hook', 'هوک‌ها']]
// every word the chat's file may hold, written out whole so grep finds each one (تعریفِ ۱۰: no
// name glued from pieces): a part ticked off, and the other settings
export const kalame_khamush = { hads: '-hads', do_jomle: '-do_jomle', porsesh: '-porsesh', hook: '-hook' }
export const kalame_tanzim = { do_jomle_fork: '+do_jomle_fork', yek_khat: 'yek_khat', tak_dokme: 'tak_dokme', hook_bozorg: 'hook_bozorg' }
// names used before 25 Oct 2026 (تعریفِ ۱۰): old lines and old files are never rewritten; whoever
// reads them (this mod, the chat 205 index) turns each old name into the new one with this table
export const esm_ghadim = {
  kalame_file: { '-guess': '-hads', '-now': '-do_jomle', '-ask': '-porsesh', '-hooks': '-hook', '+midfork': '+do_jomle_fork', min: 'yek_khat', dot: 'tak_dokme', hookbig: 'hook_bozorg' },
  kind_daftar: { now: 'do_jomle', guess: 'hads', guess_click: 'hads_zadan', guess_sent: 'hads_ferestade', ask: 'porsesh', ask_wait: 'porsesh_montazer', turn_summary: 'jambandi_nobat' },
  khane_daftar: { items: 'hads_ha', guess: 'hads_matn', sent: 'matn_ferestade', edited: 'virayesh_shod', q: 'porsesh_matn', a: 'javab_matn', asked: 'khaste_habib', done: 'anjam_shod', not_done: 'anjam_nashod', from: 'tedad_do_jomle', tools: 'tedad_abzar', via: 'rah', tokens: 'kontekst_token' },
  bakhsh_kharj: { now: 'do_jomle', guess: 'hads', ask: 'porsesh', summary: 'jambandi_nobat' },
  khane_kharj: { part: 'bakhsh', via: 'rah' },
}
async function readFlag($) {
  try {
    // a file written before 25 Oct holds the old words: read as the new ones
    const w = String(await $.fs.read(await flagPath($))).trim().split(/\s+/).map((x) => esm_ghadim.kalame_file[x] || x)
    if (w[0] !== 'on') return null
    return { ...Object.fromEntries(bakhsh_ha.map(([k]) => [k, !w.includes(kalame_khamush[k])])),
      ...Object.fromEntries(Object.entries(kalame_tanzim).map(([k, kalame]) => [k, w.includes(kalame)])) }
  } catch {
    return null
  }
}
const isOn = async ($) => (await readFlag($)) !== null
const flagWords = (p) => ['on', ...bakhsh_ha.filter(([k]) => !p[k]).map(([k]) => kalame_khamush[k]), ...Object.entries(kalame_tanzim).filter(([k]) => p[k]).map(([, kalame]) => kalame)].join(' ')
// ▾ / ▸: the whole band folds to one line and stays so after a reload (the word `yek_khat`)
// three states (Habib, 24 Oct 22:52: «سه حالته، یکی حالت باز، یکی حالت مثل الان … یه حالتی هم که
// بشه اصلا یه دکمه»): open (baz) · folded to one line (yek_khat) · just one small button (tak_dokme).
// The button opens the folded line; the line opens the box. Kept in the chat's file over reloads.
async function setMode($, mode) {
  const p = await readFlag($)
  if (!p) return
  p.yek_khat = mode === 'yek_khat'; p.tak_dokme = mode === 'tak_dokme'
  await $.fs.write(await flagPath($), flagWords(p))
  $.ui.invalidate('ui.render')
}
const fold = ($) => readFlag($).then((p) => p && setMode($, p.yek_khat ? 'baz' : 'yek_khat'))
let histOpen = false

// «هوک‌ها»: the VS Code panel drops every hook_* message on purpose (extension.js filters
// subtype hook_ out, the webview has no view for them), so the band shows what the hooks
// injected, read from the transcript the CLI writes: the attachments of type hook_success,
// hook_additional_context and hook_system_message since the last prompt, and the last
// SessionStart's. A transcript passes $.fs.read's 4 MiB and its tail is mostly request blobs,
// so grep keeps only hook attachments and typed prompts, and of those the last had_hook_transcript_khat lines.
export const had_hook_transcript_khat = 400
export const had_hook_transcript_byte = 4000000
export const hook_transcript_grep = '"attachment":\\{"type":"hook_|"type":"user","message":\\{"role":"user","content":("|\\[\\{"type":"text")'
// one line each: the Shamsi date and time first (~۲۰ characters), then the hook
export const had_hook_kuchak_harf = 100
let tPath = ''
let hooks = { list: [], for: '' }
let hooksAt = 0
export function parseHooks(text) {
  const lines = String(text || '').split('\n')
  const all = []
  let lastPrompt = -1
  for (const l of lines) {
    let o
    try { o = JSON.parse(l) } catch { continue }
    const a = o.attachment
    if (a && typeof a === 'object' && typeof a.type === 'string' && a.type.startsWith('hook_')) {
      const body = Array.isArray(a.content) ? a.content.join('\n') : String(a.content ?? '')
      if (body.trim() && ['hook_success', 'hook_additional_context', 'hook_system_message'].includes(a.type)) {
        const t = Date.parse(o.timestamp)
        all.push({ name: a.hookName || a.hookEvent || a.type, kind: a.type, text: body.trim(), t: Number.isFinite(t) ? t : 0 })
      }
      continue
    }
    // a prompt the person (or another chat) sent, not a tool result
    if (o.type === 'user' && !o.isMeta) {
      const c = o.message?.content
      const typed = typeof c === 'string' || (Array.isArray(c) && c.some((b) => b?.type === 'text'))
      if (typed) lastPrompt = all.length
    }
  }
  const since = lastPrompt < 0 ? all : all.slice(lastPrompt)
  const start = all.filter((h) => /^SessionStart/.test(h.name)).slice(-3)
  // the same hook with the same text (a reminder after every Bash) is one line with ×n
  const out = []
  for (const h of [...start.filter((x) => !since.includes(x)), ...since]) {
    const twin = out.find((x) => x.name === h.name && x.text === h.text)
    // a repeated hook keeps the time of its latest run
    if (twin) { twin.n++; twin.t = Math.max(twin.t, h.t) }
    else out.push({ ...h, n: 1 })
  }
  return out
}
// on screen: the last had_hook_kuchak_radif of them
export const had_hook_kuchak_radif = 6
export const had_hook_bozorg_radif = 3
export const had_hook_bozorg_harf = 600
async function readHooks($) {
  try {
    const t = await $.clock.now()
    if (t - hooksAt < 2000) return
    hooksAt = t
    let path = tPath
    if (!path) {
      const slug = String(await $.session.cwd()).replace(/[^a-zA-Z0-9]/g, '-')
      path = (await $.env.get('HOME')) + '/.claude/projects/' + slug + '/' + (await $.session.id()) + '.jsonl'
    }
    // only the file's last had_hook_transcript_byte are searched: a long chat's transcript is hundreds of MB,
    // and this runs after tools. The first line of the cut is half a line; parseHooks skips it.
    const r = await $.process.run(['sh', '-c', 'tail -c "$4" "$2" | grep -E "$1" | tail -n "$3"', 'sh', hook_transcript_grep, path, String(had_hook_transcript_khat), String(had_hook_transcript_byte)])
    if (r.exitCode !== 0) return
    hooks = { list: parseHooks(r.stdout), for: await $.session.id() }
    $.ui.invalidate('ui.render')
  } catch {}
}
const hookLine = (h) => (h.t ? whenFa(h.t) + ' · ' : '') + h.name + (h.n > 1 ? ' ×' + fa(h.n) : '') + (h.kind === 'hook_additional_context' ? ' ＋ ' : h.kind === 'hook_system_message' ? ' 📌 ' : ' ✓ ') + h.text.replace(/\s+/g, ' ')
async function tick($, key) {
  const p = await readFlag($)
  if (!p) return
  p[key] = !p[key]
  await $.fs.write(await flagPath($), flagWords(p))
  if (!p.hads) guesses = []
  if (!p.do_jomle) now = { text: '', for: '' }
  if (!p.porsesh) { answer = null; pendingAsk = null }
  $.ui.invalidate('ui.render')
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'hads', description: 'حدس: on | off | now | ask <پرسش>', argumentHint: '[on|off|now|ask …]', immediate: true })
    } catch {}
    return next(e)
  })

  // resume / fork: Claude Code says how long the chat was idle and whether its cache expired
  on('classic.SessionStart', async ($, e, next) => {
    try {
      if (typeof e.transcript_path === 'string') tPath = e.transcript_path
      if (typeof e.seconds_since_last_response === 'number') lastActivity = (await $.clock.now()) - e.seconds_since_last_response * 1000
      cacheExpired = e.prompt_cache_likely_expired === true
    } catch {}
    return next(e)
  })
  // a model switch tells the TTL; the new model's cache starts cold
  on('classic.PostModelSwitch', async ($, e, next) => {
    try {
      coldAfter = e.cache_ttl === '5m' ? kash_sard_5m_ms : kash_sard_ms
      if (e.from_model !== e.to_model) cacheExpired = true
    } catch {}
    return next(e)
  })

  on('command.run', { command: 'hads' }, async ($, e) => {
    const arg = (e.args || '').trim()
    if (arg === 'off' || arg === 'on') {
      await $.fs.write(await flagPath($), arg)
      if (arg === 'off') { guesses = []; now = { text: '', for: '' }; answer = null; pendingAsk = null }
      // nothing to tell yet: say when it comes (no fork here, the cache may be cold)
      else { now = { text: 'حدس روشن شد؛ بعد از جوابِ بعدی دو جمله و دکمه‌ها می‌آید.', for: await $.session.id() } }
      $.ui.invalidate('ui.render')
      return { text: 'حدس برای همین چت ' + (arg === 'off' ? 'خاموش شد' : 'روشن شد') }
    }
    if (arg.startsWith('ask ') && !(await readFlag($))?.porsesh) return { text: 'پرسش در این چت خاموش است' }
    if (arg.startsWith('ask ')) { $.clock.after(0, () => ask($, arg.slice(4).trim())); return { text: 'پرسش رفت؛ جوابش در کادرِ حدس می‌آید.' } }
    // /hads now: asked for, so the guesses come now whatever the count
    const pn = await readFlag($)
    if (!pn) return { text: 'حدس در این چت خاموش است؛ اول /hads on' }
    $.clock.after(0, () => turnEnd($, pn, true))
    return { text: 'حدس در حال ساختن…' }
  })

  // the prompt's own hooks are written right after it: read them a moment later
  // a guess Habib pressed into the box and then sent (as is, or edited): his own message now
  on('prompt.submit', async ($, e, next) => {
    try { const sid = await $.session.id(); turnNows.set(sid, []); turnTools.set(sid, []); turnAsked.set(sid, harfeHabib(String(e?.text || '').trim())) } catch {}
    try {
      const sent = String(e?.text || '').trim()
      if (sent && clicked.length) {
        const hit = clicked.find((g) => sent.includes(g)) || clicked.find((g) => sameText(g, sent))
        if (hit) await logEvent($, 'hads_ferestade', { hads_matn: hit, matn_ferestade: sent, virayesh_shod: !sent.includes(hit) })
        clicked = []
      }
    } catch {}
    return next(e)
  })

  on('classic.UserPromptSubmit', async ($, e, next) => {
    try {
      if (typeof e.transcript_path === 'string') tPath = e.transcript_path
      $.clock.after(1500, async () => { if ((await readFlag($))?.hook) { hooksAt = 0; await readHooks($) } })
    } catch {}
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      try { lastActivity = await $.clock.now(); cacheExpired = false } catch {}
      // a «پرسش» that waited for this answer goes now
      if (pendingAsk && !e.isAborted) { const q = pendingAsk; pendingAsk = null; $.clock.after(0, () => ask($, q)) }
    }
    const p = !e.agentId && !e.isAborted && (await interactive($)) ? await readFlag($) : null
    if (p?.hook) $.clock.after(500, () => { hooksAt = 0; return readHooks($) })
    // not awaited: the turn must not wait for the model
    if (p) $.clock.after(0, () => turnEnd($, p))
    return next(e)
  })

  // after every tool: the tool runs first and its result goes back untouched; the rest
  // is never awaited and never throws, so «دو جمله» can not slow or break a tool
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    try {
      if (!e.agentId) {
        const what = e.tool + ': ' + String(e.description || e.command || e.file_path || '').slice(0, 200)
        // remembered for the turn's summary (a short line each, at most 30)
        $.clock.after(0, async () => { try { const sid = await $.session.id(); turnTools.set(sid, [...(turnTools.get(sid) || []), what.slice(0, 120)].slice(-30)) } catch {} })
        $.clock.after(0, async () => {
          try {
            lastActivity = await $.clock.now(); cacheExpired = false
            const p = (await interactive($)) ? await readFlag($) : null
            if (p?.hook) await readHooks($)
            if (p?.do_jomle) await tellNow($, what, false, p.do_jomle_fork && (await small($)))
          } catch {}
        })
      }
    } catch {}
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await readFlag($)
    if (!p) return next(e)
    const id = await $.session.id()
    const g = p.hads && madeFor === id ? guesses : []
    const n = p.do_jomle && now.for === id ? now.text : ''
    const sm = n && now.summary ? now.summary : null
    const a = p.porsesh && answer && answer.for === id ? answer : null
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const theirs = await next(e)
    // folded: one line, ▸ opens it again
    // one small button only: it opens the folded line
    if (p.tak_dokme) {
      const one = Button({ key: 'hads-dot', label: 'حدس ▸', onPress: () => setMode($, 'yek_khat') })
      return Box({ flexDirection: 'column', children: theirs ? [theirs, one] : [one] })
    }
    if (p.yek_khat) {
      const line = Box({ flexDirection: 'row', columnGap: 1, children: [
        Button({ key: 'hads-min', label: '▸ حدس', onPress: () => setMode($, 'baz') }),
        ...(n ? [Text({ dimColor: true, children: [n.length > 40 ? n.slice(0, 40) + '…' : n] })] : []),
        Button({ key: 'hads-to-dot', label: '×', onPress: () => setMode($, 'tak_dokme') }),
      ] })
      return Box({ flexDirection: 'column', children: theirs ? [theirs, line] : [line] })
    }
    const hist = n || histOpen ? await readHist($) : []
    // ▾ (one line) and × (one button) on top, where they are always in sight however long the box
    // grows (Habib, 24 Oct 22:41: «اینها باید بالای صفحه باشند که همه جا قابلیت دیدن داشته باشند»).
    // The box never closes all the way: × leaves the one button (25 Oct 00:13: «ضربدر … تک دکمه ای
    // شدن یعنی کلا هیچوقت بسته نشه … همین سه تا نباشه»)
    const rows = [Box({ key: 'hads-top', flexDirection: 'row', columnGap: 1, justifyContent: 'flex-end', children: [
      Button({ key: 'hads-min', label: '▾', onPress: () => setMode($, 'yek_khat') }),
      Button({ key: 'hads-x', label: '×', onPress: () => setMode($, 'tak_dokme') }),
    ] })]
    // plain text, not buttons: Habib selects it with the mouse and copies it (Ctrl+C);
    // the panel's rows are user-select:text in VS Code
    if (n) rows.push(Box({ flexDirection: 'row', columnGap: 1, children: [
      Text({ dimColor: true, children: [sm ? 'جمع‌بندی:' : 'دو جمله:'] }),
      Text({ key: 'hads-now', children: [n] }),
      ...(hist.length > 1 ? [Button({ key: 'hads-hist', label: (histOpen ? '▴ ' : '') + 'قبلی‌ها ' + fa(hist.length - 1), onPress: () => { histOpen = !histOpen; $.ui.invalidate('ui.render') } })] : []),
    ] }))
    // the turn's summary: what was done ✓ and what was not ✗, one plain line each
    if (sm) for (const [k, mark, list] of [['anjam_shod', '✓', sm.anjam_shod], ['anjam_nashod', '✗', sm.anjam_nashod]]) {
      if (list.length) rows.push(Text({ key: 'hads-sum-' + k, children: [mark + ' ' + list.join(' · ')] }))
    }
    // the guesses (1-2): whole sentences, plain text like «دو جمله» (Habib selects and copies
    // them); a small ⤵ puts one in the prompt box, never sends it
    for (let i = 0; i < g.length; i++) rows.push(Box({ flexDirection: 'row', columnGap: 1, children: [
      Text({ dimColor: true, children: [i ? '      ' : 'حدس:'] }),
      Text({ key: 'hads-g-' + i, children: [g[i].text] }),
      Button({ key: 'hads-' + i, label: '⤵', onPress: () => {
        clicked = [...clicked.filter((c) => c !== g[i].text), g[i].text].slice(-5)
        logEvent($, 'hads_zadan', { text: g[i].text })
        return fillAppend($, g[i].text)
      } }),
    ] }))
    // the earlier ones, newest first, with Tehran date and time; the current one is not repeated
    if (histOpen) rows.push(Box({ flexDirection: 'column', children: hist.slice(1, 11).map((x, i) =>
      Text({ key: 'hads-hist-' + i, dimColor: true, children: [when(x.t) + ' — ' + x.text] })) }))
    // «هوک‌ها»: small = one line each, had_hook_kuchak_harf long; big = the last had_hook_bozorg_radif, each at most
    // had_hook_bozorg_harf long (a SessionStart handoff is pages: whole, it filled the band)
    const hkAll = p.hook && hooks.for === id ? hooks.list : []
    const hk = hkAll.slice(-(p.hook_bozorg ? had_hook_bozorg_radif : had_hook_kuchak_radif))
    if (hk.length) rows.push(Box({ flexDirection: 'column', children: [
      Box({ flexDirection: 'row', columnGap: 1, children: [
        Text({ dimColor: true, children: ['هوک‌ها (' + fa(hkAll.length) + (hkAll.length > hk.length ? '، ' + fa(hk.length) + ' تای آخر' : '') + '):'] }),
        Button({ key: 'hads-hook-size', label: p.hook_bozorg ? 'کوچک' : 'بزرگ', onPress: async () => {
          const q = await readFlag($); if (!q) return
          q.hook_bozorg = !q.hook_bozorg; await $.fs.write(await flagPath($), flagWords(q)); $.ui.invalidate('ui.render')
        } }),
      ] }),
      ...hk.map((h, i) => p.hook_bozorg
        ? Text({ key: 'hads-hook-' + i, children: [(h.t ? whenFa(h.t) + ' · ' : '') + h.name + (h.n > 1 ? ' ×' + fa(h.n) : '') + ':\n' + (h.text.length > had_hook_bozorg_harf ? h.text.slice(0, had_hook_bozorg_harf - 1) + '…' : h.text)] })
        : Text({ key: 'hads-hook-' + i, dimColor: true, children: [(() => { const l = hookLine(h); return l.length > had_hook_kuchak_harf ? l.slice(0, had_hook_kuchak_harf - 1) + '…' : l })()] })),
    ] }))
    if (a) rows.push(Box({
      flexDirection: 'column',
      children: [
        Text({ dimColor: true, children: ['پرسش: ' + a.q] }),
        Text({ children: [a.text] }),
        Box({ flexDirection: 'row', columnGap: 1, children: [
          // a cold warning asks once more by a press, not only by Enter
          ...(a.cold ? [Button({ key: 'hads-ans-go', label: 'باشه، بپرس', onPress: () => ask($, a.q) })] : []),
          Button({ key: 'hads-ans-fill', label: 'بفرست به کادر', onPress: () => fillAppend($, a.q + '\n' + a.text) }),
          Button({ key: 'hads-ans-x', label: '×', onPress: () => { answer = null; $.ui.invalidate('ui.render') } }),
        ] }),
      ],
    }))
    // the guesses, «پرسش» and the ticks come last, next to the prompt: a big band above can
    // never push them out of sight
    rows.push(Box({
      flexDirection: 'row', columnGap: 1, flexWrap: 'wrap',
      children: [
        // no Input on mobile: the row stays buttons only
        ...(Input && p.porsesh ? [Input({
          key: 'hads-ask', value: askText, placeholder: 'پرسش… (مثلِ btw، به چت نمی‌رسد · Esc = برگشت به کادر)',
          onInput: (v) => { askText = v }, onSubmit: (v) => ask($, v),
        }),
        // Enter on the screen, for whoever does not want the key
        Button({ key: 'hads-ask-send', label: 'بفرست ⏎', onPress: () => ask($, askText) })] : []),
        // one tick per part, for this chat only
        ...bakhsh_ha.map(([k, name]) => Button({ key: 'hads-tick-' + k, label: (p[k] ? '✓ ' : '✗ ') + name, onPress: () => tick($, k) })),
      ],
    }))
    return Box({ flexDirection: 'column', children: theirs ? [theirs, ...rows] : rows })
  })
}
