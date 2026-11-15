/**
 * آزمونِ رگرسیون «هر نامِ کلاس یک قاعدهٔ CSS دارد» — dsh-side-panel.
 * -------------------------------------------------------------------
 * داستانِ باگ (۱۵ نوامبر، dsh-nav): استایل با نام‌های قدیمی نوشته شده بود و کلاس‌ها
 * با نام‌های تازه ساخته می‌شدند؛ نتیجه: هیچ استایلی نمی‌خورد و دکمه‌ها خاکستریِ
 * پیش‌فرض می‌شدند. این‌جا همان قاعده برایِ dsh-side-panel آمده است.
 *
 * این افزونه هم کلاس ندارد: استایل با شیءِ درون‌خطی (style: CSS.x) می‌آید و
 * برایِ چیدمان یک قطعه CSS واقعی دارد (LAYOUT_CSS) که در <style> تزریق می‌شود.
 * پس قاعده:
 *   ۱) هر style: CSS.x باید کلیدِ x را در شیءِ CSS داشته باشد (وگرنه بی‌استایل می‌ماند)،
 *   ۲) هر selستورِ LAYOUT_CSS باید یک قلابِ واقعی (data-sp-layout) را نشانه بگیرد،
 *   ۳) اگر روزی کلاس آمد، هر کلاس باید در LAYOUT_CSS قاعده داشته باشد.
 *
 * مسیرِ فایل با متغیرِ CSS_TEST_CLIENT عوض می‌شود (برای خرابکاریِ عمدی در /tmp).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const FILE = process.env.CSS_TEST_CLIENT || fileURLToPath(new URL('../client.js', import.meta.url))
const src = fs.readFileSync(FILE, 'utf8')

/** فقط کامنت‌ها را برمی‌دارد؛ رشته‌ها دست‌نخورده می‌مانند. */
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

/** قطعهٔ CSSِ چیدمان (آرایهٔ رشته‌ها که با join مونتاژ می‌شود). */
const layoutMatch = code.match(/const\s+LAYOUT_CSS\s*=\s*\[([\s\S]*?)\]\.join\(/)
const LAYOUT_CSS = layoutMatch
  ? [...layoutMatch[1].matchAll(/'((?:\\.|[^'\\])*)'/g)].map(m => m[1]).join('\n')
  : ''

const classNames = [...new Set(
  [...code.matchAll(/className\s*[:=]\s*'([^']+)'/g), ...code.matchAll(/\bclass\s*[:=]\s*'([^']+)'/g)]
    .flatMap(m => m[1].split(/\s+/))
    .filter(Boolean)
)]

test('شیءِ CSS هست و کلیدهایش خوانده می‌شوند', () => {
  assert.notEqual(cssOpen, -1, 'const CSS = { ... } پیدا نشد')
  assert.ok(CSS_KEYS.size >= 15, 'کلیدهای CSS کم است: ' + CSS_KEYS.size)
})

test('هر style: CSS.x کلیدِ x را در شیءِ CSS دارد', () => {
  assert.ok(usedStyles.length >= 5, 'استفاده از CSS کم است: ' + usedStyles.length)
  const missing = usedStyles.filter(name => !CSS_KEYS.has(name))
  assert.deepEqual(missing, [], 'این استایل‌ها در شیءِ CSS تعریف نشده‌اند: ' + missing.join(', '))
})

test('قطعهٔ CSSِ چیدمان هست و به قلابِ واقعیِ data-sp-layout وصل است', () => {
  assert.notEqual(LAYOUT_CSS, '', 'LAYOUT_CSS پیدا نشد')
  const rules = LAYOUT_CSS.split('\n').filter(line => line.includes('{'))
  assert.ok(rules.length >= 3, 'قاعدهٔ CSS کم است: ' + rules.length)
  for (const rule of rules) {
    assert.match(rule, /\[data-sp-layout\]/, 'قاعده‌ای که قلابِ صفحه را نشانه نمی‌گیرد: ' + rule)
  }
})

test('هر کلاسِ استفاده‌شده در CSSِ افزونه قاعده دارد (اگر کلاس آمد)', () => {
  if (classNames.length === 0) {
    // این افزونه کلاس ندارد: استایلِ درون‌خطی + قلاب‌های data-*.
    assert.equal((LAYOUT_CSS.match(/\.[a-z][\w-]*/g) || []).length, 0, 'CSS کلاس‌دار دارد ولی کد کلاس نمی‌سازد')
    return
  }
  assert.notEqual(LAYOUT_CSS, '', 'کلاس هست ولی متنِ CSS افزونه نیست')
  for (const name of classNames) {
    const escaped = name.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
    assert.match(LAYOUT_CSS, new RegExp('\\.' + escaped + '(?![\\w-])'), 'کلاسِ بی‌قاعده: ' + name)
  }
})
