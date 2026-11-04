// A Markdown reader for assistant text blocks: a block pass (paragraphs, headings, lists, quotes,
// fences, rules, tables) and an inline pass (CommonMark delimiter runs for emphasis, code spans,
// links with balanced destinations). It covers what the mod draws itself and mirrors Claude
// Code's own renderer (marked + its token printer, read from 2.1.288) where the output is
// visible: `-` for every bullet, `1.`/`a.`/`i.` by depth, `▎` quotes in italics, links as
// `text (url)` where the terminal has no hyperlinks, `---` for a rule.

import type { Run } from './layout.ts'

export const BOLD = 1
export const ITALIC = 2
export const CODE = 4
export const LINK = 8
export const STRIKE = 16
export const UNDERLINE = 32
export const DIM = 64

export type Block =
  | { kind: 'para'; text: string; heading: number; source: string }
  | { kind: 'list'; ordered: boolean; start: number; items: Item[]; source: string }
  | { kind: 'quote'; blocks: Block[]; source: string }
  | { kind: 'code'; language: string; text: string; source: string }
  | { kind: 'rule'; source: string }
  | { kind: 'table'; source: string }
  | { kind: 'mermaid'; source: string }
  | { kind: 'space' }

// `gap`: blank lines separated this item from the one before it (a loose list).
export type Item = { marker: string; blocks: Block[]; gap: boolean }

const FENCE = /^( {0,3})(`{3,}|~{3,})\s*(.*)$/
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/
const QUOTE = /^ {0,3}> ?(.*)$/
const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/
const TABLE_SEP = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/
const BLANK = /^[ \t]*$/

const expandTabs = (line: string) => line.replace(/^[ \t]+/, ws => ws.replace(/\t/g, '    '))
const indentOf = (line: string) => expandTabs(line).match(/^ */)![0].length

// Lines that end a paragraph (CommonMark "can interrupt a paragraph"); an ordered item only when
// it starts at 1, a bullet only when it has content.
function interrupts(line: string): boolean {
  if (FENCE.test(line) || ATX.test(line) || RULE.test(line) || QUOTE.test(line)) return true
  const m = line.match(ITEM)
  if (!m || m[4].trim() === '') return false
  return !/\d/.test(m[2]) || /^1[.)]$/.test(m[2])
}

export function parseBlocks(markdown: string): Block[] {
  return blocksOf(markdown.replace(/\r\n?/g, '\n').split('\n'))
}

function blocksOf(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0
  const pushSpace = () => {
    if (blocks.length && blocks[blocks.length - 1].kind !== 'space') blocks.push({ kind: 'space' })
  }
  while (i < lines.length) {
    const line = lines[i]
    if (BLANK.test(line)) {
      pushSpace()
      i++
      continue
    }
    const fence = line.match(FENCE)
    if (fence && !(fence[2][0] === '`' && fence[3].includes('`'))) {
      const indent = fence[1].length
      const mark = fence[2]
      const body: string[] = []
      let j = i + 1
      for (; j < lines.length; j++) {
        const close = lines[j].match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/)
        if (close && close[1][0] === mark[0] && close[1].length >= mark.length) break
        body.push(lines[j].replace(new RegExp(`^ {0,${indent}}`), ''))
      }
      const language = (fence[3].trim().split(/\s+/)[0] ?? '').toLowerCase()
      const source = lines.slice(i, Math.min(j + 1, lines.length)).join('\n')
      blocks.push(language === 'mermaid' ? { kind: 'mermaid', source } : { kind: 'code', language, text: body.join('\n'), source })
      i = j + 1
      continue
    }
    if (indentOf(line) >= 4) {
      const body: string[] = []
      let j = i
      for (; j < lines.length && (indentOf(lines[j]) >= 4 || BLANK.test(lines[j])); j++) body.push(expandTabs(lines[j]).slice(4))
      while (body.length && BLANK.test(body[body.length - 1])) {
        body.pop()
        j--
      }
      blocks.push({ kind: 'code', language: '', text: body.join('\n'), source: lines.slice(i, j).join('\n') })
      i = j
      continue
    }
    const atx = line.match(ATX)
    if (atx) {
      blocks.push({ kind: 'para', text: atx[2].replace(/[ \t]+#+[ \t]*$|^#+[ \t]*$/, '').trim(), heading: atx[1].length, source: line })
      i++
      continue
    }
    if (RULE.test(line)) {
      blocks.push({ kind: 'rule', source: line })
      i++
      continue
    }
    if (QUOTE.test(line)) {
      const inner: string[] = []
      let j = i
      for (; j < lines.length; j++) {
        const q = lines[j].match(QUOTE)
        if (q) inner.push(q[1])
        else if (!BLANK.test(lines[j]) && !interrupts(lines[j]) && inner.length && !BLANK.test(inner[inner.length - 1])) inner.push(lines[j]) // lazy continuation
        else break
      }
      blocks.push({ kind: 'quote', blocks: blocksOf(inner), source: lines.slice(i, j).join('\n') })
      i = j
      continue
    }
    const item = line.match(ITEM)
    if (item) {
      const ordered = /\d/.test(item[2])
      const start = ordered ? parseInt(item[2], 10) : 1
      const items: Item[] = []
      let j = i
      let gap = false
      while (j < lines.length) {
        const m = lines[j].match(ITEM)
        if (!m || /\d/.test(m[2]) !== ordered || (!ordered && m[2] !== item[2]) || (ordered && m[2].slice(-1) !== item[2].slice(-1))) break
        const pad = m[3].replace(/\t/g, '    ').length
        const contentIndent = m[1].length + m[2].length + (m[4] === '' ? 1 : pad > 4 ? 1 : pad)
        const body = [m[4] === '' ? '' : (pad > 4 ? ' '.repeat(pad - 1) : '') + m[4]]
        let k = j + 1
        for (; k < lines.length; k++) {
          const l = lines[k]
          if (BLANK.test(l)) {
            // a blank line stays inside the item only when indented content follows it
            let n = k
            while (n < lines.length && BLANK.test(lines[n])) n++
            if (n < lines.length && indentOf(lines[n]) >= contentIndent) {
              for (; k < n; k++) body.push('')
              k--
              continue
            }
            break
          }
          if (indentOf(l) >= contentIndent) body.push(expandTabs(l).slice(contentIndent))
          else if (!interrupts(l) && !ITEM.test(l) && !BLANK.test(body[body.length - 1])) body.push(l.trimStart()) // lazy continuation
          else break
        }
        items.push({ marker: m[2], blocks: blocksOf(body), gap })
        gap = false
        j = k
        // a blank line between items of the same list
        let n = j
        while (n < lines.length && BLANK.test(lines[n])) n++
        const next = n < lines.length ? lines[n].match(ITEM) : null
        if (n > j && next && /\d/.test(next[2]) === ordered && (ordered ? next[2].slice(-1) === item[2].slice(-1) : next[2] === item[2])) {
          j = n
          gap = true
        }
      }
      blocks.push({ kind: 'list', ordered, start, items, source: lines.slice(i, j).join('\n') })
      i = j
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      let j = i + 2
      for (; j < lines.length && lines[j].includes('|') && !BLANK.test(lines[j]); j++);
      blocks.push({ kind: 'table', source: lines.slice(i, j).join('\n') })
      i = j
      continue
    }
    // A paragraph: its lines until a blank line or a block that can interrupt it. A setext
    // underline turns it into a heading.
    const para: string[] = [line]
    let j = i + 1
    let heading = 0
    for (; j < lines.length; j++) {
      const l = lines[j]
      const setext = l.match(SETEXT)
      if (setext) {
        heading = setext[1][0] === '=' ? 1 : 2
        j++
        break
      }
      if (BLANK.test(l) || interrupts(l)) break
      if (l.includes('|') && j + 1 < lines.length && TABLE_SEP.test(lines[j + 1]) && lines[j + 1].includes('-')) break
      para.push(l)
    }
    blocks.push({ kind: 'para', text: joinLines(para), heading, source: lines.slice(i, j).join('\n') })
    i = j
  }
  while (blocks.length && blocks[blocks.length - 1].kind === 'space') blocks.pop()
  while (blocks.length && blocks[0].kind === 'space') blocks.shift()
  return blocks
}

// Paragraph lines: leading indentation dropped, hard-break markers (two trailing spaces, a
// trailing backslash) removed. Claude Code draws soft and hard breaks alike, as line breaks.
function joinLines(lines: string[]): string {
  return lines
    .map((l, i) => {
      let t = l.replace(/^[ \t]+/, '')
      if (i < lines.length - 1 && /(?<!\\)\\$/.test(t)) t = t.slice(0, -1)
      return t.replace(/[ \t]+$/, '')
    })
    .join('\n')
}

// ---------------------------------------------------------------------------------------------
// Inline: CommonMark's delimiter-run algorithm for `*`, `_` (and GFM `~`), on a node list built
// around atomic code spans, links and escapes. Unclosed markers stay literal (a reply that is
// still streaming shows them as typed, as Claude Code itself does).

type Node = { text: string; style: number; isolate?: boolean }
type Delim = { node: number; ch: string; count: number; orig: number; canOpen: boolean; canClose: boolean; active: boolean }

const PUNCT = /[\p{P}\p{S}]/u
const SPACE_CH = /\s/u
const ESCAPABLE = /[!-/:-@[-`{-~]/

export function parseInline(s: string, base = 0): Run[] {
  const nodes: Node[] = []
  const delims: Delim[] = []
  let buf = ''
  const flush = () => {
    if (buf) nodes.push({ text: buf, style: base })
    buf = ''
  }
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length && ESCAPABLE.test(s[i + 1])) {
      buf += s[i + 1]
      i += 2
      continue
    }
    if (c === '`') {
      let n = 0
      while (s[i + n] === '`') n++
      const close = findBackticks(s, n, i + n)
      if (close >= 0) {
        flush()
        let code = s.slice(i + n, close).replace(/\n/g, ' ')
        if (code.length > 2 && code[0] === ' ' && code[code.length - 1] === ' ' && code.trim() !== '') code = code.slice(1, -1)
        nodes.push({ text: code, style: base | CODE, isolate: true })
        i = close + n
        continue
      }
      buf += s.slice(i, i + n)
      i += n
      continue
    }
    if (c === '<') {
      const m = s.slice(i).match(/^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*|[^\s<>@]+@[^\s<>@]+)>/)
      if (m) {
        flush()
        nodes.push({ text: m[1].replace(/^mailto:/i, ''), style: base | LINK, isolate: true })
        i += m[0].length
        continue
      }
    }
    if (c === '[' || (c === '!' && s[i + 1] === '[')) {
      const link = parseLink(s, c === '!' ? i + 1 : i)
      if (link) {
        flush()
        const image = c === '!'
        const label = parseInline(link.text, base | LINK)
        const shown = label.map(r => r.text).join('')
        if (image) {
          if (!shown && !link.title) nodes.push({ text: link.href, style: base, isolate: true })
          else {
            for (const r of label) nodes.push({ ...r, style: r.style & ~LINK })
            nodes.push({ text: (shown ? ' ' : '') + '(', style: base })
            nodes.push({ text: link.href + (link.title ? ` "${link.title}"` : ''), style: base, isolate: true })
            nodes.push({ text: ')', style: base })
          }
        } else {
          for (const r of label) nodes.push(r)
          if (shown !== link.href) {
            nodes.push({ text: ' (', style: base })
            nodes.push({ text: link.href.replace(/^mailto:/i, ''), style: base, isolate: true })
            nodes.push({ text: ')', style: base })
          }
          if (link.title) nodes.push({ text: ` ("${link.title}")`, style: base })
        }
        i = link.end
        continue
      }
    }
    if (c === '*' || c === '_' || c === '~') {
      let n = 0
      while (s[i + n] === c) n++
      if (c === '~' && n > 2) {
        buf += s.slice(i, i + n)
        i += n
        continue
      }
      const before = i > 0 ? s[i - 1] : ' '
      const after = i + n < s.length ? s[i + n] : ' '
      const left = !SPACE_CH.test(after) && (!PUNCT.test(after) || SPACE_CH.test(before) || PUNCT.test(before))
      const right = !SPACE_CH.test(before) && (!PUNCT.test(before) || SPACE_CH.test(after) || PUNCT.test(after))
      let canOpen = left
      let canClose = right
      if (c === '_') {
        canOpen = left && (!right || PUNCT.test(before))
        canClose = right && (!left || PUNCT.test(after))
      }
      flush()
      nodes.push({ text: c.repeat(n), style: base })
      delims.push({ node: nodes.length - 1, ch: c, count: n, orig: n, canOpen, canClose, active: true })
      i += n
      continue
    }
    buf += c
    i++
  }
  flush()
  processEmphasis(nodes, delims)
  const out: Run[] = []
  for (const n of nodes) {
    if (!n.text) continue
    const prev = out[out.length - 1]
    if (prev && prev.style === n.style && !prev.isolate && !n.isolate) prev.text += n.text
    else out.push(n.isolate ? { text: n.text, style: n.style, isolate: true } : { text: n.text, style: n.style })
  }
  return out
}

function processEmphasis(nodes: Node[], delims: Delim[]) {
  const bottom = new Map<string, number>()
  for (let c = 0; c < delims.length; c++) {
    const closer = delims[c]
    if (!closer.active || !closer.canClose) continue
    const key = `${closer.ch}${closer.canOpen ? 1 : 0}${closer.orig % 3}`
    let matched = false
    for (let o = c - 1; o > (bottom.get(key) ?? -1); o--) {
      const opener = delims[o]
      if (!opener.active || opener.ch !== closer.ch || !opener.canOpen || opener.count === 0) continue
      if (closer.ch === '~') {
        if (opener.count !== closer.count) continue
      } else if ((opener.canClose || closer.canOpen) && (opener.orig + closer.orig) % 3 === 0 && !(opener.orig % 3 === 0 && closer.orig % 3 === 0)) {
        continue
      }
      const use = closer.ch === '~' ? closer.count : opener.count >= 2 && closer.count >= 2 ? 2 : 1
      const style = closer.ch === '~' ? STRIKE : use === 2 ? BOLD : ITALIC
      for (let k = opener.node + 1; k < closer.node; k++) nodes[k].style |= style
      for (let d = o + 1; d < c; d++) delims[d].active = false
      opener.count -= use
      closer.count -= use
      nodes[opener.node].text = opener.ch.repeat(opener.count)
      nodes[closer.node].text = closer.ch.repeat(closer.count)
      if (opener.count === 0) opener.active = false
      matched = true
      break
    }
    if (matched) {
      if (closer.count > 0) c-- // the same closer may close another opener
      else closer.active = false
      continue
    }
    bottom.set(key, c - 1)
    if (!closer.canOpen) closer.active = false
  }
}

function findBackticks(s: string, n: number, from: number): number {
  for (let j = from; j < s.length; j++) {
    if (s[j] !== '`') continue
    let k = 0
    while (s[j + k] === '`') k++
    if (k === n) return j
    j += k - 1
  }
  return -1
}

// `[text](destination "title")` starting at `[`: the text may nest brackets and hold code
// spans; the destination is `<...>` or a run without spaces whose parentheses balance.
function parseLink(s: string, at: number): { text: string; href: string; title: string; end: number } | null {
  let depth = 0
  let j = at
  for (; j < s.length; j++) {
    const ch = s[j]
    if (ch === '\\') {
      j++
      continue
    }
    if (ch === '`') {
      let n = 0
      while (s[j + n] === '`') n++
      const close = findBackticks(s, n, j + n)
      j = close >= 0 ? close + n - 1 : j + n - 1
      continue
    }
    if (ch === '[') depth++
    else if (ch === ']' && --depth === 0) break
  }
  if (j >= s.length || s[j + 1] !== '(') return null
  const text = s.slice(at + 1, j)
  let k = j + 2
  while (s[k] === ' ' || s[k] === '\t' || s[k] === '\n') k++
  let href = ''
  if (s[k] === '<') {
    const close = s.indexOf('>', k)
    if (close < 0 || s.slice(k, close).includes('\n')) return null
    href = s.slice(k + 1, close)
    k = close + 1
  } else {
    let parens = 0
    const startHref = k
    for (; k < s.length; k++) {
      const ch = s[k]
      if (ch === '\\' && k + 1 < s.length) {
        k++
        continue
      }
      if (/\s/.test(ch)) break
      if (ch === '(') parens++
      else if (ch === ')') {
        if (parens === 0) break
        parens--
      }
    }
    if (parens !== 0) return null
    href = s.slice(startHref, k).replace(/\\([!-/:-@[-`{-~])/g, '$1')
  }
  let title = ''
  const ws = k
  while (s[k] === ' ' || s[k] === '\t' || s[k] === '\n') k++
  if (k > ws && (s[k] === '"' || s[k] === "'" || s[k] === '(')) {
    const closeCh = s[k] === '(' ? ')' : s[k]
    const close = s.indexOf(closeCh, k + 1)
    if (close < 0) return null
    title = s.slice(k + 1, close)
    k = close + 1
    while (s[k] === ' ' || s[k] === '\t' || s[k] === '\n') k++
  }
  if (s[k] !== ')') return null
  return { text, href, title, end: k + 1 }
}

// List markers as Claude Code prints them: `-` for every bullet; ordered numbers by depth
// (1. at the top, a. one level down, i. below that).
// A GFM table's cells: the header, each column's alignment (from the delimiter row) and the body
// rows, padded or cut to the delimiter row's column count. `\\|` is a literal pipe. Null when the
// header's count differs from the delimiter row's (then it is no table, as for marked).
export type Align = 'left' | 'center' | 'right' | null
export type Table = { header: string[]; align: Align[]; rows: string[][] }

export function parseTable(source: string): Table | null {
  const lines = source.split('\n')
  if (lines.length < 2) return null
  const align = splitRow(lines[1]).map((c): Align => {
    const l = c.startsWith(':')
    const r = c.endsWith(':')
    return l && r ? 'center' : r ? 'right' : l ? 'left' : null
  })
  const header = splitRow(lines[0])
  if (header.length !== align.length) return null
  const fit = (cells: string[]) => align.map((_, i) => cells[i] ?? '')
  return { header, align, rows: lines.slice(2).map(l => fit(splitRow(l))) }
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
    } else if (s[i] === '|') {
      cells.push(cur.trim())
      cur = ''
    } else cur += s[i]
  }
  cells.push(cur.trim())
  return cells
}

export function markerText(ordered: boolean, number: number, depth: number): string {
  if (!ordered) return '-'
  if (depth === 1) return `${alpha(number)}.`
  if (depth === 2 && number <= 3999) return `${roman(number)}.`
  return `${number}.`
}

function alpha(n: number): string {
  let t = ''
  while (n > 0) {
    n--
    t = String.fromCharCode(97 + (n % 26)) + t
    n = Math.floor(n / 26)
  }
  return t
}

const ROMAN: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]

function roman(n: number): string {
  let t = ''
  for (const [v, r] of ROMAN) while (n >= v) (t += r), (n -= v)
  return t
}
