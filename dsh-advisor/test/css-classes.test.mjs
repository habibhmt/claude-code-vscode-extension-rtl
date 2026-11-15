/**
 * آزمونِ رگرسیون «هر نامِ کلاس یک قاعدهٔ CSS دارد» — dsh-advisor.
 * ------------------------------------------------------------------
 * داستانِ باگ (۱۵ نوامبر، dsh-nav): استایل با نام‌های قدیمی نوشته شده بود و کلاس‌ها
 * با نام‌های تازه ساخته می‌شدند؛ نتیجه: هیچ استایلی نمی‌خورد و دکمه‌ها خاکستریِ
 * پیش‌فرض می‌شدند. این‌جا همان قاعده برایِ dsh-advisor آمده است.
 *
 * تفاوتِ این افزونه با dsh-nav: این‌جا نه کلاسی هست، نه رشتهٔ STYLE — هر استایل
 * با شیءِ درون‌خطی (style: CSS.x) می‌آید و قلاب‌ها data-advisor-* اند. پس قاعده دو تاست:
 *   ۱) هر style: CSS.x باید کلیدِ x را در شیءِ CSS داشته باشد — وگرنه style نامعریف
 *      می‌شود و عنصر بی‌استایل می‌ماند (همان باگِ dsh-nav)،
 *   ۲) هر قلابِ data-advisor-* که در JSX نوشته می‌شود باید سالم و بی رشته‌چسبانی باشد،
 *   ۳) اگر روزی کلاس آمد (className/class)، هر کلاس باید در متنِ CSS افزونه قاعده داشته باشد.
 *
 * مسیرِ فایل با متغیرِ CSS_TEST_CLIENT عوض می‌شود (برای خرابکاریِ عمدی در /tmp).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const FILE = process.env.CSS_TEST_CLIENT || fileURLToPath(new URL('../client.js', import.meta.url))
const src = fs.readFileSync(FILE, 'utf8')

/** فقط کامنت‌ها را برمی‌دارد؛ رشته‌ها دست‌نخورده می‌مانند (کدِ آزمون را ساده و قابلِ اعتماد نگه می‌دارد). */
function stripComments (text) {
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    const d = text[i + 1]
    if (c === '/' && d === '/') {
      while (i < n && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && d === '*') {
      i += 2
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      let j = i + 1
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue }
        if (text[j] === quote) break
        j++
      }
      if (j >= n) { out += text.slice(i); i = n; continue }
      out += text.slice(i, j + 1)
      i = j + 1
      continue
    }
    out += c
    i++
  }
  return out
}

const code = stripComments(src)

/** بدنهٔ شیء را از آکولادِ باز با شمارشِ آکولاد جدا می‌کند. */
function objectLiteral (text, openIndex) {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return text.slice(openIndex, i + 1)
    }
  }
  return ''
}

const cssMatch = code.match(/const\s+CSS\s*=\s*\{/)
const cssOpen = cssMatch ? code.indexOf('{', cssMatch.index) : -1
const CSS_BODY = cssOpen === -1 ? '' : objectLiteral(code, cssOpen)
const CSS_KEYS = new Set([...CSS_BODY.matchAll(/(?:^|[{,\s])([A-Za-z_$][\w$]*)\s*:/g)].map(m => m[1]))

const usedStyles = [...new Set([...code.matchAll(/CSS\.([A-Za-z_$][\w$]*)/g)].map(m => m[1]))]
const dataAttrs = [...new Set([...code.matchAll(/'(data-advisor[\w-]*)'\s*:/g)].map(m => m[1]))]
const classNames = [...new Set(
  [...code.matchAll(/className\s*[:=]\s*'([^']+)'/g), ...code.matchAll(/\bclass\s*[:=]\s*'([^']+)'/g)]
    .flatMap(m => m[1].split(/\s+/))
    .filter(Boolean)
)]
const styleTextMatch = code.match(/const\s+(?:STYLE|STYLES|CSS_TEXT)\s*=\s*'([\s\S]*?)'\n/)
const STYLE_TEXT = styleTextMatch ? styleTextMatch[1] : ''

test('شیءِ CSS هست و کلیدهایش خوانده می‌شوند', () => {
  assert.notEqual(cssOpen, -1, 'const CSS = { ... } پیدا نشد')
  assert.ok(CSS_KEYS.size >= 15, 'کلیدهای CSS کم است: ' + CSS_KEYS.size)
})

test('هر style: CSS.x کلیدِ x را در شیءِ CSS دارد', () => {
  assert.ok(usedStyles.length >= 5, 'استفاده از CSS کم است: ' + usedStyles.length)
  const missing = usedStyles.filter(name => !CSS_KEYS.has(name))
  assert.deepEqual(missing, [], 'این استایل‌ها در شیءِ CSS تعریف نشده‌اند: ' + missing.join(', '))
})

test('قلاب‌های data-advisor-* سالم ساخته می‌شوند', () => {
  assert.ok(dataAttrs.length >= 2, 'قلابِ data-advisor-* کم است: ' + dataAttrs.length)
  assert.equal([...code.matchAll(/'data-advisor-[\w-]*'\s*\+/g)].length, 0,
    'نامِ قلاب با رشته‌چسبانی ساخته شده؛ قابلِ بررسی نیست')
})

test('هر کلاسِ استفاده‌شده در متنِ CSS قاعده دارد (اگر کلاس آمد)', () => {
  if (classNames.length === 0) {
    // این افزونه کلاس ندارد: همه‌چیز با styleِ درون‌خطی است و رشتهٔ STYLE هم ندارد.
    assert.equal(STYLE_TEXT, '', 'افزونه رشتهٔ CSS دارد ولی کلاس استفاده نمی‌کند')
    return
  }
  assert.ok(STYLE_TEXT !== '', 'کلاس هست ولی متنِ CSS افزونه نیست')
  for (const name of classNames) {
    const escaped = name.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
    assert.match(STYLE_TEXT, new RegExp('\\.' + escaped + '(?![\\w-])'), 'کلاسِ بی‌قاعده: ' + name)
  }
})
