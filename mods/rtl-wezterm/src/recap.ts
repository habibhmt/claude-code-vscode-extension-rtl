// The recap band: an opt-in stand-in for Claude Code's automatic recap (`※ recap: …`), which a mod
// cannot draw (docs/design/how-it-works.md). It waits for the engine's own idle notification, then
// three minutes more, asks the session's model for the summary the native recap asks for, and
// shows it above the prompt. Nothing is stored. This module is the part without engine calls: the
// gate that decides when, the summary's text, and the rows.

import { resolveParagraph } from './bidi.ts'
import { layoutParagraph, type Run, type Span } from './layout.ts'
import { BOLD, DIM, ITALIC } from './markdown.ts'
import type { Settings } from './render.ts'
import { ARABIC } from './shape.ts'

// The native recap's instruction, word for word (Claude Code 2.1.289).
export const RECAP_PROMPT =
  'The user stepped away and is coming back. Recap in under 40 words, 1-2 plain sentences, no markdown. Lead with the overall goal and current task, then the one next action. Skip root-cause narrative, fix internals, secondary to-dos, and em-dash tangents.'

// What the band asks: the native instruction and one sentence more, since without it a recap of an
// Arabic or Persian conversation often came back in English.
export const RECAP_ASK = `${RECAP_PROMPT} Write it in the language of the user's own messages.`

// After the idle notification, as long as the native recap waits after a turn by default.
export const RECAP_DELAY_MS = 180_000
// The native recap's cap on the summary, in UTF-16 code units, the ellipsis included.
export const RECAP_MAX = 400
// Shown after the first few recaps, as the native recap shows `(disable recaps in /config)`.
export const RECAP_HINT = ' (turn off: /config, Recap band)'
const HINT_COUNT = 3
// Prompts the person must have sent: before the first recap, and since the last one.
const FIRST_PROMPTS = 3
const MORE_PROMPTS = 2

// The summary cut as the native recap cuts it: at most RECAP_MAX - 1 code units, back to a space
// when that keeps more than half, then an ellipsis.
export function capRecap(text: string): string {
  const t = text.trim()
  if (t.length <= RECAP_MAX) return t
  let cut = RECAP_MAX - 1
  // never between the halves of a surrogate pair
  if (/[\uD800-\uDBFF]/.test(t[cut - 1])) cut--
  const space = t.lastIndexOf(' ', cut)
  if (space > (RECAP_MAX - 1) / 2) cut = space
  return t.slice(0, cut).trimEnd() + '…'
}

// What the session keeps across a reload of the mod (`$.state`): the counts behind the prompts rule
// and the hint, for the session they belong to.
export type Counts = { prompts: number; promptsAtRecap: number; recaps: number }
export type RecapCounts = Counts & { session: string }

// When a recap may be made. The engine's events drive it; every method is cheap and pure, so the
// hooks stay thin and the rules are tested here.
// - `revision` changes with every submitted prompt, main-loop turn, session start or end and reload:
//   a recap belongs to one, and is void once it changes. It never goes back, so a wait from before
//   a reset cannot match a later one.
// - The idle notification arms one timer for the revision it came in; any sign of the person, a
//   prompt, a new turn or a new session disarms it, and that revision gets no recap.
export class RecapGate {
  revision = 0
  prompts = 0
  private promptsAtRecap = 0
  private recaps = 0
  private busy = false
  // the revision whose completed main turn the idle notification may arm (none until one completes
  // after a start or reload: the baseline)
  private completed = -1
  // the revision a timer is armed for, or a fork is running for
  private armed = -1
  private touched = -1
  // the last revision a recap was tried for: one try each
  private tried = -1
  // Each start or end of a session (or load of the mod) begins a new epoch: a restore or a save
  // asked in an older one is dropped. While `loading`, the session's kept counts are on their way:
  // prompts are counted, but no recap is made until the counts are whole (a recap made meanwhile
  // would set its baseline on part of them). A read that never answers leaves the session without.
  epoch = 0
  loading = false

  // A prompt was submitted, from any origin, whether or not it enters: what waits is void.
  submit(): void {
    this.revision++
    this.armed = -1
  }

  // The person's own prompt entered the conversation (not dropped): it counts.
  prompt(): void {
    this.prompts++
  }

  // A main-loop turn started or ended. (`$.model.fork` raises neither, seen on 2.1.289.)
  turnStart(): void {
    this.busy = true
    this.revision++
    this.armed = -1
  }

  turnEnd(): void {
    this.busy = false
    this.completed = this.revision
  }

  // The person did something the mod can see (an edit or a cursor move at the prompt), or a setting
  // of the band changed.
  touch(): void {
    this.touched = this.revision
    this.armed = -1
  }

  // A session started (`loading`: its kept counts are to be read) or ended, or the mod loaded
  // again: what waits is void, the counts start over, and no recap until a main turn completes after
  // this. A session ended by /clear or a resume goes on as another conversation, or one whose counts
  // the mod cannot read (a resume raises no session.start), so nothing carries over.
  reset(loading: boolean): void {
    this.revision++
    this.armed = -1
    this.busy = false
    this.completed = -1
    this.epoch++
    this.loading = loading
    this.prompts = 0
    this.promptsAtRecap = 0
    this.recaps = 0
  }

  // The counts, to keep in the session.
  counts(): Counts {
    return { prompts: this.prompts, promptsAtRecap: this.promptsAtRecap, recaps: this.recaps }
  }
  // The session's kept counts, read in `epoch`: added to what was counted while they were read, and
  // only when they are this session's and no start or end came in between. True when taken.
  restore(kept: RecapCounts | undefined, session: string, epoch: number): boolean {
    if (epoch !== this.epoch) return false
    this.loading = false
    if (kept && kept.session === session) {
      this.prompts += kept.prompts
      this.promptsAtRecap += kept.promptsAtRecap
      this.recaps += kept.recaps
    }
    return true
  }

  // The engine's idle notification: whether to arm the timer now.
  idle(): boolean {
    if (this.loading || this.busy || this.completed !== this.revision || this.touched === this.revision || this.tried === this.revision) return false
    if (!this.due()) return false
    this.armed = this.revision
    this.tried = this.revision
    return true
  }

  // Whether the armed timer of `revision` may still make its recap.
  live(revision: number): boolean {
    return this.armed === revision && this.revision === revision && !this.loading && !this.busy && this.touched !== revision
  }

  private due(): boolean {
    return this.recaps === 0 ? this.prompts >= FIRST_PROMPTS : this.prompts - this.promptsAtRecap >= MORE_PROMPTS
  }

  // The fork answered and its recap is shown: whether it carries the hint.
  shown(): boolean {
    this.recaps++
    this.promptsAtRecap = this.prompts
    this.armed = -1
    return this.recaps <= HINT_COUNT
  }

  // The fork gave no recap: this revision gets none (the native recap retries a failed one only
  // within its turn; one attempt per turn here).
  failed(): void {
    this.armed = -1
  }
}

// The band's rows: `※` in a two-cell column on the row's start side, then a bold dim `recap: ` and
// the summary in dim italic, as the native row draws them (Arabic-script text dim only: a slanted
// Arabic letter can read as another). The summary's own text decides the direction; an RTL recap
// runs from the right, its rows in visual order. The hint is a paragraph of its own, left to right
// on the summary's side: wrapped inside an RTL row its brackets would read turned around.
export type RecapModel = { width: number; content: number; rtl: boolean; rows: { spans: Span[]; first: boolean }[] }

export const RECAP_PREFIX = 2

export function modelRecap(text: string, hint: boolean, columns: number, s: Settings): RecapModel | null {
  const width = columns
  const content = width - RECAP_PREFIX
  if (!(content >= 8)) return null
  const rtl = (resolveParagraph(text, null, s.base, s.share).level & 1) === 1
  const runs: Run[] = [
    { text: 'recap: ', style: BOLD | DIM },
    { text, style: ARABIC.test(text) ? DIM : ITALIC | DIM },
  ]
  const lay = (r: Run[], base: 'rtl' | 'ltr') => layoutParagraph(r, { width: content, base, share: s.share, mode: s.mode, arabic: s.arabic })
  const laid = lay(runs, rtl ? 'rtl' : 'ltr')
  const hinted = hint ? lay([{ text: RECAP_HINT.trim(), style: ITALIC | DIM }], 'ltr') : []
  if (laid === null || hinted === null) return null
  return { width, content, rtl, rows: [...laid, ...hinted].map((r, i) => ({ spans: r.spans, first: i === 0 })) }
}
