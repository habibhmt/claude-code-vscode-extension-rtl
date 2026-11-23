#!/usr/bin/env node
// آزمونِ رفتاریِ ردیفِ autoCompactWindow در تبِ «تنظیمات کلود» (تعریف ۳۰، بندِ ۱).
// تابعِ واقعیِ tz_matn_alan از claude-ui-buttons.js بیرون کشیده و با مقادیرِ ساختگی
// اجرا می‌شود — نه DOM، نه مرورگر. اجرا: node Doc/abzar/test_tanzimat_alan.cjs
// خرابکاری: خطِ fallback را به `v = a.thr` برگردان ⇒ تستِ ۱ قرمز می‌شود.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'claude-ui-buttons.js');
const text = fs.readFileSync(SRC, 'utf8').split('\n');
const start = text.findIndex((l) => l.includes('function tz_matn_alan(k) {'));
if (start < 0) { console.error('FAIL تابع پیدا نشد'); process.exit(1); }
let end = -1;
for (let i = start + 1; i < text.length; i++) {
  if (text[i] === '  }') { end = i; break; }
}
if (end < 0) { console.error('FAIL انتهای تابع پیدا نشد'); process.exit(1); }
const body = text.slice(start, end + 1).join('\n');

const helpers = `
var TZ_CHROME = '__chrome';
var TZ_ESM_SATH = { sarasari: 'سراسری', poshe: 'پروژه', chat: 'چت' };
var TZ_ESM_MANBA = {};
var TZ_FASELE_TOKEN = 33000;
function tz_hezar(n) { return String(n); }
function tz_mani() { return ''; }
function tz_neveshte(v) { return String(v); }
function tz_khali() { return ''; }
function tz_sar(k, v, src) { return src + ':' + v; }
function tz_nemayesh(k, v) { return String(v); }
`;

function build(TZ) {
  const fn = new Function('TZ', helpers + body + '\nreturn tz_matn_alan;');
  return fn(TZ);
}

const P = 533000, S = 233000;
const cases = [
  ['۱ موتور عدد ندارد ولی ثبت‌شده هست', {
    data: { alan: { applied: { model: 'm' } }, barande: { autoCompactWindow: { v: P, sath: 'poshe' } } }
  }, (out) => out.includes('کامپکت سر') && out.includes(String(P - 33000)) && !out.includes('معلوم نیست')],
  ['۲ موتور عدد دارد', {
    data: { alan: { thr: 497000, applied: { model: 'm' } }, barande: {} }
  }, (out) => out.includes('497000') && !out.includes('معلوم نیست')],
  ['۳ هیچ‌جا ثبت نشده ⇒ معلوم نیست', {
    data: { alan: { applied: { model: 'm' } }, barande: {} }
  }, (out) => out.includes('معلوم نیست')],
  ['۴ سراسری ثبت‌شده، پوشه نه', {
    data: { alan: { applied: { model: 'm' } }, barande: { autoCompactWindow: { v: S, sath: 'sarasari' } } }
  }, (out) => out.includes(String(S - 33000)) && !out.includes('معلوم نیست')],
];

let bad = 0;
for (const [name, TZ, ok] of cases) {
  const fn = build(TZ);
  const out = fn('autoCompactWindow');
  const pass = ok(out);
  if (!pass) bad++;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + ' ⇒ ' + out);
}
console.log('جمع: ' + (bad ? bad + ' قرمز' : 'سبز'));
process.exit(bad ? 1 : 0);
