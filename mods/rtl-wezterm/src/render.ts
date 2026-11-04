// From an assistant text block to a row model the hooks module turns into elements. Pure: no
// engine calls, so it is unit-tested in Node and memoized per (text, width, settings).
//
// Blocks that hold RTL text are laid out here; blocks that hold none go to the engine's own
// `Markdown` (consecutive ones merged into one leaf), fences to its `Code` (their lines with RTL
// text are drawn here, code.ts). A reply the model
// cannot represent (mermaid, a table with RTL text, a width too small for its content, a leaf
// over the engine's limits) returns null, and the hook leaves the whole message to the engine.

import { hasRtl, resolveParagraph, type Base } from './bidi.ts'
import { codeParts } from './code.ts'
import { cleanText, layoutParagraph, type Arabic, type Mode, type Row, type Run, type Span } from './layout.ts'
import { BOLD, DIM, ITALIC, UNDERLINE, markerText, parseBlocks, parseInline, parseTable, type Align, type Block, type Table } from './markdown.ts'
import { textWidth } from './width.ts'

// The reply bullet, drawn in the theme's text color.
export const BULLET = 128

export type Settings = { mode: Mode; base: Base; share: number; arabic?: Arabic }

// `lead`: the start-side prefix of a text row (gutter, list markers, quote bars), already in the
// visual order of the row's side: drawn after the spans on an RTL row, before them on an LTR one.
// `rtl` is the row's side (its alignment and where its lead goes), not its text's direction: in a
// list it is the list's side, so an English item of a Hebrew list sits under its siblings, its own
// text in LTR order. A code row's `inset` keeps that many cells free on the right.
// `paint`: drawn in explicit colors even without RTL text (a table's rows, so its borders keep one
// color; the code rows drawn here, so their comments and strings keep theirs).
export type RowModel =
  | { kind: 'text'; spans: Span[]; rtl: boolean; lead: Span[]; paint?: boolean }
  | { kind: 'code'; language: string; source: string; indent: number; bullet: boolean; inset?: number }
  | { kind: 'markdown'; text: string; bullet: boolean }
  | { kind: 'blank' }

export type Model = { width: number; rows: RowModel[] }

// The start side's gutter holds the reply bullet; the far side keeps the same margin.
export const GUTTER = 2
export const MARGIN = 2
// The engine refuses a Code or Markdown leaf longer than this.
export const LEAF_MAX = 10000

export function shouldDraw(text: string): boolean {
  return hasRtl(text)
}

// One container level's prefix: its first row's text, every later row's text, and their style.
type Seg = { first: string; rest: string; style: number; used: boolean }

const seg = (first: string, rest: string, style = 0): Seg => ({ first, rest, style, used: false })

// A prefix as spans for one row. On an RTL row the segments come in reverse and each is mirrored:
// `- ` becomes ` -`, `10. ` becomes ` .10` (the number keeps its digits' order, as UBA lays out a
// marker inside RTL text), the quote bar moves to the right edge of its cell.
function leadOf(segs: Seg[], rtl: boolean): Span[] {
  const out: Span[] = []
  const parts = segs.map(s => ({ text: s.used ? s.rest : s.first, style: s.style }))
  for (const s of segs) s.used = true
  for (const p of rtl ? parts.reverse() : parts) {
    for (const span of rtl ? mirrorPrefix(p.text, p.style) : splitBullet(p.text, p.style)) {
      const prev = out[out.length - 1]
      if (prev && prev.style === span.style) prev.text += span.text
      else out.push(span)
    }
  }
  return out
}

// The bullet and the quote bar carry their own style; the spaces around them stay plain.
function splitBullet(text: string, style: number): Span[] {
  const m = text.match(/^(\S*)(\s*)$/)
  if (!m || !style) return [{ text, style: 0 }]
  return [{ text: m[1], style }, { text: m[2], style: 0 }].filter(s => s.text)
}

function mirrorPrefix(text: string, style: number): Span[] {
  const m = text.match(/^(\S*)(\s*)$/)
  if (!m || !m[1]) return [{ text, style: 0 }]
  const mark = m[1] === '▎' ? '▕' : /\d/.test(m[1]) ? m[1].replace(/^(\d+)(\.)$/, '$2$1') : m[1].replace(/^([a-z]+)(\.)$/, '$2$1')
  return [{ text: m[2], style: 0 }, { text: mark, style }].filter(s => s.text)
}

class NoFit extends Error {}

export function modelAssistant(text: string, columns: number, isFirstOfReply: boolean, s: Settings): Model | null {
  const width = columns - 1
  if (!(width > GUTTER + MARGIN)) return null
  const blocks = parseBlocks(text)
  if (blocks.some(b => b.kind === 'mermaid')) return null
  const flow = replyFlow(blocks, s)
  const rows: RowModel[] = []
  let bulletPending = isFirstOfReply
  const gutter = () => {
    const g = seg(bulletPending ? '● ' : '  ', '  ', BULLET)
    bulletPending = false
    return g
  }

  // Lays out blocks inside containers (`segs`, outermost first, the gutter included). `side`: the
  // enclosing list's side (true: RTL), which places every row inside it; null outside lists.
  const walk = (list: Block[], segs: Seg[], depth: number, quoteStyle: number, side: boolean | null): void => {
    const prefixCells = segs.reduce((a, g) => a + textWidth(g.first), 0)
    const avail = width - prefixCells - MARGIN
    if (avail < 1) throw new NoFit()
    for (let i = 0; i < list.length; i++) {
      const b = list[i]
      switch (b.kind) {
        case 'space':
          rows.push({ kind: 'blank' })
          break
        case 'rule': {
          const rtl = side ?? false
          rows.push({ kind: 'text', spans: [{ text: '---', style: 0 }], rtl, lead: leadOf(segs, rtl) })
          break
        }
        case 'code':
          // in an RTL list the prefix is on the right: the code keeps its left origin at the margin
          rows.push(...(side ? codeRows(b, MARGIN, false, width, s, prefixCells) : codeRows(b, prefixCells, false, width, s)))
          for (const g of segs) g.used = true
          break
        case 'table': {
          const t = parseTable(b.source)
          if (t === null) {
            walk([{ kind: 'para', text: b.source, heading: 0, source: b.source }], segs, depth, quoteStyle, side)
            break
          }
          for (const line of tableLines(t, avail + 1, quoteStyle, s, flow)) {
            const rtl = side ?? line.rtl
            rows.push({ kind: 'text', spans: line.spans, rtl, lead: leadOf(segs, rtl), paint: true })
          }
          break
        }
        case 'mermaid':
          throw new NoFit()
        case 'para': {
          const style = b.heading === 1 ? BOLD | ITALIC | UNDERLINE : b.heading ? BOLD : quoteStyle
          const runs: Run[] = parseInline(b.text, style)
          const laid = layoutParagraph(runs.length ? runs : [{ text: '', style }], { width: avail, base: s.base, share: s.share, mode: s.mode, arabic: s.arabic })
          if (laid === null) throw new NoFit()
          for (const r of laid) rows.push({ kind: 'text', spans: r.spans, rtl: side ?? r.rtl, lead: leadOf(segs, side ?? r.rtl) })
          // Claude Code ends a heading with an empty line of its own
          if (b.heading && i + 1 < list.length && list[i + 1].kind !== 'space') rows.push({ kind: 'blank' })
          break
        }
        case 'quote':
          walk(b.blocks, [...segs, seg('▎ ', '▎ ', DIM)], depth, quoteStyle | ITALIC, side)
          break
        case 'list': {
          // the outermost list decides for all of it: its own prose, else the reply's, else LTR
          const listSide = side ?? replyFlow([b], s) ?? flow ?? false
          b.items.forEach((item, n) => {
            if (item.gap) rows.push({ kind: 'blank' })
            const marker = markerText(b.ordered, b.start + n, depth)
            const itemSeg = seg(marker + ' ', ' '.repeat(textWidth(marker) + 1))
            const inner = [...segs, itemSeg]
            if (item.blocks.length === 0 || item.blocks[0].kind !== 'para') {
              rows.push({ kind: 'text', spans: [], rtl: listSide, lead: leadOf(inner, listSide) })
            }
            walk(item.blocks, inner, depth + 1, quoteStyle, listSide)
          })
          break
        }
      }
    }
  }

  try {
    let pendingLeaf: string[] = []
    let leafEndsInHeading = false
    const flushLeaf = (beforeBlock: boolean) => {
      if (!pendingLeaf.length) return
      const leaf = cleanText(pendingLeaf.join('\n\n'))
      if (leaf.length > LEAF_MAX) throw new NoFit()
      rows.push({ kind: 'markdown', text: leaf, bullet: bulletPending })
      if (beforeBlock && leafEndsInHeading) rows.push({ kind: 'blank' })
      bulletPending = false
      pendingLeaf = []
    }
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (b.kind === 'space') {
        // a blank between two native blocks belongs to their merged leaf
        const prevLeaf = pendingLeaf.length > 0
        const next = blocks[i + 1]
        if (prevLeaf && next && isNative(next)) continue
        flushLeaf(false)
        rows.push({ kind: 'blank' })
        continue
      }
      if (isNative(b)) {
        pendingLeaf.push(b.source)
        leafEndsInHeading = b.kind === 'para' && b.heading > 0
        continue
      }
      flushLeaf(true)
      // A top-level block's rows depend only on its source, the width, the settings and whether it
      // carries the reply bullet: kept, so a streaming reply lays out only its last block again.
      const key = `${width}|${s.mode}|${s.base}|${s.share}|${s.arabic ?? 'letters'}|${bulletPending}|${flow}|${b.source}`
      const kept = blockMemo.get(key, () => {
        const from = rows.length
        try {
          if (b.kind === 'code') rows.push(...codeRows(b, GUTTER, bulletPending, width, s))
          else walk([b], [gutter()], 0, 0, null)
        } catch (err) {
          if (err instanceof NoFit) return null
          throw err
        }
        return rows.splice(from)
      })
      if (kept === null) throw new NoFit()
      bulletPending = false
      rows.push(...kept)
      if (b.kind === 'para' && b.heading && i + 1 < blocks.length && blocks[i + 1].kind !== 'space') rows.push({ kind: 'blank' })
    }
    flushLeaf(false)
  } catch (err) {
    if (err instanceof NoFit) return null
    throw err
  }
  return { width, rows }
}

// A table as Claude Code 2.1.288 draws one (its markdown table printer): column widths from each
// column's longest word and full text, shared out over the room; box-drawing borders; a header
// row centered; cells wrapped and centered vertically; past 4 lines in a cell, or wider than the
// room, the vertical form (`header: value` per cell, rows apart by a rule); past 200 rows a note.
// An RTL table (its header row resolved as a paragraph) runs its columns from the right and aligns
// a cell to its start: no alignment and `:--` mean the right edge there, `--:` the left.
const TABLE_MIN = 3
const TABLE_MAX_LINES = 4
const TABLE_MAX_ROWS = 200

type Line = { spans: Span[]; rtl: boolean }

function tableLines(t: Table, room: number, style: number, s: Settings, flow: boolean | null): Line[] {
  const truncated = Math.max(0, t.rows.length - TABLE_MAX_ROWS)
  const body = t.rows.slice(0, TABLE_MAX_ROWS)
  const runsOf = (text: string): Run[] => {
    const runs = parseInline(text, style)
    return runs.length ? runs : [{ text: '', style }]
  }
  const head = t.header.map(runsOf)
  const cells = body.map(r => r.map(runsOf))
  const plain = (runs: Run[]) => runs.map(r => r.text).join('')
  const all = [head, ...cells]
  const n = t.align.length
  // The direction: right-to-left when the header row (the table's own words) reads so; otherwise
  // the reply's (`flow`), so that in an Arabic reply a table comparing `git merge` with
  // `git rebase` runs from the right; in a reply that is only tables, the whole table's. Code spans
  // and link destinations do not count.
  const prose = (runs: Run[]) => runs.filter(r => !r.isolate).map(r => r.text).join('')
  const rtlText = (text: string) => (resolveParagraph(text, null, s.base, s.share).level & 1) === 1
  const rtl = rtlText(head.map(prose).join(' ')) || (flow ?? rtlText(all.flat().map(prose).join(' ')))

  const words = (runs: Run[]) => Math.max(TABLE_MIN, ...plain(runs).split(/\s+/).filter(Boolean).map(textWidth))
  const full = (runs: Run[]) => Math.max(textWidth(plain(runs)), TABLE_MIN)
  const minW = t.align.map((_, c) => Math.max(...all.map(r => words(r[c]))))
  const ideal = t.align.map((_, c) => Math.max(...all.map(r => full(r[c]))))
  const room0 = Math.max(room - (1 + n * 3), n * TABLE_MIN)
  const sumMin = minW.reduce((a, b) => a + b, 0)
  const sumIdeal = ideal.reduce((a, b) => a + b, 0)
  let widths: number[]
  if (sumIdeal <= room0) widths = ideal
  else if (sumMin <= room0) {
    const extra = room0 - sumMin
    const slack = ideal.map((v, c) => v - minW[c])
    const total = slack.reduce((a, b) => a + b, 0)
    widths = minW.map((v, c) => (total === 0 ? v : v + Math.floor((slack[c] / total) * extra)))
  } else widths = minW.map(v => Math.max(Math.floor((v * room0) / sumMin), TABLE_MIN))

  const lay = (runs: Run[], width: number) => {
    const laid = layoutParagraph(runs, { width, base: s.base, share: s.share, mode: s.mode, arabic: s.arabic })
    if (laid === null) throw new NoFit()
    return laid
  }
  const laidHead = head.map((r, c) => lay(r, widths[c]))
  const laidBody = cells.map(row => row.map((r, c) => lay(r, widths[c])))
  const tallest = Math.max(...[laidHead, ...laidBody].flat().map(l => l.length))
  const lineWidth = 1 + widths.reduce((a, w) => a + w + 3, 0)
  if (tallest > TABLE_MAX_LINES || lineWidth > room) return verticalTable(t, head, cells, room, rtl, truncated, s)

  const cols = rtl ? [...widths.keys()].reverse() : [...widths.keys()]
  const alignOf = (c: number, header: boolean): Align => {
    if (header) return 'center'
    const a = t.align[c]
    if (!rtl) return a ?? 'left'
    return a === 'center' ? 'center' : a === 'right' ? 'left' : 'right'
  }
  const border = (l: string, m: string, r: string): Line => ({
    spans: [{ text: l + cols.map(c => '\u2500'.repeat(widths[c] + 2)).join(m) + r, style: 0 }],
    rtl,
  })
  const rowLines = (laid: Row[][], header: boolean): Line[] => {
    const height = Math.max(1, ...laid.map(l => l.length))
    const out: Line[] = []
    for (let g = 0; g < height; g++) {
      const spans: Span[] = [{ text: '\u2502', style: 0 }]
      for (const c of cols) {
        const top = Math.floor((height - laid[c].length) / 2)
        const line = g - top >= 0 && g - top < laid[c].length ? laid[c][g - top] : null
        const free = Math.max(0, widths[c] - (line ? line.width : 0))
        const a = alignOf(c, header)
        const before = a === 'center' ? Math.floor(free / 2) : a === 'right' ? free : 0
        spans.push({ text: ' ' + ' '.repeat(before), style: 0 })
        if (line) spans.push(...line.spans)
        spans.push({ text: ' '.repeat(free - before) + ' \u2502', style: 0 })
      }
      out.push({ spans: merge(spans), rtl })
    }
    return out
  }
  const lines: Line[] = [border('\u250C', '\u252C', '\u2510'), ...rowLines(laidHead, true), border('\u251C', '\u253C', '\u2524')]
  laidBody.forEach((laid, i) => {
    lines.push(...rowLines(laid, false))
    if (i < laidBody.length - 1) lines.push(border('\u251C', '\u253C', '\u2524'))
  })
  lines.push(border('\u2514', '\u2534', '\u2518'))
  if (truncated > 0) lines.push(...moreRows(truncated, room, s))
  return lines
}

// The vertical form: per row, each cell as `header: value` (the header bold), rows apart by a rule.
function verticalTable(t: Table, head: Run[][], cells: Run[][][], room: number, rtl: boolean, truncated: number, s: Settings): Line[] {
  const rule: Line = { spans: [{ text: '\u2500'.repeat(Math.min(room, 40)), style: 0 }], rtl }
  const out: Line[] = []
  // A table with no body rows still shows its header, one cell per line.
  if (cells.length === 0) {
    for (const runs of head) {
      const name = runs.map(r => ({ ...r, style: r.style | BOLD, text: r.text.replace(/\s+/g, ' ') }))
      if (!name.some(r => r.text.trim())) continue
      const laid = layoutParagraph(name, { width: room, base: s.base, share: s.share, mode: s.mode, arabic: s.arabic })
      if (laid === null) throw new NoFit()
      for (const r of laid) out.push({ spans: r.spans, rtl: r.rtl })
    }
  }
  for (const row of cells) {
    const lines: Line[] = []
    row.forEach((runs, c) => {
      const name = head[c].map(r => r.text).join('').trim()
      const value = runs.map(r => ({ ...r, text: r.text.replace(/\s+/g, ' ') }))
      if (!name && !value.some(r => r.text.trim())) return
      const para: Run[] = name ? [{ text: name, style: BOLD }, { text: ': ', style: 0 }, ...value] : value
      const laid = layoutParagraph(para, { width: room, base: s.base, share: s.share, mode: s.mode, arabic: s.arabic })
      if (laid === null) throw new NoFit()
      for (const r of laid) lines.push({ spans: r.spans, rtl: r.rtl })
    })
    if (!lines.length) continue
    if (out.length) out.push(rule)
    out.push(...lines)
  }
  if (truncated > 0) {
    if (out.length) out.push(rule)
    out.push(...moreRows(truncated, room, s))
  }
  return out
}

// The note past the row cap, laid out to the room like any paragraph.
function moreRows(n: number, room: number, s: Settings): Line[] {
  const text = `\u2026 ${n.toLocaleString('en-US')} more ${n === 1 ? 'row' : 'rows'} not shown`
  const laid = layoutParagraph([{ text, style: 0 }], { width: room, base: s.base, share: s.share, mode: s.mode, arabic: s.arabic })
  if (laid === null) throw new NoFit()
  return laid.map(r => ({ spans: r.spans, rtl: r.rtl }))
}

// The direction of a reply's prose (paragraphs, also inside lists and quotes; not tables, fences,
// code spans or link destinations), or null when it has no letter.
function replyFlow(blocks: Block[], s: Settings): boolean | null {
  const parts: string[] = []
  const collect = (list: Block[]): void => {
    for (const b of list) {
      if (b.kind === 'para') parts.push(parseInline(b.text).filter(r => !r.isolate).map(r => r.text).join(''))
      else if (b.kind === 'list') for (const item of b.items) collect(item.blocks)
      else if (b.kind === 'quote') collect(b.blocks)
    }
  }
  collect(blocks)
  const text = parts.join(' ')
  if (!/\p{L}/u.test(text)) return null
  return (resolveParagraph(text, null, s.base, s.share).level & 1) === 1
}

function merge(spans: Span[]): Span[] {
  const out: Span[] = []
  for (const sp of spans) {
    if (!sp.text) continue
    const prev = out[out.length - 1]
    if (prev && prev.style === sp.style) prev.text += sp.text
    else out.push({ ...sp })
  }
  return out
}

// A block the engine draws itself: one without RTL text (fences always go to `Code`).
function isNative(b: Block): boolean {
  return b.kind !== 'space' && b.kind !== 'code' && !hasRtl(b.source)
}

// A fence's rows at `indent` cells, `inset` cells kept free on the right: `Code` leaves, and in
// visual order the rows of its lines with RTL text (code.ts), drawn left-aligned after the indent.
// The reply bullet goes on the first row.
type CodeBlock = Extract<Block, { kind: 'code' }>

function codeRows(b: CodeBlock, indent: number, bullet: boolean, width: number, s: Settings, inset = 0): RowModel[] {
  // a fence the scanner cannot be sure of, or with a cluster wider than the room, is drawn whole by
  // the engine's `Code`, as Claude Code draws it; the rest of the reply is still the mod's
  const parts = (s.mode === 'visual' && hasRtl(b.text) ? codeParts(b.text, b.language, width - indent - inset, s) : null) ?? [{ kind: 'native' as const, text: b.text }]
  const rows: RowModel[] = []
  for (const part of parts) {
    if (part.kind === 'native') {
      for (const source of chunks(part.text)) {
        rows.push({ kind: 'code', language: b.language, source, indent, bullet, ...(inset ? { inset } : {}) })
        bullet = false
      }
      continue
    }
    for (const spans of part.rows) {
      const lead: Span[] = bullet ? [{ text: '●', style: BULLET }, { text: ' '.repeat(indent - 1), style: 0 }] : [{ text: ' '.repeat(indent), style: 0 }]
      rows.push({ kind: 'text', spans, rtl: false, lead: lead.filter(sp => sp.text), paint: true })
      bullet = false
    }
  }
  return rows
}

// A Code leaf holds at most LEAF_MAX characters: longer sources are cut at line boundaries into
// several leaves, drawn one under the other. A single longer line cannot be drawn this way.
// Display controls other than tab and newline are dropped first (the engine refuses them in a leaf),
// as in prose (layout.ts cleanText).
function chunks(raw: string): string[] {
  const source = cleanText(raw)
  if (source.length <= LEAF_MAX) return [source]
  const out: string[] = []
  let cur = ''
  for (const line of source.split('\n')) {
    if (line.length > LEAF_MAX) throw new NoFit()
    if (cur && cur.length + 1 + line.length > LEAF_MAX) {
      out.push(cur)
      cur = line
    } else cur = cur ? cur + '\n' + line : line
  }
  out.push(cur)
  return out
}

// A user prompt row: drawn literally as Claude Code draws it (no markdown). Each source line is its
// own paragraph (a newline in a prompt separates paragraphs, as UAX #9 treats it). Two cells on
// the left hold the `❯` of the first row, as in the composer.
export type UserModel = { width: number; content: number; rows: { spans: Span[]; rtl: boolean; first: boolean }[] }

export const USER_PREFIX = 2

export function modelUser(text: string, columns: number, s: Settings): UserModel | null {
  return modelLines(text, columns, USER_PREFIX, s, line => [{ text: line, style: 0 }])
}

// A slash command's output row (the summary `/recap` prints): five cells on the left hold the
// engine's `  ⎿  `, then the text. Each source line is its own paragraph, with its inline styles.
export const COMMAND_PREFIX = 5

export function modelCommand(text: string, columns: number, s: Settings): UserModel | null {
  return modelLines(text, columns, COMMAND_PREFIX, s, line => {
    const runs = parseInline(line)
    return runs.length ? runs : [{ text: '', style: 0 }]
  })
}

function modelLines(text: string, columns: number, prefix: number, s: Settings, runsOf: (line: string) => Run[]): UserModel | null {
  const width = columns - 1
  const content = width - prefix - 1
  if (!(content >= 1)) return null
  const rows: UserModel['rows'] = []
  for (const line of text.replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '').split('\n')) {
    const laid = layoutParagraph(runsOf(line), { width: content, base: s.base, share: s.share, mode: s.mode, arabic: s.arabic })
    if (laid === null) return null
    for (const r of laid) rows.push({ spans: r.spans, rtl: r.rtl, first: rows.length === 0 })
  }
  return { width, content, rows }
}

// A bounded memo: re-renders of an unchanged block (scrolling, a redraw of a neighbour) and the
// repeated prefixes of a streaming reply are common; width changes and new text miss. Bounded by
// total key length as well as entry count, since a streaming reply's prefixes are long.
export class Memo<V> {
  private map = new Map<string, V>()
  private chars = 0
  private limit: number
  private charLimit: number
  constructor(limit = 200, charLimit = 2_000_000) {
    this.limit = limit
    this.charLimit = charLimit
  }
  get(key: string, make: () => V): V {
    const hit = this.map.get(key)
    if (hit !== undefined || this.map.has(key)) {
      this.map.delete(key)
      this.map.set(key, hit as V)
      return hit as V
    }
    const v = make()
    this.map.set(key, v)
    this.chars += key.length
    while (this.map.size > this.limit || this.chars > this.charLimit) {
      const oldest = this.map.keys().next().value!
      this.map.delete(oldest)
      this.chars -= oldest.length
    }
    return v
  }
}

// Rows of top-level blocks, shared by every message (see modelAssistant). After the class: a
// class is not hoisted.
const blockMemo = new Memo<RowModel[] | null>(2000, 4_000_000)
