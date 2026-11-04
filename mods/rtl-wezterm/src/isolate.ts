// Span isolation, so that one byte stream reads right in a plain terminal and in a browser
// terminal that runs bidi again on top of the cell grid.
//
// xterm.js's DOM renderer (used by browser terminals) draws each run of cells with equal attributes as one
// `display:inline-block` span, and the browser runs the bidi algorithm inside every span as its
// own LTR paragraph. Visual-order Hebrew inside one span is reversed a second time there. A span
// that holds a single strong-RTL cluster has nothing to reorder, though, and a span with no RTL
// keeps its order. A plain terminal ignores the split and draws the cells as they are.
//
// So a visual row starts a new attribute run (`tick` flips) wherever the run so far plus the next
// cluster would not keep its order under an LTR bidi pass. In an LTR paragraph a strong-RTL letter
// gets level 1, an Arabic number (AN) level 2, a European number (EN) level 2 after an RTL letter
// and level 0 otherwise, and a neutral between two of R/AN takes level 1. A run stays in order
// while it holds at most one RTL letter and no number beside it, or numbers with no RTL letter,
// where Arabic numbers form one unbroken group (`١-٢` is AN, ES, AN: levels 2 1 2, reversed). So
// a new run starts:
// - before an RTL letter when the run holds an RTL letter or a number;
// - before a European number when the run holds an RTL letter;
// - before an Arabic number when the run holds an RTL letter, or an Arabic number that is not
//   right before it.
// A run is what the terminal will merge: consecutive cells whose final attributes are equal. So
// the state follows the attributes the pieces will really be drawn with (`attr`, after palette,
// overrides and inheritance), not the style spans: a style change whose attributes come out equal
// does not start a run, and a forced split flips `tick`, which always changes the attributes of
// the piece's own style. The two colors of a style differ by one unit per channel: invisible, but
// distinct. Measured in tools/xterm-harness (xterm.js 6.1.0-beta.304, Chromium 1208, Liberation
// Mono and DejaVu Sans Mono).

import { charClass } from './bidi.ts'
import { COMMENT, STRING } from './code.ts'
import type { Span } from './layout.ts'
import { BOLD, CODE, DIM, ITALIC, STRIKE, UNDERLINE } from './markdown.ts'
import { graphemes } from './width.ts'

export type Piece = { text: string; style: number; tick: boolean }

// The final attributes of a piece, as one comparable key.
export type AttrKey = (style: number, tick: boolean) => string

const abstractKey: AttrKey = (style, tick) => `${style}|${tick}`

// A row's spans (visual order, the whole row: body and prefix) cut into pieces at style changes and
// at forced boundaries.
export function isolateRow(spans: Span[], attr: AttrKey = abstractKey): Piece[] {
  const out: Piece[] = []
  let tick = false
  let run: string | null = null
  let hasRtl = false
  let hasDigit = false
  let hasAn = false
  let prevAn = false
  const reset = () => {
    hasRtl = false
    hasDigit = false
    hasAn = false
  }
  for (const span of spans) {
    let cur = ''
    for (const g of graphemes(span.text)) {
      const key = attr(span.style, tick)
      if (key !== run) {
        run = key
        reset()
      }
      const k = charClass(g)
      const split =
        (k === 'R' && (hasRtl || hasDigit || hasAn)) || (k === 'D' && hasRtl) || (k === 'A' && (hasRtl || (hasAn && !prevAn)))
      if (split) {
        if (cur) out.push({ text: cur, style: span.style, tick })
        cur = ''
        tick = !tick
        run = attr(span.style, tick)
        reset()
      }
      cur += g
      if (k === 'R') hasRtl = true
      if (k === 'D') hasDigit = true
      if (k === 'A') hasAn = true
      prevAn = k === 'A'
    }
    if (cur) out.push({ text: cur, style: span.style, tick })
  }
  return out
}

export function rowHasRtl(spans: Span[]): boolean {
  return spans.some(s => graphemes(s.text).some(g => charClass(g) === 'R'))
}

// The theme colors the mod draws with, per Claude Code theme (read from the 2.1.288 binary's theme
// table): `text` (the reply bullet's color), `permission` (inline code), `userMessageBackground`.
// Ansi themes have no one-unit neighbour, so they get no ticks (`null`): correct in a terminal,
// and the documented degradation in a browser terminal.
export type Palette = { text: string; code: string; userBg: string } | null

const THEMES: Record<string, Palette> = {
  dark: { text: '#ffffff', code: '#b1b9f9', userBg: '#373737' },
  'dark-daltonized': { text: '#ffffff', code: '#99ccff', userBg: '#373737' },
  light: { text: '#000000', code: '#5769f7', userBg: '#f0f0f0' },
  'light-daltonized': { text: '#000000', code: '#3366ff', userBg: '#dcdcdc' },
  'dark-ansi': null,
  'light-ansi': null,
}

export function paletteFor(theme: string | undefined, textOverride?: string): Palette {
  const p = theme !== undefined && theme in THEMES ? THEMES[theme] : theme?.startsWith('light') ? THEMES.light : THEMES.dark
  if (p && textOverride && /^#[0-9a-fA-F]{6}$/.test(textOverride)) return { ...p, text: textOverride.toLowerCase() }
  return p
}

// The same color moved one unit per channel toward the middle, so it never clips.
export function nudge(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => (v >= 128 ? v - 1 : v + 1).toString(16).padStart(2, '0')).join('')
}

// Comments and strings of the code lines drawn by the mod (code.ts), in the colors Claude Code's
// highlighter gives them, ANSI green and red, as the engine writes those names (2.1.289).
export const COMMENT_COLOR = '#46a758'
export const STRING_COLOR = '#e5484d'

// The attributes a piece of a colored row is drawn with: its style, and the color of its kind
// (a comment, a string, inline code, or text) with the tick applied. Every piece's own color is set, so equal props
// mean equal cells.
export type PieceProps = { color: string; bold?: true; italic?: true; strikethrough?: true; underline?: true; dimColor?: true }

export function pieceProps(style: number, tick: boolean, palette: NonNullable<Palette>): PieceProps {
  const base = style & COMMENT ? COMMENT_COLOR : style & STRING ? STRING_COLOR : style & CODE ? palette.code : palette.text
  const p: PieceProps = { color: tick ? nudge(base) : base }
  if (style & BOLD) p.bold = true
  if (style & ITALIC) p.italic = true
  if (style & STRIKE) p.strikethrough = true
  if (style & UNDERLINE) p.underline = true
  if (style & DIM) p.dimColor = true
  return p
}

export function propsKey(p: PieceProps): string {
  return `${p.color}|${p.bold ? 'b' : ''}${p.italic ? 'i' : ''}${p.strikethrough ? 's' : ''}${p.underline ? 'u' : ''}${p.dimColor ? 'd' : ''}`
}
