import type { Hook, Register } from 'claude-code'

import { engineSegments } from '../src/bidi.ts'
import { COMMENT, STRING } from '../src/code.ts'
import { isolateRow, nudge, paletteFor, pieceProps, propsKey, rowHasRtl, type AttrKey, type Piece } from '../src/isolate.ts'
import type { Span } from '../src/layout.ts'
import { BOLD, CODE, DIM, ITALIC, STRIKE, UNDERLINE } from '../src/markdown.ts'
import { BULLET, COMMAND_PREFIX, LEAF_MAX, Memo, modelAssistant, modelCommand, modelUser, shouldDraw, USER_PREFIX, type Model, type RowModel, type Settings, type UserModel } from '../src/render.ts'
import { settingsFrom } from '../src/options.ts'
import { BAND_PREFIX, BoxMirror, CURSOR_STYLE, modelDraft, modelPreview, POLL_MS, type BandRow } from '../src/preview.ts'
import { capRecap, modelRecap, RECAP_ASK, RECAP_DELAY_MS, RecapGate } from '../src/recap.ts'
import { graphemes } from '../src/width.ts'


// A tree keeps the engine's bounds or it is not drawn (2.1.288's validator): 20,000 nodes, string
// children included; 100,000 characters of text; 10,000 characters per string child, Code source
// or Markdown text. The counts below follow the JSX of this file exactly. Ticks cost about one node
// per RTL letter: past the node budget with them, a message is drawn without them (right in a
// terminal; a browser terminal then reverses its words, and a note says so). Past the budgets
// without them, the engine draws the message and a note says why.
const NODE_BUDGET = 19_500
const TEXT_BUDGET = 99_000

type Props = Record<string, boolean | string>
type TextRow = Extract<RowModel, { kind: 'text' }>

// The recap band's counts, kept in the session for a reload of the mod.
// The recap band's counts, kept in the session for a reload of the mod. Saves run one after another,
// each with the counts as they were when it was asked, so an older one never lands last; none while
// the session's kept counts are being read, and none once the session changed.
function keepCounts($: Engine, gate: RecapGate, queue: { last: Promise<void> }): void {
  if (gate.loading) return
  const counts = gate.counts()
  const epoch = gate.epoch
  queue.last = queue.last.then(async () => {
    try {
      const session = await $.session.id()
      if (gate.epoch === epoch) await $.state.set(RECAP_STATE, { session, ...counts })
    } catch {
      // a session that ended meanwhile keeps nothing
    }
  })
}

// Only set props are passed: the engine validates element props against an allowlist.
function styleProps(style: number): Props {
  const p: Props = {}
  if (style & BOLD) p.bold = true
  if (style & ITALIC) p.italic = true
  if (style & STRIKE) p.strikethrough = true
  if (style & UNDERLINE) p.underline = true
  if (style & DIM) p.dimColor = true
  return p
}

// A string child longer than the engine takes is cut at cluster boundaries; null when one cluster
// alone is longer.
function fitStrings(text: string): string[] | null {
  if (text.length <= LEAF_MAX) return [text]
  const out: string[] = []
  let cur = ''
  for (const g of graphemes(text)) {
    if (g.length > LEAF_MAX) return null
    if (cur.length + g.length > LEAF_MAX) {
      out.push(cur)
      cur = ''
    }
    cur += g
  }
  if (cur) out.push(cur)
  return out
}

// A drawn piece: a bare string (the row's own attributes) or a Text with its own, each with its
// string children cut to size.
type Drawn = { props: Props | null; strings: string[] }

// Claude Code reorders RTL text itself when it takes the terminal for one that cannot (Windows
// Terminal's `WT_SESSION`, or `TERM_PROGRAM=vscode`): each Text on its own, its nested Texts with it
// (src/bidi.ts `engineReorder`). There a row is drawn as sibling Texts of one direction each, the
// row's attributes on every one, holding what that reorder turns back into the row; null when a
// segment does not fit a string child.
function segmentRow(drawn: Drawn[], outer: Props | null): Drawn[] | null {
  const out: Drawn[] = []
  for (const d of drawn) {
    const props = outer || d.props ? { ...(outer ?? {}), ...(d.props ?? {}) } : null
    for (const seg of engineSegments(d.strings.join(''))) {
      const strings = fitStrings(seg)
      if (strings === null) return null
      out.push({ props, strings })
    }
  }
  return out
}

// The draft pane's id, and the cells it asks for beside the transcript.
const DRAFT_PANE = 'rtl-draft'
const DRAFT_COLUMNS = 48

const MERMAID = /(^|\n) {0,3}(`{3,}|~{3,})[ \t]*mermaid/

type Shown = { text: string; hint: boolean }
// the engine interface a hook receives
type Engine = Parameters<Hook<'session.start'>>[0]
// the recap band's counts in the session (types/index.d.ts)
const RECAP_STATE = { plugin: 'rtl', key: 'recap' } as const

// The native recap's `/config` row: on, or unknown, means no band.
function nativeOff(rows: { key: string; value: unknown }[]): boolean {
  const row = rows.find(r => r.key === 'recap' || r.key === 'awaySummaryEnabled')
  return row !== undefined && row.value === false
}
// Said when the band is on but the native recap's row is on too, so the band stays hidden. Short: a
// toast shows about three rows of 40 columns and cuts the rest.
const NATIVE_ON_NOTE = "Recap band is hidden while Claude Code's own Session recap is on. Turn Session recap off in /config."
// The `/config` rows, or none when they cannot be read: then no toast and no theme change, and the
// hook goes on (a setting already saved still answers with its result).
async function configRows($: Engine): Promise<{ key: string; value: unknown }[]> {
  try {
    return await $.config.list()
  } catch {
    return []
  }
}
// What `run` answers, or `fallback` when it throws (a surface without that noun).
async function attempt<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run()
  } catch {
    return fallback
  }
}
// Whether Claude Code reorders RTL text itself: its own test (2.1.289's `isNeeded()`), on the
// variables it reads. Unreadable means no.
async function engineReorders($: Engine): Promise<boolean> {
  return attempt(async () => (await $.env.get('WT_SESSION')) !== undefined || (await $.env.get('TERM_PROGRAM')) === 'vscode', false)
}
// Reads the box every POLL_MS, for the changes that raise no event: the band is redrawn when the text
// changed and holds RTL letters or held them, the draft pane (`pane()` true while it is open) when the
// text or the cursor changed.
function pollBox($: Engine, box: BoxMirror, pane: () => boolean): { cancel: () => void } {
  return $.clock.every(POLL_MS, () => {
    void (async () => {
      try {
        const token = box.readStart()
        const before = box.shows()
        const now = await $.prompt.read()
        if (box.read(token, now.text, now.cursor) && (pane() || before || box.shows())) $.ui.invalidate('ui.render')
      } catch {
        // the session ended or the mod reloaded while it read
      }
    })()
  })
}
function nativeOn(rows: { key: string; value: unknown }[]): boolean {
  const row = rows.find(r => r.key === 'recap' || r.key === 'awaySummaryEnabled')
  return row !== undefined && row.value !== false
}

export const register: Register = (on, options) => {
  const { order, settings, textColor, recap, preview, suggestion } = settingsFrom(options)
  const memo = new Memo<Model | null>()
  const userMemo = new Memo<UserModel | null>()
  const commandMemo = new Memo<UserModel | null>()
  // Rows are shared through the block memo, so their pieces are kept per row object and palette.
  const pieceMemo = new WeakMap<TextRow, { key: string; pieces: Piece[] }>()
  let theme: string | undefined
  // whether Claude Code reorders RTL text itself (segmentRow), as read at the session's start
  let reorders = false
  // the draft pane is open (`/rtl-draft`), and drawn since it opened (its first drawing redraws the
  // band); the band leaves the draft to it only while the engine shows it, placed
  let drafting = false
  let paneDrawn = false
  type UI = { Box: ReturnType<Engine['ui']['resolve']>['Box']; Text: ReturnType<Engine['ui']['resolve']>['Text'] }
  // A row's pieces and what they cost in nodes beyond the row's own Text: as they are, or where
  // Claude Code reorders, its segments.
  const settle = (drawn: Drawn[], outer: Props | null): { drawn: Drawn[]; nodes: number } | null => {
    if (!reorders) return { drawn, nodes: drawn.reduce((n, d) => n + d.strings.length + (d.props ? 1 : 0), 0) }
    const segs = segmentRow(drawn, outer)
    return segs && { drawn: segs, nodes: segs.reduce((n, d) => n + d.strings.length + 1, 0) }
  }
  // A row as drawn: one Text with the pieces in it, or the segments side by side in a Box.
  const drawRow = ({ Box, Text }: UI, drawn: Drawn[], outer: Props | null) =>
    reorders ? (
      <Box>{drawn.map(d => <Text {...(d.props ?? {})}>{d.strings}</Text>)}</Box>
    ) : (
      <Text {...(outer ?? {})}>{drawn.map(d => (d.props ? <Text {...d.props}>{d.strings}</Text> : d.strings))}</Text>
    )

  // The recap band (option `recap`, off by default; docs/design/how-it-works.md). Claude Code's own
  // automatic recap is a row no mod can draw, so with its `/config` row off this draws one above the
  // prompt instead: when the engine sends its idle notification ("Claude is waiting for your input":
  // the turn and the background work it tracks are done, and the person has not touched the terminal
  // since), it waits three minutes more, then asks the session's model for the native recap's summary
  // over the conversation. Any sign of the person in between cancels it. Nothing is stored in the
  // conversation: the band is cleared by the next prompt, and gone after a resume. The counts behind
  // the prompts rule and the hint are kept in the session (`$.state`), so a reload keeps them.
  let enabled = recap && order !== 'off'
  const gate = new RecapGate()
  const saves = { last: Promise.resolve() }
  let timer: { cancel: () => void } | null = null
  let shown: Shown | null = null
  // The prompt preview (option `preview`, on by default; src/preview.ts): the box's text as the mod
  // last saw it, and the dim suggestion while the box is empty. Visual order only: a terminal that
  // reorders text itself (`order: logical`) shows the box right already.
  const previewing = preview && order === 'visual'
  const box = new BoxMirror()
  let poll: { cancel: () => void } | null = null
  const stopPoll = () => {
    poll?.cancel()
    poll = null
  }
  const disarm = () => {
    timer?.cancel()
    timer = null
  }
  // the band cleared: whether it was showing, to be drawn again
  const hide = () => {
    const was = shown !== null
    shown = null
    return was
  }

  on('session.start', async ($, e, next) => {
    // what waited belongs to the session before, or to the module before this load
    gate.reset(true)
    const epoch = gate.epoch
    disarm()
    shown = null
    box.reset()
    stopPoll()
    const result = await next(e)
    const was = reorders
    reorders = order === 'visual' && (await engineReorders($))
    drafting = await attempt(async () => (await $.ui.panes()).some(p => p.id === DRAFT_PANE), false)
    if (reorders !== was || drafting) $.ui.invalidate('ui.render')
    // immediate: typed while a turn runs, it opens or closes the pane at once (it touches nothing else)
    if (order !== 'off') await attempt(() => $.command.register({ name: 'rtl-draft', description: 'Show or hide your draft right-to-left in a side pane', immediate: true }), undefined)
    const rows = await configRows($)
    const row = rows.find(r => r.key === 'theme')
    if (row && typeof row.value === 'string' && row.value !== theme) {
      theme = row.value
      $.ui.invalidate('ui.render')
    }
    if (enabled && nativeOn(rows)) $.ui.toast(NATIVE_ON_NOTE, { timeoutMs: 10_000 })
    // this session's counts, from before a reload of the mod (a new session has none)
    const kept = (await $.state.get(RECAP_STATE)).value
    // what was counted meanwhile is added, then saved with the rest
    if (gate.restore(kept, await $.session.id(), epoch)) keepCounts($, gate, saves)
    return result
  })

  on('session.end', async ($, e, next) => {
    gate.reset(false)
    disarm()
    const before = box.shows()
    box.reset()
    stopPoll()
    if (hide() || before) $.ui.invalidate('ui.render')
    return next(e)
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    if (typeof result.value === 'string' && result.value !== theme) {
      theme = result.value
      $.ui.invalidate('ui.render')
    }
    return result
  })

  // The person's own prompt rows (typed here, or sent through Remote Control), in both views:
  // the row is the prompt's whole text, as the engine draws it. Notifications and other agents'
  // messages keep the engine's drawing.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const origin = e.props.origin.kind
    if (order === 'off' || e.surface !== 'terminal' || (origin !== 'composer' && origin !== 'bridge') || !shouldDraw(e.props.text)) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const columns = e.viewport?.columns ?? 0
    const model = userMemo.get(`${order}|${settings.base}|${settings.arabic}|${columns}|${e.props.text}`, () => modelUser(e.props.text, columns, settings))
    const fallback = async (why: string) => (
      <Box flexDirection="column">
        {await next(e)}
        <Text dimColor>{`  rtl: ${why}`}</Text>
      </Box>
    )
    if (model === null) return fallback('too narrow to draw right-to-left')
    const palette = paletteFor(theme, textColor)
    // The user row sits on its own background, so the tick goes there: the text keeps the
    // terminal's default color, and the background moves one unit.
    const tickBg = palette && settings.mode === 'visual' ? nudge(palette.userBg) : null
    const attr: AttrKey = (_style, tick) => (tick ? 'tick' : 'row')
    const isolated = model.rows.map(r => (tickBg && rowHasRtl(r.spans) ? isolateRow(r.spans, attr) : null))
    const plan = (ticks: boolean) => {
      let nodes = 1
      let chars = 0
      const rows: Drawn[][] = []
      for (let i = 0; i < model.rows.length; i++) {
        const r = model.rows[i]
        const pieces = ticks && isolated[i] ? isolated[i]! : r.spans.map(s => ({ ...s, tick: false }))
        const drawn: Drawn[] = []
        for (const p of pieces) {
          const strings = fitStrings(p.text)
          if (strings === null) return null
          drawn.push({ props: p.tick ? { backgroundColor: tickBg! } : null, strings })
          chars += p.text.length
        }
        const settled = settle(drawn, null)
        if (settled === null) return null
        // row Box, prefix Box, its Text and string, content Box, its Text
        nodes += settled.nodes + 6
        chars += 2
        rows.push(settled.drawn)
      }
      return nodes <= NODE_BUDGET && chars <= TEXT_BUDGET ? rows : null
    }
    const withTicks = tickBg ? plan(true) : null
    const drawnRows = withTicks ?? plan(false)
    if (drawnRows === null) return fallback('too long to draw right-to-left')
    const note = tickBg && withTicks === null ? <Text dimColor>{'  rtl: too long to isolate; a browser terminal may reverse its words'}</Text> : null
    // The engine's own row opens with an empty line (its marginTop); ours keeps it.
    return (
      <Box flexDirection="column" width={model.width} marginTop={1}>
        {model.rows.map((r, index) => (
          <Box width={model.width} backgroundColor="userMessageBackground">
            <Box width={USER_PREFIX}><Text dimColor>{r.first ? '❯ ' : '  '}</Text></Box>
            <Box flexGrow={1} paddingRight={1} justifyContent={r.rtl ? 'flex-end' : 'flex-start'}>
              {drawRow({ Box, Text }, drawnRows[index], null)}
            </Box>
          </Box>
        ))}
        {note}
      </Box>
    )
  })

  // A slash command's output row with RTL text (the summary `/recap` prints), as the engine draws
  // it: a dim `⎿` on the left, then the text, its RTL rows right-aligned and in visual order, in
  // the theme's text color with the color runs. An error row keeps the engine's drawing.
  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    if (order === 'off' || e.surface !== 'terminal' || e.props.isErrored || !shouldDraw(e.props.text)) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const columns = e.viewport?.columns ?? 0
    const model = commandMemo.get(`${order}|${settings.base}|${settings.arabic}|${columns}|${e.props.text}`, () => modelCommand(e.props.text, columns, settings))
    const fallback = async (why: string) => (
      <Box flexDirection="column">
        {await next(e)}
        <Text dimColor>{`  rtl: ${why}`}</Text>
      </Box>
    )
    if (model === null) return fallback('too narrow to draw right-to-left')
    const palette = paletteFor(theme, textColor)
    const colorable = palette !== null && settings.mode === 'visual'
    const attr: AttrKey = (style, tick) => propsKey(pieceProps(style, tick, palette!))
    const baseKey = palette ? propsKey(pieceProps(0, false, palette)) : ''
    const plan = (ticks: boolean) => {
      let nodes = 1
      let chars = 0
      const rows: { drawn: Drawn[]; colored: boolean }[] = []
      for (const r of model.rows) {
        const colored = ticks && rowHasRtl(r.spans)
        const pieces = colored ? isolateRow(r.spans, attr) : r.spans.map(sp => ({ ...sp, tick: false }))
        const drawn: Drawn[] = []
        for (const p of pieces) {
          const strings = fitStrings(p.text)
          if (strings === null) return null
          let props: Props | null = null
          if (colored) {
            const full = pieceProps(p.style, p.tick, palette!)
            props = propsKey(full) === baseKey ? null : (full as Props)
          } else if (p.style) {
            props = styleProps(p.style)
            if (p.style & CODE) props.color = 'permission'
          }
          drawn.push({ props, strings })
          chars += p.text.length
        }
        const settled = settle(drawn, colored ? { color: palette!.text } : null)
        if (settled === null) return null
        // row Box, prefix Box, its Text and string, content Box, its Text
        nodes += settled.nodes + 6
        chars += COMMAND_PREFIX
        rows.push({ drawn: settled.drawn, colored })
      }
      return nodes <= NODE_BUDGET && chars <= TEXT_BUDGET ? rows : null
    }
    const withTicks = colorable ? plan(true) : null
    const drawnRows = withTicks ?? plan(false)
    if (drawnRows === null) return fallback('too long to draw right-to-left')
    const note = colorable && withTicks === null ? <Text dimColor>{'  rtl: too long to isolate; a browser terminal may reverse its words'}</Text> : null
    return (
      <Box flexDirection="column" width={model.width}>
        {model.rows.map((r, index) => {
          const { drawn, colored } = drawnRows[index]
          return (
            <Box width={model.width}>
              <Box width={COMMAND_PREFIX}><Text dimColor>{r.first ? '  ⎿  ' : '     '}</Text></Box>
              <Box flexGrow={1} paddingRight={1} justifyContent={r.rtl ? 'flex-end' : 'flex-start'}>
                {drawRow({ Box, Text }, drawn, colored ? { color: palette!.text } : null)}
              </Box>
            </Box>
          )
        })}
        {note}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (order === 'off' || e.surface !== 'terminal' || !shouldDraw(e.props.text)) return next(e)
    const { Box, Text, Code, Markdown } = $.ui.resolve(e)
    const fallback = async (why: string) => (
      <Box flexDirection="column">
        {await next(e)}
        <Text dimColor>{`  rtl: ${why}`}</Text>
      </Box>
    )
    const columns = e.viewport?.columns ?? 0
    const key = `${order}|${settings.base}|${settings.arabic}|${columns}|${e.props.isFirstOfReply}|${e.props.text}`
    const model = memo.get(key, () => modelAssistant(e.props.text, columns, e.props.isFirstOfReply, settings))
    if (model === null) {
      return fallback(MERMAID.test(e.props.text) ? 'a mermaid diagram, drawn as Claude Code draws it' : 'too narrow or too long to draw right-to-left')
    }
    const palette = paletteFor(theme, textColor)
    const colorable = palette !== null && settings.mode === 'visual'
    const paletteKey = palette ? `${palette.text}|${palette.code}` : ''
    // A colored row's pieces are cut by their final attributes (isolate.ts).
    const attr: AttrKey = (style, tick) => propsKey(pieceProps(style, tick, palette!))
    const baseKey = palette ? propsKey(pieceProps(0, false, palette)) : ''

    // Rows that hold RTL text (and every table row) are drawn in explicit colors, the theme's text
    // color and its tick, so that their letters can be isolated; other rows keep the terminal's
    // default color. A row is isolated whole, prefix and body in visual order.
    const visualSpans = (r: TextRow) => (r.rtl ? [...r.spans, ...r.lead] : [...r.lead, ...r.spans])
    const isolatedRow = (r: TextRow) => {
      const kept = pieceMemo.get(r)
      if (kept && kept.key === paletteKey) return kept.pieces
      const pieces = isolateRow(visualSpans(r), attr)
      pieceMemo.set(r, { key: paletteKey, pieces })
      return pieces
    }
    const isolated = model.rows.map(r => (r.kind === 'text' && colorable && (r.paint || rowHasRtl(r.spans)) ? isolatedRow(r) : null))

    // In a colored row the row's Text carries the base attributes, so a piece with exactly those is
    // a bare string. In a plain row, a piece without style is.
    const drawPiece = (p: Piece, colored: boolean): Drawn | null => {
      const strings = fitStrings(p.text)
      if (strings === null) return null
      if (colored) {
        const props = pieceProps(p.style, p.tick, palette!)
        return { props: propsKey(props) === baseKey ? null : (props as Props), strings }
      }
      if (p.style === 0) return { props: null, strings }
      const props = styleProps(p.style)
      if (p.style & BULLET) props.color = 'text'
      else if (p.style & COMMENT) props.color = 'green'
      else if (p.style & STRING) props.color = 'red'
      else if (p.style & CODE) props.color = 'permission'
      return { props, strings }
    }
    // The tree's rows as drawn, with or without ticks; null past the budgets.
    const plan = (ticks: boolean) => {
      let nodes = 1
      let chars = 0
      const rows: (Drawn[] | null)[] = []
      for (let i = 0; i < model.rows.length; i++) {
        const r = model.rows[i]
        if (r.kind === 'text') {
          const colored = ticks && isolated[i] !== null
          const pieces = colored ? isolated[i]! : visualSpans(r).map(sp => ({ ...sp, tick: false }))
          const drawn: Drawn[] = []
          for (const p of pieces) {
            const d = drawPiece(p, colored)
            if (d === null) return null
            drawn.push(d)
            chars += p.text.length
          }
          const settled = settle(drawn, colored ? { color: palette!.text } : null)
          if (settled === null) return null
          nodes += settled.nodes + 2 // row Box, row Text
          rows.push(settled.drawn)
        } else {
          // blank: Box, Text, string; code and markdown: Box, gutter Box, Text, string, Box, leaf
          nodes += r.kind === 'blank' ? 3 : r.kind === 'code' && r.inset ? 7 : 6
          chars += 1 + (r.kind === 'code' ? r.source.length : r.kind === 'markdown' ? r.text.length : 0)
          rows.push(null)
        }
      }
      return nodes <= NODE_BUDGET - 3 && chars <= TEXT_BUDGET ? { rows, ticks } : null
    }
    const withTicks = colorable ? plan(true) : null
    const chosen = withTicks ?? plan(false)
    if (chosen === null) return fallback('too long to draw right-to-left')
    const note = colorable && withTicks === null ? <Text dimColor>{'  rtl: too long to isolate; a browser terminal may reverse its words'}</Text> : null

    // The engine's own message opens with an empty line (its marginTop); ours keeps it.
    return (
      <Box flexDirection="column" width={model.width} marginTop={1}>
        {model.rows.map((r, index) => {
          switch (r.kind) {
            case 'blank':
              return <Box><Text> </Text></Box>
            case 'code': {
              const code = <Code {...(r.language ? { source: r.source, language: r.language } : { source: r.source })} />
              return (
                <Box width={model.width}>
                  <Box width={r.indent}><Text color={palette ? palette.text : 'text'}>{r.bullet ? '●' : ' '}</Text></Box>
                  <Box flexGrow={1}>{code}</Box>
                  {r.inset ? <Box width={r.inset} /> : null}
                </Box>
              )
            }
            case 'markdown':
              return (
                <Box width={model.width}>
                  <Box width={2}><Text color={palette ? palette.text : 'text'}>{r.bullet ? '●' : ' '}</Text></Box>
                  <Box flexGrow={1}><Markdown text={r.text} /></Box>
                </Box>
              )
            case 'text': {
              const colored = chosen.ticks && isolated[index] !== null
              const text = drawRow({ Box, Text }, chosen.rows[index]!, colored ? { color: palette!.text } : null)
              return r.rtl ? (
                <Box width={model.width} justifyContent="flex-end">
                  {text}
                </Box>
              ) : (
                <Box width={model.width}>{text}</Box>
              )
            }
          }
        })}
        {note}
      </Box>
    )
  })

  on('config.set', async ($, e, next) => {
    const recapKey = e.key === 'rtl.recap' || e.key === 'recap' || e.key === 'awaySummaryEnabled'
    // any change to the band or the native recap voids what waits, before the change lands
    if (recapKey) {
      gate.touch()
      disarm()
    }
    const result = await next(e)
    if (e.key === 'rtl.recap') enabled = result.value === 'on' && order !== 'off'
    // the native recap turned on, or the band turned off: nothing more from the band
    const off = (e.key === 'rtl.recap' && !enabled) || ((e.key === 'recap' || e.key === 'awaySummaryEnabled') && result.value !== false)
    if (off && hide()) $.ui.invalidate('ui.render')
    // the band turned on over the native recap, or the native recap turned on under the band
    if (recapKey && enabled && (e.key === 'rtl.recap' ? nativeOn(await configRows($)) : result.value !== false)) {
      $.ui.toast(NATIVE_ON_NOTE, { timeoutMs: 10_000 })
    }
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    // any prompt, from anywhere, entered or not, voids what waits
    gate.submit()
    disarm()
    const redraw = hide() || (e.origin.kind === 'composer' && box.shows())
    if (e.origin.kind === 'composer') box.sent()
    if (redraw) $.ui.invalidate('ui.render')
    const result = await next(e)
    // the person's own prompt that entered counts toward the next recap (a dropped one does not)
    if ((e.origin.kind === 'composer' || e.origin.kind === 'bridge') && result.drop === undefined) {
      gate.prompt()
      keepCounts($, gate, saves)
    }
    return result
  })

  on('prompt.edit', async ($, e, next) => {
    gate.touch()
    disarm()
    const before = box.shows()
    const generation = box.editStart()
    let after = null
    try {
      after = await next(e)
    } finally {
      box.editEnd(generation, after?.text ?? null, after?.cursor)
    }
    if (drafting || (previewing && (before || box.shows()))) $.ui.invalidate('ui.render')
    return after
  })

  // Claude Code's dim suggestion, about to show in the empty box: kept for the preview as this hook
  // sees it, never changed (Tab would insert a changed text). A plugin beneath may still change it.
  on('prompt.suggest', async ($, e, next) => {
    const offer = box.offer()
    const result = await next(e)
    if (previewing && suggestion && result.isShown) {
      const before = box.shows()
      if (box.suggested(offer, e.text) && (before || box.shows())) $.ui.invalidate('ui.render')
    }
    return result
  })

  // A main-loop turn: a subagent's run raises no turn.start, nor does the band's own `$.model.fork`
  // (seen on 2.1.289). It voids what waits, hides a recap already shown, and ends the suggestion.
  on('turn.start', async ($, e, next) => {
    gate.turnStart()
    disarm()
    const before = box.shows()
    box.dropGhost()
    if (hide() || (before && !box.shows())) $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.complete', async (_$, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) gate.turnEnd()
    return result
  })

  on('classic.Notification', async ($, e, next) => {
    const result = await next(e)
    if (!enabled || e.notification_type !== 'idle_prompt' || !gate.idle()) return result
    const revision = gate.revision
    disarm()
    // Each wait below lets the conversation move on, so whether this revision is still the one is
    // asked again after every one of them, the last time with no wait before the band is shown.
    const live = () => enabled && gate.live(revision)
    // what the band cannot see while it waits, checked when it would ask and again with the answer:
    // the native recap, a draft, agents still at work
    const quiet = async () =>
      live() && nativeOff(await $.config.list()) &&
      live() && (await $.prompt.read()).text === '' &&
      live() && !(await $.agent.list()).some(a => a.status === 'running' || a.status === 'pending' || a.status === 'waiting') &&
      live()
    timer = $.clock.after(RECAP_DELAY_MS, () => {
      timer = null
      void (async () => {
        try {
          if (!live() || (await $.session.surface()) !== 'terminal' || !(await quiet())) return
          const reply = await $.model.fork({ prompt: RECAP_ASK })
          // a late answer for a conversation that moved on is dropped (its usage is spent)
          if (!(await quiet()) || !live()) return
          const text = reply.isAnswered ? capRecap(reply.text) : ''
          if (!text) {
            gate.failed()
            return
          }
          shown = { text, hint: gate.shown() }
          keepCounts($, gate, saves)
          $.ui.invalidate('ui.render')
        } catch {
          // the session ended or the mod reloaded while it waited: nothing to show
        }
      })()
    })
    return result
  })

  // Some changes of the box raise no `prompt.edit`: Tab taking the suggestion, a prompt recalled
  // from history, an outside editor. The hint line under the prompt is drawn again when the box
  // turns from empty to holding text or back (`isDraft`): the band is redrawn then and reads the
  // box. Only on that turn, so this redraw does not call itself again. While the box holds text, it
  // is also read every POLL_MS, for the changes that do not turn it empty (a later step through
  // history), and the band is redrawn when that text changed and holds RTL letters or held them.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (order === 'off' || e.surface !== 'terminal' || !box.hint(e.props.isDraft)) return next(e)
    if (previewing || drafting) $.ui.invalidate('ui.render')
    stopPoll()
    if (box.holding && (previewing || drafting)) poll = pollBox($, box, () => drafting)
    return next(e)
  })

  // A band row's pieces. RTL rows carry their letters in color runs (isolate.ts), so a browser
  // terminal keeps them in order; other rows keep the terminal's own text color, dim where the
  // native row is. The draft pane's cursor bar (CURSOR_STYLE) is drawn bold in the accent color.
  // Where Claude Code reorders, the pieces become its segments (segmentRow).
  const bandPieces = (r: BandRow): Drawn[] => {
    const palette = paletteFor(theme, textColor)
    const colorable = palette !== null && settings.mode === 'visual'
    const attr: AttrKey = (style, tick) => propsKey(pieceProps(style, tick, palette!))
    const bar = (style: number, props: Props | null): Props | null => (style & CURSOR_STYLE ? { ...(props ?? {}), color: 'permission', bold: true } : props)
    const drawn: Drawn[] = colorable && rowHasRtl(r.spans)
      ? isolateRow(r.spans, attr).map(p => ({ props: bar(p.style, pieceProps(p.style, p.tick, palette!) as Props), strings: [p.text] }))
      : r.spans.map(sp => {
        const props = styleProps(sp.style & (DIM | BOLD | ITALIC))
        return { props: bar(sp.style, Object.keys(props).length ? props : null), strings: [sp.text] }
      })
    return reorders ? (segmentRow(drawn, null) ?? []) : drawn
  }

  // The draft pane: Claude Code draws the box in logical order, so `/rtl-draft` opens a pane beside
  // the transcript with the draft laid out right-to-left and a bar at the cursor. The keys stay in
  // the box; the pane follows each edit. While it is open the band leaves the draft to it. Below
  // 110 columns, or outside fullscreen, the engine seats it above the prompt instead.
  // A failed open or close changes nothing and says so.
  on('command.run', { command: 'rtl-draft' }, async ($) => {
    if (drafting) {
      const closed = await attempt(async () => {
        await $.ui.close({ id: DRAFT_PANE })
        return true
      }, false)
      if (!closed) return { text: 'The draft pane could not be closed. Its ✕ closes it too.' }
      drafting = false
      paneDrawn = false
      $.ui.invalidate('ui.render')
      return { text: 'Draft pane closed.' }
    }
    const opened = await attempt(() => $.ui.open({ id: DRAFT_PANE, title: 'Draft', columns: DRAFT_COLUMNS }), null)
    if (opened === null) return { text: 'The draft pane could not be opened.' }
    paneDrawn = false
    drafting = true
    stopPoll()
    if (box.holding) poll = pollBox($, box, () => drafting)
    $.ui.invalidate('ui.render')
    return { text: opened.isPlaced ? 'Draft pane open. /rtl-draft again closes it.' : `Draft pane waits: ${opened.reason}` }
  })

  on('ui.close', { id: DRAFT_PANE }, async ($, e, next) => {
    const result = await next(e)
    // a close refused beneath leaves the pane open
    if ('deny' in result) return result
    drafting = false
    paneDrawn = false
    $.ui.invalidate('ui.render')
    return result
  })

  on('ui.render', { component: 'Pane', requestId: DRAFT_PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const width = e.props.bodyColumns
    // the box as it is now, unless an edit, a send, a new session or a later read overtook the read
    const token = box.readStart()
    const read = await $.prompt.read()
    box.read(token, read.text, read.cursor)
    const { text, cursor } = box.current(token) ? read : { text: box.draft, cursor: box.cursor }
    // drawn at last (opened on a narrow terminal, then widened): the band leaves the draft to it now
    if (!paneDrawn) {
      paneDrawn = true
      $.ui.invalidate('ui.render')
    }
    const model = modelDraft(text, cursor, width, settings)
    if (model === null) return <Text dimColor>{'rtl: too narrow'}</Text>
    // the rows that fit, the cursor's among them
    const fit = Math.max(1, e.props.scroll.bodyRows)
    const from = Math.max(0, Math.min(model.cursorRow - fit + 1, model.rows.length - fit))
    const rows = model.rows.slice(from, from + fit)
    return (
      <Box flexDirection="column" width={width}>
        {rows.map(r => {
          const drawn = bandPieces(r)
          return (
            <Box width={width} justifyContent={r.rtl ? 'flex-end' : 'flex-start'}>
              {/* an empty line of the draft keeps its row */}
              {drawn.length ? drawRow({ Box, Text }, drawn, null) : <Text>{' '}</Text>}
            </Box>
          )
        })}
        {text === '' ? <Box width={width} justifyContent="flex-end"><Text dimColor>{'Type in the prompt box; it shows here.'}</Text></Box> : null}
      </Box>
    )
  })

  // The band above the prompt: the recap, then the preview of the box, closest to it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey || e.props.view.agentId !== undefined) return next(e)
    const columns = e.props.bodyColumns
    const maxRows = e.props.maxRows
    // while Claude Code works there is no suggestion and no recap; a draft typed meanwhile is shown
    const working = e.props.isWorking
    // the preview first (the box is what the person works on now), the recap above it if it fits whole
    let previewRows: BandRow[] = []
    // with the draft pane on screen the draft is drawn there, not twice
    const paneShown = drafting && (await attempt(async () => (await $.ui.panes()).some(p => p.id === DRAFT_PANE && p.isShown && p.isPlaced), false))
    if (previewing && !paneShown && (box.shows() || box.holding)) {
      // the box as it is now: a change the mod did not see as an edit shows too, and is kept
      const token = box.readStart()
      const seen = await $.prompt.read()
      const read = seen.text
      box.read(token, read, seen.cursor)
      // a read overtaken by an edit, a send, a new session or a later read: the mirror's text instead
      const now = box.current(token) ? read : box.draft
      previewRows = (now !== '' ? modelPreview(now, false, columns, maxRows, settings) : box.ghost !== null && !working ? modelPreview(box.ghost, true, columns, maxRows, settings) : null) ?? []
    }
    const recapModel = shown && !working ? modelRecap(shown.text, shown.hint, columns, settings) : null
    const band: BandRow[] = recapModel && recapModel.rows.length + previewRows.length <= maxRows ? recapModel.rows.map(r => ({ spans: r.spans, rtl: recapModel.rtl, mark: r.first ? '※' : ' ' })) : []
    band.push(...previewRows)
    if (band.length === 0) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const rows = band.map(r => {
      const mark = <Box width={BAND_PREFIX}><Text dimColor>{r.rtl ? ` ${r.mark}` : `${r.mark} `}</Text></Box>
      const text = (
        <Box flexGrow={1} justifyContent={r.rtl ? 'flex-end' : 'flex-start'}>
          {drawRow({ Box, Text }, bandPieces(r), null)}
        </Box>
      )
      return <Box width={columns}>{r.rtl ? [text, mark] : [mark, text]}</Box>
    })
    // the engine's own band below ours: an engine node may not sit under a Box with a width
    const rest = await next(e)
    return (
      <Box flexDirection="column">
        {rows}
        {rest}
      </Box>
    )
  })
}
