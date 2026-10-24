// حدس: after each answer, Sonnet 5.5 guesses 3-5 next requests (a shortened
// nazer-ideas divergent prompt). Each guess is a button above the prompt;
// a click fills the prompt box and never sends.
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
export const GAP = 20000
const NOW_SYSTEM = [
  'In exactly two short sentences of plain Persian, tell حبیب what the agent in this Claude Code',
  'session is doing right now and what it is waiting for. Use the words of the glossary given, not',
  'technical terms. Do not guess what comes next. Reply with the two sentences only.',
].join(' ')
let now = { text: '', for: '' }
let nowBusy = false
// an answer that ends while a call runs is told right after it, never dropped
let nowAgain = false
let lastNow = 0
// «بپرس»: a side question like /btw, answered by $.model.fork; never reaches the chat
let answer = null

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
    madeFor = await $.session.id()
    hidden = false
    $.ui.invalidate('ui.render')
  } catch {
    guesses = []
  } finally {
    busy = false
  }
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

async function tellNow($, tool, force) {
  if (nowBusy) { if (force) nowAgain = true; return }
  const t = await $.clock.now()
  if (!force && t - lastNow < GAP) return
  nowBusy = true; lastNow = t
  try {
    const r = await $.model.complete({
      model: MODEL, system: NOW_SYSTEM,
      prompt: [{ text: await vazhe($), cache: true },
        { text: buildPrompt(await $.session.messages()) + (tool ? '\n\n## ابزاری که همین الان تمام شد\n' + tool : '') }],
      maxTokens: 200, timeoutMs: 30000,
    })
    if (r.isAnswered) { now = { text: twoSentences(r.text), for: await $.session.id() }; hidden = false; $.ui.invalidate('ui.render') }
  } catch {} finally {
    nowBusy = false
  }
  if (nowAgain) { nowAgain = false; await tellNow($, '', true) }
}

const WHY = {
  'nothing-to-fork': 'این چت هنوز چیزی ندارد (مثلاً تازه /clear شده)؛ اول یک پیام بفرست.',
  'api-error': 'خطا از سمتِ Claude؛ دوباره بپرس.',
  'empty-reply': 'جوابی نیامد؛ دوباره بپرس.',
  aborted: 'نیمه‌کاره ماند؛ دوباره بپرس.',
}
async function ask($, q) {
  if (!String(q).trim()) return
  answer = { q, text: '…', for: await $.session.id() }; hidden = false; $.ui.invalidate('ui.render')
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
const isOn = async ($) => {
  try { return String(await $.fs.read(await flagPath($))).trim() === 'on' } catch { return false }
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
      if (arg === 'off') { guesses = []; now = { text: '', for: '' }; answer = null; $.ui.invalidate('ui.render') }
      return { text: 'حدس برای همین چت ' + (arg === 'off' ? 'خاموش شد' : 'روشن شد') }
    }
    $.clock.after(0, () => guess($))
    return { text: 'حدس در حال ساختن…' }
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && !e.isAborted && (await interactive($)) && (await isOn($))) {
      // not awaited: the turn must not wait for the model
      $.clock.after(0, () => guess($))
      $.clock.after(0, () => tellNow($, '', true))
    }
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
          try { if ((await interactive($)) && (await isOn($))) await tellNow($, what, false) } catch {}
        })
      }
    } catch {}
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const id = await $.session.id()
    const g = madeFor === id ? guesses : []
    const n = now.for === id ? now.text : ''
    const a = answer && answer.for === id ? answer : null
    if (hidden || (!g.length && !n && !a)) return next(e)
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const theirs = await next(e)
    const close = () => { hidden = true; $.ui.invalidate('ui.render') }
    const rows = []
    if (n) rows.push(Text({ key: 'hads-now', dimColor: true, children: [n] }))
    rows.push(Box({
      flexDirection: 'row', columnGap: 1, flexWrap: 'wrap',
      children: [
        ...(g.length ? [Text({ dimColor: true, children: ['حدس:'] })] : []),
        ...g.map((x, i) => Button({
          key: 'hads-' + i, label: x.label,
          onPress: () => fillAppend($, x.text),
        })),
        // no Input on mobile: the row stays buttons only
        ...(Input ? [Input({ key: 'hads-ask', placeholder: 'بپرس… (مثلِ btw، به چت نمی‌رسد)', onSubmit: (v) => ask($, v) })] : []),
        Button({ key: 'hads-x', label: '×', onPress: close }),
      ],
    }))
    if (a) rows.push(Box({
      flexDirection: 'column',
      children: [
        Text({ dimColor: true, children: ['بپرس: ' + a.q] }),
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
