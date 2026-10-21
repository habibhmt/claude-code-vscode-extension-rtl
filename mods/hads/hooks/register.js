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
    hidden = false
    $.ui.invalidate('ui.render')
  } catch {
    guesses = []
  } finally {
    busy = false
  }
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

// on/off lives in the project itself (<root>/.claude/hads.on), so no project can switch another
const flagPath = async ($) => (await $.session.root()) + '/.claude/hads.on'
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
      if (arg === 'off') { guesses = []; $.ui.invalidate('ui.render') }
      return { text: 'حدس برای همین پروژه ' + (arg === 'off' ? 'خاموش شد' : 'روشن شد') }
    }
    $.clock.after(0, () => guess($))
    return { text: 'حدس در حال ساختن…' }
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && !e.isAborted && (await interactive($)) && (await isOn($))) {
      // not awaited: the turn must not wait for the model
      $.clock.after(0, () => guess($))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (hidden || !guesses.length) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const theirs = await next(e)
    const row = Box({
      flexDirection: 'row', columnGap: 1, flexWrap: 'wrap',
      children: [
        Text({ dimColor: true, children: ['حدس:'] }),
        ...guesses.map((g, i) => Button({
          key: 'hads-' + i, label: g.label,
          onPress: () => fillAppend($, g.text),
        })),
        Button({ key: 'hads-x', label: '×', onPress: () => { hidden = true; $.ui.invalidate('ui.render') } }),
      ],
    })
    return Box({ flexDirection: 'column', children: theirs ? [theirs, row] : [row] })
  })
}
