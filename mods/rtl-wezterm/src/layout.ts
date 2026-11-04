// Paragraph layout: logical styled runs in, rows of visual styled spans out.
//
// Order of work (UAX #9 section 3.4): resolve the paragraph's embedding levels on the whole
// logical paragraph, break lines on logical text by terminal cell width, then reorder each line
// on its own (L1, L2 on whole grapheme clusters, L4 mirroring). Styles travel with clusters, so
// a bold word stays bold wherever it lands. A cluster's style is that of its first code unit.
//
// A `\n` inside the runs is a forced line break within the same paragraph (a Markdown soft or
// hard break, a newline in a prompt): the lines on both sides share one resolution, so a line
// that starts with an English word still sits on the paragraph's RTL base.

import { l1Kind, mirror, reorderLine, resolveParagraph, type Base } from './bidi.ts'
import { clusterWidth, graphemes } from './width.ts'
import { needsShaping, shape } from './shape.ts'

// `isolate`: the run is an LTR isolate for resolution (inline code: a path or a flag keeps its
// own order inside RTL text).
export type Run = { text: string; style: number; isolate?: boolean }
export type Span = { text: string; style: number }
export type Row = { spans: Span[]; width: number; rtl: boolean }
export type Mode = 'visual' | 'logical'
// How Arabic-script letters are written in visual mode (docs/design/arabic-persian.md):
// `letters`, the plain letters, which a terminal that shapes joins with its font (Windows
// Terminal); `forms`, the presentation forms of shape.ts, for terminals that cannot join them
// (browser terminals built on xterm.js, where each RTL letter is its own color run).
export type Arabic = 'letters' | 'forms'

export type LayoutOptions = {
  // cells available to the first line, and to every later line (defaults to `width`)
  width: number
  restWidth?: number
  base: Base
  share?: number
  mode: Mode
  // default `letters`
  arabic?: Arabic
}

export const TAB_STOP = 4

// Bidi controls take part in level resolution but are never drawn: the engine would show the
// embedding/isolate ones as U+FFFD and strips the marks. Other format characters standing alone
// (ZWSP, soft hyphen, BOM) have no glyph and are not drawn either. Inside a cluster (ZWJ, VS16)
// they stay with it.
const UNDRAWN = /^\p{Cf}+$/u
const SPACE = /^[\t \u00a0 - 　]$/u
// C0 and C1 controls other than tab and newline never reach a leaf.
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/gu
const LINE_BREAK = /\r\n?|[\u2028\u2029\u0085]/gu

export type Cluster = { start: number; end: number; text: string; width: number; space: boolean; drawn: boolean; brk: boolean }

export function cleanText(text: string): string {
  return text.replace(LINE_BREAK, '\n').replace(CONTROL, '')
}

// Clusters with their cell widths. A tab advances to the next multiple of `tab` (TAB_STOP in prose)
// counted from the start of its source line (before wrapping), and is drawn as that many spaces.
// `widthOf` may give a grapheme's width instead (code atoms).
export function clustersOf(text: string, tab = TAB_STOP, widthOf?: (g: string) => number | undefined): Cluster[] {
  const out: Cluster[] = []
  let at = 0
  let column = 0
  for (const g of graphemes(text)) {
    const brk = g === '\n'
    const drawn = !brk && !UNDRAWN.test(g)
    let width = drawn ? (widthOf?.(g) ?? clusterWidth(g)) : 0
    if (g === '\t') width = tab - (column % tab)
    column = brk ? 0 : column + width
    out.push({ start: at, end: at + g.length, text: g, width, space: SPACE.test(g), drawn, brk })
    at += g.length
  }
  return out
}

// Line breaks over clusters: [first, last) cluster ranges, trailing spaces excluded. A soft wrap
// drops the spaces it consumed from the next line's start; a forced break keeps them. An overlong
// word is broken at a cluster boundary; a cluster is never split. Returns null when a cluster is
// wider than its line: that content cannot be laid out at this width.
export function breakLines(cs: Cluster[], width: number, restWidth: number): [number, number][] | null {
  const lines: [number, number][] = []
  const trimEnd = (start: number, end: number) => {
    while (end > start && cs[end - 1].space) end--
    return end
  }
  let start = 0
  let forced = true
  while (start < cs.length) {
    if (!forced) while (start < cs.length && cs[start].space) start++
    if (start >= cs.length) break
    const limit = lines.length === 0 ? width : restWidth
    let used = 0
    let lastBreak = -1 // the latest word start preceded by a space, past `start`
    let k = start
    let hitBreak = false
    for (; k < cs.length; k++) {
      const c = cs[k]
      if (c.brk) {
        hitBreak = true
        break
      }
      if (!c.space && c.width > limit) return null
      if (!c.space && k > start && cs[k - 1].space) lastBreak = k
      // Spaces may hang past the edge; they are trimmed from the line's end.
      if (!c.space && k > start && used + c.width > limit) break
      used += c.width
    }
    if (hitBreak) {
      lines.push([start, trimEnd(start, k)])
      start = k + 1
      forced = true
      if (start === cs.length) lines.push([start, start]) // a break at the very end leaves an empty line
      continue
    }
    if (k >= cs.length) {
      lines.push([start, trimEnd(start, cs.length)])
      break
    }
    const next = lastBreak > start ? lastBreak : k
    lines.push([start, trimEnd(start, next)])
    start = next
    forced = false
  }
  if (lines.length === 0) lines.push([0, 0])
  return lines
}

// Lays out one paragraph, or returns null when it cannot fit (a non-positive width, or a cluster
// wider than a line): the caller then leaves the whole message to the engine.
export function layoutParagraph(input: Run[], opts: LayoutOptions): Row[] | null {
  if (!(opts.width >= 1) || !((opts.restWidth ?? opts.width) >= 1)) return null
  const runs = input.map(r => ({ ...r, text: cleanText(r.text) }))
  const text = runs.map(r => r.text).join('')
  const styleAt = new Int32Array(text.length)
  const isolated = new Uint8Array(text.length)
  let at = 0
  for (const r of runs) {
    styleAt.fill(r.style, at, at + r.text.length)
    if (r.isolate) isolated.fill(1, at, at + r.text.length)
    at += r.text.length
  }
  if (opts.mode === 'visual' && opts.arabic === 'forms' && needsShaping(text)) return layoutShaped(text, styleAt, isolated, opts)
  return place(text, styleAt, isolated, opts)
}

// Arabic-script letters take their contextual forms before anything is measured (visual mode
// only: a terminal that reorders text itself also shapes it; see docs/design/arabic-persian.md).
// The paragraph's direction is chosen on the logical text, since a lam-alef ligature counts one
// letter where the source has two. The text is shaped once to find the line breaks (ligatures
// change widths), then again with each row's start as a joining boundary, so no letter reaches
// across a wrap; that second pass changes forms only, never lengths. Styles and isolate flags
// follow each display code unit back to its source.
function layoutShaped(text: string, styleAt: Int32Array, isolated: Uint8Array, opts: LayoutOptions): Row[] | null {
  const level = resolveParagraph(text, isolated, opts.base, opts.share).level
  const fixed: LayoutOptions = { ...opts, base: level & 1 ? 'rtl' : 'ltr' }
  const first = shape(text, { isolated, styles: styleAt })
  const cs = clustersOf(first.text)
  const lines = breakLines(cs, opts.width, opts.restWidth ?? opts.width)
  if (lines === null) return null
  const cuts: number[] = []
  for (const [a] of lines.slice(1)) if (a < cs.length) cuts.push(first.from[cs[a].start])
  const second = cuts.length ? shape(text, { isolated, styles: styleAt, cuts }) : first
  const shaped = second.text.length === first.text.length ? second : first
  const style2 = new Int32Array(shaped.text.length)
  const iso2 = new Uint8Array(shaped.text.length)
  for (let i = 0; i < shaped.text.length; i++) {
    style2[i] = styleAt[shaped.from[i]]
    iso2[i] = isolated[shaped.from[i]]
  }
  return place(shaped.text, style2, iso2, fixed)
}

// Lays out text whose styles and isolate flags are given per code unit.
function place(text: string, styleAt: Int32Array, isolated: Uint8Array, opts: LayoutOptions): Row[] | null {
  const para = resolveParagraph(text, isolated, opts.base, opts.share)
  const rtl = (para.level & 1) === 1
  const cs = clustersOf(text)
  // WezTerm (order: logical): the row starts with a blank left-to-right letter so WezTerm keeps every
  // cell where it was written and only turns the letters of each right-to-left piece; the pieces
  // themselves are written here in the order the eye reads them (Habib's fork, 4 Nov 2026).
  const guard = opts.mode === 'logical' && rtl ? 1 : 0
  const lines = breakLines(cs, opts.width - guard, (opts.restWidth ?? opts.width) - guard)
  if (lines === null) return null
  const rows: Row[] = []
  for (const [first, last] of lines) {
    const line = cs.slice(first, last)
    const guards: number[] = []
    let order = opts.mode === 'logical' ? piecesInReadingOrder(line, styleAt, rtl, guards) : line.map((_, i) => i)
    let final = line.map(c => para.levels[c.start])
    if (opts.mode === 'visual') {
      ;({ order, final } = reorderLine(final, line.map(c => l1Kind(c.text)), para.level))
    }
    const spans: Span[] = []
    let width = 0
    let lastDrawn = line.length - 1
    while (lastDrawn >= 0 && !line[lastDrawn].drawn) lastDrawn--
    for (const i of order) {
      if (i < 0) {
        const style = guards[-i - 1]
        const prev = spans[spans.length - 1]
        if (prev && prev.style === style) prev.text += GUARD
        else spans.push({ text: GUARD, style })
        width += 1
        continue
      }
      const c = line[i]
      if (!c.drawn) continue
      let glyph = c.text === '\t' ? ' '.repeat(c.width) : c.text
      // A plain space may stay unstyled on screen, so a bold phrase reaches WezTerm as one stretch per word,
      // each turned on its own: the words come out in reverse order. A no-break space keeps the stretch whole.
      if (opts.mode === 'logical' && glyph === ' ' && styleAt[c.start] !== 0) glyph = '\u00a0'
      if (opts.mode === 'visual' && final[i] & 1) {
        glyph = mirror(glyph) ?? glyph
        if (opts.arabic !== 'forms') glyph = joinersFirst(glyph, i === lastDrawn || spans.length === 0)
      }
      const style = styleAt[c.start]
      const prev = spans[spans.length - 1]
      if (prev && prev.style === style) prev.text += glyph
      else spans.push({ text: glyph, style })
      width += c.width
    }
    if (guard && spans.length) {
      spans.unshift({ text: GUARD, style: spans[0].style })
      width += 1
    }
    rows.push({ spans, width, rtl })
  }
  return rows
}

// U+2800 is a letter of left-to-right class that draws nothing, one cell wide.
const GUARD = '\u2800'
const RTL_SCRIPT = /(?=\p{L})[\p{Script=Arabic}\p{Script=Hebrew}]/u
const LETTER = /\p{L}/u

// One right-to-left row as indexes into its clusters: words grouped into pieces of one direction and
// one style (WezTerm keeps differently styled text in typed order), a word with no letter joining the
// piece before it, and the pieces reversed. Letters inside a piece stay in typed order for the terminal
// to turn. Closing punctuation goes first in its piece: next to a guard WezTerm would leave it on the
// reader's side. WezTerm also decides direction afresh for each stretch of one style, so a stretch that
// follows a change of style opens with a guard too. A negative index is a guard in place of the first
// cell of a gap, and guards[-i - 1] its style. A left-to-right row keeps its order and gets those guards only.
// The Arabic semicolon and question mark are right-to-left already and stay where they are.
const CLOSING = /^[.,;:!?،…]$/u
function piecesInReadingOrder(line: { text: string; start: number }[], styleAt: Int32Array, rtl: boolean, guards: number[]): number[] {
  type Piece = { from: number; to: number; rtl: boolean | null; style: number }
  const pieces: Piece[] = []
  let i = 0
  while (i < line.length && !line[i].text.trim()) i++
  const start = i
  while (i < line.length) {
    let j = i
    while (j < line.length && line[j].text.trim()) j++
    const word = line.slice(i, j).map(c => c.text).join('')
    const kind = RTL_SCRIPT.test(word) ? true : LETTER.test(word) ? false : null
    const style = styleAt[line[i].start]
    const prev = pieces[pieces.length - 1]
    // a number that opens a row stays a piece of its own: after the guard WezTerm would leave it on the left
    if (prev && prev.style === style && (kind === null || prev.rtl === kind || (prev.rtl === null && kind === false))) {
      prev.to = j
      if (prev.rtl === null) prev.rtl = kind
    } else pieces.push({ from: i, to: j, rtl: kind, style })
    i = j
    while (i < line.length && !line[i].text.trim()) i++
  }
  const order: number[] = []
  const gap = (from: number, to: number, opens: boolean, style: number) => {
    for (let k = from; k < to; k++) {
      if (opens && k === from) {
        guards.push(style)
        order.push(-guards.length)
      } else order.push(k)
    }
  }
  for (let k = 0; k < start; k++) order.push(k)
  if (!rtl) {
    pieces.forEach((pc, p) => {
      for (let k = pc.from; k < pc.to; k++) order.push(k)
      const next = pieces[p + 1]
      if (next) gap(pc.to, next.from, next.rtl === true && next.style !== pc.style, next.style)
    })
    const last = pieces.length ? pieces[pieces.length - 1].to : start
    for (let k = last; k < line.length; k++) order.push(k)
    return order
  }
  for (let p = pieces.length - 1; p >= 0; p--) {
    let end = pieces[p].to
    if (pieces[p].rtl === true) {
      while (end > pieces[p].from + 1 && CLOSING.test(line[end - 1].text)) end--
      for (let k = end; k < pieces[p].to; k++) order.push(k)
    }
    for (let k = pieces[p].from; k < end; k++) order.push(k)
    // after a right-to-left piece the gap opens with the guard, or a number that follows would join that piece
    if (p > 0) {
      const next = pieces[p - 1]
      gap(next.to, pieces[p].from, pieces[p].rtl === true || (next.rtl === true && next.style !== pieces[p].style), next.style)
    }
  }
  const end = pieces.length ? pieces[pieces.length - 1].to : start
  for (let k = end; k < line.length; k++) order.push(k)
  return order
}

// `letters` mode, right to left: a ZWNJ or ZWJ sits in the cluster of the Arabic-script letter
// before it, after the letter and among its marks, yet it stands between that letter and the next
// one. The next letter is drawn first, so the joiners go to the front of the cluster (the marks stay
// on their letter): written to the terminal, they land between the two letters they separate, where
// a terminal that shapes the row needs them (Persian `می‌خواهم`). When that next letter is not on
// this row (a wrap there, or a reply still streaming) or nothing is drawn before the cluster, the
// joiners are dropped: there is no neighbour to join or part from, and a leading zero-width
// control would take a cell of its own in xterm.js and push the row's last letter onto the next one.
// Other clusters (Hebrew, emoji sequences) and `forms` (shape.ts drops these joiners) keep their
// bytes.
const JOINERS = /[\u200c\u200d]/gu
const ARABIC_LETTER = /^(?=\p{L})\p{Script=Arabic}/u
function joinersFirst(glyph: string, drop: boolean): string {
  if (!ARABIC_LETTER.test(glyph)) return glyph
  const joiners = glyph.match(JOINERS)
  if (!joiners) return glyph
  const rest = glyph.replace(JOINERS, '')
  return drop ? rest : joiners.join('') + rest
}
