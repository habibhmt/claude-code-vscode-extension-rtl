#!/usr/bin/env node
// آزمونِ تازگیِ واژه‌نامه در پنلِ چت (ناظر-۱۳۶، ۲۳ نوامبر ۲۰۲۶ ۲۲:۱۰):
// بلوکِ تازه در شناسنامه باید بی‌ریلود دیده شود — پرسشِ دوباره بعد از ۳۰ ثانیه.
// اجرا: node Doc/abzar/test_gloss_taze.cjs
// خرابکاری: شرط را به `GLOSS.asked === SESSION.sid` برگردان ⇒ تستِ ۳ قرمز می‌شود.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'claude-ui-buttons.js').split('\n');
const lines = fs.readFileSync(path.join(__dirname, '..', '..', 'claude-ui-buttons.js'), 'utf8').split('\n');
const start = lines.findIndex((l) => l.includes('var GLOSS_TAZE_MS'));
if (start < 0) { console.error('FAIL GLOSS_TAZE_MS پیدا نشد'); process.exit(1); }
let end = -1;
for (let i = start; i < lines.length; i++) if (lines[i].trim() === '}' && i > start + 4) { end = i; break; }
const body = lines.slice(start, end + 1).join('\n');

function make() {
  const posted = [];
  let now = 1000000;
  const window = { acquireVsCodeApi: Object.assign(function () { return { postMessage: (m) => posted.push(m) }; }, { __crtl: true }) };
  const SESSION = { sid: 'sid-1', channel: '' };
  const GLOSS = { asked: '', askedAt: 0 };
  const DateStub = { now: () => now };
  const fn = new Function('window', 'SESSION', 'GLOSS', 'Date', body + '\nreturn gloss_darkhast;')(window, SESSION, GLOSS, DateStub);
  return { fn, posted, tick: (ms) => { now += ms; } };
}

let bad = 0;
const t = (name, ok) => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + name); };

let h = make();
h.fn();
t('۱ پرسشِ اول ⇒ یک پیام', h.posted.length === 1);
h.fn();
t('۲ بی‌درنگ ⇒ پیامِ دوم نمی‌رود', h.posted.length === 1);
h.tick(31000);
h.fn();
t('۳ بعد از ۳۱ ثانیه ⇒ دوباره می‌پرسد', h.posted.length === 2);

let h2 = make();
h2.tick(10000);
h2.fn();
t('۴ کمتر از ۳۰ ثانیه بعد از سشنِ دیگر ⇒ همان یک پیام', h2.posted.length === 1);

console.log('جمع: ' + (bad ? bad + ' قرمز' : 'سبز'));
process.exit(bad ? 1 : 0);
