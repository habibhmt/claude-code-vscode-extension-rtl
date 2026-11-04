// Arabic-script shaping for terminals: each joining letter becomes the presentation form
// (isolated, final, initial, medial) that its neighbours call for, and lam + alef becomes one
// ligature. Terminals do not shape, and a browser terminal cannot join letters that the mod puts
// in separate color runs (one per RTL letter, see isolate.ts); a presentation form carries its
// shape in the code point itself, so it looks the same in both.
//
// Joining follows Unicode's Joining_Type (ArabicShaping.txt): D joins on both sides, R only to
// the letter before it, L only to the letter after it, C (tatweel, ZWJ) causes joining, T (marks,
// most format characters) is skipped over, U (everything else, ZWNJ and the bidi isolates
// included) breaks joining. A letter that has no presentation form for the shape it needs is drawn
// in the closest form it has, or unchanged; its neighbours still join towards it, as they would in
// a shaping renderer. Joining never crosses a segment edge: a line break, the edge of an LTR
// isolate (inline code), or a cut the caller asks for (the start of each wrapped row).
//
// Lam + alef becomes one ligature only when they are adjacent and both carry the
// same style: a mark on the lam would otherwise move onto the ligature, and a style change inside it
// would be lost. Marks on the alef follow the ligature.
//
// ZWNJ and ZWJ next to an Arabic-script letter have done their work once the forms are chosen and
// are left out of the display text (the logical text keeps them).

import { FORMS, JOINING, LAM_ALEF } from './arabic-tables.ts'

const forms = new Map<number, number[]>()
for (let i = 0; i < FORMS.length; i += 5) forms.set(FORMS[i], FORMS.slice(i + 1, i + 5))
const lamAlef = new Map<number, number[]>()
for (let i = 0; i < LAM_ALEF.length; i += 3) lamAlef.set(LAM_ALEF[i], LAM_ALEF.slice(i + 1, i + 3))

const LAM = 0x0644
const ZWNJ = 0x200c
const ZWJ = 0x200d

// Joining types: 0 U, 1 D, 2 R, 3 L, 4 C, 5 T.
const U = 0, D = 1, R = 2, L = 3, C = 4, T = 5
const TRANSPARENT = /^[\p{Mn}\p{Me}\p{Cf}]$/u

export function joiningType(cp: number): number {
  let lo = 0
  let hi = JOINING.length / 3 - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (cp < JOINING[mid * 3]) hi = mid - 1
    else if (cp > JOINING[mid * 3 + 1]) lo = mid + 1
    else return JOINING[mid * 3 + 2]
  }
  return TRANSPARENT.test(String.fromCodePoint(cp)) ? T : U
}

// Arabic script, including Arabic Supplement, Extended-A/B and the presentation forms.
export const ARABIC = /[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿]/u
const isArabic = (cp: number) => ARABIC.test(String.fromCodePoint(cp))

export function needsShaping(text: string): boolean {
  return ARABIC.test(text)
}

export type Shaped = { text: string; from: Int32Array }

export type ShapeOptions = {
  // code units inside an LTR isolate: joining never crosses the isolate's edge
  isolated?: Uint8Array | null
  // the style of each code unit: lam and alef in different styles do not form a ligature
  styles?: Int32Array | null
  // code-unit indices that start a new segment (wrapped rows): no joining across them
  cuts?: Iterable<number>
}

// Returns the display text and, for each of its code units, the index of the source code unit it
// came from (a ligature comes from its lam).
export function shape(text: string, opts: ShapeOptions = {}): Shaped {
  const isolated = opts.isolated ?? null
  const styles = opts.styles ?? null
  const cutAt = new Set(opts.cuts ?? [])
  const cps: number[] = []
  const at: number[] = []
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i)!
    cps.push(cp)
    at.push(i)
    i += cp > 0xffff ? 2 : 1
  }
  const n = cps.length
  const types = cps.map(joiningType)
  // Segment ids per scalar. `text` segments end at a line break or an isolate edge; `seg` also at
  // each cut. Which characters are drawn depends only on the text segments, so cuts change forms
  // and never the length of the display text.
  const textSeg = new Int32Array(n)
  const seg = new Int32Array(n)
  for (let k = 1, a = 0, b = 0; k < n; k++) {
    const edge = cps[k - 1] === 0x0a || cps[k] === 0x0a || (isolated !== null && isolated[at[k]] !== isolated[at[k - 1]])
    if (edge) a++
    if (edge || cutAt.has(at[k])) b++
    textSeg[k] = a
    seg[k] = b
  }
  // nearest non-transparent neighbour in the same segment, or -1 (linear passes)
  const neighbours = (segs: Int32Array) => {
    const prev = new Int32Array(n).fill(-1)
    const next = new Int32Array(n).fill(-1)
    for (let k = 0, last = -1; k < n; k++) {
      if (last >= 0 && segs[last] !== segs[k]) last = -1
      prev[k] = last
      if (types[k] !== T) last = k
    }
    for (let k = n - 1, last = -1; k >= 0; k--) {
      if (last >= 0 && segs[last] !== segs[k]) last = -1
      next[k] = last
      if (types[k] !== T) last = k
    }
    return { prev, next }
  }
  const { prev, next } = neighbours(seg)
  const text0 = cutAt.size ? neighbours(textSeg) : { prev, next }
  const joinsAfter = (t: number) => t === D || t === L || t === C // can connect to the next letter
  const joinsBefore = (t: number) => t === D || t === R || t === C // can connect to the previous letter

  let out = ''
  const from: number[] = []
  const emit = (cp: number, src: number) => {
    const s = String.fromCodePoint(cp)
    out += s
    for (let u = 0; u < s.length; u++) from.push(src)
  }
  let skipAlef = -1
  for (let k = 0; k < n; k++) {
    if (k === skipAlef) continue
    const cp = cps[k]
    const t = types[k]
    const p = prev[k]
    const q = next[k]
    if (cp === ZWNJ || cp === ZWJ) {
      const p0 = text0.prev[k]
      const q0 = text0.next[k]
      if ((p0 >= 0 && isArabic(cps[p0])) || (q0 >= 0 && isArabic(cps[q0]))) continue
    }
    const linkPrev = joinsBefore(t) && p >= 0 && joinsAfter(types[p])
    if (cp === LAM && k + 1 < n && textSeg[k + 1] === textSeg[k] && lamAlef.has(cps[k + 1]) && (styles === null || styles[at[k]] === styles[at[k + 1]])) {
      const lig = lamAlef.get(cps[k + 1])!
      emit(linkPrev ? lig[1] : lig[0], at[k])
      skipAlef = k + 1
      continue
    }
    const f = forms.get(cp)
    if (!f) {
      emit(cp, at[k])
      continue
    }
    const linkNext = joinsAfter(t) && q >= 0 && joinsBefore(types[q])
    // the wanted form, then the closest available one
    const form = linkPrev && linkNext ? f[3] || f[1] || f[0] : linkPrev ? f[1] || f[0] : linkNext ? f[2] || f[0] : f[0]
    emit(form || cp, at[k])
  }
  return { text: out, from: Int32Array.from(from) }
}
