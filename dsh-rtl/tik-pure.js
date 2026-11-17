/**
 * تبِ «ابزارها» — مغزِ خالص (بی‌تماس با DSH و بی‌فایل).
 * ------------------------------------------------
 * چهار دسته (ابزارِ خودِ DSH، MCP، افزونه، اسکیل) و سه سطح (این چت، این پوشه، سراسری).
 * این ماژول هیچ چیز را ذخیره نمی‌کند و هیچ سرویسی نمی‌گیرد؛ فقط تصمیم می‌گیرد:
 *
 *   موثر(چت, پوشه, سراسری, پایه) = چت ?? عمیق‌ترین‌پوشه ?? سراسری ?? پایه
 *
 * پس آزمون‌اش با عدد و رشته ممکن است، بی‌نیاز از بالا آوردنِ اپ.
 *
 * قاعده‌های حبیب (۱۶ نوامبر):
 *   - تیک پیش‌فرضِ چت‌های تازه است؛ چتِ بازِ قدیمی دست نمی‌خورد.
 *   - این پوشه = همین چت به‌علاوهٔ چت‌های تازهٔ بعدیِ همان پوشه.
 *   - سراسری فقط روی پوشه‌هایی اثر می‌کند که فهرستِ خودشان را ندارند.
 *   - پوشهٔ تازه از روی سراسری کپی می‌شود.
 */

/** دسته‌های چهارگانه، به همان ترتیبی که در تب می‌آیند. */
export const TIK_KIND = ['abzar_dsh', 'mcp', 'afzune', 'eskil']

/** سه سطح. */
export const TIK_SATH = ['chat', 'poshe', 'sarasari']

/** نامِ فارسیِ هر دسته، برای سرصفحهٔ تب. */
export const TIK_KIND_LABEL = {
  abzar_dsh: 'ابزارهای خودِ DSH',
  mcp: 'MCP (سرورهای ابزارِ بیرونی)',
  afzune: 'افزونه‌ها',
  eskil: 'اسکیل‌ها',
}

/** @returns {boolean} آیا این نام یک دستهٔ شناخته‌شده است. */
export function isKind(kind) {
  return TIK_KIND.includes(kind)
}

/** @returns {boolean} آیا این نام یک سطحِ شناخته‌شده است. */
export function isSath(sath) {
  return TIK_SATH.includes(sath)
}

/**
 * فهرستِ خالیِ چهار دسته.
 * @returns {Record<string, Record<string, boolean>>}
 */
export function emptyList() {
  const out = {}
  for (const k of TIK_KIND) out[k] = {}
  return out
}

/**
 * یک فهرست را از هر شکلِ ورودی، سالم و کامل می‌کند (بی‌آنکه چیزی را حذف کند).
 * ورودیِ خراب ⇒ فهرستِ خالی؛ هرگز خطا نمی‌دهد، چون در فایلِ کاربر ممکن است
 * هر چیزی باشد و ما باید همیشه بتوانیم ادامه بدهیم.
 * @param value هر چیزی که خوانده‌ایم.
 * @returns {Record<string, Record<string, boolean>>}
 */
export function cleanList(value) {
  const out = emptyList()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  for (const kind of TIK_KIND) {
    const part = value[kind]
    if (!part || typeof part !== 'object' || Array.isArray(part)) continue
    for (const [name, on] of Object.entries(part)) {
      const n = String(name || '').trim()
      if (!n) continue
      if (typeof on === 'boolean') out[kind][n] = on
    }
  }
  return out
}

/**
 * دو فهرست را روی هم می‌گذارد: هرچه `over` دارد، برنده است.
 * @param base فهرستِ پایه.
 * @param over فهرستِ رو.
 * @returns فهرستِ تازه (هر دو دست‌نخورده می‌مانند).
 */
export function mergeList(base, over) {
  const a = cleanList(base)
  const b = cleanList(over)
  const out = emptyList()
  for (const kind of TIK_KIND) Object.assign(out[kind], a[kind], b[kind])
  return out
}

/**
 * عمیق‌ترین پوشه‌ای که برای این مسیر فهرست دارد.
 * «عمیق‌تر» یعنی مسیرِ طولانی‌تر که پیشوندِ مسیرِ چت باشد؛ مرزِ اسلش رعایت می‌شود
 * تا «/a/bc» با «/a/b» قاطی نشود.
 * @param cwd پوشهٔ چت.
 * @param poshe‌ها نقشهٔ «مسیرِ پوشه ⇒ فهرست».
 * @returns {string|null} مسیرِ برنده، یا null.
 */
export function deepestFolder(cwd, folders) {
  const path = normPath(cwd)
  if (!path || !folders || typeof folders !== 'object') return null
  let best = null
  for (const key of Object.keys(folders)) {
    const p = normPath(key)
    if (!p) continue
    if (path !== p && !path.startsWith(p + '/')) continue
    if (best === null || p.split('/').length > normPath(best).split('/').length) best = key
  }
  return best
}

/** آیا این فهرست دستِ‌کم یک تیک دارد؟ */
export function hasAny(list) {
  const c = cleanList(list)
  for (const kind of TIK_KIND) if (Object.keys(c[kind]).length > 0) return true
  return false
}

/** مسیر را برای مقایسه یکدست می‌کند: اسلشِ آخر برداشته، چند اسلشِ پشتِ‌هم یکی. */
function normPath(p) {
  return String(p || '').trim().replace(/\/{2,}/g, '/').replace(/\/+$/, '')
}

/**
 * فهرستِ موثرِ یک چت. ترتیب: چت ⇒ عمیق‌ترین پوشه ⇒ سراسری ⇒ پایه.
 * @param opts { chat, cwd, chatList, folderLists, globalList, baseList }
 * @returns {{ list: Record<string, Record<string, boolean>>, az: string, folder: string|null }}
 *   `az` می‌گوید این تصمیم از کدام سطح آمده (برای نمایش در تب).
 */
export function effectiveList(opts) {
  const o = opts || {}
  const chatKey = String(o.chat || '').trim()
  const chatList = chatKey && o.chatLists && o.chatLists[chatKey] ? o.chatLists[chatKey] : null
  const folder = deepestFolder(o.cwd, o.folderLists)
  const folderList = folder ? o.folderLists[folder] : null
  let list = cleanList(o.baseList)
  let az = 'paye'
  // فقط اگر فهرستِ سراسری واقعاً چیزی داشته باشد، در گزارش «سراسری» می‌شود؛
  // وگرنه مشتی صفر نشان داده می‌شد که دروغ است (سنجیده شد: با پروندهٔ نبوده «sarasari» می‌داد).
  if (o.globalList && hasAny(o.globalList)) { list = mergeList(list, o.globalList); az = 'sarasari' }
  if (folderList) { list = mergeList(list, folderList); az = 'poshe' }
  if (chatList) { list = mergeList(list, chatList); az = 'chat' }
  return { list: list, az: az, folder: folder }
}

/**
 * ابزارهایی که باید از فهرستِ مدل برداشته شوند (برای `agent.ctx.tools.restrict`).
 * فقط ابزارهایی که «خاموش» شده‌اند برمی‌گردند؛ نام‌هایی که در فهرستِ موجود نیستند
 * دور ریخته می‌شوند تا `restrict` خطای «unknown global tool» ندهد.
 * دو راهِ خاموشی: تیکِ ابزارِ خودِ DSH (`abzar_dsh`)، و تیکِ سرورِ MCP که ابزارهای
 * «mcp__سرور__ابزار» را با خودش می‌برد.
 * @param opts همان ورودیِ `effectiveList` به‌علاوهٔ `known` (نام‌های موجود).
 * @returns {string[]}
 */
export function deniedTools(opts) {
  const o = opts || {}
  const known = Array.isArray(o.known) ? o.known : []
  const { list } = effectiveList(o)
  const off = list.abzar_dsh || {}
  const out = new Set(known.filter((name) => off[name] === false))
  // MCP ِ خاموش، ابزارهایش را هم می‌برد («mcp__سرور__ابزار»)، وگرنه تیکِ مکپ بی‌اثر می‌ماند.
  const offMcp = list.mcp || {}
  for (const name of known) {
    if (!name.startsWith('mcp__')) continue
    const rest = name.slice('mcp__'.length)
    const at = rest.indexOf('__')
    const server = at > 0 ? rest.slice(0, at) : rest
    if (offMcp[server] === false) out.add(name)
  }
  return [...out]
}

/**
 * نامِ گروهِ یک چیز: ابزارِ افزونه یا MCP ِ یک افزونه، زیرِ همان افزونه می‌رود.
 * (همان کاری که در کلود کد کردیم: افزونه‌ای که خاموش است، اسکیل و MCP ِ خودش را هم می‌برد.)
 * @param opts { name, kind, plugins, isPluginChild }
 * @returns {string} نامِ گروه.
 */
export function groupOf(opts) {
  const o = opts || {}
  const name = String(o.name || '')
  if (o.kind === 'afzune') return name
  const plug = pluginOwner(o, name)
  return plug || name
}

/**
 * اگر این نام به افزونه‌ای تعلق دارد، نامِ آن افزونه را برمی‌گرداند.
 * @param opts { name, kind, plugins }
 * @returns {string|null}
 */
export function pluginOwner(opts) {
  const o = opts || {}
  if (o.kind === 'afzune') return null
  const plugins = Array.isArray(o.plugins) ? o.plugins : []
  const name = String(o.name || '')
  if (!name) return null
  // «plugin:server» برای MCP و «plugin:skill» یا پیشوندِ افزونه برای اسکیل
  const colon = name.indexOf(':')
  if (colon > 0) {
    const head = name.slice(0, colon)
    if (plugins.includes(head)) return head
  }
  for (const p of plugins) {
    if (!p || p === name) continue
    if (name.startsWith(p + ':') || name.startsWith(p + '-') || name.startsWith(p + '/')) return p
  }
  return null
}

/**
 * یک تغییر را روی فهرستِ یک سطح اعمال می‌کند و همان فهرستِ تازه را می‌دهد.
 * @param list فهرستِ آن سطح.
 * @param change { kind, name, on }.
 * @returns فهرستِ تازه.
 */
export function applyChange(list, change) {
  const out = cleanList(list)
  const c = change || {}
  if (!isKind(c.kind)) return out
  const name = String(c.name || '').trim()
  if (!name) return out
  out[c.kind][name] = c.on !== false
  return out
}

/**
 * تغییرها را یکی‌یکی روی یک فهرست اعمال می‌کند.
 * @param list فهرستِ پایه.
 * @param changes فهرستِ تغییرها.
 * @returns فهرستِ تازه.
 */
export function applyChanges(list, changes) {
  let out = cleanList(list)
  for (const c of Array.isArray(changes) ? changes : []) out = applyChange(out, c)
  return out
}

/**
 * نمودارِ چهار دسته برای نمایش در تب، به‌ترتیبِ حبیب و با شمارش.
 * @param opts { available, list, query }
 *   available = { abzar_dsh:[نام…], mcp:[…], afzune:[…], eskil:[…] }
 *   list = فهرستِ موثر.
 *   query = متنِ جست‌وجو.
 * @returns Array<{ kind, label, items: Array<{ name, on, owner }>, onCount, total }>
 */
export function buildRows(opts) {
  const o = opts || {}
  const avail = o.available || {}
  const list = cleanList(o.list)
  const q = String(o.query || '').trim().toLowerCase()
  const plugins = Array.isArray(avail.afzune) ? avail.afzune : []
  const rows = []
  for (const kind of TIK_KIND) {
    const names = Array.isArray(avail[kind]) ? avail[kind].slice() : []
    const seen = new Set()
    const items = []
    for (const raw of names) {
      const name = String(raw || '').trim()
      if (!name || seen.has(name)) continue
      seen.add(name)
      const owner = kind === 'afzune' ? null : pluginOwner({ name: name, kind: kind, plugins: plugins })
      if (q && !name.toLowerCase().includes(q) && !(owner && owner.toLowerCase().includes(q))) continue
      // خاموشیِ افزونه، اسکیل و MCP ِ خودش را هم خاموش نشان می‌دهد
      const selfOff = list[kind][name] === false
      const ownerOff = owner ? list.afzune[owner] === false : false
      items.push({ name: name, on: !selfOff && !ownerOff, owner: owner, by: ownerOff ? owner : '' })
    }
    const total = items.length
    const onCount = items.filter((i) => i.on).length
    rows.push({ kind: kind, label: TIK_KIND_LABEL[kind], items: items, onCount: onCount, total: total })
  }
  return rows
}

/**
 * چکیدهٔ یک ثبت: چه چیزی عوض می‌شود، برای پرسشِ «مطمئنی؟» و پیامِ نتیجه.
 * @param changes فهرستِ تغییرها.
 * @returns { on: string[], off: string[], matn: string }
 */
export function summarize(changes) {
  const on = []
  const off = []
  for (const c of Array.isArray(changes) ? changes : []) {
    const name = String((c && c.name) || '').trim()
    if (!name) continue
    if (c.on === false) off.push(name)
    else on.push(name)
  }
  const fa = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
  const parts = []
  if (off.length) parts.push(fa(off.length) + ' تیک برداشته')
  if (on.length) parts.push(fa(on.length) + ' تیک زده')
  return { on: on, off: off, matn: parts.length ? parts.join(' · ') : 'تغییری نبود' }
}

/**
 * آیا این چت «تازه» است (پیش از ثبت دست‌نخورده، و هنوز پیامی ندارد)؟
 * دو شرط با هم: پیامی نفرستاده باشد، و زمانِ ثبتِ تیک‌ها بعد از بازشدنش باشد.
 * شرطِ دوم همان «چتِ بازِ قدیمی دست نمی‌خورد» ِ حبیب است.
 * @param opts { hasMessages, openedAt, savedAt }
 * @returns {boolean}
 */
export function isFreshChat(opts) {
  const o = opts || {}
  if (o.hasMessages !== false) return false
  const opened = Number(o.openedAt)
  const saved = Number(o.savedAt)
  if (!Number.isFinite(opened) || !Number.isFinite(saved)) return false
  return opened >= saved
}
