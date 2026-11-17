/**
 * sync-plus — تزریقِ کدِ خالص داخلِ client.js
 * نیمهٔ کلاینتِ DSH جز react چیزی را require نمی‌کند، پس توابعِ خالص باید درونِ خودِ client.js
 * باشند. این اسکریپت همان کد را بینِ نشانگرهای «#region» می‌ریزد تا دو نسخه از هم جدا نشوند
 * (همان الگوی dsh-side-panel/tools/sync-fold.mjs).
 *
 *   plus-pure.js     ⇒ منطقهٔ plus-inline     (دکمه‌ها، aA، نقل‌قول، …)
 *   settings-pure.js ⇒ منطقهٔ settings-inline (سه سطحِ تنظیم، امنیتِ مسیر و شناسه، جست‌وجو)
 *   tik-pure.js      ⇒ منطقهٔ tik-inline      (تبِ ابزارها: چهار دسته، سه سطح، پیش‌فرضِ چتِ تازه)
 *
 * اجرا: node tools/sync-plus.mjs          (می‌نویسد)
 *       node tools/sync-plus.mjs --check  (فقط بررسی؛ اختلاف ⇒ خروج با کدِ ۱)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const HERE = new URL('.', import.meta.url)
const CLIENT = new URL('../client.js', HERE)

/** یک ماژولِ خالص ⇒ بدنهٔ بی‌«export» با تورفتگیِ ۴ */
export function inlineModule(file) {
  return readFileSync(file, 'utf8')
    .replace(/^\/\*\*[\s\S]*?\*\/\n/m, '')
    .split('\n')
    .map(line => (line.startsWith('export ') ? line.slice('export '.length) : line))
    .map(line => (line.trim() === '' ? '' : '    ' + line))
    .join('\n')
    .trimEnd()
}

/** نشانگرِ آغاز/پایانِ یک منطقه در client.js */
/**
 * @param id نامِ منطقه
 * @returns {begin, end}
 */
function markers(id) {
  return {
    begin: '    /* #region ' + id,
    end: '    /* #endregion ' + id + ' */',
  }
}

export function inlinePlus() {
  const m = markers('plus-inline')
  return m.begin + ' — تولیدِ خودکار از plus-pure.js (tools/sync-plus.mjs) */\n'
    + inlineModule(new URL('../plus-pure.js', HERE)) + '\n' + m.end
}

export function inlineTik() {
  const m = markers('tik-inline')
  return m.begin + ' — تولیدِ خودکار از tik-pure.js (tools/sync-plus.mjs) */\n'
    + inlineModule(new URL('../tik-pure.js', HERE)) + '\n' + m.end
}

export function inlineSettings() {
  const m = markers('settings-inline')
  return m.begin + ' — تولیدِ خودکار از settings-pure.js (tools/sync-plus.mjs) */\n'
    + inlineModule(new URL('../settings-pure.js', HERE)) + '\n' + m.end
}

/** برچسب/شرحِ فارسیِ تنظیم‌های DSH، از locale/app-settings-fa.json درونِ client.js */
export function inlineLocale() {
  const m = markers('app-locale-inline')
  const json = readFileSync(new URL('../locale/app-settings-fa.json', HERE), 'utf8')
  const data = JSON.parse(json)
  const body = '    const APP_SETTINGS_LOCALE = ' + JSON.stringify(data, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : '    ' + line))
    .join('\n') + ';'
  return m.begin + ' — تولیدِ خودکار از locale/app-settings-fa.json (tools/sync-plus.mjs) */\n'
    + body + '\n' + m.end
}

/**
 * یک منطقه را عوض می‌کند؛ نبودِ نشانگرها خطا.
 * @param source متنِ client.js
 * @param id نامِ منطقه (plus-inline / settings-inline)
 * @param text بدنهٔ جایگزین (همراه با نشانگرها)
 */
function replaceRegion(source, id, text) {
  const { begin: beginMark, end: endMark } = markers(id)
  const begin = source.indexOf(beginMark)
  const end = source.indexOf(endMark)
  if (begin < 0 || end < 0 || end < begin) {
    throw new Error('markers of ' + beginMark.trim() + ' not found in client.js')
  }
  return source.slice(0, begin) + text + source.slice(end + endMark.length)
}

export function withInlinedPlus(clientSource = readFileSync(CLIENT, 'utf8')) {
  return replaceRegion(clientSource, 'plus-inline', inlinePlus())
}

/** هر سه منطقه: plus، settings و برچسب‌های فارسی */
export function withInlined(clientSource = readFileSync(CLIENT, 'utf8')) {
  return replaceRegion(replaceRegion(replaceRegion(replaceRegion(clientSource, 'plus-inline', inlinePlus()), 'settings-inline', inlineSettings()), 'tik-inline', inlineTik()), 'app-locale-inline', inlineLocale())
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const current = readFileSync(CLIENT, 'utf8')
  const next = withInlined(current)
  if (process.argv.includes('--check')) {
    if (current !== next) { console.error('sync-plus: client.js با plus-pure.js/settings-pure.js/tik-pure.js یکی نیست — node tools/sync-plus.mjs را بزن'); process.exit(1) }
    console.log('sync-plus: هم‌خوان است')
  } else if (current === next) console.log('sync-plus: از قبل هم‌خوان بود')
  else { writeFileSync(CLIENT, next); console.log('sync-plus: ' + (next.length - current.length) + ' کاراکتر تغییر کرد') }
}
