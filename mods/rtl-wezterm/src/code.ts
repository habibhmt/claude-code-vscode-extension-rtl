// Fenced code that holds RTL text. Claude Code's `Code` element writes each line in logical order,
// which a terminal without bidi shows letter-reversed, and a browser terminal draws every
// highlighted token as a span of its own and reverses each one again. So a line with RTL text is
// drawn here instead: an LTR line, left-aligned, as a bidi-aware editor shows code.
//
// The line is cut into tokens (comments, strings, plain code) by a small scanner per language
// family. A comment's text, a string's content, and a run of RTL words in plain code are each laid
// out as a paragraph of their own (UAX #9 with the reply's direction setting), like text between
// FSI and PDI; everything else keeps its place. Without that isolation the algorithm would mix the
// two sides of a quote or a comma: `x = "שלום"  # הערה` would read `x = "הרעה #  "םולש`.
//
// The scanner is conservative: what it cannot place as a string or comment stays code, in place.
// A quote with no closing quote on its line is a plain character (a Rust lifetime, a Hebrew
// gershayim in HTML text); a Rust or C `'` opens a character literal only; a JavaScript `/` that
// starts a regular expression takes it whole; HTML quotes count inside a tag only. Inside a string,
// an escape (`\"`) and an interpolation (`${…}`, an f-string's `{…}`) are atoms: drawn as code, in
// their own order (an interpolation's RTL pieces laid out like any code), and kept whole as LTR
// pieces of the string's paragraph.
//
// Lines without RTL text stay with the engine's `Code`, so English-only fences and the English
// lines of a fence look exactly as usual. A line inside a multi-line comment or string that follows
// a line drawn here is drawn here too: a `Code` leaf starting there would not know it is inside one.
// The mod has no highlighter: its lines color comments and strings only, in the colors Claude
// Code's highlighter gives them, and draw other tokens in the theme's text color.

import { resolveParagraph, hasRtl, type Base } from './bidi.ts'
import { breakLines, cleanText, clustersOf, layoutParagraph, type Arabic, type Run, type Span } from './layout.ts'
import { clusterWidth, graphemes } from './width.ts'

// Style flags of a code token, next to markdown.ts's (BOLD = 1 ... DIM = 64) and render.ts's
// BULLET = 128.
export const COMMENT = 256
export const STRING = 512

// Tabs as Claude Code's `Code` element draws them (2.1.289, measured in a mod's tree): each tab of
// a line's leading indentation as 2 spaces, any later tab to the next multiple of 8 from the start
// of the line. The mod's code lines follow it, so a fence keeps one indentation.
export const CODE_TAB = 8
const leadingTabs = (line: string) => line.replace(/^[ \t]+/, m => m.replace(/\t/g, '  '))

// `iso`: laid out as a paragraph of its own when it holds RTL text.
type Tok = { text: string; style: number; iso: boolean }

// An interpolation inside a string: its opening and closing delimiters.
type Interp = { open: string; close: string }

// Inside a block comment or a multi-line string, until `close`.
type State = { close: string; style: number; interps: Interp[] } | null

type Lang = {
  // one paragraph per line: text formats and output
  prose: boolean
  line: string[]
  block: [string, string][]
  quotes: string
  multi: string[]
  // data formats (YAML, TOML, HTML text): a run of RTL words carries on across punctuation, quote
  // marks inside words (`צה"ל`) and numbers, as in a sentence; in program code only across spaces,
  // so that `f(שם, גיל)` keeps its arguments in order.
  wide: boolean
  // `'` opens a character literal only (`'a'`, `'\n'`): Rust lifetimes and C-family code
  chars: boolean
  // where `#` starts a comment outside a string: `any` place; at a `word` start only (after a space:
  // YAML scalars); at a word start or after a `shell` separator (`;#`, `)#`, but `$#`, `a#b`, `a{#`);
  // after those or a brace (`ps`: PowerShell braces are tokens); anywhere but after `$` (`perl`:
  // `$#items` is an index); where a command starts only (`tcl`: line start or after `;`, so
  // `set c #fff` is an argument); `make`: anywhere, but by the shell rule on a recipe line
  hash: 'any' | 'word' | 'shell' | 'ps' | 'perl' | 'tcl' | 'make'
  // which lines with RTL letters this scanner can place, given the whole fence (`Sure`); the others
  // leave the fence to the engine
  sure: Sure | null
  // JavaScript regular expression literals
  regex: boolean
  // markup: quotes are strings inside a tag only
  tags: boolean
  // the interpolations of a string opened by `quote`, given the letters just before it (`f`, `$`)
  interp: (quote: string, prefix: string) => Interp[]
}

const none = () => []
const lang = (o: Partial<Lang>): Lang => ({ prose: false, line: [], block: [], quotes: `"'\``, multi: [], wide: false, chars: false, hash: 'word', sure: null, regex: false, tags: false, interp: none, ...o })

// Perl, Tcl and Make: where `#` starts a comment depends on the language's own parse (Perl's
// regexes, quote-like operators, interpolations, heredocs and POD; Tcl's braces, quotes and
// escapes; Make's expansions, recipes and continued lines), which this scanner does not follow. In
// a fence where none of those constructs appears, every `#` is placed for sure and the fence is
// drawn as any other; where one does, a line with RTL letters leaves the whole fence to the engine,
// a line that starts with `#` too (it may sit inside a literal, or close one and go on as code).
type Sure = (lines: string[]) => (line: string) => boolean
const WHOLE_COMMENT = /^\s*#/
// a closed string; only a double-quoted one interpolates (`"${name}"`, `"@list"`)
const PERL_STRING = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g
// a quote-like operator, before any `#` is taken as a comment: `q#...#` uses `#` as its delimiter
const PERL_OP = /(?<![\w$@%&])(?:qr|qq|qw|q|m|s|tr|y)\s*[^\w\s]/
// in the code before the comment: a regex or a division, a backtick, a heredoc, a quote that does
// not close on its line, POD, the data section
const PERL_RISK = /[/`"']|<<|^=[A-Za-z]|^__(?:END|DATA)__\b/
const perlSure: Sure = lines => {
  const risky = lines.some(line => {
    if (WHOLE_COMMENT.test(line)) return false
    let interpolates = false
    const plain = line.replace(PERL_STRING, q => {
      if (q[0] === '"' && /[$@]/.test(q)) interpolates = true
      return '0'
    })
    return interpolates || PERL_OP.test(plain) || PERL_RISK.test(plain.replace(/(?<!\$)#.*$/, ''))
  })
  return () => !risky
}
// Tcl: braces and quotes group words over lines and hide `;`, and a backslash escapes it
const tclSure: Sure = lines => {
  // a comment that ends in a backslash goes on into the next line, in Tcl as in Make
  const risky = lines.some(line => (WHOLE_COMMENT.test(line) ? /\\$/.test(line) : /[\\"{}[\]]/.test(line)))
  return () => !risky
}
// The shell's quotes on a recipe line, read in order: outside single quotes (inside double quotes
// too) a backslash escapes (`\;#` is no comment) and a backtick runs a command; a quote character
// inside the other kind of quote is a letter; a quote left open is a string over lines.
function shellQuotesSure(line: string): boolean {
  let quote = ''
  for (const ch of line) {
    if (quote === "'") {
      if (ch === "'") quote = ''
    } else if (ch === '`' || ch === '\\') return false
    else if (quote === '"') {
      if (ch === '"') quote = ''
    } else if (ch === '"' || ch === "'") quote = ch
  }
  return quote === ''
}
// Make: no quotes of its own, and `#` is a comment anywhere but after a backslash or inside an
// expansion (`$(subst #,x,...)`), which a recipe line (a tab first) holds as well before the shell
// reads it by the shell rule. Not sure: an expansion, a backslash, an inline recipe's `;`, a quote
// outside a recipe, a recipe quote that stays open (a string over lines), a line indented with
// spaces (a recipe whose tab Markdown expanded), a custom recipe prefix, `.ONESHELL`, a `define`, a
// continued line.
const makeSure: Sure = lines => {
  const risky = lines.some(line => {
    if (/\.RECIPEPREFIX|\.ONESHELL|^\s*define\b|\\$|^ /.test(line)) return true
    if (WHOLE_COMMENT.test(line)) return false
    if (line.startsWith('\t')) {
      // Make expands `$(...)` inside the shell's quotes too: looked for before the quotes are read
      if (/\$[({]/.test(line)) return true
      return !shellQuotesSure(line)
    }
    return /[\\;"'`]|\$[({]/.test(line.replace(/#.*$/, ''))
  })
  return () => !risky
}

const DOLLAR: Interp = { open: '${', close: '}' }
const FAMILIES: [string, Lang][] = [
  ['text txt plain plaintext md markdown output log csv tsv', lang({ prose: true })],
  ['python py', lang({ line: ['#'], hash: 'any', multi: ['"""', "'''"], interp: (_q, p) => (/[fF]/.test(p) ? [{ open: '{', close: '}' }] : []) })],
  ['sh bash zsh shell fish console shell-session', lang({ line: ['#'], hash: 'shell', interp: q => (q === '"' ? [DOLLAR, { open: '$(', close: ')' }] : []) })],
  ['ruby rb elixir ex exs coffee crystal', lang({ line: ['#'], hash: 'any', interp: q => (q === '"' ? [{ open: '#{', close: '}' }] : []) })],
  ['r nim julia jl nix graphql gql awk cmake', lang({ line: ['#'], hash: 'any' })],
  ['make makefile mk', lang({ line: ['#'], hash: 'make', sure: makeSure })],
  ['powershell ps1', lang({ line: ['#'], hash: 'ps' })],
  ['tcl', lang({ line: ['#'], hash: 'tcl', sure: tclSure })],
  ['perl pl', lang({ line: ['#'], hash: 'perl', sure: perlSure })],
  ['dockerfile', lang({ line: ['#'] })],
  ['yaml yml env dotenv', lang({ line: ['#'], multi: ['"""', "'''"], wide: true })],
  ['toml', lang({ line: ['#'], hash: 'any', multi: ['"""', "'''"], wide: true })],
  ['ini conf properties', lang({ line: ['#', ';'], wide: true })],
  ['c cpp c++ cc h hpp java go rust rs zig sol solidity objc objective-c m mm proto protobuf glsl hlsl wgsl verilog sv', lang({ line: ['//'], block: [['/*', '*/']], chars: true })],
  ['cs csharp', lang({ line: ['//'], block: [['/*', '*/']], chars: true, interp: (q, p) => (q === '"' && p.includes('$') ? [{ open: '{', close: '}' }] : []) })],
  ['kotlin kt kts scala', lang({ line: ['//'], block: [['/*', '*/']], multi: ['"""'], chars: true, interp: q => (q !== "'" ? [DOLLAR] : []) })],
  ['swift', lang({ line: ['//'], block: [['/*', '*/']], multi: ['"""'], quotes: '"', interp: () => [{ open: '\\(', close: ')' }] })],
  ['dart groovy', lang({ line: ['//'], block: [['/*', '*/']], multi: ['"""', "'''"], interp: () => [DOLLAR] })],
  ['json json5 jsonc scss less', lang({ line: ['//'], block: [['/*', '*/']] })],
  ['js javascript jsx mjs cjs ts typescript tsx mts cts', lang({ line: ['//'], block: [['/*', '*/']], multi: ['`'], regex: true, interp: q => (q === '`' ? [DOLLAR] : []) })],
  ['php', lang({ line: ['//', '#'], hash: 'any', block: [['/*', '*/']], interp: q => (q === '"' ? [{ open: '{$', close: '}' }, DOLLAR] : []) })],
  ['hcl tf terraform', lang({ line: ['//', '#'], hash: 'any', block: [['/*', '*/']], interp: q => (q === '"' ? [DOLLAR] : []) })],
  ['css', lang({ block: [['/*', '*/']] })],
  ['sql mysql postgres postgresql psql plsql sqlite tsql', lang({ line: ['--'], block: [['/*', '*/']], quotes: `"'` })],
  ['lua', lang({ line: ['--'], block: [['--[[', ']]']] })],
  ['haskell hs elm ada vhdl applescript', lang({ line: ['--'], quotes: '"' })],
  ['html htm xml svg xhtml vue svelte xaml plist', lang({ block: [['<!--', '-->']], quotes: `"'`, wide: true, tags: true })],
  ['lisp clojure clj cljs scheme scm racket elisp emacs-lisp asm nasm', lang({ line: [';'], quotes: '"' })],
  ['tex latex matlab octave erlang erl prolog', lang({ line: ['%'], quotes: '"' })],
]
const LANGS = new Map<string, Lang>()
for (const [names, l] of FAMILIES) for (const n of names.split(' ')) LANGS.set(n, l)
// An untagged fence is most often text or output; an unknown tag, some program.
const UNKNOWN = lang({ line: ['#', '//'], block: [['/*', '*/']] })
const langOf = (name: string): Lang => LANGS.get(name) ?? (name ? UNKNOWN : LANGS.get('text')!)

// The first `close` at or after `from` outside a backslash escape, or -1.
function findClose(line: string, from: number, close: string): number {
  for (let k = from; k < line.length; k++) {
    if (line[k] === '\\') k++
    else if (line.startsWith(close, k)) return k
  }
  return -1
}

// Atoms stand in the text as private-use characters of plane 16, one per grapheme of the atom, with
// that grapheme's width: the line is measured and wrapped with them (a wide grapheme stays whole), an
// isolate's layout keeps them in order as an LTR isolate, and they are replaced by the atom's spans
// at the end. A line that holds such characters itself gets no atoms, and its own characters pass
// through untouched. A line with more atoms than placeholders is not drawn (`full`).
const ATOM_BASE = 0x100000
const ATOM_MAX = 0xfffd
// a placeholder with the marks that combine with it in the source (they stay in its grapheme)
const ATOMS = /(?:[\u{100000}-\u{10FFFF}][\p{M}\u200d]*)+/gu
const ATOM = /[\u{100000}-\u{10FFFF}]/gu
type Cell = Span & { width: number }
// `prev`: the significant code of the lines before (strings as `0`), the context a regex needs.
// `unsure`: a construct this scanner cannot follow over lines (an interpolation still open at the
// line's end): the whole fence is left to the engine. `recipe`: a Make recipe line (a tab first).
type Ctx = { cells: Cell[]; ok: boolean; full: boolean; unsure: boolean; recipe: boolean; prev: string; l: Lang; opts: CodeOptions }

function atom(ctx: Ctx, spans: Span[]): string {
  let out = ''
  for (const sp of spans) {
    for (const g of graphemes(sp.text)) {
      if (ctx.cells.length > ATOM_MAX) {
        ctx.full = true
        return out
      }
      out += String.fromCodePoint(ATOM_BASE + ctx.cells.length)
      ctx.cells.push({ text: g, style: sp.style, width: clusterWidth(g) })
    }
  }
  return out
}

// Spans with their atoms put back.
function fill(spans: Span[], ctx: Ctx): Span[] {
  const out: Span[] = []
  const push = (text: string, style: number) => {
    const prev = out[out.length - 1]
    if (prev && prev.style === style) prev.text += text
    else if (text) out.push({ text, style })
  }
  for (const sp of spans) {
    for (const ch of sp.text) {
      const cp = ch.codePointAt(0)!
      const cell = atomCell(cp, ctx)
      if (cell) push(cell.text, cell.style)
      else push(ch, sp.style)
    }
  }
  return out
}

// The atom a character stands for: only on a line that made atoms, so a source character never is one.
const atomCell = (cp: number, ctx: Ctx): Cell | undefined => (ctx.ok && cp >= ATOM_BASE ? ctx.cells[cp - ATOM_BASE] : undefined)
const stripAtoms = (text: string, ctx: Ctx) => (ctx.ok ? text.replace(ATOMS, '') : text)

const ESCAPE = /^\\(?:u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|x[0-9a-fA-F]{2}|N\{[^}]*\}|[0-7]{1,3}|.)/su

// The index of the delimiter that closes an interpolation opened before `from`, skipping nested
// brackets and quoted strings; -1 when it does not close on this line, -2 when its end is uncertain
// (a `/` that may open a comment or a regex holding the delimiter).
function interpEnd(line: string, from: number, ip: Interp, l: Lang): number {
  const opener = ip.open[ip.open.length - 1]
  let depth = 1
  for (let k = from; k < line.length; k++) {
    const c = line[k]
    if (c === '\\') k++
    else if (c === '"' || c === "'" || c === '`') {
      const j = findClose(line, k + 1, c)
      if (j < 0) return -1
      k = j
    } else if (c === '/' && (l.regex || line[k + 1] === '*' || line[k + 1] === '/')) return -2
    else if (c === opener) depth++
    else if (c === ip.close && --depth === 0) return k
  }
  return -1
}

const WORD = /[\p{L}\p{M}\p{N}_‌‍]+/gu
const NUMBER = /^\p{N}+$/u

// Plain code: a run of words that hold RTL text is one isolate; the rest keeps its place.
function plainToks(text: string, wide: boolean): Tok[] {
  const parts: { text: string; word: boolean }[] = []
  let at = 0
  for (const m of text.matchAll(WORD)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), word: false })
    parts.push({ text: m[0], word: true })
    at = m.index + m[0].length
  }
  if (at < text.length) parts.push({ text: text.slice(at), word: false })
  const joins = wide ? /^[\s,.:!?\-–—'"׳״]+$/u : /^\s+$/u
  const rtlWord = (p: { text: string; word: boolean }) => p.word && hasRtl(p.text)
  const out: Tok[] = []
  for (let i = 0; i < parts.length; ) {
    if (!rtlWord(parts[i])) {
      out.push({ text: parts[i].text, style: 0, iso: false })
      i++
      continue
    }
    let end = i
    while (end + 2 < parts.length && joins.test(parts[end + 1].text)) {
      const next = parts[end + 2]
      if (!(rtlWord(next) || (wide && next.word && NUMBER.test(next.text)))) break
      end += 2
    }
    let text = parts.slice(i, end + 1).map(p => p.text).join('')
    // a sentence's closing punctuation goes with it
    const close = wide && end + 1 < parts.length ? parts[end + 1].text.match(/^[.,:;!?…]+/) : null
    if (close) {
      text += close[0]
      parts[end + 1] = { text: parts[end + 1].text.slice(close[0].length), word: false }
    }
    out.push({ text, style: 0, iso: true })
    i = end + 1
    if (close && !parts[i].text) i++
  }
  return out
}

// A comment's text or a string's content: its outer spaces keep their place, the rest is isolated.
function content(text: string, style: number, out: Tok[]): void {
  const m = text.match(/^(\s*)(.*?)(\s*)$/su)!
  if (m[1]) out.push({ text: m[1], style, iso: false })
  if (m[2]) out.push({ text: m[2], style, iso: true })
  if (m[3]) out.push({ text: m[3], style, iso: false })
}

// A string's content from `from` up to `close`, its escapes and interpolations as atoms; `end` is
// the index of the close, or -1 when the line ends first.
function stringBody(line: string, from: number, close: string, interps: Interp[], ctx: Ctx): { text: string; end: number } {
  let text = ''
  let k = from
  while (k < line.length) {
    if (line.startsWith(close, k)) return { text, end: k }
    const ip = interps.find(p => line.startsWith(p.open, k))
    if (ip) {
      // a doubled brace is a literal brace in f-strings and C#
      if (ip.open === '{' && line[k + 1] === '{') {
        text += '{{'
        k += 2
        continue
      }
      const e = interpEnd(line, k + ip.open.length, ip, ctx.l)
      // an interpolation that cannot be kept whole: the line is not drawn; one that goes on past the
      // line: nothing of the fence is
      if (e === -2 || (e >= 0 && !ctx.ok)) ctx.full = true
      if (e === -1) ctx.unsure = true
      if (e >= 0 && ctx.ok) {
        const expr = codeSpans(line.slice(k + ip.open.length, e), ctx)
        text += atom(ctx, [{ text: ip.open, style: 0 }, ...expr, { text: ip.close, style: 0 }])
        k = e + ip.close.length
        continue
      }
    }
    if (line[k] === '\\') {
      const esc = line.slice(k).match(ESCAPE)?.[0] ?? '\\'
      if (!ctx.ok) ctx.full = true
      text += ctx.ok ? atom(ctx, [{ text: esc, style: STRING }]) : esc
      k += esc.length
      continue
    }
    const ch = String.fromCodePoint(line.codePointAt(k)!)
    text += ch
    k += ch.length
  }
  return { text, end: -1 }
}

// An interpolated expression as drawn: scanned and laid out as a code line of its own.
function codeSpans(expr: string, ctx: Ctx): Span[] {
  // an interpolated expression starts a context of its own
  const prev = ctx.prev
  ctx.prev = ''
  const toks = scanLine(expr, null, ctx).toks
  ctx.prev = prev
  return layoutLine(toks, UNBOUNDED, ctx)?.[0] ?? [{ text: expr, style: 0 }]
}

const REGEX_BEFORE = /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\b(?:return|typeof|case|do|else|in|of|void|yield|await|delete|throw|new))\s*$/
// Whether a `/` after `before` opens a regular expression: after an operator or keyword, or after the
// `)` that closes an `if`/`while`/`for`/`with` header (a statement starts there; `f(x) / 2` divides).
// `before` is significant code only (strings, regexes and comments replaced), so its brackets count.
function regexCan(before: string): boolean {
  const t = before.trimEnd()
  // `x++ / 2` divides
  if (/(?:\+\+|--)$/.test(t)) return false
  if (REGEX_BEFORE.test(before)) return true
  if (!t.endsWith(')')) return false
  let depth = 0
  for (let k = t.length - 1; k >= 0; k--) {
    if (t[k] === ')') depth++
    else if (t[k] === '(' && --depth === 0) return /(?:^|[^\w$.])(?:if|while|for|with)\s*$/.test(t.slice(0, k))
  }
  return false
}
// The character before a `#` that starts a comment, per `Lang.hash`.
const SHELL_HASH = /[\s;|&()]/
function hashStarts(line: string, i: number, ctx: Ctx): boolean {
  if (i === 0) return true
  const before = line[i - 1]
  switch (ctx.l.hash) {
    case 'any':
      return true
    case 'word':
      return /\s/.test(before)
    case 'shell':
      return SHELL_HASH.test(before)
    case 'ps':
      return /[\s;|&(){}]/.test(before)
    case 'perl':
      return before !== '$'
    case 'tcl':
      return /(?:^|;)\s*$/.test(line.slice(0, i))
    case 'make':
      return !ctx.recipe || SHELL_HASH.test(before)
  }
}

// Significant code kept for `regexCan`: spaces folded, closed bracket groups emptied (only what stands
// before a `(` matters once it closes). A context this cannot keep short is `LOST`: no regex decision.
const LOST = '\u0000'
function compact(code: string): string {
  if (code.startsWith(LOST)) return LOST
  let s = code.replace(/\s+/g, ' ')
  for (let t = ''; t !== s; ) {
    t = s
    s = s.replace(/\((?!0\))[^()]*\)/g, '(0)')
  }
  return s.length > 20000 ? LOST : s
}
const CHAR = /^'(?:\\(?:u\{[0-9a-fA-F]+\}|x[0-9a-fA-F]{2}|.)|[^'\\\n])'/su

// One line's tokens, and the state the next line starts in.
function scanLine(line: string, state: State, ctx: Ctx): { toks: Tok[]; state: State; sig: string } {
  const l = ctx.l
  const out: Tok[] = []
  if (l.prose) {
    content(line, 0, out)
    return { toks: out, state: null, sig: '' }
  }
  let i = 0
  let plain = ''
  // the line's significant code so far: strings and regexes as `0`, comments as a space
  let sig = ''
  let inTag = false
  const flush = () => {
    if (plain) out.push(...plainToks(plain, l.wide))
    plain = ''
  }
  // The rest of a block comment from `i`, up to its close or the end of the line.
  const comment = (close: string, lineStart: boolean): State => {
    const j = line.indexOf(close, i)
    let text = line.slice(i, j < 0 ? line.length : j)
    // a continued block comment's leading ` * ` is a delimiter, not text
    const star = lineStart ? text.match(/^\s*\*(?!\/)\s*/) : null
    if (star) {
      out.push({ text: star[0], style: COMMENT, iso: false })
      text = text.slice(star[0].length)
    }
    content(text, COMMENT, out)
    sig += ' '
    if (j < 0) {
      i = line.length
      return { close, style: COMMENT, interps: [] }
    }
    out.push({ text: close, style: COMMENT, iso: false })
    i = j + close.length
    return null
  }
  // A string's content from `i`; null when it closes on this line.
  const string = (close: string, interps: Interp[], multi: boolean): State | 'open' => {
    const body = stringBody(line, i, close, interps, ctx)
    if (body.end < 0 && !multi) return 'open'
    content(body.text, STRING, out)
    if (body.end < 0) {
      i = line.length
      return { close, style: STRING, interps }
    }
    out.push({ text: close, style: STRING, iso: false })
    i = body.end + close.length
    return null
  }
  if (state) {
    const next = state.style === COMMENT ? comment(state.close, true) : (string(state.close, state.interps, true) as State)
    if (next) return { toks: out, state: next, sig }
  }
  scan: while (i < line.length) {
    for (const [open, close] of l.block) {
      if (line.startsWith(open, i)) {
        flush()
        out.push({ text: open, style: COMMENT, iso: false })
        i += open.length
        const next = comment(close, false)
        if (next) return { toks: out, state: next, sig }
        continue scan
      }
    }
    for (const mark of l.line) {
      if (!line.startsWith(mark, i)) continue
      if (mark === '#' && !hashStarts(line, i, ctx)) continue
      flush()
      let k = i + mark.length
      while (k < line.length && line[k] === mark[mark.length - 1]) k++
      if (line[k] === '!') k++
      while (k < line.length && /\s/.test(line[k])) k++
      out.push({ text: line.slice(i, k), style: COMMENT, iso: false })
      content(line.slice(k), COMMENT, out)
      return { toks: out, state: null, sig }
    }
    const c = line[i]
    if (l.tags && !inTag && c === '<' && /[A-Za-z/!?]/.test(line[i + 1] ?? '')) inTag = true
    else if (l.tags && inTag && c === '>') inTag = false
    // a `/` whose context was lost cannot be told apart: the line is not drawn
    if (l.regex && c === '/' && ctx.prev === LOST) ctx.full = true
    if (l.regex && c === '/' && ctx.prev !== LOST && regexCan(ctx.prev + sig)) {
      const j = regexEnd(line, i + 1)
      if (j > 0) {
        flush()
        const end = j + 1 + line.slice(j + 1).match(/^[a-z]*/)![0].length
        out.push({ text: line.slice(i, end), style: 0, iso: false })
        sig += '0'
        i = end
        continue
      }
    }
    const prefix = plain.match(/[A-Za-z$@]*$/)![0]
    for (const d of l.multi) {
      if (line.startsWith(d, i)) {
        flush()
        out.push({ text: d, style: STRING, iso: false })
        sig += '0'
        i += d.length
        const next = string(d, l.interp(d[0], prefix), true) as State
        if (next) return { toks: out, state: next, sig }
        continue scan
      }
    }
    if (l.quotes.includes(c) && (!l.tags || inTag)) {
      if (c === "'" && l.chars) {
        const m = line.slice(i).match(CHAR)
        if (m) {
          flush()
          out.push({ text: m[0], style: STRING, iso: false })
          sig += '0'
          i += m[0].length
          continue
        }
      } else {
        const mark = out.length
        const before = plain
        flush()
        out.push({ text: c, style: STRING, iso: false })
        sig += '0'
        i++
        if (string(c, l.interp(c, prefix), false) !== 'open') continue
        // no closing quote on this line: the quote is a plain character
        out.length = mark
        sig = sig.slice(0, -1)
        plain = before
        i--
      }
    }
    plain += c
    sig += c
    i++
  }
  flush()
  return { toks: out, state: null, sig }
}

// The index of the `/` that ends a regular expression literal starting at `from`, or -1.
function regexEnd(line: string, from: number): number {
  let cls = false
  for (let k = from; k < line.length; k++) {
    const c = line[k]
    if (c === '\\') k++
    else if (cls) cls = c !== ']'
    else if (c === '[') cls = true
    else if (c === '/') return k > from ? k : -1
  }
  return -1
}

export type CodeOptions = { base: Base; share: number; arabic?: Arabic }

// A fence's lines in order: groups the engine's `Code` draws, and rows (visual spans) drawn here.
export type CodePart = { kind: 'native'; text: string } | { kind: 'rows'; rows: Span[][] }

// Null when a cluster is wider than `room`, or a line is not one the scanner can place for sure (an
// interpolation still open at its end, a line `Lang.sure` refuses): the engine draws the fence.
export function codeParts(raw: string, language: string, room: number, opts: CodeOptions): CodePart[] | null {
  const l = langOf(language)
  const parts: CodePart[] = []
  let state: State = null
  let mine = false
  let prev = ''
  const lines = cleanText(raw).split('\n')
  const sure = l.sure?.(lines)
  for (const line of lines) {
    const inside = state !== null
    const ctx: Ctx = { cells: [], ok: !/[\u{100000}-\u{10FFFF}]/u.test(line), full: false, unsure: false, recipe: line.startsWith('\t'), prev, l, opts }
    const scanned = scanLine(leadingTabs(line), state, ctx)
    if (ctx.unsure) return null
    state = scanned.state
    prev = compact(prev + scanned.sig + '\n')
    mine = hasRtl(line) || (inside && mine)
    const last = parts[parts.length - 1]
    if (!mine) {
      if (last?.kind === 'native') last.text += '\n' + line
      else parts.push({ kind: 'native', text: line })
      continue
    }
    if (sure && !sure(line)) return null
    const rows = ctx.full ? null : layoutLine(scanned.toks, room, ctx)
    if (rows === null) return null
    if (last?.kind === 'rows') last.rows.push(...rows)
    else parts.push({ kind: 'rows', rows })
  }
  return parts
}

// The row was cut already: an isolate's piece is laid out on one line.
const UNBOUNDED = 1_000_000

// One code line as rows of at most `room` cells: wrapped as prose is (layout.ts breakLines, on the
// logical line, tabs at CODE_TAB), then each row's piece of an isolate reordered on its own, in the
// direction of the whole isolate, its atoms kept whole as LTR isolates.
function layoutLine(toks: Tok[], room: number, ctx: Ctx): Span[][] | null {
  const { opts } = ctx
  const text = toks.map(t => t.text).join('')
  // a grapheme that holds a placeholder is measured as drawn: the atom's grapheme and any marks after it
  const cs = clustersOf(text, CODE_TAB, g => (atomCell(g.codePointAt(0)!, ctx) ? clusterWidth(g.replace(ATOM, a => atomCell(a.codePointAt(0)!, ctx)?.text ?? a)) : undefined))
  const lines = breakLines(cs, room, room)
  if (lines === null) return null
  const tokAt = new Int32Array(text.length)
  let at = 0
  toks.forEach((t, n) => {
    tokAt.fill(n, at, at + t.text.length)
    at += t.text.length
  })
  const dirs = toks.map(t => {
    const words = stripAtoms(t.text, ctx)
    return t.iso && hasRtl(words) ? (resolveParagraph(words, null, opts.base, opts.share).level & 1 ? 'rtl' : 'ltr') : null
  })
  const rows: Span[][] = []
  for (const [first, last] of lines) {
    const spans: Span[] = []
    const push = (sp: Span) => {
      const prev = spans[spans.length - 1]
      if (prev && prev.style === sp.style) prev.text += sp.text
      else if (sp.text) spans.push({ ...sp })
    }
    for (let k = first; k < last; ) {
      const n = tokAt[cs[k].start]
      let piece = ''
      for (; k < last && tokAt[cs[k].start] === n; k++) {
        const c = cs[k]
        // a tab as the spaces it advances
        piece += c.text === '\t' ? ' '.repeat(c.width) : c.text
      }
      const t = toks[n]
      const dir = dirs[n]
      if (dir === null || (dir === 'ltr' && !hasRtl(stripAtoms(piece, ctx)))) {
        // undrawn format characters are dropped, as in prose
        push({ text: clustersOf(piece).filter(c => c.drawn).map(c => c.text).join(''), style: t.style })
        continue
      }
      const m = piece.match(/^(\s*)(.*?)(\s*)$/su)!
      push({ text: m[1], style: t.style })
      const runs: Run[] = []
      let from = 0
      for (const a of ctx.ok ? m[2].matchAll(ATOMS) : []) {
        if (a.index > from) runs.push({ text: m[2].slice(from, a.index), style: t.style })
        runs.push({ text: a[0], style: t.style, isolate: true })
        from = a.index + a[0].length
      }
      if (from < m[2].length) runs.push({ text: m[2].slice(from), style: t.style })
      const laid = layoutParagraph(runs, { width: UNBOUNDED, base: dir, share: opts.share, mode: 'visual', arabic: opts.arabic })
      if (laid === null || laid.length !== 1) return null
      for (const sp of laid[0].spans) push(sp)
      push({ text: m[3], style: t.style })
    }
    const row = fill(spans, ctx)
    // the row as drawn must fit: anything measured otherwise than drawn falls back
    if (clustersOf(row.map(sp => sp.text).join('')).reduce((w, c) => w + c.width, 0) > room) return null
    rows.push(row)
  }
  return rows
}
