// Unicode Bidirectional Algorithm (UAX #9). Level resolution comes from the vendored bidi-js
// (Unicode 13 data); the line rules L1 and L2 are applied here, on grapheme clusters.
//
// Why not bidi-js's own line API: `getReorderSegments` applies L1 with paragraph-absolute indices
// on a line-local slice (vendor/bidi.mjs, the loop after `lineLevels = ...slice`), so lines after
// the first keep the wrong level for trailing whitespace; and its reordered output works on
// UTF-16 code units, which tears niqqud from letters and splits emoji sequences. We take the
// resolved levels only, and reverse whole clusters.
//
// Why a proxy string: bidi-js classifies `string[i]`, one UTF-16 unit at a time, so each half of
// a supplementary scalar (an emoji, a Cypriot or Adlam letter) gets the class of a lone surrogate
// (L) instead of the scalar's own. We resolve levels on a proxy with one BMP character per scalar,
// standing in for its class, and map the levels back. The proxy is also where internal isolates
// (LRI…PDI around inline code) and the line separators of soft breaks live: they take part in
// resolution and never reach the display text.

import bidiFactory from '../vendor/bidi.mjs'
import { graphemes } from './width.ts'

export type Direction = 'rtl' | 'ltr'

// How a paragraph's base direction is chosen: forced, UAX #9 P2/P3 (`first-strong`), or P2/P3
// plus the share rule (`rtl-share`): a paragraph whose letters outside inline code are at least
// `share` RTL is RTL even when its first strong letter is not.
export type Base = Direction | 'first-strong' | 'rtl-share'

type Levels = { levels: Uint8Array; paragraphs: { start: number; end: number; level: number }[] }

const bidi = bidiFactory()

// A BMP character of each bidi class, for supplementary scalars in the proxy. ON is `!` (not a
// bracket, not mirrored); B becomes a line separator (WS) so the proxy stays one paragraph.
const REPRESENTATIVE: Record<string, string> = {
  L: 'a', R: '\u05D0', AL: '\u0627', EN: '0', ES: '+', ET: '#', AN: '\u0660', CS: ',', NSM: '\u0300',
  BN: '\u00AD', B: '\u2028', S: '\t', WS: ' ', ON: '!', LRE: '\u202A', RLE: '\u202B', PDF: '\u202C',
  LRO: '\u202D', RLO: '\u202E', LRI: '\u2066', RLI: '\u2067', FSI: '\u2068', PDI: '\u2069',
}

const LRI = '\u2066'
const PDI = '\u2069'

export function classOf(scalar: string): string {
  return bidi.getBidiCharTypeName(scalar) as string
}

export type Resolved = { level: number; levels: Uint8Array }

// A readability rule on top of UAX #9 ("Tokens stay whole" in docs/design/how-it-works.md).
// Inside RTL prose, a neutral character glued to a
// Latin token is pulled to the far side of the token by N1/N2: `ghp_` reads `_ghp`, `src/`
// reads `/src`, `--dry-run` reads `dry-run--`, `.gitignore` loses its dot, `"System"` loses its
// closing quote. In a run of non-space characters without RTL letters that holds a Latin letter,
// such neutrals at the run's edges are resolved as L, so the token stays whole. Left alone: a
// Hebrew prefix hyphen (`ל-`), sentence punctuation that ends the run, and brackets (UAX #9 N0
// pairs them correctly).
const EDGE_NEUTRAL = new Set(['ON', 'CS', 'ES', 'ET'])
const SENTENCE_END = new Set(['.', ',', ';', ':', '!', '?', '\u2026', '\u060C', '\u061B', '\u061F'])
const PREFIX_HYPHEN = new Set(['-', '\u05BE'])

function isBracket(ch: string): boolean {
  return bidi.openingToClosingBracket(ch) !== null || bidi.closingToOpeningBracket(ch) !== null
}

function gluedToLatin(scalars: string[], classes: string[], skip: (i: number) => boolean): boolean[] {
  const out = new Array<boolean>(scalars.length).fill(false)
  let i = 0
  while (i < scalars.length) {
    if (skip(i) || classes[i] === 'WS' || classes[i] === 'S' || classes[i] === 'B' || classes[i] === 'R' || classes[i] === 'AL') {
      i++
      continue
    }
    let j = i
    while (j < scalars.length && !skip(j) && !['WS', 'S', 'B', 'R', 'AL'].includes(classes[j])) j++
    // [i, j): a run of non-space characters with no RTL letter
    let first = -1
    let last = -1
    for (let k = i; k < j; k++) {
      if (classes[k] === 'L' || classes[k] === 'EN' || classes[k] === 'AN') {
        if (first < 0) first = k
        last = k
      }
    }
    const hasLatin = first >= 0 && scalars.slice(i, j).some((c, n) => classes[i + n] === 'L' && /\p{L}/u.test(c))
    if (hasLatin) {
      let a = i
      if (a > 0 && (classes[a - 1] === 'R' || classes[a - 1] === 'AL') && PREFIX_HYPHEN.has(scalars[a])) a++
      for (let k = a; k < first; k++) if (EDGE_NEUTRAL.has(classes[k]) && !isBracket(scalars[k])) out[k] = true
      let b = j
      while (b > last + 1 && (SENTENCE_END.has(scalars[b - 1]) || bidi.closingToOpeningBracket(scalars[b - 1]) !== null)) b--
      for (let k = last + 1; k < b; k++) if (EDGE_NEUTRAL.has(classes[k]) && !isBracket(scalars[k])) out[k] = true
    }
    i = j
  }
  return out
}

// Resolves one paragraph. `text` is the display text (may contain `\n` for forced line breaks
// inside the paragraph); `isolated[i]` marks code units that sit inside an LTR isolate (inline
// code). Returns the paragraph level and a level per code unit of `text`. `plain` leaves out the
// readability rule below UAX #9 (tokens kept whole), for what another implementation does.
export function resolveParagraph(text: string, isolated: Uint8Array | null, base: Base, share = 0.3, plain = false): Resolved {
  const scalars: string[] = []
  const starts: number[] = []
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i)!)
    scalars.push(ch)
    starts.push(i)
    i += ch.length
  }
  const classes = scalars.map(classOf)
  const glued = plain ? scalars.map(() => false) : gluedToLatin(scalars, classes, k => isolated !== null && isolated[starts[k]] === 1)
  let proxy = ''
  const unitToProxy = new Int32Array(text.length)
  let inIsolate = false
  let rtlLetters = 0
  let letters = 0
  for (let k = 0; k < scalars.length; k++) {
    const i = starts[k]
    const scalar = scalars[k]
    const n = scalar.length
    const iso = isolated !== null && isolated[i] === 1
    if (iso !== inIsolate) {
      proxy += iso ? LRI : PDI
      inIsolate = iso
    }
    const cls = glued[k] ? 'L' : classes[k]
    if (!iso && /\p{L}/u.test(scalar)) {
      letters++
      if (cls === 'R' || cls === 'AL') rtlLetters++
    }
    unitToProxy[i] = proxy.length
    if (n === 2) unitToProxy[i + 1] = proxy.length
    proxy += cls === 'B' || scalar === '\n' ? '\u2028' : glued[k] ? 'a' : n === 2 ? (REPRESENTATIVE[cls] ?? '!') : scalar
  }
  if (inIsolate) proxy += PDI
  const run = (dir: Direction | undefined) => bidi.getEmbeddingLevels(proxy, dir) as Levels
  let result = run(base === 'rtl' || base === 'ltr' ? base : undefined)
  let level = result.paragraphs[0]?.level ?? (base === 'rtl' ? 1 : 0)
  if (base === 'rtl-share' && level === 0 && letters > 0 && rtlLetters / letters >= share) {
    result = run('rtl')
    level = 1
  }
  const levels = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) levels[i] = result.levels[unitToProxy[i]] ?? level
  return { level, levels }
}

// What L1 does with a cluster: 0 nothing; 1 whitespace-like (WS, isolate and embedding controls,
// BN), reset when it precedes a segment separator or ends the line; 2 a segment separator (tab),
// always reset. Decided by the cluster's first scalar.
export function l1Kind(cluster: string): 0 | 1 | 2 {
  const t = classOf(String.fromCodePoint(cluster.codePointAt(0) ?? 32))
  if (t === 'S') return 2
  if (t === 'WS' || t === 'B' || t === 'BN' || t === 'LRI' || t === 'RLI' || t === 'FSI' || t === 'PDI' || t === 'LRE' || t === 'RLE' || t === 'LRO' || t === 'RLO' || t === 'PDF') return 1
  return 0
}

// The visual order of a line's clusters. `levels[i]` is cluster i's resolved level (that of its
// first scalar), `kinds[i]` its L1 kind. L1 resets segment separators, and whitespace before them
// or at the line's end, to the paragraph level; L2 reverses every maximal run at or above each
// level from the highest down to the lowest odd one. Returns cluster indices, left to right, and
// each cluster's final level.
export function reorderLine(levels: number[], kinds: number[], paragraphLevel: number): { order: number[]; final: number[] } {
  const final = levels.slice()
  let resetting = true // at the line's end
  for (let i = final.length - 1; i >= 0; i--) {
    if (kinds[i] === 2) {
      final[i] = paragraphLevel
      resetting = true
    } else if (kinds[i] === 1 && resetting) {
      final[i] = paragraphLevel
    } else {
      resetting = false
    }
  }
  const order = final.map((_, i) => i)
  let max = 0
  let minOdd = Infinity
  for (const l of final) {
    if (l > max) max = l
    if (l & 1 && l < minOdd) minOdd = l
  }
  for (let level = max; level >= minOdd; level--) {
    for (let i = 0; i < order.length; i++) {
      if (final[order[i]] < level) continue
      let j = i
      while (j + 1 < order.length && final[order[j + 1]] >= level) j++
      for (let a = i, b = j; a < b; a++, b--) {
        const t = order[a]
        order[a] = order[b]
        order[b] = t
      }
      i = j
    }
  }
  return { order, final }
}

// A cluster's class for span isolation (isolate.ts), over every scalar it holds, since a cluster
// can start with a Prepend scalar (U+0600 ARABIC NUMBER SIGN + a letter): R when it holds a strong
// RTL scalar (R, AL), A when it holds an Arabic number (AN), D a European number (EN), O otherwise.
// A cluster that mixes R with AN is classed R; a browser may still reorder inside it. This is rare
// enough to accept: it needs U+0600-0605 (a number sign) followed by a letter in one cluster.
export function charClass(cluster: string): 'R' | 'A' | 'D' | 'O' {
  let k: 'R' | 'A' | 'D' | 'O' = 'O'
  for (const ch of cluster) {
    const t = classOf(ch)
    if (t === 'R' || t === 'AL') return 'R'
    if (t === 'AN') k = 'A'
    else if (t === 'EN' && k === 'O') k = 'D'
  }
  return k
}

// L4 on a cluster: its base scalar mirrored (a bracket carrying a combining mark keeps the mark),
// or null when the base has no mirror.
export function mirror(cluster: string): string | null {
  const cp = cluster.codePointAt(0)
  if (cp === undefined) return null
  const base = String.fromCodePoint(cp)
  const m = bidi.getMirroredCharacter(base) as string | null
  return m ? m + cluster.slice(base.length) : null
}

// Whether text holds any strong RTL scalar (R or AL), the test for drawing a block ourselves.
export function hasRtl(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp < 0x0590) continue
    const t = classOf(ch)
    if (t === 'R' || t === 'AL') return true
  }
  return false
}

// Claude Code reorders RTL text itself when it takes the terminal for one that cannot: `WT_SESSION`
// set, or `TERM_PROGRAM=vscode` (2.1.289's `isNeeded()`). Measured on 2.1.289: each Text it draws is
// reordered on its own, in place (a Text's nested Texts with it, sibling Texts apart), by UAX #9
// with a first-strong base and no mirroring. This is that reorder, on grapheme clusters.
export function engineReorder(text: string): string {
  const clusters = graphemes(text)
  const { level, levels } = resolveParagraph(text, null, 'first-strong', 0.3, true)
  const lv: number[] = []
  const kinds: number[] = []
  let at = 0
  for (const c of clusters) {
    lv.push(levels[at] ?? level)
    kinds.push(l1Kind(c))
    at += c.length
  }
  return reorderLine(lv, kinds, level).order.map(i => clusters[i]).join('')
}

// Whether the engine's reorder can move anything in `text`: it holds a strong RTL scalar or an
// Arabic number (which an LTR run reverses too).
function reorderable(text: string): boolean {
  for (const ch of text) {
    if (ch.codePointAt(0)! < 0x0590) continue
    const t = classOf(ch)
    if (t === 'R' || t === 'AL' || t === 'AN') return true
  }
  return false
}

// A text in visual order, cut into the Texts to draw so that the engine's reorder above gives it
// back: runs of one direction, each holding what that reorder turns into the run. A run of one
// direction is its own inverse under the reorder (RTL letters reversed, numbers kept), which is
// checked; a run that is not is drawn a cluster per Text, which nothing reorders.
export function engineSegments(text: string): string[] {
  if (!reorderable(text)) return [text]
  const runs: string[] = []
  let run = ''
  let side: 'L' | 'R' | null = null
  for (const ch of text) {
    const t = ch.codePointAt(0)! < 0x80 ? (/[A-Za-z]/.test(ch) ? 'L' : 'N') : classOf(ch)
    const now = t === 'L' ? 'L' : t === 'R' || t === 'AL' || t === 'AN' ? 'R' : null
    if (now !== null && side !== null && now !== side) {
      runs.push(run)
      run = ''
    }
    if (now !== null) side = now
    run += ch
  }
  if (run) runs.push(run)
  const out: string[] = []
  for (const r of runs) {
    if (!reorderable(r)) {
      out.push(r)
      continue
    }
    const drawn = engineReorder(r)
    if (engineReorder(drawn) === r) out.push(drawn)
    else out.push(...graphemes(r))
  }
  return out
}
