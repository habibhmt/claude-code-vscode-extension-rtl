// The prompt preview. Claude Code's prompt box shows what is typed, and its dim suggestion (Tab
// takes it), in logical order, so RTL text reads backwards there; a mod cannot redraw the box. With the
// option `preview` on, the band above the prompt shows the same text laid out: the draft, or in an
// empty box the suggestion. Only a text with RTL letters is shown. Display only: the box, the
// suggestion and the prompt that is sent are never changed (docs/design/how-it-works.md).

import { hasRtl, resolveParagraph } from './bidi.ts'
import { layoutParagraph, type Span } from './layout.ts'
import { DIM, ITALIC } from './markdown.ts'
import type { Settings } from './render.ts'
import { graphemes, textWidth } from './width.ts'

// A row of the band above the prompt: its spans in visual order, its side, and the one-cell mark in
// the two-cell column on that side (a space when none).
export type BandRow = { spans: Span[]; rtl: boolean; mark: string }
export const BAND_PREFIX = 2

// The draft is marked as being written; the suggestion as a next prompt on offer. Not the Tab key:
// the mod sees the suggestion arrive but not every way it leaves the box, so the band does not
// promise what Tab inserts.
export const DRAFT_MARK = '✎'
export const GHOST_MARK = '»'
// the top row when the draft's first rows are left out
export const CUT_MARK = '…'
// At most this many rows: the last ones, where typing goes on.
export const PREVIEW_ROWS = 8
// A draft longer than this is not laid out at each key; the band says so in one row.
export const PREVIEW_MAX = 4000
export const TOO_LONG = 'rtl: too long to preview'
// While the box holds text, it is read this often, for the changes that raise no event.
export const POLL_MS = 400

// The rows of the box's text in `columns` cells (the mark column included), at most `maxRows`.
// Null when there is nothing to show: no RTL letters, or no room (for the too-long note as well).
export function modelPreview(text: string, ghost: boolean, columns: number, maxRows: number, s: Settings): BandRow[] | null {
  const limit = Math.min(maxRows, PREVIEW_ROWS)
  const content = columns - BAND_PREFIX
  if (!hasRtl(text) || limit < 1 || !(content >= 8)) return null
  const mark = ghost ? GHOST_MARK : DRAFT_MARK
  if (text.length > PREVIEW_MAX) return textWidth(TOO_LONG) <= content ? [{ spans: [{ text: TOO_LONG, style: DIM | ITALIC }], rtl: false, mark }] : null
  const style = ghost ? DIM | ITALIC : 0
  const rows: BandRow[] = []
  // each line of the draft is a paragraph of its own, in its own direction
  for (const line of text.split('\n')) {
    if (line === '') {
      rows.push({ spans: [], rtl: false, mark: ' ' })
      continue
    }
    const rtl = (resolveParagraph(line, null, s.base, s.share).level & 1) === 1
    const laid = layoutParagraph([{ text: line, style }], { width: content, base: rtl ? 'rtl' : 'ltr', share: s.share, mode: s.mode, arabic: s.arabic })
    if (laid === null) return null
    for (const r of laid) rows.push({ spans: r.spans, rtl, mark: ' ' })
  }
  if (rows.length <= limit) return [{ ...rows[0], mark }, ...rows.slice(1)]
  const tail = rows.slice(-limit)
  return [{ ...tail[0], mark: CUT_MARK }, ...tail.slice(1)]
}

// The draft pane (`/rtl-draft`): the box's text laid out like the band, every row of it, and a bar
// where the cursor stands. The bar is a neutral character put into the text at the cursor (UTF-16
// units, as the box counts them, moved back to a cluster's start), so it lands where UAX #9 puts
// that spot; it is a run of its own style, CURSOR_STYLE, so a bar typed in the draft stays text. A
// line without letters (an empty draft too) is drawn on the RTL side. Null when the pane is too
// narrow; past PREVIEW_MAX the one row says so.
export const CURSOR = '\u2502'
export const CURSOR_STYLE = 1024
export type DraftModel = { rows: BandRow[]; cursorRow: number }
export function modelDraft(text: string, cursor: number, columns: number, s: Settings): DraftModel | null {
  if (!(columns >= 8)) return null
  if (text.length > PREVIEW_MAX) return textWidth(TOO_LONG) <= columns ? { rows: [{ spans: [{ text: TOO_LONG, style: DIM | ITALIC }], rtl: false, mark: ' ' }], cursorRow: 0 } : null
  let at = 0
  for (const g of graphemes(text)) {
    if (at + g.length > cursor) break
    at += g.length
  }
  // the cursor's line, and where in it
  const before = text.slice(0, at)
  const cursorLine = before.split('\n').length - 1
  const column = before.length - (before.lastIndexOf('\n') + 1)
  const rows: BandRow[] = []
  let cursorRow = 0
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const runs = index === cursorLine
      ? [{ text: line.slice(0, column), style: 0 }, { text: CURSOR, style: CURSOR_STYLE }, { text: line.slice(column), style: 0 }].filter(r => r.text !== '')
      : [{ text: line, style: 0 }]
    if (line === '' && index !== cursorLine) {
      rows.push({ spans: [], rtl: true, mark: ' ' })
      continue
    }
    const rtl = !/\p{L}/u.test(line) || (resolveParagraph(line, null, s.base, s.share).level & 1) === 1
    const laid = layoutParagraph(runs, { width: columns, base: rtl ? 'rtl' : 'ltr', share: s.share, mode: s.mode, arabic: s.arabic })
    // one paragraph that cannot be laid out fails the whole draft (the caller falls back)
    if (laid === null) return null
    for (const r of laid) {
      if (r.spans.some(sp => sp.style & CURSOR_STYLE)) cursorRow = rows.length
      rows.push({ spans: r.spans, rtl, mark: ' ' })
    }
  }
  return rows.length ? { rows, cursorRow } : null
}

// What the band knows of the box, kept out of the hooks so these rules are tested on their own: the
// draft as last seen (an edit's result, or the box read again), Claude Code's suggestion while it
// stays on offer, and the edits under way. Observed live on 2.1.289: the suggestion shows again
// whenever an edit empties the box (typing then deleting, Ctrl+U, even after Tab took it), and is
// dropped when the box is sent (a slash command too, which raises no prompt.submit) or a turn starts.
// The mod cannot see the suggestion itself, so a box that empties with no edit to empty it is taken
// as sent, and the suggestion dropped: an inference that errs toward showing nothing (going back
// down through history to an empty box looks the same).
export class BoxMirror {
  draft = ''
  // where the cursor stood in the draft last seen (UTF-16 units)
  cursor = 0
  ghost: string | null = null
  // the hint line's last word on the box: empty or holding text
  holding = false
  private editing = 0
  private edits = 0
  private offers = 0
  // whether the box last became empty by an edit (then Claude Code shows the suggestion again)
  private emptiedByEdit = false
  // a send, a new or ended session: what was read or edited before it is not taken after it
  private generation = 0
  // reads of the box, in the order they began: an older one answered late is not taken
  private reads = 0
  private lastRead = 0

  // Whether the band shows the box: what it shows holds RTL letters.
  shows(): boolean {
    return this.draft !== '' ? hasRtl(this.draft) : this.ghost !== null && hasRtl(this.ghost)
  }

  // An edit begins; it ends with the box's new text (null when the edit failed).
  editStart(): number {
    this.editing++
    this.edits++
    return this.generation
  }
  editEnd(generation: number, text: string | null, cursor = text?.length ?? 0): void {
    this.editing--
    if (text === null || generation !== this.generation) return
    this.draft = text
    this.cursor = cursor
    this.emptiedByEdit = text === ''
  }

  // A suggestion is about to be answered; true when it shows and no later one was asked since.
  offer(): number {
    return ++this.offers
  }
  suggested(offer: number, text: string): boolean {
    if (offer !== this.offers) return false
    // shown only in an empty box: a draft last seen is gone
    this.draft = ''
    this.cursor = 0
    this.ghost = text
    return true
  }

  // The box sent: no suggestion on offer any more, and nothing from before is taken.
  sent(): void {
    this.draft = ''
    this.cursor = 0
    this.emptiedByEdit = false
    this.generation++
    this.dropGhost()
  }
  // A session began or ended: as sent, and the hint line's word is not known yet.
  reset(): void {
    this.sent()
    this.holding = false
  }
  // A turn began: Claude Code drops its suggestion.
  dropGhost(): void {
    this.ghost = null
    this.offers++
  }

  // The hint line drawn again: true when it turned (empty to holding text, or back).
  hint(holding: boolean): boolean {
    if (holding === this.holding) return false
    this.holding = holding
    if (holding) this.emptiedByEdit = false
    else this.emptied()
    return true
  }

  // The box read again (`$.prompt.read`): `token` from `readStart` when the read began. True when the
  // band or the draft pane has something new (the pane draws the cursor too).
  readStart(): ReadToken {
    return { edits: this.edits, generation: this.generation, read: ++this.reads }
  }
  read(token: ReadToken, text: string, cursor = text.length): boolean {
    if (!this.current(token)) return false
    this.lastRead = token.read
    const moved = cursor !== this.cursor
    this.cursor = cursor
    if (text === this.draft) return moved
    if (text === '') this.emptied()
    else {
      this.draft = text
      this.emptiedByEdit = false
    }
    return true
  }

  // Whether a read that began with `token` still tells the box as it is: no edit, send, new session
  // or later read has happened since (an edit under way may change it yet).
  current(token: ReadToken): boolean {
    return token.edits === this.edits && token.generation === this.generation && token.read >= this.lastRead && this.editing === 0
  }

  // The box is empty now. With no edit to empty it, it is taken as sent: the suggestion is dropped.
  private emptied(): void {
    if (this.editing === 0 && !this.emptiedByEdit) this.dropGhost()
    this.draft = ''
    this.cursor = 0
  }
}

export type ReadToken = { edits: number; generation: number; read: number }
