// حدس: «دو جمله» is Sonnet 5.5 on the last messages, after each answer and (braked) after
// tools: cheap. The 3-5 guesses are one fork of the chat itself (its own model, the whole chat
// from the warm cache) every hads_har_chand_javab answers; Sonnet is their fallback. Each guess is a
// button above the prompt; a click fills the prompt box and never sends.
export const model_do_jomle_va_hads = 'claude-sonnet-5-5'
// Habib: «حدسو بذار مدل اصلی بکنه … منتها مثلاً چند تا پیام به چند تا پیام»
export const hads_har_chand_javab = 3
// answers seen per chat id since this process started: guesses are due on 1st, 4th, 7th…
const tedad_javab_har_chat = new Map()

const prompt_system_hads = [
  'You predict what the user (حبیب) will ask next in a Claude Code session.',
  'Give 1 or 2 items: what the user will most likely ask next, or an option the user has not',
  'thought of but that fit the user\'s pattern. Each item is ready to send as the user\'s own message,',
  'in plain Persian, in the user\'s tone. Reply ONLY with JSON: [{"label": "<= 3 words", "text": "<one line>"}].',
].join(' ')

let hads_akhar = []
// «نکرده‌ها» (Habib, 25 Oct 04:22: «چه کارایی حبیب بهت گفته و نکردی و مثل حدس دو تا توی هر دفعه
// داده بشه»): what he asked in this chat that is still not done, two each time, made with the guesses
let nakarde_akhar = []
// the «نکرده» rows a check found done (its file or a commit says so): not in the list, but one small
// line counts them and opens them, so a loose check never hides real work for good (۲۰۵, 25 Oct 19:17)
let nakarde_ba_sanad_akhar = []
let nakarde_ba_sanad_baz = false
// «خودکار» (Habib, 25 Oct 16:48: «کارهایی که خود مدل میتونه انجام بده … جوری که مدل هی نخواد از من
// بپرسه … به تعداد هیچ محدود نباشه»): of the work now running in this chat, what the model can do
// by itself with its tools instead of asking Habib, and how; made with the guesses, in the same fork
let khodkar_akhar = []
let cron_akhar = []
let hads_dar_kar = false
// the chat the guesses were made in: after /clear (a new id) they are not shown
let hads_baraye_chat = ''

// «دو جمله»: what the agent is doing now, in Habib's words (the project's 00_vazhe_name.md),
// after each answer and, at most every do_jomle_fasele_ms ms, after a tool. One call at a time.
export const do_jomle_fasele_ms = 60000
// over this many tokens of chat even a warm fork costs too much: Sonnet on the last messages
export const had_fork_context_token = 400000
// idle longer than this and the chat's cache is likely gone: «پرسش» warns first. The TTL is
// 1 h (Claude Code says so: «Prompt cache warm, about 58 min left»); a model switch tells
// the real one (classic.PostModelSwitch cache_ttl), a 5 min TTL makes it cache_sard_5m_ms.
export const cache_sard_ms = 55 * 60000
export const cache_sard_5m_ms = 4 * 60000
let cache_sard_bad_az_ms = cache_sard_ms
const prompt_system_do_jomle = [
  'In exactly two short sentences of plain Persian, tell حبیب what the agent in this Claude Code',
  'session is doing right now and what it is waiting for. Use the words of the glossary given, not',
  'technical terms. Do not guess what comes next. Reply with the two sentences only.',
].join(' ')
let do_jomle_akhar = { text: '', for: '' }
let do_jomle_dar_kar = false
let do_jomle_dobare = false
let zaman_do_jomle_akhar = 0
// the end of an answer wins over a mid-work line still on its way
let zaman_akhar_javab = 0
let akhar_javab_dar_kar = false
// an answer that ends while the last one is still told is told right after it, never dropped
let akhar_javab_dobare = false
// last time the chat itself talked to the model (an answer's end, a tool): the cache's age
let zaman_akharin_kar = 0
// set by classic.SessionStart on a resume: Claude Code's own word that the cache is gone
let cache_sard_shod = false
// a «پرسش» that came before the fork had anything to read (resume, a turn still running):
// asked by itself when the next answer ends
let porsesh_montazer = null
// «بپرس»: a side question like /btw, answered by $.model.fork; never reaches the chat
let javab_porsesh = null
let matn_porsesh = ''
// «پرسش» with Habib's saved prompts (26 Oct 05:41: «اون بپرس یه قسمت پرومپت هم داشته باشه که توش بتونم متن بزارم
// و بشه یک دکمه … دکمه ادیت و ذخیره هم داشته باشه … اون سوالی که از مدل با کش گرم میپرسیم با این پرومپت پرسیده بشه»;
// 05:44: «چند دکمه باشه و روی دکمه علامت ضربدر و ادیت باشه که زیاد بزرگ نشه و کلا یه علامت + برای اضافه کردن پرومپت»).
// The list is the same in every chat (~/.claude/hads-prompt-ha.json); which one is on, per chat
let prompt_ha = null
const prompt_entekhab_har_chat = new Map()
let prompt_virayesh = null

export function khandan_hads(raw) {
  try {
    const m = String(raw || '').match(/\[[\s\S]*\]/)
    const list = JSON.parse(m ? m[0] : raw)
    if (!Array.isArray(list)) return []
    return list
      .filter((g) => g && typeof g.label === 'string' && typeof g.text === 'string' && g.text.trim())
      .slice(0, 2)
      .map((g) => ({ label: g.label.trim().slice(0, 40), text: g.text.trim() }))
  } catch {
    return []
  }
}

const system_reminder_regex = /<system-reminder[\s\S]*?<\/system-reminder>/g
export const az_agent_digar = (t) => /<cross-session-message|^\s*Another Claude session sent a message/.test(t)
// what starts a turn but is not Habib's: a task's or another chat's message, or what Claude Code sends
// by itself after a compact or a resume (205, 25 Oct: «Continue from where you left off.» was logged as
// his request). Such a turn has no new word of his: the summary says so
export const matn_bi_harfe_habib = 'حرفِ تازه‌ای از حبیب نبود؛ ادامهٔ کارِ قبلی'
export const harf_habib = (t) => !t || az_agent_digar(t) || /^\s*(<task-notification|Continue from where you left off|This session is being continued)/.test(t) ? matn_bi_harfe_habib : t

// Labelled context: Habib's own words, Claude's answers, and other agents'
// messages kept apart, so guesses follow Habib and still know the story.
export function sakht_prompt(messages) {
  const cut = (s, n) => String(s).slice(0, n)
  const users = [], agents = []
  for (const m of messages) {
    if (m.role !== 'user' || !m.text) continue
    if (az_agent_digar(m.text)) { agents.push(m.text); continue }
    const own = m.text.replace(system_reminder_regex, '').trim()
    if (own) users.push(own)
  }
  const answers = messages.filter((m) => m.role === 'assistant' && m.text).slice(-5)
  return '## درخواست‌های حبیب (قدیمی به جدید)\n' +
    users.slice(-12).map((t, i) => (i + 1) + '. ' + cut(t, 1500)).join('\n') +
    '\n\n## جواب‌های کلود\n' + answers.map((m) => '- ' + cut(m.text, 1200)).join('\n') +
    '\n\n## پیامِ ایجنتِ دیگر، نه حبیب\n' + (agents.slice(-3).map((t) => '- ' + cut(t, 1200)).join('\n') || '(هیچ)')
}

// .remember handoffs of this project: now, today, last seven days.
async function handoff_ha($) {
  const dir = '.remember/'
  const read = async (f) => { try { return String(await $.fs.read(dir + f)).slice(0, 3000) } catch { return '' } }
  let today = ''
  try {
    const names = (await $.fs.list(dir)).map((x) => x.name).filter((n) => /^today-.*\.md$/.test(n) && !n.includes('.done')).sort()
    if (names.length) today = await read(names[names.length - 1])
  } catch {}
  const parts = [['الان', await read('now.md')], ['امروز', today], ['هفت روزِ اخیر', await read('recent.md')]]
    .filter(([, t]) => t.trim())
  return parts.length ? '## هندآف‌های این پروژه\n' + parts.map(([k, t]) => '### ' + k + '\n' + t).join('\n') : ''
}

async function hads_ba_sonnet($) {
  if (hads_dar_kar) return
  hads_dar_kar = true
  try {
    const r = await $.model.complete({
      model: model_do_jomle_va_hads, system: prompt_system_hads,
      // handoffs first, cached: they change rarely between answers
      prompt: [{ text: (await handoff_ha($)) || '(no handoff)', cache: true }, { text: sakht_prompt(await $.session.messages()) }],
      maxTokens: 600, timeoutMs: 60000,
    })
    hads_akhar = r.isAnswered ? khandan_hads(r.text) : []
    if (hads_akhar.length) await benevis_daftar($, 'hads', { rah: 'sonnet', hads_ha: hads_akhar.map((g) => g.text) })
    if (r.isAnswered) try { await $.store.set('kharj_akhar_hads_sonnet', r.usage) } catch {}
    if (r.isAnswered) await benevis_kharj($, 'hads', 'sonnet', r.usage)
    hads_baraye_chat = await $.session.id()
    $.ui.invalidate('ui.render')
  } catch {
    hads_akhar = []
  } finally {
    hads_dar_kar = false
  }
}

// only the parts ticked on are asked for: fewer output tokens
const prompt_fork_do_jomle = '"do_jomle": "<exactly two short sentences of plain Persian: what the agent in this chat is doing now and what it waits for, in حبیب\'s own words from the glossary below>"'
const prompt_fork_hads = '"hads": [1 or 2 of {"label": "<= 3 words", "text": "<one line, ready to send as حبیب\'s next message, in his tone>"}]'
// «نکرده‌ها»: the fork has read the whole chat, every tool's output included. Its rules come from two
// Sonnet audits of this chat (25 Oct 03:33): only Habib's own words; done means a tool proved it; his
// later word replaces the earlier; a promise not kept counts; other items first than last time
const prompt_fork_nakarde = () => '"nakarde": [all of them, 0 or more, each {"harf": "<حرفِ عینِ حبیب، حداکثر ۲۵ کلمه، بلندتر با … کوتاه>", "zaman": "<کی گفت، به وقتِ تهران: از مُهرِ ساعتِ پیامش مثلِ [01:03 +0330 -- habib] ⇒ ۲۵ اکت ۰۱:۰۳>", "chera": "<یک جملهٔ کوتاه: چرا هنوز انجام نشده، با مدرک از همین چت>", "shomare": <شمارهٔ همین کار از «دفترِ کارها» اگر همان کار است، حتی با کلمه‌های دیگر؛ کارِ تازه ⇒ نگذار>, "sanad": <همیشه بده اگر سنجیدنی است: {"file": "<مسیرِ کاملِ فایلی که اگر انجام شده بود این متن در آن بود>", "matn": "<آن متن، کوتاه و عیناً>"} یا {"git": "<مسیرِ کاملِ پوشهٔ پروژه>", "matn": "<کلمه‌ای که در پیامِ commit ِ آن کار می‌آمد>"} یا {"hast": "<مسیرِ کاملِ فایلی که فقط وقتی کار انجام شده وجود دارد، مثلاً عکس>"}؛ سنجیدنی نیست ⇒ {"dasti": true}>}]'
const ghaede_nakarde = (anjam, commit_ha = '', ferestade = [], daftar_kar = []) => (daftar_kar.length ? '\n\n«دفترِ کارها» (شماره ⇐ کار؛ کارِ همان را با همان شماره بیاور): ' + daftar_kar.map((k) => 'ک-' + k.sh + ': «' + k.harf + '»').join(' · ') : '') + '\n\n«nakarde» (نکرده‌ها): کلِ همین چت را از اول در حافظهٔ خودت مرور کن و همهٔ کارهایی را بیاور که حبیب خواست و هنوز انجام نشده، بی‌سقف. ' +
  '۱) فقط حرفِ خودِ حبیب. پیامِ ایجنتِ دیگر، system-reminder، task-notification و «Continue from where you left off» حرفِ حبیب نیست؛ حرفی از حبیب که ایجنتی عینش را نقل کرده حساب است. ' +
  '۲) «انجام شد» یعنی خروجیِ یک ابزار در همین چت ثابتش کرد (آزمونِ سبز، commit، فایلِ نوشته‌شده). «انجام می‌دهم» یا «منتظرِ …» انجام نیست. ' +
  '۳) حرفِ تازه‌ترِ حبیب جای حرفِ قدیمی‌اش را می‌گیرد؛ چیزی که بعداً رد یا عوض کرد، نکرده نیست. ' +
  '۴) قولی که به حبیب یا به ایجنتِ دیگر دادی و عمل نکردی («می‌پرسم»، «خبر می‌دهم»، «بعد از ریلود می‌زنم») هم نکرده است. ' +
  '۵) مهم‌ترین اول: آنچه حبیب رویش تأکید کرد، یا قدیمی‌تر و فراموش‌شده. ' +
  (anjam.length ? '۶) حبیب این‌ها را خودش «انجام شد» زد؛ هرگز دوباره نیاورشان، حتی با کلمه‌های دیگر: ' + anjam.map((x) => '«' + x + '»').join(' · ') + '. ' : '') +
  // Habib, 25 Oct 19:08, through ۲۰۵: «بله، بسازد» — a «نکرده» whose reason is stale (done outside this
  // chat, by a file or a commit) must not stay: the fork gives a check, the mod reads the file or the log
  '۷) چیزی که بیرون از این چت انجام شده هم نکرده نیست: حالِ امروزِ پروژه را از commit‌های زیر بخوان، و برای هر نکرده‌ای که با یک فایل یا commit سنجیدنی است sanad بده؛ پیش از نمایش، فایل یا git log خوانده می‌شود و اگر آن متن آنجا بود، آن ردیف نمی‌آید. ' +
  (commit_ha ? '\ncommit‌های اخیرِ این پروژه (تازه به قدیم):\n' + commit_ha + '\n' : '') +
  // Habib, 26 Oct 03:06: «اگه انجام نشدن به صورت نکرده بیان»: what the mod sent as «خودکار» is his ask too
  // 26 Oct 07:44: «مگر اینکه حبیب بگوید نه انوقت نکرده حذف شود یا دیده شود که کار انجام شده»
  (ferestade.length ? '۸) این «خودکار»ها را مودِ «حدس» به خواستِ حبیب به چت فرستاد و حکمِ خواستهٔ حبیب را دارند (استثنای قاعدهٔ ۱): هر کدام انجام نشده، در nakarde بیاور با harf = عینِ همین متن: ' + ferestade.map((x) => '«' + x + '»').join(' · ') + '. بهانهٔ ایجنت («الان نمی‌شود»، «منتظرِ ریلود/پنجره/…») آن را از نکرده بیرون نمی‌برد؛ فقط دو چیز بیرونش می‌برد: حبیب گفته باشد نه، یا انجام شدنش با خروجیِ یک ابزار دیده شود. ' : '') +
  'نامطمئن ⇒ نیاور. هیچ نبود ⇒ []. فارسیِ ساده، با واژه‌های حبیب.'
// Habib, 25 Oct 18:08: «منظورم کل ابزارهایی هست که توی کلود کد برای ایجنت ها موجوده. و این ابزارها
// باید سرچ به وب بکنی که لیست کاملش رو در بیاری و توی پرومپتت بیاری که ایجنت چک بکنه و بررسی بکنه و
// پیشنهاداشو بده». The built-in tools as code.claude.com/docs/en/tools-reference lists them (read 25 Oct
// 2026), then the MCP ones and this Mac's own ways (Habib's rules: computer use only by ۲۰۳, each agent its own Chrome)
export const abzar_ha_ye_claude_code = [
  ['Agent', 'ساب‌ایجنت با کانتکستِ جدا برای یک کار (پیش‌فرض Sonnet؛ تعداد و مدل با اجازهٔ حبیب)'],
  ['Bash', 'هر فرمانِ شل: آزمون، اسکریپت، git، curl، شبیه‌سازِ iOS (xcrun simctl)، launchd و crontab، عکسِ پنجره بی‌جلوآوردن (screencapture -x -o -l)'],
  ['Read', 'خواندنِ فایل، عکس و PDF'],
  ['Write', 'ساختن یا بازنویسیِ فایل'],
  ['Edit', 'ویرایشِ دقیقِ فایل'],
  ['NotebookEdit', 'ویرایشِ سلولِ Jupyter'],
  ['Glob', 'پیدا کردنِ فایل با الگو'],
  ['Grep', 'گشتن در متنِ فایل‌ها'],
  ['LSP', 'تعریف، ارجاع و خطای تایپِ کد از language server'],
  ['WebSearch', 'سرچِ وب'],
  ['WebFetch', 'خواندنِ یک صفحهٔ وب'],
  ['Monitor', 'فرمانی در پس‌زمینه که هر خطِ خروجی‌اش (لاگ، تغییرِ فایل، وضعیت، پیامِ WebSocket) به ایجنت می‌رسد'],
  ['CronCreate، CronList، CronDelete', 'کارِ زمان‌دار یا تکراری در همین چت'],
  ['ScheduleWakeup', 'نوبتِ بعدیِ /loop را خودِ ایجنت تعیین می‌کند'],
  ['RemoteTrigger', 'کارِ زمان‌دارِ ابری روی claude.ai (/schedule)'],
  ['PushNotification', 'خبر به دسکتاپ و گوشیِ حبیب وقتی کارِ طولانی تمام شد'],
  ['SendUserFile', 'فرستادنِ فایل، گزارش یا عکس به دستگاهِ حبیب'],
  ['SendMessage، ListAgents', 'پیام به ایجنتِ دیگر یا چتِ دیگرِ همین مک (۲۰۳ برای کامپیوتر یوز، منشی برای کروم)'],
  ['TaskCreate، TaskGet، TaskList، TaskUpdate، TaskStop', 'فهرستِ کارها و توقفِ کارِ پس‌زمینه'],
  ['Workflow', 'چند ساب‌ایجنت با هم در پس‌زمینه (فقط با خواستِ صریحِ حبیب)'],
  ['Skill', 'اجرای اسکیل، مثلاً chrome-cdp، nazer، remember'],
  ['ToolSearch، WaitForMcpServers', 'بار کردنِ ابزارهای پنهان و صبر برای سرورِ MCP'],
  ['ListMcpResourcesTool، ReadMcpResourceTool', 'خواندنِ منابعِ سرورهای MCP'],
  ['EnterWorktree، ExitWorktree', 'کار روی کپیِ جدای git'],
  ['EnterPlanMode، ExitPlanMode', 'نقشه پیش از کد'],
  ['Artifact', 'صفحهٔ HTML روی claude.ai برای دیدن یا فرستادن'],
  ['AskUserQuestion', 'پنجرهٔ سؤال؛ فقط برای تصمیمی که واقعاً مالِ حبیب است'],
  ['ReportFindings، SendFeedback، ShareOnboardingGuide، SubagentHandback، TodoWrite، PowerShell، EndConversation', 'ابزارهای خاص؛ کم لازم می‌شوند'],
  ['کامپیوتر یوز (MCP)', 'دیدنِ صفحهٔ مک، کلیک و تایپ در اپ‌ها و دیدنِ نتیجه با عکس؛ قانونِ حبیب: فقط ۲۰۳ ⇒ با SendMessage به ۲۰۳'],
  ['کرومِ CDP ِ خودِ ایجنت (اسکیلِ chrome-cdp)', 'سایت در تبِ پس‌زمینه، کلیک، خواندنِ متنِ صفحه، عکس با Page.captureScreenshot؛ پنجره هرگز جلو نیاید؛ کرومِ بی‌پنجره فقط برای آزمون'],
  ['Claude in Chrome (/chrome) و مرورگرِ داخلی', 'مرورگر با لاگینِ خودِ حبیب: فرم، کنسول، ضبطِ GIF'],
  ['hook و mod', 'کاری که خودکار پیش یا پس از هر ابزار یا پیام اجرا شود (settings.json)'],
  ['سرچ در چت‌های قبلی', 'python3 ~/1-MY-WORK/205th-day-mother-of-all-agent/abzar/hafeze_search.py --hame "<سؤال>" 5 ⇒ حبیب در موردِ مشابه چه گفت'],
]
const prompt_fork_khodkar = '"khodkar": [all of them, 0 or more, each {"kar": "<کاری که الان در این چت جاری است و ایجنت آن را از حبیب می‌پرسد یا به او می‌سپارد، کوتاه>", "abzar": "<کدام ابزار از فهرست، دقیق: اسمِ ابزار و فرمان یا مسیر>", "chek": "<ایجنت نتیجه را خودش چطور می‌بیند و می‌سنجد>", "chera": "<یک جملهٔ کوتاه: چرا لازم نیست از حبیب بپرسد>"}]'
const ghaede_khodkar = (ferestade = []) => '\n\n«khodkar» (خودکار): این فهرستِ کاملِ ابزارهای ایجنت در Claude Code است (code.claude.com/docs/en/tools-reference، خوانده‌شده ۲۵ اکت ۲۰۲۶):\n' +
  abzar_ha_ye_claude_code.map(([n, t]) => '- ' + n + ': ' + t).join('\n') + '\n' +
  'یکی‌یکی چک و بررسی کن: در کارهایی که الان در همین چت جاری است، کدام ابزار کاری را که ایجنت از حبیب می‌پرسد یا به او می‌سپارد («چک کن به من بگو»، «امتحان کن»، «ببین درست است؟»، «ریلود کن و عکس بفرست») خودش انجام می‌دهد و نتیجه‌اش را خودش چک می‌کند. پیشنهادهایت را بده، بی‌سقف. ' +
  'ابزاری که در این چت استفاده نشده و کار را عقب انداخته، اول بیاید. پیش از هر تصمیم، سرچ در چت‌های قبلی برای حرفِ حبیب در موردِ مشابه و تصمیم طبقِ همان حرف؛ مثلاً برای چکِ یک اپ، اول پیدا کن اپ مالِ کدام پروژه است و حبیب قبلاً درباره‌اش چه گفته. ' +
  'نیاور: رمز، کدِ پیامکی، پول، کارِ دست یا تنِ حبیب، و چیزی که قانونِ حبیب صریحاً با او گذاشته. نامطمئن ⇒ نیاور. هیچ نبود ⇒ []. فارسیِ ساده، با واژه‌های حبیب.' +
  // Habib, 26 Oct 07:44: «اتفاقا این رو برای همین میخوام که مدل منتظر نمونه و یه راه حلی پیدا کنه براش نه اینکه با منتظر بودن
  // کار رو به تعویق بندازه — به مدل بگو بهونه های مدل رو سعی کنه براش یه راهکاری پیذا کنه از کارهای قبلی و تجارب قبلی و با
  // راهکار جدید تاکید کنه به انجام کار مگه با دستورر مخالف حبیب»
  (ferestade.length ? '\nاین‌ها را قبلاً به چت فرستادی (کار ⇐ راه): ' + ferestade.map((x) => '«' + x + '»').join(' · ') + '. همان کار با همان راه را دوباره نساز، حتی با کلمه‌های دیگر. ' : '\n') +
  'بهانه، راهکار می‌خواهد نه صبر: اگر ایجنت کاری را نکرد و بهانه آورد («الان نمی‌شود»، «منتظرِ ریلود / جلو آمدنِ پنجره / حبیب / تمام شدنِ کارِ پس‌زمینه»)، منتظر نمان؛ از کارها و تجربه‌های قبلیِ همین چت و چت‌های قبلی (سرچ در چت‌های قبلی) برای همان بهانه راهکار پیدا کن، مثلاً ایجنتِ دیگری که آن ابزار را دارد (کامپیوتر یوز ⇐ ۲۰۳)، و همان کار را با راهِ تازه بیاور؛ در chera بنویس بهانه چه بود و چرا راهِ تازه از پسش برمی‌آید. فقط اگر حبیب صریحاً خلافش را گفته، نیاور.'
// «کرون‌جاب» (Habib, 25 Oct 16:52: «کرون جا درست کنه … با توجه به اون کارایی که من مشخص میکنم اون
// کاراییش که میخوره»): of the work Habib named, what fits a job that runs by itself on a schedule
const prompt_fork_cron = '"cron": [all of them, 0 or more, each {"kar": "<کاری که حبیب در این چت مشخص کرد و به کرون‌جاب می‌خورد>", "zaman": "<کی اجرا شود، به فارسی و با عبارتِ cron، مثلاً هر روز ۰۸:۰۰ (0 8 * * *)>", "rah": "<با چه ساخته شود: launchd، crontab، یا CronCreate/schedule ِ Claude Code، و فرمانش>"}]'
const ghaede_cron = '\n\n«cron» (کرون‌جاب): از میانِ کارهایی که حبیب در همین چت مشخص کرد، هر کدام که تکراری است یا باید سرِ وقت یا هر چند وقت خودش اجرا یا چک شود (چکِ نسخه، نگهبان، گزارشِ روزانه، پاک کردنِ دفتر، …)، بی‌سقف. کرون‌جابی که در همین چت ساخته شده و کار می‌کند نیاور. نامطمئن ⇒ نیاور. هیچ نبود ⇒ [].'
const prompt_fork_bakhsh_ha = (p, anjam) => [p.do_jomle && prompt_fork_do_jomle, p.hads && prompt_fork_hads, p.nakarde && prompt_fork_nakarde(), p.khodkar && prompt_fork_khodkar, p.cron && prompt_fork_cron].filter(Boolean)
const ghaede_bakhsh_ha = (p, anjam) => (p.nakarde ? ghaede_nakarde(anjam, p.commit_ha, p.khodkar_ferestade || [], p.daftar_kar || []) : '') + (p.khodkar ? ghaede_khodkar(p.khodkar_rah || []) : '') + (p.cron ? ghaede_cron : '')
const prompt_fork = (p, anjam = []) => '(این پیام از مودِ «حدس» است، نه از حبیب؛ کاری نکن و ابزاری صدا نزن.) Reply ONLY with JSON: {' +
  prompt_fork_bakhsh_ha(p, anjam).join(', ') + '}' + ghaede_bakhsh_ha(p, anjam)

// «نکرده‌ها» from the fork's reply: all of them (Habib, 25 Oct 04:53: «محدودیت نداشته باشن تعدادشون»),
// each with Habib's words, when, and why
// the fork says `shomare`; what this mod saved to the chat's file says `sh` (28 Oct 02:52: after a reload
// the numbers were gone, «چرا توی ورژن جدیدت نکرده ها بدون شماره شدن ؟»)
export function khandan_nakarde(list) {
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && typeof x.harf === 'string' && x.harf.trim() && typeof x.chera === 'string')
    .map((x) => ({ harf: x.harf.trim(), zaman: typeof x.zaman === 'string' ? x.zaman.trim() : '', chera: x.chera.trim(), ...(x.khodkar === true ? { khodkar: true } : {}), ...(khandan_sanad(x.sanad) ? { sanad: khandan_sanad(x.sanad) } : {}), ...(Number.isInteger(x.shomare ?? x.sh) && (x.shomare ?? x.sh) > 0 ? { sh: x.shomare ?? x.sh } : {}), ...(x.sanad?.dasti === true || x.dasti === true ? { dasti: true } : {}) }))
}
// a check the mod can run itself: an absolute file that would hold the text, or a project whose commit
// messages would; anything else is no check
export const had_kamtarin_harf_sanad = 8
export function khandan_sanad(x) {
  if (x && typeof x.hast === 'string' && x.hast.startsWith('/')) return { hast: x.hast }
  if (!x || typeof x !== 'object' || typeof x.matn !== 'string' || !x.matn.trim()) return null
  const matn = x.matn.trim().slice(0, 200)
  // a word that short is in too many files to prove anything ("dayere", "on")
  if ([...matn].length < had_kamtarin_harf_sanad) return null
  if (typeof x.file === 'string' && x.file.startsWith('/')) return { file: x.file, matn }
  if (typeof x.git === 'string' && x.git.startsWith('/')) return { git: x.git, matn }
  return null
}
async function sanad_dare($, sanad) {
  if (!sanad) return false
  try {
    if (sanad.hast) return (await $.process.run(['test', '-e', sanad.hast], { timeoutMs: 5000 })).exitCode === 0
    if (sanad.file) return (await $.process.run(['grep', '-F', '-q', '--', sanad.matn, sanad.file], { timeoutMs: 5000 })).exitCode === 0
    const r = await $.process.run(['git', '-C', sanad.git, 'log', '-200', '--format=%s%n%b'], { timeoutMs: 5000 })
    return r.exitCode === 0 && String(r.stdout || '').includes(sanad.matn)
  } catch {
    return false
  }
}
// the project's last commits, newest first, for the fork to see what is done today
async function commit_ha_ye_akhir($) {
  try {
    const r = await $.process.run(['git', '-C', await $.session.root(), 'log', '-20', '--date=format:%m-%d %H:%M', '--format=%h %ad %s'], { timeoutMs: 5000 })
    return r.exitCode === 0 ? String(r.stdout || '').trim().slice(0, 4000) : ''
  } catch {
    return ''
  }
}
// «خودکار» from the fork's reply: all of them, each with the work, the tool, how the agent checks it, and why not to ask
export function khandan_khodkar(list) {
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && typeof x.kar === 'string' && x.kar.trim() && typeof x.abzar === 'string' && x.abzar.trim())
    .map((x) => ({ kar: x.kar.trim(), abzar: x.abzar.trim(), chek: typeof x.chek === 'string' ? x.chek.trim() : '', chera: typeof x.chera === 'string' ? x.chera.trim() : '' }))
}
export function khandan_cron(list) {
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && typeof x.kar === 'string' && x.kar.trim() && typeof x.zaman === 'string' && x.zaman.trim())
    .map((x) => ({ kar: x.kar.trim(), zaman: x.zaman.trim(), rah: typeof x.rah === 'string' ? x.rah.trim() : '' }))
}
// «دفترِ کارها» (Habib 27 Oct 18:30: «یه کد عددی تعریف کنی … یه تغییر کوچیک کلمه باعث نشه که اون از انجام شدش
// تیک نخوره»; window «بله، بنویس», 18:51 «بزن همه رو»): every «نکرده» keeps one number for good, in
// ~/.claude/hads-log/<id>.kar_daftar.json; the number, not the words, carries its check and Habib's «انجام شد»
export function shomare_dadan(list, daftar) {
  const d = { akhar: daftar?.akhar || 0, kar: Array.isArray(daftar?.kar) ? daftar.kar.map((k) => ({ ...k })) : [] }
  const out = list.map((x) => {
    let k = (x.sh && d.kar.find((y) => y.sh === x.sh)) || d.kar.find((y) => y.harf === x.harf || hamun_matn(y.harf, x.harf))
    if (!k) { k = { sh: ++d.akhar, harf: x.harf }; d.kar.push(k) }
    if (x.sanad) k.sanad = x.sanad
    return { ...x, sh: k.sh, ...(!x.sanad && k.sanad ? { sanad: k.sanad } : {}) }
  })
  return { list: out, daftar: d }
}
const masir_kar_daftar = async ($) => (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.kar_daftar.json'
async function khandan_kar_daftar($) {
  try { return JSON.parse(String(await $.fs.read(await masir_kar_daftar($)))) } catch { return { akhar: 0, kar: [] } }
}
async function neveshtan_kar_daftar($, d) {
  try { await $.fs.write(await masir_kar_daftar($), JSON.stringify(d) + '\n') } catch {}
}
// what Habib pressed «انجام شد» on, per chat (~/.claude/hads-log/<id>.nakarde_anjam_shod.jsonl): never
// shown again — the fork is told, and anything that says the same is dropped here too
const masir_nakarde_anjam = async ($) => (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.nakarde_anjam_shod.jsonl'
const nakarde_anjam_har_chat = new Map()
async function khandan_nakarde_anjam($) {
  const id = await $.session.id()
  if (!nakarde_anjam_har_chat.has(id)) {
    let list = []
    try { list = String(await $.fs.read(await masir_nakarde_anjam($))).split('\n').filter(Boolean).map((l) => JSON.parse(l).harf) } catch {}
    nakarde_anjam_har_chat.set(id, list)
  }
  return nakarde_anjam_har_chat.get(id)
}
export const hanuz_nakarde = (list, anjam) => list.filter((x) => !anjam.some((a) => (x.sh && a === 'ک-' + x.sh) || a === x.harf || hamun_matn(a, x.harf)))
async function anjam_shod_zadan($, harf, sh) {
  const anjam = await khandan_nakarde_anjam($)
  if (!anjam.includes(harf)) anjam.push(harf)
  if (sh && !anjam.includes('ک-' + sh)) anjam.push('ک-' + sh)
  nakarde_akhar = hanuz_nakarde(nakarde_akhar, anjam)
  $.ui.invalidate('ui.render')
  try {
    const line = JSON.stringify({ t: await $.clock.now(), harf }) + '\n' + (sh ? JSON.stringify({ t: await $.clock.now(), harf: 'ک-' + sh }) + '\n' : '')
    await $.process.run(['sh', '-c', 'mkdir -p "$(dirname "$1")" && cat >> "$1"', 'sh', await masir_nakarde_anjam($)], { stdin: line, timeoutMs: 5000 })
  } catch {}
  await benevis_daftar($, 'nakarde_anjam_shod', { harf })
}

// {do_jomle, hads, nakarde, khodkar} from the fork's reply; null when it has none
export function khandan_javab_fork(raw) {
  try {
    const m = String(raw || '').match(/\{[\s\S]*\}/)
    const o = JSON.parse(m ? m[0] : raw)
    const n = typeof o?.do_jomle === 'string' ? kutah_be_do_jomle(o.do_jomle) : ''
    const g = Array.isArray(o?.hads) ? khandan_hads(JSON.stringify(o.hads)) : []
    const nk = khandan_nakarde(o?.nakarde)
    const kh = khandan_khodkar(o?.khodkar)
    const cr = khandan_cron(o?.cron)
    return n || g.length || nk.length || kh.length || cr.length || Array.isArray(o?.nakarde) || Array.isArray(o?.khodkar) || Array.isArray(o?.cron) ? { do_jomle: n, hads: g, nakarde: nk, khodkar: kh, cron: cr } : null
  } catch {
    return null
  }
}

// $ per million tokens written to the cache (5 min, 1 h), for the cold «بپرس» warning
const gheymat_cache_neveshtan_usd = { 'opus-5-5': [5, 8], 'sonnet-5-5': [2.5, 4], 'haiku-5-5': [0.125, 0.2] }
export function kharj_cache_sard(model, tokens) {
  const k = Object.keys(gheymat_cache_neveshtan_usd).find((x) => String(model).includes(x)) || 'opus-5-5'
  return gheymat_cache_neveshtan_usd[k].map((p) => (tokens * p) / 1e6)
}

// «قبلی‌ها»: every «دو جمله» with its time, this chat only (~/.claude/hads-log/<id>.do_jomle_ghablia.jsonl,
// the last had_ghablia_tedad); newest first on screen
export const had_ghablia_tedad = 50
const masir_ghablia = async ($) => (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.do_jomle_ghablia.jsonl'
async function khandan_ghablia($) {
  try {
    return String(await $.fs.read(await masir_ghablia($))).split('\n').filter(Boolean).map((l) => JSON.parse(l)).reverse()
  } catch {
    return []
  }
}
// «دفترِ حدس» (with چتِ ۲۰۵, 24 Oct): every «دو جمله», guess, «پرسش» and what Habib did with a
// guess, one JSON line each in ~/.claude/hads-log/<id>.events.jsonl — no cap, appended, never
// read back here (a 4 MB read limit would cut a long chat). Their memory index reads it; only
// «پرسش» and a guess Habib sent go to search, never «دو جمله» or an unsent guess.
async function benevis_daftar($, kind, data) {
  try {
    const t = await $.clock.now(), sid = await $.session.id()
    const d = new Date(t + 3.5 * 3600e3)
    const iso = d.toISOString().replace('Z', '+03:30')
    const f = (await $.env.get('HOME')) + '/.claude/hads-log/' + sid + '.events.jsonl'
    const line = JSON.stringify({ t, iso, sid, kind, ...data }) + '\n'
    await $.process.run(['sh', '-c', 'mkdir -p "$(dirname "$1")" && cat >> "$1"', 'sh', f], { stdin: line, timeoutMs: 5000 })
  } catch {}
}
// a «دو جمله» that says what the last one said is not logged again (205: so the log stays readable)
export function hamun_matn(a, b) {
  const w = (x) => new Set(String(x || '').split(/\s+/).filter((y) => y.length > 1))
  const A = w(a), B = w(b)
  if (!A.size || !B.size) return false
  let n = 0; for (const x of A) if (B.has(x)) n++
  return n / Math.max(A.size, B.size) >= 0.8
}
// per chat id: one process may serve more than one chat (/clear makes a new id)
const do_jomle_akhar_dar_daftar = new Map()
// guesses pressed into the prompt box, to know at Enter which one Habib sent
let hads_zade_shode = []

// every «دو جمله» of the turn now running, per chat: the end of the answer sums them up
const do_jomle_ha_ye_nobat = new Map()
async function benevis_do_jomle($, text, kind = 'do_jomle') {
  const id = await $.session.id()
  if (kind === 'do_jomle') do_jomle_ha_ye_nobat.set(id, [...(do_jomle_ha_ye_nobat.get(id) || []), text].slice(-40))
  do_jomle_akhar = { text, for: id }; $.ui.invalidate('ui.render')
  if (kind !== 'jambandi_nobat' && !hamun_matn(text, do_jomle_akhar_dar_daftar.get(id))) { do_jomle_akhar_dar_daftar.set(id, text); await benevis_daftar($, 'do_jomle', { text }) }
  try {
    const old = (await khandan_ghablia($)).reverse().map((x) => JSON.stringify(x))
    await $.fs.write(await masir_ghablia($), old.slice(-(had_ghablia_tedad - 1)).concat(JSON.stringify({ t: await $.clock.now(), text })).join('\n') + '\n')
  } catch {}
}
// Tehran time (+03:30, no DST), as Habib writes dates: «۲۴ اکت ۱۸:۵۷»
const mah_miladi = ['ژان', 'فور', 'مار', 'آور', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپت', 'اکت', 'نوا', 'دسا']
const adad_farsi = (x) => String(x).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
export function zaman_miladi(t) {
  const d = new Date(t + 3.5 * 3600e3)
  const two = (x) => String(x).padStart(2, '0')
  return adad_farsi(d.getUTCDate()) + ' ' + mah_miladi[d.getUTCMonth()] + ' ' + adad_farsi(two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()))
}

// Whatever the model says, at most two sentences are shown. A sentence ends at . ! ? ؟
// followed by a space: the dot inside register.js or v2.10 ends nothing. Never past had_do_jomle_harf.
// Shamsi (Jalali) date and Tehran time, Persian digits: «۳ آبان ۱۴۰۵ ۲۰:۰۹». Habib: «اگر که
// ساعت تاریخ شمسی باشه چه بهتر». Tehran is +03:30 all year (no DST since 1401).
const mah_shamsi = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
export function tarikh_shamsi(gy, gm, gd) {
  const g = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const gy2 = gm > 2 ? gy + 1 : gy
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g[gm - 1]
  let jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053
  jy += 4 * Math.floor(days / 1461); days %= 1461
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365 }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return [jy, jm, jd]
}
export function zaman_shamsi(t) {
  if (!t) return ''
  const d = new Date(t + 3.5 * 3600e3)
  const [jy, jm, jd] = tarikh_shamsi(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0')
  return adad_farsi(jd + ' ' + mah_shamsi[jm - 1] + ' ' + jy + ' ' + hh + ':' + mm)
}

export const had_do_jomle_harf = 300
export function kutah_be_do_jomle(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?؟]) /).slice(0, 2).join(' ')
  return t.length > had_do_jomle_harf ? t.slice(0, had_do_jomle_harf - 1) + '…' : t
}

async function vazhe_name($) {
  for (const f of ['Doc/tarif/00_vazhe_name.md', 'doc/tarif/00_vazhe_name.md']) {
    try { return '## واژه‌نامهٔ حبیب\n' + String(await $.fs.read((await $.session.root()) + '/' + f)).slice(0, 6000) } catch {}
  }
  return '(no glossary: plain Persian)'
}

// Sonnet on the last three messages only: cheap enough to run every do_jomle_fasele_ms during work
// every model call of this chat, one JSON line each (~/.claude/hads-log/<id>.usage.jsonl,
// the last 500): the real cost per part, read by `hads-kharj`
// «تماس‌ها»: how many times this chat's «حدس» called a model, per part, in the last hour, the last 24 h and in
// all, for the small table left of the prompt box; opened big, every call with its tokens and dollars (Habib,
// 26 Oct 21:54: «تعداد تماسهای این … پلاگین حدس رو به تفکیک کارها … یک ساعت اخیر 24 ساعت اخیر کل تماسها …
// اگر بزرگش بکنم … کل ارتباطاتشو ریز بریز با مقدار مقادیر کامل»; «بله، فقط همین چت»; dollars only when big: «بله»).
// Read from the chat's own usage.jsonl; handed to the page as one hidden line the page draws (claude-ui-buttons.js).
// $ per million tokens: input, output, cache write, cache read (claude.com/pricing, as ۲۰۳'s ertebat_claude.py)
export const gheymat_tamas_usd = { sonnet: [2, 10, 2.5, 0.1], fork: [4, 20, 5, 0.2] }
export const had_tamas_riz = 300
export const neshane_amar = '\u2063AMAR'
const amar_cache = new Map()
export function hesab_amar(lines, now) {
  const bakhsh_ha_amar = ['do_jomle', 'hads', 'nakarde', 'khodkar', 'cron', 'jambandi_nobat', 'porsesh']
  const sefr = () => Object.fromEntries([...bakhsh_ha_amar, 'kol', 'usd'].map((k) => [k, 0]))
  const out = { saat: sefr(), ruz: sefr(), hame: sefr(), riz: [] }
  for (const x of lines) {
    const parts = String(x.bakhsh || 'hads').replace('jambandi_nobat', 'jambandi-nobat').split('_va_').map((k) => k.replace('jambandi-nobat', 'jambandi_nobat'))
    const dar = [out.hame, ...(now - x.t <= 24 * 3600e3 ? [out.ruz] : []), ...(now - x.t <= 3600e3 ? [out.saat] : [])]
    const u = x.usage || {}, g = gheymat_tamas_usd[x.rah] || gheymat_tamas_usd.fork
    const v = [u.input_tokens || 0, u.output_tokens || 0, u.cache_creation_input_tokens || 0, u.cache_read_input_tokens || 0]
    const usd = v.reduce((a, n, i) => a + n * g[i], 0) / 1e6
    for (const d of dar) { d.kol++; d.usd = +(d.usd + usd).toFixed(4); for (const k of parts) if (k in d) d[k]++ }
    out.riz.push({ t: x.t, b: parts, rah: x.rah, in: v[0], out: v[1], cw: v[2], cr: v[3], usd: +usd.toFixed(4) })
  }
  out.riz = out.riz.slice(-had_tamas_riz).reverse()
  return out
}
async function matn_amar($) {
  try {
    const f = (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.usage.jsonl'
    const now = await $.clock.now(), c = amar_cache.get(f)
    if (c && now - c.at < 15000) return c.matn
    let lines = []
    try { lines = String(await $.fs.read(f)).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter((x) => x && x.t) } catch {}
    const matn = neshane_amar + JSON.stringify(hesab_amar(lines, now))
    amar_cache.set(f, { at: now, matn })
    return matn
  } catch { return '' }
}

async function benevis_kharj($, bakhsh, rah, usage) {
  try {
    const f = (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.usage.jsonl'
    // appended, never read and rewritten: two calls ending together would each drop the other's line
    const line = JSON.stringify({ t: await $.clock.now(), bakhsh, rah, usage }) + '\n'
    await $.process.run(['sh', '-c', 'mkdir -p "$(dirname "$1")" && cat >> "$1"', 'sh', f], { stdin: line, timeoutMs: 5000 })
    amar_cache.delete(f); $.ui.invalidate('ui.render')
  } catch {}
}

// «دو جمله» reads the last three messages and, always, Habib's last two: deep in a long answer
// the last three are all the agent's, and his request was missing (24 Oct)
export function payam_ha_ye_akhar(msgs) {
  const last = msgs.slice(-3)
  const his = msgs.filter((m) => m.role === 'user' && m.text && !az_agent_digar(m.text) && m.text.replace(system_reminder_regex, '').trim()).slice(-2)
  return msgs.filter((m) => last.includes(m) || his.includes(m))
}

async function begu_do_jomle($, tool, force, viaFork = false) {
  // an answer's end while a mid-work line is on its way: told right after it, never dropped
  if (do_jomle_dar_kar) { if (force) do_jomle_dobare = true; return }
  const t = await $.clock.now()
  if (!force && t - zaman_do_jomle_akhar < do_jomle_fasele_ms) return
  do_jomle_dar_kar = true; zaman_do_jomle_akhar = t
  try {
    let done = false
    if (viaFork) {
      const r = await $.model.fork({ prompt: prompt_fork({ do_jomle: true }) + '\n\n' + (await vazhe_name($)) })
      const got = r.isAnswered ? khandan_javab_fork(r.text) : null
      if (r.isAnswered) await benevis_kharj($, 'do_jomle', 'fork', r.usage)
      // no early return: a queued answer-end line (nowAgain) must still be told below
      if (got?.do_jomle && zaman_akhar_javab <= t) { await benevis_do_jomle($, got.do_jomle, force ? 'akhar_javab' : 'do_jomle'); done = true }
    }
    if (!done) {
    const r = await $.model.complete({
      model: model_do_jomle_va_hads, system: prompt_system_do_jomle,
      prompt: [{ text: await vazhe_name($), cache: true },
        { text: sakht_prompt(payam_ha_ye_akhar(await $.session.messages())) + (tool ? '\n\n## ابزاری که همین الان تمام شد\n' + tool : '') }],
      maxTokens: 200, timeoutMs: 30000,
    })
    // an answer's end started after this call: its line stands
    if (r.isAnswered && zaman_akhar_javab <= t) {
      // only lines written during the work belong to the turn's summary, not the answer's last one
      await benevis_do_jomle($, kutah_be_do_jomle(r.text), force ? 'akhar_javab' : 'do_jomle')
      try { await $.store.set('kharj_akhar_do_jomle', r.usage) } catch {}
    }
    if (r.isAnswered) await benevis_kharj($, 'do_jomle', 'sonnet', r.usage)
    }
  } catch {} finally {
    do_jomle_dar_kar = false
  }
  if (do_jomle_dobare) { do_jomle_dobare = false; await begu_do_jomle($, '', true) }
}

// «زبان» (Habib, 28 Oct 02:20: «اگه مدل انگلیسی جواب داد تو جواب قبلیش بهش یاداوری کنه که فارسی
// حرف بزنه»): the last answer, without code and links, has more Latin letters than Persian ⇒ one
// reminder is sent. Never twice in a row: an English answer to the reminder itself is let go.
export const had_tedad_kamtarin_zaban_harf = 40
export const matn_yadavari_zaban = 'زبان (از مودِ «حدس»، نه از حبیب): جوابِ قبلی‌ات انگلیسی بود. از این به بعد فارسی جواب بده (اصطلاح و کد می‌تواند انگلیسی بماند). اگر جوابِ قبلی چیزِ مهمی داشت، همان را کوتاه به فارسی بگو.'
// only the prose is weighed: code, links, table rows and names like `variational.io` or `VAR-01`
// are left out (28 Oct 02:43: a Persian answer with a table of 40 domains was taken for English)
export function englisi_ast(text) {
  const t = String(text || '').replace(/```[\s\S]*?```|`[^`]*`|https?:\/\/\S+/g, '')
    .split('\n').filter((l) => !l.trim().startsWith('|')).join('\n')
    .split(/\s+/).filter((w) => !/[A-Za-z][._\/@\-:#]+[A-Za-z0-9]|[0-9]/.test(w)).join(' ')
  const fa = (t.match(/[\u0600-\u06FF]/g) || []).length, en = (t.match(/[A-Za-z]/g) || []).length
  return fa + en >= had_tedad_kamtarin_zaban_harf && en > fa
}
const zaban_yadavari_shod = new Map()
async function chek_zaban($) {
  try {
    const id = await $.session.id()
    const msgs = await $.session.messages()
    const akhar = [...msgs].reverse().find((m) => m.role === 'assistant' && m.text)
    const ghabli = zaban_yadavari_shod.get(id)
    zaban_yadavari_shod.set(id, false)
    if (!akhar || !englisi_ast(akhar.text) || ghabli) return
    zaban_yadavari_shod.set(id, true)
    await benevis_daftar($, 'zaban', { matn: String(akhar.text).slice(0, 200) })
    await $.prompt.submit({ text: matn_yadavari_zaban })
  } catch {}
}

async function chat_kuchak($) {
  try { return ((await $.session.usage()).context.tokens || 0) <= had_fork_context_token } catch { return false }
}

// The end of an answer. «دو جمله»: Sonnet on the last messages, every answer (cheap).
// The guesses: one fork over the whole chat (its own model, the cache this answer just
// warmed) every hads_har_chand_javab answers; a chat over had_fork_context_token, or no usable reply, asks Sonnet.
async function akhar_javab($, p = { hads: true, do_jomle: true }, force = false) {
  // the scope may have been changed elsewhere (a terminal, the file): the label is read again each answer
  khandan_dayere($).catch(() => {})
  if (!p.hads && !p.do_jomle && !p.nakarde && !p.khodkar && !p.cron) return
  if (akhar_javab_dar_kar) { akhar_javab_dobare = true; return }
  akhar_javab_dar_kar = true; zaman_akhar_javab = await $.clock.now()
  try {
    const id = await $.session.id()
    const seen = tedad_javab_har_chat.get(id) || 0
    tedad_javab_har_chat.set(id, seen + 1)
    // also due when this chat shows none (first answer, /clear, an empty or broken reply)
    // «نکرده‌ها» and «خودکار» come with the guesses, on the same answers
    const due = (p.hads || p.nakarde || p.khodkar || p.cron) && (force || seen % hads_har_chand_javab === 0 || hads_baraye_chat !== id || (p.hads && !hads_akhar.length))
    const pj = p.do_jomle ? await amade_jambandi($) : null
    const jambandi_shod = due ? await hads_ba_fork($, p, pj) : await jambandi($, pj)
    if (p.do_jomle && !jambandi_shod) await begu_do_jomle($, '', true)
    await ferestadan_khodkar($)
  } finally {
    akhar_javab_dar_kar = false
  }
  // turned off meanwhile: the queued run is dropped, never run on the old flags
  if (akhar_javab_dobare) { akhar_javab_dobare = false; const q = await khandan_file_chat($); if (q) await akhar_javab($, q) }
}

// The end of an exchange (Habib, 24 Oct 22:42: «دو جمله … عکس لحظه ای میگیره … جمع بندی نداره …
// بعد از رفت و برگشت کل اینا رو بده به … یه ایجنت با کشه گرم که … جمعبندی کنه»): one fork of the
// chat itself (warm cache: the answer was just sent) gets every «دو جمله» of this turn and says
// what was done and what was not. Shown in place of «دو جمله» and logged as jambandi_nobat.
// No tool and no line, or no usable reply: the plain Sonnet «دو جمله», as before. Any size of
// chat is summed up by its own fork (24 Oct 23:37): it is injected into later chats' memory.
// a turn is summed up when the agent did work in it: a tool ran, or «دو جمله» was written.
// (v7 asked for 2 lines; «دو جمله» comes at most once a minute, so most turns had 0-1 and the
// real chat ۲۰۳ never got one — 24 Oct 22:58)
export const had_kamtarin_do_jomle_jambandi = 1
// tools run in the turn now running, per chat
const abzar_ha_ye_nobat = new Map()
// Habib's own message that started the turn, per chat
const khaste_habib_nobat = new Map()
// the turn's summary and, when due, every other part (guesses, «نکرده‌ها», «خودکار», «کرون‌جاب») in
// ONE fork (Habib, 25 Oct 16:52: «همشون توی همین با یه مدل با یه دفعه انجام بشن نه هر کدوم یکی یه
// دفعه … اینطور نشه پنج‌تا بار از اون کش گرم استفاده بشه»)
const prompt_jambandi_nobat = (lines, tools, ezafe = null, anjam = []) => '(این پیام از مودِ «حدس» است، نه از حبیب؛ کاری نکن و ابزاری صدا نزن.) ' +
  'جمع‌بندیِ همین نوبت را بده؛ این جمع‌بندی به حافظهٔ چت‌های بعدی تزریق می‌شود، پس باید بی‌اشتباه باشد. ' +
  'منبع: کلِ همین نوبت در حافظهٔ خودت، از آخرین پیامِ حبیب تا حالا: پیامِ حبیب، هر فراخوانیِ ابزار و خروجی‌اش، و جوابت. ' +
  (lines.length ? 'این «دو جمله»‌ها وسطِ کار نوشته شده‌اند؛ فقط راهنما‌اند، منبع نیستند:\n' + lines.map((l, i) => (i + 1) + ') ' + l).join('\n') + '\n' : '') +
  (tools.length ? 'فهرستِ ابزارهای این نوبت (خروجی‌شان را از حافظهٔ خودت بخوان):\n' + tools.map((l) => '- ' + l).join('\n') + '\n' : '') +
  '\nقاعده‌ها: ' +
  '۱) در anjam_shod فقط چیزی که خروجیِ یک ابزار در همین نوبت ثابتش کرد، و ته هر کدام مدرکش بعد از «⇐» (مثلاً «نگهبان روشن است ⇐ pgrep: 36459»). ' +
  '۲) پیشنهاد، نیت، کاری که فقط گفته شد، یا چیزی که از نوبت‌های قبل می‌دانستی ⇒ anjam_shod نیست. ' +
  '۳) نامطمئن یا سنجیده‌نشده ⇒ anjam_nashod با «چک نشد». ' +
  '۴) عدد، ساعت، اسمِ فایل و commit فقط اگر عیناً در خروجیِ یک ابزارِ همین نوبت آمده. ' +
  '۵) هر خواستهٔ حبیب در همین نوبت که انجام نشد ⇒ anjam_nashod. ' +
  '۶) مدرک فقط همان چیزی را ثابت می‌کند که خودش نشان می‌دهد: ویرایشِ کد ⇒ «کد اضافه شد»، نه «کار می‌کند»؛ رفتار فقط با آزمونی که همان رفتار را دید ⇒ وگرنه anjam_nashod «رفتارش آزموده نشد». فارسیِ ساده، با واژه‌های حبیب. ' +
  'Reply ONLY with JSON: {"text": "<at most two short sentences: the whole turn>", "anjam_shod": ["<short> ⇐ <evidence>", …], "anjam_nashod": ["<short>", …]' +
  (ezafe ? ', ' + prompt_fork_bakhsh_ha(ezafe, anjam).join(', ') + '}' + ghaede_bakhsh_ha(ezafe, anjam) : '}')
export function khandan_jambandi(raw) {
  try {
    const m = String(raw || '').match(/\{[\s\S]*\}/)
    const o = JSON.parse(m ? m[0] : raw)
    const list = (x) => (Array.isArray(x) ? x : []).filter((y) => typeof y === 'string' && y.trim()).map((y) => y.trim()).slice(0, 8)
    const text = typeof o?.text === 'string' ? kutah_be_do_jomle(o.text) : ''
    return text ? { text, anjam_shod: list(o.anjam_shod), anjam_nashod: list(o.anjam_nashod) } : null
  } catch {
    return null
  }
}
// this turn's lines and tools, taken (and cleared) once; null when the turn has nothing to sum up
async function amade_jambandi($) {
  const id = await $.session.id()
  const lines = do_jomle_ha_ye_nobat.get(id) || []
  const tools = abzar_ha_ye_nobat.get(id) || []
  const asked = khaste_habib_nobat.get(id) || ''
  do_jomle_ha_ye_nobat.set(id, []); abzar_ha_ye_nobat.set(id, [])
  if (lines.length < had_kamtarin_do_jomle_jambandi && !tools.length) return null
  return { lines, tools, asked }
}
// the summary alone, when the other parts are not due this answer
async function jambandi($, pj) {
  if (!pj) return false
  try {
    // always the chat itself with its warm cache, whatever its size: only it has read every tool's
    // output (Habib, 24 Oct 23:37: «با مدل اصلی که با کش گرم کار میکنه»; Sonnet on the last few
    // messages got turns wrong). No usable reply: no summary, the plain «دو جمله».
    const r = await $.model.fork({ prompt: prompt_jambandi_nobat(pj.lines, pj.tools) })
    if (r.isAnswered) await benevis_kharj($, 'jambandi_nobat', 'fork', r.usage)
    return sabt_jambandi($, pj, r.isAnswered ? r.text : '')
  } catch {
    return false
  }
}
async function sabt_jambandi($, pj, raw) {
  const { lines, tools, asked } = pj
  let tokens = 0
  try { tokens = (await $.session.usage()).context.tokens || 0 } catch {}
  try {
    const got = khandan_jambandi(raw)
    if (!got) return false
    await benevis_do_jomle($, got.text, 'jambandi_nobat')
    do_jomle_akhar.summary = got
    // what Habib asked in this turn, word for word from his own message (not the model's retelling)
    await benevis_daftar($, 'jambandi_nobat', { khaste_habib: asked.slice(0, 300), text: got.text, anjam_shod: got.anjam_shod, anjam_nashod: got.anjam_nashod, tedad_do_jomle: lines.length, tedad_abzar: tools.length, rah: 'fork', context_token: tokens })
    return true
  } catch {
    return false
  }
}

// returns whether the turn's summary (pj) was made in the same fork
// «خودکار» goes to the chat by itself, the moment it comes (Habib, 26 Oct 03:06: «میخوام خودکار ها به صورت هوک
// همون موقع که میان توی چت ایمپورت بشن و اگه انجام نشدن به صورت نکرده بیان -- و توی خودکار پنل هوک تیک فرستاده
// شدن به چت بخورن»; 03:35: «هر خودکار یک بار و اگه انجام نشد یک بار هم نکرده مرتبط باهاش فرستاده بشه»): a turn of
// its own ($.prompt.submit). Each one is sent once, and its «نکرده» once: that is what ends the chain. Per chat,
// in ~/.claude/hads-log/<id>.khodkar_ferestade.json: {khodkar: [kar…], nakarde: [kar…]}
const masir_khodkar_ferestade = async ($) => (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.khodkar_ferestade.json'
const khodkar_ferestade_har_chat = new Map()
const baraye_ferestadan_har_chat = new Map()
async function khandan_khodkar_ferestade($) {
  const id = await $.session.id()
  if (!khodkar_ferestade_har_chat.has(id)) {
    let o = null
    try { o = JSON.parse(String(await $.fs.read(await masir_khodkar_ferestade($)))) } catch {}
    const list = (x) => (Array.isArray(x) ? x.filter((k) => typeof k === 'string') : [])
    const tedad = o?.tedad && typeof o.tedad === 'object' ? Object.fromEntries(Object.entries(o.tedad).filter(([, n]) => Number.isInteger(n))) : {}
    khodkar_ferestade_har_chat.set(id, { khodkar: list(o?.khodkar), nakarde: list(o?.nakarde), rah: list(o?.rah), tedad })
  }
  return khodkar_ferestade_har_chat.get(id)
}
const kelid_rah = (x) => x.kar + ' ⇐ ' + x.abzar
const dar_list = (list, kar) => list.some((k) => k === kar || hamun_matn(k, kar))
// how many times one work went to the chat («خودکار» or «نکرده», any wording): the third time asks Habib, there is no
// fourth (Habib, 26 Oct 07:50: «خودکاری که دوبار اومده و انجام نشده دفعه سوم هوک خودکار یه متنی اضافه کنه بهش که این مورد
// رو اول به زبون ساده به حبیب توضیح بده و ازش بخواه کمکت کنه … و دفعه چهارم دیگه نفرستتش»)
export const had_ferestadan_kar = 3
export const matn_bar_sevom = ' (بارِ سوم است و هنوز انجام نشده: اول به زبانِ ساده به حبیب توضیح بده این کار چیست و کجا گیر کرده، و از او بخواه کمکت کند)'
function tedad_kar(tedad, kar) {
  const k = Object.keys(tedad).find((x) => x === kar || hamun_matn(x, kar))
  return { kelid: k ?? kar, n: k ? tedad[k] : 0 }
}
export function matn_ferestadan_khodkar(kh, nk) {
  const parts = ['خودکار (از مودِ «حدس»، به خواستِ حبیب: هر «خودکار» همان لحظه به چت می‌آید): این‌ها را خودت انجام بده و از من نپرس؛ نتیجهٔ هر کدام را خودت چک کن. اگر حبیب قبلاً درباره‌اش حرفی زده (سرچ در چت‌های قبلی)، طبقِ همان. اگر راهی که آمده نشد، منتظر نمان: از کارها و تجربه‌های قبلی یا ایجنتِ دیگری که ابزارش را دارد راهِ تازه پیدا کن و انجامش بده؛ فقط اگر خلافِ دستورِ حبیب است انجام نده و بگو کدام دستور.']
  if (kh.length) parts.push(kh.map((x, i) => adad_farsi(i + 1) + '. ' + x.kar + ' ⇐ با ' + x.abzar + (x.chek ? '؛ چک: ' + x.chek : '') + (x.bar_sevom ? matn_bar_sevom : '')).join('\n'))
  if (nk.length) parts.push('این «خودکار»ها قبلاً فرستاده شد و هنوز انجام نشده (نکرده):\n' + nk.map((x, i) => adad_farsi(i + 1) + '. ' + x.harf + (x.chera ? ' — ' + x.chera : '') + (x.bar_sevom ? matn_bar_sevom : '')).join('\n'))
  return parts.join('\n\n')
}
// at the answer's end, after everything else: one message with the new «خودکار» and the «نکرده» of sent ones
async function ferestadan_khodkar($) {
  const id = await $.session.id()
  const b = baraye_ferestadan_har_chat.get(id)
  baraye_ferestadan_har_chat.delete(id)
  if (!b || (!b.khodkar.length && !b.nakarde.length)) return
  const f = await khandan_khodkar_ferestade($)
  // once per work AND way: the same work with a new way (an excuse answered) goes again; a work sent before the
  // ways were kept counts by its work alone
  const qadimi = f.khodkar.filter((k) => !f.rah.some((r) => r.startsWith(k + ' ⇐ ')))
  const kh0 = b.khodkar.filter((x) => !dar_list(f.rah, kelid_rah(x)) && !dar_list(qadimi, x.kar))
  const nk0 = b.nakarde.filter((x) => !dar_list(f.nakarde, x.harf))
  // the count: a work sent had_ferestadan_kar times does not go again; the last time carries the ask for Habib's help
  const shomar = (list, kar_az) => list.map((x) => ({ x, t: tedad_kar(f.tedad, kar_az(x)) })).filter(({ t }) => t.n < had_ferestadan_kar)
    .map(({ x, t }) => { f.tedad[t.kelid] = t.n + 1; return t.n + 1 === had_ferestadan_kar ? { ...x, bar_sevom: true } : x })
  const kh = shomar(kh0, (x) => x.kar)
  const nk = shomar(nk0, (x) => x.harf)
  if (!kh.length && !nk.length) return
  f.khodkar.push(...kh.map((x) => x.kar)); f.rah.push(...kh.map(kelid_rah)); f.nakarde.push(...nk.map((x) => x.harf))
  try { await $.fs.write(await masir_khodkar_ferestade($), JSON.stringify(f) + '\n') } catch {}
  await benevis_daftar($, 'khodkar_ferestade', { khodkar_ha: kh, nakarde_ha: nk.map((x) => x.harf) })
  $.ui.invalidate('ui.render')
  try { await $.prompt.submit({ text: matn_ferestadan_khodkar(kh, nk) }) } catch {}
}

function baraye_ferestadan($, k, list) {
  return $.session.id().then((id) => {
    const b = baraye_ferestadan_har_chat.get(id) || { khodkar: [], nakarde: [] }
    b[k] = list; baraye_ferestadan_har_chat.set(id, b)
  })
}
async function hads_ba_fork($, p = { hads: true }, pj = null) {
  let got = null
  let jambandi_shod = false
  let tokens = 0
  try { tokens = (await $.session.usage()).context.tokens || 0 } catch {}
  // «نکرده‌ها», «خودکار», «کرون‌جاب» and the summary need the whole chat: only the chat's own fork
  // has it, so a big chat forks for them too
  if (tokens <= had_fork_context_token || p.nakarde || p.khodkar || p.cron || pj) {
    try {
      const ferestade = await khandan_khodkar_ferestade($)
      const khaste = { hads: !!p.hads, nakarde: !!p.nakarde, khodkar: !!p.khodkar, cron: !!p.cron, commit_ha: p.nakarde ? await commit_ha_ye_akhir($) : '', khodkar_ferestade: p.nakarde ? ferestade.khodkar.slice(-20) : [], khodkar_rah: p.khodkar ? ferestade.rah.slice(-20) : [], daftar_kar: p.nakarde ? (await khandan_kar_daftar($)).kar.slice(-60) : [] }
      const anjam = khaste.nakarde ? await khandan_nakarde_anjam($) : []
      const r = await $.model.fork({ prompt: pj ? prompt_jambandi_nobat(pj.lines, pj.tools, khaste, anjam) : prompt_fork(khaste, anjam) })
      got = r.isAnswered ? khandan_javab_fork(r.text) : null
      if (got?.hads.length) try { await $.store.set('kharj_akhar_hads_fork', { rah: 'fork', context_token: tokens, usage: r.usage }) } catch {}
      if (r.isAnswered) await benevis_kharj($, [pj && 'jambandi_nobat', khaste.hads && 'hads', khaste.nakarde && 'nakarde', khaste.khodkar && 'khodkar', khaste.cron && 'cron'].filter(Boolean).join('_va_'), 'fork', r.usage)
      if (pj) jambandi_shod = await sabt_jambandi($, pj, r.isAnswered ? r.text : '')
    } catch {}
  } else if (pj) jambandi_shod = await jambandi($, pj)
  if (p.nakarde && got) {
    const sh = shomare_dadan(got.nakarde, await khandan_kar_daftar($)); got.nakarde = sh.list; await neveshtan_kar_daftar($, sh.daftar)
    // a «نکرده» its own check finds done (the file has it, a commit says it) is not shown, and is logged
    const ba_sanad = []
    for (const x of got.nakarde) if (await sanad_dare($, x.sanad)) ba_sanad.push(x)
    if (ba_sanad.length) await benevis_daftar($, 'nakarde_ba_sanad', { anjam_shode: ba_sanad.map((x) => ({ harf: x.harf, sanad: x.sanad })) })
    nakarde_ba_sanad_akhar = ba_sanad
    const ferestade = (await khandan_khodkar_ferestade($)).khodkar
    nakarde_akhar = hanuz_nakarde(got.nakarde.filter((x) => !ba_sanad.includes(x)), await khandan_nakarde_anjam($))
      .map((x) => (dar_list(ferestade, x.harf) ? { ...x, khodkar: true } : x)); hads_baraye_chat = await $.session.id()
    if (nakarde_akhar.some((x) => x.khodkar)) await baraye_ferestadan($, 'nakarde', nakarde_akhar.filter((x) => x.khodkar))
    await benevis_daftar($, 'nakarde', { rah: 'fork', nakarde_ha: nakarde_akhar })
    $.ui.invalidate('ui.render')
  }
  if (p.cron && got) {
    cron_akhar = got.cron; hads_baraye_chat = await $.session.id()
    await benevis_daftar($, 'cron', { rah: 'fork', cron_ha: cron_akhar })
    $.ui.invalidate('ui.render')
  }
  if (p.khodkar && got) {
    khodkar_akhar = got.khodkar; hads_baraye_chat = await $.session.id()
    if (khodkar_akhar.length) await baraye_ferestadan($, 'khodkar', khodkar_akhar)
    await benevis_daftar($, 'khodkar', { rah: 'fork', khodkar_ha: khodkar_akhar })
    $.ui.invalidate('ui.render')
  }
  if (!p.hads) return jambandi_shod
  if (got?.hads.length) {
    hads_akhar = got.hads; hads_baraye_chat = await $.session.id()
    await benevis_daftar($, 'hads', { rah: 'fork', hads_ha: hads_akhar.map((g) => g.text) })
    $.ui.invalidate('ui.render')
  } else await hads_ba_sonnet($)
  return jambandi_shod
}

const matn_porsesh_montazer = 'این پرسش بعد از جوابِ بعدیِ کلود در همین چت خودش پرسیده می‌شود (بعد از resume یا وسطِ کار، تا اولین جواب چیزی برای خواندن نیست).'
const matn_dalil_bi_javab = {
  'nothing-to-fork': 'این چت هنوز چیزی ندارد (مثلاً تازه /clear شده)؛ اول یک پیام بفرست.',
  'api-error': 'خطا از سمتِ Claude؛ دوباره بپرس.',
  'empty-reply': 'جوابی نیامد؛ دوباره بپرس.',
  aborted: 'نیمه‌کاره ماند؛ دوباره بپرس.',
}
const masir_prompt_ha = async ($) => (await $.env.get('HOME')) + '/.claude/hads-prompt-ha.json'
async function khandan_prompt_ha($) {
  if (prompt_ha) return prompt_ha
  let o = null
  try { o = JSON.parse(String(await $.fs.read(await masir_prompt_ha($)))) } catch {}
  prompt_ha = Array.isArray(o) ? o.filter((x) => typeof x === 'string' && x.trim()) : []
  return prompt_ha
}
async function zakhire_prompt_ha($) {
  try { await $.fs.write(await masir_prompt_ha($), JSON.stringify(prompt_ha) + '\n') } catch {}
  $.ui.invalidate('ui.render')
}
export const had_harf_dokme_prompt = 18
async function zakhire_prompt_virayesh($) {
  const v = prompt_virayesh
  if (!v) return
  const matn = String(v.matn || '').trim()
  prompt_virayesh = null
  await khandan_prompt_ha($)
  if (!matn) return $.ui.invalidate('ui.render')
  if (v.i >= 0 && v.i < prompt_ha.length) prompt_ha[v.i] = matn; else prompt_ha.push(matn)
  return zakhire_prompt_ha($)
}
async function prompt_entekhab_shode($) {
  const i = prompt_entekhab_har_chat.get(await $.session.id())
  const list = await khandan_prompt_ha($)
  return i != null && list[i] ? list[i] : ''
}
async function porsesh_kon($, q) {
  if (!String(q).trim()) return
  // off in this chat, or «پرسش» unticked: nothing would be drawn, so no fork is paid for
  if (!(await khandan_file_chat($))?.porsesh) return
  const id = await $.session.id()
  // a cold cache re-reads the whole chat at the write price: say how much, ask Enter again.
  // Known only from this process's own activity or the resume's numbers; no word means no warning
  // is claimed as fact.
  const idle = zaman_akharin_kar ? (await $.clock.now()) - zaman_akharin_kar : -1
  const cold = cache_sard_shod || idle > cache_sard_bad_az_ms
  if ((cold || idle < 0) && !(javab_porsesh?.cold && javab_porsesh.q === q && javab_porsesh.for === id)) {
    let tokens = 0, model = ''
    try { tokens = (await $.session.usage()).context.tokens || 0 } catch {}
    try { model = await $.session.model() } catch {}
    if (tokens > 0) {
      const [a, b] = kharj_cache_sard(model, tokens)
      const cost = '$' + a.toFixed(2) + ' تا $' + b.toFixed(2) + ' (' + Math.round(tokens / 1000) + 'k توکن)'
      javab_porsesh = { q, for: id, cold: true,
        text: (cold ? 'کشِ چت سرد است (' + Math.round(idle / 60000) + ' دقیقه بی‌کار' + (cache_sard_shod ? '، به گفتهٔ خودِ Claude Code' : '') + '): این سؤال حدودِ ' + cost + ' خرج دارد.'
          : 'نمی‌دانم کشِ چت گرم است یا نه؛ اگر سرد باشد این سؤال حدودِ ' + cost + ' خرج دارد.') + ' برای پرسیدن «باشه، بپرس» یا دوباره Enter را بزن.' }
      $.ui.invalidate('ui.render')
      return
    }
  }
  // this question's own box: × or a newer question may replace `answer` while the fork runs
  const cur = javab_porsesh = { q, text: '…', for: id }; matn_porsesh = ''; $.ui.invalidate('ui.render')
  try {
    // mid-work the fork sees a tool call in flight and may try to go on with it: say it may not
    const pr = await prompt_entekhab_shode($)
    const r = await $.model.fork({ prompt: (pr ? 'پرومپتِ حبیب برای این پرسش (طبقِ همین جواب بده):\n' + pr + '\n\nپرسش:\n' : '') + q + '\n\n(این پرسش از کادرِ حدس است، نه دستورِ کار: ابزاری صدا نزن و کاری را ادامه نده؛ فقط کوتاه، به فارسیِ ساده و با واژه‌های حبیب جواب بده.)' })
    // nothing to read yet, though the chat has a story: wait for the next answer, then ask
    let has = false
    if (!r.isAnswered && r.reason === 'nothing-to-fork') {
      try { has = ((await $.session.usage()).context.tokens || 0) > 0 || (await $.session.messages()).length > 0 } catch {}
    }
    if (has) { porsesh_montazer = q; cur.text = matn_porsesh_montazer; cur.waiting = true; await benevis_daftar($, 'porsesh_montazer', { porsesh_matn: q }) }
    else cur.text = r.isAnswered ? r.text : (matn_dalil_bi_javab[r.reason] || 'جوابی نیامد (' + r.reason + ')؛ دوباره بپرس.')
    // the fork just read the whole chat into the cache: it is warm for the next question
    if (r.isAnswered) { try { zaman_akharin_kar = await $.clock.now() } catch {} cache_sard_shod = false }
    if (r.isAnswered) await benevis_daftar($, 'porsesh', { porsesh_matn: q, javab_matn: r.text, rah: 'fork' })
    if (r.isAnswered) try { await $.store.set('kharj_akhar_porsesh', r.usage) } catch {}
    if (r.isAnswered) await benevis_kharj($, 'porsesh', 'fork', r.usage)
  } catch {
    cur.text = matn_dalil_bi_javab.aborted
  }
  if (javab_porsesh === cur) $.ui.invalidate('ui.render')
}

// No app attached (claude -p, SDK) means nobody sees the row: skip the model call.
async function chat_ba_safhe($) {
  try {
    const s = await $.session.surfaces()
    return !Array.isArray(s) || s.length > 0
  } catch {
    return true
  }
}

// Keep what is already typed: the guess goes on its own line after it.
async function gozashtan_dar_kadr($, text) {
  let cur = ''
  try {
    const v = await $.prompt.read()
    cur = typeof v === 'string' ? v : String(v?.text ?? '')
  } catch {}
  return $.prompt.fill({ text: cur.trim() ? cur + '\n' + text : text })
}

// on/off is per chat: one file per session id (~/.claude/hads-on/<id>), so no chat can
// switch another, not even one in the same folder. One file each, not $.store: the store
// is one JSON file every open chat rewrites. A new id (/clear, a new chat) starts off.
const masir_file_chat = async ($) => (await $.env.get('HOME')) + '/.claude/hads-on/' + (await $.session.id())
// The file holds `on`, then the parts ticked off: `on -hads -porsesh`. h-on turns all of them on.
export const bakhsh_ha = [['hads', 'حدس'], ['nakarde', 'نکرده‌ها'], ['khodkar', 'خودکار'], ['cron', 'کرون‌جاب'], ['do_jomle', 'دو جمله'], ['porsesh', 'پرسش'], ['hook', 'هوک‌ها'], ['zaban', 'زبان']]
// every word the chat's file may hold, written out whole so grep finds each one (تعریفِ ۱۰: no
// name glued from pieces): a part ticked off, and the other settings
export const esm_bakhsh = Object.fromEntries(bakhsh_ha)
// «🔎 حافظه»: how wide this chat's memory search reaches (Habib to ۲۰۵, 25 Oct 18:03: «این قابلیت سرچ کردن
// باید قابل تنظیم باشه که … فقط از توی چت خودش باشه یا از توی چتای توی پروژه خودش باشه یا از توی کل چتای
// موجود در کل پروژه ها»; built here, 18:30: «بله، بسازید»). ۲۰۵ owns the file (hafeze_tanzim.json): its
// command writes and reads it, the label shows what its `get` says, a press moves only this chat one on
export const dayere_ha = ['chat', 'poshe', 'hame']
export const esm_dayere = { chat: 'همین چت', poshe: 'همین پروژه', hame: 'همهٔ پروژه‌ها' }
const masir_hafeze_dayere = async ($) => (await $.env.get('HOME')) + '/1-MY-WORK/205th-day-mother-of-all-agent/abzar/hafeze_dayere.py'
// per chat id: what `get` last said (undefined: not asked yet; null: no answer)
const dayere_har_chat = new Map()
async function hafeze_dayere($, ...args) {
  try {
    // the chat's own folder too: a chat its memory has not indexed yet is not known by id alone, and the
    // folder layer would be missed (۲۰۵, 19:01: in 203's folder, get without it said poshe, the hook used chat)
    let poshe = ''
    try { poshe = await $.session.root() } catch {}
    const r = await $.process.run([await masir_hafeze_dayere($), ...args, '--chat', await $.session.id(), ...(poshe ? ['--poshe', poshe] : [])], { timeoutMs: 15000 })
    const o = JSON.parse(String(r.stdout || '').trim().split('\n').pop())
    return dayere_ha.includes(o?.dayere) ? o.dayere : null
  } catch {
    return null
  }
}
async function khandan_dayere($) {
  const id = await $.session.id()
  dayere_har_chat.set(id, await hafeze_dayere($, 'get'))
  $.ui.invalidate('ui.render')
}
async function taghir_dayere($, be) {
  const id = await $.session.id()
  const cur = dayere_har_chat.get(id)
  const next = be || dayere_ha[(dayere_ha.indexOf(cur) + 1) % dayere_ha.length]
  await hafeze_dayere($, 'set', next)
  // the label is what get says after the write, never what was asked for
  await khandan_dayere($)
  await benevis_daftar($, 'hafeze_dayere', { khaste: next, hast: dayere_har_chat.get(id) })
  return dayere_har_chat.get(id)
}
// What the box shows, kept per chat in ~/.claude/hads-log/<id>.akharin.json, so a reload of VS Code (a new
// process, every variable empty) shows it again (Habib, 25 Oct 18:09: «وقتی که VS Code رو ریلود میکنیم اون
// متنایی که تو پنجره هدس هست اونا همه پاک میشه و صفر میشه. بعد از قبلی ها توش باشه»). Written when it
// changes, read back once per chat; «قبلی‌ها» have their own file and come back with «دو جمله».
const masir_akharin = async ($) => (await $.env.get('HOME')) + '/.claude/hads-log/' + (await $.session.id()) + '.akharin.json'
const tasvir_akharin = (id) => JSON.stringify({
  do_jomle: do_jomle_akhar.for === id && do_jomle_akhar.text ? { text: do_jomle_akhar.text, summary: do_jomle_akhar.summary || null } : null,
  ...(hads_baraye_chat === id ? { hads: hads_akhar, nakarde: nakarde_akhar, nakarde_ba_sanad: nakarde_ba_sanad_akhar, khodkar: khodkar_akhar, cron: cron_akhar } : {}),
  porsesh: javab_porsesh && javab_porsesh.for === id && !javab_porsesh.cold && !javab_porsesh.waiting && javab_porsesh.text !== '…' ? { q: javab_porsesh.q, text: javab_porsesh.text } : null,
})
const akharin_zakhire = new Map()
async function zakhire_akharin($, id) {
  const t = tasvir_akharin(id)
  if (akharin_zakhire.get(id) === t) return
  akharin_zakhire.set(id, t)
  try { await $.fs.write(await masir_akharin($), t + '\n') } catch {}
}
const akharin_bargashte = new Set()
async function bargardandan_akharin($, id) {
  if (akharin_bargashte.has(id)) return
  akharin_bargashte.add(id)
  let o = null
  try { o = JSON.parse(String(await $.fs.read(await masir_akharin($)))) } catch {}
  if (o?.do_jomle?.text && do_jomle_akhar.for !== id) {
    const sm = o.do_jomle.summary ? khandan_jambandi(JSON.stringify(o.do_jomle.summary)) : null
    do_jomle_akhar = { text: String(o.do_jomle.text), for: id, ...(sm ? { summary: sm } : {}) }
  }
  if (o && hads_baraye_chat !== id && (o.hads || o.nakarde || o.khodkar || o.cron)) {
    hads_akhar = khandan_hads(JSON.stringify(o.hads || []))
    nakarde_akhar = hanuz_nakarde(khandan_nakarde(o.nakarde), await khandan_nakarde_anjam($))
    nakarde_ba_sanad_akhar = khandan_nakarde(o.nakarde_ba_sanad)
    khodkar_akhar = khandan_khodkar(o.khodkar); cron_akhar = khandan_cron(o.cron); hads_baraye_chat = id
  }
  if (o?.porsesh?.text && !javab_porsesh) javab_porsesh = { q: String(o.porsesh.q || ''), text: String(o.porsesh.text), for: id }
}
// the order of the parts, the same in every chat (Habib, 25 Oct 18:01: «این دکمه ها باید قابلیت جابجایی
// داشته باشن و با جابجا شدن ردیفشون عوض بشه. یعنی اگه حدس اوله میشه ردیف یک»): one line of part
// names in ~/.claude/hads-tartib; a part it lacks comes after, in bakhsh_ha's order
export function khandan_tartib(text) {
  const kol = bakhsh_ha.map(([k]) => k)
  const ba = [...new Set(String(text || '').trim().split(/\s+/).filter((w) => kol.includes(w)))]
  return [...ba, ...kol.filter((k) => !ba.includes(k))]
}
const masir_tartib = async ($) => (await $.env.get('HOME')) + '/.claude/hads-tartib'
async function khandan_tartib_file($) {
  try { return khandan_tartib(String(await $.fs.read(await masir_tartib($)))) } catch { return khandan_tartib('') }
}
async function taghir_tartib($, v) {
  const tazeh = khandan_tartib(v)
  if (tazeh.join(' ') === (await khandan_tartib_file($)).join(' ')) return
  try { await $.fs.write(await masir_tartib($), tazeh.join(' ') + '\n') } catch {}
  $.ui.invalidate('ui.render')
}
export const kalame_khamush = { hads: '-hads', nakarde: '-nakarde', khodkar: '-khodkar', cron: '-cron', do_jomle: '-do_jomle', porsesh: '-porsesh', hook: '-hook', zaban: '-zaban' }
export const kalame_tanzim = { do_jomle_fork: '+do_jomle_fork', yek_khat: 'yek_khat', tak_dokme: 'tak_dokme', hook_bozorg: 'hook_bozorg' }
async function khandan_file_chat($) {
  try {
    const w = String(await $.fs.read(await masir_file_chat($))).trim().split(/\s+/)
    if (w[0] !== 'on') return null
    return { ...Object.fromEntries(bakhsh_ha.map(([k]) => [k, !w.includes(kalame_khamush[k])])),
      ...Object.fromEntries(Object.entries(kalame_tanzim).map(([k, kalame]) => [k, w.includes(kalame)])) }
  } catch {
    return null
  }
}
const roshan_ast = async ($) => (await khandan_file_chat($)) !== null
const kalame_ha_ye_file = (p) => ['on', ...bakhsh_ha.filter(([k]) => !p[k]).map(([k]) => kalame_khamush[k]), ...Object.entries(kalame_tanzim).filter(([k]) => p[k]).map(([, kalame]) => kalame)].join(' ')
// ▾ / ▸: the whole band folds to one line and stays so after a reload (the word `yek_khat`)
// three states (Habib, 24 Oct 22:52: «سه حالته، یکی حالت باز، یکی حالت مثل الان … یه حالتی هم که
// بشه اصلا یه دکمه»): open (baz) · folded to one line (yek_khat) · just one small button (tak_dokme).
// The button opens the folded line; the line opens the box. Kept in the chat's file over reloads.
async function taghir_halat($, mode) {
  const p = await khandan_file_chat($)
  if (!p) return
  p.yek_khat = mode === 'yek_khat'; p.tak_dokme = mode === 'tak_dokme'
  await $.fs.write(await masir_file_chat($), kalame_ha_ye_file(p))
  $.ui.invalidate('ui.render')
}
const jam_kardan = ($) => khandan_file_chat($).then((p) => p && taghir_halat($, p.yek_khat || p.tak_dokme ? 'baz' : 'tak_dokme'))
let ghablia_baz = false

// «هوک‌ها»: the VS Code panel drops every hook_* message on purpose (extension.js filters
// subtype hook_ out, the webview has no view for them), so the band shows what the hooks
// injected, read from the transcript the CLI writes: the attachments of type hook_success,
// hook_additional_context and hook_system_message since the last prompt, and the last
// SessionStart's. A transcript passes $.fs.read's 4 MiB and its tail is mostly request blobs,
// so grep keeps only hook attachments and typed prompts, and of those the last had_hook_transcript_khat lines.
export const had_hook_transcript_khat = 400
export const had_hook_transcript_byte = 4000000
export const hook_transcript_grep = '"attachment":\\{"type":"hook_|"type":"user","message":\\{"role":"user","content":("|\\[\\{"type":"text")'
// one line each: the Shamsi date and time first (~۲۰ characters), then the hook
export const had_hook_kuchak_harf = 100
let masir_transcript = ''
let hook_ha = { list: [], for: '' }
let zaman_khandan_hook = 0
export function khandan_hook_ha(text) {
  const lines = String(text || '').split('\n')
  const all = []
  let lastPrompt = -1
  for (const l of lines) {
    let o
    try { o = JSON.parse(l) } catch { continue }
    const a = o.attachment
    if (a && typeof a === 'object' && typeof a.type === 'string' && a.type.startsWith('hook_')) {
      const body = Array.isArray(a.content) ? a.content.join('\n') : String(a.content ?? '')
      if (body.trim() && ['hook_success', 'hook_additional_context', 'hook_system_message'].includes(a.type)) {
        const t = Date.parse(o.timestamp)
        all.push({ name: a.hookName || a.hookEvent || a.type, kind: a.type, text: body.trim(), t: Number.isFinite(t) ? t : 0 })
      }
      continue
    }
    // a prompt the person (or another chat) sent, not a tool result
    if (o.type === 'user' && !o.isMeta) {
      const c = o.message?.content
      const typed = typeof c === 'string' || (Array.isArray(c) && c.some((b) => b?.type === 'text'))
      if (typed) lastPrompt = all.length
    }
  }
  const since = lastPrompt < 0 ? all : all.slice(lastPrompt)
  const start = all.filter((h) => /^SessionStart/.test(h.name)).slice(-3)
  // the same hook with the same text (a reminder after every Bash) is one line with ×n
  const out = []
  for (const h of [...start.filter((x) => !since.includes(x)), ...since]) {
    const twin = out.find((x) => x.name === h.name && x.text === h.text)
    // a repeated hook keeps the time of its latest run
    if (twin) { twin.n++; twin.t = Math.max(twin.t, h.t) }
    else out.push({ ...h, n: 1 })
  }
  return out
}
// on screen: the last had_hook_kuchak_radif of them
export const had_hook_kuchak_radif = 6
export const had_hook_bozorg_radif = 3
export const had_hook_bozorg_harf = 600
async function khandan_hook_az_transcript($) {
  try {
    const t = await $.clock.now()
    if (t - zaman_khandan_hook < 2000) return
    zaman_khandan_hook = t
    let path = masir_transcript
    if (!path) {
      const slug = String(await $.session.cwd()).replace(/[^a-zA-Z0-9]/g, '-')
      path = (await $.env.get('HOME')) + '/.claude/projects/' + slug + '/' + (await $.session.id()) + '.jsonl'
    }
    // only the file's last had_hook_transcript_byte are searched: a long chat's transcript is hundreds of MB,
    // and this runs after tools. The first line of the cut is half a line; parseHooks skips it.
    const r = await $.process.run(['sh', '-c', 'tail -c "$4" "$2" | grep -E "$1" | tail -n "$3"', 'sh', hook_transcript_grep, path, String(had_hook_transcript_khat), String(had_hook_transcript_byte)])
    if (r.exitCode !== 0) return
    hook_ha = { list: khandan_hook_ha(r.stdout), for: await $.session.id() }
    $.ui.invalidate('ui.render')
  } catch {}
}
// no emoji in «هوک‌ها» either, ours or the hook's own (Habib, 26 Oct 05:36: «این ایموجی های مزخرف رو کامل بردار - کامل بدون ایموجی»)
export const bi_emoji = (t) => String(t).replace(/(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])[\uFE0F\u200D]*/gu, '').replace(/[ \t]{2,}/g, ' ').trim()
const khat_hook = (h) => bi_emoji((h.t ? zaman_shamsi(h.t) + ' · ' : '') + h.name + (h.n > 1 ? ' ×' + adad_farsi(h.n) : '') + ' · ' + h.text.replace(/\s+/g, ' '))
// a hook's message beside the text it injected: only the injected text («فقط اون دومی رو نشون بده … اولی نیاد»)
export const bi_payam_tekrari = (list) => list.filter((h) => !(h.kind === 'hook_system_message' && list.some((x) => x.kind === 'hook_additional_context' && x.name === h.name && Math.abs((x.t || 0) - (h.t || 0)) <= 10000)))
async function tik_zadan($, key) {
  const p = await khandan_file_chat($)
  if (!p) return
  p[key] = !p[key]
  await $.fs.write(await masir_file_chat($), kalame_ha_ye_file(p))
  if (!p.hads) hads_akhar = []
  if (!p.nakarde) { nakarde_akhar = []; nakarde_ba_sanad_akhar = [] }
  if (!p.khodkar) khodkar_akhar = []
  if (!p.cron) cron_akhar = []
  if (!p.do_jomle) do_jomle_akhar = { text: '', for: '' }
  if (!p.porsesh) { javab_porsesh = null; porsesh_montazer = null }
  $.ui.invalidate('ui.render')
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'hads', description: 'حدس: on | off | now | ask <پرسش> | hafeze chat|poshe|hame', argumentHint: '[on|off|now|ask …|hafeze …]', immediate: true })
    } catch {}
    return next(e)
  })

  // resume / fork: Claude Code says how long the chat was idle and whether its cache expired
  on('classic.SessionStart', async ($, e, next) => {
    try {
      if (typeof e.transcript_path === 'string') masir_transcript = e.transcript_path
      if (typeof e.seconds_since_last_response === 'number') zaman_akharin_kar = (await $.clock.now()) - e.seconds_since_last_response * 1000
      cache_sard_shod = e.prompt_cache_likely_expired === true
    } catch {}
    return next(e)
  })
  // a model switch tells the TTL; the new model's cache starts cold
  on('classic.PostModelSwitch', async ($, e, next) => {
    try {
      cache_sard_bad_az_ms = e.cache_ttl === '5m' ? cache_sard_5m_ms : cache_sard_ms
      if (e.from_model !== e.to_model) cache_sard_shod = true
    } catch {}
    return next(e)
  })

  on('command.run', { command: 'hads' }, async ($, e) => {
    const arg = (e.args || '').trim()
    if (arg === 'off' || arg === 'on') {
      await $.fs.write(await masir_file_chat($), arg)
      if (arg === 'off') { hads_akhar = []; do_jomle_akhar = { text: '', for: '' }; javab_porsesh = null; porsesh_montazer = null }
      // nothing to tell yet: say when it comes (no fork here, the cache may be cold)
      else { do_jomle_akhar = { text: 'حدس روشن شد؛ بعد از جوابِ بعدی دو جمله و دکمه‌ها می‌آید.', for: await $.session.id() } }
      $.ui.invalidate('ui.render')
      return { text: 'حدس برای همین چت ' + (arg === 'off' ? 'خاموش شد' : 'روشن شد') }
    }
    // works with the box off too
    if (arg.startsWith('hafeze')) {
      const be = arg.slice(6).trim()
      if (be && !dayere_ha.includes(be)) return { text: 'یکی از این‌ها: /hads hafeze chat | poshe | hame' }
      const hast = be ? await taghir_dayere($, be) : (await khandan_dayere($), dayere_har_chat.get(await $.session.id()))
      return { text: hast ? 'دایرهٔ سرچِ حافظه برای همین چت: ' + esm_dayere[hast] : 'فرمانِ حافظهٔ ۲۰۵ جواب نداد' }
    }
    if (arg.startsWith('ask ') && !(await khandan_file_chat($))?.porsesh) return { text: 'پرسش در این چت خاموش است' }
    if (arg.startsWith('ask ')) { $.clock.after(0, () => porsesh_kon($, arg.slice(4).trim())); return { text: 'پرسش رفت؛ جوابش در کادرِ حدس می‌آید.' } }
    // /hads now: asked for, so the guesses come now whatever the count
    const pn = await khandan_file_chat($)
    if (!pn) return { text: 'حدس در این چت خاموش است؛ اول /hads on' }
    $.clock.after(0, () => akhar_javab($, pn, true))
    return { text: 'حدس در حال ساختن…' }
  })

  // the prompt's own hooks are written right after it: read them a moment later
  // a guess Habib pressed into the box and then sent (as is, or edited): his own message now
  on('prompt.submit', async ($, e, next) => {
    try { const sid = await $.session.id(); do_jomle_ha_ye_nobat.set(sid, []); abzar_ha_ye_nobat.set(sid, []); khaste_habib_nobat.set(sid, harf_habib(String(e?.text || '').trim())) } catch {}
    try {
      const sent = String(e?.text || '').trim()
      if (sent && hads_zade_shode.length) {
        const hit = hads_zade_shode.find((g) => sent.includes(g)) || hads_zade_shode.find((g) => hamun_matn(g, sent))
        if (hit) await benevis_daftar($, 'hads_ferestade', { hads_matn: hit, matn_ferestade: sent, virayesh_shod: !sent.includes(hit) })
        hads_zade_shode = []
      }
    } catch {}
    return next(e)
  })

  on('classic.UserPromptSubmit', async ($, e, next) => {
    try {
      if (typeof e.transcript_path === 'string') masir_transcript = e.transcript_path
      $.clock.after(1500, async () => { if ((await khandan_file_chat($))?.hook) { zaman_khandan_hook = 0; await khandan_hook_az_transcript($) } })
    } catch {}
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      try { zaman_akharin_kar = await $.clock.now(); cache_sard_shod = false } catch {}
      // a «پرسش» that waited for this answer goes now
      if (porsesh_montazer && !e.isAborted) { const q = porsesh_montazer; porsesh_montazer = null; $.clock.after(0, () => porsesh_kon($, q)) }
    }
    const p = !e.agentId && !e.isAborted && (await chat_ba_safhe($)) ? await khandan_file_chat($) : null
    if (p?.hook) $.clock.after(500, () => { zaman_khandan_hook = 0; return khandan_hook_az_transcript($) })
    // not awaited: the turn must not wait for the model
    if (p) $.clock.after(0, () => akhar_javab($, p))
    if (p?.zaban) $.clock.after(0, () => chek_zaban($))
    return next(e)
  })

  // after every tool: the tool runs first and its result goes back untouched; the rest
  // is never awaited and never throws, so «دو جمله» can not slow or break a tool
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    try {
      if (!e.agentId) {
        const what = e.tool + ': ' + String(e.description || e.command || e.file_path || '').slice(0, 200)
        // remembered for the turn's summary (a short line each, at most 30)
        $.clock.after(0, async () => { try { const sid = await $.session.id(); abzar_ha_ye_nobat.set(sid, [...(abzar_ha_ye_nobat.get(sid) || []), what.slice(0, 120)].slice(-30)) } catch {} })
        $.clock.after(0, async () => {
          try {
            zaman_akharin_kar = await $.clock.now(); cache_sard_shod = false
            const p = (await chat_ba_safhe($)) ? await khandan_file_chat($) : null
            if (p?.hook) await khandan_hook_az_transcript($)
            if (p?.do_jomle) await begu_do_jomle($, what, false, p.do_jomle_fork && (await chat_kuchak($)))
          } catch {}
        })
      }
    } catch {}
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await khandan_file_chat($)
    if (!p) return next(e)
    const id = await $.session.id()
    await bargardandan_akharin($, id)
    zakhire_akharin($, id)
    if (!dayere_har_chat.has(id)) { dayere_har_chat.set(id, null); khandan_dayere($) }
    const g = p.hads && hads_baraye_chat === id ? hads_akhar : []
    const nk = p.nakarde && hads_baraye_chat === id ? nakarde_akhar : []
    const nks = p.nakarde && hads_baraye_chat === id ? nakarde_ba_sanad_akhar : []
    const kh = p.khodkar && hads_baraye_chat === id ? khodkar_akhar : []
    const cr = p.cron && hads_baraye_chat === id ? cron_akhar : []
    const n = p.do_jomle && do_jomle_akhar.for === id ? do_jomle_akhar.text : ''
    const sm = n && do_jomle_akhar.summary ? do_jomle_akhar.summary : null
    const a = p.porsesh && javab_porsesh && javab_porsesh.for === id ? javab_porsesh : null
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const theirs = await next(e)
    const amar_matn = await matn_amar($)
    const amar = amar_matn ? [Text({ key: 'hads-amar', dimColor: true, children: [amar_matn] })] : []
    // folded: one line, ▸ opens it again
    // one small button only: it opens the folded line
    // two states now: the folded line is gone, the button opens the whole box and × goes straight back to it
    // (Habib, 26 Oct 19:18: «کلا این مرحله حذف بشه بعد از زدن اون دکمه کامل باز بشه» · «همدو باز کردن هم تو بستن»);
    // a file still holding the old word `yek_khat` shows the button too
    if (p.tak_dokme || p.yek_khat) {
      const one = Button({ key: 'hads-dot', label: 'حدس ▸', onPress: () => taghir_halat($, 'baz') })
      return Box({ flexDirection: 'column', children: [...(theirs ? [theirs] : []), ...amar, one] })
    }
    const hist = n || ghablia_baz ? await khandan_ghablia($) : []
    const prompt_list = p.porsesh ? await khandan_prompt_ha($) : []
    const prompt_i = prompt_entekhab_har_chat.get(id) ?? null
    // ▾ (one line) and × (one button) on top, where they are always in sight however long the box
    // grows (Habib, 24 Oct 22:41: «اینها باید بالای صفحه باشند که همه جا قابلیت دیدن داشته باشند»).
    // The box never closes all the way: × leaves the one button (25 Oct 00:13: «ضربدر … تک دکمه ای
    // شدن یعنی کلا هیچوقت بسته نشه … همین سه تا نباشه»)
    const rows = [Box({ key: 'hads-top', flexDirection: 'row', columnGap: 1, justifyContent: 'flex-end', children: [
      Button({ key: 'hads-x', label: '×', onPress: () => taghir_halat($, 'tak_dokme') }),
    ] })]
    // each part's rows, laid out below in Habib's order (the ticks' order): ▾ × stay on top, the ticks last
    const goruh = Object.fromEntries(bakhsh_ha.map(([k]) => [k, []]))
    const ferestade = kh.length || nk.length ? await khandan_khodkar_ferestade($) : { khodkar: [], nakarde: [] }
    const tartib = await khandan_tartib_file($)
    // plain text, not buttons: Habib selects it with the mouse and copies it (Ctrl+C);
    // the panel's rows are user-select:text in VS Code
    if (n) goruh.do_jomle.push(Box({ flexDirection: 'row', columnGap: 1, children: [
      Text({ dimColor: true, children: [sm ? 'جمع‌بندی:' : 'دو جمله:'] }),
      Text({ key: 'hads-now', children: [n] }),
      ...(hist.length > 1 ? [Button({ key: 'hads-hist', label: (ghablia_baz ? '▴ ' : '') + 'قبلی‌ها ' + adad_farsi(hist.length - 1), onPress: () => { ghablia_baz = !ghablia_baz; $.ui.invalidate('ui.render') } })] : []),
    ] }))
    // the turn's summary: what was done ✓ and what was not ✗, one plain line each
    if (sm) for (const [k, mark, list] of [['anjam_shod', '✓', sm.anjam_shod], ['anjam_nashod', '✗', sm.anjam_nashod]]) {
      if (list.length) goruh.do_jomle.push(Text({ key: 'hads-sum-' + k, children: [mark + ' ' + list.join(' · ')] }))
    }
    // the guesses (1-2): whole sentences, plain text like «دو جمله» (Habib selects and copies
    // them); a small ⤵ puts one in the prompt box, never sends it
    for (let i = 0; i < g.length; i++) goruh.hads.push(Box({ flexDirection: 'row', columnGap: 1, children: [
      Text({ dimColor: true, children: [i ? '      ' : 'حدس:'] }),
      Text({ key: 'hads-g-' + i, children: [g[i].text] }),
      Button({ key: 'hads-' + i, label: '⤵', onPress: () => {
        hads_zade_shode = [...hads_zade_shode.filter((c) => c !== g[i].text), g[i].text].slice(-5)
        benevis_daftar($, 'hads_zadan', { text: g[i].text })
        return gozashtan_dar_kadr($, g[i].text)
      } }),
    ] }))
    // «نکرده‌ها»: Habib's words, when he said them, and why it is still not done; ⤵ asks for it again
    for (let i = 0; i < nk.length; i++) goruh.nakarde.push(Box({ flexDirection: 'row', columnGap: 1, children: [
      Text({ dimColor: true, children: [i ? '        ' : 'نکرده:'] }),
      Text({ key: 'hads-nk-' + i, children: [(nk[i].sh ? 'ک-' + adad_farsi(nk[i].sh) + ' ' : '') + (nk[i].khodkar ? 'خودکار: ' + nk[i].harf : '«' + nk[i].harf + '»') + (nk[i].dasti ? ' (دستی)' : '') + (dar_list(ferestade.nakarde, nk[i].harf) ? ' ✓ فرستاده شد' : '') + (nk[i].zaman ? ' (' + nk[i].zaman + ')' : '') + ' — ' + nk[i].chera] }),
      Button({ key: 'hads-nk-dokme-' + i, label: '⤵', onPress: () => gozashtan_dar_kadr($, 'این را گفته بودم و هنوز نکردی، انجامش بده: «' + nk[i].harf + '»' + (nk[i].zaman ? ' (' + nk[i].zaman + ')' : '')) }),
      // Habib: «یه گزینه داشته باشه که من بزنم نه انجام شده و جزو نکرده ها نباشه دیگه»
      Button({ key: 'hads-nk-anjam-' + i, label: '✓ انجام شد', onPress: () => anjam_shod_zadan($, nk[i].harf, nk[i].sh) }),
    ] }))
    // the ones a check put aside: one line with their count; opened, each with what was found where
    if (nks.length) goruh.nakarde.push(Box({ flexDirection: 'column', children: [
      Button({ key: 'hads-nks', dimColor: true, label: (nakarde_ba_sanad_baz ? '▴ ' : '▸ ') + adad_farsi(nks.length) + ' نکرده با سند کنار رفت', onPress: () => { nakarde_ba_sanad_baz = !nakarde_ba_sanad_baz; $.ui.invalidate('ui.render') } }),
      ...(nakarde_ba_sanad_baz ? nks.map((x, i) => Box({ flexDirection: 'row', columnGap: 1, children: [
        Text({ key: 'hads-nks-' + i, dimColor: true, children: [(x.sh ? 'ک-' + adad_farsi(x.sh) + ' ' : '') + '«' + x.harf + '» — ' + (x.sanad.hast ? 'فایل هست: ' + x.sanad.hast : 'هست: «' + x.sanad.matn + '» در ' + (x.sanad.file || 'commit‌های ' + x.sanad.git))] }),
        Button({ key: 'hads-nks-dokme-' + i, label: '⤵', onPress: () => gozashtan_dar_kadr($, 'این را گفته بودم؛ «نکرده‌ها» با سند کنارش گذاشت («' + (x.sanad.hast || x.sanad.matn) + '» در ' + (x.sanad.file || x.sanad.git) + '). خودت بسنج واقعاً انجام شده یا نه: «' + x.harf + '»') }),
      ] })) : []),
    ] }))
    // «خودکار»: what the model can do by itself, and with what; ⤵ tells the chat to do it, not ask
    for (let i = 0; i < kh.length; i++) goruh.khodkar.push(Box({ flexDirection: 'row', columnGap: 1, children: [
      Text({ dimColor: true, children: [i ? '         ' : 'خودکار:'] }),
      Text({ key: 'hads-kh-' + i, children: [kh[i].kar + ' ⇐ ' + kh[i].abzar + (kh[i].chek ? ' · چک: ' + kh[i].chek : '') + (kh[i].chera ? ' — ' + kh[i].chera : '')] }),
      ...(dar_list(ferestade.khodkar, kh[i].kar) ? [Text({ key: 'hads-kh-ferestade-' + i, dimColor: true, children: ['✓ فرستاده شد'] })] : []),
      Button({ key: 'hads-kh-dokme-' + i, label: '⤵', onPress: () => gozashtan_dar_kadr($, 'این را خودت انجام بده و از من نپرس: ' + kh[i].kar + ' ⇐ با ' + kh[i].abzar + (kh[i].chek ? '؛ نتیجه را خودت چک کن: ' + kh[i].chek : '') + '. اگر حبیب قبلاً درباره‌اش حرفی زده (سرچ در چت‌های قبلی)، طبقِ همان.') }),
    ] }))
    // «کرون‌جاب»: work Habib named that fits a scheduled job; ⤵ asks the chat to make it
    for (let i = 0; i < cr.length; i++) goruh.cron.push(Box({ flexDirection: 'row', columnGap: 1, children: [
      Text({ dimColor: true, children: [i ? '           ' : 'کرون‌جاب:'] }),
      Text({ key: 'hads-cr-' + i, children: [cr[i].kar + ' ⇐ ' + cr[i].zaman + (cr[i].rah ? ' — ' + cr[i].rah : '')] }),
      Button({ key: 'hads-cr-dokme-' + i, label: '⤵', onPress: () => gozashtan_dar_kadr($, 'برای این کار کرون‌جاب بساز و با خرابکاریِ عمدی بسنج که اجرا می‌شود: ' + cr[i].kar + ' ⇐ ' + cr[i].zaman + (cr[i].rah ? ' (' + cr[i].rah + ')' : '')) }),
    ] }))
    // the earlier ones, newest first, with Tehran date and time; the current one is not repeated
    if (ghablia_baz) goruh.do_jomle.push(Box({ flexDirection: 'column', children: hist.slice(1, 11).map((x, i) =>
      Text({ key: 'hads-hist-' + i, dimColor: true, children: [zaman_miladi(x.t) + ' — ' + x.text] })) }))
    // «هوک‌ها»: small = one line each, had_hook_kuchak_harf long; big = the last had_hook_bozorg_radif, each at most
    // had_hook_bozorg_harf long (a SessionStart handoff is pages: whole, it filled the band)
    const hkAll = p.hook && hook_ha.for === id ? bi_payam_tekrari(hook_ha.list) : []
    const hk = hkAll.slice(-(p.hook_bozorg ? had_hook_bozorg_radif : had_hook_kuchak_radif))
    if (hk.length) goruh.hook.push(Box({ flexDirection: 'column', children: [
      Box({ flexDirection: 'row', columnGap: 1, children: [
        Text({ dimColor: true, children: ['هوک‌ها (' + adad_farsi(hkAll.length) + (hkAll.length > hk.length ? '، ' + adad_farsi(hk.length) + ' تای آخر' : '') + '):'] }),
        Button({ key: 'hads-hook-size', label: p.hook_bozorg ? 'کوچک' : 'بزرگ', onPress: async () => {
          const q = await khandan_file_chat($); if (!q) return
          q.hook_bozorg = !q.hook_bozorg; await $.fs.write(await masir_file_chat($), kalame_ha_ye_file(q)); $.ui.invalidate('ui.render')
        } }),
      ] }),
      ...hk.map((h, i) => p.hook_bozorg
        ? Text({ key: 'hads-hook-' + i, children: [bi_emoji((h.t ? zaman_shamsi(h.t) + ' · ' : '') + h.name + (h.n > 1 ? ' ×' + adad_farsi(h.n) : '') + ':\n' + (h.text.length > had_hook_bozorg_harf ? h.text.slice(0, had_hook_bozorg_harf - 1) + '…' : h.text))] })
        : Text({ key: 'hads-hook-' + i, dimColor: true, children: [(() => { const l = khat_hook(h); return l.length > had_hook_kuchak_harf ? l.slice(0, had_hook_kuchak_harf - 1) + '…' : l })()] })),
    ] }))
    if (a) goruh.porsesh.push(Box({
      flexDirection: 'column',
      children: [
        Text({ dimColor: true, children: ['پرسش: ' + a.q] }),
        Text({ children: [a.text] }),
        Box({ flexDirection: 'row', columnGap: 1, children: [
          // a cold warning asks once more by a press, not only by Enter
          ...(a.cold ? [Button({ key: 'hads-ans-go', label: 'باشه، بپرس', onPress: () => porsesh_kon($, a.q) })] : []),
          Button({ key: 'hads-ans-fill', label: 'بفرست به کادر', onPress: () => gozashtan_dar_kadr($, a.q + '\n' + a.text) }),
          Button({ key: 'hads-ans-x', label: '×', onPress: () => { javab_porsesh = null; $.ui.invalidate('ui.render') } }),
        ] }),
      ],
    }))
    // one box per part: the page script (claude-ui-buttons.js) keeps a part's height from shrinking back,
    // so a new «دو جمله» does not make the rows below it jump (Habib, 25 Oct 19:08)
    for (const k of tartib) if (goruh[k].length) rows.push(Box({ key: 'hads-bakhsh-' + k, flexDirection: 'column', children: goruh[k] }))
    // the guesses, «پرسش» and the ticks come last, next to the prompt: a big band above can
    // never push them out of sight
    rows.push(Box({
      flexDirection: 'row', columnGap: 1, flexWrap: 'wrap',
      children: [
        // no Input on mobile: the row stays buttons only
        ...(Input && p.porsesh ? [Input({
          key: 'hads-ask', value: matn_porsesh, placeholder: 'پرسش… (مثلِ btw، به چت نمی‌رسد · Esc = برگشت به کادر)',
          onInput: (v) => { matn_porsesh = v }, onSubmit: (v) => porsesh_kon($, v),
        }),
        // Enter on the screen, for whoever does not want the key
        Button({ key: 'hads-ask-send', label: 'بفرست ⏎', onPress: () => porsesh_kon($, matn_porsesh) }),
        // the saved prompts: a press turns one on for this chat's questions (✓), ✎ edits, × deletes, + adds
        ...prompt_list.flatMap((m, i) => [
          Button({ key: 'hads-pr-' + i, label: (prompt_i === i ? '✓ ' : '') + ([...m].length > had_harf_dokme_prompt ? [...m].slice(0, had_harf_dokme_prompt - 1).join('') + '…' : m),
            onPress: () => { prompt_entekhab_har_chat.set(id, prompt_i === i ? null : i); $.ui.invalidate('ui.render') } }),
          Button({ key: 'hads-pr-ed-' + i, label: '✎', onPress: () => { prompt_virayesh = { i, matn: m }; $.ui.invalidate('ui.render') } }),
          Button({ key: 'hads-pr-x-' + i, label: '×', onPress: () => {
            prompt_ha.splice(i, 1)
            for (const [k, v] of prompt_entekhab_har_chat) if (v === i) prompt_entekhab_har_chat.set(k, null); else if (v > i) prompt_entekhab_har_chat.set(k, v - 1)
            return zakhire_prompt_ha($)
          } }),
        ]),
        Button({ key: 'hads-pr-add', label: '+', onPress: () => { prompt_virayesh = { i: -1, matn: '' }; $.ui.invalidate('ui.render') } }),
        ...(prompt_virayesh ? [
          Input({ key: 'hads-pr-matn', value: prompt_virayesh.matn, placeholder: 'متنِ پرومپت…', onInput: (v) => { prompt_virayesh.matn = v }, onSubmit: (v) => { prompt_virayesh.matn = v; return zakhire_prompt_virayesh($) } }),
          Button({ key: 'hads-pr-save', label: 'ذخیره', onPress: () => zakhire_prompt_virayesh($) }),
          Button({ key: 'hads-pr-laghv', label: 'لغو', onPress: () => { prompt_virayesh = null; $.ui.invalidate('ui.render') } }),
        ] : [])] : []),
        // one tick per part, for this chat only, in Habib's order
        ...tartib.map((k) => Button({ key: 'hads-tick-' + k, label: (p[k] ? '✓ ' : '✗ ') + esm_bakhsh[k], onPress: () => tik_zadan($, k) })),
        // not a part: it stays after the ticks, outside their order
        Button({ key: 'hads-hafeze', label: '🔎 حافظه: ' + (dayere_har_chat.get(id) ? esm_dayere[dayere_har_chat.get(id)] : '…'), onPress: () => taghir_dayere($) }),
        // VS Code only: the ticks are dragged there (claude-ui-buttons.js), which writes the new order
        // here; the field itself is hidden by that script
        ...(Input && e.surface === 'vscode' ? [Input({ key: 'hads-tartib', value: tartib.join(' '), placeholder: 'ترتیبِ بخش‌ها',
          onInput: (v) => taghir_tartib($, v), onSubmit: (v) => taghir_tartib($, v) })] : []),
      ],
    }))
    return Box({ flexDirection: 'column', children: [...(theirs ? [theirs] : []), rows[0], ...amar, ...rows.slice(1)] })
  })
}
