/**
 * sync-fold — تزریقِ panel-fold.js داخلِ client.js
 * ------------------------------------------------
 * نصفِ کلاینتِ DSH نمی‌تواند پکیجِ محلی را require کند (فقط `react` در module table
 * است)، پس توابعِ خالص باید **درونِ خودِ client.js** باشند. این اسکریپت همان کد را
 * بینِ دو نشانگر می‌ریزد تا دو نسخه از هم جدا نشوند.
 *
 * اجرا: node tools/sync-fold.mjs          (می‌نویسد)
 *       node tools/sync-fold.mjs --check  (فقط بررسی می‌کند؛ اختلاف ⇒ خروج با کدِ ۱)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const HERE = new URL('.', import.meta.url)
const FOLD = new URL('../panel-fold.js', HERE)
const CLIENT = new URL('../client.js', HERE)

const BEGIN = '    /* #region fold-inline'
const END = '    /* #endregion fold-inline */'

/** نسخهٔ قابلِ تزریق: `export ` حذف می‌شود و توابع با indentationِ کلاینت می‌آیند. */
export function inlineFold() {
  const source = readFileSync(FOLD, 'utf8')
  const body = source
    .replace(/^\/\*\*[\s\S]*?\*\/\n/m, '') // سرصفحهٔ ماژول
    .split('\n')
    .map(line => (line.startsWith('export ') ? line.slice('export '.length) : line))
    .map(line => (line.trim() === '' ? '' : `    ${line}`))
    .join('\n')
    .trimEnd()
  return `${BEGIN} — تولیدِ خودکار از panel-fold.js (tools/sync-fold.mjs) */\n${body}\n${END}`
}

/** متنِ کاملِ client.js با ناحیهٔ تازه‌سازی‌شده. */
export function withInlinedFold(clientSource = readFileSync(CLIENT, 'utf8')) {
  const begin = clientSource.indexOf(BEGIN)
  const end = clientSource.indexOf(END)
  if (begin < 0 || end < 0 || end < begin) throw new Error('markers of fold-inline not found in client.js')
  return clientSource.slice(0, begin) + inlineFold() + clientSource.slice(end + END.length)
}

/** آیا این فایل مستقیم اجرا شده (نه import شده)؟ */
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
const isCheck = process.argv.includes('--check')
if (isMain) {
const current = readFileSync(CLIENT, 'utf8')
const next = withInlinedFold(current)

if (isCheck) {
  if (current !== next) {
    console.error('sync-fold: client.js با panel-fold.js یکی نیست — node tools/sync-fold.mjs را بزن')
    process.exit(1)
  }
  console.log('sync-fold: هم‌خوان است')
} else {
  if (current === next) {
    console.log('sync-fold: از قبل هم‌خوان بود')
  } else {
    writeFileSync(CLIENT, next)
    console.log(`sync-fold: ${next.length - current.length} کاراکتر تزریق شد`)
  }
}
}
