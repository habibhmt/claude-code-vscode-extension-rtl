// Deadline alarms for every reset reset_ha.mjs found (one <slug>.json per reset in abzar/alarm-reset.d):
// two banners and three «زدم / بعداً» windows before each deadline, to the Mac, this project's chat and (when
// abzar/bale-136.sh exists) Habib's phone. First built for the free full Claude reset (Habib, 11 Nov 2026
// 22:03: «چرا آلارم ندادی؟ که من استفاده بکنم از این ریست»; 22:04 «بزن»; 22:27 the 00:30 one: «بله، اضافه کن»),
// then for all of them (22:55: «بله، همین است»). Standard: definition 25 of 203.
// Run by com.habib.136.alarm-reset-majani every 30 min and at login. A stage whose time has passed and that
// has not fired fires once; of several missed ones only the latest speaks. «زدم» ⇒ that reset is silent.
//   test: RESET_ALAN=<epoch s> RESET_ALARM_DIR=<dir> RESET_KHOSHK=1 node abzar/alarm-reset.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const INJA = dirname(fileURLToPath(import.meta.url))
const DIR = process.env.RESET_ALARM_DIR || join(INJA, 'alarm-reset.d')
const KHOSHK = !!process.env.RESET_KHOSHK
const A203 = '/Users/habib/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar'
const CHAT = 'مجری -۱۳۶- ایمک -نیو'
const alan = +(process.env.RESET_ALAN || Math.floor(Date.now() / 1000))
// seconds before the deadline, kind. For a 01:30 deadline: a week before at 10:00, the last day at 10:00,
// then 20:00, 23:00 and 00:30
export const MARHALE = [[7 * 86400 + 55800, 'banner'], [55800, 'banner'], [19800, 'panjere'], [9000, 'panjere'], [3600, 'panjere']]

mkdirSync(DIR, { recursive: true })
const say = (s) => KHOSHK ? console.log(s) : appendFileSync(join(DIR, 'log'), `[${new Date().toISOString()}] ${s}\n`)
const ejra = (f, a) => { try { execFileSync(f, a, { timeout: 60000 }) } catch (e) { say(`❌ ${f.split('/').pop()}: ${String(e.message).slice(0, 160)}`) } }
const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
export function mande(s) {
  const r = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.round((s % 3600) / 60)
  return [r && `${fa(r)} روز`, h && `${fa(h)} ساعت`, !r && m && `${fa(m)} دقیقه`].filter(Boolean).join(' و ') || 'کمتر از یک دقیقه'
}
writeFileSync(join(DIR, 'akharin_ejra'), String(alan))

for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
  const paye = join(DIR, f.slice(0, -5))
  let e
  try { e = JSON.parse(readFileSync(join(DIR, f), 'utf8')) } catch (x) { say(`❌ ${f} خوانده نشد`); continue }
  if (existsSync(paye + '.zadam') || existsSync(paye + '.gozasht')) continue
  if (alan >= e.mohlat) {
    writeFileSync(paye + '.gozasht', '')
    say(`❌ ${e.nam}: مهلت گذشت (${e.mohlat_fa}) و «زدم» ثبت نشد`)
    if (!KHOSHK) ejra('/bin/zsh', [A203 + '/notif.sh', 'ریست سوخت', `${e.nam}: مهلت گذشت و «زدم» ثبت نشد`, 'KhabarNoskhe', 'reset-alarm'])
    continue
  }
  // the latest stage that is due and has not fired; the ones before it count as done
  let i = -1
  MARHALE.forEach(([pish], j) => { if (alan >= e.mohlat - pish && !existsSync(`${paye}.shod_${j + 1}`)) i = j })
  if (i < 0) continue
  for (let j = 0; j <= i; j++) writeFileSync(`${paye}.shod_${j + 1}`, '')
  const kind = MARHALE[i][1]
  const matn = `${e.nam}: ${mande(e.mohlat - alan)} مانده، تا ${e.mohlat_fa}.${i === MARHALE.length - 1 ? ' آخرین یادآور.' : ''}`
  say(`مرحلهٔ ${i + 1} (${kind}): ${matn}`)
  if (KHOSHK) continue
  ejra('/bin/zsh', [A203 + '/notif.sh', 'ریستِ مجانی', matn, 'KhabarNoskhe', 'reset-alarm', `open ${e.url}`])
  if (existsSync(join(INJA, 'bale-136.sh')) && i >= 1) ejra('/bin/zsh', [join(INJA, 'bale-136.sh'), `⏰ ${matn}\n${e.url}`])
  if (kind !== 'panjere') continue
  spawn('/bin/zsh', [A203 + '/alarm_be_saheb.sh', CHAT, `${matn} حبیب هنوز «زدم» نگفته.`], { detached: true, stdio: 'ignore' }).unref()
  // the window stays until 5 min before the next stage (the last one: before the deadline) and lives on its
  // own, so one reset's window never holds back another reset's alarm
  const ta = i + 1 < MARHALE.length ? e.mohlat - MARHALE[i + 1][0] : e.mohlat
  const sabr = Math.max(60, ta - alan - 300)
  spawn('/bin/zsh', ['-c', `j=$("$1" 'ریستِ مجانی' "$2" 'زدم=zadam|بعداً یادم بنداز=bad' "$3" 'صفحهٔ Usage ⇐ دکمهٔ Reset' "ltr:$4" 2>/dev/null); [[ $j == zadam ]] && : > "$5.zadam"; print -r -- "[$(date '+%F %T')] جوابِ پنجرهٔ $3: $j" >> "$6"`,
    'panjere', A203 + '/panjere_dokme', String(sabr), matn, e.url, paye, join(DIR, 'log')], { detached: true, stdio: 'ignore' }).unref()
}
