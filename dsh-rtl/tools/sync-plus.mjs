/**
 * sync-plus — تزریقِ plus-pure.js داخلِ client.js
 * نیمهٔ کلاینتِ DSH جز react چیزی را require نمی‌کند، پس توابعِ خالص باید درونِ خودِ client.js
 * باشند. این اسکریپت همان کد را بینِ دو نشانگر می‌ریزد تا دو نسخه از هم جدا نشوند
 * (همان الگوی dsh-side-panel/tools/sync-fold.mjs).
 *
 * اجرا: node tools/sync-plus.mjs          (می‌نویسد)
 *       node tools/sync-plus.mjs --check  (فقط بررسی؛ اختلاف ⇒ خروج با کدِ ۱)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const HERE = new URL('.', import.meta.url)
const PURE = new URL('../plus-pure.js', HERE)
const CLIENT = new URL('../client.js', HERE)

const BEGIN = '    /* #region plus-inline'
const END = '    /* #endregion plus-inline */'

export function inlinePlus() {
  const body = readFileSync(PURE, 'utf8')
    .replace(/^\/\*\*[\s\S]*?\*\/\n/m, '')
    .split('\n')
    .map(line => (line.startsWith('export ') ? line.slice('export '.length) : line))
    .map(line => (line.trim() === '' ? '' : '    ' + line))
    .join('\n')
    .trimEnd()
  return BEGIN + ' — تولیدِ خودکار از plus-pure.js (tools/sync-plus.mjs) */\n' + body + '\n' + END
}

export function withInlinedPlus(clientSource = readFileSync(CLIENT, 'utf8')) {
  const begin = clientSource.indexOf(BEGIN)
  const end = clientSource.indexOf(END)
  if (begin < 0 || end < 0 || end < begin) throw new Error('markers of plus-inline not found in client.js')
  return clientSource.slice(0, begin) + inlinePlus() + clientSource.slice(end + END.length)
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const current = readFileSync(CLIENT, 'utf8')
  const next = withInlinedPlus(current)
  if (process.argv.includes('--check')) {
    if (current !== next) { console.error('sync-plus: client.js با plus-pure.js یکی نیست — node tools/sync-plus.mjs را بزن'); process.exit(1) }
    console.log('sync-plus: هم‌خوان است')
  } else if (current === next) console.log('sync-plus: از قبل هم‌خوان بود')
  else { writeFileSync(CLIENT, next); console.log('sync-plus: ' + (next.length - current.length) + ' کاراکتر تغییر کرد') }
}
