// حدس: after each answer, one fork of the chat itself (warm cache: the answer was just sent)
// gives «دو جمله» and 3-5 guesses of the next request; Sonnet 5.5 on the last messages is the
// fallback and the mid-work teller. Each guess is a button above the prompt; a click fills
// the prompt box and never sends.
export const MODEL = 'claude-sonnet-5-5'

const SYSTEM = [
  'You predict what the user (حبیب) will ask next in a Claude Code session.',
  'Give 3 to 5 items: both what the user will most likely ask next, and options the user has not',
  'thought of but that fit the user\'s pattern. Each item is ready to send as the user\'s own message,',
  'in plain Persian, in the user\'s tone. Reply ONLY with JSON: [{"label": "<= 3 words", "text": "<one line>"}].',
].join(' ')

let guesses = []
let hidden = false
let busy = false
// the chat the guesses were made in: after /clear (a new id) they are not shown
let madeFor = ''

// «دو جمله»: what the agent is doing now, in Habib's words (the project's 00_vazhe_name.md),
// after each answer and, at most every GAP ms, after a tool. One call at a time.
export const GAP = 60000
// over this many tokens of chat even a warm fork costs too much: Sonnet on the last messages
export const MAX_FORK = 400000
// idle longer than this and the chat's cache is likely gone (1 h TTL): «بپرس» warns first
export const COLD = 55 * 60000
const NOW_SYSTEM = [
  'In exactly two short sentences of plain Persian, tell حبیب what the agent in this Claude Code',
  'session is doing right now and what it is waiting for. Use the words of the glossary given, not',
  'technical terms. Do not guess what comes next. Reply with the two sentences only.',
].join(' ')
let now = { text: '', for: '' }
let nowBusy = false
let lastNow = 0
// the end of an answer wins over a mid-work line still on its way
let endAt = 0
let endBusy = false
// an answer that ends while the last one is still told is told right after it, never dropped
let endAgain = false
// last time the chat itself talked to the model (an answer's end, a tool): the cache's age
let lastActivity = 0
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
      .slice(0, 5)
      .map((g) => ({ label: g.label.trim().slice(0, 40), text: g.text.trim() }))
  } catch {
    return []
  }
}

const STRIP = /<system-reminder[\s\S]*?<\/system-reminder>/g
export const isAgent = (t) => /<cross-session-message|^\s*Another Claude session sent a message/.test(t)

// Labelled context: Habib's own words, Claude's answers, and other agents'
// messages kept apart, so guesses follow Habib and still know the story.
export function buildPrompt(messages) {
  const cut = (s, n) => String(s).slice(0, n)
  const users = [], agents = []
  for (const m of messages) {
    if (m.role !== 'user' || !m.text) continue
    if (isAgent(m.text)) { agents.push(m.text); continue }
    const own = m.text.replace(STRIP, '').trim()
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
      model: MODEL, system: SYSTEM,
      // handoffs first, cached: they change rarely between answers
      prompt: [{ text: (await handoffs($)) || '(no handoff)', cache: true }, { text: buildPrompt(await $.session.messages()) }],
      maxTokens: 600, timeoutMs: 60000,
    })
    guesses = r.isAnswered ? parseGuesses(r.text) : []
    if (r.isAnswered) try { await $.store.set('lastGuessUsage', r.usage) } catch {}
    madeFor = await $.session.id()
    hidden = false
    $.ui.invalidate('ui.render')
  } catch {
    guesses = []
  } finally {
    busy = false
  }
}

// only the parts ticked on are asked for: fewer output tokens
const NOW_ASK = '"now": "<exactly two short sentences of plain Persian: what the agent in this chat is doing now and what it waits for, in حبیب\'s own words from the glossary below>"'
const GUESS_ASK = '"guesses": [3 to 5 of {"label": "<= 3 words", "text": "<one line, ready to send as حبیب\'s next message, in his tone>"}]'
const forkPrompt = (p) => '(این پیام از مودِ «حدس» است، نه از حبیب؛ کاری نکن و ابزاری صدا نزن.) Reply ONLY with JSON: {' +
  [p.now && NOW_ASK, p.guess && GUESS_ASK].filter(Boolean).join(', ') + '}'

// {now, guesses} from the fork's reply; null when it has neither
export function parseBoth(raw) {
  try {
    const m = String(raw || '').match(/\{[\s\S]*\}/)
    const o = JSON.parse(m ? m[0] : raw)
    const n = typeof o?.now === 'string' ? twoSentences(o.now) : ''
    const g = Array.isArray(o?.guesses) ? parseGuesses(JSON.stringify(o.guesses)) : []
    return n || g.length ? { now: n, guesses: g } : null
  } catch {
    return null
  }
}

// $ per million tokens written to the cache (5 min, 1 h), for the cold «بپرس» warning
const WRITE = { 'opus-5-5': [5, 8], 'sonnet-5-5': [2.5, 4], 'haiku-5-5': [0.125, 0.2] }
export function coldCost(model, tokens) {
  const k = Object.keys(WRITE).find((x) => String(model).includes(x)) || 'opus-5-5'
  return WRITE[k].map((p) => (tokens * p) / 1e6)
}

// Whatever the model says, at most two sentences are shown. A sentence ends at . ! ? ؟
// followed by a space: the dot inside register.js or v2.10 ends nothing. Never past MAX_NOW.
export const MAX_NOW = 300
export function twoSentences(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?؟]) /).slice(0, 2).join(' ')
  return t.length > MAX_NOW ? t.slice(0, MAX_NOW - 1) + '…' : t
}

async function vazhe($) {
  for (const f of ['Doc/tarif/00_vazhe_name.md', 'doc/tarif/00_vazhe_name.md']) {
    try { return '## واژه‌نامهٔ حبیب\n' + String(await $.fs.read((await $.session.root()) + '/' + f)).slice(0, 6000) } catch {}
  }
  return '(no glossary: plain Persian)'
}

// Sonnet on the last three messages only: cheap enough to run every GAP during work
async function tellNow($, tool, force) {
  if (nowBusy) return
  const t = await $.clock.now()
  if (!force && t - lastNow < GAP) return
  nowBusy = true; lastNow = t
  try {
    const r = await $.model.complete({
      model: MODEL, system: NOW_SYSTEM,
      prompt: [{ text: await vazhe($), cache: true },
        { text: buildPrompt((await $.session.messages()).slice(-3)) + (tool ? '\n\n## ابزاری که همین الان تمام شد\n' + tool : '') }],
      maxTokens: 200, timeoutMs: 30000,
    })
    // an answer's end started after this call: its line stands
    if (r.isAnswered && endAt <= t) {
      now = { text: twoSentences(r.text), for: await $.session.id() }; hidden = false; $.ui.invalidate('ui.render')
      try { await $.store.set('lastNowUsage', r.usage) } catch {}
    }
  } catch {} finally {
    nowBusy = false
  }
}

// The end of an answer: one fork over the whole chat, read from the cache the answer just
// warmed. Too big a chat, or no usable reply, falls back to the two Sonnet calls.
async function turnEnd($, p = { guess: true, now: true }) {
  if (!p.guess && !p.now) return
  if (endBusy) { endAgain = true; return }
  endBusy = true; endAt = await $.clock.now()
  try {
    let got = null
    let tokens = 0
    try { tokens = (await $.session.usage()).context.tokens || 0 } catch {}
    if (tokens <= MAX_FORK) {
      try {
        const r = await $.model.fork({ prompt: forkPrompt(p) + '\n\n' + (await vazhe($)) })
        got = r.isAnswered ? parseBoth(r.text) : null
        if (got) try { await $.store.set('lastTurnUsage', { via: 'fork', tokens, usage: r.usage }) } catch {}
      } catch {}
    }
    if (got) {
      const id = await $.session.id()
      if (got.now && p.now) now = { text: got.now, for: id }
      if (got.guesses.length && p.guess) { guesses = got.guesses; madeFor = id }
      hidden = false; $.ui.invalidate('ui.render')
    } else {
      await Promise.all([p.guess && guess($), p.now && tellNow($, '', true)])
    }
  } finally {
    endBusy = false
  }
  if (endAgain) { endAgain = false; await turnEnd($, (await readFlag($)) || p) }
}

const WHY = {
  'nothing-to-fork': 'این چت هنوز چیزی ندارد (مثلاً تازه /clear شده)؛ اول یک پیام بفرست.',
  'api-error': 'خطا از سمتِ Claude؛ دوباره بپرس.',
  'empty-reply': 'جوابی نیامد؛ دوباره بپرس.',
  aborted: 'نیمه‌کاره ماند؛ دوباره بپرس.',
}
async function ask($, q) {
  if (!String(q).trim()) return
  const id = await $.session.id()
  // a cold cache re-reads the whole chat at the write price: say how much, ask Enter again
  if ((await $.clock.now()) - lastActivity > COLD && !(answer?.cold && answer.q === q && answer.for === id)) {
    let tokens = 0, model = ''
    try { tokens = (await $.session.usage()).context.tokens || 0 } catch {}
    try { model = await $.session.model() } catch {}
    const [a, b] = coldCost(model, tokens)
    answer = { q, for: id, cold: true,
      text: 'کشِ چت احتمالاً سرد است: این سؤال حدودِ $' + a.toFixed(2) + ' تا $' + b.toFixed(2) +
        ' خرج دارد (' + Math.round(tokens / 1000) + 'k توکن). برای پرسیدن دوباره Enter بزن.' }
    hidden = false; $.ui.invalidate('ui.render')
    return
  }
  answer = { q, text: '…', for: id }; askText = ''; hidden = false; $.ui.invalidate('ui.render')
  try {
    const r = await $.model.fork({ prompt: q + '\n\n(کوتاه، به فارسیِ ساده و با واژه‌های حبیب جواب بده.)' })
    answer.text = r.isAnswered ? r.text : (WHY[r.reason] || 'جوابی نیامد (' + r.reason + ')؛ دوباره بپرس.')
    if (r.isAnswered) try { await $.store.set('lastAskUsage', r.usage) } catch {}
  } catch {
    answer.text = WHY.aborted
  }
  $.ui.invalidate('ui.render')
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
// The file holds `on`, then the parts ticked off: `on -guess -ask`. h-on turns all three on.
export const PARTS = [['guess', 'حدس'], ['now', 'دو جمله'], ['ask', 'پرسش']]
async function readFlag($) {
  try {
    const w = String(await $.fs.read(await flagPath($))).trim().split(/\s+/)
    if (w[0] !== 'on') return null
    return Object.fromEntries(PARTS.map(([k]) => [k, !w.includes('-' + k)]))
  } catch {
    return null
  }
}
const isOn = async ($) => (await readFlag($)) !== null
async function tick($, key) {
  const p = await readFlag($)
  if (!p) return
  p[key] = !p[key]
  await $.fs.write(await flagPath($), ['on', ...PARTS.filter(([k]) => !p[k]).map(([k]) => '-' + k)].join(' '))
  if (!p.guess) guesses = []
  if (!p.now) now = { text: '', for: '' }
  if (!p.ask) answer = null
  $.ui.invalidate('ui.render')
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'hads', description: 'حدس: on | off | now', argumentHint: '[on|off|now]', immediate: true })
    } catch {}
    return next(e)
  })

  on('command.run', { command: 'hads' }, async ($, e) => {
    const arg = (e.args || '').trim()
    if (arg === 'off' || arg === 'on') {
      await $.fs.write(await flagPath($), arg)
      if (arg === 'off') { guesses = []; now = { text: '', for: '' }; answer = null }
      // nothing to tell yet: say when it comes (no fork here, the cache may be cold)
      else { now = { text: 'حدس روشن شد؛ بعد از جوابِ بعدی دو جمله و دکمه‌ها می‌آید.', for: await $.session.id() }; hidden = false }
      $.ui.invalidate('ui.render')
      return { text: 'حدس برای همین چت ' + (arg === 'off' ? 'خاموش شد' : 'روشن شد') }
    }
    $.clock.after(0, async () => turnEnd($, (await readFlag($)) || undefined))
    return { text: 'حدس در حال ساختن…' }
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) try { lastActivity = await $.clock.now() } catch {}
    const p = !e.agentId && !e.isAborted && (await interactive($)) ? await readFlag($) : null
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
        $.clock.after(0, async () => {
          try {
            lastActivity = await $.clock.now()
            if ((await interactive($)) && (await readFlag($))?.now) await tellNow($, what, false)
          } catch {}
        })
      }
    } catch {}
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await readFlag($)
    if (hidden || !p) return next(e)
    const id = await $.session.id()
    const g = p.guess && madeFor === id ? guesses : []
    const n = p.now && now.for === id ? now.text : ''
    const a = p.ask && answer && answer.for === id ? answer : null
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const theirs = await next(e)
    const close = () => { hidden = true; $.ui.invalidate('ui.render') }
    const rows = []
    // a press on «دو جمله» starts a «پرسش» about it, like /btw on that line
    if (n) rows.push(Box({ flexDirection: 'row', columnGap: 1, children: [
      Text({ dimColor: true, children: ['دو جمله:'] }),
      p.ask && Input ? Button({
        key: 'hads-now', label: n,
        onPress: () => {
          askText = 'دربارهٔ این: «' + n + '» — '; $.ui.invalidate('ui.render')
          try { Promise.resolve($.ui.focus({ requestId: e.requestId, key: 'hads-ask' })).catch(() => {}) } catch {}
        },
      }) : Text({ key: 'hads-now', dimColor: true, children: [n] }),
    ] }))
    rows.push(Box({
      flexDirection: 'row', columnGap: 1, flexWrap: 'wrap',
      children: [
        ...(g.length ? [Text({ dimColor: true, children: ['حدس:'] })] : []),
        ...g.map((x, i) => Button({
          key: 'hads-' + i, label: x.label,
          onPress: () => fillAppend($, x.text),
        })),
        // no Input on mobile: the row stays buttons only
        ...(Input && p.ask ? [Input({
          key: 'hads-ask', value: askText, placeholder: 'پرسش… (مثلِ btw، به چت نمی‌رسد · Esc = برگشت به کادر)',
          onInput: (v) => { askText = v }, onSubmit: (v) => ask($, v),
        })] : []),
        // one tick per part, for this chat only
        ...PARTS.map(([k, name]) => Button({ key: 'hads-tick-' + k, label: (p[k] ? '✓ ' : '✗ ') + name, onPress: () => tick($, k) })),
        Button({ key: 'hads-x', label: '×', onPress: close }),
      ],
    }))
    if (a) rows.push(Box({
      flexDirection: 'column',
      children: [
        Text({ dimColor: true, children: ['پرسش: ' + a.q] }),
        Text({ children: [a.text] }),
        Box({ flexDirection: 'row', columnGap: 1, children: [
          Button({ key: 'hads-ans-fill', label: 'بفرست به کادر', onPress: () => fillAppend($, a.q + '\n' + a.text) }),
          Button({ key: 'hads-ans-x', label: '×', onPress: () => { answer = null; $.ui.invalidate('ui.render') } }),
        ] }),
      ],
    }))
    return Box({ flexDirection: 'column', children: theirs ? [theirs, ...rows] : rows })
  })
}
