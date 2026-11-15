import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// باگِ ۱۵ نوامبر: استایل با .navTrigger/.navMenu نوشته شده بود ولی کلاس‌ها dsh-nav-* بودند
// ⇐ هیچ استایلی نمی‌خورد، دکمه‌ها خاکستریِ پیش‌فرض و منو ته صفحه (نامرئی) باز می‌شد.
const src = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const style = JSON.parse(src.match(/const STYLE = ("(?:[^"\\]|\\.)*")/)[1])
const clsBlock = src.match(/const CLS = \{([\s\S]*?)\n    \}/)[1]
const classes = [...clsBlock.matchAll(/'(dsh-nav-[a-z-]+)'/g)].map((m) => m[1])

test('every CLS class has a CSS rule in STYLE', () => {
  assert.ok(classes.length >= 15)
  for (const name of classes) {
    assert.match(style, new RegExp('\\.' + name + '(?![\\w-])'), name)
  }
})

test('STYLE has no camelCase .navX selectors left', () => {
  assert.equal((style.match(/\.nav[A-Z]\w*/g) || []).length, 0)
})

test('menu is fixed-positioned and anchored', () => {
  assert.match(style, /\.dsh-nav-menu \{[^}]*position: fixed/)
  assert.match(style, /\.dsh-nav-trigger \{[^}]*background: transparent/)
})
